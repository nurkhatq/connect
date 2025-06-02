'use client';

import { motion } from 'framer-motion';
import { User, Crown } from 'lucide-react';

interface ProfileHeaderProps {
  user: {
    first_name: string;
    last_name?: string;
    username?: string;
    level: number;
    points: number;
  };
}

export default function ProfileHeader({ user }: ProfileHeaderProps) {
  const getLevelInfo = (level: number) => {
    const levels = [
      { name: 'Новичок', min: 1, max: 2, color: 'from-gray-400 to-gray-500', emoji: '🌱' },
      { name: 'Ученик', min: 2, max: 4, color: 'from-green-400 to-green-500', emoji: '📚' },
      { name: 'Знаток', min: 4, max: 7, color: 'from-blue-400 to-blue-500', emoji: '🎓' },
      { name: 'Эксперт', min: 7, max: 10, color: 'from-purple-400 to-purple-500', emoji: '🏆' },
      { name: 'Мастер', min: 10, max: Infinity, color: 'from-yellow-400 to-yellow-500', emoji: '👑' }
    ];
    
    return levels.find(l => level >= l.min && level < l.max) || levels[0];
  };

  const levelInfo = getLevelInfo(user.level);
  const progressToNextLevel = ((user.points % 1000) / 1000) * 100;

  return (
    <div className={`bg-gradient-to-r ${levelInfo.color} text-white p-6`}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* User Info */}
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
            <User className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-xl font-bold">
              {user.first_name} {user.last_name || ''}
            </h1>
            <p className="opacity-90">@{user.username || 'user'}</p>
          </div>
        </div>

        {/* Level Badge */}
        <div className="bg-white/20 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <span className="text-2xl">{levelInfo.emoji}</span>
              <span className="font-semibold">{levelInfo.name}</span>
            </div>
            <span className="text-sm opacity-90">Уровень {user.level}</span>
          </div>
          
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm opacity-90">Баллы</span>
            <span className="font-bold">{user.points.toLocaleString()}</span>
          </div>
          
          {/* Progress to next level */}
          <div className="bg-white/20 rounded-full h-2 mt-2">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progressToNextLevel}%` }}
              transition={{ duration: 1 }}
              className="bg-white rounded-full h-2"
            />
          </div>
          <div className="flex justify-between text-xs opacity-75 mt-1">
            <span>{user.points % 1000} / 1000</span>
            <span>До уровня {user.level + 1}</span>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white/10 rounded-lg p-3 text-center">
            <div className="text-lg font-bold">{user.level}</div>
            <div className="text-xs opacity-90">Уровень</div>
          </div>
          <div className="bg-white/10 rounded-lg p-3 text-center">
            <div className="text-lg font-bold">{user.points.toLocaleString()}</div>
            <div className="text-xs opacity-90">Баллы</div>
          </div>
          <div className="bg-white/10 rounded-lg p-3 text-center">
            <div className="text-lg font-bold">#{Math.floor(Math.random() * 50) + 1}</div>
            <div className="text-xs opacity-90">Рейтинг</div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}