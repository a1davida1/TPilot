# One-Click Posting Integration Guide

This document shows how to integrate ImageShield + Grok4 Captions + Reddit Posting into a seamless workflow.

## Architecture Overview

```
User uploads image
  ↓
Client-side ImageShield (WASM worker)
  ↓ (parallel)
Low-res preview → /api/caption/one-click-captions (OpenRouter)
  ↓
Two-caption picker (Flirty/Slutty; 6s auto-select)
  ↓
Subreddit rule linting
  ↓
Reddit media lease + submit
  ↓
Telemetry (no image bytes)
```

## Frontend Integration Example

```tsx
import { protectImage, createLowResPreview } from '@/lib/imageshield';
import { TwoCaptionPicker, type Caption } from '@/components/two-caption-picker';
import { 
  trackCaptionShown, 
  trackCaptionChoice, 
  trackProtectionMetrics,
  trackPostSubmit,
  generatePairId,
  getDeviceBucket
} from '@/lib/caption-telemetry';

async function oneClickPost(imageFile: File, targetSubreddit: string) {
  const pairId = generatePairId();
  
  // Step 1: Protect image client-side (Medium preset)
  const protectionStart = Date.now();
  const { blob: protectedBlob, metrics } = await protectImage(imageFile, 'medium');
  
  // Track protection metrics
  trackProtectionMetrics({
    ssim: metrics.ssim,
    phashDelta: metrics.phashDelta,
    preset: 'medium',
    durationMs: metrics.processingTime,
    downscaled: metrics.downscaled
  });

  // Step 2: Generate captions (parallel with protection)
  const preview = await createLowResPreview(imageFile);
  const captionResponse = await fetch('/api/caption/one-click-captions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_base64: preview })
  });
  
  const { captions, category, tags } = await captionResponse.json();
  
  // Track caption shown
  trackCaptionShown({
    pairId,
    captionIds: [captions[0].id, captions[1].id],
    styles: [captions[0].style, captions[1].style],
    protectionPreset: 'medium',
    deviceBucket: getDeviceBucket()
  });

  // Step 3: Show two-caption picker (user selects or 6s auto-select)
  const selectedCaption = await showCaptionPicker(captions);
  
  // Track user choice
  trackCaptionChoice({
    pairId,
    chosenCaptionId: selectedCaption.caption.id,
    timeToChoiceMs: selectedCaption.metadata.timeToChoice,
    edited: selectedCaption.metadata.edited,
    autoSelected: selectedCaption.metadata.autoSelected
  });

  // Step 4: Lint against subreddit rules
  const lintResult = await fetch('/api/subreddit-lint', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subreddit: targetSubreddit,
      title: selectedCaption.caption.text,
      nsfw: true,
      flair: undefined
    })
  });
  
  const { ok, warnings } = await lintResult.json();
  
  if (!ok) {
    // Show warnings and offer fixes
    const shouldContinue = await showLintWarnings(warnings);
    if (!shouldContinue) return;
  }

  // Step 5: Upload to Reddit
  const uploadStart = Date.now();
  const postUrl = await uploadToReddit(protectedBlob, {
    subreddit: targetSubreddit,
    title: selectedCaption.caption.text,
    nsfw: true
  });
  
  // Track submission
  trackPostSubmit({
    postKind: 'image',
    subreddit: targetSubreddit,
    nsfwFlag: true,
    uploadLatencyMs: Date.now() - uploadStart
  });

  return postUrl;
}

// Helper: Show caption picker as modal
function showCaptionPicker(captions: Caption[]): Promise<{
  caption: Caption;
  metadata: { timeToChoice: number; autoSelected: boolean; edited: boolean };
}> {
  return new Promise((resolve) => {
    // Render TwoCaptionPicker component
    // When user selects, resolve with caption + metadata
  });
}

// Helper: Upload to Reddit via media lease
async function uploadToReddit(
  blob: Blob,
  options: { subreddit: string; title: string; nsfw: boolean }
): Promise<string> {
  // 1. Get media lease
  const leaseResponse = await fetch('https://oauth.reddit.com/api/media/asset.json', {
    method: 'POST',
    headers: { Authorization: `Bearer ${redditAccessToken}` }
  });
  const lease = await leaseResponse.json();

  // 2. Upload to S3
  await fetch(lease.args.action, {
    method: 'PUT',
    body: blob,
    headers: lease.args.headers
  });

  // 3. Submit post
  const submitResponse = await fetch('https://oauth.reddit.com/api/submit', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${redditAccessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sr: options.subreddit,
      kind: 'image',
      title: options.title,
      url: lease.asset.asset_url,
      nsfw: options.nsfw
    })
  });

  const result = await submitResponse.json();
  return result.json.data.url;
}
```

## Server Setup

### 1. Add routes to Express app

```ts
import { captionRouter } from './routes/caption';
import { subredditLintRouter } from './routes/subreddit-lint';

app.use('/api/caption', captionRouter);
app.use('/api/subreddit-lint', subredditLintRouter);
```

### 2. Environment variables

```env
# OpenRouter for caption generation
OPENROUTER_API_KEY=sk-or-v1-...
APP_BASE_URL=https://thottopilot.com

# Optional: Override model defaults
CAPTION_PRIMARY_MODEL=x-ai/grok-4-fast
CAPTION_FALLBACK_MODEL=anthropic/claude-3-opus
```

### 3. Update subreddit rules cache

Edit `server/moderation/rules.ts` to add more subreddits:

```ts
export const SUBREDDIT_RULES: SubredditRule[] = [
  // Add new rules here
  {
    subreddit: 'YourSubreddit',
    nsfwRequired: true,
    bannedWords: ['spam'],
    titleMax: 200,
    updatedAt: '2025-10-08'
  }
];
```

## Client-Side Components

### Two-Caption Picker Usage

```tsx
import { TwoCaptionPicker } from '@/components/two-caption-picker';

function PostingFlow() {
  const [captions, setCaptions] = useState<[Caption, Caption]>([...]);

  const handleSelect = (caption, metadata) => {
    console.log('Selected:', caption.text);
    console.log('Time to choice:', metadata.timeToChoice);
    console.log('Auto-selected:', metadata.autoSelected);
    console.log('Edited:', metadata.edited);
    
    // Proceed with Reddit submission
  };

  const handleRegenerate = async () => {
    // Call /api/caption/one-click-captions again
    // Update captions state
  };

  return (
    <TwoCaptionPicker
      captions={captions}
      onSelect={handleSelect}
      onRegenerate={handleRegenerate}
      autoSelectTimeout={6000}
    />
  );
}
```

## Testing

### Test caption generation

```bash
curl -X POST http://localhost:5000/api/caption/one-click-captions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"image_base64": "BASE64_STRING"}'
```

Expected response:
```json
{
  "captions": [
    {
      "id": "flirty_1234567890",
      "text": "✨ Feeling cute today... might delete later 😘",
      "style": "flirty"
    },
    {
      "id": "slutty_1234567891",
      "text": "🔥 Come see what happens next. Link in bio 💋",
      "style": "slutty"
    }
  ],
  "category": "lingerie",
  "tags": ["bedroom", "teasing"]
}
```

### Test subreddit linting

```bash
curl -X POST http://localhost:5000/api/subreddit-lint \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "subreddit": "gonewild",
    "title": "Feeling cute",
    "nsfw": true
  }'
```

Expected response:
```json
{
  "ok": true,
  "warnings": [],
  "rule": {
    "subreddit": "gonewild",
    "nsfwRequired": true,
    "notes": "https://www.reddit.com/r/gonewild/wiki/rules"
  }
}
```

## Performance Benchmarks

- **ImageShield (Medium, 1080p)**: 1.5–3.0s
- **Caption generation (Grok4 Fast)**: 2–4s
- **Subreddit linting**: <50ms
- **Reddit upload**: 1–3s (network dependent)

**Total one-click time**: ~5–10s

## Privacy & Legal Notes

- ✅ Images processed client-side (WASM worker)
- ✅ Only low-res preview sent to caption API (ephemeral)
- ✅ No image bytes stored in database
- ✅ Telemetry logs metadata only (no PHI/PII)
- ✅ Reddit hosts final image (not ThottoPilot)

## Troubleshooting

### "OPENROUTER_API_KEY not configured"
Set the environment variable in `.env`:
```
OPENROUTER_API_KEY=sk-or-v1-...
```

### "Quality degraded below threshold"
ImageShield rejected the output. Try:
- Use 'fast' preset for lower quality requirements
- Check original image isn't corrupted
- Verify browser supports OffscreenCanvas

### Caption generation timeout
- OpenRouter rate limits may apply
- Fallback to Claude 3 Opus will trigger automatically
- Check network connectivity

### Subreddit rules outdated
Update `server/moderation/rules.ts` with latest requirements from subreddit wikis.
