import { readFileSync } from "node:fs";
import * as path from "node:path";
import { z } from "zod";
import { logger } from '../bootstrap/logger.js';

const VoiceDefinitionSchema = z.object({
  persona: z.string(),
  traits: z.array(z.string()).min(1),
  hooks: z.array(z.string()).min(1),
  cta: z.array(z.string()).min(1),
  authenticity: z.array(z.string()).min(1),
  subredditNotes: z.array(z.string()).optional(),
});

const VoiceMapSchema = z.record(VoiceDefinitionSchema);

let cache: z.infer<typeof VoiceMapSchema> | null = null;

/**
 * Clear cached voice profiles to allow hot-reload of voices.json
 */
export function clearVoiceCache(): void {
  cache = null;
}

function loadVoiceMap(): z.infer<typeof VoiceMapSchema> | null {
  if (cache) return cache;
  try {
    const raw = readFileSync(
      path.join(process.cwd(), "prompts", "voices.json"),
      "utf8",
    );
    cache = VoiceMapSchema.parse(JSON.parse(raw));
    return cache;
  } catch (error) {
    logger.error("Failed to load voice traits:", error);
    cache = null;
    return null;
  }
}

export type VoiceDefinition = z.infer<typeof VoiceDefinitionSchema>;

export function getVoiceDefinition(voice: string): VoiceDefinition | undefined {
  const map = loadVoiceMap();
  return map?.[voice];
}

export function formatVoiceContext(voice: string): string {
  const definition = getVoiceDefinition(voice);
  if (!definition) return "";

  const blocks: string[] = [];

  // Voice persona
  blocks.push(`VOICE_PERSONA: ${definition.persona}`);

  // Voice traits
  if (definition.traits?.length) {
    blocks.push('VOICE_TRAITS:');
    definition.traits.forEach(trait => blocks.push(`- ${trait}`));
  }

  // Audience hooks
  if (definition.hooks?.length) {
    blocks.push('AUDIENCE_HOOKS:');
    definition.hooks.forEach(hook => blocks.push(`- ${hook}`));
  }

  // CTA patterns
  if (definition.cta?.length) {
    blocks.push('CTA_PATTERNS:');
    definition.cta.forEach(cta => blocks.push(`- ${cta}`));
  }

  // Authenticity checklist
  if (definition.authenticity?.length) {
    blocks.push('AUTHENTICITY_CHECKLIST:');
    definition.authenticity.forEach(auth => blocks.push(`- ${auth}`));
  }

  // Subreddit notes (optional)
  if (definition.subredditNotes?.length) {
    blocks.push('SUBREDDIT_NOTES:');
    definition.subredditNotes.forEach(note => blocks.push(`- ${note}`));
  }

  return blocks.join('\n');
}