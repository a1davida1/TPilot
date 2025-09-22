import React, { createContext } from "react"

type Theme = "dark" | "light" | "system"

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
  forcedTheme?: "light" | "dark"
}

type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme) => void
  resolvedTheme: "dark" | "light"
}

const initialState: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
  resolvedTheme: "light",
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

const isTheme = (value: string): value is Theme => value === "light" || value === "dark" || value === "system"

const getSystemPreference = () => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "light" as const
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "thottopilot-ui-theme",
  forcedTheme,
  ...props
}: ThemeProviderProps) {
  const readStoredTheme = (): Theme | null => {
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

  const [theme, setThemeState] = React.useState<Theme>(initialTheme)
  const [resolvedTheme, setResolvedTheme] = React.useState<"dark" | "light">(
    forcedTheme ?? (initialTheme === "system" ? getSystemPreference() : initialTheme)
  )

  const setTheme = React.useCallback(
    (value: Theme) => {
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

  React.useEffect(() => {
    setResolvedTheme(forcedTheme ?? (theme === "system" ? getSystemPreference() : theme))
  }, [theme, forcedTheme])

  React.useEffect(() => {
    if (typeof document === "undefined") {
      return
    }

    const root = document.documentElement
    root.classList.remove("light", "dark")
    root.classList.add(resolvedTheme)
  }, [resolvedTheme])

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
      setResolvedTheme(event.matches ? "dark" : "light")
    }

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange)
      return () => mediaQuery.removeEventListener("change", handleChange)
    }

    mediaQuery.addListener(handleChange)
    return () => mediaQuery.removeListener(handleChange)
  }, [theme, forcedTheme])

  const value = React.useMemo(
    () => ({
      theme,
      setTheme,
      resolvedTheme,
    }),
    [theme, setTheme, resolvedTheme]
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