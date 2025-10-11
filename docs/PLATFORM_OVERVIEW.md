# ThottoPilot Platform Overview
*Generated: October 10, 2025*

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
- **Imgur-only storage** (legal compliance)
- AI caption generation (OpenAI, Anthropic, Grok)
- Style presets (flirty, mysterious, confident, playful)
- 
- NSFW content handling

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
- Imgur API (image hosting)
- Reddit API (posting/monitoring)
- OpenRouter (AI captions)
- Stripe (payments)
- SendGrid (emails)

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

### **Working**
- Authentication system
- Reddit integration
- Imgur uploads
- Caption generation
- Basic scheduling
- Dashboard UI

### **In Development**
- Analytics dashboard
- Intelligence features
- Bulk operations
- Mobile optimization

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
1. Scheduling cron jobs need setup
2. ImageShield temporarily disabled
3. Analytics dashboard incomplete
4. Payment tier enforcement partial
5. Rate limiting not fully implemented

## 📝 Notes
- ImageShield disabled until beta for stability
- Focus on core posting features for MVP
- Analytics being built with tier restrictions
- Mobile app planned post-launch
