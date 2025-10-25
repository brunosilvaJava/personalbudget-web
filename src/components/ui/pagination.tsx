import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}

export function Pagination({ 
  currentPage, 
  totalPages, 
  onPageChange,
  disabled = false
}: PaginationProps) {
  const pages = generatePaginationPages(currentPage, totalPages);

  return (
    <div className="flex items-center justify-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 0 || disabled}
      >
        <ChevronLeft className="h-4 w-4" />
        Anterior
      </Button>

      <div className="flex gap-1">
        {pages.map((page, index) => {
          if (page === '...') {
            return (
              <div key={`ellipsis-${index}`} className="px-3 py-2">
                <MoreHorizontal className="h-4 w-4" />
              </div>
            );
          }

          const pageNumber = Number(page);
          return (
            <Button
              key={pageNumber}
              variant={currentPage === pageNumber ? 'default' : 'outline'}
              size="sm"
              onClick={() => onPageChange(pageNumber)}
              disabled={disabled}
              className="min-w-[40px]"
            >
              {pageNumber + 1}
            </Button>
          );
        })}
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages - 1 || disabled}
      >
        Próxima
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

function generatePaginationPages(currentPage: number, totalPages: number): (number | string)[] {
  const delta = 2;
  const range: (number | string)[] = [];
  
  for (
    let i = Math.max(0, currentPage - delta);
    i <= Math.min(totalPages - 1, currentPage + delta);
    i++
  ) {
    range.push(i);
  }

  if (currentPage - delta > 1) {
    range.unshift('...');
  }
  if (currentPage - delta > 0) {
    range.unshift(0);
  }

  if (currentPage + delta < totalPages - 2) {
    range.push('...');
  }
  if (currentPage + delta < totalPages - 1) {
    range.push(totalPages - 1);
  }

  return range;
}