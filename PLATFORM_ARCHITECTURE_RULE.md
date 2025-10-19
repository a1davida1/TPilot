# Platform Architecture Reference Rule

**STATUS**: MANDATORY  
**APPLIES TO**: All AI assistants, developers, and code changes  
**LAST UPDATED**: October 19, 2025

---

## 🚨 CRITICAL RULE

**ALWAYS reference `/docs/PLATFORM_OVERVIEW.md` BEFORE making any technical decisions or code changes.**

This document is the **single source of truth** for:
- Architecture decisions
- Technology stack
- External service integrations
- Feature implementations
- Business logic
- Tier restrictions

---

## When to Check PLATFORM_OVERVIEW.md

### ✅ MUST CHECK BEFORE:
1. **Adding new features** - Verify tier restrictions and architecture patterns
2. **Modifying AI/caption generation** - Confirm OpenRouter-only policy
3. **Changing storage logic** - Verify Imgur/Catbox requirements
4. **Updating authentication** - Check OAuth and tier enforcement
5. **Modifying scheduling** - Verify cron system and tier limits
6. **Adding external services** - Confirm approved service list
7. **Changing payment logic** - Verify Stripe integration and tier pricing
8. **Modifying voice system** - Check SFW/NSFW voice lists

### ❌ NEVER:
- Make assumptions about "how it should work"
- Use outdated documentation from other files
- Implement features without checking tier restrictions
- Add services not listed in approved External Services
- Change AI providers without platform architecture approval

---

## Architecture Absolutes (From PLATFORM_OVERVIEW.md)

### 🤖 AI Caption Generation
- **ONLY OpenRouter** (Grok-4-Fast model)
- **NO Gemini, NO other providers**
- Pipeline: `openrouterPipeline.ts` for ALL modes (Image, Text, Rewrite)
- Text/Rewrite use transparent PNG placeholders
- NSFW voices: seductive_goddess, intimate_girlfriend, bratty_tease, submissive_kitten
- SFW voices: flirty_playful, gamer_nerdy, luxury_minimal, arts_muse, gym_energy, cozy_girl

### 💾 Image Storage
- **NO local file storage** (legal compliance)
- Imgur = primary (ALL posts)
- Catbox.moe = optional secondary

### 🔐 Tier Restrictions
- Free: 3 posts/day, 5 captions/day, NO scheduling
- Starter: Unlimited posts, 50 captions/day, NO scheduling
- Pro: 7-day scheduling, 500 captions/day, basic analytics
- Premium: 30-day scheduling, unlimited everything, full analytics

### ⏰ Scheduling
- Cron processes every minute
- Free/Starter = blocked
- Pro = 7 days max
- Premium = 30 days max

---

## Workflow for Code Changes

```
1. Read /docs/PLATFORM_OVERVIEW.md
2. Identify relevant architecture section
3. Check for conflicts with existing patterns
4. Verify tier restrictions apply correctly
5. Make changes following platform standards
6. Update PLATFORM_OVERVIEW.md if architecture changes
```

---

## If PLATFORM_OVERVIEW.md Conflicts with Code

**The code is probably wrong.** 

PLATFORM_OVERVIEW.md is updated to reflect the INTENDED architecture. If code doesn't match:
1. Verify PLATFORM_OVERVIEW.md is current
2. Fix the code to match the documented architecture
3. If architecture needs to change, update PLATFORM_OVERVIEW.md FIRST, then code

---

## Enforcement

This rule is **non-negotiable**. Violations result in:
- ❌ Incorrect features being built
- ❌ Deprecated services being used (Gemini)
- ❌ Legal compliance violations (local storage)
- ❌ Broken tier restrictions
- ❌ Wasted development time

**Always check PLATFORM_OVERVIEW.md first. No exceptions.**
