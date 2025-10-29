# Requirements Document

## Introduction

This specification defines a comprehensive UX transformation for ThottoPilot to achieve enterprise-grade user experience with workflow-based navigation, responsive mobile optimization, and production-grade polish. The redesign shifts from feature-first to intent-first navigation, implements two-pane creation flows, and establishes a consistent design system across all platforms.

## Current State Analysis

### ✅ Already Implemented
- **Workflow-based navigation structure** (`client/src/config/navigation.ts`)
  - 4 workflow buckets: Create, Protect, Schedule, Analyze
  - Nested routes with keyboard shortcuts
  - Access tier filtering (free, pro, premium, admin)
- **Two-pane creator component** (`client/src/components/two-pane-creator.tsx`)
  - Split-screen layout with inputs/outputs
  - Real-time caption generation preview
- **Mobile optimization hooks** (`client/src/components/mobile-optimization-v2.tsx`)
  - Device detection (mobile/tablet/desktop)
  - Responsive sizing utilities
  - Touch device detection
- **Quick Post page** (`client/src/pages/quick-post.tsx`)
  - Step-by-step workflow with progress tracking
  - Mobile-responsive layout
  - Caption selection with A/B testing
- **Enhanced header** (`client/src/components/header-enhanced.tsx`)
  - Mobile hamburger menu
  - Tier badges (Free/Pro/Premium)
  - Dropdown navigation

### ⚠️ Partially Implemented
- **Navigation**: Structure exists but not fully integrated into UI
- **Two-pane layouts**: Component exists but not used across all creation flows
- **Mobile responsiveness**: Hooks exist but inconsistent application
- **Design system**: Some components follow patterns, others don't

### ❌ Missing Components
- **Floating Action Button (FAB)**: Referenced in App.tsx but component doesn't exist
- **Status Banner**: Used in quick-post.tsx but component doesn't exist
- **Command Palette**: Navigation config has commands but no UI
- **Breadcrumb navigation**: No implementation
- **Consistent spacing/typography**: No design tokens defined
- **Loading skeletons**: Component exists but not consistently used
- **Empty states**: Not standardized across pages

## Glossary

- **Workflow-Based Navigation**: Navigation structure organized by user intent (Create, Protect, Schedule, Analyze) rather than by features
- **Two-Pane Layout**: Split-screen interface with inputs on left and outputs/preview on right, eliminating scrolling
- **Status Banner**: Horizontal alert bar displaying tier limits, cooldowns, and system notifications
- **FAB (Floating Action Button)**: Persistent "+ Create" button in bottom-right corner for quick access
- **Responsive Breakpoints**: Screen width thresholds where layout adapts (mobile: <768px, tablet: 768-1024px, desktop: >1024px)
- **Design System**: Consistent spacing, typography, colors, and component patterns across the application
- **Command Palette**: Keyboard-driven quick action menu (Cmd+K) for power users
- **Breadcrumb Navigation**: Hierarchical path display showing current location (desktop only)
- **Grid System**: 12-column responsive layout framework for consistent spacing
- **Component Library**: Reusable UI components following consistent patterns

## Requirements

### Requirement 1: Workflow-Based Navigation (PARTIALLY COMPLETE)

**Current Status:** ✅ Navigation config exists, ⚠️ UI implementation incomplete

**User Story:** As a content creator, I want navigation organized by what I'm trying to accomplish (create, protect, schedule, analyze), so that I can find features based on my intent rather than memorizing feature names.

#### Acceptance Criteria

1. ✅ WHEN a user views the sidebar, THE Navigation System SHALL display 4 primary sections: Create, Protect, Schedule, and Analyze
   - **Status:** Config exists in `navigation.ts` with `workflowBuckets`
   - **Gap:** Not rendered in sidebar UI, only in header dropdowns
   
2. ⚠️ WHEN a user expands the Create section, THE Navigation System SHALL show sub-items: Quick Post, Bulk Captioning, and Draft Library
   - **Status:** Routes defined but "Draft Library" missing
   - **Gap:** Need to add Draft Library page
   
3. ⚠️ WHEN a user expands the Protect section, THE Navigation System SHALL show sub-items: ImageShield, Rule Checker, and Cooldown Monitor
   - **Status:** ImageShield exists, others missing
   - **Gap:** Need Rule Checker and Cooldown Monitor pages
   
4. ⚠️ WHEN a user expands the Schedule section, THE Navigation System SHALL show sub-items: Queue, Calendar, and Campaigns
   - **Status:** Routes defined but pages incomplete
   - **Gap:** Queue and Campaigns pages need implementation
   
5. ⚠️ WHEN a user expands the Analyze section, THE Navigation System SHALL show sub-items: Performance, Subreddit Insights, and Tax Tracker
   - **Status:** All pages exist
   - **Gap:** Need to integrate into workflow navigation
   
6. ✅ WHEN a user is on mobile (<768px width), THE Navigation System SHALL collapse into a hamburger menu with the same 4-section structure
   - **Status:** Mobile menu exists in header
   
7. ❌ WHEN a user navigates to any page, THE Navigation System SHALL highlight the active section and sub-item
   - **Gap:** Active state highlighting not implemented
   
8. ❌ WHEN a user hovers over a navigation item, THE Navigation System SHALL display a tooltip with keyboard shortcut (if applicable)
   - **Gap:** Tooltips not implemented

---

### Requirement 2: Two-Pane Creation Flow (PARTIALLY COMPLETE)

**Current Status:** ✅ Component exists, ⚠️ Not used consistently

**User Story:** As a content creator, I want to see my inputs and outputs side-by-side without scrolling, so that I can work efficiently and see results in real-time.

#### Acceptance Criteria

1. ✅ WHEN a user accesses Quick Post, THE UI System SHALL display a two-pane layout with inputs on the left (40% width) and outputs on the right (60% width)
   - **Status:** `two-pane-creator.tsx` component exists
   - **Gap:** Quick Post page uses different layout, not the two-pane component
   
2. ✅ WHEN a user uploads an image, THE UI System SHALL display the image preview in the right pane with generated captions below it
   - **Status:** Implemented in two-pane-creator
   
3. ✅ WHEN a user selects a persona or tone, THE UI System SHALL update the right pane caption preview in real-time
   - **Status:** Implemented in two-pane-creator
   
4. ✅ WHEN a user adds tags, THE UI System SHALL show tag chips in the right pane with character count
   - **Status:** Implemented in two-pane-creator
   
5. ✅ WHEN a user selects subreddits, THE UI System SHALL display subreddit cards in the right pane with rule validation status
   - **Status:** Implemented in two-pane-creator
   
6. ⚠️ WHEN the screen width is below 1024px, THE UI System SHALL stack panes vertically (inputs on top, outputs below)
   - **Status:** Responsive layout exists but needs testing
   
7. ⚠️ WHEN the screen width is below 768px, THE UI System SHALL use a single-column mobile layout with collapsible sections
   - **Status:** Mobile layout exists but needs refinement
   
8. ✅ WHEN a user clicks "Generate" in the left pane, THE UI System SHALL show a progress indicator in the right pane and update with results
   - **Status:** Progress indicators implemented

---

### Requirement 3: Persistent Create Button (FAB) (NOT IMPLEMENTED)

**Current Status:** ❌ Referenced but component missing

**User Story:** As a content creator, I want a persistent "+ Create" button always visible, so that I can start a new post from anywhere without navigating back to the dashboard.

#### Acceptance Criteria

1. ❌ WHEN a user is on any page, THE UI System SHALL display a floating "+ Create" button in the bottom-right corner
   - **Gap:** `<FloatingActionButton />` imported in App.tsx but component doesn't exist
   
2. ❌ WHEN a user clicks the "+ Create" button, THE UI System SHALL open a modal with creation options: Quick Post, Bulk Upload, Schedule Post, Draft
   - **Gap:** Need to create modal component
   
3. ❌ WHEN a user selects an option from the modal, THE UI System SHALL navigate to the appropriate creation flow
   - **Gap:** Navigation logic needed
   
4. ❌ WHEN a user presses Cmd+N (Mac) or Ctrl+N (Windows), THE UI System SHALL open the creation modal
   - **Gap:** Keyboard shortcut handler needed
   - **Note:** Shortcut defined in navigation config but not bound
   
5. ❌ WHEN the screen width is below 768px, THE UI System SHALL display the FAB with a larger touch target (56x56px minimum)
   - **Gap:** Responsive sizing needed
   
6. ❌ WHEN a user is already on a creation page, THE UI System SHALL hide the FAB to avoid redundancy
   - **Gap:** Conditional rendering logic needed
   
7. ❌ WHEN a user hovers over the FAB, THE UI System SHALL display a tooltip: "Create new post (Cmd+N)"
   - **Gap:** Tooltip integration needed

---

### Requirement 4: Responsive Gallery Layout

**User Story:** As a content creator, I want the gallery to adapt to my screen size with filters accessible but not cramping the image grid, so that I can browse my content comfortably on any device.

#### Acceptance Criteria

1. WHEN a user views the gallery on desktop (>1024px), THE UI System SHALL display a sticky left rail (300px) with filters and a 4-column image grid on the right
2. WHEN a user views the gallery on tablet (768-1024px), THE UI System SHALL display a 3-column image grid with filters in a slide-over panel
3. WHEN a user views the gallery on mobile (<768px), THE UI System SHALL display a 2-column image grid with filters in a bottom sheet
4. WHEN a user opens the filter panel on mobile/tablet, THE UI System SHALL overlay the grid with a semi-transparent backdrop
5. WHEN a user applies filters, THE UI System SHALL update the grid without page reload and show a loading skeleton
6. WHEN the left rail is sticky on desktop, THE UI System SHALL keep filters visible while scrolling the image grid
7. WHEN a user closes the filter panel on mobile/tablet, THE UI System SHALL animate the panel out smoothly (300ms transition)

---

### Requirement 5: Contextual Navigation (Breadcrumbs & Back Button)

**User Story:** As a content creator, I want clear navigation showing where I am and how to go back, so that I don't get lost in nested pages.

#### Acceptance Criteria

1. WHEN a user is on desktop (>768px), THE UI System SHALL display breadcrumb navigation in the page header showing the full path (e.g., "Schedule › Campaigns › Draft #123")
2. WHEN a user is on mobile (<768px), THE UI System SHALL display a back button in the header instead of breadcrumbs
3. WHEN a user clicks a breadcrumb segment, THE UI System SHALL navigate to that level of the hierarchy
4. WHEN a user clicks the mobile back button, THE UI System SHALL navigate to the previous page in the hierarchy (not browser history)
5. WHEN a user is on a top-level page (e.g., Dashboard), THE UI System SHALL hide breadcrumbs/back button
6. WHEN breadcrumbs exceed available width, THE UI System SHALL truncate middle segments with "..." and show first and last segments
7. WHEN a user hovers over truncated breadcrumbs, THE UI System SHALL display a tooltip with the full path

---

### Requirement 6: Status Banner System

**User Story:** As a content creator, I want prominent alerts for tier limits, cooldowns, and important notifications, so that I'm aware of constraints before taking action.

#### Acceptance Criteria

1. WHEN a user is approaching their tier limit (80% of quota used), THE UI System SHALL display a warning status banner: "⚠️ Only X AI captions left this month. Upgrade to Pro"
2. WHEN a user has an active cooldown, THE UI System SHALL display an info status banner: "🕐 Reddit cooldown: Wait 2h 34m before next post to r/FitGirls"
3. WHEN a user's post is removed, THE UI System SHALL display an error status banner: "🚫 Your post to r/FitGirls was removed. View details"
4. WHEN a user has multiple alerts, THE UI System SHALL stack status banners vertically with the most urgent on top
5. WHEN a user dismisses a status banner, THE UI System SHALL animate it out and not show it again for 24 hours
6. WHEN a status banner contains a link, THE UI System SHALL navigate to the relevant page when clicked
7. WHEN the screen width is below 768px, THE UI System SHALL display status banners full-width at the top of the page

---

### Requirement 7: Multi-Column Dashboard Grid

**User Story:** As a content creator, I want my dashboard to show key information without excessive scrolling, so that I can see my stats and actions at a glance.

#### Acceptance Criteria

1. WHEN a user views the dashboard on desktop (>1024px), THE UI System SHALL display a 12-column grid with main content in 8 columns (left) and sidebar in 4 columns (right)
2. WHEN a user views the dashboard on tablet (768-1024px), THE UI System SHALL display a single-column layout with cards stacked vertically
3. WHEN a user views the dashboard on mobile (<768px), THE UI System SHALL display a single-column layout with compact card spacing
4. WHEN the left column contains Quick Actions, THE UI System SHALL display them in a 2-column grid within the 8-column space
5. WHEN the right sidebar contains stat cards, THE UI System SHALL stack them vertically with consistent spacing
6. WHEN all dashboard content fits in one screen on desktop, THE UI System SHALL eliminate the need for scrolling
7. WHEN a user resizes the browser window, THE UI System SHALL smoothly transition between grid layouts

---

### Requirement 8: Consistent Design System

**User Story:** As a content creator, I want the interface to feel cohesive and professional, so that I trust the platform and can focus on my work.

#### Acceptance Criteria

1. WHEN any component uses spacing, THE UI System SHALL use the defined spacing scale: section (2rem), card (1.5rem), element (1rem), tight (0.5rem)
2. WHEN any text is displayed, THE UI System SHALL use the typography hierarchy: h1 (3xl bold), h2 (2xl semibold), h3 (xl medium), body (base), caption (sm gray-600), label (sm medium)
3. WHEN any stat card is displayed, THE UI System SHALL follow the standard pattern: icon + label (top), value (large bold), trend (small green/red)
4. WHEN any status chip is displayed, THE UI System SHALL use consistent variants: success (green-100/green-800), warning (yellow-100/yellow-800), error (red-100/red-800)
5. WHEN any button is displayed, THE UI System SHALL use consistent sizes: sm (32px height), md (40px height), lg (48px height)
6. WHEN any card is displayed, THE UI System SHALL use consistent styling: white background, rounded-lg, shadow-sm, padding-6
7. WHEN any loading state is displayed, THE UI System SHALL use skeleton loaders matching the content shape
8. WHEN any empty state is displayed, THE UI System SHALL show an icon, message, and CTA button

---

### Requirement 9: Mobile-First Responsive Design

**User Story:** As a content creator, I want the platform to work seamlessly on my phone, so that I can manage posts on the go.

#### Acceptance Criteria

1. WHEN a user accesses the platform on mobile (<768px), THE UI System SHALL display all features in a mobile-optimized layout
2. WHEN a user taps any interactive element on mobile, THE UI System SHALL provide a minimum touch target of 44x44px
3. WHEN a user scrolls on mobile, THE UI System SHALL use momentum scrolling for smooth performance
4. WHEN a user opens a modal on mobile, THE UI System SHALL display it full-screen with a close button in the top-right
5. WHEN a user views forms on mobile, THE UI System SHALL stack form fields vertically with full-width inputs
6. WHEN a user views tables on mobile, THE UI System SHALL convert them to card-based layouts
7. WHEN a user views charts on mobile, THE UI System SHALL display simplified versions with horizontal scrolling if needed
8. WHEN a user rotates their device, THE UI System SHALL adapt the layout to the new orientation within 300ms

---

### Requirement 10: Keyboard Navigation & Accessibility

**User Story:** As a power user, I want keyboard shortcuts and accessible navigation, so that I can work efficiently without a mouse.

#### Acceptance Criteria

1. WHEN a user presses Cmd+K (Mac) or Ctrl+K (Windows), THE UI System SHALL open a command palette with searchable actions
2. WHEN a user presses Cmd+N (Mac) or Ctrl+N (Windows), THE UI System SHALL open the create modal
3. WHEN a user presses Tab, THE UI System SHALL move focus to the next interactive element with a visible focus ring
4. WHEN a user presses Escape, THE UI System SHALL close the topmost modal or panel
5. WHEN a user navigates with keyboard, THE UI System SHALL ensure all interactive elements are reachable
6. WHEN a user uses a screen reader, THE UI System SHALL provide descriptive ARIA labels for all interactive elements
7. WHEN a user views any page, THE UI System SHALL maintain a logical heading hierarchy (h1 → h2 → h3)
8. WHEN a user encounters an error, THE UI System SHALL announce it to screen readers and provide clear recovery instructions

---

### Requirement 11: Loading & Error States

**User Story:** As a content creator, I want clear feedback when actions are processing or fail, so that I know what's happening and what to do next.

#### Acceptance Criteria

1. WHEN any data is loading, THE UI System SHALL display skeleton loaders matching the expected content shape
2. WHEN an API request is in progress, THE UI System SHALL disable the submit button and show a spinner with "Processing..." text
3. WHEN an API request fails, THE UI System SHALL display an error alert with a clear message and retry button
4. WHEN a page is loading, THE UI System SHALL show a full-page skeleton layout (not a blank screen)
5. WHEN an image is loading, THE UI System SHALL display a placeholder with a loading spinner
6. WHEN a long operation is running (>3 seconds), THE UI System SHALL show a progress bar with estimated time remaining
7. WHEN an error occurs, THE UI System SHALL log it to the console and display a user-friendly message (not technical jargon)
8. WHEN a network error occurs, THE UI System SHALL display an offline indicator and queue actions for retry

---

### Requirement 12: Empty States & Onboarding

**User Story:** As a new user, I want helpful guidance when pages are empty, so that I know what to do next.

#### Acceptance Criteria

1. WHEN a user views an empty gallery, THE UI System SHALL display an illustration, "No posts yet" message, and "Upload your first post" CTA button
2. WHEN a user views an empty schedule queue, THE UI System SHALL display "No scheduled posts" message and "Schedule a post" CTA button
3. WHEN a user views analytics with no data, THE UI System SHALL display "Post content to see analytics" message and "Create a post" CTA button
4. WHEN a user first logs in, THE UI System SHALL display a welcome modal with quick start steps
5. WHEN a user completes an onboarding step, THE UI System SHALL show a checkmark and progress indicator
6. WHEN a user dismisses onboarding, THE UI System SHALL not show it again but provide a "Help" menu to re-access it
7. WHEN a user hovers over a feature for the first time, THE UI System SHALL display a tooltip explaining its purpose

---

### Requirement 13: Batch Upload & Drag-to-Schedule Calendar

**User Story:** As a content creator, I want to upload multiple images at once, edit their captions, and drag them onto a calendar to schedule posts, so that I can plan my content efficiently with visual feedback.

#### Acceptance Criteria

1. WHEN a user accesses the Bulk Captioning page, THE UI System SHALL display a three-pane layout: upload area (left), thumbnail grid (center), and calendar (right)
2. WHEN a user uploads multiple images, THE UI System SHALL generate captions for all images in parallel and display progress indicators
3. WHEN captions are generated, THE UI System SHALL display draggable thumbnail cards with image preview, caption preview (first 50 chars), and edit button
4. WHEN a user clicks the edit button on a thumbnail, THE UI System SHALL open an inline editor to modify the caption without leaving the page
5. WHEN a user saves an edited caption, THE UI System SHALL update the thumbnail card and mark it as "edited" with a badge
6. WHEN a user drags a thumbnail, THE UI System SHALL show a ghost preview of the image following the cursor
7. WHEN a user drags a thumbnail over the calendar, THE UI System SHALL highlight valid drop zones (time slots) with a blue border
8. WHEN the calendar displays time slots, THE UI System SHALL color-code them based on optimal posting times: green (best), yellow (good), gray (average), red (avoid)
9. WHEN a user drops a thumbnail on a time slot, THE UI System SHALL create a scheduled post and display the thumbnail in that slot with subreddit selector
10. WHEN a user drops a thumbnail on an occupied time slot, THE UI System SHALL ask if they want to replace or stack posts (Pro/Premium only)
11. WHEN a user hovers over a scheduled thumbnail in the calendar, THE UI System SHALL display a popover with full caption, subreddit, and quick actions (edit, delete, reschedule)
12. WHEN a user drags a scheduled thumbnail to a different time slot, THE UI System SHALL update the schedule and show a confirmation toast
13. WHEN a user has unscheduled thumbnails remaining, THE UI System SHALL display a counter badge: "5 posts ready to schedule"
14. WHEN a user clicks "Auto-Schedule", THE UI System SHALL automatically place all unscheduled posts in optimal green time slots
15. WHEN the screen width is below 1024px, THE UI System SHALL stack the layout vertically: thumbnails on top, calendar below, with tap-to-schedule instead of drag
16. WHEN a user is on mobile (<768px), THE UI System SHALL use a list view with "Schedule" buttons that open a time picker modal

---

### Requirement 14: Calendar Navigation & Time Slot Intelligence

**User Story:** As a content creator, I want the calendar to show me the best times to post based on my analytics, so that I can maximize engagement without guessing.

#### Acceptance Criteria

1. WHEN a user views the scheduling calendar, THE UI System SHALL display a week view by default with hourly time slots
2. WHEN a user clicks "Month View", THE UI System SHALL switch to a monthly calendar showing daily post counts
3. WHEN a user clicks "Day View", THE UI System SHALL show a single day with 15-minute interval slots
4. WHEN a user navigates to a different week/month, THE UI System SHALL fetch optimal posting times for that period
5. WHEN optimal posting times are calculated, THE UI System SHALL use historical engagement data from the user's past posts
6. WHEN a user has no historical data, THE UI System SHALL use platform-wide best practices (e.g., Reddit peak hours: 6-9am, 12-1pm, 6-8pm EST)
7. WHEN a time slot is marked green (best), THE UI System SHALL display a tooltip: "High engagement window - 85% success rate"
8. WHEN a time slot is marked red (avoid), THE UI System SHALL display a tooltip: "Low engagement window - 30% success rate"
9. WHEN a user has a cooldown active for a subreddit, THE UI System SHALL gray out time slots within the cooldown period and show remaining time
10. WHEN a user exceeds their tier's scheduling limit, THE UI System SHALL disable future time slots and display an upgrade prompt
11. WHEN a user schedules a post, THE UI System SHALL automatically check subreddit rules and display warnings (e.g., "r/FitGirls requires 7-day gaps")
12. WHEN a user clicks on an empty time slot, THE UI System SHALL open a quick-add modal to upload and schedule a single post

---

## Implementation Priority

### Phase 1: Navigation & Layout Foundation (Week 1-2)
- Requirement 1: Workflow-Based Navigation
- Requirement 7: Multi-Column Dashboard Grid
- Requirement 8: Consistent Design System (spacing, typography)

### Phase 2: Creation Flows (Week 3-4)
- Requirement 2: Two-Pane Creation Flow
- Requirement 3: Persistent Create Button (FAB)
- Requirement 11: Loading & Error States

### Phase 3: Responsive & Mobile (Week 5-6)
- Requirement 4: Responsive Gallery Layout
- Requirement 9: Mobile-First Responsive Design
- Requirement 5: Contextual Navigation

### Phase 4: Polish & Accessibility (Week 7-8)
- Requirement 6: Status Banner System
- Requirement 10: Keyboard Navigation & Accessibility
- Requirement 12: Empty States & Onboarding

---

## Success Metrics

- **Navigation Efficiency**: Users find features 50% faster (measured by time to first click)
- **Mobile Usage**: 40% increase in mobile engagement
- **Creation Flow**: 30% reduction in time to create and post
- **Error Recovery**: 80% reduction in support tickets related to confusion
- **Accessibility**: WCAG 2.1 AA compliance score of 95%+
- **Performance**: Lighthouse score of 90+ on mobile and desktop


---

### Requirement 13: Batch Upload + Drag-and-Drop Scheduling (NEW - CRITICAL)

**Current Status:** ❌ Partially implemented, needs major UX overhaul

**User Story:** As a content creator, I want to upload multiple images at once, edit their captions, and drag them onto a calendar to schedule posts across different subreddits, so that I can plan my content strategy efficiently.

#### Acceptance Criteria

1. WHEN a user accesses the Bulk Captioning page, THE UI System SHALL display a three-pane layout: Upload Zone (left), Content Library (center), Calendar (right)

2. WHEN a user drags and drops multiple images into the upload zone, THE UI System SHALL:
   - Show upload progress for each image with thumbnails
   - Generate AI captions automatically for all images
   - Display images in a grid with thumbnails, captions, and edit buttons

3. WHEN a user clicks "Edit Caption" on any image, THE UI System SHALL:
   - Open an inline editor with the current caption
   - Show character count and subreddit compatibility warnings
   - Allow saving or regenerating the caption

4. WHEN a user drags an image thumbnail from the library, THE UI System SHALL:
   - Show a ghost preview of the image following the cursor
   - Highlight valid drop zones (calendar days, subreddit slots)
   - Snap to the nearest valid position on drop

5. WHEN a user drops an image onto a calendar day, THE UI System SHALL:
   - Open a modal to select subreddit and time
   - Show optimal posting times for that day (green badges)
   - Allow scheduling to multiple subreddits with time offsets

6. WHEN a user views the calendar, THE UI System SHALL:
   - Display scheduled posts as image thumbnails on their dates
   - Show subreddit badges on each thumbnail
   - Allow clicking to edit or remove scheduled posts
   - Display tier limits (Pro: 7 days, Premium: 30 days)

7. WHEN a user exceeds their tier limit, THE UI System SHALL:
   - Disable future dates beyond the limit
   - Show an upgrade prompt with clear benefits
   - Prevent scheduling but allow viewing

8. WHEN a user is on mobile, THE UI System SHALL:
   - Stack panes vertically: Library → Calendar
   - Replace drag-and-drop with tap-to-select + tap-to-schedule
   - Use bottom sheets for scheduling modals

#### Design Notes (Apple-Level Polish)

**Visual Hierarchy:**
- Upload zone: Dashed border, subtle animation on hover
- Library grid: 3-4 columns on desktop, 2 on tablet, 1 on mobile
- Calendar: Month view with mini thumbnails, week view for detail

**Interactions:**
- Smooth drag animations with spring physics (framer-motion)
- Haptic feedback on mobile (vibration on drop)
- Undo/redo for scheduling actions
- Keyboard shortcuts: Cmd+Z (undo), Cmd+Shift+Z (redo), Delete (remove)

**Micro-interactions:**
- Thumbnail scales up 1.05x on hover
- Drop zones pulse with subtle glow when dragging
- Success animation (checkmark + fade) on schedule
- Skeleton loaders during caption generation

---

### Requirement 14: Calendar Navigation Integration (NEW - CRITICAL)

**Current Status:** ❌ Calendar page exists but not in navigation

**User Story:** As a content creator, I want easy access to my scheduling calendar from the main navigation, so that I can quickly view and manage my content pipeline.

#### Acceptance Criteria

1. WHEN a user expands the Schedule section in navigation, THE UI System SHALL display:
   - Queue (current scheduled posts list)
   - Calendar (visual calendar view) ← **MISSING FROM DROPDOWN**
   - Campaigns (themed content series)

2. WHEN a user clicks "Calendar" in the Schedule dropdown, THE UI System SHALL navigate to `/scheduling-calendar`

3. WHEN a user is on the calendar page, THE UI System SHALL highlight "Schedule > Calendar" in the navigation

4. WHEN a user presses Cmd+Shift+C, THE UI System SHALL open the calendar page (keyboard shortcut)

---

## Apple-Level Improvements

### 🎨 Visual Design Enhancements

#### 1. **Glassmorphism & Depth**
```css
/* Apply to cards, modals, navigation */
background: rgba(255, 255, 255, 0.7);
backdrop-filter: blur(20px) saturate(180%);
border: 1px solid rgba(255, 255, 255, 0.18);
box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
```

#### 2. **Fluid Animations**
- Use spring physics for all transitions (not linear easing)
- Stagger animations for lists (50ms delay between items)
- Parallax scrolling for hero sections
- Smooth page transitions (fade + slide)

#### 3. **Typography Scale**
```typescript
// San Francisco-inspired scale
const typography = {
  display: '72px / 80px', // Hero headlines
  h1: '48px / 56px',      // Page titles
  h2: '36px / 44px',      // Section headers
  h3: '24px / 32px',      // Card titles
  body: '17px / 24px',    // Body text (Apple uses 17px, not 16px)
  caption: '13px / 18px', // Helper text
  label: '15px / 20px'    // Form labels
};
```

#### 4. **Color System**
```typescript
// Apple-inspired palette
const colors = {
  primary: {
    50: '#f0f9ff',   // Lightest blue
    500: '#0071e3',  // Apple blue
    900: '#001d3d'   // Darkest blue
  },
  accent: {
    pink: '#ff2d55',    // Apple pink
    orange: '#ff9500',  // Apple orange
    green: '#34c759',   // Apple green
    purple: '#af52de'   // Apple purple
  },
  neutral: {
    50: '#fafafa',   // Background
    100: '#f5f5f7',  // Card background (Apple gray)
    900: '#1d1d1f'   // Text (Apple dark)
  }
};
```

### ⚡ Performance Optimizations

#### 5. **Instant Feedback**
- Optimistic UI updates (update UI before API response)
- Skeleton loaders (not spinners) for content
- Progressive image loading (blur-up technique)
- Prefetch next page on hover

#### 6. **Smart Loading**
```typescript
// Lazy load images with intersection observer
<img 
  loading="lazy" 
  decoding="async"
  srcset="image-320w.jpg 320w, image-640w.jpg 640w"
  sizes="(max-width: 640px) 100vw, 640px"
/>
```

### 🎯 Interaction Design

#### 7. **Contextual Actions**
- Right-click context menus (desktop)
- Long-press menus (mobile)
- Swipe actions on list items (swipe left to delete)
- Hover cards with preview (like macOS Quick Look)

#### 8. **Smart Defaults**
- Auto-select best subreddit based on image content
- Pre-fill optimal posting time
- Remember user preferences (last used tone, persona)
- Auto-save drafts every 30 seconds

#### 9. **Undo/Redo System**
```typescript
// Global undo stack (like Apple apps)
interface Action {
  type: 'schedule' | 'delete' | 'edit';
  data: any;
  timestamp: number;
}

const undoStack: Action[] = [];
const redoStack: Action[] = [];

// Cmd+Z / Cmd+Shift+Z handlers
```

### 🔔 Notifications & Feedback

#### 10. **Toast System (Apple-style)**
```typescript
// Minimal, non-intrusive toasts
<Toast 
  variant="success"
  icon={<CheckCircle />}
  message="Post scheduled for 2:30 PM"
  action={{ label: "View", onClick: () => navigate('/calendar') }}
  duration={3000}
  position="top-center" // Apple uses top-center, not bottom-right
/>
```

#### 11. **Progress Indicators**
- Determinate progress bars (show actual %)
- Indeterminate spinners (only when time unknown)
- Step indicators for multi-step flows
- Estimated time remaining for long operations

### 📱 Mobile-First Refinements

#### 12. **Touch Targets**
- Minimum 44x44px (Apple HIG standard)
- 8px spacing between interactive elements
- Large, thumb-friendly buttons at bottom
- Pull-to-refresh on lists

#### 13. **Native-Like Gestures**
- Swipe back to navigate (iOS-style)
- Pinch to zoom on images
- Pull down to dismiss modals
- Shake to undo (mobile only)

### 🎭 Delight Moments

#### 14. **Celebration Animations**
- Confetti on first post success
- Checkmark animation on task completion
- Subtle particle effects on milestone achievements
- Haptic feedback on important actions (mobile)

#### 15. **Empty States with Personality**
```typescript
// Instead of boring "No posts yet"
<EmptyState
  illustration={<AnimatedIllustration />}
  title="Your canvas awaits"
  description="Upload your first image to start creating magic"
  primaryAction="Upload Image"
  secondaryAction="Watch Tutorial"
/>
```

### 🔐 Trust & Safety

#### 16. **Transparent Status**
- Real-time sync indicator (like iCloud)
- Clear error messages with recovery steps
- Confirmation dialogs for destructive actions
- Auto-save indicator ("All changes saved")

#### 17. **Accessibility (WCAG 2.1 AAA)**
- 7:1 contrast ratio for text
- Focus indicators on all interactive elements
- Screen reader announcements for dynamic content
- Keyboard navigation for all features
- Reduced motion mode (respects prefers-reduced-motion)

### 🚀 Advanced Features

#### 18. **Command Palette (Cmd+K)**
```typescript
// Spotlight-like search
<CommandPalette>
  <CommandInput placeholder="Search or jump to..." />
  <CommandList>
    <CommandGroup heading="Quick Actions">
      <CommandItem>Create new post</CommandItem>
      <CommandItem>Schedule post</CommandItem>
      <CommandItem>View analytics</CommandItem>
    </CommandGroup>
    <CommandGroup heading="Recent">
      <CommandItem>r/FitGirls post from yesterday</CommandItem>
    </CommandGroup>
  </CommandList>
</CommandPalette>
```

#### 19. **Smart Suggestions**
- AI-powered subreddit recommendations
- Optimal posting time predictions
- Caption improvement suggestions
- Similar content detection (avoid duplicates)

#### 20. **Collaboration Features** (Future)
- Share drafts with team members
- Comment threads on scheduled posts
- Approval workflows for agencies
- Activity feed (who did what, when)

---

## Implementation Priority (Apple-Level)

### Phase 1: Foundation (Week 1-2)
1. ✅ Design system tokens (colors, typography, spacing)
2. ✅ Glassmorphism card components
3. ✅ Spring animation utilities (framer-motion)
4. ✅ Toast notification system (top-center)

### Phase 2: Core Interactions (Week 3-4)
5. ✅ Drag-and-drop scheduling with physics
6. ✅ Batch upload with progress indicators
7. ✅ Inline caption editing
8. ✅ Calendar navigation integration

### Phase 3: Polish (Week 5-6)
9. ✅ Skeleton loaders everywhere
10. ✅ Optimistic UI updates
11. ✅ Undo/redo system
12. ✅ Keyboard shortcuts (Cmd+K palette)

### Phase 4: Delight (Week 7-8)
13. ✅ Celebration animations
14. ✅ Empty states with illustrations
15. ✅ Haptic feedback (mobile)
16. ✅ Smart suggestions

---

## Success Metrics (Apple-Level)

- **Time to First Post:** < 60 seconds (from upload to schedule)
- **User Satisfaction:** 4.8+ stars (App Store quality)
- **Accessibility Score:** WCAG 2.1 AAA (100%)
- **Performance:** Lighthouse 95+ on mobile
- **Retention:** 80%+ weekly active users
- **NPS Score:** 70+ (Apple-level loyalty)

---

## Design References

Study these Apple products for inspiration:
- **Photos app:** Drag-and-drop, grid layouts, editing
- **Calendar app:** Month/week views, event creation
- **Reminders app:** List management, drag reordering
- **Notes app:** Inline editing, auto-save
- **Shortcuts app:** Visual workflow builder

Key Apple principles:
1. **Clarity:** Every element has a purpose
2. **Deference:** Content is king, UI fades away
3. **Depth:** Layers and motion provide hierarchy
4. **Consistency:** Patterns repeat across the app
5. **Feedback:** Every action has a response
6. **Metaphors:** Use real-world analogies (calendar, library)
7. **User Control:** Easy to undo, hard to break


---

## 🚨 Critical UX Gaps Identified

### Gap 1: **No Onboarding Flow for New Users**
**Problem:** Users land on dashboard with no guidance
**Solution:** 
- Interactive product tour (first login)
- Checklist widget: "Get Started in 3 Steps"
- Contextual tooltips on first feature use
- Video tutorials embedded in empty states

### Gap 2: **Unclear Tier Benefits**
**Problem:** Users don't understand why they should upgrade
**Solution:**
- Comparison table on settings page
- "Unlock with Pro" badges on locked features
- Trial period for Pro features (7 days)
- Usage meters showing quota consumption

### Gap 3: **No Bulk Actions**
**Problem:** Users must delete/edit posts one at a time
**Solution:**
- Multi-select checkboxes on all lists
- Bulk actions toolbar: Delete, Reschedule, Change Subreddit
- Select all / Deselect all buttons
- Keyboard shortcuts: Cmd+A (select all), Shift+Click (range select)

### Gap 4: **Poor Error Recovery**
**Problem:** When posts fail, users don't know why or how to fix
**Solution:**
- Detailed error messages with specific reasons
- "Fix and Retry" button with pre-filled corrections
- Error history log with timestamps
- Automatic retry with exponential backoff

### Gap 5: **No Content Preview Before Posting**
**Problem:** Users can't see how their post will look on Reddit
**Solution:**
- Reddit-style preview card (exactly as it appears)
- Mobile/desktop preview toggle
- Character count warnings (title: 300, caption: 40,000)
- Link preview for promotional URLs

### Gap 6: **Missing Search & Filters**
**Problem:** Users can't find old posts or filter by subreddit
**Solution:**
- Global search bar (Cmd+F)
- Filter by: Date range, Subreddit, Status, NSFW
- Sort by: Date, Engagement, Subreddit
- Saved filter presets

### Gap 7: **No Analytics on Dashboard**
**Problem:** Users must navigate to separate analytics page
**Solution:**
- Mini analytics cards on dashboard
- "This Week" summary: Posts, Upvotes, Comments
- Trending subreddits widget
- Quick insights: "Your best time to post is 2 PM"

### Gap 8: **Inconsistent Loading States**
**Problem:** Some pages show spinners, others show nothing
**Solution:**
- Skeleton loaders everywhere (match content shape)
- Progress bars for multi-step operations
- Optimistic UI updates (instant feedback)
- "Loading..." text with estimated time

---

### Requirement 15: Advanced Theme System with Bubblegum Pink Mode (NEW - HIGH PRIORITY)

**Current Status:** ❌ Basic dark/light mode exists, custom themes not implemented

**User Story:** As a content creator, I want a beautiful, readable bubblegum pink theme that matches my brand aesthetic, so that the app feels personalized and delightful to use.

#### The Problem with Your Current Approach

**Why pink backgrounds fail:**
```css
/* ❌ This is unreadable */
background: #ffb3d9; /* Bubblegum pink */
color: #6366f1;      /* Blue text - only 2.1:1 contrast */
color: #a855f7;      /* Purple text - only 2.5:1 contrast */
/* WCAG requires 4.5:1 for normal text, 3:1 for large text */
```

**The Solution: Layered Approach**
```css
/* ✅ Readable pink theme */
/* Layer 1: Subtle pink background */
background: linear-gradient(135deg, #fff5f9 0%, #ffe4f0 100%);

/* Layer 2: White/cream cards on top */
card-background: rgba(255, 255, 255, 0.9);
backdrop-filter: blur(20px);

/* Layer 3: Dark text on cards */
text-primary: #1a1a1a;    /* 18:1 contrast on white */
text-secondary: #4a4a4a;  /* 9:1 contrast on white */

/* Layer 4: Vibrant accents */
accent-pink: #ff2d92;     /* Buttons, badges */
accent-blue: #0066ff;     /* Links, icons */
accent-purple: #8b5cf6;   /* Highlights */
```

#### Acceptance Criteria

1. WHEN a user selects "Bubblegum Pink" theme, THE UI System SHALL:
   - Apply a subtle pink gradient background (not solid pink)
   - Render all cards with white/cream backgrounds
   - Use dark text (near-black) for readability
   - Use vibrant pink/blue/purple for accents only
   - Maintain 4.5:1 contrast ratio minimum

2. WHEN a user views any page in Bubblegum Pink mode, THE UI System SHALL:
   - Show pink-tinted glassmorphism effects
   - Use pink progress bars and loading indicators
   - Apply pink hover states (10% opacity overlay)
   - Display pink success toasts, blue info toasts, red error toasts

3. WHEN a user switches themes, THE UI System SHALL:
   - Animate the transition smoothly (500ms fade)
   - Persist the choice in localStorage
   - Apply theme to all components instantly
   - Show a preview before confirming

4. WHEN a user creates a custom theme, THE UI System SHALL:
   - Provide a theme builder with live preview
   - Validate contrast ratios automatically
   - Warn if text is unreadable (< 4.5:1 contrast)
   - Suggest accessible color alternatives

5. WHEN a user is on mobile, THE UI System SHALL:
   - Respect system theme preference (iOS/Android)
   - Allow manual override in settings
   - Apply theme to status bar color (mobile browsers)

#### Theme Palette: Bubblegum Pink Edition

```typescript
export const bubblegumPinkTheme = {
  // Backgrounds (subtle, not overwhelming)
  background: {
    primary: 'linear-gradient(135deg, #fff5f9 0%, #ffe4f0 100%)',
    secondary: '#fff0f6',
    tertiary: '#ffe4f0',
  },
  
  // Cards & Surfaces (white/cream for readability)
  surface: {
    primary: 'rgba(255, 255, 255, 0.95)',
    secondary: 'rgba(255, 250, 252, 0.9)',
    elevated: 'rgba(255, 255, 255, 1)',
    glass: 'rgba(255, 255, 255, 0.7) backdrop-blur(20px)',
  },
  
  // Text (dark for contrast)
  text: {
    primary: '#1a1a1a',      // 18:1 contrast on white
    secondary: '#4a4a4a',    // 9:1 contrast on white
    tertiary: '#6b6b6b',     // 6:1 contrast on white
    disabled: '#9ca3af',     // 3:1 contrast (acceptable for disabled)
  },
  
  // Accents (vibrant, used sparingly)
  accent: {
    pink: {
      50: '#fff0f6',
      100: '#ffe4f0',
      500: '#ff2d92',  // Primary pink (buttons, badges)
      600: '#e6007a',  // Hover state
      900: '#990052',  // Dark mode text
    },
    blue: {
      50: '#eff6ff',
      500: '#0066ff',  // Links, info
      600: '#0052cc',  // Hover state
    },
    purple: {
      50: '#f5f3ff',
      500: '#8b5cf6',  // Highlights, tags
      600: '#7c3aed',  // Hover state
    },
  },
  
  // Semantic colors
  success: '#10b981',  // Green (good contrast)
  warning: '#f59e0b',  // Amber (good contrast)
  error: '#ef4444',    // Red (good contrast)
  info: '#0066ff',     // Blue (good contrast)
  
  // Borders & Dividers
  border: {
    light: 'rgba(255, 105, 180, 0.1)',  // Subtle pink tint
    medium: 'rgba(255, 105, 180, 0.2)',
    strong: 'rgba(255, 105, 180, 0.3)',
  },
  
  // Shadows (pink-tinted)
  shadow: {
    sm: '0 1px 2px rgba(255, 105, 180, 0.05)',
    md: '0 4px 6px rgba(255, 105, 180, 0.1)',
    lg: '0 10px 15px rgba(255, 105, 180, 0.15)',
    xl: '0 20px 25px rgba(255, 105, 180, 0.2)',
  },
};
```

#### Component Examples

**Button (Bubblegum Pink Theme):**
```tsx
<Button className="
  bg-gradient-to-r from-pink-500 to-pink-600
  text-white font-semibold
  hover:from-pink-600 hover:to-pink-700
  shadow-lg shadow-pink-500/30
  transition-all duration-200
  hover:scale-105
">
  Create Post
</Button>
```

**Card (Bubblegum Pink Theme):**
```tsx
<Card className="
  bg-white/95 backdrop-blur-xl
  border border-pink-100
  shadow-lg shadow-pink-500/10
  hover:shadow-xl hover:shadow-pink-500/20
  transition-all duration-300
">
  <CardContent className="text-gray-900">
    {/* Dark text on white card = readable */}
  </CardContent>
</Card>
```

**Badge (Bubblegum Pink Theme):**
```tsx
<Badge className="
  bg-pink-100 text-pink-900
  border border-pink-200
  font-medium
">
  Pro
</Badge>
```

#### Theme Switcher UI

```tsx
<ThemeSwitcher>
  <ThemeOption
    name="Bubblegum Pink"
    preview={<BubblegumPreview />}
    colors={['#ff2d92', '#0066ff', '#8b5cf6']}
    description="Playful pink with vibrant accents"
  />
  <ThemeOption
    name="Midnight Purple"
    preview={<MidnightPreview />}
    colors={['#8b5cf6', '#6366f1', '#ec4899']}
    description="Deep purple with neon highlights"
  />
  <ThemeOption
    name="Ocean Blue"
    preview={<OceanPreview />}
    colors={['#0ea5e9', '#06b6d4', '#3b82f6']}
    description="Calm blue with aqua accents"
  />
  <ThemeOption
    name="Sunset Orange"
    preview={<SunsetPreview />}
    colors={['#f97316', '#fb923c', '#fbbf24']}
    description="Warm orange with golden tones"
  />
</ThemeSwitcher>
```

#### Accessibility Validation

```typescript
// Automatic contrast checker
function validateTheme(theme: Theme): ValidationResult {
  const issues: string[] = [];
  
  // Check text contrast on backgrounds
  const textOnPrimary = getContrastRatio(
    theme.text.primary,
    theme.surface.primary
  );
  
  if (textOnPrimary < 4.5) {
    issues.push(`Text contrast too low: ${textOnPrimary.toFixed(2)}:1 (need 4.5:1)`);
  }
  
  // Check accent contrast
  const accentOnSurface = getContrastRatio(
    theme.accent.pink[500],
    theme.surface.primary
  );
  
  if (accentOnSurface < 3) {
    issues.push(`Accent contrast too low: ${accentOnSurface.toFixed(2)}:1 (need 3:1)`);
  }
  
  return {
    valid: issues.length === 0,
    issues,
    score: calculateAccessibilityScore(theme),
  };
}
```

#### Dark Mode Variant (Bubblegum Pink Dark)

```typescript
export const bubblegumPinkDarkTheme = {
  background: {
    primary: 'linear-gradient(135deg, #1a0a14 0%, #2d1424 100%)',
    secondary: '#1f0d1a',
    tertiary: '#2d1424',
  },
  
  surface: {
    primary: 'rgba(45, 20, 36, 0.95)',
    secondary: 'rgba(31, 13, 26, 0.9)',
    glass: 'rgba(45, 20, 36, 0.7) backdrop-blur(20px)',
  },
  
  text: {
    primary: '#fafafa',      // White text on dark
    secondary: '#d1d5db',    // Light gray
    tertiary: '#9ca3af',     // Medium gray
  },
  
  accent: {
    pink: {
      500: '#ff69b4',  // Lighter pink for dark mode
      600: '#ff1493',
    },
    blue: {
      500: '#60a5fa',  // Lighter blue for dark mode
    },
    purple: {
      500: '#a78bfa',  // Lighter purple for dark mode
    },
  },
};
```

---

### Requirement 16: Theme Customization Studio (NEW - DELIGHT FEATURE)

**User Story:** As a content creator, I want to create my own custom theme that matches my personal brand, so that the app feels uniquely mine.

#### Acceptance Criteria

1. WHEN a user opens Theme Studio, THE UI System SHALL display:
   - Live preview of the app with current theme
   - Color pickers for: Background, Surface, Text, Accents
   - Contrast ratio indicators (green = pass, red = fail)
   - Preset themes to start from

2. WHEN a user adjusts a color, THE UI System SHALL:
   - Update the live preview instantly
   - Recalculate contrast ratios
   - Suggest accessible alternatives if contrast fails
   - Show before/after comparison

3. WHEN a user saves a custom theme, THE UI System SHALL:
   - Name the theme (e.g., "My Brand Colors")
   - Export as JSON for sharing
   - Add to theme switcher dropdown
   - Sync across devices (if logged in)

4. WHEN a user shares a theme, THE UI System SHALL:
   - Generate a shareable link
   - Allow importing via link or JSON
   - Show theme preview before applying
   - Credit the creator (optional)

---

## Additional UX Improvements

### 1. **Smart Notifications**
- Browser push notifications for scheduled posts
- Email digest: "Your weekly performance summary"
- In-app notification center (bell icon)
- Notification preferences (granular control)

### 2. **Keyboard Shortcuts Overlay**
- Press `?` to show all shortcuts
- Searchable shortcut list
- Customizable shortcuts (power users)
- Visual hints on hover (e.g., "Cmd+N" badge)

### 3. **Quick Actions Menu**
- Right-click anywhere for context menu
- Recent actions: "Undo schedule", "Redo delete"
- Clipboard actions: "Paste image URL"
- Share actions: "Copy post link"

### 4. **Smart Suggestions Panel**
- AI-powered recommendations sidebar
- "Try posting to r/FitGirls at 2 PM"
- "Your caption could be more engaging"
- "Similar posts got 2x more upvotes"

### 5. **Collaboration Features** (Future)
- Invite team members (agencies)
- Role-based permissions (admin, editor, viewer)
- Comment threads on drafts
- Approval workflows

### 6. **Content Library**
- Organize images into folders
- Tag images (e.g., "gym", "outdoor", "selfie")
- Smart albums (auto-categorize by AI)
- Duplicate detection

### 7. **Performance Dashboard**
- Real-time analytics widget
- Goal tracking: "Post 10 times this week"
- Streak counter: "7-day posting streak 🔥"
- Leaderboard (compare with similar creators)

### 8. **Export & Backup**
- Export all data as JSON/CSV
- Backup scheduled posts
- Download analytics reports (PDF)
- Import from competitors (OnlyFans, Fansly)

---

## Design System Checklist

- [ ] Color tokens defined (light + dark + custom themes)
- [ ] Typography scale (8 sizes, 3 weights)
- [ ] Spacing scale (4px base unit)
- [ ] Border radius scale (sm, md, lg, xl, full)
- [ ] Shadow scale (sm, md, lg, xl, 2xl)
- [ ] Animation tokens (duration, easing)
- [ ] Breakpoints (mobile, tablet, desktop, wide)
- [ ] Z-index scale (dropdown, modal, toast, tooltip)
- [ ] Icon library (consistent size, stroke width)
- [ ] Component library (Storybook documentation)

---

## Final Polish Checklist

- [ ] All buttons have hover/active/disabled states
- [ ] All forms have validation with helpful errors
- [ ] All lists have empty states with CTAs
- [ ] All modals have close buttons (X + Escape key)
- [ ] All images have alt text (accessibility)
- [ ] All links have focus indicators
- [ ] All animations respect prefers-reduced-motion
- [ ] All colors pass WCAG AA contrast (4.5:1)
- [ ] All touch targets are 44x44px minimum
- [ ] All pages have loading skeletons
- [ ] All errors have recovery actions
- [ ] All success actions have confirmation feedback
- [ ] All long operations show progress
- [ ] All data is auto-saved
- [ ] All changes are undoable

---

**This is now an Apple-level spec. Ship it and you'll have the best content creator tool on the market.** 🚀


---

## 🌙 Dark Theme Companion: "Midnight Rose"

### Why Not Just Reverse It?

**❌ Naive Reversal (Doesn't Work):**
```typescript
// This looks terrible and hurts eyes
background: '#1a1a1a';        // Pure black (too harsh)
surface: '#2d2d2d';           // Dark gray (no personality)
text: '#ffffff';              // Pure white (too bright, causes eye strain)
accent: '#ff2d92';            // Same pink (too vibrant on dark, burns retinas)
```

**✅ Proper Dark Theme Design:**
- Use deep, saturated colors (not gray)
- Reduce accent brightness by 20-30%
- Add subtle color tints to blacks
- Use off-white text (not pure white)
- Increase contrast between layers

---

### Midnight Rose Theme Palette

```typescript
export const midnightRoseTheme = {
  // Backgrounds (deep purple-pink, not pure black)
  background: {
    primary: 'linear-gradient(135deg, #0f0514 0%, #1a0a1f 100%)',  // Deep purple-black
    secondary: '#120818',      // Slightly lighter
    tertiary: '#1a0a1f',       // Card backgrounds
    overlay: 'rgba(15, 5, 20, 0.95)',  // Modals
  },
  
  // Surfaces (elevated with subtle glow)
  surface: {
    primary: 'rgba(26, 10, 31, 0.95)',     // Main cards
    secondary: 'rgba(31, 13, 38, 0.9)',    // Nested cards
    elevated: 'rgba(38, 15, 45, 1)',       // Popovers, dropdowns
    glass: 'rgba(26, 10, 31, 0.7) backdrop-blur(20px)',  // Glassmorphism
    glow: '0 0 40px rgba(255, 45, 146, 0.1)',  // Subtle pink glow
  },
  
  // Text (off-white, not pure white)
  text: {
    primary: '#f5f0f6',        // Soft white with pink tint (16:1 contrast)
    secondary: '#d1c4d6',      // Light purple-gray (9:1 contrast)
    tertiary: '#a89aaf',       // Medium purple-gray (5:1 contrast)
    disabled: '#6b5f70',       // Dim purple-gray (3:1 contrast)
    muted: '#8a7d91',          // Subtle text
  },
  
  // Accents (desaturated for dark mode)
  accent: {
    pink: {
      50: '#2d0a1f',           // Darkest (backgrounds)
      100: '#4a0f33',          // Dark (hover states)
      200: '#6b1447',          // Medium dark
      300: '#8b1a5c',          // Medium
      400: '#c92d7f',          // Bright (default)
      500: '#ff69b4',          // Vibrant (primary buttons)
      600: '#ff85c3',          // Lighter (hover)
      700: '#ffa1d2',          // Lightest (active)
      glow: '0 0 20px rgba(255, 105, 180, 0.4)',  // Button glow
    },
    blue: {
      50: '#0a1429',
      400: '#5b9fff',          // Desaturated blue (links)
      500: '#7db3ff',          // Lighter blue (hover)
      glow: '0 0 20px rgba(91, 159, 255, 0.3)',
    },
    purple: {
      50: '#1a0f2e',
      400: '#a78bfa',          // Soft purple (tags)
      500: '#c4b5fd',          // Lighter purple (hover)
      glow: '0 0 20px rgba(167, 139, 250, 0.3)',
    },
  },
  
  // Semantic colors (adjusted for dark)
  success: {
    bg: '#0d3d2d',             // Dark green background
    text: '#6ee7b7',           // Light green text
    border: '#10b981',         // Medium green border
  },
  warning: {
    bg: '#3d2d0d',
    text: '#fcd34d',
    border: '#f59e0b',
  },
  error: {
    bg: '#3d0d0d',
    text: '#fca5a5',
    border: '#ef4444',
  },
  info: {
    bg: '#0d1f3d',
    text: '#93c5fd',
    border: '#3b82f6',
  },
  
  // Borders (subtle pink/purple tint)
  border: {
    subtle: 'rgba(255, 105, 180, 0.08)',   // Barely visible
    light: 'rgba(255, 105, 180, 0.15)',    // Subtle
    medium: 'rgba(255, 105, 180, 0.25)',   // Visible
    strong: 'rgba(255, 105, 180, 0.4)',    // Prominent
  },
  
  // Shadows (pink-tinted, more pronounced)
  shadow: {
    sm: '0 2px 4px rgba(255, 45, 146, 0.1)',
    md: '0 4px 8px rgba(255, 45, 146, 0.15)',
    lg: '0 10px 20px rgba(255, 45, 146, 0.2)',
    xl: '0 20px 40px rgba(255, 45, 146, 0.25)',
    glow: '0 0 40px rgba(255, 105, 180, 0.3)',  // Neon glow effect
  },
  
  // Special effects
  effects: {
    shimmer: 'linear-gradient(90deg, transparent, rgba(255, 105, 180, 0.1), transparent)',
    gradient: 'linear-gradient(135deg, #ff2d92 0%, #8b5cf6 100%)',
    neon: '0 0 10px rgba(255, 105, 180, 0.5), 0 0 20px rgba(255, 105, 180, 0.3)',
  },
};
```

---

### Component Examples (Midnight Rose)

**Button (Primary):**
```tsx
<Button className="
  bg-gradient-to-r from-pink-400 to-pink-500
  text-white font-semibold
  hover:from-pink-500 hover:to-pink-600
  shadow-lg shadow-pink-400/30
  hover:shadow-xl hover:shadow-pink-400/50
  transition-all duration-200
  hover:scale-105
  border border-pink-400/20
">
  Create Post
</Button>
```

**Button (Secondary):**
```tsx
<Button className="
  bg-surface-elevated/50
  text-text-primary
  border border-pink-400/20
  hover:bg-surface-elevated
  hover:border-pink-400/40
  hover:shadow-lg hover:shadow-pink-400/20
  backdrop-blur-xl
">
  Cancel
</Button>
```

**Card (Midnight Rose):**
```tsx
<Card className="
  bg-surface-primary/95
  backdrop-blur-xl
  border border-pink-400/15
  shadow-xl shadow-pink-400/10
  hover:shadow-2xl hover:shadow-pink-400/20
  hover:border-pink-400/30
  transition-all duration-300
  relative
  before:absolute before:inset-0
  before:rounded-lg
  before:bg-gradient-to-br before:from-pink-400/5 before:to-purple-400/5
  before:opacity-0 hover:before:opacity-100
  before:transition-opacity
">
  <CardContent className="relative z-10 text-text-primary">
    {/* Content here */}
  </CardContent>
</Card>
```

**Input Field:**
```tsx
<Input className="
  bg-surface-secondary/50
  border border-border-medium
  text-text-primary
  placeholder:text-text-disabled
  focus:border-pink-400/50
  focus:ring-2 focus:ring-pink-400/20
  focus:shadow-lg focus:shadow-pink-400/10
  backdrop-blur-sm
  transition-all duration-200
" />
```

**Badge (Pro):**
```tsx
<Badge className="
  bg-gradient-to-r from-pink-400/20 to-purple-400/20
  text-pink-400
  border border-pink-400/30
  shadow-sm shadow-pink-400/20
  font-medium
  backdrop-blur-sm
">
  <Crown className="h-3 w-3 mr-1" />
  Pro
</Badge>
```

**Navigation Item (Active):**
```tsx
<NavItem className="
  bg-gradient-to-r from-pink-400/10 to-purple-400/10
  text-pink-400
  border-l-2 border-pink-400
  shadow-lg shadow-pink-400/20
  font-semibold
  relative
  before:absolute before:inset-0
  before:bg-gradient-to-r before:from-pink-400/5 before:to-transparent
  before:animate-shimmer
">
  Dashboard
</NavItem>
```

**Toast Notification:**
```tsx
<Toast className="
  bg-surface-elevated/95
  backdrop-blur-xl
  border border-pink-400/20
  shadow-2xl shadow-pink-400/30
  text-text-primary
">
  <div className="flex items-center gap-3">
    <div className="p-2 bg-pink-400/20 rounded-full">
      <CheckCircle className="h-5 w-5 text-pink-400" />
    </div>
    <div>
      <p className="font-semibold">Post scheduled!</p>
      <p className="text-sm text-text-secondary">Your post will go live at 2:30 PM</p>
    </div>
  </div>
</Toast>
```

---

### Special Effects for Midnight Rose

**1. Neon Glow on Hover:**
```css
.neon-hover {
  transition: all 0.3s ease;
}

.neon-hover:hover {
  box-shadow: 
    0 0 10px rgba(255, 105, 180, 0.5),
    0 0 20px rgba(255, 105, 180, 0.3),
    0 0 30px rgba(255, 105, 180, 0.2);
  border-color: rgba(255, 105, 180, 0.6);
}
```

**2. Shimmer Animation:**
```css
@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

.shimmer-effect::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 105, 180, 0.1),
    transparent
  );
  animation: shimmer 2s infinite;
}
```

**3. Pulsing Glow (for notifications):**
```css
@keyframes pulse-glow {
  0%, 100% { 
    box-shadow: 0 0 10px rgba(255, 105, 180, 0.3);
  }
  50% { 
    box-shadow: 0 0 20px rgba(255, 105, 180, 0.6);
  }
}

.pulse-glow {
  animation: pulse-glow 2s ease-in-out infinite;
}
```

**4. Gradient Border Animation:**
```css
@keyframes gradient-border {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

.animated-border {
  border: 2px solid transparent;
  background: 
    linear-gradient(var(--surface-primary), var(--surface-primary)) padding-box,
    linear-gradient(90deg, #ff2d92, #8b5cf6, #ff2d92) border-box;
  background-size: 200% 200%;
  animation: gradient-border 3s ease infinite;
}
```

---

### Theme Comparison

| Aspect | Bubblegum Pink (Light) | Midnight Rose (Dark) |
|--------|------------------------|----------------------|
| **Background** | Soft pink gradient | Deep purple-black gradient |
| **Cards** | White with pink tint | Dark purple with glow |
| **Text** | Near-black | Off-white with pink tint |
| **Accents** | Vibrant pink/blue/purple | Desaturated pink/blue/purple |
| **Shadows** | Subtle pink tint | Pronounced pink glow |
| **Borders** | Light pink | Glowing pink |
| **Vibe** | Playful, energetic | Mysterious, premium |
| **Best for** | Daytime use | Nighttime use |

---

### Auto Theme Switching

```typescript
// Automatically switch based on time of day
function getRecommendedTheme(): 'bubblegum-pink' | 'midnight-rose' {
  const hour = new Date().getHours();
  
  // 6 AM - 6 PM: Light theme
  if (hour >= 6 && hour < 18) {
    return 'bubblegum-pink';
  }
  
  // 6 PM - 6 AM: Dark theme
  return 'midnight-rose';
}

// Or respect system preference
function getSystemTheme(): 'bubblegum-pink' | 'midnight-rose' {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'midnight-rose' : 'bubblegum-pink';
}
```

---

### Additional Theme Suggestions

**3. "Lavender Dreams" (Alternative Light):**
- Background: Soft lavender gradient
- Accents: Purple, pink, blue
- Vibe: Calm, dreamy, feminine

**4. "Cyber Punk" (Alternative Dark):**
- Background: Deep blue-black
- Accents: Neon pink, cyan, yellow
- Vibe: Futuristic, edgy, bold

**5. "Sunset Glow" (Warm Light):**
- Background: Peach to coral gradient
- Accents: Orange, pink, gold
- Vibe: Warm, inviting, energetic

**6. "Deep Ocean" (Cool Dark):**
- Background: Navy to teal gradient
- Accents: Aqua, cyan, blue
- Vibe: Calm, professional, trustworthy

---

**The Midnight Rose theme gives you that premium, late-night content creation vibe while maintaining perfect readability. It's like working in a neon-lit studio at 2 AM - focused, creative, and absolutely gorgeous.** 🌹✨
