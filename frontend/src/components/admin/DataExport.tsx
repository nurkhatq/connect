import React from 'react';

interface DataExportProps {
  onExport: (format: 'csv' | 'json' | 'pdf', options: any) => void;
  loading?: boolean;
  data: {
    type: string;
    count: number;
  };
}

export const DataExport: React.FC<DataExportProps> = ({ 
  onExport, 
  loading, 
  data 
}) => {
  const [selectedFormat, setSelectedFormat] = React.useState<'csv' | 'json' | 'pdf'>('csv');
  const [exportOptions, setExportOptions] = React.useState({
    includeDeleted: false,
    dateRange: 'all',
    customFields: []
  });

  const handleExport = () => {
    onExport(selectedFormat, exportOptions);
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Экспорт данных</h3>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Формат экспорта
          </label>
          <div className="flex space-x-2">
            {(['csv', 'json', 'pdf'] as const).map((format) => (
              <button
                key={format}
                onClick={() => setSelectedFormat(format)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedFormat === format
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {format.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="text-sm text-gray-600">
          Готово к экспорту: <strong>{data.count}</strong> записей ({data.type})
        </div>

        <button
          onClick={handleExport}
          disabled={loading}
          className="w-full px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>Экспорт...</span>
            </>
          ) : (
            <>
              <span>Экспортировать</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
