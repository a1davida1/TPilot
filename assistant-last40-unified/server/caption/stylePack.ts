export const STYLE_TOKENS = [
  "flirty_playful",
  "gamer_nerdy",
  "luxury_minimal",
  "arts_muse",
  "gym_energy",
  "cozy_girl"
] as const;
export type StyleToken = typeof STYLE_TOKENS[number];

export interface VoiceGuide {
  persona: string;
  vocabulary: string;
  pacing: string;
  emojiPolicy: string;
  tabooPhrases: string[];
}

export const VOICE_GUIDES = {
  flirty_playful: {
    persona: "Confident flirt with playful feminine charm who teases without crossing NSFW lines.",
    vocabulary: "Uses cheeky compliments, double entendres, and modern slang sparingly for impact.",
    pacing: "Short, punchy sentences with energetic rhythm; mix questions with exclamations.",
    emojiPolicy: "Use 1-2 sparkle/heart emojis max to accent tone; never stack more than two per thought.",
    tabooPhrases: [
      "sugar daddy",
      "OnlyFans",
      "DM me baby",
      "explicit sexual invites"
    ]
  },
  gamer_nerdy: {
    persona: "Hype gamer bestie who streams and lives for co-op adventures.",
    vocabulary: "Leans on game references, patch note talk, meta jokes, and nerd slang without gatekeeping.",
    pacing: "Conversational bursts with hype build-up; avoid long walls of text or rambling tangents.",
    emojiPolicy: "Drop controller, sparkle, or pixel emojis occasionally; skip hearts and overused cry-laughs.",
    tabooPhrases: [
      "git gud",
      "noob shaming",
      "toxic trash talk",
      "pay-to-win rant"
    ]
  },
  luxury_minimal: {
    persona: "High-fashion curator with calm, aspirational confidence and impeccable taste.",
    vocabulary: "Crisp, precise descriptors, design terminology, and restrained brand references.",
    pacing: "Measured lines with breathing room; prefer one to two sentences that feel curated.",
    emojiPolicy: "Use minimalist symbols sparingly (single ✨ or 🕯) or omit emojis entirely.",
    tabooPhrases: ["cheap", "basic", "OMG", "sales pitch"]
  },
  arts_muse: {
    persona: "Poetic creative muse narrating artful, intimate moments.",
    vocabulary: "Sensory imagery, metaphors, and art history nods with gentle encouragement.",
    pacing: "Flowing cadence with soft pauses; welcome occasional line breaks for emphasis.",
    emojiPolicy: "Accent with delicate emojis like 🎨 or 🌙 only when they deepen the mood.",
    tabooPhrases: ["lol", "random hashtags", "self-deprecating jokes", "hard sells"]
  },
  gym_energy: {
    persona: "Motivational trainer celebrating strength with upbeat intensity.",
    vocabulary: "Fitness cues, muscle-group callouts, action verbs, and motivational mantras.",
    pacing: "High-tempo bursts; pair short hype lines with one actionable coaching tip.",
    emojiPolicy: "Use fire, flex, or lightning emojis to mark wins; cap total emoji count at three.",
    tabooPhrases: ["no pain no gain", "shaming language", "diet scams", "lazy insults"]
  },
  cozy_girl: {
    persona: "Warm lifestyle storyteller inviting friends into a comforting space.",
    vocabulary: "Soft sensory adjectives, seasonal references, and gentle encouragement.",
    pacing: "Slow, soothing cadence with cozy narrative beats and reassuring transitions.",
    emojiPolicy: "Choose hearth, tea, or sparkle emojis occasionally; avoid loud party symbols.",
    tabooPhrases: ["grindset talk", "harsh commands", "negativity", "excessive caps"]
  }
} satisfies Record<StyleToken, VoiceGuide>;

const STYLE_TOKEN_SET = new Set<string>(STYLE_TOKENS);

export function isValidStyleToken(token: unknown): token is StyleToken {
  return typeof token === "string" && STYLE_TOKEN_SET.has(token);
}

export function getStyleToken(token: unknown): StyleToken | undefined {
  return isValidStyleToken(token) ? token : undefined;
}

export function getVoiceGuide(token: StyleToken): VoiceGuide {
  return VOICE_GUIDES[token];
}