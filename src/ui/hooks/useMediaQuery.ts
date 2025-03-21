import { useState, useEffect } from 'react';

/**
 * Hook to check if a media query matches
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    // Check if window is available (for SSR)
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia(query);
      
      // Set initial value
      setMatches(mediaQuery.matches);
  
      // Update the value when it changes
      const handler = (event: MediaQueryListEvent) => {
        setMatches(event.matches);
      };
  
      // Add listener (with modern and legacy approach for wider browser support)
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handler);
      } else {
        // @ts-ignore - older browsers
        mediaQuery.addListener(handler);
      }
  
      // Clean up
      return () => {
        if (mediaQuery.removeEventListener) {
          mediaQuery.removeEventListener('change', handler);
        } else {
          // @ts-ignore - older browsers
          mediaQuery.removeListener(handler);
        }
      };
    }
    
    return undefined;
  }, [query]);

  return matches;
}

/**
 * Predefined hooks for common screen sizes
 */
export const useIsSmallScreen = () => useMediaQuery('(max-width: 639px)');
export const useIsMediumScreen = () => useMediaQuery('(min-width: 640px) and (max-width: 1023px)');
export const useIsLargeScreen = () => useMediaQuery('(min-width: 1024px)');

export default useMediaQuery;