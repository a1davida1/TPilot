import {
  LayoutDashboard,
  Images,
  CalendarCheck2,
  BarChart3,
  ShieldCheck,
  LifeBuoy,
  Settings,
  Sparkles,
  Shield,
  Calendar,
  Clock,
  History,
  Receipt,
  Gift,
  Users,
  Palette,
  Bot,
  GraduationCap,
  type LucideIcon,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export type NavigationCategory = 'main' | 'create' | 'manage' | 'learn' | 'account';
export type WorkflowBucketKey = 'create' | 'protect' | 'schedule' | 'analyze';
export type AccessTier = 'free' | 'pro' | 'premium' | 'admin';

export interface NavigationItem {
  key: string;
  label: string;
  description?: string;
  href: string;
  icon: LucideIcon;
  category: NavigationCategory;
  authenticated: boolean;
  proOnly?: boolean;
  adminOnly?: boolean;
  badge?: {
    text: string;
    variant?: 'default' | 'success' | 'warning' | 'error' | 'pro';
  };
  shortcut?: string; // Keyboard shortcut
  mobileOrder?: number; // Order in mobile nav (lower = higher priority)
}

export interface WorkflowRoute {
  key: string;
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  proOnly?: boolean;
  adminOnly?: boolean;
  shortcut?: string;
}

export interface WorkflowBucket {
  key: WorkflowBucketKey;
  label: string;
  description: string;
  routes: WorkflowRoute[];
}

export interface AccessContext {
  isAuthenticated: boolean;
  tier: AccessTier | null;
  isAdmin: boolean;
}

// ============================================================================
// Workflow Buckets (Header Dropdowns)
// ============================================================================

export const workflowBuckets: WorkflowBucket[] = [
  {
    key: 'create',
    label: 'Create',
    description: 'Generate posts with AI captions and auto-protection',
    routes: [
      {
        key: 'quick-post',
        label: 'Quick Post',
        href: '/quick-post',
        description: 'One-click workflow to launch a Reddit-ready post',
        icon: Sparkles,
        shortcut: '⌘N',
      },
      {
        key: 'bulk-caption',
        label: 'Bulk Caption',
        href: '/bulk-caption',
        description: 'Generate captions for multiple images at once',
        icon: Sparkles,
        proOnly: true,
        shortcut: '⌘U',
      },
    ],
  },
  {
    key: 'protect',
    label: 'Protect',
    description: 'Watermark and secure your media before publishing',
    routes: [
      {
        key: 'imageshield',
        label: 'ImageShield',
        href: '/imageshield',
        description: 'Apply automated watermarks and leak protection',
        icon: Shield,
      },
      {
        key: 'gallery',
        label: 'Media Gallery',
        href: '/gallery',
        description: 'Manage and organize your protected content',
        icon: Images,
      },
    ],
  },
  {
    key: 'schedule',
    label: 'Schedule',
    description: 'Plan and manage your Reddit content calendar',
    routes: [
      {
        key: 'post-scheduling',
        label: 'Post Scheduling',
        href: '/post-scheduling',
        description: 'Queue Reddit posts with AI timing recommendations',
        icon: Calendar,
        shortcut: '⌘S',
      },
      {
        key: 'calendar',
        label: 'Calendar View',
        href: '/scheduling-calendar',
        description: 'Visual calendar with drag-and-drop scheduling',
        icon: CalendarCheck2,
        proOnly: true,
      },
      {
        key: 'queue',
        label: 'Publishing Queue',
        href: '/queue',
        description: 'Monitor scheduled posts and publishing status',
        icon: Clock,
      },
      {
        key: 'campaigns',
        label: 'Campaigns',
        href: '/campaigns',
        description: 'Create themed content series',
        icon: History,
        proOnly: true,
      },
    ],
  },
  {
    key: 'analyze',
    label: 'Analyze',
    description: 'Track performance and optimize your strategy',
    routes: [
      {
        key: 'analytics',
        label: 'Analytics Dashboard',
        href: '/analytics',
        description: 'Real-time performance metrics',
        icon: BarChart3,
        shortcut: '⌘A',
      },
      {
        key: 'performance',
        label: 'Performance Insights',
        href: '/performance',
        description: 'Deep-dive into post performance',
        icon: BarChart3,
        proOnly: true,
      },
      {
        key: 'subreddit-insights',
        label: 'Subreddit Analytics',
        href: '/subreddit-insights',
        description: 'Community-specific performance data',
        icon: Users,
        proOnly: true,
      },
    ],
  },
];

// ============================================================================
// Main Navigation Items (Sidebar)
// ============================================================================

export const navigationItems: NavigationItem[] = [
  // Main Section
  {
    key: 'dashboard',
    label: 'Dashboard',
    description: 'Overview & quick actions',
    href: '/dashboard',
    icon: LayoutDashboard,
    category: 'main',
    authenticated: true,
    mobileOrder: 1,
  },
  {
    key: 'quick-post',
    label: 'Quick Post',
    description: 'Create a single post',
    href: '/quick-post',
    icon: Sparkles,
    category: 'create',
    authenticated: true,
    shortcut: '⌘N',
    mobileOrder: 2,
  },
  {
    key: 'gallery',
    label: 'Gallery',
    description: 'Manage your media library',
    href: '/gallery',
    icon: Images,
    category: 'manage',
    authenticated: true,
    mobileOrder: 3,
  },
  {
    key: 'post-scheduling',
    label: 'Scheduling',
    description: 'Plan your Reddit posts',
    href: '/post-scheduling',
    icon: CalendarCheck2,
    category: 'manage',
    authenticated: true,
    shortcut: '⌘S',
    mobileOrder: 4,
  },
  {
    key: 'analytics',
    label: 'Analytics',
    description: 'Track performance metrics',
    href: '/analytics',
    icon: BarChart3,
    category: 'main',
    authenticated: true,
    badge: {
      text: 'Pro',
      variant: 'pro',
    },
    proOnly: true,
    shortcut: '⌘A',
    mobileOrder: 5,
  },
  
  // Create Section
  {
    key: 'bulk-caption',
    label: 'Bulk Caption',
    description: 'Caption multiple images',
    href: '/bulk-caption',
    icon: Sparkles,
    category: 'create',
    authenticated: true,
    proOnly: true,
    shortcut: '⌘U',
  },
  
  // Manage Section  
  {
    key: 'imageshield',
    label: 'ImageShield',
    description: 'Protect your content',
    href: '/imageshield',
    icon: ShieldCheck,
    category: 'manage',
    authenticated: true,
    mobileOrder: 6,
  },
  {
    key: 'queue',
    label: 'Queue',
    description: 'Publishing queue',
    href: '/queue',
    icon: Clock,
    category: 'manage',
    authenticated: true,
  },
  {
    key: 'campaigns',
    label: 'Campaigns',
    description: 'Content campaigns',
    href: '/campaigns',
    icon: History,
    category: 'manage',
    authenticated: true,
    proOnly: true,
  },
  {
    key: 'reddit-communities',
    label: 'Communities',
    description: 'Manage subreddits',
    href: '/reddit-communities',
    icon: Users,
    category: 'manage',
    authenticated: true,
  },
  
  // Learn Section
  {
    key: 'flight-school',
    label: 'FlightSchool',
    description: 'Learn content mastery',
    href: '/flight-school',
    icon: GraduationCap,
    category: 'learn',
    authenticated: true,
    badge: {
      text: 'NEW',
      variant: 'success',
    },
  },
  {
    key: 'pro-perks',
    label: 'Pro Perks',
    description: 'Premium benefits',
    href: '/pro-perks',
    icon: Gift,
    category: 'learn',
    authenticated: true,
    proOnly: true,
  },
  
  // Account Section
  {
    key: 'tax-tracker',
    label: 'Tax Tracker',
    description: 'Track expenses',
    href: '/tax-tracker',
    icon: Receipt,
    category: 'account',
    authenticated: true,
  },
  {
    key: 'user-customization',
    label: 'Customization',
    description: 'Personas & styles',
    href: '/user-customization',
    icon: Palette,
    category: 'account',
    authenticated: true,
  },
  {
    key: 'automation',
    label: 'Automation',
    description: 'Auto-posting rules',
    href: '/automation',
    icon: Bot,
    category: 'account',
    authenticated: true,
    proOnly: true,
  },
  {
    key: 'support',
    label: 'Support',
    description: 'Get help fast',
    href: '/support',
    icon: LifeBuoy,
    category: 'account',
    authenticated: false,
    mobileOrder: 8,
  },
  {
    key: 'settings',
    label: 'Settings',
    description: 'Account preferences',
    href: '/settings',
    icon: Settings,
    category: 'account',
    authenticated: true,
    shortcut: '⌘,',
    mobileOrder: 7,
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

const PRO_ELIGIBLE_TIERS = new Set<AccessTier>(['pro', 'premium', 'admin']);

export function filterNavigationByAccess(
  items: NavigationItem[],
  context: AccessContext
): NavigationItem[] {
  return items.filter(item => {
    // Check authentication
    if (item.authenticated && !context.isAuthenticated) {
      return false;
    }
    
    // Check admin access
    if (item.adminOnly && !context.isAdmin) {
      return false;
    }
    
    // Check pro access
    if (item.proOnly && context.tier && !PRO_ELIGIBLE_TIERS.has(context.tier)) {
      return false;
    }
    
    return true;
  });
}

export function filterWorkflowBucketsByAccess(
  buckets: WorkflowBucket[],
  context: AccessContext
): WorkflowBucket[] {
  return buckets.map(bucket => ({
    ...bucket,
    routes: bucket.routes.filter(route => {
      // Check admin access
      if (route.adminOnly && !context.isAdmin) {
        return false;
      }
      
      // Check pro access
      if (route.proOnly && context.tier && !PRO_ELIGIBLE_TIERS.has(context.tier)) {
        return false;
      }
      
      return true;
    }),
  })).filter(bucket => bucket.routes.length > 0);
}

export function getNavigationByCategory(
  items: NavigationItem[],
  category: NavigationCategory
): NavigationItem[] {
  return items.filter(item => item.category === category);
}

export function getMobileNavigation(items: NavigationItem[]): NavigationItem[] {
  return items
    .filter(item => item.mobileOrder !== undefined)
    .sort((a, b) => (a.mobileOrder ?? 99) - (b.mobileOrder ?? 99));
}

// Command Palette Commands
export interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon?: LucideIcon;
  shortcut?: string;
  action: () => void;
  keywords?: string[];
}

export function getCommandPaletteItems(
  navigate: (path: string) => void,
  actions: {
    generateCaption?: () => void;
    showUpgrade?: () => void;
    logout?: () => void;
  } = {}
): CommandItem[] {
  const commands: CommandItem[] = [];
  
  // Add navigation commands
  navigationItems.forEach(item => {
    commands.push({
      id: `nav-${item.key}`,
      label: item.label,
      description: item.description,
      icon: item.icon,
      shortcut: item.shortcut,
      action: () => navigate(item.href),
      keywords: [item.key, item.category],
    });
  });
  
  // Add workflow commands
  workflowBuckets.forEach(bucket => {
    bucket.routes.forEach(route => {
      commands.push({
        id: `workflow-${route.key}`,
        label: route.label,
        description: route.description,
        icon: route.icon,
        shortcut: route.shortcut,
        action: () => navigate(route.href),
        keywords: [bucket.key, 'workflow'],
      });
    });
  });
  
  // Add action commands
  if (actions.generateCaption) {
    commands.push({
      id: 'action-generate',
      label: 'Generate Caption',
      description: 'Create AI-powered caption',
      icon: Sparkles,
      shortcut: '⌘G',
      action: actions.generateCaption,
      keywords: ['ai', 'caption', 'generate'],
    });
  }
  
  if (actions.showUpgrade) {
    commands.push({
      id: 'action-upgrade',
      label: 'Upgrade to Pro',
      description: 'Unlock premium features',
      icon: Gift,
      action: actions.showUpgrade,
      keywords: ['pro', 'upgrade', 'premium'],
    });
  }
  
  if (actions.logout) {
    commands.push({
      id: 'action-logout',
      label: 'Sign Out',
      description: 'Logout from your account',
      icon: Settings,
      action: actions.logout,
      keywords: ['logout', 'signout', 'exit'],
    });
  }
  
  return commands;
}
