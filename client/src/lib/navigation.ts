import {
  LayoutDashboard,
  Images,
  CalendarCheck2,
  BarChart3,
  ShieldCheck,
  LifeBuoy,
  Settings
} from "lucide-react";
import type { MobileNavigationItem } from "@/components/mobile-optimization";

export const coreNavigationItems: MobileNavigationItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    description: "Overview & insights",
    icon: LayoutDashboard
  },
  {
    href: "/gallery",
    label: "Gallery",
    description: "Manage your media library",
    icon: Images
  },
  {
    href: "/post-scheduling",
    label: "Scheduling",
    description: "Plan your Reddit posts",
    icon: CalendarCheck2
  },
  {
    href: "/analytics",
    label: "Analytics",
    description: "Track performance metrics",
    icon: BarChart3,
    badge: {
      text: "Pro"
    }
  },
  {
    href: "/imageshield",
    label: "Protection",
    description: "ImageShield tools",
    icon: ShieldCheck
  },
  {
    href: "/support",
    label: "Support",
    description: "Get help fast",
    icon: LifeBuoy
  },
  {
    href: "/settings",
    label: "Settings",
    description: "Account preferences",
    icon: Settings
  }
];
