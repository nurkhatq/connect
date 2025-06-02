'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BookOpen } from 'lucide-react';
import Navigation from '@/components/Navigation';
import TestModule from '@/components/TestModule';
import TestCard from '@/components/TestCard';
import LoadingSpinner from '@/components/LoadingSpinner';
import { api } from '@/lib/api';
import { telegram } from '@/lib/telegram';

export default function TestsPage() {
  const [tests, setTests] = useState<any[]>([]);
  const [activeTest, setActiveTest] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [testResults, setTestResults] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const categories = [
    { id: 'all', name: 'Все тесты', icon: '📚' },
    { id: 'ict', name: 'ICT', icon: '💻' },
    { id: 'logical', name: 'Логика', icon: '🧠' },
    { id: 'reading', name: 'Чтение', icon: '📖' },
    { id: 'useofenglish', name: 'Английский', icon: '🇬🇧' },
    { id: 'grammar', name: 'Грамматика', icon: '📝' }
  ];

  useEffect(() => {
    loadTests();
  }, []);

  const loadTests = async () => {
    try {
      const testsData = await api.getTests();
      setTests(testsData);
    } catch (error) {
      console.error('Failed to load tests:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredTests = selectedCategory === 'all' 
    ? tests 
    : tests.filter(test => test.category === selectedCategory);

  const handleTestComplete = (results: any) => {
    setTestResults(results);
    setActiveTest(null);
    telegram.hapticFeedback('notification', 'success');
    
    // Reload tests to update scores
    loadTests();
  };

  const handleTestExit = () => {
    setActiveTest(null);
    telegram.hapticFeedback('impact', 'light');
  };

  if (activeTest) {
    return (
      <TestModule
        testId={activeTest}
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
          
          <div className="text-sm text-gray-600 mb-6">
            Правильных ответов: {testResults.correct_answers} из {testResults.total_questions}
          </div>
          
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setTestResults(null)}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 px-6 rounded-lg font-medium"
          >
            Продолжить
          </motion.button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-2xl font-bold mb-2">Тестирование</h1>
          <p className="opacity-90">Выберите категорию и проверьте свои знания</p>
        </motion.div>
      </div>

      {/* Category Filter */}
      <div className="p-4 bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="flex space-x-2 overflow-x-auto pb-2">
          {categories.map((category) => (
            <motion.button
              key={category.id}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setSelectedCategory(category.id);
                telegram.hapticFeedback('selection');
              }}
              className={`flex items-center space-x-2 px-4 py-2 rounded-full whitespace-nowrap transition-all ${
                selectedCategory === category.id
                  ? 'bg-blue-500 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span>{category.icon}</span>
              <span className="text-sm font-medium">{category.name}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Tests List */}
      <div className="p-6">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" text="Загрузка тестов..." />
          </div>
        ) : filteredTests.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-12"
          >
            <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">
              Тесты не найдены
            </h3>
            <p className="text-gray-500 mb-6">
              В выбранной категории нет доступных тестов
            </p>
            <button
              onClick={() => setSelectedCategory('all')}
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              Показать все тесты
            </button>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {filteredTests.map((test, index) => (
              <TestCard 
                key={test.id} 
                test={test} 
                index={index}
              />
            ))}
          </div>
        )}
      </div>

      <Navigation />
    </div>
  );
}