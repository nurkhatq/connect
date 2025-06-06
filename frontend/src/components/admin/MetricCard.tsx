import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeType?: 'increase' | 'decrease' | 'neutral';
  icon: React.ComponentType<any>;
  color: 'blue' | 'green' | 'purple' | 'orange' | 'red';
  format?: 'number' | 'percentage' | 'currency';
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  change,
  changeType,
  icon: Icon,
  color,
  format = 'number'
}) => {
  const formatValue = (val: string | number) => {
    if (typeof val === 'string') return val;
    
    switch (format) {
      case 'percentage':
        return `${val}%`;
      case 'currency':
        return new Intl.NumberFormat('ru-RU', { 
          style: 'currency', 
          currency: 'KZT' 
        }).format(val);
      default:
        return val.toLocaleString('ru-RU');
    }
  };

  const getChangeIcon = () => {
    switch (changeType) {
      case 'increase':
        return <TrendingUp className="w-4 h-4" />;
      case 'decrease':
        return <TrendingDown className="w-4 h-4" />;
      default:
        return <Minus className="w-4 h-4" />;
    }
  };

  const getChangeColor = () => {
    switch (changeType) {
      case 'increase':
        return 'text-green-600';
      case 'decrease':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
    >
      <div className="flex items-center justify-between mb-4">
        <div className={`w-12 h-12 bg-${color}-100 rounded-lg flex items-center justify-center`}>
          <Icon className={`w-6 h-6 text-${color}-600`} />
        </div>
        {change !== undefined && (
          <div className={`flex items-center space-x-1 text-sm ${getChangeColor()}`}>
            {getChangeIcon()}
            <span>{Math.abs(change)}</span>
          </div>
        )}
      </div>
      <h3 className="text-3xl font-bold text-gray-800 mb-1">
        {formatValue(value)}
      </h3>
      <p className="text-gray-600 text-sm">{title}</p>
    </motion.div>
  );
};
