import { createContext, useContext, useEffect, useState } from "react";
import { Theme } from "@/types/theme";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const initialState: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = "dark",
  storageKey = "qckfx-ui-theme",
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
  );

  useEffect(() => {
    // Get reference to document elements
    const root = window.document.documentElement;
    const body = window.document.body;
    
    console.log('Theme effect running with theme:', theme);
    
    // Determine which theme to apply (system or explicit)
    let themeToApply = theme;
    if (theme === "system") {
      themeToApply = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light";
      console.log('System theme detected as:', themeToApply);
    }
    
    // Apply theme in multiple ways to ensure it takes effect
    
    // 1. Clean up existing classes
    root.classList.remove("light", "dark");
    body.classList.remove("light", "dark");
    
    // 2. Add the theme class to both html and body
    root.classList.add(themeToApply);
    body.classList.add(themeToApply);
    
    // 3. Set data attributes (useful for CSS selectors)
    root.setAttribute('data-theme', themeToApply);
    body.setAttribute('data-theme', themeToApply);
    
    // 4. Apply core color variables directly as inline styles
    // This ensures they take effect regardless of class processing
    if (themeToApply === 'dark') {
      document.documentElement.style.setProperty('--background', '240 10% 3.9%');
      document.documentElement.style.setProperty('--foreground', '0 0% 98%');
      document.documentElement.style.setProperty('--card', '240 10% 3.9%');
      document.documentElement.style.setProperty('--border', '240 3.7% 15.9%');
    } else {
      document.documentElement.style.setProperty('--background', '0 0% 100%');
      document.documentElement.style.setProperty('--foreground', '240 10% 3.9%');
      document.documentElement.style.setProperty('--card', '0 0% 100%');
      document.documentElement.style.setProperty('--border', '240 5.9% 90%');
    }
    
    // 5. Store theme in localStorage (in addition to the state setter below)
    localStorage.setItem(storageKey, theme);
    
    console.log('Applied theme:', themeToApply);
    console.log('Root classes:', root.classList.toString());
    console.log('Body classes:', body.classList.toString());
  }, [theme, storageKey]);

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      localStorage.setItem(storageKey, theme);
      setTheme(theme);
    },
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);
  
  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider");
  
  return context;
};