// PHASE 1: Analytics API Routes - Real Data Collection & Processing
// Backend endpoints for comprehensive analytics and user behavior tracking
import { z } from 'zod';
import { db } from './db.js';
import { userSessions, pageViews, contentViews, engagementEvents, contentGenerations } from '@shared/schema';
import { eq, desc, gte, lte, and, count, sum, avg, sql } from 'drizzle-orm';
// Validation schemas
const analyticsEventSchema = z.object({
    eventType: z.string().min(1),
    sessionId: z.string().min(1),
    userId: z.string().optional(),
    timestamp: z.string(),
    userAgent: z.string().optional(),
    url: z.string().url(),
    referrer: z.string().optional(),
}).passthrough(); // Allow additional properties
const eventsPayloadSchema = z.object({
    events: z.array(analyticsEventSchema).min(1).max(50) // Limit batch size
});
const dateRangeSchema = z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    period: z.enum(['7d', '30d', '90d']).optional().default('7d')
});
export function registerAnalyticsRoutes(app) {
    // POST /api/analytics/events - Collect analytics events (batch)
    app.post('/api/analytics/events', async (req, res) => {
        try {
            const validation = eventsPayloadSchema.safeParse(req.body);
            if (!validation.success) {
                return res.status(400).json({
                    error: 'Invalid events payload',
                    details: validation.error.issues
                });
            }
            const { events } = validation.data;
            const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
            // Process each event
            for (const event of events) {
                await processAnalyticsEvent(event, ipAddress);
            }
            res.json({ success: true, processed: events.length });
        }
        catch (error) {
            console.error('Analytics events error:', error);
            res.status(500).json({ error: 'Failed to process analytics events' });
        }
    });
    // GET /api/analytics/:period - Get analytics data for dashboard
    app.get('/api/analytics/:period', async (req, res) => {
        try {
            const { period } = req.params;
            const validation = dateRangeSchema.safeParse({ period });
            if (!validation.success) {
                return res.status(400).json({ error: 'Invalid period' });
            }
            const { startDate, endDate } = getDateRange(period);
            const userId = getUserIdFromRequest(req);
            const analytics = await getAnalyticsData(userId, startDate, endDate);
            res.json(analytics);
        }
        catch (error) {
            console.error('Analytics fetch error:', error);
            res.status(500).json({ error: 'Failed to fetch analytics data' });
        }
    });
    // GET /api/analytics/realtime - Get real-time analytics
    app.get('/api/analytics/realtime', async (req, res) => {
        try {
            const userId = getUserIdFromRequest(req);
            const realtime = await getRealtimeAnalytics(userId);
            res.json(realtime);
        }
        catch (error) {
            console.error('Realtime analytics error:', error);
            res.status(500).json({ error: 'Failed to fetch realtime analytics' });
        }
    });
    // GET /api/analytics/content/:contentId - Get specific content analytics
    app.get('/api/analytics/content/:contentId', async (req, res) => {
        try {
            const contentId = parseInt(req.params.contentId);
            if (isNaN(contentId)) {
                return res.status(400).json({ error: 'Invalid content ID' });
            }
            const userId = getUserIdFromRequest(req);
            const contentAnalytics = await getContentAnalytics(contentId, userId);
            if (!contentAnalytics) {
                return res.status(404).json({ error: 'Content not found' });
            }
            res.json(contentAnalytics);
        }
        catch (error) {
            console.error('Content analytics error:', error);
            res.status(500).json({ error: 'Failed to fetch content analytics' });
        }
    });
    // POST /api/analytics/content/:contentId/view - Track external content view
    app.post('/api/analytics/content/:contentId/view', async (req, res) => {
        try {
            const contentId = parseInt(req.params.contentId);
            if (isNaN(contentId)) {
                return res.status(400).json({ error: 'Invalid content ID' });
            }
            const { platform, subreddit, viewType = 'external' } = req.body;
            const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
            await db.insert(contentViews).values({
                contentId,
                platform,
                subreddit,
                viewType,
                ipAddress,
                userAgent: req.headers['user-agent'],
                referrer: req.headers.referer
            });
            res.json({ success: true });
        }
        catch (error) {
            console.error('Content view tracking error:', error);
            res.status(500).json({ error: 'Failed to track content view' });
        }
    });
    // GET /api/analytics/sessions - Get user session analytics
    app.get('/api/analytics/sessions', async (req, res) => {
        try {
            const userId = getUserIdFromRequest(req);
            const limit = parseInt(req.query.limit) || 50;
            const sessions = await db
                .select()
                .from(userSessions)
                .where(userId ? eq(userSessions.userId, userId) : undefined)
                .orderBy(desc(userSessions.startedAt))
                .limit(limit);
            res.json(sessions);
        }
        catch (error) {
            console.error('Sessions analytics error:', error);
            res.status(500).json({ error: 'Failed to fetch session analytics' });
        }
    });
}
// Helper Functions
async function processAnalyticsEvent(event, ipAddress) {
    const deviceInfo = parseUserAgent(event.userAgent);
    const locationInfo = await getLocationFromIP(ipAddress);
    switch (event.eventType) {
        case 'page_view':
            await handlePageView(event, ipAddress, deviceInfo, locationInfo);
            break;
        case 'page_end':
            await handlePageEnd(event);
            break;
        case 'engagement_event':
            await handleEngagementEvent(event);
            break;
        case 'content_view':
            await handleContentView(event, ipAddress);
            break;
        case 'session_end':
            await handleSessionEnd(event);
            break;
        default:
            // Log unknown event types for debugging
            console.log('Unknown analytics event type:', event.eventType);
    }
}
async function handlePageView(event, ipAddress, deviceInfo, locationInfo) {
    // Create or update session
    await db.insert(userSessions).values({
        sessionId: event.sessionId,
        userId: event.userId ? parseInt(event.userId) : null,
        ipAddress,
        userAgent: event.userAgent,
        referrer: event.referrer,
        utmSource: extractUTMParam(event.url, 'utm_source'),
        utmMedium: extractUTMParam(event.url, 'utm_medium'),
        utmCampaign: extractUTMParam(event.url, 'utm_campaign'),
        deviceType: deviceInfo.deviceType,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
        country: locationInfo.country,
        city: locationInfo.city,
        startedAt: new Date(event.timestamp),
        pageCount: 1
    }).onConflictDoUpdate({
        target: userSessions.sessionId,
        set: {
            pageCount: sql `${userSessions.pageCount} + 1`,
            endedAt: new Date(event.timestamp)
        }
    });
    // Record page view
    await db.insert(pageViews).values({
        sessionId: event.sessionId,
        userId: event.userId ? parseInt(event.userId) : null,
        path: event.path,
        title: event.title,
        referrer: event.referrer,
        createdAt: new Date(event.timestamp)
    });
}
async function handlePageEnd(event) {
    if (!event.timeOnPage)
        return;
    // Update the latest page view with time spent
    await db.update(pageViews)
        .set({
        timeOnPage: event.timeOnPage,
        scrollDepth: event.scrollDepth,
        exitPage: event.exitPage
    })
        .where(and(eq(pageViews.sessionId, event.sessionId), eq(pageViews.path, event.path)));
}
async function handleEngagementEvent(event) {
    await db.insert(engagementEvents).values({
        sessionId: event.sessionId,
        userId: event.userId ? parseInt(event.userId) : null,
        eventType: event.type,
        element: event.element,
        page: event.page,
        metadata: event.metadata,
        value: event.value,
        createdAt: new Date(event.timestamp)
    });
}
async function handleContentView(event, ipAddress) {
    await db.insert(contentViews).values({
        contentId: event.contentId,
        sessionId: event.sessionId,
        userId: event.userId ? parseInt(event.userId) : null,
        platform: event.platform,
        subreddit: event.subreddit,
        viewType: event.viewType,
        ipAddress,
        timeSpent: event.timeSpent
    });
}
async function handleSessionEnd(event) {
    await db.update(userSessions)
        .set({
        endedAt: new Date(event.timestamp),
        duration: event.duration
    })
        .where(eq(userSessions.sessionId, event.sessionId));
}
async function getAnalyticsData(userId, startDate, endDate) {
    const where = userId
        ? and(eq(userSessions.userId, userId), gte(userSessions.startedAt, startDate), lte(userSessions.startedAt, endDate))
        : and(gte(userSessions.startedAt, startDate), lte(userSessions.startedAt, endDate));
    // Get basic metrics
    const sessionStats = await db
        .select({
        totalSessions: count(),
        totalPageViews: sum(userSessions.pageCount),
        avgDuration: avg(userSessions.duration),
        uniqueUsers: count(sql `DISTINCT ${userSessions.userId}`)
    })
        .from(userSessions)
        .where(where);
    // Get content generation stats
    const contentStats = await db
        .select({
        totalGenerations: count(),
        successfulGenerations: count(sql `CASE WHEN ${contentGenerations.generationType} = 'ai' THEN 1 END`)
    })
        .from(contentGenerations)
        .where(userId ? eq(contentGenerations.userId, userId) : undefined);
    // Get top performing content
    const topContent = await db
        .select({
        id: contentGenerations.id,
        platform: contentGenerations.platform,
        views: count(contentViews.id),
        createdAt: contentGenerations.createdAt
    })
        .from(contentGenerations)
        .leftJoin(contentViews, eq(contentViews.contentId, contentGenerations.id))
        .where(userId ? eq(contentGenerations.userId, userId) : undefined)
        .groupBy(contentGenerations.id, contentGenerations.platform, contentGenerations.createdAt)
        .orderBy(desc(count(contentViews.id)))
        .limit(10);
    // Get platform distribution
    const platformStats = await db
        .select({
        platform: contentGenerations.platform,
        count: count()
    })
        .from(contentGenerations)
        .where(userId ? eq(contentGenerations.userId, userId) : undefined)
        .groupBy(contentGenerations.platform);
    return {
        totalViews: sessionStats[0]?.totalPageViews || 0,
        totalSessions: sessionStats[0]?.totalSessions || 0,
        uniqueUsers: sessionStats[0]?.uniqueUsers || 0,
        averageSessionDuration: sessionStats[0]?.avgDuration || 0,
        totalGenerations: contentStats[0]?.totalGenerations || 0,
        successfulGenerations: contentStats[0]?.successfulGenerations || 0,
        topPerformingPosts: topContent.map(c => ({
            id: c.id,
            title: `${c.platform} content`,
            platform: c.platform,
            views: c.views,
            engagement: Math.floor(c.views * 0.1), // Rough estimate
            createdAt: c.createdAt
        })),
        platformDistribution: Object.fromEntries(platformStats.map(p => [p.platform, p.count]))
    };
}
async function getRealtimeAnalytics(userId) {
    const now = new Date();
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const where = userId
        ? and(eq(userSessions.userId, userId), gte(userSessions.startedAt, hourAgo))
        : gte(userSessions.startedAt, hourAgo);
    const realtimeStats = await db
        .select({
        activeSessions: count(),
        pageViewsLastHour: sum(userSessions.pageCount)
    })
        .from(userSessions)
        .where(where);
    return {
        activeSessions: realtimeStats[0]?.activeSessions || 0,
        pageViewsLastHour: realtimeStats[0]?.pageViewsLastHour || 0,
        lastUpdated: now.toISOString()
    };
}
async function getContentAnalytics(contentId, userId) {
    // Verify content belongs to user if userId provided
    if (userId) {
        const content = await db
            .select()
            .from(contentGenerations)
            .where(and(eq(contentGenerations.id, contentId), eq(contentGenerations.userId, userId)))
            .limit(1);
        if (content.length === 0)
            return null;
    }
    const viewStats = await db
        .select({
        totalViews: count(),
        uniqueViewers: count(sql `DISTINCT ${contentViews.ipAddress}`),
        platformViews: contentViews.platform,
        viewCount: count()
    })
        .from(contentViews)
        .where(eq(contentViews.contentId, contentId))
        .groupBy(contentViews.platform);
    return {
        contentId,
        totalViews: viewStats.reduce((sum, stat) => sum + stat.viewCount, 0),
        uniqueViewers: viewStats.length > 0 ? viewStats[0].uniqueViewers : 0,
        platformBreakdown: Object.fromEntries(viewStats.map(stat => [stat.platformViews, stat.viewCount]))
    };
}
// Utility functions
function getUserIdFromRequest(req) {
    // Try to get user ID from auth middleware or session
    const user = req.user;
    return user?.id || user?.userId || null;
}
function getDateRange(period) {
    const endDate = new Date();
    const startDate = new Date();
    switch (period) {
        case '7d':
            startDate.setDate(endDate.getDate() - 7);
            break;
        case '30d':
            startDate.setDate(endDate.getDate() - 30);
            break;
        case '90d':
            startDate.setDate(endDate.getDate() - 90);
            break;
        default:
            startDate.setDate(endDate.getDate() - 7);
    }
    return { startDate, endDate };
}
function extractUTMParam(url, param) {
    try {
        const urlObj = new URL(url);
        return urlObj.searchParams.get(param);
    }
    catch {
        return null;
    }
}
function parseUserAgent(userAgent) {
    // Simple user agent parsing - can be enhanced with a library like 'ua-parser-js'
    if (!userAgent)
        return { deviceType: 'unknown', browser: 'unknown', os: 'unknown' };
    const mobile = /Mobile|Android|iPhone|iPad/i.test(userAgent);
    const tablet = /iPad|Tablet/i.test(userAgent);
    let deviceType = 'desktop';
    if (tablet)
        deviceType = 'tablet';
    else if (mobile)
        deviceType = 'mobile';
    let browser = 'unknown';
    if (userAgent.includes('Chrome'))
        browser = 'Chrome';
    else if (userAgent.includes('Firefox'))
        browser = 'Firefox';
    else if (userAgent.includes('Safari'))
        browser = 'Safari';
    else if (userAgent.includes('Edge'))
        browser = 'Edge';
    let os = 'unknown';
    if (userAgent.includes('Windows'))
        os = 'Windows';
    else if (userAgent.includes('Mac'))
        os = 'macOS';
    else if (userAgent.includes('Linux'))
        os = 'Linux';
    else if (userAgent.includes('Android'))
        os = 'Android';
    else if (userAgent.includes('iOS'))
        os = 'iOS';
    return { deviceType, browser, os };
}
async function getLocationFromIP(ipAddress) {
    // Placeholder for IP geolocation - can integrate with services like MaxMind or ipapi
    // For now, return default values
    return {
        country: 'Unknown',
        city: 'Unknown'
    };
}
