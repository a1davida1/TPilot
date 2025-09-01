# Reddit Integration Setup Guide

## Overview

ThottoPilot includes comprehensive Reddit integration for content creators, featuring OAuth authentication, community management, and automated posting capabilities.

## Environment Configuration

### Required Environment Variables

```bash
# Reddit OAuth Credentials
REDDIT_CLIENT_ID=your_reddit_client_id
REDDIT_CLIENT_SECRET=your_reddit_client_secret
REDDIT_REDIRECT_URI=https://yourdomain.com/api/reddit/callback

# Optional: Custom domain configuration
REPLIT_DOMAINS=yourdomain.com,www.yourdomain.com
```

### Getting Reddit OAuth Credentials

1. Visit [Reddit App Preferences](https://www.reddit.com/prefs/apps)
2. Click "Create App" or "Create Another App"
3. Fill in the details:
   - **Name**: ThottoPilot Integration
   - **App type**: Web app
   - **Description**: Content creation and scheduling tool
   - **About URL**: https://yourdomain.com
   - **Redirect URI**: https://yourdomain.com/api/reddit/callback
4. Copy the client ID and secret to your environment variables

## Port Configuration

The server automatically binds to the PORT environment variable with fallback to 5000:

```typescript
// server/index.ts
const port = parseInt(process.env.PORT || '5000', 10);
server.listen({
  port,
  host: "0.0.0.0",
  reusePort: true,
});
```

### Port Conflict Resolution

- **Production**: Always use `PORT` environment variable
- **Development**: Defaults to 5000, but can be overridden
- **Replit**: The PORT variable is automatically set and is the only non-firewalled port

## OAuth Flow Implementation

### 1. Initiate OAuth Connection

**Endpoint**: `GET /api/reddit/connect`

```typescript
// Requires authentication
const response = await fetch('/api/reddit/connect', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const { authUrl } = await response.json();

// Redirect user to authUrl
window.open(authUrl, '_blank');
```

### 2. Handle OAuth Callback

**Endpoint**: `GET /api/reddit/callback`

- Validates state parameter for security
- Exchanges authorization code for access tokens
- Stores encrypted tokens in database
- Redirects to dashboard with success/error status

### 3. Test Connection

**Endpoint**: `POST /api/reddit/test`

```typescript
const response = await fetch('/api/reddit/test', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` }
});
const result = await response.json();
```

## One-Click Posting

### Submit Text Post

```typescript
const response = await fetch('/api/reddit/post', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    subreddit: 'test',
    title: 'My Post Title',
    body: 'Post content here...',
    nsfw: false,
    spoiler: false
  })
});
```

### Submit Link Post

```typescript
const response = await fetch('/api/reddit/post', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    subreddit: 'test',
    title: 'Check out this link',
    url: 'https://example.com',
    nsfw: false,
    spoiler: false
  })
});
```

## Security Features

### State Validation
- Cryptographically secure state generation
- IP address logging (with mismatch warnings)
- 10-minute state expiration
- Immediate state cleanup after use

### Token Management
- Access tokens encrypted at rest
- Refresh tokens stored separately
- Automatic token refresh on expiration
- Secure token decryption for API calls

### Rate Limiting
- Per-user posting limits
- Subreddit-specific cooldowns
- Global rate limiting protection
- Posting permission validation

## Community Database

ThottoPilot includes a curated database of 180+ Reddit communities with:

- Engagement rates and success probabilities
- Member counts and activity levels
- Content guidelines and posting rules
- Category classifications
- NSFW/SFW designations

### Access Community Data

**Endpoint**: `GET /api/reddit/communities`

```typescript
const response = await fetch('/api/reddit/communities?category=lifestyle&search=fitness');
const communities = await response.json();
```

## Error Handling

### Common Error Responses

```typescript
// Missing OAuth credentials
{
  "error": "Reddit integration not configured. Please set REDDIT_CLIENT_ID and other Reddit environment variables."
}

// Invalid/expired tokens
{
  "error": "Invalid tokens. Please reconnect your Reddit account."
}

// Rate limiting
{
  "error": "Rate limited by Reddit. Please try again later."
}

// Permission denied
{
  "error": "Cannot post to this subreddit: insufficient karma"
}
```

### Frontend Error Handling

```typescript
// Handle OAuth errors in dashboard
const urlParams = new URLSearchParams(window.location.search);
const error = urlParams.get('error');

if (error === 'reddit_access_denied') {
  showError('Reddit access was denied');
} else if (error === 'invalid_state') {
  showError('Security validation failed');
}
```

## Testing

### Unit Tests
- OAuth flow validation
- Token encryption/decryption
- API response handling
- Error scenarios

### Integration Tests
- Complete posting flow
- Community data retrieval
- User account management
- Rate limiting behavior

## Troubleshooting

### Common Issues

1. **"Reddit integration not configured"**
   - Check REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET environment variables
   - Verify the values don't have extra spaces or quotes

2. **"Redirect URI mismatch"**
   - Ensure REDDIT_REDIRECT_URI matches exactly what's configured in Reddit app
   - Check for http vs https protocol
   - Verify domain matches REPLIT_DOMAINS configuration

3. **"Invalid state parameter"**
   - State may have expired (10 minute limit)
   - Check for browser redirects or proxy issues
   - Verify state storage backend is working

4. **"Cannot post to subreddit"**
   - User may not have sufficient karma
   - Account may be too new
   - Subreddit may have specific restrictions

### Debug Logging

Enable detailed logging by checking console output:

```typescript
// Reddit OAuth initiated
console.log('Reddit OAuth initiated:', { userId, state: '...', ip });

// Token exchange
console.log('Reddit OAuth redirect URI (exchange):', redirectUri);

// Posting attempt
console.log(`Submitting post to r/${subreddit}: "${title}"`);
```

## Production Deployment

### Environment Setup
- Set all required environment variables
- Configure domain in REPLIT_DOMAINS
- Verify Reddit app redirect URI matches production domain

### Security Checklist
- [ ] HTTPS enabled for OAuth callback
- [ ] Environment variables secured
- [ ] Rate limiting configured
- [ ] Error logging enabled
- [ ] Token encryption working
- [ ] State validation active

### Monitoring
- Monitor OAuth success/failure rates
- Track posting success rates by subreddit
- Watch for rate limiting issues
- Monitor token refresh patterns

## Support

For additional support:
1. Check the Reddit API documentation
2. Review server logs for detailed error messages
3. Test OAuth flow in development environment
4. Verify all environment variables are set correctly