'use client';

import { motion } from 'framer-motion';
import { Star, Lock, CheckCircle } from 'lucide-react';

interface AchievementCardProps {
  achievement: {
    id: string;
    title: string;
    description: string;
    icon: string;
    points: number;
    earned?: boolean;
    earned_at?: string;
  };
  index: number;
}

export default function AchievementCard({ achievement, index }: AchievementCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className={`relative overflow-hidden rounded-xl p-6 transition-all ${
        achievement.earned 
          ? 'bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-yellow-200' 
          : 'bg-white border border-gray-200'
      }`}
    >
      {/* Earned Badge */}
      {achievement.earned && (
        <div className="absolute top-3 right-3">
          <div className="bg-green-500 text-white rounded-full p-1">
            <CheckCircle className="w-4 h-4" />
          </div>
        </div>
      )}

      <div className="flex items-start space-x-4">
        {/* Icon */}
        <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl ${
          achievement.earned 
            ? 'bg-gradient-to-r from-yellow-400 to-orange-400' 
            : 'bg-gray-100'
        }`}>
          {achievement.earned ? achievement.icon : <Lock className="w-6 h-6 text-gray-400" />}
        </div>
        
        <div className="flex-1">
          <h3 className={`font-semibold mb-1 ${
            achievement.earned ? 'text-gray-800' : 'text-gray-500'
          }`}>
            {achievement.title}
          </h3>
          
          <p className={`text-sm mb-3 ${
            achievement.earned ? 'text-gray-600' : 'text-gray-400'
          }`}>
            {achievement.description}
          </p>
          
          <div className="flex items-center justify-between">
            <div className={`flex items-center space-x-2 text-sm ${
              achievement.earned ? 'text-yellow-600' : 'text-gray-400'
            }`}>
              <Star className="w-4 h-4" />
              <span>{achievement.points} баллов</span>
            </div>
            
            {achievement.earned && achievement.earned_at && (
              <div className="text-xs text-gray-500">
                {new Date(achievement.earned_at).toLocaleDateString('ru-RU')}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Shine effect for earned achievements */}
      {achievement.earned && (
        <motion.div
          initial={{ x: '-100%' }}
          animate={{ x: '100%' }}
          transition={{ 
            duration: 1,
            delay: index * 0.2,
            repeat: Infinity,
            repeatDelay: 5
          }}
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12"
        />
      )}
    </motion.div>
  );
}