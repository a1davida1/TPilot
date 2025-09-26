
# Caption Platform Checks

## Retry behaviour in the Gemini caption pipeline

The Gemini-powered caption pipeline performs a secondary pass whenever
`platformChecks` flags an output that violates network requirements. During that
retry we must forward the complete option set (`voice`, `style`, `mood`, safety
flags, etc.) back into `generateVariants`. This preserves the tone requested by
the user while giving the model additional guidance about what needs fixing.

## Maintenance guidance

- When adjusting `platformChecks` logic or adding new networks, ensure any
  retries continue to call `generateVariants` with the same tone parameters so
  we do not drop `style`/`mood` information.
- If you introduce additional tone controls (e.g. `energy`, `persona`), thread
  them through the retry call as well.
- Keep tests updated to cover this behaviour. The suite includes a regression
  test that asserts retry prompts retain the tone markers after a failed
  platform check.
