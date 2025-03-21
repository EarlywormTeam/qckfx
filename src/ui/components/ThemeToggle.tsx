import { Moon, Sun } from "lucide-react";
import { useTheme } from "./ThemeProvider";
import { useState, useEffect } from "react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [currentTheme, setCurrentTheme] = useState(theme);

  // Make sure component doesn't render differently server-side vs client-side
  useEffect(() => {
    setMounted(true);
    setCurrentTheme(theme);
  }, [theme]);

  const toggleTheme = () => {
    console.log('Current theme:', theme);
    const newTheme = theme === "dark" ? "light" : "dark";
    console.log('Setting theme to:', newTheme);
    
    // Apply directly to document for immediate visual feedback
    const el = document.documentElement;
    if (newTheme === 'dark') {
      el.classList.add('dark');
      el.classList.remove('light');
    } else {
      el.classList.add('light');
      el.classList.remove('dark');
    }
    
    // Set in context state
    setTheme(newTheme);
    setCurrentTheme(newTheme);
    
    // Force styles to be applied
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 0);
  };

  // Don't render until mounted to prevent hydration mismatch
  if (!mounted) return null;

  const isDark = currentTheme === 'dark';

  return (
    <button
      className="inline-flex items-center justify-center rounded-md p-2 hover:bg-accent hover:text-accent-foreground"
      onClick={toggleTheme}
      data-testid="theme-toggle"
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      {isDark ? (
        <Sun className="h-[1.2rem] w-[1.2rem]" />
      ) : (
        <Moon className="h-[1.2rem] w-[1.2rem]" />
      )}
      <span className="sr-only">Toggle theme</span>
    </button>
  );
}