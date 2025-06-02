'use client';

import { useState, useEffect } from 'react';

// Перехватываем все console.log
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

let logs: string[] = [];

console.log = (...args) => {
  logs.push(`[LOG] ${new Date().toLocaleTimeString()}: ${args.join(' ')}`);
  originalLog(...args);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('debug-log-update'));
  }
};

console.error = (...args) => {
  logs.push(`[ERROR] ${new Date().toLocaleTimeString()}: ${args.join(' ')}`);
  originalError(...args);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('debug-log-update'));
  }
};

console.warn = (...args) => {
  logs.push(`[WARN] ${new Date().toLocaleTimeString()}: ${args.join(' ')}`);
  originalWarn(...args);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('debug-log-update'));
  }
};

export default function TelegramDebugger() {
  const [isVisible, setIsVisible] = useState(false);
  const [currentLogs, setCurrentLogs] = useState<string[]>([]);
  const [tapCount, setTapCount] = useState(0);

  useEffect(() => {
    // Показать отладчик по 5 быстрым тапам
    let tapTimer: NodeJS.Timeout;
    
    const handleTripleTap = () => {
      setTapCount(prev => prev + 1);
      clearTimeout(tapTimer);
      
      if (tapCount >= 4) {
        setIsVisible(true);
        setTapCount(0);
      }
      
      tapTimer = setTimeout(() => {
        setTapCount(0);
      }, 1000);
    };

    const handleLogUpdate = () => {
      setCurrentLogs([...logs]);
    };

    // Добавляем невидимую кнопку для активации отладчика
    const debugButton = document.createElement('div');
    debugButton.style.position = 'fixed';
    debugButton.style.top = '10px';
    debugButton.style.right = '10px';
    debugButton.style.width = '50px';
    debugButton.style.height = '50px';
    debugButton.style.opacity = '0';
    debugButton.style.zIndex = '9999';
    debugButton.addEventListener('click', handleTripleTap);
    document.body.appendChild(debugButton);

    window.addEventListener('debug-log-update', handleLogUpdate);
    
    return () => {
      document.body.removeChild(debugButton);
      window.removeEventListener('debug-log-update', handleLogUpdate);
    };
  }, [tapCount]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full max-w-lg max-h-96 flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="font-bold">🔍 Debug Console</h3>
          <div className="space-x-2">
            <button
              onClick={() => {
                logs = [];
                setCurrentLogs([]);
              }}
              className="bg-yellow-500 text-white px-3 py-1 rounded text-sm"
            >
              Очистить
            </button>
            <button
              onClick={() => setIsVisible(false)}
              className="bg-red-500 text-white px-3 py-1 rounded text-sm"
            >
              Закрыть
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-auto p-4">
          <div className="space-y-1 text-xs font-mono">
            {currentLogs.length === 0 ? (
              <p className="text-gray-500">Логи появятся здесь...</p>
            ) : (
              currentLogs.slice(-50).map((log, index) => (
                <div 
                  key={index} 
                  className={`p-1 rounded ${
                    log.includes('[ERROR]') ? 'bg-red-100 text-red-800' :
                    log.includes('[WARN]') ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}
                >
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
        
        <div className="p-3 border-t text-xs text-gray-500">
          💡 Тапните 5 раз в правый верхний угол для открытия
        </div>
      </div>
    </div>
  );
}
