# Catbox Migration - Imgur Replacement

## Overview
We've migrated from Imgur to Catbox for image uploads to save $500/month in API costs.

## Key Changes

### 1. Direct Client-Side Upload
- **Old**: Images uploaded to our backend, then forwarded to Imgur
- **New**: Images upload directly from browser to Catbox (never touch our servers)
- **Benefit**: Zero server liability for adult content + no bandwidth costs

### 2. Component Replacement
- **Old Component**: `ImgurUploadPortal`
- **New Component**: `CatboxUploadPortal`
- **Files Updated**:
  - `/client/src/pages/post-scheduling.tsx`
  - `/client/src/pages/quick-post.tsx`
  - `/client/src/components/GeminiCaptionGeneratorTabs.tsx`

### 3. Technical Implementation
```javascript
// Direct browser upload to Catbox
const formData = new FormData();
formData.append('reqtype', 'fileupload');
formData.append('fileToUpload', file);

const response = await fetch('https://catbox.moe/user/api.php', {
  method: 'POST',
  body: formData
});

const catboxUrl = await response.text();
```

## Benefits

1. **Cost Savings**: $0/month vs $500/month for Imgur
2. **Privacy**: Direct client upload = no server involvement
3. **Legal Compliance**: Adult content never touches our infrastructure
4. **File Size**: 200MB limit vs 15MB (Imgur)
5. **Anonymous**: No API keys or accounts required

## Migration Status

✅ **Completed**:
- Created `CatboxUploadPortal` component
- Replaced all frontend Imgur imports
- Updated UI text references

⚠️ **Pending** (Low Priority):
- Backend Imgur routes still exist but unused
- Can be removed in future cleanup

## Usage

The new component works identically to the old one:

```tsx
<CatboxUploadPortal 
  onComplete={(result) => {
    console.log(result.imageUrl); // Catbox URL
    console.log(result.provider); // "catbox" or "external"
  }}
  showPreview={true}
/>
```

## Fallback Options

Users can still paste URLs from:
- Old Imgur links
- Reddit (i.redd.it)
- Discord CDN
- Any direct image URL

## Security Notes

1. **CORS**: Catbox allows cross-origin uploads
2. **HTTPS**: All uploads use secure connections
3. **No Auth**: Anonymous uploads mean no API key exposure
4. **Direct Upload**: Images never stored on our servers

## Testing Checklist

- [ ] Upload JPEG image
- [ ] Upload PNG image  
- [ ] Upload GIF image
- [ ] Drag & drop upload
- [ ] Click to browse upload
- [ ] Paste external URL
- [ ] Preview displays correctly
- [ ] Caption generation works with Catbox URLs

## Future Considerations

- Monitor Catbox reliability
- Consider adding alternative providers (Litterbox, Pixeldrain)
- Implement client-side image optimization before upload
- Add progress callbacks for better UX

## Support

If Catbox is down, users can:
1. Use the "Paste URL" tab
2. Upload to any image host manually
3. Paste the resulting URL

---
*Migration Date: October 2025*
*Reason: Imgur pricing increased to $500/month for API access*
