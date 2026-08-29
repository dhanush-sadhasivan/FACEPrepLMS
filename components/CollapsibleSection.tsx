'use client';

import React, { useState, useEffect, useRef } from 'react';
import './CollapsibleSection.css';

export interface CollapsibleSectionProps {
  id: string;
  title: string;
  icon?: string;
  defaultExpanded?: boolean;
  badge?: string | number;
  children: React.ReactNode;
}

export function CollapsibleSection({
  id,
  title,
  icon,
  defaultExpanded = true,
  badge,
  children,
}: CollapsibleSectionProps) {
  const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded);
  const [isMounted, setIsMounted] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    setIsMounted(true);
    const stored = localStorage.getItem(`collapsible-${id}`);
    if (stored !== null) {
      setIsExpanded(stored === 'true');
    }
  }, [id]);

  useEffect(() => {
    if (isMounted) {
      localStorage.setItem(`collapsible-${id}`, String(isExpanded));
    }
  }, [isExpanded, id, isMounted]);

  useEffect(() => {
    if (contentRef.current) {
      // Update height when expanded changes or children might change
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [isExpanded, children]);

  const toggleExpanded = () => {
    setIsExpanded((prev) => !prev);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleExpanded();
    }
  };

  // We only render visually matching content after hydration to avoid mismatch, 
  // but we can render the structure right away.
  const expandedClass = isExpanded ? 'expanded' : 'collapsed';

  return (
    <div className="collapsible-section">
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        className="collapsible-header"
        onClick={toggleExpanded}
        onKeyDown={handleKeyDown}
      >
        <span className={`collapsible-chevron ${expandedClass}`}>▾</span>
        {icon && <span className="collapsible-icon">{icon}</span>}
        <span className="collapsible-title">{title}</span>
        {badge !== undefined && <span className="collapsible-badge">{badge}</span>}
      </div>
      
      <div 
        className={`collapsible-body ${expandedClass}`}
        style={{ maxHeight: isExpanded ? `${contentHeight || 10000}px` : '0px' }}
      >
        <div className="collapsible-content" ref={contentRef}>
          {children}
        </div>
      </div>
    </div>
  );
}
