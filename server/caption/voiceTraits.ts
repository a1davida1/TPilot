import { readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

const VoiceDefinitionSchema = z.object({
  persona: z.string(),
  traits: z.array(z.string()).min(1),
  hooks: z.array(z.string()).optional(),
  cta: z.string().optional(),
  avoid: z.array(z.string()).optional(),
  cadence: z.string().optional(),
});

const VoiceMapSchema = z.record(VoiceDefinitionSchema);

let cache: z.infer<typeof VoiceMapSchema> | null = null;

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
    console.error("Failed to load voice traits:", error);
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

  const lines: string[] = ["VOICE_CONTEXT:"];
  lines.push(`- Persona: ${definition.persona}`);

  for (const trait of definition.traits) {
    lines.push(`- ${trait}`);
  }

  if (definition.hooks?.length) {
    for (const hook of definition.hooks) {
      lines.push(`- Hook pattern: ${hook}`);
    }
  }

  if (definition.cta) {
    lines.push(`- CTA direction: ${definition.cta}`);
  }

  if (definition.cadence) {
    lines.push(`- Cadence: ${definition.cadence}`);
  }

  if (definition.avoid?.length) {
    for (const rule of definition.avoid) {
      lines.push(`- Avoid: ${rule}`);
    }
  }

  return lines.join("\n");
}