import React, { useRef, useEffect } from 'react';

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
    }
  }, [activeTabId, children]);

  return (
    <div
      ref={containerRef}
      id={id}
      className={`flex overflow-x-auto no-scrollbar whitespace-nowrap flex-nowrap w-full gap-1.5 scroll-smooth select-none ${noBorder ? '' : 'border-b border-zinc-900 pb-px'} ${className}`}
      style={{
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none'
      }}
    >
      {children}
    </div>
  );
}
