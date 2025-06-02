'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Clock, Trophy, Play, BarChart3 } from 'lucide-react';
import { telegram } from '@/lib/telegram';

interface TestCardProps {
  test: {
    id: string;
    title: string;
    description: string;
    category: string;
    time_limit: number;
    questions_count: number;
    passing_score: number;
    best_score?: number;
    attempts?: number;
  };
  index: number;
}

export default function TestCard({ test, index }: TestCardProps) {
  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600 bg-green-100';
    if (score >= 70) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getCategoryIcon = (category: string) => {
    const icons = {
      ict: '💻',
      logical: '🧠',
      reading: '📖',
      useofenglish: '🇬🇧',
      grammar: '📝'
    };
    return icons[category as keyof typeof icons] || '📚';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2">
            <span className="text-xl">{getCategoryIcon(test.category)}</span>
            <h3 className="text-lg font-semibold text-gray-800">
              {test.title}
            </h3>
          </div>
          <p className="text-gray-600 text-sm mb-3">
            {test.description}
          </p>
          
          <div className="flex items-center space-x-4 text-sm text-gray-500">
            <span className="flex items-center space-x-1">
              <Clock className="w-4 h-4" />
              <span>{Math.round(test.time_limit / 60)} мин</span>
            </span>
            <span className="flex items-center space-x-1">
              <BarChart3 className="w-4 h-4" />
              <span>{test.questions_count} вопросов</span>
            </span>
            <span>Проходной: {test.passing_score}%</span>
          </div>
        </div>
        
        {test.best_score && (
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${getScoreColor(test.best_score)}`}>
            <Trophy className="w-3 h-3 inline mr-1" />
            {test.best_score}%
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-500">
          {test.attempts ? `Попыток: ${test.attempts}` : 'Еще не проходили'}
        </div>
        
        <Link href={`/tests/${test.id}`}>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => telegram.hapticFeedback('impact', 'light')}
            className="flex items-center space-x-2 bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
          >
            <Play className="w-4 h-4" />
            <span>Начать</span>
          </motion.button>
        </Link>
      </div>
    </motion.div>
  );
}