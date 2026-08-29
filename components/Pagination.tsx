'use client';

import React, { useMemo } from 'react';
import './Pagination.css';

export interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}

export function Pagination({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50],
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  
  // Calculate item range
  const startItem = Math.min(totalItems, (currentPage - 1) * pageSize + 1);
  const endItem = Math.min(totalItems, currentPage * pageSize);

  // Generate page numbers with ellipsis (max 5 page buttons total usually)
  const pageNumbers = useMemo(() => {
    const pages: (number | string)[] = [];
    
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, 4, '...', totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
      }
    }
    return pages;
  }, [currentPage, totalPages]);

  return (
    <div className="pagination-container" role="navigation" aria-label="Pagination Navigation">
      <div className="pagination-info">
        Showing {startItem}–{endItem} of {totalItems} results
      </div>

      <div className="pagination-controls-wrapper">
        <div className="pagination-controls">
          <button
            className="pagination-btn pagination-prev"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
            aria-label="Previous page"
          >
            ←
          </button>
          
          <div className="pagination-pages">
            {pageNumbers.map((page, index) => (
              page === '...' ? (
                <span key={`ellipsis-${index}`} className="pagination-ellipsis">...</span>
              ) : (
                <button
                  key={`page-${page}`}
                  className={`pagination-btn ${currentPage === page ? 'active' : ''}`}
                  onClick={() => onPageChange(page as number)}
                  aria-current={currentPage === page ? 'page' : undefined}
                  aria-label={`Page ${page}`}
                >
                  {page}
                </button>
              )
            ))}
          </div>

          <button
            className="pagination-btn pagination-next"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
            aria-label="Next page"
          >
            →
          </button>
        </div>

        {onPageSizeChange && pageSizeOptions.length > 0 && (
          <select
            className="pagination-size-select"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            aria-label="Items per page"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size} / page
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
