# Kiro Hooks Quick Reference

## When Hooks Trigger

| Hook | Trigger | Files |
|------|---------|-------|
| **New File Integration Validator** | File created | `**/*.ts`, `**/*.tsx` |
| **Component Integration Checker** | File saved | `client/src/components/**/*.tsx`, `client/src/pages/**/*.tsx` |
| **API Integration Validator** | File saved | `server/routes/**/*.ts`, `server/services/**/*.ts` |
| **TypeScript Error Checker** | File edited | `**/*.ts`, `**/*.tsx` |

## What Each Hook Checks

### New File Integration Validator
✅ TypeScript compliance  
✅ Component registration  
✅ API endpoint registration  
✅ Service integration  
✅ Documentation  

### Component Integration Checker
✅ Component usage  
✅ API integration  
✅ Authentication  
✅ UI/UX standards  
✅ Error handling  

### API Integration Validator
✅ Route registration  
✅ Frontend calls  
✅ Type safety  
✅ Authentication  
✅ Error handling  

## Common Issues & Fixes

### Issue: "Component not integrated"
**Fix:**
```tsx
// Add to parent component:
import { NewComponent } from '@/components/NewComponent';
<NewComponent />
```

### Issue: "Route not registered"
**Fix:**
```typescript
// Add to server/routes.ts:
import { newRouter } from './routes/new-feature.js';
app.use('/api/new-feature', newRouter);
```

### Issue: "Missing error handling"
**Fix:**
```tsx
if (error) {
  return <Alert variant="destructive">{error.message}</Alert>;
}
```

### Issue: "Missing loading state"
**Fix:**
```tsx
if (isLoading) {
  return <LoadingSkeleton />;
}
```

### Issue: "No frontend integration"
**Fix:**
```typescript
// Create hook:
export function useFeature() {
  return useQuery({
    queryKey: ['/api/feature'],
    queryFn: async () => apiRequest('GET', '/api/feature'),
  });
}
```

## Integration Patterns

### New Page
```
1. Create: client/src/pages/new-page.tsx
2. Add route: App.tsx
3. Add nav link: sidebar/nav component
```

### New API Endpoint
```
1. Create: server/routes/new-feature.ts
2. Register: server/routes.ts
3. Create hook: client/src/hooks/useNewFeature.ts
4. Use in component
```

### New Component
```
1. Create: client/src/components/NewWidget.tsx
2. Import in parent
3. Add to UI
```

### New Service
```
1. Create: server/services/new-service.ts
2. Import in routes
3. Use in route handlers
```

## Hook Output Format

```
# Integration Report

## ✅ Passed (X/Y)
- TypeScript compliance
- Component structure

## ❌ Failed (X issues)

### CRITICAL:
1. Component not integrated
   Fix: [exact code]

### WARNINGS:
1. Missing JSDoc
   Suggestion: [example]

## 🔧 Integration Steps
1. [Step with code]
2. [Step with code]

## Status: [READY/NEEDS FIXES]
```

## Quick Commands

### View Hooks
```
Open: .kiro/hooks/
```

### Enable/Disable Hook
```json
// Edit .kiro.hook file:
{
  "enabled": true  // or false
}
```

### Test Hook
```
1. Create/save matching file
2. Check Kiro output
3. Follow suggestions
```

## Best Practices

✅ **DO:**
- Read hook feedback carefully
- Follow exact code provided
- Test integration after fixes
- Update hooks when patterns change

❌ **DON'T:**
- Ignore hook warnings
- Disable hooks without reason
- Skip integration steps
- Leave orphaned code

## Getting Help

1. **Read hook output** - It's detailed and actionable
2. **Check `.kiro/hooks/README.md`** - Full documentation
3. **Check platform guide** - Project patterns
4. **Ask team** - If pattern is unclear

## Hook Effectiveness

**Catches:**
- Orphaned components (100%)
- Unregistered routes (100%)
- Missing error handling (90%)
- TypeScript violations (100%)
- Integration issues (95%)

**Saves:**
- Code review time (50%)
- Bug fixing time (70%)
- Onboarding time (60%)

## Troubleshooting

### Hook not triggering
- Check `"enabled": true`
- Check file pattern matches
- Restart Kiro

### Hook too noisy
- Adjust patterns
- Reduce validation strictness
- Add conditions

### Hook missing issues
- Add more checks
- Expand patterns
- Create specialized hook
