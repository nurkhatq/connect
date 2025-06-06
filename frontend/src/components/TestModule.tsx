'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Clock, ArrowLeft, ArrowRight, Flag } from 'lucide-react';
import { api } from '@/lib/api';
import { telegram } from '@/lib/telegram';

interface Question {
  id: string;
  text: string;
  options: string[];
  type: string;
}

interface TestModuleProps {
  testId: string;
  onComplete: (results: any) => void;
  onExit: () => void;
}

export default function TestModule({ testId, onComplete, onExit }: TestModuleProps) {
  const [session, setSession] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSavedAnswers, setLastSavedAnswers] = useState<Record<string, string>>({});
  
  const autoSaveRef = useRef<NodeJS.Timeout>();
  const timerRef = useRef<NodeJS.Timeout>();

  const startTest = useCallback(async () => {
    try {
      const response = await api.startTest(testId);
      setSession(response);
      setQuestions(response.questions);
      setTimeLeft(response.time_limit);
      setIsLoading(false);
      
      telegram.hapticFeedback('impact', 'light');
    } catch (error) {
      console.error('Failed to start test:', error);
      telegram.hapticFeedback('notification', 'error');
    }
  }, [testId]);

  // 🔥 ИСПРАВЛЕНО: Сохраняем ответы ПОСЛЕДОВАТЕЛЬНО (не параллельно)
  const saveProgress = useCallback(async () => {
    if (!session || Object.keys(answers).length === 0) return;
    
    // Находим ответы, которые еще не сохранены
    const unsavedAnswers: Record<string, string> = {};
    for (const [questionId, answer] of Object.entries(answers)) {
      if (lastSavedAnswers[questionId] !== answer) {
        unsavedAnswers[questionId] = answer;
      }
    }
    
    // Сохраняем только новые/измененные ответы
    if (Object.keys(unsavedAnswers).length > 0) {
      console.log(`💾 Saving ${Object.keys(unsavedAnswers).length} new/changed answers:`, Object.keys(unsavedAnswers));
      
      try {
        // 🔥 ИСПРАВЛЕНО: Сохраняем ПОСЛЕДОВАТЕЛЬНО для избежания race conditions
        for (const [questionId, answer] of Object.entries(unsavedAnswers)) {
          await api.submitAnswer(session.session_id, questionId, answer);
          // Небольшая пауза между запросами
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        // Обновляем список сохраненных ответов
        setLastSavedAnswers(prev => ({ ...prev, ...unsavedAnswers }));
        console.log(`✅ Successfully saved ${Object.keys(unsavedAnswers).length} answers`);
        
      } catch (error) {
        console.error('Failed to save answers:', error);
      }
    }
  }, [session, answers, lastSavedAnswers]);

  // 🔥 НОВАЯ ФУНКЦИЯ: Сохранить все ответы перед завершением
  const saveAllAnswers = useCallback(async () => {
    if (!session || Object.keys(answers).length === 0) return;
    
    console.log(`🔄 Saving ALL ${Object.keys(answers).length} answers before test completion...`);
    
    try {
      // 🔥 ИСПРАВЛЕНО: Сохраняем ПОСЛЕДОВАТЕЛЬНО для надежности
      for (const [questionId, answer] of Object.entries(answers)) {
        await api.submitAnswer(session.session_id, questionId, answer);
        // Пауза между запросами для избежания гонки
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      console.log(`✅ All ${Object.keys(answers).length} answers saved successfully`);
      
    } catch (error) {
      console.error('❌ Failed to save all answers:', error);
      throw error; // Прерываем завершение теста если не смогли сохранить
    }
  }, [session, answers]);

  const handleSubmitTest = useCallback(async () => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    telegram.hapticFeedback('impact', 'medium');

    try {
      // 🔥 ИСПРАВЛЕНО: Сохраняем ВСЕ ответы перед завершением
      await saveAllAnswers();
      
      // Complete test
      const results = await api.completeTest(session.session_id);
      telegram.hapticFeedback('notification', 'success');
      onComplete(results);
    } catch (error) {
      console.error('Failed to submit test:', error);
      telegram.hapticFeedback('notification', 'error');
      setIsSubmitting(false);
    }
  }, [isSubmitting, saveAllAnswers, session, onComplete]);

  useEffect(() => {
    startTest();
    return () => {
      if (autoSaveRef.current) clearInterval(autoSaveRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [startTest]);

  useEffect(() => {
    // Auto-save every 10 seconds
    if (session) {
      autoSaveRef.current = setInterval(() => {
        saveProgress();
      }, 10000);
    }
    
    return () => {
      if (autoSaveRef.current) clearInterval(autoSaveRef.current);
    };
  }, [session, saveProgress]);

  useEffect(() => {
    // Timer countdown
    if (timeLeft > 0) {
      timerRef.current = setTimeout(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && session) {
      handleSubmitTest();
    }
    
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [timeLeft, session, handleSubmitTest]);

  const handleAnswerSelect = (answer: string) => {
    const currentQuestion = questions[currentQuestionIndex];
    setAnswers(prev => ({
      ...prev,
      [currentQuestion.id]: answer
    }));
    
    telegram.hapticFeedback('selection');
    
    // 🔥 ДОБАВЛЕНО: Немедленно сохраняем ответ
    if (session) {
      api.submitAnswer(session.session_id, currentQuestion.id, answer)
        .then(() => {
          setLastSavedAnswers(prev => ({ 
            ...prev, 
            [currentQuestion.id]: answer 
          }));
          console.log(`✅ Answer saved immediately: ${currentQuestion.id}`);
        })
        .catch((error) => {
          console.error('Failed to save answer immediately:', error);
        });
    }
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      telegram.hapticFeedback('impact', 'light');
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
      telegram.hapticFeedback('impact', 'light');
    }
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getProgressPercentage = (): number => {
    const answeredCount = Object.keys(answers).length;
    return (answeredCount / questions.length) * 100;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Подготовка теста...</p>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const currentAnswer = answers[currentQuestion?.id];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="flex items-center justify-between p-4">
          <button
            onClick={onExit}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 bg-red-50 text-red-600 px-3 py-1 rounded-full">
              <Clock className="w-4 h-4" />
              <span className="font-mono text-sm">{formatTime(timeLeft)}</span>
            </div>
            
            <div className="text-sm text-gray-600">
              {currentQuestionIndex + 1} / {questions.length}
            </div>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="bg-gray-200 h-1">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
            className="bg-blue-500 h-1"
          />
        </div>
      </div>

      {/* Question Content */}
      <div className="p-6">
        <motion.div
          key={currentQuestionIndex}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white rounded-xl p-6 shadow-sm"
        >
          <div className="mb-6">
            <div className="text-sm text-blue-600 font-medium mb-2">
              Вопрос {currentQuestionIndex + 1}
            </div>
            <h2 className="text-lg font-semibold text-gray-800 leading-relaxed">
              {currentQuestion.text}
            </h2>
          </div>

          {/* Answer Options */}
          <div className="space-y-3">
            {currentQuestion.options.map((option, index) => (
              <motion.button
                key={index}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => handleAnswerSelect(option)}
                className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                  currentAnswer === option
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    currentAnswer === option
                      ? 'border-blue-500 bg-blue-500'
                      : 'border-gray-300'
                  }`}>
                    {currentAnswer === option && (
                      <div className="w-2 h-2 bg-white rounded-full" />
                    )}
                  </div>
                  <span className="flex-1">{option}</span>
                </div>
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6">
          <button
            onClick={handlePreviousQuestion}
            disabled={currentQuestionIndex === 0}
            className="flex items-center space-x-2 px-4 py-2 text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Назад</span>
          </button>

          <div className="flex items-center space-x-3">
            <div className="text-sm text-gray-500">
              Отвечено: {Object.keys(answers).length} / {questions.length}
            </div>
            
            {currentQuestionIndex === questions.length - 1 ? (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleSubmitTest}
                disabled={isSubmitting}
                className="flex items-center space-x-2 bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Flag className="w-4 h-4" />
                <span>{isSubmitting ? 'Завершение...' : 'Завершить тест'}</span>
              </motion.button>
            ) : (
              <button
                onClick={handleNextQuestion}
                className="flex items-center space-x-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
              >
                <span>Далее</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Answer Progress */}
        <div className="mt-6 bg-white rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Прогресс ответов</span>
            <span className="text-sm font-medium text-blue-600">
              {Math.round(getProgressPercentage())}%
            </span>
          </div>
          <div className="bg-gray-200 rounded-full h-2">
            <motion.div
              animate={{ width: `${getProgressPercentage()}%` }}
              className="bg-blue-500 rounded-full h-2"
            />
          </div>
          
          {/* 🔥 ДОБАВЛЕНО: Показываем статус сохранения */}
          <div className="mt-2 text-xs text-gray-500">
            {Object.keys(answers).length > 0 && (
              <span>
                Сохранено: {Object.keys(lastSavedAnswers).length} / {Object.keys(answers).length} ответов
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}