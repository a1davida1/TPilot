import fs from 'fs';
import path from 'path';

export interface VoiceProfile {
  persona: string;
  traits: string[];
  hooks: string[];
  cta: string[];
  authenticity: string[];
  subredditNotes?: string[];
}

export interface VoiceProfiles {
  [voiceToken: string]: VoiceProfile;
}

let cachedVoices: VoiceProfiles | null = null;

/**
 * Load voice profiles from prompts/voices.json
 */
function loadVoiceProfiles(): VoiceProfiles {
  if (cachedVoices) {
    return cachedVoices;
  }

  try {
    const voicesPath = path.join(process.cwd(), 'prompts', 'voices.json');
    const voicesData = fs.readFileSync(voicesPath, 'utf-8');
    cachedVoices = JSON.parse(voicesData);
    return cachedVoices!;
  } catch (error) {
    console.error('Failed to load voice profiles:', error);
    // Return fallback voice profiles
    return {
      flirty_playful: {
        persona: "Magnetic lifestyle creator flirting with loyal fans",
        traits: ["Tease with playful banter", "Layer tactile sensory adjectives", "Mix quick punchy sentences"],
        hooks: ["Lead with a daring question", "Call back to inside jokes", "Promise behind-the-scenes details"],
        cta: ["Invite double-tap or comment", "Encourage sharing with besties", "Suggest saving for inspiration"],
        authenticity: ["Mention concrete visual details", "Use contractions and slang", "Add candid emotional beat"]
      }
    };
  }
}

/**
 * Get voice profile for a specific voice token
 */
export function getVoiceProfile(voice: string): VoiceProfile | null {
  const voices = loadVoiceProfiles();
  return voices[voice] || null;
}

/**
 * Format voice traits into prompt-ready bullet list blocks
 */
export function formatVoicePromptBlock(voice: string): string {
  const profile = getVoiceProfile(voice);
  if (!profile) {
    return '';
  }

  const blocks: string[] = [];

  // Voice persona
  blocks.push(`VOICE_PERSONA: ${profile.persona}`);

  // Voice traits
  if (profile.traits && profile.traits.length > 0) {
    blocks.push('VOICE_TRAITS:');
    profile.traits.forEach(trait => blocks.push(`- ${trait}`));
  }

  // Audience hooks
  if (profile.hooks && profile.hooks.length > 0) {
    blocks.push('AUDIENCE_HOOKS:');
    profile.hooks.forEach(hook => blocks.push(`- ${hook}`));
  }

  // CTA patterns
  if (profile.cta && profile.cta.length > 0) {
    blocks.push('CTA_PATTERNS:');
    profile.cta.forEach(cta => blocks.push(`- ${cta}`));
  }

  // Authenticity checklist
  if (profile.authenticity && profile.authenticity.length > 0) {
    blocks.push('AUTHENTICITY_CHECKLIST:');
    profile.authenticity.forEach(auth => blocks.push(`- ${auth}`));
  }

  // Subreddit notes (optional)
  if (profile.subredditNotes && profile.subredditNotes.length > 0) {
    blocks.push('SUBREDDIT_NOTES:');
    profile.subredditNotes.forEach(note => blocks.push(`- ${note}`));
  }

  return blocks.join('\n');
}

/**
 * Clear cached voice profiles (useful for development/testing)
 */
export function clearVoiceCache(): void {
  cachedVoices = null;
}

/**
 * Get all available voice tokens
 */
export function getAvailableVoices(): string[] {
  const voices = loadVoiceProfiles();
  return Object.keys(voices);
}