# Platform Architecture Rule (MANDATORY)

**🚨 ALWAYS CHECK `/docs/PLATFORM_OVERVIEW.md` BEFORE ANY CODE CHANGES 🚨**

This is the single source of truth for:
- Technology stack (OpenRouter ONLY for AI, NO Gemini)
- Storage architecture (Imgur/Catbox, NO local files)
- Tier restrictions and scheduling limits
- External services and integrations
- Voice system (SFW vs NSFW voices)

**See `/PLATFORM_ARCHITECTURE_RULE.md` for full details.**

If unsure about ANY architectural decision, read PLATFORM_OVERVIEW.md first.

---

# TypeScript Coding Standards
- **Disallow `any`**: prefer explicit interfaces or `unknown`.
- **No Non-null Assertions**: use optional chaining or `??` with defaults.
- **Strict Generics**: default to `unknown` for generic type parameters.
- **Testing**: mock types must match real interfaces.
- **Commit Hooks**: `npm run lint` and `npm test` must pass before commit.