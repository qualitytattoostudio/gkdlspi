import React from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  ColumnDef,
} from '@tanstack/react-table';
import { NeuCard } from './NeuCard';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface NeuTableProps<T> {
  data: T[];
  columns: ColumnDef<T, any>[];
  onRowClick?: (row: T) => void;
}

export function NeuTable<T>({ data, columns, onRowClick }: NeuTableProps<T>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

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
                style={{ animation: `fadeUp 0.3s ease-out ${i * 0.05}s both` }}
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
      
      <div className="p-4 border-t border-neu-muted/20 flex items-center justify-between">
        <span className="text-sm text-neu-muted">Showing {data.length} entries</span>
        <div className="flex gap-2">
          <button className="w-8 h-8 rounded-lg bg-neu-bg shadow-neu-small flex items-center justify-center text-neu-muted hover:text-neu-fg active:shadow-neu-inset transition-all">
            <ChevronLeft size={16} />
          </button>
          <button className="w-8 h-8 rounded-lg bg-neu-bg shadow-neu-small flex items-center justify-center text-neu-muted hover:text-neu-fg active:shadow-neu-inset transition-all">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </NeuCard>
  );
}
