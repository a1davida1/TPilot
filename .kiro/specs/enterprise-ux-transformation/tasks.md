# Implementation Plan

This plan breaks down the enterprise UX transformation into discrete, manageable coding tasks. Each task builds incrementally on previous work and references specific requirements from the requirements document.

## Task Overview

- **Total Tasks:** 12 major tasks with 45 sub-tasks
- **Estimated Time:** 26-30 hours (with existing component reuse)
- **Approach:** Implementation-first, then polish
- **Testing:** Optional test tasks marked with `*`

---

## Phase 1: Theme System & Design Tokens

- [x] 1. Create Bubblegum Pink and Midnight Rose theme tokens
  - Create `client/src/styles/themes/bubblegum-pink.ts` with complete color palette
  - Create `client/src/styles/themes/midnight-rose.ts` with dark theme colors
  - Create `client/src/styles/themes/tokens.ts` with shared design tokens (spacing, typography, animations)
  - Validate all color combinations meet WCAG 4.5:1 contrast ratio
  - Export theme types and interfaces
  - _Requirements: 15.1, 15.2, 15.3_

- [x] 1.1 Update theme provider to support new themes
  - Modify `client/src/components/theme-provider.tsx` to include new themes
  - Add theme switching logic (bubblegum-pink, midnight-rose, system)
  - Implement `applyThemeToDOM()` function to set CSS variables
  - Add localStorage persistence for theme preference
  - Add auto-theme based on time of day (6 AM-6 PM = light, 6 PM-6 AM = dark)
  - _Requirements: 15.1, 15.4_

- [x] 1.2 Create theme switcher UI component
  - Create `client/src/components/ui/theme-switcher.tsx`
  - Display theme options with preview swatches
  - Show current active theme
  - Add smooth transition animation (500ms fade)
  - Include "System" option that respects OS preference
  - _Requirements: 15.5_

- [x] 1.3 Apply theme CSS variables globally
  - Update `client/src/index.css` with CSS variable definitions
  - Add theme-specific utility classes
  - Ensure all existing components respect theme variables
  - Test theme switching across all pages
  - _Requirements: 15.1_

---

## Phase 2: Navigation System

- [x] 2. Implement workflow-based navigation structure
  - Create `client/src/components/navigation/WorkflowNavigation.tsx` for header dropdowns
  - Use existing `workflowBuckets` from `config/navigation.ts`
  - Implement dropdown menus for Create, Protect, Schedule, Analyze
  - Add icons and descriptions to each menu item
  - Display keyboard shortcuts in menu items
  - Filter routes based on user tier (free/pro/premium)
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 2.1 Create enhanced sidebar for desktop
  - Create `client/src/components/navigation/WorkflowSidebar.tsx`
  - Display 4 workflow sections with collapsible sub-items
  - Highlight active route with pink accent
  - Show "Pro" badges on locked features
  - Add smooth expand/collapse animations
  - Make sidebar sticky on scroll
  - _Requirements: 1.1, 1.7_

- [x] 2.2 Implement mobile hamburger menu
  - Update `client/src/components/header-enhanced.tsx` mobile menu
  - Use existing Sheet component for slide-over
  - Display same 4-section structure as desktop
  - Add close button and backdrop
  - Ensure touch targets are 44x44px minimum
  - _Requirements: 1.6_

- [x] 2.3 Add breadcrumb navigation (desktop only)
  - Create `client/src/components/navigation/Breadcrumbs.tsx`
  - Use existing `ui/breadcrumb.tsx` component
  - Generate breadcrumbs from current route
  - Hide on mobile, show back button instead
  - Truncate long paths with ellipsis
  - _Requirements: 5.1, 5.2, 5.3, 5.6_

- [x] 2.4 Implement mobile back button
  - Add contextual back button to mobile header
  - Navigate to parent route (not browser history)
  - Hide on top-level pages
  - Show only on mobile (<768px)
  - _Requirements: 5.2, 5.4_

---

## Phase 3: Layout Components

- [x] 3. Create TwoPane layout component
  - Create `client/src/components/layouts/TwoPane.tsx`
  - Implement 40/60 split for left/right panes
  - Add responsive stacking (vertical on <1024px)
  - Support sticky left pane option
  - Use existing Card component for pane containers
  - _Requirements: 2.1, 2.6, 2.7_

- [x] 3.1 Create DashboardGrid layout component
  - Create `client/src/components/layouts/DashboardGrid.tsx`
  - Implement 12-column grid system
  - Default: 8 columns main, 4 columns sidebar
  - Stack vertically on mobile
  - Support full-width option
  - _Requirements: 7.1, 7.2, 7.3_

- [ ] 3.2 Update Quick Post page to use TwoPane
  - Refactor `client/src/pages/quick-post.tsx` to use TwoPane component
  - Move upload/config to left pane
  - Move captions/preview to right pane
  - Ensure mobile stacking works correctly
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ] 3.3 Update Dashboard to use DashboardGrid
  - Refactor `client/src/pages/dashboard.tsx` to use DashboardGrid
  - Place Quick Actions in main content (2-column grid)
  - Place stats/alerts in sidebar
  - Ensure content fits in one screen on desktop
  - _Requirements: 7.1, 7.4, 7.5, 7.6_

---> ## Phase 4: Floating Action Button & Command Palette

- [ ] 4. Add keyboard shortcut to existing FAB
  - Update `client/src/components/ui/floating-action-button.tsx`
  - Add Cmd+N / Ctrl+N keyboard listener
  - Open FAB popover on shortcut press
  - Add tooltip showing "Cmd+N" on hover
  - _Requirements: 3.4, 3.7_

- [ ] 4.1 Ensure FAB hides on creation pages
  - Update FAB to check current route
  - Hide on `/quick-post`, `/bulk-caption`, `/post-scheduling`
  - Show on all other pages
  - _Requirements: 3.6_

- [ ] 4.2 Verify Command Palette integration
  - Ensure `client/src/components/ui/command-palette.tsx` is imported in 
App.tsx
  - Test Cmd+K shortcut opens palette
  - Verify all navigation items appear
  - Test keyboard navigation (arrows, enter, escape)
  - _Requirements: 10.1, 10.2, 10.4_

---



---

## Phase 4: Floating Action Button & Command Palette

- [x] 4. Add keyboard shortcut to existing FAB
  - Update `client/src/components/ui/floating-action-button.tsx`
  - Add Cmd+N / Ctrl+N keyboard listener
  - Open FAB popover on shortcut press
  - Add tooltip showing "Cmd+N" on hover
  - _Requirements: 3.4, 3.7_

- [x] 4.1 Ensure FAB hides on creation pages
  - Update FAB to check current route
  - Hide on `/quick-post`, `/bulk-caption`, `/post-scheduling`
  - Show on all other pages
  - _Requirements: 3.6_

- [x] 4.2 Verify Command Palette integration
  - Ensure `client/src/components/ui/command-palette.tsx` is imported in App.tsx
  - Test Cmd+K shortcut opens palette
  - Verify all navigation items appear
  - Test keyboard navigation (arrows, enter, escape)
  - _Requirements: 10.1, 10.2, 10.4_

---

## Phase 5: Status Banner System

- [x] 5. Integrate status banners across pages
  - Import existing `client/src/components/ui/status-banner.tsx`
  - Add tier limit banner to dashboard (when 80% quota used)
  - Add cooldown banner when Reddit cooldown active
  - Add post removal banner when post fails
  - Stack multiple banners vertically
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 5.1 Implement banner auto-dismiss
  - Add dismiss button to all banners
  - Store dismissed banners in localStorage
  - Don't show again for 24 hours after dismiss
  - _Requirements: 6.5_

- [x] 5.2 Add banner click actions
  - Make tier limit banner link to `/settings` (upgrade page)
  - Make cooldown banner show countdown timer
  - Make removal banner link to post details
  - _Requirements: 6.6_

---

## Phase 6: Bulk Upload & Drag-and-Drop Scheduling

- [x] 6. Create bulk upload zone component
  - Create `client/src/components/upload/BulkUploadZone.tsx`
  - Support drag-and-drop multiple files
  - Show upload progress for each file
  - Display thumbnails in grid after upload
  - Auto-generate captions for all images
  - _Requirements: 13.2_

- [x] 6.1 Create image library grid component
  - Create `client/src/components/scheduling/ImageLibraryGrid.tsx`
  - Display uploaded images in responsive grid (2-4 columns)
  - Add checkbox for multi-select
  - Show caption preview below each image
  - Add "Edit Caption" button on each image
  - _Requirements: 13.2, 13.3_

- [x] 6.2 Implement inline caption editor
  - Create `client/src/components/scheduling/CaptionEditor.tsx`
  - Open inline editor when "Edit Caption" clicked
  - Show character count
  - Display subreddit compatibility warnings
  - Add "Save" and "Regenerate" buttons
  - _Requirements: 13.3_

- [x] 6.3 Create draggable image component
  - Create `client/src/components/scheduling/DraggableImage.tsx`
  - Use `@dnd-kit/core` for drag-and-drop
  - Show ghost preview while dragging
  - Add drag handle icon
  - Disable drag if image not ready
  - _Requirements: 13.4_

- [x] 6.4 Create calendar drop zone component
  - Create `client/src/components/scheduling/CalendarDropZone.tsx`
  - Extend existing `ui/calendar.tsx` component
  - Highlight valid drop zones on drag
  - Show tier limit indicator (Pro: 7 days, Premium: 30 days)
  - Disable dates beyond tier limit
  - _Requirements: 13.4, 13.6, 13.7_

- [x] 6.5 Implement schedule modal
  - Create `client/src/components/scheduling/ScheduleModal.tsx`
  - Open when image dropped on calendar
  - Show subreddit picker with search
  - Show time picker with optimal time badges
  - Allow scheduling to multiple subreddits
  - Display staggered times (2-hour offset)
  - _Requirements: 13.5_

- [x] 6.6 Create three-pane bulk captioning page
  - Create or update `client/src/pages/bulk-captioning.tsx`
  - Left pane (20%): Upload zone with progress
  - Center pane (50%): Image library grid
  - Right pane (30%): Calendar drop zone
  - Stack vertically on mobile
  - _Requirements: 13.1, 13.8_

- [x] 6.7 Add calendar navigation to Schedule dropdown
  - Update `config/navigation.ts` to include Calendar route
  - Add to Schedule workflow bucket
  - Ensure it appears in navigation dropdowns
  - _Requirements: 14.1, 14.2, 14.3_

---

## Phase 7: Mobile Optimization

- [ ] 7. Implement mobile-specific layouts
  - Update all pages to stack vertically on mobile
  - Replace drag-and-drop with tap-to-select on mobile
  - Use bottom sheets for modals on mobile
  - Ensure all touch targets are 44x44px
  - _Requirements: 9.1, 9.2, 9.4, 9.5_

- [ ] 7.1 Add mobile-specific interactions
  - Implement swipe-to-delete on list items
  - Add pull-to-refresh on lists
  - Use native mobile date/time pickers
  - Add haptic feedback on important actions (if supported)
  - _Requirements: 9.3_

- [ ] 7.2 Test responsive breakpoints
  - Test all pages at 375px (mobile)
  - Test all pages at 768px (tablet)
  - Test all pages at 1024px (desktop)
  - Test all pages at 1440px (wide desktop)
  - Ensure smooth transitions between breakpoints
  - _Requirements: 9.8_

---

## Phase 8: Loading States & Empty States

- [ ] 8. Add skeleton loaders to all pages
  - Use existing `ui/skeleton.tsx` and `ui/loading-states.tsx`
  - Add skeletons to dashboard (match card shapes)
  - Add skeletons to gallery (match image grid)
  - Add skeletons to calendar (match calendar layout)
  - Replace spinners with skeletons everywhere
  - _Requirements: 11.1, 11.4_

- [ ] 8.1 Create empty state component
  - Create `client/src/components/ui/empty-state.tsx`
  - Include illustration, title, description, CTA button
  - Create variants for different contexts (no posts, no images, no data)
  - Add to gallery, schedule queue, analytics
  - _Requirements: 12.1, 12.2, 12.3_

- [ ] 8.2 Add loading indicators to async actions
  - Show progress bars for uploads (determinate)
  - Show spinners for API calls (indeterminate)
  - Disable buttons during processing
  - Show "Processing..." text
  - _Requirements: 11.2, 11.6_

---

## Phase 9: Error Handling & Recovery

- [ ] 9. Implement error recovery flows
  - Add "Retry" button to all error states
  - Show specific error messages (not generic)
  - Provide recovery instructions
  - Auto-retry with exponential backoff for network errors
  - _Requirements: 11.3, 11.7_

- [ ] 9.1 Add draft auto-save
  - Save form state to localStorage every 30 seconds
  - Restore draft on page reload
  - Show "Draft saved" indicator
  - Add "Discard draft" option
  - _Requirements: 11.8_

- [ ] 9.2 Implement offline detection
  - Show offline indicator when network lost
  - Queue actions for retry when back online
  - Display "You're offline" banner
  - Auto-retry queued actions on reconnect
  - _Requirements: 11.8_

---

## Phase 10: Accessibility & Keyboard Navigation

- [ ] 10. Ensure keyboard accessibility
  - Add visible focus rings to all interactive elements
  - Ensure Tab key reaches all elements
  - Add Escape key to close modals
  - Test full keyboard navigation flow
  - _Requirements: 10.3, 10.4, 10.5_

- [ ] 10.1 Add ARIA labels and roles
  - Add descriptive aria-label to all buttons
  - Add aria-live regions for dynamic content
  - Ensure proper heading hierarchy (h1 → h2 → h3)
  - Add alt text to all images
  - _Requirements: 10.6, 10.7_

- [ ] 10.2 Test with screen reader
  - Test with VoiceOver (Mac) or NVDA (Windows)
  - Ensure all content is announced correctly
  - Fix any navigation issues
  - Verify form validation is announced
  - _Requirements: 10.6, 10.8_

---

## Phase 11: Onboarding & Help

- [ ] 11. Create onboarding tour component
  - Create `client/src/components/onboarding/OnboardingTour.tsx`
  - Show welcome modal on first login
  - Guide through: Connect Reddit → Upload Image → Generate Caption → Post
  - Add confetti animation on first post success
  - Show "Next Steps" checklist after completion
  - _Requirements: 12.4, 12.5_

- [ ] 11.1 Add contextual tooltips
  - Add tooltips to all new features
  - Show on first hover/focus
  - Store "seen" state in localStorage
  - Add "?" icon for help on complex features
  - _Requirements: 12.7_

- [ ] 11.2 Create help menu
  - Add "Help" option to user menu
  - Link to documentation
  - Add "Replay Tutorial" option
  - Add "Keyboard Shortcuts" reference
  - _Requirements: 12.6_

---

## Phase 12: Polish & Final Touches

- [ ] 12. Add micro-interactions
  - Add hover scale (1.05x) to all cards
  - Add active scale (0.98x) to all buttons
  - Add smooth transitions (300ms) to all state changes
  - Add spring physics to animations (cubic-bezier)
  - _Requirements: Design System_

- [ ] 12.1 Implement celebration animations
  - Add confetti on first post success
  - Add checkmark animation on task completion
  - Add subtle particle effects on milestones
  - Use framer-motion for animations
  - _Requirements: Design System_

- [ ] 12.2 Add undo/redo system
  - Implement global undo stack
  - Add Cmd+Z / Ctrl+Z for undo
  - Add Cmd+Shift+Z / Ctrl+Shift+Z for redo
  - Show undo toast with action
  - _Requirements: Design System_

- [ ] 12.3 Final QA pass
  - Test all features on Chrome, Firefox, Safari
  - Test all features on iOS and Android
  - Verify all animations are smooth (60fps)
  - Check Lighthouse scores (target: 90+)
  - Verify WCAG 2.1 AA compliance
  - _Requirements: All_

---

## Optional Testing Tasks

- [ ]* 13. Write unit tests for new components
  - Test TwoPane layout rendering
  - Test DashboardGrid responsive behavior
  - Test theme switching logic
  - Test drag-and-drop interactions
  - _Requirements: Testing Strategy_

- [ ]* 13.1 Write integration tests for workflows
  - Test Quick Post flow (upload → caption → post)
  - Test Bulk Upload flow (upload → edit → schedule)
  - Test Calendar scheduling flow (drag → drop → confirm)
  - _Requirements: Testing Strategy_

- [ ]* 13.2 Add visual regression tests
  - Set up Storybook for component library
  - Add Chromatic for visual testing
  - Test theme switching doesn't break layouts
  - Test responsive breakpoints
  - _Requirements: Testing Strategy_

---

## Success Criteria

Before marking this spec complete, verify:

- [ ] All 12 major tasks completed
- [ ] Bubblegum Pink and Midnight Rose themes working
- [ ] Navigation shows 4 workflow sections
- [ ] FAB opens with Cmd+N
- [ ] Command Palette opens with Cmd+K
- [ ] Bulk upload supports drag-and-drop
- [ ] Calendar allows drag-and-drop scheduling
- [ ] Mobile layout works on 375px width
- [ ] All pages have loading skeletons
- [ ] All pages have empty states
- [ ] Keyboard navigation works throughout
- [ ] Lighthouse score 90+ on mobile and desktop
- [ ] WCAG 2.1 AA compliance verified

---

**Implementation Notes:**

- Start with Phase 1 (themes) as it affects all other components
- Phases 2-5 can be done in parallel by different developers
- Phase 6 (drag-and-drop) is the most complex, allocate extra time
- Phases 7-12 are polish and can be done incrementally
- Optional testing tasks can be done alongside implementation

**Estimated Timeline:**
- Week 1: Phases 1-2 (8 hours)
- Week 2: Phases 3-5 (8 hours)
- Week 3: Phase 6 (10 hours)
- Week 4: Phases 7-12 (4 hours)

**Total: 30 hours over 4 weeks**
