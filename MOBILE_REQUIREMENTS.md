# Mobile Optimization Requirements

## Current Mobile Issues & Solutions

### 1. **Navigation Problems**
**Current Issue:** 
- Sidebar takes full screen width on mobile
- No hamburger menu
- Navigation items too small for touch (44px minimum required)
- No swipe gestures

**Solution Needed:**
```tsx
// Add mobile drawer/sheet component
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

// Mobile navigation with hamburger
<Sheet>
  <SheetTrigger asChild>
    <Button variant="ghost" size="icon" className="md:hidden">
      <Menu className="h-6 w-6" />
    </Button>
  </SheetTrigger>
  <SheetContent side="left" className="w-72">
    {/* Navigation items */}
  </SheetContent>
</Sheet>

// Touch-friendly nav items (min 48px height)
<Button className="h-12 w-full justify-start text-base">
  {item.label}
</Button>
```

### 2. **Two-Pane Creator Layout**
**Current Issue:**
- Side-by-side layout breaks on mobile
- Can't see preview while creating
- Upload area too small for touch

**Solution Needed:**
```tsx
// Stack panes vertically on mobile with tabs
const isMobile = useMediaQuery('(max-width: 768px)');

{isMobile ? (
  <Tabs defaultValue="create" className="w-full">
    <TabsList className="grid w-full grid-cols-2 mb-4">
      <TabsTrigger value="create" className="data-[state=active]:bg-primary">
        Create
      </TabsTrigger>
      <TabsTrigger value="preview">
        Preview
      </TabsTrigger>
    </TabsList>
    <TabsContent value="create">
      {/* Creation form */}
    </TabsContent>
    <TabsContent value="preview">
      {/* Preview with floating action button to go back */}
    </TabsContent>
  </Tabs>
) : (
  // Desktop two-pane layout
)}
```

### 3. **Command Palette**
**Current Issue:**
- Keyboard-centric design doesn't work on mobile
- Search input too small
- Results not scrollable
- No touch-friendly shortcuts

**Solution Needed:**
```tsx
// Mobile-optimized command palette
<CommandDialog open={open} onOpenChange={setOpen}>
  <CommandInput 
    placeholder="Search..." 
    className="h-12 text-base" // Larger touch target
  />
  <CommandList className="max-h-[60vh] overflow-y-auto">
    {/* Add touch gestures for scrolling */}
    <CommandGroup>
      {items.map(item => (
        <CommandItem 
          className="py-3 px-4 min-h-[48px]" // Touch-friendly size
          onSelect={() => {
            // Haptic feedback on mobile
            if ('vibrate' in navigator) {
              navigator.vibrate(10);
            }
            item.action();
          }}
        >
          {item.label}
        </CommandItem>
      ))}
    </CommandGroup>
  </CommandList>
</CommandDialog>
```

### 4. **Dashboard Stats Cards**
**Current Issue:**
- 4-column grid too cramped on mobile
- Text overlaps
- Change indicators too small

**Solution Needed:**
```tsx
// Responsive grid with larger mobile layout
<div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
  {/* Stack to 2x2 on mobile instead of 1x4 */}
</div>

// Larger text on mobile
<CardContent className="space-y-2">
  <div className="text-xl sm:text-2xl font-bold">{value}</div>
  <p className="text-xs sm:text-sm flex items-center">
    {/* Larger change indicators */}
  </p>
</CardContent>
```

### 5. **Forms & Inputs**
**Current Issue:**
- Input fields too small (38px height)
- Labels too close to inputs
- No input zoom prevention
- Date/time pickers not mobile-optimized

**Solution Needed:**
```tsx
// Prevent zoom on input focus (iOS)
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">

// Larger mobile inputs
<Input 
  className="h-12 text-base" 
  inputMode="text" // Proper keyboard hints
/>

// Native mobile date/time pickers
<input 
  type="datetime-local" 
  className="..."
  min={new Date().toISOString().slice(0, 16)}
/>
```

### 6. **Image Upload**
**Current Issue:**
- Drag-and-drop doesn't work on mobile
- No camera access option
- Preview too small

**Solution Needed:**
```tsx
// Mobile-friendly upload
<div className="space-y-4">
  <Button 
    onClick={() => fileInputRef.current?.click()}
    className="w-full h-12"
  >
    <Camera className="mr-2 h-5 w-5" />
    Take Photo or Choose from Gallery
  </Button>
  
  <input
    ref={fileInputRef}
    type="file"
    accept="image/*"
    capture="environment" // Access camera on mobile
    className="hidden"
    onChange={handleFileSelect}
  />
</div>

// Pinch-to-zoom image preview
<div className="relative touch-manipulation">
  <img 
    src={preview} 
    className="w-full h-auto"
    style={{ maxHeight: '60vh' }}
  />
</div>
```

### 7. **Tables & Lists**
**Current Issue:**
- Horizontal scrolling required
- Too much data density
- No swipe actions

**Solution Needed:**
```tsx
// Card-based layout for mobile
{isMobile ? (
  <div className="space-y-4">
    {data.map(item => (
      <Card key={item.id} className="p-4">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-medium">{item.title}</h3>
            <p className="text-sm text-muted-foreground">{item.subtitle}</p>
          </div>
          <Badge>{item.status}</Badge>
        </div>
        {/* Swipe to delete */}
        <SwipeableActions>
          <Button variant="destructive" size="sm">Delete</Button>
        </SwipeableActions>
      </Card>
    ))}
  </div>
) : (
  // Desktop table
)}
```

### 8. **Modals & Dialogs**
**Current Issue:**
- Full screen required but not implemented
- Close buttons too small
- Content scrolling issues

**Solution Needed:**
```tsx
// Full-screen modals on mobile
<Dialog>
  <DialogContent className="sm:max-w-lg max-w-full h-full sm:h-auto">
    <DialogHeader className="sticky top-0 bg-background z-10">
      <DialogTitle>{title}</DialogTitle>
      <DialogClose className="h-11 w-11" /> {/* Larger close button */}
    </DialogHeader>
    <div className="overflow-y-auto flex-1">
      {/* Scrollable content */}
    </div>
  </DialogContent>
</Dialog>
```

### 9. **Performance Issues**
**Current Issue:**
- Large bundle size (>2MB)
- No code splitting
- Images not optimized
- Animations janky

**Solution Needed:**
```tsx
// Lazy load heavy components
const Dashboard = lazy(() => import('./Dashboard'));
const TwoPaneCreator = lazy(() => import('./TwoPaneCreator'));

// Optimize images
<img 
  loading="lazy"
  srcSet={`${img300} 300w, ${img600} 600w, ${img1200} 1200w`}
  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
/>

// Reduce motion for battery saving
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Use CSS containment
.card {
  contain: layout style paint;
}
```

### 10. **Touch Interactions**
**Current Issue:**
- No swipe gestures
- No pull-to-refresh
- No haptic feedback
- Double-tap zoom not prevented where needed

**Solution Needed:**
```tsx
// Add touch gestures
import { useSwipeable } from 'react-swipeable';

const handlers = useSwipeable({
  onSwipedLeft: () => nextPage(),
  onSwipedRight: () => prevPage(),
  trackMouse: false
});

// Pull to refresh
import { PullToRefresh } from '@/components/ui/pull-to-refresh';

<PullToRefresh onRefresh={refetch}>
  {content}
</PullToRefresh>

// Haptic feedback
function vibrate(pattern = 10) {
  if ('vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
}
```

## Mobile Testing Checklist

- [ ] Test on iPhone Safari (iOS 14+)
- [ ] Test on Android Chrome (Android 10+)
- [ ] Test with one hand reachability
- [ ] Test in landscape orientation
- [ ] Test with slow 3G connection
- [ ] Test offline functionality
- [ ] Test with screen reader
- [ ] Test with large text size settings
- [ ] Verify touch targets are ≥44px (iOS) / ≥48px (Android)
- [ ] Verify no horizontal scroll
- [ ] Test keyboard behavior (no unwanted zoom)
- [ ] Test form autofill
- [ ] Test back button behavior
- [ ] Check performance score (Lighthouse mobile)

## Priority Implementation Order

### Phase 1: Critical (2-3 hours)
1. Add hamburger menu for navigation
2. Stack two-pane creator on mobile
3. Make inputs/buttons touch-friendly (min 44px)
4. Fix viewport meta tag

### Phase 2: Important (2-3 hours)
5. Mobile-optimized modals (full screen)
6. Card-based layouts for tables
7. Responsive grid adjustments
8. Native date/time pickers

### Phase 3: Nice to Have (2-3 hours)
9. Swipe gestures
10. Pull-to-refresh
11. Haptic feedback
12. Performance optimizations

## Code Examples for Quick Implementation

```tsx
// 1. useIsMobile hook
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  return isMobile;
}

// 2. Mobile-first responsive component
export function ResponsiveLayout({ children }) {
  const isMobile = useIsMobile();
  
  return (
    <div className={cn(
      "transition-all duration-200",
      isMobile ? "px-4 py-2" : "px-8 py-4"
    )}>
      {children}
    </div>
  );
}

// 3. Touch-friendly button
export function MobileButton({ children, ...props }) {
  return (
    <Button
      className="min-h-[44px] px-4 text-base active:scale-95 transition-transform"
      {...props}
    >
      {children}
    </Button>
  );
}
```

## Estimated Time: 6-8 hours total

This covers all major mobile issues and provides a clear implementation path.
