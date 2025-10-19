# ThottoPilot Platform Overview
*Last Updated: October 19, 2025*

**⚠️ CRITICAL: This is the source of truth for platform architecture. Always reference this document when making technical decisions or code changes.**

## 🎯 Core Purpose
ThottoPilot is a professional content management platform for adult content creators to manage their Reddit presence with legal compliance, content protection, and growth tools.

## 💎 Tier Structure

### **Free Tier** - $0/month
- ✅ Basic Reddit posting (3 posts/day limit)
- ✅ Single subreddit at a time
- ✅ Basic caption generation (5/day limit)
- ❌ No scheduling
- ❌ No analytics
- ❌ No ImageShield
- ❌ No bulk operations

### **Starter Tier** - $9/month
- ✅ Unlimited manual posting
- ✅ 5 subreddits
- ✅ Caption generation (50/day)
- ❌ **NO SCHEDULING ACCESS**
- ❌ No analytics
- ❌ No ImageShield
- ❌ No bulk operations

### **Pro Tier** - $29/month
- ✅ Unlimited posting
- ✅ Unlimited subreddits
- ✅ **7-day scheduling**
- ✅ Basic analytics (engagement, best times)
- ✅ Caption generation (500/day)
- ✅ Bulk operations (up to 10)
- ✅ Advanced features
- ❌ full mageShield (coming in beta)

### **Premium Tier** - $49/month
- ✅ **30-day scheduling**
- ✅ Unlimited everything
- ✅ Max-level analytics (trends, forecasting, intelligence)
- ✅ Unlimited content generation
- ✅ Priority support
- ✅ API access
- ✅ White-label options
- ✅ Full ImageShield suite (coming in beta)

## 📊 User Flows

### **1. Onboarding Flow**
```
Sign Up → Email Verification → Connect Reddit → Select Subreddits → First Post
```

### **2. Daily Creator Workflow**
```
Dashboard → Upload to Imgur → Generate Captions → Schedule/Post → Track Performance
```

### **3. Quick Post Flow** (starter+)
```
Quick Post → Upload → 2 AI Captions → Auto-protect → Immediate Post
```

### **4. Scheduled Campaign** (Pro+)
```
Scheduling Page → Bulk Upload → Select Images → Generate Captions → Set Times → Auto-post
```

## 🚀 Platform Features

### **Authentication & Accounts**
- Email/password with verification
- Reddit OAuth integration
- Tier-based access control
- Admin portal

### **Reddit Integration**
- Multi-account support
- Subreddit discovery
- Rules compliance engine
- Shadowban detection
- Post outcome tracking
- Rate limiting protection

### **Content Pipeline**
- **Image Storage**: Imgur-only (legal compliance, NO local storage)
- **Catbox.moe Integration**: Optional secondary hosting with authenticated uploads
- **AI Caption Generation**: OpenRouter ONLY (Grok-4-Fast primary model)
  - **SFW Voices**: flirty_playful, gamer_nerdy, luxury_minimal, arts_muse, gym_energy, cozy_girl
  - **NSFW Voices**: seductive_goddess, intimate_girlfriend, bratty_tease, submissive_kitten
  - **Generation Modes**:
    - Image → Content (vision analysis + caption generation)
    - Text → Content (theme-based generation with placeholder image)
    - Rewrite (existing caption enhancement)
  - **NSFW Toggle**: Automatically switches voice options and uses explicit first-person prompts
  - **Pipeline**: `openrouterPipeline.ts` for ALL generation modes (no Gemini)
- **Voice System**: JSON-defined personality profiles with persona, traits, hooks, CTAs, and authenticity guidelines
- **Platform Optimization**: Reddit, Instagram, X/Twitter, TikTok-specific formatting

### **Posting Features**
- Immediate posting
- Scheduled posting (Pro: 7 days, Premium: 30 days)
- Bulk operations
- Gallery posts
- Flair management
- Cross-posting with delays

### **Analytics & Intelligence** (Pro+)
- **Basic (Pro)**:
  - Post performance
  - Best posting times
  - Engagement rates
  - Weekly reports

- **Advanced (Premium)**:
  - Trending topics detection
  - Subreddit health metrics
  - Growth forecasting
  - Competition analysis
  - Content recommendations
  - A/B testing results
  - Tax tracking
  - ROI calculations

### **Growth Tools**
- Referral system
- Community recommendations
- Content suggestions
- Engagement optimization

### **ImageShield** (Beta - Currently Disabled)
- Protection levels (light, standard, heavy)
- Watermarking
- DMCA protection
- Blur/noise/crop options
- Re-upload to Imgur

## ⚠️ Legal Compliance

### **Critical Requirements**
1. **Zero Local Storage** - All images on Imgur
2. **2257 Compliance** - Age verification
3. **DMCA Protection** - Content tracking
4. **Subreddit Compliance** - Auto rule checking
5. **Content Filtering** - Prohibited content blocking

### **Moderation Tracking**
- Post removals
- Shadow bans
- Account bans
- Community violations
- Appeal tracking

## 🔧 Technical Architecture

### **Frontend**
- React + TypeScript
- TanStack Query
- Tailwind CSS
- Shadcn/ui components
- Wouter routing

### **Backend**
- Node.js + Express
- PostgreSQL + Drizzle ORM
- Redis caching
- Bull queue for jobs
- JWT authentication

### **External Services**
- **Imgur API** (primary image hosting, legal compliance)
- **Catbox.moe API** (secondary hosting, optional authenticated uploads)
- **Reddit API** (OAuth, posting, monitoring, subreddit discovery)
- **OpenRouter API** (AI caption generation via Grok-4-Fast)
  - Model: `x-ai/grok-4-fast`
  - Temp: 1.4, Freq Penalty: 0.7, Presence Penalty: 1.5
  - Uncensored NSFW support
  - Vision model: `opengvlab/internvl3-78b` (NSFW-specialized)
- **Stripe** (subscription payments, tier management)
- **SendGrid** (transactional emails)

## 📈 Business Model

### **Revenue Streams**
1. Subscription tiers
2. Referral commissions
3. API access (Premium)
4. White-label solutions

### **Growth Strategy**
1. Free tier for acquisition
2. Value-added upsells
3. Referral incentives
4. Community building

## 🚧 Current Status

### **Working** ✅
- Authentication system (email/password, Reddit OAuth)
- Reddit integration (multi-account, posting, monitoring)
- Imgur uploads (primary hosting)
- Catbox.moe uploads (secondary hosting)
- OpenRouter caption generation (3 modes: Image, Text, Rewrite)
- NSFW voice system (4 explicit voices with first-person prompts)
- Scheduled posting (cron-based processing)
- Analytics dashboard (Pro/Premium tiers)
- Dashboard UI (React + TypeScript)

### **In Development** 🚧
- Advanced analytics intelligence
- Bulk scheduling operations
- Mobile responsive optimization
- Payment tier enforcement refinements

### **Planned (Beta)**
- ImageShield re-enabling
- Advanced automation
- Mobile app
- Webhook integrations

## 🎮 Admin Features
- User management
- Content moderation
- Platform analytics
- Compliance monitoring
- System health
- Revenue tracking
- Support tickets

## 🔴 Known Issues
1. ImageShield temporarily disabled (stability)
2. Rate limiting not fully implemented
3. Some tier restrictions need hardening
4. Mobile UI needs polish
5. Webhook integrations not yet built

## 📝 Architecture Notes

### **AI Caption Generation (CRITICAL)**
- **ONLY OpenRouter is used** - No Gemini, no other providers
- All three generation modes (Image, Text, Rewrite) use `openrouterPipeline.ts`
- Text and Rewrite modes use transparent 1x1 PNG placeholders to satisfy vision API requirements
- NSFW checkbox changes voice dropdown and activates explicit prompts from `prompts/nsfw-system.txt` and `prompts/nsfw-variants.txt`
- Voice definitions in `prompts/voices.json` define personality profiles
- First-person NSFW captions use "I/me/my" perspective

### **Image Storage**
- NO local file storage (legal compliance)
- Imgur is primary (all posts)
- Catbox.moe is optional secondary (authenticated uploads)

### **Scheduling**
- Cron manager processes scheduled posts every minute
- Tier enforcement: Free/Starter = NO scheduling, Pro = 7 days, Premium = 30 days
- Bull queues handle async job processing

### **Future Plans**
- ImageShield re-enabling after beta stability
- Advanced automation workflows
- Mobile app (post-launch)
- Webhook integrations for external tools
