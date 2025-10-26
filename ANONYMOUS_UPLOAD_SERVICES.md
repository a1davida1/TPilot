# Anonymous Upload Services (No API Key Required)

**Date**: October 26, 2025  
**Purpose**: Legal compliance - true third-party storage

---

## Why Anonymous Services?

**Using an API key = "Our Storage"**
- If we use our API key, images are tied to our account
- Could be considered "our storage" legally
- Not truly compliant with zero-storage requirement

**Anonymous uploads = True Third-Party**
- No account association
- Truly external storage
- Full legal compliance

---

## Implemented Services

### 1. **Imgbox** (Primary)
- **URL**: https://imgbox.com
- **Limit**: 32MB per file
- **Expiration**: Never (anonymous uploads)
- **Adult Content**: Yes (with flag)
- **Implementation**: `/server/lib/imgbox-service.ts`
- **Status**: ✅ Fixed (October 2025)
- **Method**: CSRF token from meta tag + form submission

### 2. **PostImages** (Fallback)
- **URL**: https://postimages.org
- **Limit**: 24MB per file  
- **Expiration**: Never option available
- **Adult Content**: Yes (with flag)
- **Implementation**: `/server/lib/postimages-service.ts`
- **Status**: ✅ Implemented
- **Method**: Anonymous JSON API

---

## Upload Flow

```
1. Try Imgbox (anonymous)
   ↓ (fails?)
2. Try PostImages (anonymous)
   ↓ (fails?)
3. Base64 emergency fallback (NOT compliant!)
```

---

## Other Anonymous Options (Not Implemented)

### **ImgBB** 
- Has anonymous upload option
- 32MB limit
- API available at: https://api.imgbb.com/1/upload
- Requires: `key` parameter (but allows anonymous keys)

### **Imageupload.io**
- Anonymous uploads allowed
- 50MB limit
- No API documentation

### **FreeImage.host**
- Anonymous allowed
- 25MB limit
- Simple POST API

### **Uploadcare**
- Anonymous via public key
- 100MB limit
- More complex API

---

## Services That REQUIRE Account/API Key

**These would NOT be compliant:**
- ❌ Imgur (requires client ID)
- ❌ Cloudinary (requires API key)
- ❌ AWS S3 (our bucket)
- ❌ Catbox (blocked by ISPs anyway)

---

## Testing Services

### Test Imgbox:
```bash
node scripts/test-imgbox.js
```

### Test PostImages:
```bash
node scripts/test-postimages.js
```

---

## Current Implementation

The `/api/media/upload` endpoint now:
1. Tries Imgbox first (most reliable)
2. Falls back to PostImages if Imgbox fails
3. Emergency base64 if both fail (with warning)

```typescript
// Response includes provider field
{
  asset: {
    provider: 'imgbox' | 'postimages' | 'base64-emergency',
    signedUrl: 'https://...',
    // ...
  }
}
```

---

## Legal Compliance Summary

✅ **Compliant:**
- Imgbox (anonymous)
- PostImages (anonymous)
- Any service without our API key

❌ **NOT Compliant:**
- Base64 in database (still our storage)
- Local filesystem (obvious violation)
- Any service using our API key (tied to us)

---

## Recommendations

1. **Primary**: Keep Imgbox as primary (fast, reliable)
2. **Fallback**: PostImages works well as backup
3. **Never**: Don't use base64 for production
4. **Monitor**: Log which service is being used
5. **Test**: Regularly test both services work

---

## Notes

- Both services support NSFW/adult content when flagged
- Both offer permanent storage (no expiration)
- Both are free and don't require registration
- Both are accessible (not commonly blocked by ISPs)
