
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

interface MockGeminiResponse {
  response: { text: () => string };
}

interface MockVariant {
  caption: string;
  alt: string;
  hashtags: string[];
  cta: string;
  mood: string;
  style: string;
  safety_level: string;
  nsfw: boolean;
}

const createTextModelMock = () => ({
  generateContent: vi.fn()
});

const createMockResponse = (payload: string): MockGeminiResponse => ({
  response: { text: () => payload }
});

const createVariantSet = (caption: string, hashtags: string[]) => {
  const failingCaptionDescriptors = [
    'narrates every studio light focusing on the subject with extended, flowing prose that easily breaks the 250 character ceiling for X while celebrating the studio choreography in lavish detail.',
    'spends paragraph-length sentences on the subject weaving through studio rigs, stacking descriptive flourishes until the character count rockets far past what X allows, all while repeating the studio spotlight motif.',
    'writes a sprawling diary entry about the subject pacing around the studio, layering sensory notes, camera setups, and backstage chatter until the caption balloons beyond platform safety.',
    'keeps riffing on the subject under studio strobes, piling on metaphors and color commentary so aggressively that any social platform moderator would flag the caption for being far too long.',
    'unfurls an epic about the subject mastering the studio stage, refusing to wrap up and instead cataloging every lighting scheme and angle until the count blows past the allowed limit.'
  ];

  const failingAltDescriptors = [
    'Expansive studio narrative about the subject soaking in endless lighting cues.',
    'Lengthy studio walkthrough describing the subject from every dramatic angle.',
    'Detailed studio diary chronicling the subject across numerous lighting setups.',
    'Verbose studio recap of the subject bathed in relentless spotlight changes.',
    'Epic studio chronicle following the subject through exhaustive lighting choreography.'
  ];

  const passingCaptionDescriptors = [
    'spotlighting the subject under warm studio lights.',
    'showcasing the subject with cinematic studio contrast.',
    'capturing the subject amid bold studio colors.',
    'framing the subject against a polished studio backdrop.',
    'highlighting the subject with creative studio angles.'
  ];

  const passingAltDescriptors = [
    'Warm studio portrait focusing on the subject and lighting cues.',
    'Cinematic studio scene featuring the subject with dramatic contrast.',
    'Bold studio palette surrounding the subject in a vivid composition.',
    'Polished studio backdrop framing the subject with crisp detail.',
    'Creative studio angle emphasizing the subject in motion.'
  ];

  const isFailing = caption === LONG_FAILING_CAPTION;
  const captionDescriptors = isFailing ? failingCaptionDescriptors : passingCaptionDescriptors;
  const altDescriptors = isFailing ? failingAltDescriptors : passingAltDescriptors;

  const base: MockVariant = {
    caption: `${caption} ${captionDescriptors[0]}`,
    alt: 'Detailed alt text describing the studio scene for regression testing.',
    hashtags,
    cta: 'Check it out',
    mood: 'Upbeat',
    style: 'Bold Persona',
    safety_level: 'normal',
    nsfw: false
  };

  const variants = Array.from({ length: 5 }, (_, index) => ({
    ...base,
    caption: `${caption} ${captionDescriptors[index] ?? captionDescriptors[captionDescriptors.length - 1]}`,
    alt: `${base.alt} ${altDescriptors[index] ?? altDescriptors[altDescriptors.length - 1]}`
  }));

  return {
    variants,
    payload: JSON.stringify(variants)
  };
};

const LONG_FAILING_CAPTION = 'First attempt caption exceeding X rules by narrating how the subject moves through the studio lights with endless descriptive beats that keep layering detail about the subject in the studio, celebrating the subject in the studio with more imagery and commentary until the sentence pushes well beyond the safe character count required for X posts while staying focused on the studio subject story arc.';

const createRankingPayload = (variant: MockVariant) => JSON.stringify({
  winner_index: 0,
  scores: [5, 4, 3, 2, 1],
  reason: 'Persona retention regression test',
  final: variant
});

const configureTextModelMock = (
  textModel: ReturnType<typeof createTextModelMock>,
  failing: ReturnType<typeof createVariantSet>,
  passing: ReturnType<typeof createVariantSet>
) => {
  textModel.generateContent.mockImplementation((parts: Array<{ text: string }>) => {
    const prompt = parts?.[0]?.text ?? '';
    const isRankingCall = prompt.includes('Rank the 5');
    const hasFixHint = prompt.includes('Fix:');

    if (isRankingCall) {
      if (!hasFixHint) {
        return Promise.resolve(
          createMockResponse(createRankingPayload(failing.variants[0]))
        );
      }

      return Promise.resolve(
        createMockResponse(createRankingPayload(passing.variants[0]))
      );
    }

    if (!hasFixHint) {
      return Promise.resolve(createMockResponse(failing.payload));
    }

    return Promise.resolve(createMockResponse(passing.payload));
  });
};

// Define proper call structure for mock calls
interface MockCallPart {
  text?: string;
}

const extractVariantPrompts = (calls: unknown[][]) => calls
  .map(call => {
    // Type guard to ensure call structure is what we expect
    const firstArg = call[0];
    if (Array.isArray(firstArg) && firstArg.length > 0) {
      const part = firstArg[0] as MockCallPart;
      return part.text ?? '';
    }
    return '';
  })
  .filter(text => text.includes('PLATFORM:'));

describe('Gemini pipelines keep persona tone on retry', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('forwards tone fields on image pipeline retry', async () => {
    const textModel = createTextModelMock();
    const visionModel = { generateContent: vi.fn() };

    vi.doMock('../../../server/lib/gemini.js', () => ({ textModel, visionModel, isGeminiAvailable: () => true }));

    const fetchMock = vi.spyOn(global, 'fetch');
    fetchMock.mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'image/jpeg' }),
      arrayBuffer: async () => Buffer.alloc(256, 1)
    } as unknown as Response);

    visionModel.generateContent.mockResolvedValue({
      response: { text: () => JSON.stringify({ objects: ['subject'], setting: 'studio', mood: 'focused' }) }
    });

    const geminiModule = await import('../../../server/caption/geminiPipeline.ts');

    const failing = createVariantSet(LONG_FAILING_CAPTION, ['#one', '#two', '#three', '#four']);
    const passing = createVariantSet('Second attempt caption obeys X rules', ['#one', '#two']);

    configureTextModelMock(textModel, failing, passing);

    await geminiModule.pipeline({
      imageUrl: 'https://example.com/image.png',
      platform: 'x',
      voice: 'Persona Voice',
      style: 'Bold Persona',
      mood: 'Upbeat',
      nsfw: false
    });

    const variantPrompts = extractVariantPrompts(textModel.generateContent.mock.calls);

    expect(variantPrompts).toHaveLength(2);
    const retryPrompt = variantPrompts[1];
    expect(retryPrompt).toContain('Fix:');
    expect(retryPrompt).toContain('STYLE: Bold Persona');
    expect(retryPrompt).toContain('MOOD: Upbeat');

    fetchMock.mockRestore();
  });

  it('forwards tone fields on rewrite pipeline retry', async () => {
    const textModel = createTextModelMock();
    const visionModel = { generateContent: vi.fn() };

    vi.doMock('../../../server/lib/gemini.js', () => ({ textModel, visionModel, isGeminiAvailable: () => true }));

    const rewriteModule = await import('../../../server/caption/rewritePipeline.ts');

    const failing = createVariantSet(LONG_FAILING_CAPTION, ['#one', '#two', '#three', '#four']);
    const passing = createVariantSet('Rewrite attempt passes platform rules', ['#one', '#two']);

    configureTextModelMock(textModel, failing, passing);

    await rewriteModule.pipelineRewrite({
      platform: 'x',
      voice: 'Persona Voice',
      style: 'Bold Persona',
      mood: 'Upbeat',
      existingCaption: 'Original',
      nsfw: false
    });

    const variantPrompts = extractVariantPrompts(textModel.generateContent.mock.calls);

    expect(variantPrompts).toHaveLength(2);
    const retryPrompt = variantPrompts[1];
    expect(retryPrompt).toContain('Fix:');
    expect(retryPrompt).toContain('STYLE: Bold Persona');
    expect(retryPrompt).toContain('MOOD: Upbeat');
  });

  it('forwards tone fields on text-only pipeline retry', async () => {
    const textModel = createTextModelMock();

    vi.doMock('../../../server/lib/gemini.js', () => ({ textModel }));

    const textOnlyModule = await import('../../../server/caption/textOnlyPipeline.ts');

    const failing = createVariantSet(LONG_FAILING_CAPTION, ['#one', '#two', '#three', '#four']);
    const passing = createVariantSet('Text-only attempt passes platform rules', ['#one', '#two']);

    configureTextModelMock(textModel, failing, passing);

    await textOnlyModule.pipelineTextOnly({
      platform: 'x',
      voice: 'Persona Voice',
      theme: 'Testing theme',
      context: 'Testing context',
      style: 'Bold Persona',
      mood: 'Upbeat',
      nsfw: false
    });

    const variantPrompts = extractVariantPrompts(textModel.generateContent.mock.calls);

    expect(variantPrompts).toHaveLength(2);
    const retryPrompt = variantPrompts[1];
    expect(retryPrompt).toContain('Fix:');
    expect(retryPrompt).toContain('STYLE: Bold Persona');
    expect(retryPrompt).toContain('MOOD: Upbeat');
  });
});
