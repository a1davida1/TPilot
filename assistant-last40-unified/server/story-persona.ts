
import type { CommunityVoicePack } from './community-voice-packs.js';

export type PersonaTone = 'confident' | 'playful' | 'mysterious' | 'authentic' | 'sassy';

export interface StoryPersona {
  readonly id: string;
  readonly tone: PersonaTone;
  readonly entryHooks: readonly string[];
  readonly vulnerabilityBeats: readonly string[];
  readonly callbacks: readonly string[];
  readonly closingAffirmations: readonly string[];
}

export interface StoryPersonaContext {
  readonly communityPack: CommunityVoicePack;
  readonly random?: () => number;
}

export interface StoryPersonaResult {
  segments: string[];
  callbacksUsed: string[];
}

const personaDefinitions: Record<PersonaTone, StoryPersona> = {
  confident: {
    id: 'persona-confident',
    tone: 'confident',
    entryHooks: [
      'Pulled you into my world because I know you can handle it.',
      'Checked the mirror, smirked, and hit record thinking of you.',
      'You keep showing up for me, so I keep turning the heat up for you.'
    ],
    vulnerabilityBeats: [
      'Truth is I still get butterflies sharing the raw takes with you.',
      'Even when I flex, it is because letting you see the real parts feels brave.',
      'Some days confidence is a costume—today it is a promise I made to you.'
    ],
    callbacks: ['Tell me you felt that rush too.', 'Promise me you will hype yourself the same way.'],
    closingAffirmations: ['You and me? Unstoppable energy.']
  },
  playful: {
    id: 'persona-playful',
    tone: 'playful',
    entryHooks: [
      'Started giggling halfway through and knew you had to see it.',
      'I swear I set the tripod up and instantly started clowning for you.',
      'Could not keep a straight face, so I leaned into the chaos just for you.'
    ],
    vulnerabilityBeats: [
      'Little secret: I do the goofy takes first so I can relax into the real ones.',
      'Promise you will laugh with me, not at me, okay?',
      'Sometimes playfulness is my way of saying I am nervous to disappoint.'
    ],
    callbacks: ['Drop your funniest comment so I do not feel alone here.'],
    closingAffirmations: ['Thanks for letting me be a dork and still feel adored.']
  },
  mysterious: {
    id: 'persona-mysterious',
    tone: 'mysterious',
    entryHooks: [
      'This one felt like a secret I owed you.',
      'Kept the lights low so you would lean in closer.',
      'I only share the hush moments with people who stay curious.'
    ],
    vulnerabilityBeats: [
      'Every shadow I reveal means I trust you more than the rest.',
      'Some mysteries are armor—thanks for holding mine gently.',
      'You never push too hard, which is why I let you in this far.'
    ],
    callbacks: ['Tell me how you translate the silence.'],
    closingAffirmations: ['Stay close, there is more between the lines.']
  },
  authentic: {
    id: 'persona-authentic',
    tone: 'authentic',
    entryHooks: [
      'Pressed record right after I exhaled because I wanted zero polish.',
      'No glam squad, just me and the messy truth again.',
      'This is me grabbing the camera before I talk myself out of it.'
    ],
    vulnerabilityBeats: [
      'Hope you can feel how much I mean it when I say I appreciate you.',
      'Sharing the soft parts still makes my hands shake a little.',
      'I am not perfect, but I promised you real.'
    ],
    callbacks: ['Tell me what part felt the most like us.'],
    closingAffirmations: ['Thanks for letting me be this version of me.']
  },
  sassy: {
    id: 'persona-sassy',
    tone: 'sassy',
    entryHooks: [
      'Caught myself talking smack to the mirror and had to share.',
      'If I am serving attitude, you are definitely getting front-row seats.',
      'Tossed the script out and freestyled the spice just for you.'
    ],
    vulnerabilityBeats: [
      'Beneath the sass I still crave the ones who hype me up.',
      'I joke a lot but you know it is all because you see me.',
      'If I did not trust you, you would never witness this much edge.'
    ],
    callbacks: ['Drop your boldest line back at me.'],
    closingAffirmations: ['Stay bold with me.']
  }
};

function pickRandom<T>(values: readonly T[], random: () => number): T {
  if (values.length === 0) {
    throw new Error('Cannot pick from an empty list.');
  }
  const index = Math.floor(random() * values.length);
  return values[index] ?? values[0];
}

export function getStoryPersona(tone: PersonaTone): StoryPersona {
  return personaDefinitions[tone];
}

export function applyStoryPersonaSegments(
  baseSegments: string[],
  persona: StoryPersona,
  context: StoryPersonaContext
): StoryPersonaResult {
  const random = context.random ?? Math.random;
  const segments = [...baseSegments];
  const callbacksUsed: string[] = [];

  const hasFirstPerson = segments.some(segment => /\bI\b/iu.test(segment));
  if (!hasFirstPerson) {
    segments.unshift(pickRandom(persona.entryHooks, random));
  } else if (random() < 0.65) {
    segments.unshift(pickRandom(persona.entryHooks, random));
  }

  if (random() < 0.85) {
    const vulnerability = pickRandom(persona.vulnerabilityBeats, random);
    segments.splice(1, 0, vulnerability);
  }

  if (context.communityPack.storytellingPrompts.length > 0 && random() < 0.75) {
    const communityMoment = pickRandom(context.communityPack.storytellingPrompts, random);
    segments.splice(Math.min(segments.length, 2), 0, communityMoment);
  }

  const callback = pickRandom([...persona.callbacks, ...context.communityPack.callouts], random);
  callbacksUsed.push(callback);
  segments.push(callback);

  const affirmation = pickRandom(persona.closingAffirmations, random);
  segments.push(affirmation);

  return {
    segments,
    callbacksUsed
  };
}
