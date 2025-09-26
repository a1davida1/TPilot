# Prompt Tuning Upgrades

This release wires structured voice guidance directly into every caption pipeline so PMs and ops can iterate without code changes.

## Voice trait profiles
- **Source file:** `prompts/voices.json`
- **Schema:**
  ```json
  {
    "voice_token": {
      "persona": "string",
      "traits": ["bullet"],
      "hooks": ["bullet"],
      "cta": ["bullet"],
      "authenticity": ["bullet"],
      "subredditNotes": ["optional bullet"]
    }
  }
  ```
- **Usage notes:**
  - Each array renders as bullet points inside the prompt (`VOICE_TRAITS`, `AUDIENCE_HOOKS`, `CTA_PATTERNS`, `AUTHENTICITY_CHECKLIST`, `SUBREDDIT_NOTES`).
  - Keep verbs vivid and actionable; they are injected verbatim, so avoid pronouns that depend on prior context.
  - Include at least three bullets per section so the model has choices for hooks, CTAs, and authenticity proof points.
  - Add new voices by inserting another object with the same keys. Changes are cached on first read—restart the server or clear cache via development tools for immediate effect.

## System + task prompt changes
- `prompts/system.txt` now spells out personality guardrails (creator-to-fan tone, no corporate language, sensory detail requirements, and mandatory use of voice bullet lists).
- `prompts/variants.txt` and `prompts/rewrite.txt` now include dedicated sections for:
  - **Hooks & Audience Focus** – call out the audience in the first sentence.
  - **Sensory Accuracy** – mention concrete IMAGE_FACTS details in captions and alts.
  - **CTA & Platform Norms** – map CTA_PATTERNS to per-platform expectations (IG saves, X replies, TikTok watch/follow, Reddit discussion).
  - **Authenticity Checklist** – enforce contractions, emotional beats, and anti-corporate tone.
  - **Subreddit Norms** – respect SUBREDDIT_NOTES and forbid hashtag/emoji spam on Reddit.
- These prompts expect the bullet lists supplied from `voices.json`; missing data will simply be skipped.

## Runtime integration
- New helper: `server/caption/voiceTraits.ts`
  - `formatVoiceContext(voice)` returns the bullet list block ready to embed in any prompt.
  - `getVoiceDefinition(voice)` exposes the raw profile for advanced customization if needed.
- Pipelines updated to inject the block:
  - `server/caption/geminiPipeline.ts`
  - `server/caption/rewritePipeline.ts`
  - `server/caption/textOnlyPipeline.ts`
- Result: every model call now receives persona, hook, CTA, and authenticity bullets alongside platform + image facts.

## How to iterate
1. Edit `prompts/voices.json` with new bullets (keep arrays short—3 lines ideal).
2. Adjust `prompts/variants.txt` or `prompts/rewrite.txt` if platform rules evolve (hooks, CTA thresholds, authenticity checklist, subreddit etiquette).
3. Run validation: `npm run lint` and `npm test`.
4. Ship—no additional wiring required because the helper auto-loads the JSON.

## Gotchas
- Do **not** remove the authenticity checklist; downstream QA relies on those bullet headings.
- When adding CTA lines, stay platform-specific to keep ranking heuristics effective.
- If a new voice lacks Reddit guidance, leave `subredditNotes` empty and the prompt will skip that section.
- Keep hooks under platform limits (IG first sentence <=125 characters, X <=250 total) to avoid downstream truncation.