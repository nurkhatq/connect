'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Clock, Users, Target, Play, BarChart3 } from 'lucide-react';
import TestModule from '@/components/TestModule';
import { api } from '@/lib/api';
import { telegram } from '@/lib/telegram';

export default function TestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [test, setTest] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showTest, setShowTest] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);

  const loadTestDetails = useCallback(async () => {
    if (!params.id) return;
    
    try {
      const testData = await api.getTest(params.id as string);
      setTest(testData);
    } catch (error) {
      console.error('Failed to load test details:', error);
      router.push('/tests');
    } finally {
      setIsLoading(false);
    }
  }, [params.id, router]);

  useEffect(() => {
    loadTestDetails();
  }, [loadTestDetails]);

  const handleStartTest = () => {
    setShowTest(true);
    telegram.hapticFeedback('impact', 'medium');
  };

  const handleTestComplete = (results: any) => {
    setTestResults(results);
    setShowTest(false);
    telegram.hapticFeedback('notification', 'success');
    loadTestDetails(); // Reload to update attempts count
  };

  const handleTestExit = () => {
    setShowTest(false);
    telegram.hapticFeedback('impact', 'light');
  };

  if (showTest) {
    return (
      <TestModule
        testId={params.id as string}
        onComplete={handleTestComplete}
        onExit={handleTestExit}
      />
    );
  }

  if (testResults) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-2xl p-8 w-full max-w-md shadow-xl text-center"
        >
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${
            testResults.passed ? 'bg-green-100' : 'bg-red-100'
          }`}>
            <span className="text-3xl">
              {testResults.passed ? '🎉' : '📚'}
            </span>
          </div>
          
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            {testResults.passed ? 'Поздравляем!' : 'Тест завершен'}
          </h2>
          
          <p className="text-gray-600 mb-6">
            {testResults.passed 
              ? 'Вы успешно прошли тест!'
              : 'Попробуйте еще раз для улучшения результата'
            }
          </p>
          
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-gray-800">
                {testResults.percentage}%
              </div>
              <div className="text-sm text-gray-600">Результат</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-600">
                +{testResults.points_earned}
              </div>
              <div className="text-sm text-gray-600">Баллы</div>
            </div>
          </div>
          
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setTestResults(null)}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 px-6 rounded-lg font-medium mb-3"
          >
            Продолжить
          </motion.button>
          
          <button
            onClick={() => router.push('/tests')}
            className="w-full text-gray-600 py-2"
          >
            Вернуться к тестам
          </button>
        </motion.div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка теста...</p>
        </div>
      </div>
    );
  }

  if (!test) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-800 mb-2">Тест не найден</h2>
          <button
            onClick={() => router.push('/tests')}
            className="text-blue-500 hover:text-blue-600"
          >
            Вернуться к списку тестов
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="flex items-center p-4">
          <button
            onClick={() => router.push('/tests')}
            className="p-2 hover:bg-gray-100 rounded-lg mr-3"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold">{test.title}</h1>
        </div>
      </div>

      {/* Test Info */}
      <div className="p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl p-6 shadow-sm mb-6"
        >
          <h2 className="text-xl font-bold text-gray-800 mb-3">{test.title}</h2>
          <p className="text-gray-600 mb-6">{test.description}</p>

          {/* Test Stats */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
              <Clock className="w-5 h-5 text-blue-500" />
              <div>
                <div className="font-semibold text-gray-800">
                  {Math.round(test.time_limit / 60)} мин
                </div>
                <div className="text-sm text-gray-600">Время</div>
              </div>
            </div>
            
            <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
              <Target className="w-5 h-5 text-green-500" />
              <div>
                <div className="font-semibold text-gray-800">
                  {test.questions_count}
                </div>
                <div className="text-sm text-gray-600">Вопросов</div>
              </div>
            </div>
            
            <div className="flex items-center space-x-3 p-3 bg-purple-50 rounded-lg">
              <BarChart3 className="w-5 h-5 text-purple-500" />
              <div>
                <div className="font-semibold text-gray-800">
                  {test.passing_score}%
                </div>
                <div className="text-sm text-gray-600">Проходной</div>
              </div>
            </div>
            
            <div className="flex items-center space-x-3 p-3 bg-yellow-50 rounded-lg">
              <Users className="w-5 h-5 text-yellow-500" />
              <div>
                <div className="font-semibold text-gray-800">
                  {test.attempts || 0}
                </div>
                <div className="text-sm text-gray-600">Попыток</div>
              </div>
            </div>
          </div>

          {/* Best Score */}
          {test.best_score && (
            <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-gray-800 mb-2">Ваш лучший результат</h3>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold text-green-600">
                  {test.best_score}%
                </div>
                <div className="text-sm text-gray-600">
                  {test.last_attempt && (
                    `Последняя попытка: ${new Date(test.last_attempt).toLocaleDateString('ru-RU')}`
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Start Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleStartTest}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white py-4 px-6 rounded-lg font-medium flex items-center justify-center space-x-2 shadow-lg"
          >
            <Play className="w-5 h-5" />
            <span>Начать тест</span>
          </motion.button>

          {/* Info */}
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-gray-800 mb-2">Информация о тесте:</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Время ограничено: {Math.round(test.time_limit / 60)} минут</li>
              <li>• Автосохранение каждые 10 секунд</li>
              <li>• Можно вернуться к предыдущим вопросам</li>
              <li>• Результат виден сразу после завершения</li>
            </ul>
          </div>
        </motion.div>
      </div>
    </div>
  );
}