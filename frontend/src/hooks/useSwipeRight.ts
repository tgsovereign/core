import { useEffect, useRef } from "react";

/**
 * Calls `onSwipeRight` when the user swipes right from the left edge of the
 * screen on a touch device. Only the first 30px of the viewport counts as the
 * edge zone so it won't interfere with normal horizontal scrolling.
 */
export function useSwipeRight(onSwipeRight: () => void) {
  const onSwipeRightRef = useRef(onSwipeRight);
  onSwipeRightRef.current = onSwipeRight;

  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let tracking = false;

    const EDGE_ZONE = 30; // px from left edge
    const MIN_DISTANCE = 50; // min horizontal travel
    const MAX_RATIO = 0.75; // max vertical/horizontal ratio

    function onTouchStart(e: TouchEvent) {
      const touch = e.touches[0];
      if (touch.clientX <= EDGE_ZONE) {
        startX = touch.clientX;
        startY = touch.clientY;
        tracking = true;
      }
    }

    function onTouchEnd(e: TouchEvent) {
      if (!tracking) return;
      tracking = false;

      const touch = e.changedTouches[0];
      const dx = touch.clientX - startX;
      const dy = Math.abs(touch.clientY - startY);

      if (dx >= MIN_DISTANCE && dy / dx <= MAX_RATIO) {
        onSwipeRightRef.current();
      }
    }

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, []);
}
