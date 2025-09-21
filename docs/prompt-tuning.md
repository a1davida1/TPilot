# Prompt Tuning Playbook

This document summarizes the 2024-10 prompt refresh so PMs, Ops, and copy leads can iterate quickly without spelunking through code.

## What changed

- **System persona hardening** – `prompts/system.txt` now spells out the creator-first tone (sensory details from `IMAGE_FACTS`, anti-corporate guardrails, JSON discipline).
- **Variant + rewrite briefs** – `prompts/variants.txt`, `prompts/rewrite.txt`, and `prompts/variants_textonly.txt` add:
  - Platform-specific hook + CTA guidance (IG/TikTok sensory hooks, Reddit story cold opens, etc.).
  - Subreddit etiquette callouts (first-person POV, no hashtag spam).
  - An authenticity checklist (concrete visual detail, contractions, community nod, emoji restraint).
  - Explicit NSFW flag handling and hashtag guardrails.
- **Voice traits library** – New `prompts/voices.json` maps each voice token to persona notes, bullet traits, hook/CTA guidance, and anti-patterns.
- **Runtime injection** – Gemini + OpenAI pipelines and the OpenAI prompt builder read `voices.json` and append a `VOICE_CONTEXT` block to the prompt payload before generation.

## Editing the voice trait stack

1. Update `prompts/voices.json` (keep it valid JSON). Fields per voice:
   - `persona` *(string, required)* – one-line POV descriptor.
   - `traits` *(array, required)* – bullet statements that should surface verbatim in prompts.
   - Optional: `hooks` (array), `cta` (string), `avoid` (array), `cadence` (string).
2. Changes hot-load automatically (file read on first request in each worker). Redeploy not required unless the process is long-lived with cached copy—restart workers if needed.
3. To add a new voice token, make sure UI dropdown + `STYLE_TOKENS` include it, add a trait block in `voices.json`, and update any QA fixtures if they assert voice names.

## Prompt workflow tips

- **Platform guardrails live in `prompts/variants*.txt`**. Adjust character counts, hashtag ranges, or CTA rules there. Both image and text-only flows reuse the same instructions.
- **Rewrite behavior** inherits the authenticity checklist from variants. If you tweak the checklist, keep both files in sync.
- **System prompt** is shared by Gemini + OpenAI flows. Keep it high level—voice-specific nuance belongs in `voices.json`.

## Testing + deployment

- Run `npm run lint` and `npm test` after editing prompts or traits. The pipelines are covered by schema tests that will catch malformed JSON.
- For quick manual smoke tests, hit the `/api/captions` endpoint with different `voice` tokens to confirm the `VOICE_CONTEXT` block appears in the model prompt logs.

Questions? Drop them in #ai-captions and link to the commit touching `prompts/voices.json` so QA can snapshot diffs.