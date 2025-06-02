'use client';

import { motion } from 'framer-motion';
import { Medal, Crown, Trophy, Star } from 'lucide-react';

interface LeaderboardCardProps {
  entry: {
    rank: number;
    user_id: string;
    username: string;
    level: number;
    points: number;
    is_current_user: boolean;
  };
  index: number;
}

export default function LeaderboardCard({ entry, index }: LeaderboardCardProps) {
  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="w-5 h-5 text-yellow-500" />;
      case 2:
        return <Medal className="w-5 h-5 text-gray-400" />;
      case 3:
        return <Trophy className="w-5 h-5 text-orange-500" />;
      default:
        return <span className="font-bold text-gray-600">#{rank}</span>;
    }
  };

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-gradient-to-r from-yellow-100 to-yellow-200 border-yellow-300';
      case 2:
        return 'bg-gradient-to-r from-gray-100 to-gray-200 border-gray-300';
      case 3:
        return 'bg-gradient-to-r from-orange-100 to-orange-200 border-orange-300';
      default:
        return 'bg-white border-gray-200';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`rounded-xl p-4 border transition-all ${
        entry.is_current_user 
          ? 'ring-2 ring-blue-500 bg-blue-50 border-blue-200' 
          : getRankColor(entry.rank)
      }`}
    >
      <div className="flex items-center space-x-4">
        {/* Rank */}
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
          entry.rank <= 3 ? 'bg-white shadow-sm' : ''
        }`}>
          {getRankIcon(entry.rank)}
        </div>
        
        {/* User Info */}
        <div className="flex-1 min-w-0">
          <div className={`font-semibold truncate ${
            entry.is_current_user ? 'text-blue-800' : 'text-gray-800'
          }`}>
            {entry.username}
            {entry.is_current_user && (
              <span className="ml-2 text-sm text-blue-600 font-normal">(Вы)</span>
            )}
          </div>
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Star className="w-3 h-3" />
            <span>Уровень {entry.level}</span>
          </div>
        </div>
        
        {/* Points */}
        <div className="text-right">
          <div className={`font-bold ${
            entry.is_current_user ? 'text-blue-800' : 'text-gray-800'
          }`}>
            {entry.points.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500">баллов</div>
        </div>

        {/* Trophy for top 3 */}
        {entry.rank <= 3 && (
          <motion.div
            animate={{ 
              rotate: [0, -10, 10, -10, 0],
              scale: [1, 1.1, 1]
            }}
            transition={{ 
              duration: 2,
              repeat: Infinity,
              repeatDelay: 3
            }}
          >
            <Trophy className={`w-6 h-6 ${
              entry.rank === 1 ? 'text-yellow-500' :
              entry.rank === 2 ? 'text-gray-400' :
              'text-orange-500'
            }`} />
          </motion.div>
        )}
      </div>

      {/* Rank Badge for top 3 */}
      {entry.rank <= 3 && (
        <div className="absolute -top-2 -right-2">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
            entry.rank === 1 ? 'bg-yellow-500' :
            entry.rank === 2 ? 'bg-gray-400' :
            'bg-orange-500'
          }`}>
            {entry.rank}
          </div>
        </div>
      )}
    </motion.div>
  );
}