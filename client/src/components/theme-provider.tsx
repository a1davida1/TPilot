import React, { createContext } from "react"
import { bubblegumPinkTheme, midnightRoseTheme, type Theme as ThemeConfig } from "@/styles/themes"

type ThemeName = "bubblegum-pink" | "midnight-rose" | "system"

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: ThemeName
  storageKey?: string
  forcedTheme?: "bubblegum-pink" | "midnight-rose"
}

type ThemeProviderState = {
  theme: ThemeName
  setTheme: (theme: ThemeName) => void
  resolvedTheme: "bubblegum-pink" | "midnight-rose"
  themeConfig: ThemeConfig
  toggleTheme: () => void
}

const initialState: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
  resolvedTheme: "bubblegum-pink",
  themeConfig: bubblegumPinkTheme,
  toggleTheme: () => null,
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

const isTheme = (value: string): value is ThemeName => 
  value === "bubblegum-pink" || value === "midnight-rose" || value === "system"

const _getSystemPreference = (): "bubblegum-pink" | "midnight-rose" => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "bubblegum-pink"
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "midnight-rose" : "bubblegum-pink"
}

const getTimeBasedTheme = (): "bubblegum-pink" | "midnight-rose" => {
  const hour = new Date().getHours()
  // 6 AM - 6 PM = light theme, 6 PM - 6 AM = dark theme
  return (hour >= 6 && hour < 18) ? "bubblegum-pink" : "midnight-rose"
}

const applyThemeToDOM = (themeConfig: ThemeConfig) => {
  if (typeof document === "undefined") return

  const root = document.documentElement
  
  // Apply background colors
  root.style.setProperty('--background-primary', themeConfig.background.primary)
  root.style.setProperty('--background-secondary', themeConfig.background.secondary)
  root.style.setProperty('--background-tertiary', themeConfig.background.tertiary)
  
  // Apply surface colors
  root.style.setProperty('--surface-primary', themeConfig.surface.primary)
  root.style.setProperty('--surface-secondary', themeConfig.surface.secondary)
  root.style.setProperty('--surface-elevated', themeConfig.surface.elevated)
  root.style.setProperty('--surface-glass', themeConfig.surface.glass)
  
  // Apply text colors
  root.style.setProperty('--text-primary', themeConfig.text.primary)
  root.style.setProperty('--text-secondary', themeConfig.text.secondary)
  root.style.setProperty('--text-tertiary', themeConfig.text.tertiary)
  root.style.setProperty('--text-disabled', themeConfig.text.disabled)
  
  // Apply accent colors (pink)
  Object.entries(themeConfig.accent.pink).forEach(([key, value]) => {
    root.style.setProperty(`--accent-pink-${key}`, value)
  })
  
  // Apply accent colors (blue)
  Object.entries(themeConfig.accent.blue).forEach(([key, value]) => {
    root.style.setProperty(`--accent-blue-${key}`, value)
  })
  
  // Apply accent colors (purple)
  Object.entries(themeConfig.accent.purple).forEach(([key, value]) => {
    root.style.setProperty(`--accent-purple-${key}`, value)
  })
  
  // Apply border colors
  root.style.setProperty('--border-subtle', themeConfig.border.subtle)
  root.style.setProperty('--border-light', themeConfig.border.light)
  root.style.setProperty('--border-medium', themeConfig.border.medium)
  root.style.setProperty('--border-strong', themeConfig.border.strong)
  
  // Apply semantic colors
  root.style.setProperty('--semantic-success-bg', themeConfig.semantic.success.bg)
  root.style.setProperty('--semantic-success-text', themeConfig.semantic.success.text)
  root.style.setProperty('--semantic-success-border', themeConfig.semantic.success.border)
  
  root.style.setProperty('--semantic-warning-bg', themeConfig.semantic.warning.bg)
  root.style.setProperty('--semantic-warning-text', themeConfig.semantic.warning.text)
  root.style.setProperty('--semantic-warning-border', themeConfig.semantic.warning.border)
  
  root.style.setProperty('--semantic-error-bg', themeConfig.semantic.error.bg)
  root.style.setProperty('--semantic-error-text', themeConfig.semantic.error.text)
  root.style.setProperty('--semantic-error-border', themeConfig.semantic.error.border)
  
  root.style.setProperty('--semantic-info-bg', themeConfig.semantic.info.bg)
  root.style.setProperty('--semantic-info-text', themeConfig.semantic.info.text)
  root.style.setProperty('--semantic-info-border', themeConfig.semantic.info.border)
  
  // Apply shadow colors
  root.style.setProperty('--shadow-sm', themeConfig.shadow.sm)
  root.style.setProperty('--shadow-md', themeConfig.shadow.md)
  root.style.setProperty('--shadow-lg', themeConfig.shadow.lg)
  root.style.setProperty('--shadow-xl', themeConfig.shadow.xl)
  root.style.setProperty('--shadow-pink', themeConfig.shadow.pink)
  
  // Apply interactive states
  root.style.setProperty('--interactive-hover', themeConfig.interactive.hover)
  root.style.setProperty('--interactive-active', themeConfig.interactive.active)
  root.style.setProperty('--interactive-focus', themeConfig.interactive.focus)
  
  // Update class for legacy compatibility
  root.classList.remove('light', 'dark', 'bubblegum-pink', 'midnight-rose')
  root.classList.add(themeConfig.name)
  
  // Also add light/dark for backward compatibility
  if (themeConfig.name === 'bubblegum-pink') {
    root.classList.add('light')
  } else {
    root.classList.add('dark')
  }
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "thottopilot-ui-theme",
  forcedTheme,
  ...props
}: ThemeProviderProps) {
  const readStoredTheme = (): ThemeName | null => {
    if (typeof window === "undefined" || !("localStorage" in window)) {
      return null
    }

    try {
      const storedValue = window.localStorage.getItem(storageKey)

      if (storedValue && isTheme(storedValue)) {
        return storedValue
      }
    } catch {
      return null
    }

    return null
  }

  const initialTheme = forcedTheme ?? readStoredTheme() ?? defaultTheme

  const [theme, setThemeState] = React.useState<ThemeName>(initialTheme)
  const [resolvedTheme, setResolvedTheme] = React.useState<"bubblegum-pink" | "midnight-rose">(
    forcedTheme ?? (initialTheme === "system" ? getTimeBasedTheme() : initialTheme)
  )
  const [themeConfig, setThemeConfig] = React.useState<ThemeConfig>(
    (resolvedTheme === "midnight-rose" ? midnightRoseTheme : bubblegumPinkTheme) as ThemeConfig
  )

  const setTheme = React.useCallback(
    (value: ThemeName) => {
      setThemeState(value)

      if (typeof window === "undefined" || !("localStorage" in window)) {
        return
      }

      try {
        window.localStorage.setItem(storageKey, value)
      } catch {
        // Ignore write errors such as private browsing restrictions
      }
    },
    [storageKey]
  )

  const toggleTheme = React.useCallback(() => {
    const newTheme = resolvedTheme === "bubblegum-pink" ? "midnight-rose" : "bubblegum-pink"
    setTheme(newTheme)
  }, [resolvedTheme, setTheme])

  React.useEffect(() => {
    const resolved = forcedTheme ?? (theme === "system" ? getTimeBasedTheme() : theme)
    setResolvedTheme(resolved)
    setThemeConfig((resolved === "midnight-rose" ? midnightRoseTheme : bubblegumPinkTheme) as ThemeConfig)
  }, [theme, forcedTheme])

  React.useEffect(() => {
    applyThemeToDOM(themeConfig)
  }, [themeConfig])

  React.useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function" ||
      forcedTheme ||
      theme !== "system"
    ) {
      return
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")

    const handleChange = (event: MediaQueryListEvent) => {
      const newTheme = event.matches ? "midnight-rose" : "bubblegum-pink"
      setResolvedTheme(newTheme)
      setThemeConfig((newTheme === "midnight-rose" ? midnightRoseTheme : bubblegumPinkTheme) as ThemeConfig)
    }

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange)
      return () => mediaQuery.removeEventListener("change", handleChange)
    }

    mediaQuery.addListener(handleChange)
    return () => mediaQuery.removeListener(handleChange)
  }, [theme, forcedTheme])

  // Auto-theme based on time of day (updates every minute)
  React.useEffect(() => {
    if (theme !== "system") return

    const checkTime = () => {
      const newTheme = getTimeBasedTheme()
      if (newTheme !== resolvedTheme) {
        setResolvedTheme(newTheme)
        setThemeConfig((newTheme === "midnight-rose" ? midnightRoseTheme : bubblegumPinkTheme) as ThemeConfig)
      }
    }

    // Check every minute
    const interval = setInterval(checkTime, 60000)
    return () => clearInterval(interval)
  }, [theme, resolvedTheme])

  const value = React.useMemo(
    () => ({
      theme,
      setTheme,
      resolvedTheme,
      themeConfig,
      toggleTheme,
    }),
    [theme, setTheme, resolvedTheme, themeConfig, toggleTheme]
  )

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = React.useContext(ThemeProviderContext)

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider")

  return context
}