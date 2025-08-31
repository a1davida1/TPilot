import React, { createContext, useContext, useEffect, useState } from "react"

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

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "thottopilot-ui-theme",
  forcedTheme,
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = React.useState<Theme>(
    () => forcedTheme || (typeof localStorage !== 'undefined' ? localStorage.getItem(storageKey) as Theme : null) || defaultTheme
  )
  const [resolvedTheme, setResolvedTheme] = React.useState<"dark" | "light">(forcedTheme || "light")

  React.useEffect(() => {
    const root = window.document.documentElement

    root.classList.remove("light", "dark")

    let systemTheme: "dark" | "light" = "light"
    
    if (theme === "system") {
      systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light"
    }

    const finalResolvedTheme = forcedTheme || (theme === "system" ? systemTheme : theme)
    setResolvedTheme(finalResolvedTheme)
    root.classList.add(finalResolvedTheme)
  }, [theme, forcedTheme])

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(storageKey, theme)
      }
      setTheme(theme)
    },
    resolvedTheme,
  }

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