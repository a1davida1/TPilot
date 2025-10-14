# CSP Inline Style Fix

## Problem

React and Radix UI components use inline styles that were being blocked by CSP:
```
Content-Security-Policy: The page's settings blocked an inline style (style-src-elem)
```

## Solution

### 1. Updated CSP to Allow Inline Styles

Modified `/server/middleware/security.ts`:
```javascript
styleSrc: [
  "'self'",
  "'unsafe-inline'", // Required for Radix UI and React inline styles
  "https://fonts.googleapis.com",
  "https://checkout.stripe.com",
  "data:"
]
```

### 2. Fixed Accessibility Issue

Updated `/client/src/components/ReferralWidget.tsx`:
- Added `id` to input field
- Connected label with `htmlFor`
- Added `aria-label` for screen readers
- Added `title` attribute for tooltips

## Why This is Safe

- **Scripts remain secure**: We only added `'unsafe-inline'` to `styleSrc`, NOT to `scriptSrc`
- **Inline styles are lower risk**: Unlike inline scripts, inline styles cannot execute code
- **Required for modern UI libraries**: Radix UI, React, and many component libraries need inline styles to function

## Testing

After deployment:
1. CSP errors for inline styles should disappear
2. UI components should render correctly
3. Referral widget input should be accessible

## Security Note

While `'unsafe-inline'` for styles is less secure than using nonces or hashes, it's an acceptable trade-off because:
- The security risk is much lower for styles than scripts
- It's required for the UI libraries we're using
- The alternative would break the UI or require significant refactoring
