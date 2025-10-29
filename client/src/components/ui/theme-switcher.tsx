/**
 * Theme Switcher Component
 * Allows users to switch between Bubblegum Pink, Midnight Rose, and System themes
 */

import { Moon, Sun, Monitor } from "lucide-react"
import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function ThemeSwitcher() {
  const { theme, setTheme, resolvedTheme } = useTheme()

  const themes = [
    {
      name: "bubblegum-pink" as const,
      label: "Bubblegum Pink",
      icon: Sun,
      description: "Light & playful",
      swatch: "linear-gradient(135deg, #FCE7F3 0%, #FBCFE8 100%)",
    },
    {
      name: "midnight-rose" as const,
      label: "Midnight Rose",
      icon: Moon,
      description: "Dark & elegant",
      swatch: "linear-gradient(135deg, #1A1A1A 0%, #2D2D2D 100%)",
    },
    {
      name: "system" as const,
      label: "System",
      icon: Monitor,
      description: "Auto-adjust",
      swatch: "linear-gradient(135deg, #E5E7EB 0%, #9CA3AF 100%)",
    },
  ]

  const currentTheme = themes.find((t) => t.name === theme) || themes[0]
  const CurrentIcon = currentTheme.icon

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-lg transition-all duration-300 hover:bg-surface-secondary"
          aria-label="Toggle theme"
        >
          <CurrentIcon className="h-4 w-4 transition-transform duration-300" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {themes.map((themeOption) => {
          const Icon = themeOption.icon
          const isActive = theme === themeOption.name

          return (
            <DropdownMenuItem
              key={themeOption.name}
              onClick={() => setTheme(themeOption.name)}
              className={`
                flex items-center gap-3 px-3 py-2.5 cursor-pointer
                transition-all duration-300
                ${isActive ? "bg-accent-pink-100 dark:bg-accent-pink-900/20" : ""}
              `}
            >
              {/* Theme swatch */}
              <div
                className="h-8 w-8 rounded-lg border-2 border-border-light flex-shrink-0 transition-all duration-300"
                style={{
                  background: themeOption.swatch,
                  boxShadow: isActive ? "0 0 0 2px var(--accent-pink-500)" : "none",
                }}
              />

              {/* Theme info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="font-semibold text-sm truncate">
                    {themeOption.label}
                  </span>
                </div>
                <p className="text-xs text-text-secondary mt-0.5">
                  {themeOption.description}
                </p>
              </div>

              {/* Active indicator */}
              {isActive && (
                <div className="h-2 w-2 rounded-full bg-accent-pink-500 flex-shrink-0 animate-pulse" />
              )}
            </DropdownMenuItem>
          )
        })}

        {/* Current resolved theme indicator */}
        {theme === "system" && (
          <div className="px-3 py-2 mt-1 border-t border-border-light">
            <p className="text-xs text-text-tertiary">
              Currently using:{" "}
              <span className="font-semibold text-text-secondary">
                {resolvedTheme === "bubblegum-pink" ? "Bubblegum Pink" : "Midnight Rose"}
              </span>
            </p>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
