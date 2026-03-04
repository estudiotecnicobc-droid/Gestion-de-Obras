import React, { useState, useEffect, useRef, useCallback } from 'react';

interface ResizableSplitPaneProps {
  left: React.ReactNode;
  right: React.ReactNode;
  initialLeftWidth?: number;
  minLeftWidth?: number;
  maxLeftWidth?: number;
  storageKey?: string;
  splitterWidth?: number;
  className?: string;
}

export const ResizableSplitPane: React.FC<ResizableSplitPaneProps> = ({
  left,
  right,
  initialLeftWidth = 300,
  minLeftWidth = 200,
  maxLeftWidth = 800,
  storageKey,
  splitterWidth = 4,
  className = '',
}) => {
  // Initialize width from storage or props
  const [leftWidth, setLeftWidth] = useState<number>(() => {
    if (storageKey) {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = parseFloat(saved);
        if (!isNaN(parsed)) {
          return Math.max(minLeftWidth, Math.min(maxLeftWidth, parsed));
        }
      }
    }
    return initialLeftWidth;
  });

  const [isDragging, setIsDragging] = useState(false);
  const splitterRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Persist to storage
  useEffect(() => {
    if (storageKey) {
      localStorage.setItem(storageKey, leftWidth.toString());
    }
  }, [leftWidth, storageKey]);

  // Pointer Events Handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !containerRef.current) return;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const newWidth = e.clientX - containerRect.left;
    
    // Apply constraints
    const constrainedWidth = Math.max(minLeftWidth, Math.min(maxLeftWidth, newWidth));
    setLeftWidth(constrainedWidth);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  // Keyboard Accessibility
  const handleKeyDown = (e: React.KeyboardEvent) => {
    let delta = 0;
    if (e.key === 'ArrowLeft') delta = -10;
    if (e.key === 'ArrowRight') delta = 10;
    
    if (delta !== 0) {
      if (e.shiftKey) delta *= 5;
      e.preventDefault();
      setLeftWidth(prev => Math.max(minLeftWidth, Math.min(maxLeftWidth, prev + delta)));
    }
  };

  const handleDoubleClick = () => {
    setLeftWidth(initialLeftWidth);
  };

  return (
    <div 
      ref={containerRef} 
      className={`flex h-full w-full overflow-hidden ${className}`}
    >
      {/* Left Panel */}
      <div 
        style={{ width: leftWidth, minWidth: minLeftWidth, maxWidth: maxLeftWidth }}
        className="flex-shrink-0 overflow-hidden flex flex-col"
      >
        {left}
      </div>

      {/* Splitter */}
      <div
        ref={splitterRef}
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={leftWidth}
        aria-valuemin={minLeftWidth}
        aria-valuemax={maxLeftWidth}
        tabIndex={0}
        className={`
          relative z-10 flex-shrink-0 cursor-col-resize bg-slate-200 hover:bg-blue-400 transition-colors
          focus:outline-none focus:bg-blue-500
          ${isDragging ? 'bg-blue-500' : ''}
        `}
        style={{ width: splitterWidth }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onKeyDown={handleKeyDown}
        onDoubleClick={handleDoubleClick}
      >
        {/* Invisible hit area for easier grabbing */}
        <div className="absolute inset-y-0 -left-1 -right-1 z-20 cursor-col-resize" />
        
        {/* Visual Handle Icon (Optional) */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-8 bg-slate-400 rounded-full opacity-50 pointer-events-none" />
      </div>

      {/* Right Panel */}
      <div className="flex-1 overflow-hidden flex flex-col min-w-0">
        {right}
      </div>

      {/* Global Cursor Style during Drag */}
      {isDragging && (
        <style>{`
          body {
            cursor: col-resize !important;
            user-select: none !important;
            -webkit-user-select: none !important;
          }
        `}</style>
      )}
    </div>
  );
};
