# 5-Day Beta Sprint - Master Plan
**Dual AI Strategy: Codex + Gemini Pro**  
**Target**: Beta-ready in 40h human + 30h AI parallel work

---

## 🤖 **AI Strategy**

### **Dual AI Setup (RECOMMENDED)**
- **Codex**: Mechanical code, CRUD, patterns, test fixes
- **Gemini Pro**: Complex logic, architecture, code review
- **Workflow**: Human defines → Codex executes → Gemini reviews → Human validates

---

## 📅 **Daily Overview**

### **Day 1: Foundation (4h human + 4h AI)**
- ✅ Sign up: Sentry, Resend, OpenRouter (45min)
- ✅ Add env vars to production (30min)
- ✅ Set up UptimeRobot (15min)
- ✅ Test database backup/restore (2h)
- 🤖 Codex: Clean up 449 console.log statements (4h AI)
- 🤖 Gemini: Security review of logging changes

### **Day 2: Tests (4h human + 4h AI)**
- ✅ Create .env.test (30min)
- ✅ Analyze test failures (1.5h)
- ✅ Review AI fixes (1h)
- ✅ Final validation (1h)
- 🤖 Codex: Fix type errors in tests (2h AI)
- 🤖 Codex: Add API mocks (2h AI)
- 🤖 Gemini: Identify test coverage gaps

### **Day 3: Scheduled Posts (4h human + 4h AI)**
- ✅ Design schema (1h)
- ✅ Generate migration (30min)
- ✅ Review Codex code (1.5h)
- ✅ Test end-to-end (1h)
- 🤖 Codex: Build CRUD API (2h AI)
- 🤖 Codex: Create worker (1h AI)
- 🤖 Codex: Build UI components (1h AI)
- 🤖 Gemini: Review for edge cases

### **Day 4: Reddit Intelligence (4h human + 4h AI)**
- ✅ Design algorithms (2h)
- ✅ Review implementations (1.5h)
- ✅ Test with real data (30min)
- 🤖 Codex: Build database queries (1.5h AI)
- 🤖 Codex: Create API endpoints (1h AI)
- 🤖 Codex: Build dashboard UI (1.5h AI)
- 🤖 Gemini: Review algorithm correctness

### **Day 5: Admin Portal + Launch (4h human + 4h AI)**
- ✅ Define admin features (30min)
- ✅ End-to-end testing (2h)
- ✅ Deploy to production (30min)
- ✅ Final validation (1h)
- 🤖 Codex: Build admin UI (2h AI)
- 🤖 Codex: Create monitoring views (1h AI)
- 🤖 Codex: Generate docs (1h AI)

---

## 📋 **Detailed Checklists**

See individual day files:
- `5_DAY_SPRINT_DAY1.md` - Foundation & monitoring
- `5_DAY_SPRINT_DAY2.md` - Test infrastructure  
- `5_DAY_SPRINT_DAY3.md` - Scheduled posts system
- `5_DAY_SPRINT_DAY4.md` - Reddit intelligence
- `5_DAY_SPRINT_DAY5.md` - Admin portal & launch

---

## 🎯 **Success Criteria**

**By End of Day 5**:
- [ ] All env vars configured
- [ ] Sentry + monitoring active
- [ ] Backups verified
- [ ] 95%+ tests passing
- [ ] Scheduled posts working
- [ ] Reddit intelligence functional
- [ ] Admin portal complete
- [ ] Deployed to production
- [ ] End-to-end smoke test passes

---

## 🚀 **Start Here**

1. Read this master file
2. Open `5_DAY_SPRINT_DAY1.md`
3. Follow checklists sequentially
4. Use provided Codex/Gemini prompts
5. Track progress with checkboxes

**Let's launch!** 🎯
