# User Profile Management System

**Status:** ✅ Implemented
**Created:** October 11, 2025

## Overview
Complete user profile management system with GDPR compliance, preferences, and account deletion.

## API Endpoints

### 1. **GET /api/users/profile**
Get current user's complete profile data.

**Response:**
```json
{
  "id": 1,
  "username": "creator123",
  "email": "user@example.com",
  "tier": "premium",
  "bio": "Adult content creator",
  "avatarUrl": "https://i.imgur.com/...",
  "website": "https://mysite.com",
  "preferences": {
    "emailNotifications": true,
    "theme": "dark",
    "captionStyle": "flirty",
    "watermarkPosition": "bottom-right"
  }
}
```

### 2. **PUT /api/users/profile**
Update profile information.

**Request:**
```json
{
  "username": "newusername",
  "bio": "Updated bio",
  "website": "https://newsite.com",
  "timezone": "America/New_York"
}
```

**Validations:**
- Username must be unique
- Email must be unique
- Website must be valid URL

### 3. **POST /api/users/avatar**
Update user avatar (must be Imgur URL).

**Request:**
```json
{
  "avatarUrl": "https://i.imgur.com/xyz123.jpg"
}
```

### 4. **PUT /api/users/preferences**
Update user preferences and settings.

**Request:**
```json
{
  "emailNotifications": false,
  "theme": "dark",
  "compactMode": true,
  "captionStyle": "professional",
  "defaultSubreddit": "gonewild",
  "watermarkPosition": "top-left"
}
```

**Available Preferences:**
- `emailNotifications` - Email alerts
- `pushNotifications` - Push alerts  
- `marketingEmails` - Marketing communications
- `showNSFWContent` - Show adult content
- `autoSchedulePosts` - Auto-scheduling
- `defaultSubreddit` - Default posting subreddit
- `theme` - light/dark/auto
- `compactMode` - Compact UI
- `showOnboarding` - Show onboarding tips
- `captionStyle` - casual/flirty/professional/funny
- `watermarkPosition` - top-left/top-right/bottom-left/bottom-right/center

### 5. **POST /api/users/change-password**
Change account password.

**Request:**
```json
{
  "currentPassword": "oldpass123",
  "newPassword": "newpass456",
  "confirmPassword": "newpass456"
}
```

**Requirements:**
- Current password must be correct
- New password min 8 characters
- Passwords must match
- All sessions invalidated after change

### 6. **DELETE /api/users/account**
Delete user account (GDPR compliant).

**Request:**
```json
{
  "password": "mypassword",
  "reason": "No longer using the service"
}
```

**What happens:**
1. User data archived for legal compliance
2. Account anonymized (not hard deleted)
3. Personal data replaced with placeholders
4. All preferences deleted
5. Cannot be undone

### 7. **POST /api/users/export-data**
Export all user data (GDPR right to data portability).

**Response:** Downloads JSON file with all user data.

## Database Schema

### Updated `users` table
```sql
- avatarUrl: text
- website: varchar(255)
- timezone: varchar(50)
- language: varchar(10)
- twoFactorEnabled: boolean
- lastLoginAt: timestamp
- passwordHash: varchar(255)
- lastPasswordChange: timestamp
- postsCount: integer
- captionsGenerated: integer
```

### Updated `user_preferences` table
```sql
- emailNotifications: boolean
- pushNotifications: boolean
- marketingEmails: boolean
- showNSFWContent: boolean
- autoSchedulePosts: boolean
- defaultSubreddit: varchar(100)
- theme: varchar(20)
- compactMode: boolean
- showOnboarding: boolean
- captionStyle: varchar(50)
- watermarkPosition: varchar(20)
```

### New `deleted_accounts` table
```sql
- originalUserId: integer
- email: varchar(255)
- username: varchar(50)
- deletionReason: text
- deletedAt: timestamp
- dataRetentionExpiry: timestamp
```

## Security Features

### Password Management
- Bcrypt hashing (10 rounds)
- Password change invalidates all sessions
- Minimum 8 characters required
- Current password verification required

### Account Deletion
- Password confirmation required
- Data archived for compliance
- Anonymization instead of hard delete
- Preserves referential integrity

### Data Privacy
- GDPR compliant data export
- Right to deletion supported
- Data portability enabled
- Audit trail maintained

## Integration Points

### Authentication
- Uses existing `authenticateToken` middleware
- JWT-based authentication
- Session invalidation on password change

### Validation
- Zod schemas for all inputs
- Email format validation
- Username uniqueness check
- URL validation for websites

### Logging
- All actions logged with Winston
- User ID included in logs
- Sensitive data excluded

## Usage Examples

### Update Profile
```javascript
const response = await fetch('/api/users/profile', {
  method: 'PUT',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    bio: 'Updated bio text',
    website: 'https://mysite.com'
  })
});
```

### Change Preferences
```javascript
const response = await fetch('/api/users/preferences', {
  method: 'PUT',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    theme: 'dark',
    emailNotifications: false
  })
});
```

### Delete Account
```javascript
const response = await fetch('/api/users/account', {
  method: 'DELETE',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    password: 'userpassword',
    reason: 'Optional reason'
  })
});
```

## Error Handling

### Common Error Codes
- `400` - Invalid input data
- `401` - Authentication required or incorrect password
- `404` - User not found
- `409` - Username/email already taken
- `500` - Server error

### Error Response Format
```json
{
  "error": "Error message",
  "details": [
    {
      "field": "username",
      "message": "Username already taken"
    }
  ]
}
```

## Migration Status
✅ Schema updated
✅ Routes implemented
✅ Validation complete
✅ GDPR compliance ready

## Next Steps
1. Add frontend UI components
2. Add 2FA support
3. Add email verification for changes
4. Add profile picture cropping
5. Add social media linking

---

**Total Implementation Time:** ~45 minutes
**Files Created/Modified:** 3
**Endpoints Added:** 7
**GDPR Compliant:** ✅
