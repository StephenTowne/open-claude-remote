import { useState, useEffect } from 'react';

/**
 * Hook for detecting mobile devices
 * Combines user agent sniffing with screen width check
 *
 * 移动端检测 hook
 * 结合 user agent 检测和屏幕宽度判断
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const ua = navigator.userAgent;
      const isMobileUA = /iPhone|iPad|iPod|Android/i.test(ua);
      const isSmallScreen = window.innerWidth < 768;
      setIsMobile(isMobileUA || isSmallScreen);
    };

    checkMobile();

    // Re-check on resize
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
}
