import React, { useRef, useEffect, useState, useCallback } from 'react';

interface ResponsiveTabsContainerProps {
  children: React.ReactNode;
  activeTabId?: string; // Optional ID of the currently active tab to auto-scroll it into view
  className?: string;   // Extra custom classes
  id?: string;
  noBorder?: boolean;   // If true, removes the default border bottom styling
}

export default function ResponsiveTabsContainer({
  children,
  activeTabId,
  className = '',
  id,
  noBorder = false
}: ResponsiveTabsContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollFades = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateScrollFades();
    const el = containerRef.current;
    if (!el) return;

    el.addEventListener('scroll', updateScrollFades, { passive: true });
    const resizeObserver = new ResizeObserver(updateScrollFades);
    resizeObserver.observe(el);

    return () => {
      el.removeEventListener('scroll', updateScrollFades);
      resizeObserver.disconnect();
    };
  }, [children, updateScrollFades]);

  useEffect(() => {
    if (activeTabId && containerRef.current) {
      // Find the active tab button element inside the container
      const activeEl = containerRef.current.querySelector(`#${activeTabId}`)
        || containerRef.current.querySelector(`[data-tab-id="${activeTabId}"]`);

      if (activeEl) {
        activeEl.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center'
        });
      }
      // Scroll position changed programmatically — re-check fade state shortly after.
      setTimeout(updateScrollFades, 350);
    }
  }, [activeTabId, children, updateScrollFades]);

  // Fade the actual content at the edges (via mask) instead of overlaying a solid-color div —
  // this works correctly regardless of what background sits behind the tab bar (cards vary).
  const fadeMask = (() => {
    const edge = '20px';
    if (canScrollLeft && canScrollRight) {
      return `linear-gradient(to right, transparent, black ${edge}, black calc(100% - ${edge}), transparent)`;
    }
    if (canScrollRight) {
      return `linear-gradient(to right, black, black calc(100% - ${edge}), transparent)`;
    }
    if (canScrollLeft) {
      return `linear-gradient(to right, transparent, black ${edge}, black)`;
    }
    return undefined;
  })();

  return (
    <div
      ref={containerRef}
      id={id}
      className={`flex overflow-x-auto no-scrollbar whitespace-nowrap flex-nowrap w-full gap-1.5 scroll-smooth select-none ${noBorder ? '' : 'border-b border-zinc-900 pb-px'} ${className}`}
      style={{
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        ...(fadeMask ? { WebkitMaskImage: fadeMask, maskImage: fadeMask } : {})
      }}
    >
      {children}
    </div>
  );
}
