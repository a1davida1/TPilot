import {
  Sparkles,
  Shield,
  Calendar,
  Clock,
  BarChart3,
  History,
  Settings,
  Share2,
  BookOpen,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type WorkflowBucketKey = 'create' | 'protect' | 'schedule' | 'analyze';

export interface BaseRouteConfig {
  key: string;
  label: string;
  href: string;
  authenticated: boolean | null;
  proOnly?: boolean;
  adminOnly?: boolean;
}

export interface WorkflowRouteConfig extends BaseRouteConfig {
  description: string;
  icon: LucideIcon;
}

export interface WorkflowBucketConfig {
  key: WorkflowBucketKey;
  label: string;
  description: string;
  routes: WorkflowRouteConfig[];
}

export interface UtilityRouteConfig extends BaseRouteConfig {
  icon?: LucideIcon;
  description?: string;
}

export interface AccessContext {
  isAuthenticated: boolean;
  tier: string | null | undefined;
  isAdmin: boolean;
}

const PRO_ELIGIBLE_TIERS = new Set(['pro', 'premium', 'admin']);

export const workflowBuckets: WorkflowBucketConfig[] = [
  {
    key: 'create',
    label: 'Create',
    description: 'Generate a post with AI captions and auto-protection.',
    routes: [
      {
        key: 'quick-post',
        label: 'Quick Post',
        href: '/quick-post',
        description: 'One-click workflow to launch a Reddit-ready post.',
        icon: Sparkles,
        authenticated: true,
      },
    ],
  },
  {
    key: 'protect',
    label: 'Protect',
    description: 'Watermark and secure your media before publishing.',
    routes: [
      {
        key: 'imageshield',
        label: 'ImageShield',
        href: '/imageshield',
        description: 'Apply automated watermarks and leak protection.',
        icon: Shield,
        authenticated: true,
      },
    ],
  },
  {
    key: 'schedule',
    label: 'Schedule',
    description: 'Plan and manage your Reddit content calendar.',
    routes: [
      {
        key: 'post-scheduling',
        label: 'Post Scheduling',
        href: '/post-scheduling',
        description: 'Queue Reddit posts with AI timing recommendations.',
        icon: Calendar,
        authenticated: true,
      },
      {
        key: 'scheduled-posts',
        label: 'Scheduled Posts',
        href: '/scheduled-posts',
        description: 'Review and edit your upcoming scheduled posts.',
        icon: Clock,
        authenticated: true,
      },
    ],
  },
  {
    key: 'analyze',
    label: 'Analyze',
    description: 'Track performance and growth trends.',
    routes: [
      {
        key: 'analytics',
        label: 'Analytics',
        href: '/analytics',
        description: 'Monitor engagement and conversion performance.',
        icon: BarChart3,
        authenticated: true,
        proOnly: true,
      },
    ],
  },
];

export const utilityRoutes: UtilityRouteConfig[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    href: '/dashboard',
    authenticated: true,
    icon: BarChart3,
    description: 'Overview of your account health and KPIs.',
  },
  {
    key: 'reddit',
    label: 'Reddit',
    href: '/reddit',
    authenticated: null,
    icon: Share2,
    description: 'Guides and tools for Reddit growth.',
  },
  {
    key: 'caption-generator',
    label: 'Generator',
    href: '/caption-generator',
    authenticated: null,
    icon: BookOpen,
    description: 'AI caption generator for any platform.',
  },
  {
    key: 'referral',
    label: 'Referral',
    href: '/referral',
    authenticated: true,
    icon: Share2,
    description: 'Earn rewards by referring creators.',
  },
  {
    key: 'history',
    label: 'History',
    href: '/history',
    authenticated: true,
    icon: History,
    description: 'See your recent posts and automation activity.',
  },
  {
    key: 'settings',
    label: 'Settings',
    href: '/settings',
    authenticated: true,
    icon: Settings,
    description: 'Manage your team, billing, and integrations.',
  },
  {
    key: 'admin',
    label: 'Admin Portal',
    href: '/admin',
    authenticated: true,
    adminOnly: true,
  },
];

export function filterRoutesByAccess<T extends BaseRouteConfig>(
  routes: T[],
  context: AccessContext,
): T[] {
  return routes.filter((route) => {
    if (route.adminOnly) {
      return context.isAdmin;
    }

    if (route.authenticated === true && !context.isAuthenticated) {
      return false;
    }

    if (route.authenticated === false && context.isAuthenticated) {
      return false;
    }

    if (route.proOnly) {
      const tier = context.tier ?? null;
      if (!tier || !PRO_ELIGIBLE_TIERS.has(tier)) {
        return false;
      }
    }

    return true;
  });
}

export function filterWorkflowBucketsByAccess(
  buckets: WorkflowBucketConfig[],
  context: AccessContext,
): WorkflowBucketConfig[] {
  return buckets
    .map((bucket) => ({
      ...bucket,
      routes: filterRoutesByAccess(bucket.routes, context),
    }))
    .filter((bucket) => bucket.routes.length > 0);
}
