# ThottoPilot Cron Jobs Implementation

## ✅ **Implemented Cron Job System**

### **Architecture Overview**
```
server/
├── lib/
│   └── scheduler/
│       └── cron-manager.ts       # Main cron job manager
├── bootstrap/
│   └── queue.ts                  # Initializes cron system on startup
└── routes/
    └── scheduled-posts.ts        # API endpoints with tier restrictions
```

## **Cron Jobs Schedule**

| Job Name | Schedule | Purpose | Status |
|----------|----------|---------|--------|
| **process-scheduled-posts** | Every minute | Process due scheduled posts | ✅ Active |
| **cleanup-old-posts** | Daily at 3 AM | Delete posts older than 30 days | ✅ Active |
| **update-analytics** | Every hour | Update analytics metrics | ✅ Active |
| **check-stuck-jobs** | Every 5 minutes | Retry stuck processing jobs | ✅ Active |
| **sync-reddit-communities** | Weekly Monday 2 AM | Sync Reddit community data | ✅ Active |

## **Tier Restrictions Enforced**

### **Scheduling Limits**
- **FREE**: ❌ No scheduling allowed
- **STARTER**: ❌ No scheduling allowed  
- **PRO**: ✅ Schedule up to 7 days ahead
- **PREMIUM**: ✅ Schedule up to 30 days ahead

### **Implementation in `/api/scheduled-posts`**
```typescript
// Tier check example
if (userTier === 'free' || userTier === 'starter') {
  return res.status(403).json({ 
    error: 'Scheduling requires Pro or Premium tier',
    requiredTier: 'pro' 
  });
}
```

## **Key Features**

### **1. Automatic Post Processing**
- Runs every minute
- Finds posts where `scheduledFor <= now` and `status = 'pending'`
- Updates status to `'processing'`
- Queues post for Reddit submission
- Handles up to 10 posts per tick

### **2. Stuck Job Recovery**
- Runs every 5 minutes
- Finds posts stuck in `'processing'` for > 10 minutes
- Resets them to `'pending'` for retry
- Prevents lost posts

### **3. Database Cleanup**
- Runs daily at 3 AM
- Removes completed/failed/cancelled posts older than 30 days
- Keeps database performant

### **4. Analytics Updates**
- Runs hourly
- Aggregates posting metrics
- Updates dashboard data

## **Database Schema Used**

### **scheduled_posts table**
```sql
- id: serial PRIMARY KEY
- userId: integer (references users)
- title: varchar(300)
- content: text
- imageUrl: text (Imgur URL)
- subreddit: varchar(100)
- scheduledFor: timestamp with time zone
- status: varchar(20) ['pending', 'processing', 'completed', 'failed', 'cancelled']
- nsfw: boolean
- flairText: varchar(100)
- errorMessage: text
- executedAt: timestamp
- createdAt: timestamp
- updatedAt: timestamp
```

## **API Endpoints**

### **POST /api/scheduled-posts**
Create a scheduled post
- Validates tier permissions
- Checks scheduling limits (7 days for Pro, 30 for Premium)
- Inserts to database

### **GET /api/scheduled-posts**
List user's scheduled posts
- Returns pending/processing posts
- Paginated results

### **DELETE /api/scheduled-posts/:id**
Cancel a scheduled post
- Sets status to 'cancelled'
- Only allows cancelling own posts

### **POST /api/scheduled-posts/optimal-times**
Get optimal posting times for a subreddit
- Returns best times based on engagement data

## **Queue Integration**

Posts are processed through the queue system:
```javascript
await addJob(QUEUE_NAMES.POST, {
  userId: post.userId,
  scheduleId: post.id,
  subreddit: post.subreddit,
  titleFinal: post.title,
  bodyFinal: post.content,
  mediaKey: post.imageUrl
});
```

## **Startup & Shutdown**

### **Startup** (in `bootstrap/queue.ts`)
```javascript
await cronManager.start();  // Starts all cron jobs
```

### **Shutdown**
```javascript
await cronManager.stop();   // Gracefully stops all jobs
```

## **Monitoring**

### **Get Cron Status**
```javascript
const status = cronManager.getStatus();
// Returns: { isRunning: true, jobs: { ... } }
```

### **Logging**
- All job executions logged with timestamps
- Errors logged with full context
- Success metrics tracked

## **Error Handling**

1. **Job Failures**: Logged and job marked as failed
2. **Database Errors**: Caught and logged, job retried
3. **Missing Modules**: Gracefully skipped with warnings
4. **Stuck Jobs**: Automatically recovered every 5 minutes

## **Testing the System**

```bash
# Check cron jobs are running
curl http://localhost:3005/api/health/crons

# Create a scheduled post (Pro/Premium only)
curl -X POST http://localhost:3005/api/scheduled-posts \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "subreddit": "gonewild",
    "title": "Test scheduled post",
    "imageUrl": "https://i.imgur.com/example.jpg",
    "scheduledFor": "2024-10-12T15:00:00Z",
    "nsfw": true
  }'

# View scheduled posts
curl http://localhost:3005/api/scheduled-posts \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## **Production Considerations**

1. **Redis Required**: For production, Redis improves queue performance
2. **Timezone Handling**: All times stored in UTC
3. **Rate Limiting**: Respects Reddit rate limits
4. **Scaling**: Can run multiple workers for high volume
5. **Monitoring**: Integrate with Sentry for error tracking

## **Future Enhancements**

1. **Recurring Posts**: Daily/weekly/monthly recurring schedules
2. **Batch Operations**: Schedule multiple posts at once
3. **Smart Scheduling**: AI-powered optimal time selection
4. **Conflict Detection**: Prevent duplicate posts to same subreddit
5. **Preview Generation**: Show post preview before scheduling

---

**Status: ✅ IMPLEMENTED & READY**

The cron job system is fully implemented with:
- Tier restrictions enforced
- Database integration complete
- Error handling in place
- Automatic recovery mechanisms
- Clean shutdown procedures
