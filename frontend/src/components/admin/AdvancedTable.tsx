import React from 'react';
import { motion } from 'framer-motion';

interface Column<T> {
  key: keyof T;
  title: string;
  render?: (value: any, row: T) => React.ReactNode;
  sortable?: boolean;
  filterable?: boolean;
  width?: string;
}

export interface AdvancedTableProps<T> {
  data: T[];
  columns: Column<T>[];
  onRowSelect?: (selectedRows: T[]) => void;
  onSort?: (column: keyof T, direction: 'asc' | 'desc') => void;
  onFilter?: (filters: Record<string, any>) => void;
  loading?: boolean;
  pagination?: {
    current: number;
    total: number;
    pageSize: number;
    onChange: (page: number, pageSize: number) => void;
  };
  actions?: {
    label: string;
    action: (row: T) => void;
    icon?: React.ComponentType<any>;
    color?: string;
  }[];
}

export function AdvancedTable<T extends { id: string }>({
  data,
  columns,
  onRowSelect,
  onSort,
  onFilter,
  loading,
  pagination,
  actions
}: AdvancedTableProps<T>) {
  const [selectedRows, setSelectedRows] = React.useState<Set<string>>(new Set());
  const [sortColumn, setSortColumn] = React.useState<keyof T | null>(null);
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('asc');

  const handleRowSelect = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedRows);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedRows(newSelected);
    
    if (onRowSelect) {
      const selectedData = data.filter(row => newSelected.has(row.id));
      onRowSelect(selectedData);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(data.map(row => row.id));
      setSelectedRows(allIds);
      onRowSelect?.(data);
    } else {
      setSelectedRows(new Set());
      onRowSelect?.([]);
    }
  };

  const handleSort = (column: keyof T) => {
    const newDirection = sortColumn === column && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortColumn(column);
    setSortDirection(newDirection);
    onSort?.(column, newDirection);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      {/* Table Header with Filters */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {selectedRows.size > 0 && (
              <span className="text-sm text-gray-600">
                {selectedRows.size} выбрано
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left">
                <input
                  type="checkbox"
                  checked={selectedRows.size === data.length && data.length > 0}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="rounded border-gray-300"
                />
              </th>
              {columns.map((column) => (
                <th
                  key={column.key as string}
                  className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
                    column.sortable ? 'cursor-pointer hover:text-gray-700' : ''
                  }`}
                  style={{ width: column.width }}
                  onClick={() => column.sortable && handleSort(column.key)}
                >
                  <div className="flex items-center space-x-1">
                    <span>{column.title}</span>
                    {column.sortable && sortColumn === column.key && (
                      <span className="text-blue-500">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
              ))}
              {actions && actions.length > 0 && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Действия
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={columns.length + (actions ? 2 : 1)} className="px-6 py-12 text-center">
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    <span className="ml-2 text-gray-600">Загрузка...</span>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((row, index) => (
                <motion.tr
                  key={row.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.05 }}
                  className="hover:bg-gray-50"
                >
                  <td className="px-6 py-4">
                    <input
                      type="checkbox"
                      checked={selectedRows.has(row.id)}
                      onChange={(e) => handleRowSelect(row.id, e.target.checked)}
                      className="rounded border-gray-300"
                    />
                  </td>
                  {columns.map((column) => (
                    <td key={column.key as string} className="px-6 py-4">
                      {column.render ? 
                        column.render(row[column.key], row) : 
                        String(row[column.key])
                      }
                    </td>
                  ))}
                  {actions && actions.length > 0 && (
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        {actions.map((action, actionIndex) => {
                          const ActionIcon = action.icon;
                          return (
                            <button
                              key={actionIndex}
                              onClick={() => action.action(row)}
                              className={`p-1 rounded hover:bg-gray-100 ${action.color || 'text-gray-600'}`}
                              title={action.label}
                            >
                              {ActionIcon && <ActionIcon className="w-4 h-4" />}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                  )}
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && (
        <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Показано {Math.min(pagination.pageSize, data.length)} из {pagination.total} записей
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => pagination.onChange(pagination.current - 1, pagination.pageSize)}
              disabled={pagination.current === 1}
              className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50"
            >
              Назад
            </button>
            <span className="px-3 py-1 bg-blue-500 text-white rounded">
              {pagination.current}
            </span>
            <button
              onClick={() => pagination.onChange(pagination.current + 1, pagination.pageSize)}
              disabled={pagination.current * pagination.pageSize >= pagination.total}
              className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50"
            >
              Вперед
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
