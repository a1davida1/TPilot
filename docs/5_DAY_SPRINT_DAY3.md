# Day 3: Scheduled Posts System
**Time**: 8 hours human + 8 hours AI parallel  
**Goal**: Users can schedule Reddit posts for future dates/times

---

## ☀️ MORNING SESSION (4 hours)

### [ ] Task 3.1: Design Scheduled Posts Schema (1 hour)

**Step 1: Define requirements**:
```markdown
# Scheduled Posts Requirements

## User Stories
- As a user, I want to schedule posts to Reddit for specific dates/times
- As a user, I want to view/edit/cancel my scheduled posts
- As a user, I want to know if a scheduled post succeeded or failed
- As a user, I want automatic retries if posting fails

## Technical Requirements
- Store scheduled post data with content, media, target time
- Execute posts at scheduled time (±5 minutes acceptable)
- Handle failures gracefully (retry 3x with exponential backoff)
- Track execution status (pending, processing, completed, failed)
- Support timezones (user's local time)
```

**Step 2: Design database schema**:

Create `scheduled-posts-schema-design.md`:

```sql
-- Scheduled Posts Table Schema

CREATE TABLE scheduled_posts (
  -- Identity
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Post Content
  title TEXT NOT NULL,
  content TEXT,
  media_urls TEXT[],  -- S3 URLs
  subreddit VARCHAR(255) NOT NULL,
  flair_id VARCHAR(255),
  flair_text VARCHAR(255),
  
  -- Scheduling
  scheduled_for TIMESTAMP NOT NULL,
  timezone VARCHAR(50) DEFAULT 'America/Chicago',
  
  -- Execution Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- Values: pending, processing, completed, failed, cancelled
  reddit_post_id VARCHAR(255),  -- Filled after successful post
  reddit_permalink TEXT,
  
  -- Error Handling
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  last_retry_at TIMESTAMP,
  
  -- Audit Trail
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  executed_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  
  -- Constraints
  CONSTRAINT valid_status CHECK (
    status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')
  ),
  CONSTRAINT future_schedule CHECK (
    scheduled_for > created_at
  )
);

-- Indexes for Performance
CREATE INDEX idx_scheduled_posts_user ON scheduled_posts(user_id);
CREATE INDEX idx_scheduled_posts_status ON scheduled_posts(status);
CREATE INDEX idx_scheduled_posts_scheduled_for ON scheduled_posts(scheduled_for);

-- Composite index for finding due posts
CREATE INDEX idx_scheduled_posts_due ON scheduled_posts(scheduled_for, status)
  WHERE status = 'pending' AND scheduled_for <= NOW();
```

**Step 3: Define API endpoints**:
```typescript
// API Design

POST   /api/scheduled-posts
  Body: {
    title: string,
    content?: string,
    mediaUrls?: string[],
    subreddit: string,
    scheduledFor: ISO8601 datetime,
    timezone?: string
  }
  Response: ScheduledPost

GET    /api/scheduled-posts
  Query: {
    status?: 'pending' | 'completed' | 'failed',
    page?: number,
    limit?: number
  }
  Response: {
    posts: ScheduledPost[],
    total: number,
    page: number,
    limit: number
  }

GET    /api/scheduled-posts/:id
  Response: ScheduledPost

PUT    /api/scheduled-posts/:id
  Body: Partial<ScheduledPost>
  Response: ScheduledPost

DELETE /api/scheduled-posts/:id
  Response: { success: true }
```

**Deliverable**: Schema design document ✅

---

### [ ] Task 3.2: Generate Drizzle Migration (30 min)

**Add to `shared/schema.ts`**:

```typescript
export const scheduledPosts = pgTable('scheduled_posts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  
  // Content
  title: text('title').notNull(),
  content: text('content'),
  mediaUrls: text('media_urls').array(),
  subreddit: varchar('subreddit', { length: 255 }).notNull(),
  flairId: varchar('flair_id', { length: 255 }),
  flairText: varchar('flair_text', { length: 255 }),
  
  // Scheduling
  scheduledFor: timestamp('scheduled_for').notNull(),
  timezone: varchar('timezone', { length: 50 }).default('America/Chicago'),
  
  // Status
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  redditPostId: varchar('reddit_post_id', { length: 255 }),
  redditPermalink: text('reddit_permalink'),
  
  // Error handling
  errorMessage: text('error_message'),
  retryCount: integer('retry_count').default(0),
  maxRetries: integer('max_retries').default(3),
  lastRetryAt: timestamp('last_retry_at'),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  executedAt: timestamp('executed_at'),
  cancelledAt: timestamp('cancelled_at'),
});
```

**Generate and apply migration**:
```bash
npm run db:generate
# Review the generated migration file

npm run db:migrate
# Apply to database

# Verify table exists
psql $DATABASE_URL -c "\d scheduled_posts"
```

**Deliverable**: Migration applied ✅

---

## 🤖 PARALLEL: Codex Task 3.A - Build CRUD API (3h AI time)

**Copy this to Codex**:

```
TASK: Implement scheduled posts CRUD API endpoints

CONTEXT:
Users need to create, read, update, delete scheduled Reddit posts.
Schema defined in shared/schema.ts as scheduledPosts.

GOAL:
Create 5 RESTful API endpoints following existing patterns.

CREATE NEW FILE: server/routes/scheduled-posts.ts

IMPLEMENTATION:

import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { scheduledPosts } from '@shared/schema';
import { authenticateToken, type AuthRequest } from '../middleware/auth.js';
import { logger } from '../bootstrap/logger.js';
import { formatLogArgs } from '../lib/logger-utils.js';
import { eq, desc, and } from 'drizzle-orm';

const router = Router();

// Validation schemas
const createScheduledPostSchema = z.object({
  title: z.string().min(1).max(300),
  content: z.string().max(40000).optional(),
  mediaUrls: z.array(z.string().url()).max(20).optional(),
  subreddit: z.string().min(1),
  flairId: z.string().optional(),
  flairText: z.string().optional(),
  scheduledFor: z.string().datetime(),
  timezone: z.string().default('America/Chicago'),
});

// 1. POST /api/scheduled-posts - Create scheduled post
router.post('/', authenticateToken(true), async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const validation = createScheduledPostSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validation.error.issues 
      });
    }

    const data = validation.data;
    
    // Validate scheduledFor is in future
    const scheduledDate = new Date(data.scheduledFor);
    if (scheduledDate <= new Date()) {
      return res.status(400).json({ 
        error: 'Scheduled time must be in the future' 
      });
    }

    // Check user hasn't exceeded limit (e.g., 50 pending posts)
    const pendingCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(scheduledPosts)
      .where(and(
        eq(scheduledPosts.userId, userId),
        eq(scheduledPosts.status, 'pending')
      ));
    
    if (pendingCount[0]?.count >= 50) {
      return res.status(429).json({ 
        error: 'Maximum pending scheduled posts reached (50)' 
      });
    }

    // Create scheduled post
    const [post] = await db.insert(scheduledPosts).values({
      userId,
      title: data.title,
      content: data.content,
      mediaUrls: data.mediaUrls,
      subreddit: data.subreddit,
      flairId: data.flairId,
      flairText: data.flairText,
      scheduledFor: scheduledDate,
      timezone: data.timezone,
      status: 'pending',
    }).returning();

    res.status(201).json(post);
  } catch (error) {
    logger.error(...formatLogArgs('Error creating scheduled post:', error));
    res.status(500).json({ error: 'Failed to create scheduled post' });
  }
});

// 2. GET /api/scheduled-posts - List user's scheduled posts
router.get('/', authenticateToken(true), async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const status = req.query.status as string | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;

    // Build query
    let query = db
      .select()
      .from(scheduledPosts)
      .where(eq(scheduledPosts.userId, userId));

    if (status && ['pending', 'completed', 'failed', 'cancelled'].includes(status)) {
      query = query.where(and(
        eq(scheduledPosts.userId, userId),
        eq(scheduledPosts.status, status)
      ));
    }

    const posts = await query
      .orderBy(desc(scheduledPosts.scheduledFor))
      .limit(limit)
      .offset(offset);

    // Get total count
    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(scheduledPosts)
      .where(eq(scheduledPosts.userId, userId));
    
    const total = totalResult[0]?.count || 0;

    res.json({
      posts,
      total,
      page,
      limit,
    });
  } catch (error) {
    logger.error(...formatLogArgs('Error fetching scheduled posts:', error));
    res.status(500).json({ error: 'Failed to fetch scheduled posts' });
  }
});

// 3. GET /api/scheduled-posts/:id - Get single scheduled post
router.get('/:id', authenticateToken(true), async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const postId = parseInt(req.params.id);
    if (isNaN(postId)) {
      return res.status(400).json({ error: 'Invalid post ID' });
    }

    const [post] = await db
      .select()
      .from(scheduledPosts)
      .where(and(
        eq(scheduledPosts.id, postId),
        eq(scheduledPosts.userId, userId)
      ))
      .limit(1);

    if (!post) {
      return res.status(404).json({ error: 'Scheduled post not found' });
    }

    res.json(post);
  } catch (error) {
    logger.error(...formatLogArgs('Error fetching scheduled post:', error));
    res.status(500).json({ error: 'Failed to fetch scheduled post' });
  }
});

// 4. PUT /api/scheduled-posts/:id - Update scheduled post
router.put('/:id', authenticateToken(true), async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const postId = parseInt(req.params.id);
    if (isNaN(postId)) {
      return res.status(400).json({ error: 'Invalid post ID' });
    }

    // Check post exists and belongs to user
    const [existing] = await db
      .select()
      .from(scheduledPosts)
      .where(and(
        eq(scheduledPosts.id, postId),
        eq(scheduledPosts.userId, userId)
      ))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: 'Scheduled post not found' });
    }

    // Can't update if not pending
    if (existing.status !== 'pending') {
      return res.status(400).json({ 
        error: `Cannot update post with status: ${existing.status}` 
      });
    }

    // Validate update data
    const updateSchema = createScheduledPostSchema.partial();
    const validation = updateSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validation.error.issues 
      });
    }

    const data = validation.data;
    
    // If updating scheduledFor, validate it's future
    if (data.scheduledFor) {
      const newDate = new Date(data.scheduledFor);
      if (newDate <= new Date()) {
        return res.status(400).json({ 
          error: 'Scheduled time must be in the future' 
        });
      }
    }

    // Update post
    const [updated] = await db
      .update(scheduledPosts)
      .set({
        ...data,
        scheduledFor: data.scheduledFor ? new Date(data.scheduledFor) : undefined,
        updatedAt: new Date(),
      })
      .where(eq(scheduledPosts.id, postId))
      .returning();

    res.json(updated);
  } catch (error) {
    logger.error(...formatLogArgs('Error updating scheduled post:', error));
    res.status(500).json({ error: 'Failed to update scheduled post' });
  }
});

// 5. DELETE /api/scheduled-posts/:id - Cancel scheduled post
router.delete('/:id', authenticateToken(true), async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const postId = parseInt(req.params.id);
    if (isNaN(postId)) {
      return res.status(400).json({ error: 'Invalid post ID' });
    }

    // Check post exists and belongs to user
    const [existing] = await db
      .select()
      .from(scheduledPosts)
      .where(and(
        eq(scheduledPosts.id, postId),
        eq(scheduledPosts.userId, userId)
      ))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: 'Scheduled post not found' });
    }

    // Can't cancel if already completed
    if (existing.status === 'completed') {
      return res.status(400).json({ 
        error: 'Cannot cancel completed post' 
      });
    }

    // Soft delete - set status to cancelled
    await db
      .update(scheduledPosts)
      .set({
        status: 'cancelled',
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(scheduledPosts.id, postId));

    res.json({ success: true, message: 'Scheduled post cancelled' });
  } catch (error) {
    logger.error(...formatLogArgs('Error cancelling scheduled post:', error));
    res.status(500).json({ error: 'Failed to cancel scheduled post' });
  }
});

export default router;

ALSO UPDATE: server/routes.ts

Add this import:
import scheduledPostsRouter from './routes/scheduled-posts.js';

Add this route mounting (after other routes):
app.use('/api/scheduled-posts', scheduledPostsRouter);

VALIDATION:
After implementation, test with:
curl -X POST http://localhost:5000/api/scheduled-posts \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test scheduled post",
    "content": "This will post tomorrow",
    "subreddit": "test",
    "scheduledFor": "2025-10-11T10:00:00Z"
  }'

OUTPUT:
Confirm:
- File created: server/routes/scheduled-posts.ts
- Routes mounted in server/routes.ts
- All 5 endpoints implemented
- Validation working
- Error handling present
```

---

### [ ] Task 3.3: Review Codex API Implementation (30 min)

**Review Checklist**:
```bash
# 1. File created
ls -la server/routes/scheduled-posts.ts

# 2. Routes mounted
grep "scheduled-posts" server/routes.ts

# 3. Try to build
npm run build

# 4. Test manually (if possible)
# Start server, get auth token, test POST endpoint

# 5. Check error handling
grep "logger.error" server/routes/scheduled-posts.ts | wc -l
# Should have error handlers for each endpoint
```

---

## 🤖 PARALLEL: Codex Task 3.B - Build Worker (2h AI time)

**Copy this to Codex**:

```
TASK: Create BullMQ worker to execute scheduled posts

CONTEXT:
Need a background worker that:
1. Checks every 5 minutes for due posts
2. Executes Reddit posting
3. Handles retries on failure
4. Updates post status

CREATE FILE: server/workers/scheduled-posts-worker.ts

IMPLEMENTATION:

import { db } from '../db.js';
import { scheduledPosts } from '@shared/schema';
import { eq, and, lte } from 'drizzle-orm';
import { logger } from '../bootstrap/logger.js';
import { formatLogArgs } from '../lib/logger-utils.js';
import { postToReddit } from '../lib/reddit.js';

export class ScheduledPostsWorker {
  private intervalId: NodeJS.Timeout | null = null;
  private isProcessing = false;

  /**
   * Start the worker - checks every 5 minutes
   */
  start() {
    if (this.intervalId) {
      logger.warn('Scheduled posts worker already running');
      return;
    }

    logger.info('Starting scheduled posts worker');
    
    // Run immediately on start
    this.processDuePosts();
    
    // Then run every 5 minutes
    this.intervalId = setInterval(() => {
      this.processDuePosts();
    }, 5 * 60 * 1000); // 5 minutes
  }

  /**
   * Stop the worker
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('Scheduled posts worker stopped');
    }
  }

  /**
   * Process all posts that are due
   */
  private async processDuePosts() {
    if (this.isProcessing) {
      logger.warn('Already processing scheduled posts, skipping this cycle');
      return;
    }

    this.isProcessing = true;

    try {
      const now = new Date();

      // Find all pending posts that are due
      const duePosts = await db
        .select()
        .from(scheduledPosts)
        .where(and(
          eq(scheduledPosts.status, 'pending'),
          lte(scheduledPosts.scheduledFor, now)
        ))
        .limit(100); // Process max 100 per cycle

      if (duePosts.length === 0) {
        logger.info('No scheduled posts due');
        return;
      }

      logger.info(`Found ${duePosts.length} scheduled posts due for execution`);

      // Process each post
      for (const post of duePosts) {
        await this.processPost(post);
      }

      logger.info(`Finished processing ${duePosts.length} scheduled posts`);
    } catch (error) {
      logger.error(...formatLogArgs('Error processing scheduled posts:', error));
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single scheduled post
   */
  private async processPost(post: typeof scheduledPosts.$inferSelect) {
    try {
      logger.info(`Processing scheduled post ${post.id} for r/${post.subreddit}`);

      // Mark as processing
      await db
        .update(scheduledPosts)
        .set({ status: 'processing', updatedAt: new Date() })
        .where(eq(scheduledPosts.id, post.id));

      // Execute Reddit post
      const result = await postToReddit({
        userId: post.userId,
        subreddit: post.subreddit,
        title: post.title,
        content: post.content,
        mediaUrls: post.mediaUrls,
        flairId: post.flairId,
        flairText: post.flairText,
      });

      // Mark as completed
      await db
        .update(scheduledPosts)
        .set({
          status: 'completed',
          redditPostId: result.postId,
          redditPermalink: result.permalink,
          executedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(scheduledPosts.id, post.id));

      logger.info(`Successfully posted scheduled post ${post.id} to Reddit`);
    } catch (error) {
      await this.handlePostError(post, error);
    }
  }

  /**
   * Handle posting error with retry logic
   */
  private async handlePostError(
    post: typeof scheduledPosts.$inferSelect,
    error: unknown
  ) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const newRetryCount = (post.retryCount || 0) + 1;
    const maxRetries = post.maxRetries || 3;

    logger.error(...formatLogArgs(
      `Error posting scheduled post ${post.id}:`,
      { error: errorMessage, retryCount: newRetryCount }
    ));

    if (newRetryCount >= maxRetries) {
      // Max retries reached - mark as failed
      await db
        .update(scheduledPosts)
        .set({
          status: 'failed',
          errorMessage,
          retryCount: newRetryCount,
          updatedAt: new Date(),
        })
        .where(eq(scheduledPosts.id, post.id));

      logger.error(`Scheduled post ${post.id} failed after ${maxRetries} retries`);
    } else {
      // Schedule for retry - use exponential backoff
      const retryDelayMinutes = Math.pow(2, newRetryCount) * 5; // 10, 20, 40 minutes
      const nextRetry = new Date(Date.now() + retryDelayMinutes * 60 * 1000);

      await db
        .update(scheduledPosts)
        .set({
          status: 'pending', // Back to pending for retry
          errorMessage,
          retryCount: newRetryCount,
          lastRetryAt: new Date(),
          scheduledFor: nextRetry, // Reschedule for retry
          updatedAt: new Date(),
        })
        .where(eq(scheduledPosts.id, post.id));

      logger.info(
        `Scheduled post ${post.id} will retry in ${retryDelayMinutes} minutes (attempt ${newRetryCount + 1}/${maxRetries})`
      );
    }
  }
}

// Export singleton instance
export const scheduledPostsWorker = new ScheduledPostsWorker();

// Auto-start in production
if (process.env.NODE_ENV === 'production') {
  scheduledPostsWorker.start();
}

ALSO UPDATE: server/app.ts

Add at the top:
import { scheduledPostsWorker } from './workers/scheduled-posts-worker.js';

Add after Express app is configured:
// Start scheduled posts worker
if (process.env.NODE_ENV !== 'test') {
  scheduledPostsWorker.start();
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, stopping workers');
  scheduledPostsWorker.stop();
  process.exit(0);
});

VALIDATION:
Worker should:
1. Start automatically in production
2. Check every 5 minutes for due posts
3. Execute posts via postToReddit()
4. Retry failed posts with exponential backoff
5. Log all actions

Test locally:
1. Create a scheduled post for 1 minute from now
2. Wait and watch logs
3. Verify post appears on Reddit
4. Check database status updated to 'completed'
```

---

## 🌆 AFTERNOON SESSION (4 hours)

### [ ] Task 3.4: Build Frontend UI (2 hours)

**You or Codex can build this** - Basic schedule form in Reddit posting page:

```tsx
// Add to client/src/pages/reddit-posting.tsx

const [scheduleMode, setScheduleMode] = useState(false);
const [scheduledFor, setScheduledFor] = useState('');

// In your post submit handler:
if (scheduleMode && scheduledFor) {
  // POST to /api/scheduled-posts instead of immediate post
  await fetch('/api/scheduled-posts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      title,
      content,
      subreddit,
      scheduledFor: new Date(scheduledFor).toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    })
  });
}

// UI:
<div>
  <label>
    <input 
      type="checkbox" 
      checked={scheduleMode}
      onChange={(e) => setScheduleMode(e.target.checked)}
    />
    Schedule for later
  </label>
  
  {scheduleMode && (
    <input 
      type="datetime-local"
      value={scheduledFor}
      onChange={(e) => setScheduledFor(e.target.value)}
      min={new Date().toISOString().slice(0, 16)}
    />
  )}
</div>
```

---

### [ ] Task 3.5: End-to-End Testing (1 hour)

**Manual test flow**:

1. **Schedule a post**:
```bash
# Login to your app
# Go to Reddit posting page
# Enable "Schedule for later"
# Set time to 2 minutes from now
# Submit

# Verify in database:
psql $DATABASE_URL -c "SELECT * FROM scheduled_posts WHERE status='pending' ORDER BY id DESC LIMIT 1;"
```

2. **Watch worker execute**:
```bash
# Watch logs
tail -f logs/combined-*.log | grep "scheduled"

# After 2 minutes (or trigger manually), should see:
# "Processing scheduled post X for r/subreddit"
# "Successfully posted scheduled post X to Reddit"
```

3. **Verify on Reddit**:
- Check the subreddit
- Verify post appeared
- Check database status = 'completed'

4. **Test failure/retry**:
```sql
-- Create a post scheduled for invalid subreddit
INSERT INTO scheduled_posts (user_id, title, subreddit, scheduled_for, status)
VALUES (YOUR_USER_ID, 'Test', 'invalid_subreddit_12345', NOW(), 'pending');

-- Watch logs for retry attempts
-- Should see 3 retry attempts before marking failed
```

---

### [ ] Task 3.6: Write Tests (1 hour - or delegate to Codex)

**Create** `tests/unit/scheduled-posts.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../server/db';
import { scheduledPosts } from '@shared/schema';

describe('Scheduled Posts', () => {
  beforeEach(async () => {
    // Clean up test data
    await db.delete(scheduledPosts);
  });

  it('should create a scheduled post', async () => {
    const post = await db.insert(scheduledPosts).values({
      userId: 1,
      title: 'Test Post',
      subreddit: 'test',
      scheduledFor: new Date(Date.now() + 86400000), // Tomorrow
      status: 'pending'
    }).returning();

    expect(post[0]).toBeDefined();
    expect(post[0].status).toBe('pending');
  });

  it('should not allow scheduling in the past', () => {
    // Test constraint validation
  });

  it('should process due posts', async () => {
    // Test worker logic
  });
});
```

---

## ✅ DAY 3 WRAP-UP (30 min)

### Validation Checklist:
- [ ] Database migration applied (scheduled_posts table exists)
- [ ] API endpoints work (POST, GET, PUT, DELETE)
- [ ] Worker running and checking every 5 minutes
- [ ] Manual end-to-end test passed
- [ ] Post appeared on Reddit
- [ ] Status updated in database
- [ ] Retry logic tested

### Commit:
```bash
git add server/routes/scheduled-posts.ts \
        server/workers/scheduled-posts-worker.ts \
        shared/schema.ts \
        migrations/ \
        client/src/pages/reddit-posting.tsx

git commit -m "feat: implement scheduled posts system

- Add scheduled_posts table with migration
- Implement CRUD API for scheduling posts
- Create background worker with 5min polling
- Add retry logic with exponential backoff
- Build frontend UI for scheduling
- Test end-to-end with real Reddit post"

git push
```

---

**🎉 Day 3 Complete!** → Proceed to Day 4

**Tomorrow**: Build Reddit Intelligence (trend detection, content suggestions, analytics)
