# Kiro Agent Hooks

This directory contains automated agent hooks that run on specific events to ensure code quality, integration, and consistency.

## Available Hooks

### 🆕 New File Integration Validator
**File:** `new-file-integration-validator.kiro.hook`  
**Trigger:** When any new `.ts` or `.tsx` file is created  
**Purpose:** Validates new files for completeness and proper integration

**Checks:**
- TypeScript compliance (no `any`, proper types)
- Component registration (routing, imports)
- API endpoint registration
- Service layer integration
- Documentation requirements
- Project pattern compliance

**Use Case:** Ensures new components/services are immediately integrated into the app, not orphaned files.

---

### 🔗 Component Integration Checker
**File:** `component-integration-checker.kiro.hook`  
**Trigger:** When React components (`.tsx`) are saved  
**Purpose:** Verifies components are properly integrated and follow patterns

**Checks:**
- Component usage (is it imported anywhere?)
- API integration (useQuery, error handling)
- Authentication (useAuth, tier checks)
- UI/UX standards (shadcn/ui, responsive)
- TypeScript quality

**Use Case:** Catches components that exist but aren't used, or missing error handling.

---

### 🌐 API Integration Validator
**File:** `api-integration-validator.kiro.hook`  
**Trigger:** When API routes, services, or hooks are saved  
**Purpose:** Validates full-stack API integration

**Checks:**
- Backend route registration in `server/routes.ts`
- Service layer usage
- Frontend API calls (useQuery/useMutation)
- Type safety (shared types)
- Authentication & authorization
- Error handling (both frontend and backend)

**Use Case:** Ensures API endpoints are registered and properly called from frontend.

---

### 🔍 TypeScript Error Checker
**File:** `typescript-error-checker.kiro.hook`  
**Trigger:** When `.ts` or `.tsx` files are edited  
**Purpose:** Catches TypeScript errors immediately

**Checks:**
- Strict mode violations (no `any`, no `!`)
- Type errors
- Import/export issues
- Missing return types

---

### 🔐 Tier Access Validator
**File:** `tier-access-validator.kiro.hook`  
**Trigger:** When files with tier checks are modified  
**Purpose:** Ensures tier-based access control is consistent

---

### 📊 Database Schema Validator
**File:** `database-schema-validator.kiro.hook`  
**Trigger:** When `shared/schema.ts` is modified  
**Purpose:** Validates database schema changes

---

### 🧪 Test File Generator
**File:** `test-file-generator.kiro.hook`  
**Trigger:** When new components/services are created  
**Purpose:** Suggests test file creation

---

### 📝 Source to Docs Sync
**File:** `source-to-docs-sync.kiro.hook`  
**Trigger:** When major files are changed  
**Purpose:** Updates documentation to match code

---

### ⚡ Performance Profiler
**File:** `performance-profiler.kiro.hook`  
**Trigger:** When performance-critical files are modified  
**Purpose:** Checks for performance issues

---

### 🎨 Code Quality Analyzer
**File:** `code-quality-analyzer.kiro.hook`  
**Trigger:** On file save  
**Purpose:** General code quality checks

---

## Hook Workflow

### New Component Creation Flow

```
1. Developer creates: client/src/components/NewWidget.tsx
   ↓
2. new-file-integration-validator.kiro.hook triggers
   ↓
3. Agent checks:
   - TypeScript compliance ✓
   - Component structure ✓
   - Is it imported anywhere? ✗
   ↓
4. Agent reports:
   "Component not integrated. Add to dashboard.tsx"
   Provides exact code to add
   ↓
5. Developer adds import and usage
   ↓
6. component-integration-checker.kiro.hook triggers
   ↓
7. Agent verifies:
   - Component now used ✓
   - Has loading states ✓
   - Has error handling ✓
   ↓
8. ✅ Component fully integrated!
```

### New API Endpoint Flow

```
1. Developer creates: server/routes/new-feature.ts
   ↓
2. new-file-integration-validator.kiro.hook triggers
   ↓
3. Agent checks:
   - Router exported ✓
   - Registered in routes.ts? ✗
   ↓
4. Agent reports:
   "Route not registered. Add to server/routes.ts"
   Provides exact code
   ↓
5. Developer registers route
   ↓
6. api-integration-validator.kiro.hook triggers
   ↓
7. Agent checks:
   - Backend registered ✓
   - Frontend calls it? ✗
   ↓
8. Agent suggests:
   "Create useNewFeature hook"
   Provides hook code
   ↓
9. Developer creates hook and uses in component
   ↓
10. ✅ Full-stack integration complete!
```

## Benefits

### 1. Prevents Orphaned Code
- No unused components
- No unregistered routes
- No forgotten integrations

### 2. Enforces Patterns
- Consistent API patterns
- Consistent component structure
- Consistent error handling

### 3. Catches Issues Early
- TypeScript errors immediately
- Missing integrations before commit
- Incomplete implementations

### 4. Reduces Review Time
- Code is pre-validated
- Patterns are enforced
- Documentation is updated

### 5. Onboards Developers Faster
- Hooks teach patterns
- Provide exact code examples
- Show integration points

## Configuration

### Enable/Disable Hooks

Edit the `.kiro.hook` file and set `"enabled": true/false`

### Customize Patterns

Edit the `"patterns"` array in `"when"` section:

```json
{
  "when": {
    "type": "fileCreated",
    "patterns": [
      "client/src/**/*.tsx",
      "server/**/*.ts"
    ]
  }
}
```

### Customize Prompts

Edit the `"prompt"` field in `"then"` section to change validation logic.

## Best Practices

### For Developers

1. **Read hook feedback carefully** - It provides exact code to add
2. **Don't disable hooks** - They catch real issues
3. **Follow suggested patterns** - They're project standards
4. **Update hooks** - If patterns change, update hook prompts

### For Hook Authors

1. **Be specific** - Provide exact code, not vague suggestions
2. **Be actionable** - Tell developers exactly what to do
3. **Be concise** - Don't overwhelm with information
4. **Provide examples** - Show the correct pattern
5. **Explain why** - Help developers understand the reason

## Troubleshooting

### Hook Not Triggering

1. Check `"enabled": true` in hook file
2. Check file pattern matches
3. Check Kiro settings for hooks enabled

### Hook Too Noisy

1. Adjust patterns to be more specific
2. Add conditions to prompt
3. Reduce validation strictness

### Hook Missing Issues

1. Add more checks to prompt
2. Expand file patterns
3. Create new specialized hook

## Future Enhancements

- [ ] Hook for accessibility validation
- [ ] Hook for security vulnerability scanning
- [ ] Hook for bundle size monitoring
- [ ] Hook for API documentation generation
- [ ] Hook for migration script validation
- [ ] Hook for environment variable validation

## Contributing

To add a new hook:

1. Create `.kiro.hook` file in this directory
2. Define trigger event and patterns
3. Write comprehensive validation prompt
4. Test with sample files
5. Document in this README
6. Update platform guide if needed

## Related Documentation

- `.kiro/steering/platform guide.md` - Project architecture
- `.kiro/steering/tech.md` - Technology stack
- `.kiro/steering/structure.md` - File organization
- `AGENTS.md` - TypeScript standards
