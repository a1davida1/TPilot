# ThottoPilot

A modern, full-stack Reddit content management platform for adult content creators.

---

## 🚀 Quick Start

**New here? Choose your path:**

- **Developers:** Read [QUICK_START.md](./QUICK_START.md) to get running in 10 minutes
- **AI Assistants (Claude, GPT):** Use [AI_ASSISTANT_GUIDE.md](./AI_ASSISTANT_GUIDE.md) as your complete reference
- **Troubleshooting:** Check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for solutions

---

## 📚 Complete Documentation

| Document | Purpose | Audience |
|----------|---------|----------|
| [QUICK_START.md](./QUICK_START.md) | Get up and running | Developers |
| [AI_ASSISTANT_GUIDE.md](./AI_ASSISTANT_GUIDE.md) | Complete technical reference | AI Assistants |
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | Common issues & solutions | Everyone |
| [docs/PLATFORM_OVERVIEW.md](./docs/PLATFORM_OVERVIEW.md) | Architecture & features | Technical leads |
| [docs/API_ENDPOINTS_STATUS.md](./docs/API_ENDPOINTS_STATUS.md) | API reference | Backend devs |
| [docs/BETA_READY_STATUS.md](./docs/BETA_READY_STATUS.md) | Current status | Product team |

---

## ✨ Features

- 🤖 **AI Caption Generation** - Grok-4-Fast for natural NSFW content
- 📅 **Post Scheduling** - Automate Reddit strategy (7-30 day scheduling)
- 📊 **Analytics Dashboard** - Track performance, find optimal posting times
- 🎯 **Smart Recommendations** - AI-powered subreddit suggestions
- 🔒 **Content Protection** - ImageShield watermarking (beta)
- 💎 **Tier System** - Free, Starter, Pro, Premium with clear upgrade paths

---

## 🛠️ Tech Stack

**Frontend:** React 18 + TypeScript + Wouter + React Query + Tailwind CSS  
**Backend:** Express.js + TypeScript + Drizzle ORM + PostgreSQL  
**Queue:** Bull (Valkey - Redis-compatible) for background jobs  
**AI:** OpenRouter API (Grok-4-Fast primary)  
**Deployment:** Render.com

---

## 💻 Installation

```bash
# Clone and install
git clone <repo-url> TPilot
cd TPilot
npm install

# Configure environment
cp .env.example .env
# Edit .env with your values

# Setup database
npx drizzle-kit push

# Start development
npm run dev
```

Visit: <http://localhost:5173>

**Need more details?** See [QUICK_START.md](./QUICK_START.md)

---

## 📖 Usage

### Development

```bash
npm run dev              # Start dev server
npm run build            # Build for production
npm test                 # Run tests
npx tsc --noEmit        # Check TypeScript
npm run lint            # Check linting
```

### Database

```bash
npx drizzle-kit push     # Update schema
npx drizzle-kit studio   # Open DB GUI
```

### Production

```bash
npm run build            # Build
npm start               # Start server
```

**Need help?** See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

---

## 🎯 Project Structure

```text
TPilot/
├── client/              # React frontend
│   ├── src/
│   │   ├── components/  # UI components
│   │   ├── pages/       # Route pages
│   │   ├── hooks/       # Custom hooks
│   │   └── lib/         # Utilities
├── server/              # Express backend
│   ├── routes/          # API endpoints
│   ├── services/        # Business logic
│   ├── jobs/            # Queue workers
│   └── lib/             # Server utils
├── shared/              # Shared code
│   ├── schema.ts        # Database schema
│   └── types/           # TypeScript types
└── docs/                # Documentation
```

---

## 🔑 Key Environment Variables

**Required:**

```bash
DATABASE_URL=postgresql://...
JWT_SECRET=random-32-char-string
SESSION_SECRET=another-random-string
OPENROUTER_API_KEY=sk-or-v1-...
```

**Optional but recommended:**

```bash
IMGUR_CLIENT_ID=...
IMGUR_CLIENT_SECRET=...
REDDIT_CLIENT_ID=...
REDDIT_CLIENT_SECRET=...
STRIPE_SECRET_KEY=...
```

**Full list:** See `.env.example` or [AI_ASSISTANT_GUIDE.md](./AI_ASSISTANT_GUIDE.md#environment-variables)

---

## 🤝 Contributing

1. Read [AI_ASSISTANT_GUIDE.md](./AI_ASSISTANT_GUIDE.md) for architecture and patterns
2. Create a feature branch
3. Make changes following existing patterns
4. Run checks: `npx tsc --noEmit && npm run lint && npm test`
5. Submit PR with clear description

---

## 🆘 Getting Help

**Common issues?** Check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)  
**Architecture questions?** Read [docs/PLATFORM_OVERVIEW.md](./docs/PLATFORM_OVERVIEW.md)  
**API reference?** See [docs/API_ENDPOINTS_STATUS.md](./docs/API_ENDPOINTS_STATUS.md)  
**For AI assistants?** Use [AI_ASSISTANT_GUIDE.md](./AI_ASSISTANT_GUIDE.md)

---

## 📄 License

Proprietary - All rights reserved

---

**Last Updated:** October 29, 2025  
**Version:** 1.0.0 (Beta)
