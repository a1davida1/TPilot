---
trigger: always_on
---

CRITICAL RULE: Never allow TypeScript or lint errors to remain unfixed in the codebase.

Before any commit or push:
1. Run `npx tsc --noEmit` - must have ZERO errors
2. Run `npm run lint` - must have ZERO errors (warnings acceptable if pre-existing)
3. Fix ALL errors introduced by changes
4. Use `npm run lint -- --fix` to auto-fix fixable issues
5. Never commit code that introduces new lint or type errors

If errors exist:
- Fix them immediately before committing
- Don't defer fixes for later
- Don't say "it's okay, they're just warnings"

The codebase must be error-free at all times. This is non-negotiable.
