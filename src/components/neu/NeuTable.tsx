'use client';

import React, { useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  flexRender,
  ColumnDef,
} from '@tanstack/react-table';
import { NeuCard } from './NeuCard';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Layers } from 'lucide-react';
import { NeuSelect } from './NeuSelect';

interface NeuTableProps<T> {
  data: T[];
  columns: ColumnDef<T, any>[];
  onRowClick?: (row: T) => void;
  pageSizeOptions?: number[];
  enableLoadMore?: boolean;
}

export function NeuTable<T>({
  data,
  columns,
  onRowClick,
  pageSizeOptions = [10, 25, 50, 100, 250],
  enableLoadMore = true,
}: NeuTableProps<T>) {
  const [pageSize, setPageSize] = useState<number>(25);
  const [displayedItemsCount, setDisplayedItemsCount] = useState<number>(25);
  const [loadMoreMode, setLoadMoreMode] = useState<boolean>(false);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: pageSize,
      },
    },
  });

  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === 'all') {
      table.setPageSize(data.length || 1000);
      setLoadMoreMode(false);
    } else {
      const num = Number(val);
      setPageSize(num);
      table.setPageSize(num);
      setDisplayedItemsCount(num);
      setLoadMoreMode(false);
    }
  };

  const handleLoadMore = () => {
    const nextCount = displayedItemsCount + 25;
    setDisplayedItemsCount(nextCount);
    table.setPageSize(nextCount);
    setLoadMoreMode(true);
  };

  const pageIndex = table.getState().pagination.pageIndex;
  const currentPageSize = table.getState().pagination.pageSize;
  const totalRows = data.length;
  const pageCount = table.getPageCount();

  const startRow = totalRows === 0 ? 0 : pageIndex * currentPageSize + 1;
  const endRow = Math.min((pageIndex + 1) * currentPageSize, totalRows);

  return (
    <NeuCard className="p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-neu-muted/20">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-6 py-4 text-xs font-bold text-neu-muted uppercase tracking-wider bg-neu-bg/50"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-neu-muted/10">
            {table.getRowModel().rows.map((row, i) => (
              <tr
                key={row.id}
                onClick={() => onRowClick?.(row.original)}
                className={`group transition-colors ${onRowClick ? 'cursor-pointer hover:bg-neu-bg hover:shadow-neu-inset-sm' : ''}`}
                style={{ animation: `fadeUp 0.3s ease-out ${Math.min(i * 0.03, 0.5)}s both` }}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-6 py-4 text-sm text-neu-fg whitespace-nowrap">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Table Pagination & Load More Footer */}
      <div className="p-4 border-t border-neu-muted/20 flex flex-col sm:flex-row items-center justify-between gap-4 bg-neu-bg/30">
        <div className="flex items-center gap-3 text-xs text-neu-muted">
          <span>Showing <strong className="text-neu-fg font-bold">{startRow}</strong> to <strong className="text-neu-fg font-bold">{endRow}</strong> of <strong className="text-neu-fg font-bold">{totalRows}</strong> entries</span>
          
          <div className="flex items-center gap-1.5 ml-2">
            <span className="hidden md:inline">Per page:</span>
            <select 
              value={currentPageSize >= totalRows && totalRows > 0 ? 'all' : currentPageSize}
              onChange={handlePageSizeChange}
              className="bg-neu-bg shadow-neu-inset-sm border border-neu-muted/20 rounded-lg px-2 py-1 text-xs font-bold text-neu-fg focus:outline-none"
            >
              {pageSizeOptions.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
              <option value="all">Show All ({totalRows})</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Load More Button */}
          {enableLoadMore && endRow < totalRows && (
            <button
              onClick={handleLoadMore}
              className="px-3.5 py-1.5 rounded-xl bg-neu-bg shadow-neu-small hover:shadow-neu-lifted active:shadow-neu-inset text-neu-accent font-bold text-xs flex items-center gap-1.5 transition-all mr-2"
            >
              <Layers size={14} />
              Load More (+25)
            </button>
          )}

          {/* Page Controls */}
          {!loadMoreMode && pageCount > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
                className="w-8 h-8 rounded-lg bg-neu-bg shadow-neu-small flex items-center justify-center text-neu-muted hover:text-neu-fg active:shadow-neu-inset disabled:opacity-30 disabled:pointer-events-none transition-all"
                title="First Page"
              >
                <ChevronsLeft size={16} />
              </button>
              <button
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="w-8 h-8 rounded-lg bg-neu-bg shadow-neu-small flex items-center justify-center text-neu-muted hover:text-neu-fg active:shadow-neu-inset disabled:opacity-30 disabled:pointer-events-none transition-all"
                title="Previous Page"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="px-2 text-xs font-bold text-neu-fg">
                {pageIndex + 1} / {pageCount}
              </span>
              <button
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="w-8 h-8 rounded-lg bg-neu-bg shadow-neu-small flex items-center justify-center text-neu-muted hover:text-neu-fg active:shadow-neu-inset disabled:opacity-30 disabled:pointer-events-none transition-all"
                title="Next Page"
              >
                <ChevronRight size={16} />
              </button>
              <button
                onClick={() => table.setPageIndex(pageCount - 1)}
                disabled={!table.getCanNextPage()}
                className="w-8 h-8 rounded-lg bg-neu-bg shadow-neu-small flex items-center justify-center text-neu-muted hover:text-neu-fg active:shadow-neu-inset disabled:opacity-30 disabled:pointer-events-none transition-all"
                title="Last Page"
              >
                <ChevronsRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </NeuCard>
  );
}
