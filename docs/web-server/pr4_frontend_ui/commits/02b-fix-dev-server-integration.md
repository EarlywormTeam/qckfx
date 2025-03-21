# Fix Development Server Integration

## Commit Message
Fix development server integration to properly display the UI

## Changes

### 1. Update Vite Configuration to Correctly Use Root index.html
```diff
// vite.config.ts
export default defineConfig(({ command, mode }) => {
  const isProduction = mode === 'production';
  
  return {
+   // Explicitly set the root directory and entry point
+   root: './',
+   // Disable the public directory to prevent it from overriding the root index.html
+   publicDir: false,
    plugins: [
      react(),
      splitVendorChunkPlugin(),
      createHtmlPlugin({
        minify: isProduction,
        inject: {
          data: {
            title: 'QCKFX Agent',
          },
        },
+       template: 'index.html',
      }),
    ],
    // ... rest of configuration
  };
});
```

The issue was with how Vite handles the `public` directory. In Vite, files in the `public` directory are served at the root path and can take precedence over other files. This was causing the placeholder public/index.html to be shown instead of our actual React application's root index.html.

Our fix addresses this by:
1. Setting `root: './'` to ensure Vite looks for the entry point in the project root
2. Setting `publicDir: false` to disable the special handling of the public directory during development
3. Specifying `template: 'index.html'` to explicitly tell Vite which HTML file to use as the entry point

This ensures that when developers run `npm run dev:ui`, they'll see the actual React application instead of the placeholder page from public/index.html.

### 2. Add a development mode indicator in Terminal component (Optional Enhancement)
```diff
// src/ui/components/Terminal/Terminal.tsx
import React, { useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import MessageFeed, { type Message } from '@/components/MessageFeed';

export interface TerminalProps {
  className?: string;
  messages?: Message[];
  fullScreen?: boolean;
}

export function Terminal({ className, messages = [], fullScreen = false }: TerminalProps) {
  // ... existing code

  return (
    <div
      ref={terminalRef}
      className={cn(
        'flex flex-col bg-black text-green-500 font-mono rounded-md border border-gray-700 overflow-hidden',
        fullScreen ? 'h-full w-full' : 'h-[500px] w-full max-w-4xl',
        className
      )}
      tabIndex={0}
      data-testid="terminal-container"
    >
      <div className="flex items-center bg-gray-900 px-4 py-2 border-b border-gray-700">
        <div className="flex space-x-2">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
        </div>
-       <div className="flex-1 text-center text-sm text-gray-400">QCKFX Terminal</div>
+       <div className="flex-1 text-center text-sm text-gray-400">
+         QCKFX Terminal
+         {import.meta.env.DEV && <span className="ml-2 text-xs bg-green-800 text-white py-0.5 px-1 rounded">DEV</span>}
+       </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <MessageFeed messages={messages} />
      </div>
    </div>
  );
}
```