import React, { useEffect } from "react"
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { createRoot } from "react-dom/client"
import type { Root } from "react-dom/client"
import { act } from "react"

import { ThemeProvider, useTheme } from "./theme-provider"

type Theme = "light" | "dark" | "system"

type Snapshot = {
  theme: Theme
  resolvedTheme: "light" | "dark"
}

const flushEffects = async () => {
  await act(async () => {
    await Promise.resolve()
  })
}

describe("ThemeProvider", () => {
  const storageKey = "thottopilot-ui-theme"
  const originalMatchMedia = window.matchMedia
  let container: HTMLDivElement | null
  let root: Root | null

  beforeEach(() => {
    localStorage.clear()
    document.documentElement.className = ""

    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    vi.restoreAllMocks()

    act(() => {
      root?.unmount()
    })

    container?.remove()
    root = null
    container = null

    if (originalMatchMedia) {
      window.matchMedia = originalMatchMedia
    } else {
      Reflect.deleteProperty(window, "matchMedia")
    }
  })

  it("persists selection and updates resolved theme across light, dark, and system modes", async () => {
    const snapshots: Snapshot[] = []
    let updateTheme: ((value: Theme) => void) | undefined
    let systemPrefersDark = false
    const listeners = new Set<(event: MediaQueryListEvent) => void>()

    window.matchMedia = vi
      .fn()
      .mockImplementation((query: string) => {
        const mediaQuery = {
          matches: systemPrefersDark,
          media: query,
          onchange: null,
          addEventListener: (eventName: string, listener: (event: MediaQueryListEvent) => void) => {
            if (eventName === "change") {
              listeners.add(listener)
            }
          },
          removeEventListener: (eventName: string, listener: (event: MediaQueryListEvent) => void) => {
            if (eventName === "change") {
              listeners.delete(listener)
            }
          },
          addListener: (listener: (event: MediaQueryListEvent) => void) => {
            listeners.add(listener)
          },
          removeListener: (listener: (event: MediaQueryListEvent) => void) => {
            listeners.delete(listener)
          },
          dispatchEvent: (event: MediaQueryListEvent) => {
            listeners.forEach(listener => listener(event))
            return true
          },
        } as MediaQueryList

        Object.defineProperty(mediaQuery, "matches", {
          get: () => systemPrefersDark,
        })

        return mediaQuery
      }) as unknown as typeof window.matchMedia

    const emitSystemChange = () => {
      const event = { matches: systemPrefersDark } as MediaQueryListEvent
      listeners.forEach(listener => listener(event))
    }

    const recordSnapshot = (snapshot: Snapshot) => {
      const last = snapshots[snapshots.length - 1]

      if (!last || last.theme !== snapshot.theme || last.resolvedTheme !== snapshot.resolvedTheme) {
        snapshots.push(snapshot)
      }
    }

    const requireSetTheme = () => {
      if (!updateTheme) {
        throw new Error("Theme updater is not available")
      }

      return updateTheme
    }

    const getLatestSnapshot = () => {
      const snapshot = snapshots[snapshots.length - 1]

      if (!snapshot) {
        throw new Error("No theme snapshot was recorded")
      }

      return snapshot
    }

    localStorage.setItem(storageKey, "dark")

    function Consumer() {
      const context = useTheme()

      useEffect(() => {
        updateTheme = context.setTheme
        recordSnapshot({ theme: context.theme, resolvedTheme: context.resolvedTheme })
      }, [context.theme, context.resolvedTheme, context.setTheme])

      return null
    }

    await act(async () => {
      root?.render(
        <ThemeProvider storageKey={storageKey} defaultTheme="system">
          <Consumer />
        </ThemeProvider>
      )
    })

    await flushEffects()

    expect(getLatestSnapshot()).toEqual({ theme: "dark", resolvedTheme: "dark" })
    expect(localStorage.getItem(storageKey)).toBe("dark")
    expect(document.documentElement.classList.contains("dark")).toBe(true)

    await act(async () => {
      requireSetTheme()("light")
    })

    await flushEffects()

    expect(getLatestSnapshot()).toEqual({ theme: "light", resolvedTheme: "light" })
    expect(localStorage.getItem(storageKey)).toBe("light")
    expect(document.documentElement.classList.contains("light")).toBe(true)

    systemPrefersDark = true

    await act(async () => {
      requireSetTheme()("system")
    })

    await flushEffects()

    expect(getLatestSnapshot()).toEqual({ theme: "system", resolvedTheme: "dark" })
    expect(localStorage.getItem(storageKey)).toBe("system")
    expect(document.documentElement.classList.contains("dark")).toBe(true)

    systemPrefersDark = false
    
    await act(async () => {
      emitSystemChange()
    })

    await flushEffects()

    expect(getLatestSnapshot()).toEqual({ theme: "system", resolvedTheme: "light" })
    expect(document.documentElement.classList.contains("light")).toBe(true)
  })
})