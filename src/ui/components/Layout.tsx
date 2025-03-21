import { ReactNode } from "react";
import { ThemeToggle } from "./ThemeToggle";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="flex flex-col h-screen">
      <header className="border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-bold text-xl">qckfx</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </header>
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
      <footer className="border-t py-2 px-4 text-center text-xs text-muted-foreground">
        <p>© {new Date().getFullYear()} qckfx</p>
      </footer>
    </div>
  );
}

export default Layout;