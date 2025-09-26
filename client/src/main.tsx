import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const themeStorageKey = "thottopilot-ui-theme"

type StoredTheme = "dark" | "light" | "system"

const isStoredTheme = (value: string | null): value is StoredTheme =>
  value === "dark" || value === "light" || value === "system"

const readStoredTheme = (): StoredTheme | null => {
  if (typeof window === "undefined" || !("localStorage" in window)) {
    return null
  }

  try {
    const storedValue = window.localStorage.getItem(themeStorageKey)
    return isStoredTheme(storedValue) ? storedValue : null
  } catch {
    return null
  }
}

const resolveTheme = (): "dark" | "light" => {
  const storedTheme = readStoredTheme()

  if (storedTheme === "dark" || storedTheme === "light") {
    return storedTheme
  }

  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
  }

  return "light"
}

if (typeof document !== "undefined") {
  const resolvedTheme = resolveTheme()
  const root = document.documentElement
  root.classList.remove("light", "dark")
  root.classList.add(resolvedTheme)
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error('Root element not found');
}

try {
  createRoot(rootElement).render(<App />);
} catch (_error) {
  console.error('Failed to render app:', _error);
  rootElement.innerHTML = `
    <div style="padding: 20px; text-align: center;">
      <h1>Loading Error</h1>
      <p>There was an error loading the application. Please refresh the page.</p>
      <button onclick="window.location.reload()">Refresh</button>
    </div>
  `;
}
