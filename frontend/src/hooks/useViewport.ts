import { useState, useEffect } from 'react';

/**
 * Detects software keyboard height on mobile using the Visual Viewport API.
 * Returns the keyboard offset in pixels.
 */
export function useViewport() {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const handleResize = () => {
      const offset = window.innerHeight - vv.height;
      setKeyboardHeight(Math.max(0, offset));
    };

    vv.addEventListener('resize', handleResize);
    return () => vv.removeEventListener('resize', handleResize);
  }, []);

  return { keyboardHeight };
}
