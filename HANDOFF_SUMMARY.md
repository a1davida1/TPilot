# ThottoPilot - Complete Handoff Package for AI Assistants

> Created: October 29, 2025

---

## 📦 **What's Included**

This handoff package provides everything an AI assistant (Claude, GPT, etc.) needs to work effectively on ThottoPilot.

### **Core Documentation**

1. **[AI_ASSISTANT_GUIDE.md](./AI_ASSISTANT_GUIDE.md)** ⭐ **START HERE**
   - Complete technical reference
   - Architecture overview
   - Tech stack details
   - Database schema
   - API patterns
   - Frontend patterns
   - Tier system
   - External services
   - Development workflow
   - Testing strategy
   - Deployment guide
   - Known issues & roadmap
   - Best practices

2. **[QUICK_START.md](./QUICK_START.md)**
   - Get running in 10 minutes
   - Step-by-step setup
   - Common issues
   - Quick commands reference

3. **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)**
   - Critical issues (production failures)
   - Common issues (development)
   - Feature-specific issues
   - Debugging techniques
   - Emergency procedures

4. **[README_NEW.md](./README_NEW.md)**
   - Clean, simple overview
   - Quick installation
   - Links to all docs

---

## 🎯 **Quick Navigation for AI Assistants**

### **When starting a new task:**

1. **Read AI_ASSISTANT_GUIDE.md** sections:
   - Core Principles & Rules (CRITICAL)
   - Architecture Overview
   - Relevant feature section

2. **Check existing patterns:**
   - Search codebase for similar implementations
   - Follow established conventions
   - Don't reinvent the wheel

3. **Before coding:**
   - Understand the tier system if feature-gated
   - Check if external API is needed
   - Verify database schema exists

### **When debugging:**

1. **Check TROUBLESHOOTING.md** first
2. **Look for similar issues** in codebase
3. **Check logs:**
   - Server: `tail -f logs/app.log`
   - Browser: DevTools Console
   - Render: Dashboard logs

### **Before committing:**

```bash
npx tsc --noEmit  # MUST pass
npm run lint      # MUST pass
npm run build     # MUST succeed
```

---

## ⚡ **Critical Rules (Always Follow)**

### **1. TypeScript Strictness**

- ❌ Never use `any`
- ❌ Never use non-null assertions (`!`)
- ✅ Always define interfaces
- ✅ Use type guards for safety

### **2. No Local Image Storage**

- ❌ Never `fs.writeFile()` for images
- ✅ Always use Imgur/Catbox APIs
- **Why:** Legal compliance (2257 regulations)

### **3. AI Model Priority**

- ✅ PRIMARY: OpenRouter (Grok-4-Fast)
- ❌ AVOID: Gemini (censors adult content)

### **4. Database Migrations**

```bash
# ✅ CORRECT ORDER:
1. Create migration SQL
2. Run on database FIRST
3. Update schema.ts
4. Deploy code

# ❌ WRONG - Causes outage:
1. Update schema.ts first
2. Deploy = 💥 EVERYTHING BREAKS
```

### **5. Environment Variables**

```bash
# REQUIRED for Render:
RENDER=true
NODE_ENV=production
DATABASE_URL=postgresql://...  # NO ?ssl=true!
```

---

## 📁 **File Organization**

### **Where to find things:**

| What | Where |
|------|-------|
| API routes | `/server/routes/*.ts` |
| Database schema | `/shared/schema.ts` |
| React components | `/client/src/components/` |
| Page components | `/client/src/pages/` |
| Business logic | `/server/services/` |
| Queue jobs | `/server/jobs/` |
| AI prompts | `/prompts/*.txt` |
| Documentation | `/docs/*.md` |

### **Where to add new code:**

| Feature Type | Location | Pattern |
|--------------|----------|---------|
| New API endpoint | `/server/routes/feature.ts` | Copy existing route file |
| New page | `/client/src/pages/feature.tsx` | Use page template from guide |
| New component | `/client/src/components/Feature.tsx` | Follow shadcn/ui patterns |
| Database table | `/shared/schema.ts` | Add to existing schema |
| Queue job | `/server/jobs/feature-worker.ts` | Extend Bull worker pattern |

---

## 🔍 **Common Patterns**

### **API Endpoint Pattern**

```typescript
import { Router } from 'express';
import { authenticateToken, type AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', authenticateToken(true), async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    // Logic here
    return res.json({ data: result });
  } catch (error) {
    logger.error('Failed', { error });
    return res.status(500).json({ error: 'Internal error' });
  }
});

export { router as featureRouter };
```

### **React Page Pattern**

```typescript
import { useQuery } from '@tanstack/react-query';

export default function FeaturePage() {
  const { data, isLoading } = useQuery({
    queryKey: ['/api/feature'],
  });

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <Card>
        {/* Content */}
      </Card>
    </div>
  );
}
```

### **Tier Check Pattern**

```typescript
const hasPro = ['pro', 'premium'].includes(user?.tier);

if (!hasPro) {
  throw new Error('Pro tier required');
}
```

---

## 🚨 **Red Flags to Watch For**

### **Code smells:**

- `any` types anywhere
- `console.log()` (use `logger` instead)
- Hardcoded credentials
- Missing error handling
- No authentication on API routes
- Storing images locally
- Using Gemini for NSFW content

### **Architecture violations:**

- Querying DB from frontend
- Business logic in route handlers
- Missing tier checks on paid features
- Skipping migrations
- Not using Drizzle ORM

---

## 🎓 **Learning the Codebase**

### **Start with these files:**

1. `/server/routes.ts` - See all API routes
2. `/client/src/App.tsx` - See all frontend routes
3. `/shared/schema.ts` - Understand data model
4. `/server/lib/openrouter-pipeline.ts` - AI generation
5. `/client/src/hooks/useAuth.tsx` - Authentication

### **Understand these concepts:**

- **Tier System** - Free/Starter/Pro/Premium with different limits
- **Queue System** - Bull + Redis for background jobs
- **OAuth Flows** - Reddit, Imgur multi-step auth
- **Rate Limiting** - Per-tier request limits
- **Legal Compliance** - Why no local image storage

---

## 📊 **Current Status**

### **✅ Production Ready:**

- Core posting functionality
- Caption generation (OpenRouter)
- Post scheduling
- Basic analytics
- Payment processing (Stripe)
- User management
- Tier system

### **⏳ In Progress:**

- ImageShield (beta)
- Advanced analytics
- Multi-account support

### **❌ Known Issues:**

- 449 console.log statements need cleanup
- Sentry DSN not configured (no error tracking)
- Some tests commented out
- Gallery used mock data (NOW FIXED ✅)
- Imgur token didn't refresh (NOW FIXED ✅)

---

## 🎯 **Success Checklist for AI Assistants**

Before claiming a task is "done":

- [ ] TypeScript compiles: `npx tsc --noEmit` returns 0 errors
- [ ] Linting passes: `npm run lint` has no new errors
- [ ] Build succeeds: `npm run build` completes
- [ ] Tests pass (if applicable): `npm test`
- [ ] Follows existing patterns in codebase
- [ ] Has proper error handling
- [ ] Uses logger instead of console.log
- [ ] Database changes include migrations
- [ ] Tier restrictions checked if needed
- [ ] Documentation updated if architecture changed

---

## 🔗 **External Resources**

### **Key APIs Used:**

- **OpenRouter:** <https://openrouter.ai/docs>
- **Imgur:** <https://apidocs.imgur.com/>
- **Reddit:** <https://www.reddit.com/dev/api>
- **Stripe:** <https://stripe.com/docs/api>
- **Drizzle ORM:** <https://orm.drizzle.team/docs>

### **Technologies:**

- **React:** <https://react.dev/>
- **Express:** <https://expressjs.com/>
- **Wouter:** <https://github.com/molefrog/wouter>
- **React Query:** <https://tanstack.com/query/latest>
- **Bull:** <https://github.com/OptimalBits/bull>
- **shadcn/ui:** <https://ui.shadcn.com/>

---

## 💬 **Communication Best Practices**

### **When working with the user:**

1. **Be direct** - No fluff, get to the point
2. **Show code** - Use code blocks liberally
3. **Verify first** - Read files before suggesting changes
4. **Test thoroughly** - Run checks before claiming done
5. **Document decisions** - Update docs for architecture changes

### **Response structure:**

```markdown
## 🎯 Goal
[What we're doing]

## 🔍 Analysis
[What I found]

## ✅ Implementation
[What I changed]

## 🧪 Verification
[Tests run and results]

## 📝 Summary
[One-sentence status]
```

---

## 🚀 **Deployment Workflow**

### **Local → Staging → Production**

1. **Develop locally:**

   ```bash
   npm run dev
   ```

2. **Test thoroughly:**

   ```bash
   npm run build
   npm test
   npx tsc --noEmit
   ```

3. **Commit with clear message:**

   ```bash
   git add .
   git commit -m "feat: add feature X"
   ```

4. **Push to trigger CI:**

   ```bash
   git push origin main
   ```

5. **Render auto-deploys** (if configured)

### **Manual deployment:**

```bash
./scripts/build-production.sh
npm start
```

---

## 📞 **Getting Unstuck**

### **Priority order:**

1. **Search this handoff package** - Likely already documented
2. **Check TROUBLESHOOTING.md** - Common issues solved
3. **Search codebase** - Similar implementations exist
4. **Read docs** - `/docs/` directory has details
5. **Check file comments** - Inline documentation
6. **Ask user** - When truly stuck

### **Don't guess:**

- Read files instead of assuming
- Check schema before accessing DB
- Verify API exists before calling it
- Test changes before claiming done

---

## 🎁 **What Makes This Handoff Package Special**

✅ **Comprehensive** - 100+ pages of documentation  
✅ **Practical** - Real code patterns, not theory  
✅ **Tested** - Based on actual working codebase  
✅ **Up-to-date** - Created October 29, 2025  
✅ **AI-optimized** - Written specifically for AI assistants  
✅ **Production-ready** - Includes deployment guide  

---

## 📝 **Final Notes**

### **Remember:**

- **This is a beta product** - Some features incomplete
- **Adult content platform** - Legal compliance critical
- **Active development** - Codebase changes frequently
- **Documentation is source of truth** - When in doubt, check docs
- **Test everything** - Users depend on stability

### **You're ready when:**

- [ ] Read AI_ASSISTANT_GUIDE.md completely
- [ ] Understand tier system
- [ ] Know where to find things
- [ ] Can run the project locally
- [ ] Understand the critical rules

---

## Welcome to ThottoPilot development! 🚀

**Your job:** Build features that help adult content creators succeed on Reddit while maintaining legal compliance and code quality.

**Start here:** [AI_ASSISTANT_GUIDE.md](./AI_ASSISTANT_GUIDE.md)

---

*Package created by Cascade on October 29, 2025*  
*For: Claude Code and other AI assistants*  
*Version: 1.0.0*
