'use client';

import { motion } from 'framer-motion';

interface ProgressBarProps {
  progress: number;
  className?: string;
  showPercentage?: boolean;
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple';
}

export default function ProgressBar({ 
  progress, 
  className = '', 
  showPercentage = false,
  color = 'blue' 
}: ProgressBarProps) {
  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500',
    purple: 'bg-purple-500'
  };

  return (
    <div className={`w-full ${className}`}>
      {showPercentage && (
        <div className="flex justify-between text-sm text-gray-600 mb-1">
          <span>Прогресс</span>
          <span>{Math.round(progress)}%</span>
        </div>
      )}
      <div className="bg-gray-200 rounded-full h-2">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(progress, 100)}%` }}
          transition={{ duration: 0.5 }}
          className={`${colorClasses[color]} h-2 rounded-full`}
        />
      </div>
    </div>
  );
}