'use client';

import { motion } from 'framer-motion';
import { TrendingUp, Target, Award, Clock } from 'lucide-react';

interface QuickStatsProps {
  stats: {
    total_tests: number;
    average_score: number;
    best_score: number;
    total_points: number;
  };
}

export default function QuickStats({ stats }: QuickStatsProps) {
  const statItems = [
    {
      label: 'Всего тестов',
      value: stats.total_tests,
      icon: Target,
      color: 'text-blue-600 bg-blue-100',
      suffix: ''
    },
    {
      label: 'Средний балл',
      value: stats.average_score,
      icon: TrendingUp,
      color: 'text-green-600 bg-green-100',
      suffix: '%'
    },
    {
      label: 'Лучший результат',
      value: stats.best_score,
      icon: Award,
      color: 'text-purple-600 bg-purple-100',
      suffix: '%'
    },
    {
      label: 'Баллы за тесты',
      value: stats.total_points,
      icon: Clock,
      color: 'text-yellow-600 bg-yellow-100',
      suffix: '',
      format: (val: number) => val.toLocaleString()
    }
  ];

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm">
      <h3 className="font-semibold text-gray-800 mb-4 flex items-center">
        <Target className="w-5 h-5 mr-2 text-blue-500" />
        Статистика тестов
      </h3>
      
      <div className="grid grid-cols-2 gap-4">
        {statItems.map((item, index) => {
          const Icon = item.icon;
          const displayValue = item.format ? item.format(item.value) : Math.round(item.value);
          
          return (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
              className="text-center p-4 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2 ${item.color}`}>
                <Icon className="w-6 h-6" />
              </div>
              <div className="text-2xl font-bold text-gray-800">
                {displayValue}{item.suffix}
              </div>
              <div className="text-sm text-gray-600">{item.label}</div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}