import React from 'react';
import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTheme } from "@/components/theme-provider"

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(resolvedTheme === "light" ? "dark" : "light")}
      className="h-9 w-9 rounded-full border-2 border-transparent hover:border-primary/20 hover:bg-primary/10 dark:hover:bg-primary/20 transition-all duration-300 ease-in-out hover:scale-105 active:scale-95"
      data-testid="theme-toggle"
      aria-label={`Switch to ${resolvedTheme === "light" ? "dark" : "light"} mode`}
    >
      <div className="relative flex items-center justify-center">
        <Sun className="h-4 w-4 rotate-0 scale-100 transition-all duration-300 ease-in-out dark:-rotate-90 dark:scale-0 text-primary" />
        <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all duration-300 ease-in-out dark:rotate-0 dark:scale-100 text-primary" />
      </div>
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}