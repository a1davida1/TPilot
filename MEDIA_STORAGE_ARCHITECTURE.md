# Media Storage Architecture

**CRITICAL**: Legal Compliance Requirement  
**Date**: October 26, 2025  
**Status**: ENFORCED

---

## 🚨 ABSOLUTE RULES

### **1. ZERO Local File Storage**
- ❌ **NEVER** save files to server filesystem
- ❌ **NEVER** use `/uploads` directory
- ❌ **NEVER** use `fs.writeFile()` for permanent storage
- ❌ **NEVER** store binary data in database
- ✅ **ONLY** temp files during processing (must be deleted immediately)

### **2. External Storage ONLY**
- ✅ Reddit native uploads (i.redd.it) - PRIMARY
- ✅ Imgbox fallback - ONLY when Reddit rejects
- ❌ NO Imgur (deprecated)
- ❌ NO Catbox (legacy, not used)
- ❌ NO S3/local hybrid

### **3. Legal Compliance**
This is NOT a performance optimization - it's a **legal requirement** for hosting adult content:
- Avoid DMCA liability
- Avoid 2257 record-keeping requirements for stored content
- Reduce server legal exposure
- Compliance with content hosting regulations

---

## 📋 Current Implementation

### **Reddit Native Upload Service**
**File**: `/server/services/reddit-native-upload.ts`

**Flow**:
```
1. User uploads file → Temp storage (Express multer)
2. Process image (resize, watermark if needed)
3. Upload to Reddit CDN (i.redd.it) via snoowrap
4. Reddit returns post URL with i.redd.it link
5. Delete temp file immediately
6. Store ONLY the i.redd.it URL in database
```

**Code Example**:
```typescript
// ✅ CORRECT
const result = await RedditNativeUploadService.uploadAndPost({
  userId,
  subreddit,
  title,
  imageUrl,  // External URL or temp file path
  nsfw: true,
  allowImgboxFallback: true  // Enable fallback
});
// Result contains i.redd.it URL, no files saved locally
```

### **Imgbox Fallback Service**
**File**: `/server/lib/imgbox-service.ts`

**When Used**: ONLY when Reddit CDN returns error/rejects upload

**Flow**:
```
1. Reddit upload fails
2. Service automatically uploads to Imgbox
3. Imgbox returns external URL
4. Delete temp file
5. Store Imgbox URL in database
```

**Code Example**:
```typescript
// Automatic fallback inside RedditNativeUploadService
if (!redditResult.success && options.allowImgboxFallback) {
  const imgboxResult = await ImgboxService.uploadImage(imageBuffer);
  return imgboxResult;  // Returns Imgbox URL
}
```

---

## ❌ DEPRECATED / DISABLED

### **MediaManager Local Storage**
**File**: `/server/lib/media.ts`  
**Status**: DISABLED with error

```typescript
// Now throws error instead of saving locally
if (!isS3Configured) {
  throw new Error('Local file storage is disabled for legal compliance.');
}
```

### **Old Upload Routes**
- `/api/media/upload` - Should NOT use MediaManager
- Any route saving to `/uploads` directory - BLOCKED

---

## ✅ CORRECT Usage Patterns

### **Quick Post**
```typescript
// User uploads → Process → Reddit → Done
const result = await RedditNativeUploadService.uploadAndPost({
  imageUrl: tempFilePath,  // Temp file from multer
  ...options
});
// Temp file automatically deleted
```

### **Scheduled Posts**
```typescript
// Store external URL in scheduled_posts table
await db.insert(scheduledPosts).values({
  imageUrl: 'https://i.redd.it/abc123.jpg',  // External URL only
  ...
});

// When posting, URL is already external
await RedditNativeUploadService.uploadAndPost({
  imageUrl: post.imageUrl,  // Already on i.redd.it
  ...
});
```

### **Caption Generation**
```typescript
// OpenRouter needs image → Use external URL
const result = await openrouterPipeline({
  imageUrl: 'https://i.redd.it/abc123.jpg',  // External URL
  ...
});
// No files saved
```

---

## 🔒 Enforcement

### **Code Guards**
1. **MediaManager**: Throws error if local storage attempted
2. **Express Routes**: Temp files only, auto-cleanup in `finally` blocks
3. **Database Schema**: `mediaAssets` table disabled (if using local storage)

### **Verification Checklist**
- [ ] No `fs.writeFile()` outside temp processing
- [ ] All temp files deleted in `finally` blocks
- [ ] No `/uploads` directory usage
- [ ] Only external URLs in database
- [ ] Reddit native upload used for all posts
- [ ] Imgbox fallback enabled

---

## 📊 Data Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│ 1. USER UPLOADS FILE                                    │
│    └─→ Express multer → /tmp/upload-xyz123             │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│ 2. PROCESS IMAGE (in memory)                            │
│    └─→ Resize, watermark, optimize                      │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│ 3. UPLOAD TO REDDIT CDN                                 │
│    └─→ POST to Reddit API via snoowrap                  │
│    └─→ Reddit saves to i.redd.it                        │
│    └─→ Returns: https://i.redd.it/abc123.jpg            │
└─────────────────────────────────────────────────────────┘
                            ↓
                    ✅ SUCCESS / ❌ REJECTED
                            ↓
                    ┌───────┴───────┐
                    ↓               ↓
            ✅ SUCCESS          ❌ REJECTED
                    ↓               ↓
     ┌──────────────────┐   ┌──────────────────┐
     │ 4a. CLEANUP      │   │ 4b. IMGBOX       │
     │ - Delete temp    │   │ - Upload there   │
     │ - Store URL      │   │ - Delete temp    │
     │ - Done ✅        │   │ - Store URL      │
     └──────────────────┘   │ - Done ✅        │
                            └──────────────────┘
```

---

## 🐛 Common Mistakes to Avoid

### ❌ WRONG: Saving files locally
```typescript
// DON'T DO THIS
const filePath = path.join('uploads', filename);
await fs.writeFile(filePath, buffer);
```

### ✅ RIGHT: Using Reddit upload
```typescript
// DO THIS
const result = await RedditNativeUploadService.uploadAndPost({
  imageBuffer: buffer,
  ...options
});
```

### ❌ WRONG: Storing binary in database
```typescript
// DON'T DO THIS
await db.insert(mediaAssets).values({
  data: buffer,  // ❌ Binary data
  ...
});
```

### ✅ RIGHT: Storing URLs only
```typescript
// DO THIS
await db.insert(posts).values({
  imageUrl: 'https://i.redd.it/abc123.jpg',  // ✅ URL only
  ...
});
```

---

## 📚 Related Files

### Core Implementation
- ✅ `/server/services/reddit-native-upload.ts` - Primary upload service
- ✅ `/server/lib/imgbox-service.ts` - Fallback service
- ✅ `/server/lib/reddit.ts` - Reddit API wrapper
- ❌ `/server/lib/media.ts` - DISABLED local storage

### Routes
- ✅ `/server/routes/media.ts` - Temp upload handling only
- ❌ `/server/routes/imgur-uploads.ts` - DEPRECATED
- ❌ `/server/routes/catbox-api.ts` - LEGACY

### Documentation
- ✅ `/docs/PLATFORM_OVERVIEW.md` - Architecture overview
- ✅ `/MEDIA_STORAGE_ARCHITECTURE.md` - This file
- ✅ `/SCHEDULING_SYSTEM_FIXES.md` - Scheduling with external URLs

---

## 🎯 Summary

**REMEMBER**: 
- 🚫 NO local storage
- ✅ Reddit native (i.redd.it) ONLY
- 🔄 Imgbox fallback when needed
- 🗑️ Delete temp files immediately
- 💾 Store URLs, never binary data

**WHY**: Legal compliance for adult content hosting. This is non-negotiable.

**HOW**: Use `RedditNativeUploadService.uploadAndPost()` for ALL image posts.
