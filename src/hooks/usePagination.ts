import { useEffect, useMemo, useState } from 'react';

interface UsePaginationOptions {
  initialPageSize?: number;
  /**
   * Ubah nilai ini ketika filter/pencarian berubah agar halaman kembali ke 1.
   */
  resetKey?: string | number;
}

export function usePagination<T>(items: T[], options: UsePaginationOptions = {}) {
  const { initialPageSize = 10, resetKey } = options;
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  const goToPage = (nextPage: number) => {
    setPage(Math.min(Math.max(1, nextPage), totalPages));
  };

  const changePageSize = (nextPageSize: number) => {
    setPageSize(nextPageSize);
    setPage(1);
  };

  return {
    page,
    pageSize,
    totalItems,
    totalPages,
    pageItems,
    goToPage,
    changePageSize,
  };
}
