
export interface CommunityVoicePack {
  readonly slug: string;
  readonly platform: string;
  readonly lexicon: readonly string[];
  readonly humorReferences: readonly string[];
  readonly voiceMarkers: readonly string[];
  readonly storytellingPrompts: readonly string[];
  readonly callouts: readonly string[];
}

const defaultPack: CommunityVoicePack = {
  slug: 'default',
  platform: 'general',
  lexicon: ['vibes', 'crew', 'fam', 'low-key', 'irl'],
  humorReferences: ['did someone say snacks?', 'gonna need receipts for that'],
  voiceMarkers: ['honestly', 'tbh', 'ngl'],
  storytellingPrompts: [
    'I keep replaying how it felt in the moment',
    'Took a beat to notice the small details and how they reminded me of you',
    'Had to tell you before the feeling fades'
  ],
  callouts: ['btw, you know I read every comment', 'appreciate the love, fr']
};

const redditDefaultPack: CommunityVoicePack = {
  slug: 'reddit:default',
  platform: 'reddit',
  lexicon: ['thread', 'upvote', 'mods', 'lurkers', 'wholesome', 'chaotic good'],
  humorReferences: [
    'mods are asleep, post cozy vibes',
    'sending virtual snacks for the real ones',
    'petition to make this a sticky?'
  ],
  voiceMarkers: ['ngl', 'low-key', 'real talk', 'honestly'],
  storytellingPrompts: [
    'Sat down to share the full story before it got lost in drafts',
    'So I was vibing and thought: redditors deserve the behind-the-scenes',
    'One minute it was casual, next I had a whole story I had to tell you'
  ],
  callouts: ['drop your take in the comments', 'mods please don\'t bonk me', 'shout-out to the lurkers']
};

const redditCoffeePack: CommunityVoicePack = {
  slug: 'reddit:r/coffee',
  platform: 'reddit',
  lexicon: ['dialed in', 'espresso', 'pour-over', 'dial', 'crema', 'bloom'],
  humorReferences: [
    'yes I logged this in my brew journal',
    'send help, my grinder settings are chaos',
    'this roast? big cozy energy'
  ],
  voiceMarkers: ['ngl', 'honestly', 'not gonna lie'],
  storytellingPrompts: [
    'I swear the kettle whistle sounded like applause',
    'Tracked the bloom just to flex for you',
    'Pulled this shot imagining we were sharing it together'
  ],
  callouts: ['tell me your favorite roast', 'drop grinder tips below']
};

const redditFitnessPack: CommunityVoicePack = {
  slug: 'reddit:r/fitness',
  platform: 'reddit',
  lexicon: ['PR', 'rep scheme', 'DOMS', 'split', 'hypertrophy', 'bulk'],
  humorReferences: [
    'coach probably wants me to deload but lol no',
    'DOMS hit harder than mod deletions',
    'ate like a goblin for these gains'
  ],
  voiceMarkers: ['fr', 'honestly', 'low-key'],
  storytellingPrompts: [
    'Logged the session just so I could brag to you',
    'Hit a mini PR because I pictured you cheering from the sidelines',
    'Turned the gym mirror into a confession booth for us'
  ],
  callouts: ['drop your current split', 'flex check thread when?']
};

const packs: Record<string, CommunityVoicePack> = {
  [defaultPack.slug]: defaultPack,
  [redditDefaultPack.slug]: redditDefaultPack,
  [redditCoffeePack.slug]: redditCoffeePack,
  [redditFitnessPack.slug]: redditFitnessPack
};

function normalizeCommunityKey(community?: string, platform?: string): string {
  if (!community) {
    return platform ? `${platform.toLowerCase()}:default` : defaultPack.slug;
  }
  const trimmed = community.trim().toLowerCase();
  if (trimmed.startsWith('reddit:')) {
    return trimmed;
  }
  if (trimmed.startsWith('r/')) {
    return `reddit:${trimmed}`;
  }
  if (!platform) {
    return trimmed;
  }
  return `${platform.toLowerCase()}:${trimmed}`;
}

export function getCommunityVoicePack(community?: string, platform?: string): CommunityVoicePack {
  const key = normalizeCommunityKey(community, platform);
  return packs[key] ?? packs[`${platform?.toLowerCase() ?? 'general'}:default`] ?? defaultPack;
}

export function sampleCommunityReference(
  pack: CommunityVoicePack,
  random: () => number = Math.random
): string | undefined {
  if (pack.humorReferences.length === 0) {
    return undefined;
  }
  const index = Math.floor(random() * pack.humorReferences.length);
  return pack.humorReferences[index];
}
