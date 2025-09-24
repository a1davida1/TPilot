import fs from 'fs/promises';
import path from 'path';

export interface ContentParameters {
  photoType: 'casual' | 'workout' | 'shower' | 'showing-skin' | 'spicy' | 'very-spicy' | 'all-xs' | 'needs_review';
  textTone: 'confident' | 'playful' | 'mysterious' | 'authentic' | 'sassy';
  style: string;
  includePromotion: boolean;
  selectedHashtags: string[];
  customPrompt?: string;
  platform: string;
}

export interface PhotoInstructions {
  lighting: string;
  angles: string;
  composition: string;
  styling: string;
  technical: string;
  sceneSetup: string;
}

export interface GeneratedContent {
  titles: string[];
  content: string;
  photoInstructions: PhotoInstructions;
  tags: string[];
}

export interface PresetVariation {
  titles: string[];
  content: string;
  photoInstructions: PhotoInstructions;
}

export interface PhotoConfig {
  themes: string[];
  settings: string[];
  clothing: string[];
  lighting: string;
  angles: string;
  mood: string;
}

export interface ToneStyle {
  starters: string[];
  descriptors: string[];
  endings: string[];
  emojis: string[];
}

interface FragmentDefinition {
  builder: (context: FragmentRuntimeContext) => string;
  weight?: number;
}

interface ToneFragmentPool {
  intro: FragmentDefinition[];
  promo: FragmentDefinition[];
  connectors: string[];
  fillers: string[];
}

interface PhotoFragmentPool {
  body: FragmentDefinition[];
  connectors: string[];
}

interface FragmentRuntimeContext {
  pickDescriptor(): string;
  pickTheme(): string;
  pickSetting(): string;
  pickEmoji(): string;
  pickFiller(): string;
  mood: string;
  photoType: ContentParameters['photoType'];
}

// Photo Type Specific Content Variations
const photoTypeVariations = {
  'teasing': {
    themes: ['playful tease', 'subtle hint', 'flirty suggestion', 'mysterious allure', 'coy moment'],
    settings: ['bedroom door', 'mirror selfie', 'cozy couch', 'bath time', 'morning bed'],
    clothing: ['oversized shirt', 'silk robe', 'cute lingerie peek', 'towel wrap', 'strategic coverage'],
    lighting: 'Soft intimate lighting, warm candlelight, sunset glow',
    angles: 'Teasing glimpses, over-shoulder looks, partial reveals',
    mood: 'playful and teasing'
  },
  'behind-scenes': {
    themes: ['getting ready', 'makeup process', 'outfit selection', 'photoshoot prep', 'content creation'],
    settings: ['vanity mirror', 'wardrobe area', 'makeup station', 'photo setup', 'behind camera'],
    clothing: ['robe and lingerie', 'getting dressed', 'outfit changes', 'casual prep wear'],
    lighting: 'Natural backstage lighting, mirror lights, behind-the-scenes authenticity',
    angles: 'Candid preparation shots, mirror reflections, process documentation',
    mood: 'authentic and intimate'
  },
  'outfit': {
    themes: ['outfit reveal', 'fashion show', 'style showcase', 'wardrobe tour', 'clothing haul'],
    settings: ['bedroom mirror', 'dressing room', 'closet area', 'fashion backdrop', 'outfit display'],
    clothing: ['multiple outfits', 'lingerie sets', 'dress collection', 'style variations'],
    lighting: 'Bright fashion lighting, clear visibility, flattering angles',
    angles: 'Full body shots, detail close-ups, 360 turns, outfit transitions',
    mood: 'fashionable and stylish'
  },
  'casual': {
    themes: ['natural beauty', 'everyday moment', 'comfortable vibe', 'relaxed mood', 'candid capture'],
    settings: ['cozy bedroom', 'living room', 'coffee corner', 'reading nook', 'morning sunlight'],
    clothing: ['comfortable clothes', 'casual wear', 'cozy sweaters', 'relaxed fit', 'everyday style'],
    lighting: 'Natural window light, soft ambient lighting, golden hour glow',
    angles: 'Natural poses, candid moments, relaxed positioning',
    mood: 'comfortable and natural'
  },
  'workout': {
    themes: ['fitness journey', 'strength training', 'post-workout glow', 'active lifestyle', 'wellness focus'],
    settings: ['home gym', 'workout space', 'yoga mat', 'fitness studio', 'outdoor exercise'],
    clothing: ['activewear', 'sports bra', 'leggings', 'tank tops', 'workout gear'],
    lighting: 'Bright energetic lighting, natural gym light, motivational atmosphere',
    angles: 'Action shots, strength poses, progress documentation',
    mood: 'energetic and powerful'
  },
  'shower': {
    themes: ['self-care ritual', 'relaxation time', 'cleansing moment', 'peaceful solitude', 'steam dreams'],
    settings: ['bathroom', 'shower space', 'bathtub area', 'spa-like setting', 'private sanctuary'],
    clothing: ['towel wrap', 'minimal coverage', 'bath accessories', 'natural state'],
    lighting: 'Soft bathroom lighting, steam effects, water reflections',
    angles: 'Artistic water shots, steam silhouettes, relaxation moments',
    mood: 'peaceful and refreshing'
  },
  'showing-skin': {
    themes: ['body confidence', 'artistic expression', 'natural beauty', 'self-love', 'empowerment'],
    settings: ['private bedroom', 'artistic studio', 'natural lighting', 'intimate space', 'personal sanctuary'],
    clothing: ['minimal clothing', 'artistic draping', 'strategic coverage', 'natural confidence'],
    lighting: 'Artistic lighting, shadow play, body-positive illumination',
    angles: 'Tasteful artistic angles, empowering perspectives, confident poses',
    mood: 'confident and artistic'
  },
  'spicy': {
    themes: ['sensual mood', 'intimate moment', 'passionate expression', 'seductive energy', 'romantic vibe'],
    settings: ['dimly lit bedroom', 'intimate setting', 'romantic atmosphere', 'private space', 'cozy ambiance'],
    clothing: ['lingerie', 'silk items', 'elegant intimates', 'sensual fabrics', 'romantic wear'],
    lighting: 'Warm intimate lighting, candle glow, romantic ambiance',
    angles: 'Seductive poses, intimate perspectives, romantic framing',
    mood: 'romantic and seductive'
  },
  'very-spicy': {
    themes: ['intense passion', 'raw desire', 'uninhibited expression', 'bold confidence', 'fierce energy'],
    settings: ['private bedroom', 'intimate studio', 'personal space', 'artistic setting', 'bold environment'],
    clothing: ['minimal coverage', 'artistic nudity', 'bold choices', 'confident expression'],
    lighting: 'Dramatic lighting, bold contrasts, intense atmosphere',
    angles: 'Bold perspectives, confident poses, artistic intensity',
    mood: 'intense and passionate'
  },
  'all-xs': {
    themes: ['complete freedom', 'artistic expression', 'unlimited creativity', 'boundary pushing', 'raw art'],
    settings: ['private studio', 'artistic space', 'creative environment', 'personal gallery', 'art sanctuary'],
    clothing: ['artistic nudity', 'complete freedom', 'natural expression', 'unlimited creativity'],
    lighting: 'Professional studio lighting, artistic effects, creative illumination',
    angles: 'Unlimited creative perspectives, artistic freedom, boundary-free composition',
    mood: 'free and unlimited'
  },
  'needs_review': {
    themes: ['careful artistry', 'thoughtful expression', 'curated content', 'selective sharing', 'premium art'],
    settings: ['private studio', 'controlled environment', 'curated space', 'selective setting'],
    clothing: ['carefully chosen', 'artistically selected', 'thoughtfully curated'],
    lighting: 'Controlled lighting, careful illumination, selective exposure',
    angles: 'Curated perspectives, selective angles, thoughtful composition',
    mood: 'careful and curated'
  }
};

// Text Tone Styles
const textToneStyles = {
  'confident': {
    starters: ["Just dropped", "Created some", "Brought you", "Here's what", "Made this"],
    descriptors: ["stunning", "powerful", "bold", "fierce", "incredible"],
    endings: ["and I'm proud of it", "feeling confident about this one", "own your power", "confidence is everything"],
    emojis: ["💪", "🔥", "✨", "👑", "💎"]
  },
  'playful': {
    starters: ["Guess what", "Oops!", "Surprise!", "Hey there", "So..."],
    descriptors: ["cute", "silly", "adorable", "cheeky", "mischievous"],
    endings: ["hope you like it!", "whoops! 🙈", "couldn't resist!", "being a little naughty"],
    emojis: ["😘", "🙈", "😇", "💕", "🎀"]
  },
  'mysterious': {
    starters: ["Something happened", "In the shadows", "Late night", "Behind closed doors", "Secret moment"],
    descriptors: ["hidden", "forbidden", "mysterious", "secretive", "enigmatic"],
    endings: ["but that's all I'll say", "the rest remains hidden", "some secrets are worth keeping", "only for those who understand"],
    emojis: ["🌙", "🖤", "🕯️", "🔮", "💫"]
  },
  'authentic': {
    starters: ["Real talk", "Being honest", "Just me", "Genuine moment", "Truth is"],
    descriptors: ["real", "honest", "genuine", "authentic", "true"],
    endings: ["just being myself", "no filters needed", "this is who I am", "raw and real"],
    emojis: ["💯", "✨", "🌸", "💗", "🌟"]
  },
  'sassy': {
    starters: ["Listen up", "Well well", "Oh please", "You think", "Honey"],
    descriptors: ["fierce", "bold", "attitude", "confidence", "sass"],
    endings: ["deal with it", "take it or leave it", "that's how I roll", "bow down"],
    emojis: ["💅", "😏", "🔥", "👑", "💄"]
  }
};

export const toneFragmentPools: Record<ContentParameters['textTone'], ToneFragmentPool> = {
  'confident': {
    fillers: ['honestly', 'not gonna lie', 'for real', 'straight up', 'seriously'],
    connectors: ['btw,', 'plus,', 'so here\'s the kicker:', 'and yeah,', 'because yeah,'],
    intro: [
      {
        weight: 3,
        builder: context => `${formatFiller(context.pickFiller())} I pulled together something ${context.pickDescriptor()} in the ${context.pickSetting()}.`
      },
      {
        builder: context => `I\'m serving ${context.pickDescriptor()} energy with that ${context.pickTheme()} concept ${context.pickEmoji()}`
      },
      {
        builder: context => `Built this drop like a pro and it shows in every ${context.pickDescriptor()} detail.`
      },
      {
        builder: context => `That ${context.pickTheme()} moment turned into a ${context.pickDescriptor()} flex real quick.`
      }
    ],
    promo: [
      {
        weight: 2,
        builder: context => `VIPs get the full ${context.pickDescriptor()} reel — it\'s stacked with ${context.pickTheme()} angles.`
      },
      {
        builder: () => `Slide into the premium tier if you want the complete story — I\'m not trimming the heat.`
      },
      {
        builder: context => `Premium fam knows I don\'t play — the extras are straight ${context.pickDescriptor()} moments ${context.pickEmoji()}`
      }
    ]
  },
  'playful': {
    fillers: ['kinda', 'honestly', 'not gonna lie', 'low-key', 'sorta'],
    connectors: ['btw,', 'so yeah,', 'and yup,', 'alsooo,', 'meanwhile,'],
    intro: [
      {
        weight: 3,
        builder: context => `${formatFiller(context.pickFiller())} I went ${context.pickDescriptor()} with this ${context.pickTheme()} idea.`
      },
      {
        builder: context => `I\'m giggling because that ${context.pickSetting()} turned into something ${context.pickDescriptor()} real fast.`
      },
      {
        builder: context => `Tell me why I\'m obsessed with this ${context.pickTheme()} moment ${context.pickEmoji()}`
      },
      {
        builder: context => `I kinda let the ${context.pickDescriptor()} vibes run wild today and I\'m not sorry.`
      }
    ],
    promo: [
      {
        builder: context => `If you wanna peek at the rest, it\'s hiding in my VIP corner being all ${context.pickDescriptor()}.`
      },
      {
        weight: 2,
        builder: () => `Full blooper reel and spicy outtakes are chilling behind the subscribe button 😘`
      },
      {
        builder: context => `Promise the premium set has even more ${context.pickDescriptor()} silliness waiting.`
      }
    ]
  },
  'mysterious': {
    fillers: ['quietly', 'low-key', 'hushed', 'softly', 'honestly'],
    connectors: ['in the shadows,', 'between us,', 'just saying,', 'and yet,', 'meanwhile,'],
    intro: [
      {
        weight: 2,
        builder: context => `${formatFiller(context.pickFiller())} I wandered through a ${context.pickTheme()} night and captured the whispers.`
      },
      {
        builder: context => `There\'s a ${context.pickDescriptor()} hush in that ${context.pickSetting()} that I can\'t shake.`
      },
      {
        builder: context => `Some ${context.pickTheme()} secrets slipped out and I just let the camera listen ${context.pickEmoji()}`
      },
      {
        builder: context => `Let\'s just say the ${context.pickDescriptor()} mood got recorded quietly.`
      }
    ],
    promo: [
      {
        builder: context => `The deeper layers stay locked for those curious enough to chase the ${context.pickDescriptor()} glow.`
      },
      {
        builder: () => `Only the inner circle gets the full tale — the rest remains tucked away.`
      },
      {
        weight: 2,
        builder: context => `Follow the trail if you crave the entire ${context.pickTheme()} enigma.`
      }
    ]
  },
  'authentic': {
    fillers: ['honestly', 'for real', 'not gonna lie', 'truthfully', 'kinda'],
    connectors: ['real talk,', 'btw,', 'and honestly,', 'because, honestly,', 'meanwhile,'],
    intro: [
      {
        weight: 2,
        builder: context => `${formatFiller(context.pickFiller())} it\'s just me leaning into that ${context.pickTheme()} story.`
      },
      {
        builder: context => `I kept it ${context.pickDescriptor()} in the ${context.pickSetting()} — nothing staged, promise.`
      },
      {
        builder: context => `I\'m sharing the ${context.pickTheme()} moment exactly how it felt ${context.pickEmoji()}`
      },
      {
        builder: () => `I\'m just letting the candid vibes breathe today.`
      }
    ],
    promo: [
      {
        builder: context => `If you vibe with the realness, the full gallery stays cozy with my subs — it\'s all ${context.pickDescriptor()}.`
      },
      {
        builder: () => `I dropped more raw takes for members — zero polish, just truth.`
      },
      {
        weight: 2,
        builder: context => `Subscribers get the extended cut and every ${context.pickDescriptor()} breath in between.`
      }
    ]
  },
  'sassy': {
    fillers: ['honestly', 'not gonna lie', 'dead serious', 'kinda', 'for real'],
    connectors: ['btw,', 'so yeah,', 'and guess what,', 'meanwhile,', 'also,'],
    intro: [
      {
        weight: 3,
        builder: context => `${formatFiller(context.pickFiller())} I snapped ${context.pickDescriptor()} shots and I\'m feeling myself.`
      },
      {
        builder: context => `Try keeping up with this ${context.pickDescriptor()} attitude coming straight from the ${context.pickSetting()}.`
      },
      {
        builder: context => `I let the ${context.pickTheme()} fantasy play and now you\'re welcome ${context.pickEmoji()}`
      },
      {
        builder: () => `I\'m not toning it down — why would I?`
      }
    ],
    promo: [
      {
        builder: context => `If you\'re bold enough, the premium feed is stacked with unapologetic ${context.pickDescriptor()} clips.`
      },
      {
        builder: () => `VIPs get the talk-back moments — the spice, the shade, all of it.`
      },
      {
        weight: 2,
        builder: context => `Subscribers already know the ${context.pickTheme()} aftermath stays locked up with me.`
      }
    ]
  }
};

export const photoTypeFragmentPools: Record<ContentParameters['photoType'], PhotoFragmentPool> = {
  'casual': {
    connectors: ['in that moment,', 'and then,', 'so naturally,', 'right after,', 'meanwhile,'],
    body: [
      {
        weight: 2,
        builder: context => `Sunlight through the ${context.pickSetting()} made everything feel ${context.pickDescriptor()} and undone.`
      },
      {
        builder: context => `Messy hair, comfy layers, and the ${context.mood} vibe kinda took over.`
      },
      {
        builder: context => `It\'s just me and that ${context.pickTheme()} slice of life — nothing forced, just ease.`
      },
      {
        builder: context => `We\'re talking soft laughs, bare feet, and a ${context.pickDescriptor()} calm.`
      }
    ]
  },
  'workout': {
    connectors: ['after the last rep,', 'between sets,', 'and then,', 'while catching breath,', 'meanwhile,'],
    body: [
      {
        weight: 2,
        builder: context => `Sweat dripping in the ${context.pickSetting()} and I\'m feeling ${context.pickDescriptor()} strong.`
      },
      {
        builder: context => `That ${context.pickTheme()} grind left my pulse racing and my smile all kinds of wild.`
      },
      {
        builder: context => `I\'m flexing, laughing, and letting the ${context.mood} glow show.`
      },
      {
        builder: context => `Endorphins hit, music stayed loud, and the camera caught the ${context.pickDescriptor()} finish.`
      }
    ]
  },
  'shower': {
    connectors: ['under the steam,', 'while the water fell,', 'between droplets,', 'softly,', 'meanwhile,'],
    body: [
      {
        weight: 2,
        builder: context => `Steam wrapped the ${context.pickSetting()} and everything went ${context.pickDescriptor()} and hazy.`
      },
      {
        builder: context => `Water traced my shoulders while that ${context.pickTheme()} idea soaked in.`
      },
      {
        builder: context => `It\'s all warm tiles, slick skin, and a ${context.mood} hush.`
      },
      {
        builder: context => `I\'m letting the droplets tell the ${context.pickDescriptor()} story.`
      }
    ]
  },
  'showing-skin': {
    connectors: ['with every curve,', 'frame by frame,', 'and then,', 'meanwhile,', 'slowly,'],
    body: [
      {
        builder: context => `Soft fabrics slipped away until the ${context.pickDescriptor()} shapes owned the ${context.pickSetting()}.`
      },
      {
        weight: 2,
        builder: context => `Shadow lines on skin made that ${context.pickTheme()} story glow.`
      },
      {
        builder: context => `I\'m celebrating the body, the light, and that ${context.mood} confidence.`
      },
      {
        builder: context => `The lens lingered because every angle felt ${context.pickDescriptor()} and intentional.`
      }
    ]
  },
  'spicy': {
    connectors: ['no lie,', 'right when the heat rose,', 'and after that,', 'meanwhile,', 'between whispers,'],
    body: [
      {
        weight: 2,
        builder: context => `Silk, shadows, and a ${context.pickDescriptor()} smirk turned the ${context.pickSetting()} molten.`
      },
      {
        builder: context => `I rode that ${context.pickTheme()} wave until the room felt like embers.`
      },
      {
        builder: context => `The ${context.mood} tension snapped right as the shutter clicked.`
      },
      {
        builder: context => `We played with light so every highlight screamed ${context.pickDescriptor()}.`
      }
    ]
  },
  'very-spicy': {
    connectors: ['truth be told,', 'and yeah,', 'while the candles burned,', 'between heartbeats,', 'meanwhile,'],
    body: [
      {
        weight: 2,
        builder: context => `No filter, just ${context.pickDescriptor()} intensity draped across the ${context.pickSetting()}.`
      },
      {
        builder: context => `Every ${context.pickTheme()} whisper turned louder and I didn\'t flinch.`
      },
      {
        builder: context => `It\'s bare skin, raw edges, and a ${context.mood} surrender.`
      },
      {
        builder: context => `I held the pose until the fire looked right back.`
      }
    ]
  },
  'all-xs': {
    connectors: ['full disclosure,', 'meanwhile,', 'when the limits fell,', 'after that,', 'between bold beats,'],
    body: [
      {
        weight: 2,
        builder: context => `Pushed every boundary in that ${context.pickSetting()} — it\'s ${context.pickDescriptor()} freedom.`
      },
      {
        builder: context => `The ${context.pickTheme()} vision went all the way and I didn\'t look back.`
      },
      {
        builder: context => `We played with every angle until the art felt limitless and ${context.pickDescriptor()}.`
      },
      {
        builder: context => `It\'s wild, raw, and dripping in ${context.mood} abandon.`
      }
    ]
  },
  'needs_review': {
    connectors: ['keeping it safe,', 'in that locked room,', 'between us,', 'meanwhile,', 'carefully,'],
    body: [
      {
        builder: context => `There\'s explicit artistry here — ${context.pickDescriptor()} and unapologetic.`
      },
      {
        weight: 2,
        builder: context => `Every ${context.pickTheme()} scene pushes the frame with intent.`
      },
      {
        builder: context => `I\'m curating what feels right, keeping the ${context.mood} promise intact.`
      },
      {
        builder: context => `Handled every shot carefully so it stays ${context.pickDescriptor()} and respectful.`
      }
    ]
  }
};

export const generalConnectors = ['btw,', 'so yeah,', 'and honestly,', 'plus,', 'meanwhile'];

interface SectionOptions {
  min?: number;
  max?: number;
  skipChance?: number;
}

function formatFiller(filler: string): string {
  const trimmed = filler.trim();
  if (trimmed.length === 0) {
    return '';
  }
  const capitalized = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return /[,:;!?]$/.test(capitalized) ? capitalized : `${capitalized},`;
}

function cleanSpacing(text: string): string {
  return text.replace(/\s+([,;:])/g, '$1').replace(/\s{2,}/g, ' ').trim();
}

function randomInt(min: number, max: number): number {
  const minValue = Math.ceil(min);
  const maxValue = Math.floor(max);
  if (maxValue < minValue) {
    return minValue;
  }
  return Math.floor(Math.random() * (maxValue - minValue + 1)) + minValue;
}

function pickRandom<T>(items: readonly T[]): T {
  if (items.length === 0) {
    throw new Error('Cannot pick from an empty collection');
  }
  return items[Math.floor(Math.random() * items.length)];
}

function pickUniqueValue(values: string[], used: Set<string>): string {
  if (values.length === 0) {
    return '';
  }
  const available = values.filter(value => !used.has(value));
  const pool = available.length > 0 ? available : values;
  const choice = pickRandom(pool);
  used.add(choice);
  return choice;
}

function shuffleArray<T>(values: T[]): T[] {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const temp = copy[index];
    copy[index] = copy[swapIndex];
    copy[swapIndex] = temp;
  }
  return copy;
}

function pickWeightedIndex<T extends { weight?: number }>(items: T[]): number {
  const totalWeight = items.reduce((sum, item) => sum + (item.weight ?? 1), 0);
  if (totalWeight <= 0) {
    return 0;
  }
  let roll = Math.random() * totalWeight;
  for (let index = 0; index < items.length; index += 1) {
    roll -= items[index].weight ?? 1;
    if (roll <= 0) {
      return index;
    }
  }
  return items.length - 1;
}

export function selectWeightedUniqueFragments<T extends { weight?: number }>(items: T[], count: number): T[] {
  if (items.length === 0 || count <= 0) {
    return [];
  }
  const available = [...items];
  const maxCount = Math.min(count, available.length);
  const selections: T[] = [];

  for (let index = 0; index < maxCount; index += 1) {
    const selectionIndex = pickWeightedIndex(available);
    selections.push(available[selectionIndex]);
    available.splice(selectionIndex, 1);
  }

  return selections;
}

function buildSection(pool: FragmentDefinition[], context: FragmentRuntimeContext, options?: SectionOptions): string {
  if (pool.length === 0) {
    return '';
  }

  const sectionOptions: Required<SectionOptions> = {
    min: options?.min ?? 2,
    max: options?.max ?? 3,
    skipChance: options?.skipChance ?? 0.2
  };

  const fragmentCount = randomInt(sectionOptions.min, sectionOptions.max);
  const selectedFragments = selectWeightedUniqueFragments(pool, fragmentCount);

  if (selectedFragments.length > 1 && Math.random() < sectionOptions.skipChance) {
    selectedFragments.splice(Math.floor(Math.random() * selectedFragments.length), 1);
  }

  const builtFragments = selectedFragments
    .map(fragment => fragment.builder(context).trim())
    .filter(fragmentText => fragmentText.length > 0);

  if (builtFragments.length === 0) {
    return '';
  }

  return cleanSpacing(shuffleArray(builtFragments).join(' '));
}

function createFragmentContext(
  toneStyle: ToneStyle,
  photoConfig: PhotoConfig,
  fillers: string[],
  photoType: ContentParameters['photoType']
): FragmentRuntimeContext {
  const descriptorUsage = new Set<string>();
  const themeUsage = new Set<string>();
  const settingUsage = new Set<string>();
  const fillerPool = fillers.length > 0 ? fillers : ['honestly'];

  return {
    pickDescriptor: () => pickUniqueValue(toneStyle.descriptors, descriptorUsage),
    pickTheme: () => pickUniqueValue(photoConfig.themes, themeUsage),
    pickSetting: () => pickUniqueValue(photoConfig.settings, settingUsage),
    pickEmoji: () => (toneStyle.emojis.length > 0 ? pickRandom(toneStyle.emojis) : ''),
    pickFiller: () => pickRandom(fillerPool),
    mood: photoConfig.mood,
    photoType
  };
}

function buildCustomPromptSegment(customPrompt: string, connectors: string[]): string {
  const trimmedPrompt = customPrompt.trim();
  if (trimmedPrompt.length === 0) {
    return '';
  }

  const connectorPool = connectors.length > 0 ? connectors : generalConnectors;
  const prefix = connectorPool.length > 0 && Math.random() < 0.9 ? pickRandom(connectorPool) : '';
  const suffix = connectorPool.length > 0 && Math.random() < 0.35 ? pickRandom(connectorPool) : '';

  const parts: string[] = [];
  if (prefix) {
    parts.push(prefix);
  }
  parts.push(trimmedPrompt);
  if (suffix) {
    parts.push(suffix);
  }

  return cleanSpacing(parts.join(' '));
}

// Generate content based on all parameters
export function generateAdvancedContent(params: ContentParameters): GeneratedContent {
  // Check if this is a preset request and use preset variations
  const presetVariation = getRandomPresetVariation(params.style);
  if (presetVariation) {
    console.log(`🎯 Using preset variation for: ${params.style}`);
    return {
      titles: presetVariation.titles,
      content: presetVariation.content,
      photoInstructions: {
        lighting: presetVariation.photoInstructions.lighting,
        angles: presetVariation.photoInstructions.angles || "natural angles",
        composition: presetVariation.photoInstructions.composition,
        styling: presetVariation.photoInstructions.styling,
        technical: presetVariation.photoInstructions.technical || "natural lighting",
        sceneSetup: presetVariation.photoInstructions.sceneSetup || "casual setting"
      },
      tags: ['preset-content', params.style, params.platform]
    };
  }

  // Fallback to existing system for non-preset requests
  const photoConfig = photoTypeVariations[params.photoType as keyof typeof photoTypeVariations] || photoTypeVariations['casual'] as PhotoConfig;
  const toneStyle = textToneStyles[params.textTone as keyof typeof textToneStyles] || textToneStyles['authentic'] as ToneStyle;

  const titles = generateTitles(params, photoConfig, toneStyle);
  const content = generateMainContent(params, photoConfig, toneStyle);
  const photoInstructions = generatePhotoInstructions(params, photoConfig);
  const tags = generateTags(params, photoConfig);

  return {
    titles,
    content,
    photoInstructions,
    tags
  };
}

async function loadPresetVariations(): Promise<Record<string, PresetVariation[]>> {
  try {
    const presetPath = path.join(process.cwd(), 'prompts', 'preset-variations.json');
    const data = await fs.readFile(presetPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.warn('No preset variations file found, using built-in presets');
    return {
      'morning-coffee': [{
        titles: ["Morning coffee and cozy vibes ☕", "Starting my day right", "Coffee in hand, ready for anything"],
        content: "There's something magical about that first sip of coffee in the morning. Messy hair, cozy sweater, and that peaceful moment before the day begins. Just me and my thoughts in the quiet morning light.",
        photoInstructions: {
          lighting: "Soft morning light, golden hour glow through windows",
          angles: "Candid morning shots, cozy intimate angles",
          composition: "Natural comfortable framing with coffee elements",
          styling: "Cozy morning wear, comfortable and relaxed",
          technical: "Natural lighting, soft focus, warm tones",
          sceneSetup: "Cozy morning setting with coffee and natural light"
        }
      }],
      'workout-motivation': [{
        titles: ["Post-workout glow hits different 💪", "Feeling strong and unstoppable", "Sweat, determination, and pride"],
        content: "Just finished an intense workout and I'm feeling incredible. There's something about pushing your limits that makes you feel alive. Endorphins flowing, muscles burning in the best way, and that sense of accomplishment.",
        photoInstructions: {
          lighting: "Bright energetic lighting, motivational atmosphere",
          angles: "Strong empowering angles, action documentation",
          composition: "Athletic framing showing strength and determination",
          styling: "Workout gear, athletic wear, fitness focused",
          technical: "Clear bright lighting, action-ready settings",
          sceneSetup: "Gym or workout space, fitness equipment visible"
        }
      }]
    };
  }
}

let presetVariationsCache: Record<string, PresetVariation[]> | null = null;

async function getPresetVariations(): Promise<Record<string, PresetVariation[]>> {
  if (!presetVariationsCache) {
    presetVariationsCache = await loadPresetVariations();
  }
  return presetVariationsCache;
}

function getRandomPresetVariation(presetId: string): PresetVariation | null {
  // This is a synchronous version that returns null for non-preset requests
  // The async loading is handled elsewhere
  return null;
}

function generateTitles(params: ContentParameters, photoConfig: PhotoConfig, toneStyle: ToneStyle): string[] {
  const titles: string[] = [];
  const themes = photoConfig.themes;
  const starters = toneStyle.starters;
  const emojis = toneStyle.emojis;

  // Generate 3-5 varied titles
  titles.push(`${starters[0]} what happened during my ${themes[0]} session ${emojis[0]}`);
  titles.push(`${starters[1]} ${themes[1]} content just dropped ${emojis[1]}`);
  titles.push(`${themes[2]} vibes hit different today ${emojis[2]}`);

  if (params.photoType === 'all-xs') {
    titles.push(`Warning: ${themes[3] || 'exclusive'} content ahead - not for everyone ${emojis[3] || '🔞'}`);
    titles.push(`${starters[2]} the limits have been removed ${emojis[4] || '💎'}`);
  } else if (params.photoType === 'very-spicy') {
    titles.push(`${starters[3] || starters[0]} intense ${themes[3] || 'exclusive'} content ${emojis[3]}`);
  } else if (params.photoType === 'spicy') {
    titles.push(`${themes[3] || 'Spicy'} mood activated ${emojis[3]}`);
  }

  return titles.slice(0, Math.random() > 0.5 ? 3 : 4);
}

function generateMainContent(params: ContentParameters, photoConfig: PhotoConfig, toneStyle: ToneStyle): string {
  const tonePool = toneFragmentPools[params.textTone] ?? toneFragmentPools['authentic'];
  const photoPool = photoTypeFragmentPools[params.photoType] ?? photoTypeFragmentPools['casual'];
  const context = createFragmentContext(toneStyle, photoConfig, tonePool.fillers, params.photoType);

  const introSection = buildSection(tonePool.intro, context, { min: 2, max: 3, skipChance: 0.2 });
  const bodySection = buildSection(photoPool.body, context, { min: 2, max: 3, skipChance: 0.25 });

  const contentParts: string[] = [];
  if (introSection) {
    contentParts.push(introSection);
  }

  if (bodySection) {
    contentParts.push(bodySection);
  }

  // Add custom prompt integration
  if (params.customPrompt) {
    const connectors = [...tonePool.connectors, ...photoPool.connectors, ...generalConnectors];
    const customSegment = buildCustomPromptSegment(params.customPrompt, connectors);
    if (customSegment) {
      contentParts.push(customSegment);
    }
  }

  // Promotion integration
  if (params.includePromotion) {
    const promoSection = buildSection(tonePool.promo, context, { min: 2, max: 3, skipChance: 0.3 });
    if (promoSection) {
      contentParts.push(promoSection);
    }
  }

  if (toneStyle.endings.length > 0) {
    contentParts.push(pickRandom(toneStyle.endings));
  }

  if (params.selectedHashtags.length > 0) {
    contentParts.push(params.selectedHashtags.join(' '));
  }

  return cleanSpacing(contentParts.join(' '));
}

function generatePhotoInstructions(params: ContentParameters, photoConfig: PhotoConfig): GeneratedContent['photoInstructions'] {
  return {
    lighting: photoConfig.lighting + (params.photoType === 'shower' ? ', emphasis on steam and water reflections' : 
               params.photoType === 'workout' ? ', bright and energetic to show determination' :
               params.photoType === 'very-spicy' || params.photoType === 'all-xs' ? ', dramatic contrasts and artistic shadows' : ''),
    angles: photoConfig.angles + (params.textTone === 'confident' ? ', powerful perspective shots' :
            params.textTone === 'playful' ? ', fun candid angles' :
            params.textTone === 'mysterious' ? ', shadowy artistic angles' : ''),
    composition: `${photoConfig.mood} composition with ${params.photoType === 'casual' ? 'natural framing' :
                 params.photoType === 'workout' ? 'dynamic action elements' :
                 params.photoType === 'shower' ? 'steam and water elements' :
                 params.photoType === 'showing-skin' ? 'artistic tasteful framing' :
                 params.photoType === 'spicy' ? 'seductive elegant framing' :
                 params.photoType === 'very-spicy' ? 'bold intimate framing' :
                 'unlimited creative framing'}`,
    styling: `${photoConfig.clothing.join(' or ')}, ${photoConfig.mood} aesthetic`,
    technical: `High resolution, sharp focus, professional quality${params.photoType === 'very-spicy' || params.photoType === 'all-xs' ? ', studio-grade equipment recommended' : ''}`,
    sceneSetup: `${photoConfig.settings.join(' or ')}, ${params.photoType} theme environment`
  };
}

function generateTags(params: ContentParameters, photoConfig: PhotoConfig): string[] {
  const baseTags = [params.photoType, params.textTone, params.platform];
  const themeTags = photoConfig.themes.slice(0, 2);
  const customTags = params.style ? [params.style] : [];

  return [...baseTags, ...themeTags, ...customTags];
}