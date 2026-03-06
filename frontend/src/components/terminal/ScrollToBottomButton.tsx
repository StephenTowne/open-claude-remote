import { useEffect, useState } from 'react';
import './ScrollToBottomButton.css';

interface ScrollToBottomButtonProps {
  visible: boolean;
  onClick: () => void;
}

export function ScrollToBottomButton({ visible, onClick }: ScrollToBottomButtonProps) {
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
    }
  }, [visible]);

  const handleAnimationEnd = () => {
    if (!visible) {
      setShouldRender(false);
    }
  };

  if (!shouldRender) return null;

  return (
    <button
      className={`scroll-to-bottom-btn ${visible ? 'visible' : 'hidden'}`}
      onClick={onClick}
      onAnimationEnd={handleAnimationEnd}
      aria-label="Jump to latest output"
    >
      ↓
    </button>
  );
}