import React from 'react';

export const SystemStatus: React.FC = () => {
  const [status, setStatus] = React.useState({
    database: 'healthy',
    redis: 'healthy',
    telegram: 'healthy',
    api: 'healthy'
  });

  const statusConfig = {
    healthy: { color: 'green', text: 'Работает' },
    degraded: { color: 'yellow', text: 'Проблемы' },
    unhealthy: { color: 'red', text: 'Не работает' }
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Статус системы</h3>
      
      <div className="space-y-3">
        {Object.entries(status).map(([service, serviceStatus]) => {
          const config = statusConfig[serviceStatus as keyof typeof statusConfig];
          return (
            <div key={service} className="flex items-center justify-between">
              <span className="text-gray-700 capitalize">{service}</span>
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full bg-${config.color}-500`}></div>
                <span className={`text-sm text-${config.color}-600`}>{config.text}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200">
        <button className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
          Обновить статус
        </button>
      </div>
    </div>
  );
};
