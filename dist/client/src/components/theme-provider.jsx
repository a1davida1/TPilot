import React, { createContext } from "react";
const initialState = {
    theme: "system",
    setTheme: () => null,
    resolvedTheme: "light",
};
const ThemeProviderContext = createContext(initialState);
export function ThemeProvider({ children, defaultTheme = "system", storageKey = "thottopilot-ui-theme", forcedTheme, ...props }) {
    const [theme, setTheme] = React.useState(() => forcedTheme || (typeof localStorage !== 'undefined' ? localStorage.getItem(storageKey) : null) || defaultTheme);
    const [resolvedTheme, setResolvedTheme] = React.useState(forcedTheme || "light");
    React.useEffect(() => {
        const root = window.document.documentElement;
        root.classList.remove("light", "dark");
        let systemTheme = "light";
        if (theme === "system") {
            systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
                .matches
                ? "dark"
                : "light";
        }
        const finalResolvedTheme = forcedTheme || (theme === "system" ? systemTheme : theme);
        setResolvedTheme(finalResolvedTheme);
        root.classList.add(finalResolvedTheme);
    }, [theme, forcedTheme]);
    const value = {
        theme,
        setTheme: (theme) => {
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem(storageKey, theme);
            }
            setTheme(theme);
        },
        resolvedTheme,
    };
    return (<ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>);
}
export const useTheme = () => {
    const context = React.useContext(ThemeProviderContext);
    if (context === undefined)
        throw new Error("useTheme must be used within a ThemeProvider");
    return context;
};
