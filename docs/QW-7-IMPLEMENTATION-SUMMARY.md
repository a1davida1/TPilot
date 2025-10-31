# QW-7: Post Performance Predictor - Implementation Summary

**Feature:** Rule-based performance prediction for Reddit posts  
**Status:** ✅ Backend Complete | ✅ API Complete | ✅ UI Component Complete | ⏳ Integration Pending  
**Date Completed:** October 31, 2025

## Overview

The Post Performance Predictor analyzes posts before submission and provides a 0-100 score predicting likely performance based on historical data and best practices.

## Implementation Details

### 1. Backend Service ✅ COMPLETE

**File:** `server/services/prediction-service.ts`

**Features:**
- Weighted scoring algorithm (0-100):
  - Title quality: 15%
  - Posting time: 20%
  - Subreddit health: 35%
  - User success rate: 30%
- Performance classifications:
  - Viral: 80+ score
  - High: 65-79 score
  - Medium: 45-64 score
  - Low: <45 score
- Confidence levels: low/medium/high based on data availability
- Actionable suggestions (max 5 per prediction)

**Title Scoring Logic:**
- Optimal length: 40-80 characters (+30 pts)
- Question marks (+10 pts)
- Emojis (+5 pts each, max 2)
- All caps penalty (-15 pts)
- Excessive punctuation penalty (-10 pts)

**Timing Scoring Logic:**
- Uses historical performance data for specific hour/day combinations
- Falls back to general Reddit patterns:
  - Best: 7-9 PM (19-21)
  - Good: Evening hours (17-23)
  - Decent: Morning hours (6-9)
  - Poor: Late night/early morning (2-5)
- Best days: Thursday-Saturday

**Subreddit Health Scoring:**
- Success rate: 40%
- Engagement (upvotes): 30%
- Removal rate (inverted): 30%

**User Success Scoring:**
- Success rate in subreddit: 60%
- Average engagement: 40%

### 2. API Endpoint ✅ COMPLETE

**File:** `server/routes/analytics.ts`

**Endpoint:** `POST /api/analytics/predict-performance`

**Authentication:** Required (Pro/Premium tier)

**Request Body:**
```typescript
{
  subreddit: string;
  title: string;
  scheduledTime?: string; // ISO date, defaults to now
}
```

**Response:**
```typescript
{
  level: 'low' | 'medium' | 'high' | 'viral';
  score: number; // 0-100
  confidence: 'low' | 'medium' | 'high';
  suggestions: string[]; // Max 5 actionable tips
  factors: {
    titleScore: number;      // 0-100
    timingScore: number;     // 0-100
    subredditHealthScore: number; // 0-100
    userSuccessScore: number;     // 0-100
  };
}
```

**Tier Check:** Requires Pro or Premium tier (403 error for Free/Starter)

**Error Handling:** Returns neutral prediction (50 score, medium level) on service errors

### 3. UI Component ✅ COMPLETE

**File:** `client/src/components/analytics/PerformancePrediction.tsx`

**Features:**
- Large visual indicator with color-coded level display
- Score display (0-100) with confidence badge
- Factor breakdown showing all 4 scoring components
- List of actionable suggestions
- Responsive design with shadcn/ui components
- Auto-updates when props change
- 1-minute cache for predictions

**Visual Design:**
- Viral: Green with Zap icon
- High: Blue with TrendingUp icon
- Medium: Yellow with CheckCircle icon
- Low: Red with AlertCircle icon

**Props:**
```typescript
{
  subreddit: string;
  title: string;
  scheduledTime?: Date;
}
```

### 4. Integration ⏳ TODO

**Task 12.4:** Integrate into posting workflow

**Files to Update:**
- `client/src/pages/quick-post.tsx`
- `client/src/pages/post-scheduling.tsx` (optional)

**Requirements:**
- Show prediction before posting
- Update prediction when title/time changes (debounced)
- Allow user to proceed despite low prediction
- Display prominently but not blocking

**Suggested Implementation:**
```tsx
import { PerformancePrediction } from '@/components/analytics/PerformancePrediction';

// In component:
const [title, setTitle] = useState('');
const [subreddit, setSubreddit] = useState('');
const [scheduledTime, setScheduledTime] = useState<Date>();

// Add to JSX:
{title && subreddit && (
  <PerformancePrediction
    subreddit={subreddit}
    title={title}
    scheduledTime={scheduledTime}
  />
)}
```

## Testing

### Manual Testing Checklist

- [ ] Test with various title lengths (short, optimal, long)
- [ ] Test with different posting times (peak vs off-peak)
- [ ] Test with subreddits user has history in
- [ ] Test with new subreddits (no history)
- [ ] Test tier restrictions (Free/Starter should get 403)
- [ ] Test error handling (invalid subreddit, network errors)
- [ ] Test UI responsiveness and loading states

### Example Test Cases

**High Score Test:**
- Subreddit: User's best performing subreddit
- Title: 50 characters with question mark
- Time: 7-9 PM on Thursday
- Expected: High/Viral level, 70+ score

**Low Score Test:**
- Subreddit: User's worst performing subreddit
- Title: 10 characters, all caps
- Time: 3 AM on Monday
- Expected: Low level, <45 score

## Documentation Updates

### Files Updated:
- ✅ `.kiro/specs/advanced-reddit-analytics/tasks.md` - Marked 12.1, 12.2, 12.3 complete
- ✅ `.kiro/steering/platform guide.md` - Added service documentation
- ✅ `QUICK_REFERENCE.md` - Added recent additions section

### Files to Update (when 12.4 complete):
- [ ] `docs/PLATFORM_OVERVIEW.md` - Add to features list
- [ ] `README.md` - Add to features section
- [ ] `CHANGELOG.md` - Add entry for QW-7

## Performance Considerations

- **Caching:** Predictions cached for 5 minutes server-side, 1 minute client-side
- **Database Queries:** Uses indexes on `reddit_post_outcomes` table
- **Rate Limiting:** Subject to standard analytics rate limits (100 req/min)
- **Computation:** All calculations are lightweight (no ML, no external APIs)

## Future Enhancements

1. **ML-Based Predictions** (Req 4, Phase 3)
   - Train XGBoost model on historical data
   - Use OpenRouter embeddings for image/title analysis
   - Provide probability distributions instead of single score

2. **A/B Testing**
   - Track prediction accuracy over time
   - Compare predicted vs actual performance
   - Refine scoring weights based on results

3. **Personalization**
   - Learn user's specific patterns
   - Adjust weights based on user's posting style
   - Custom suggestions based on user's weaknesses

4. **Real-time Updates**
   - WebSocket connection for live score updates
   - Update as user types title
   - Show score changes in real-time

## Related Tasks

- **QW-5:** Time badge indicators (uses same timing logic)
- **QW-6:** Subreddit health score (uses same health calculation)
- **QW-9:** Engagement heatmap (visualizes timing data)
- **Req 4:** ML predictions (future enhancement)

## References

- Design Doc: `.kiro/specs/advanced-reddit-analytics/design.md`
- Requirements: `.kiro/specs/advanced-reddit-analytics/requirements.md`
- Tasks: `.kiro/specs/advanced-reddit-analytics/tasks.md`
- Platform Guide: `.kiro/steering/platform guide.md`

---

**Next Steps:**
1. Complete task 12.4 - Integrate into quick-post.tsx
2. Test with real user data
3. Gather feedback on prediction accuracy
4. Iterate on scoring weights if needed
