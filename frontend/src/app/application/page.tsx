'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileText, Clock, CheckCircle, XCircle, AlertCircle, Plus } from 'lucide-react';
import Navigation from '@/components/Navigation';
import ApplicationForm from '@/components/ApplicationForm';
import LoadingSpinner from '@/components/LoadingSpinner';
import { api } from '@/lib/api';
import { telegram } from '@/lib/telegram';

export default function ApplicationPage() {
  const [applications, setApplications] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadApplications();
  }, []);

  const loadApplications = async () => {
    try {
      const applicationsData = await api.getApplications();
      setApplications(applicationsData);
    } catch (error) {
      console.error('Failed to load applications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusConfig = (status: string) => {
    const configs = {
      submitted: { 
        color: 'bg-blue-100 text-blue-800 border-blue-200', 
        icon: Clock, 
        text: 'Подана',
        description: 'Ваша заявка получена и ожидает рассмотрения'
      },
      reviewing: { 
        color: 'bg-yellow-100 text-yellow-800 border-yellow-200', 
        icon: AlertCircle, 
        text: 'На рассмотрении',
        description: 'Заявка проверяется приемной комиссией'
      },
      approved: { 
        color: 'bg-green-100 text-green-800 border-green-200', 
        icon: CheckCircle, 
        text: 'Одобрена',
        description: 'Поздравляем! Ваша заявка одобрена'
      },
      rejected: { 
        color: 'bg-red-100 text-red-800 border-red-200', 
        icon: XCircle, 
        text: 'Отклонена',
        description: 'К сожалению, заявка не прошла рассмотрение'
      },
      accepted: { 
        color: 'bg-purple-100 text-purple-800 border-purple-200', 
        icon: CheckCircle, 
        text: 'Принят',
        description: 'Поздравляем! Вы приняты в AITU!'
      }
    };
    return configs[status as keyof typeof configs] || configs.submitted;
  };

  const hasPendingApplication = applications.some(app => 
    ['submitted', 'reviewing'].includes(app.status)
  );

  if (showForm) {
    return (
      <ApplicationForm
        onSuccess={() => {
          setShowForm(false);
          loadApplications();
          telegram.hapticFeedback('notification', 'success');
        }}
        onCancel={() => {
          setShowForm(false);
          telegram.hapticFeedback('impact', 'light');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-500 to-blue-600 text-white p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-2xl font-bold mb-2">Подача документов</h1>
          <p className="opacity-90">Подайте заявку для поступления в AITU</p>
        </motion.div>
      </div>

      <div className="p-6 space-y-6">
        {/* New Application Card */}
        {!hasPendingApplication && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setShowForm(true);
              telegram.hapticFeedback('impact', 'medium');
            }}
            className="bg-gradient-to-r from-green-500 to-blue-600 text-white p-6 rounded-xl cursor-pointer shadow-lg"
          >
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                <Plus className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-1">Подать новую заявку</h3>
                <p className="text-sm opacity-90 mb-2">
                  Заполните форму и загрузите необходимые документы
                </p>
                <div className="flex items-center space-x-4 text-xs opacity-80">
                  <span>• 4 простых шага</span>
                  <span>• Загрузка документов</span>
                  <span>• Онлайн подача</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Pending Application Notice */}
        {hasPendingApplication && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-blue-50 border border-blue-200 rounded-xl p-4"
          >
            <div className="flex items-center space-x-3">
              <Clock className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-blue-800 font-medium">У вас есть активная заявка</p>
                <p className="text-blue-600 text-sm">
                  Вы сможете подать новую заявку после рассмотрения текущей
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Applications List */}
        <section>
          <h2 className="text-xl font-bold text-gray-800 mb-4">Мои заявки</h2>
          
          {isLoading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner size="lg" text="Загрузка заявок..." />
            </div>
          ) : applications.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-xl p-8 text-center shadow-sm"
            >
              <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                Заявок пока нет
              </h3>
              <p className="text-gray-500 mb-6">
                Подайте первую заявку для поступления в университет
              </p>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowForm(true)}
                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                Подать заявку
              </motion.button>
            </motion.div>
          ) : (
            <div className="space-y-4">
              {applications.map((application, index) => {
                const statusConfig = getStatusConfig(application.status);
                const StatusIcon = statusConfig.icon;
                
                return (
                  <motion.div
                    key={application.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="bg-white rounded-xl p-6 shadow-sm border border-gray-100"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-800 mb-1">
                          Заявка #{application.id.slice(-8)}
                        </h3>
                        <p className="text-sm text-gray-600">
                          Подана {new Date(application.created_at).toLocaleDateString('ru-RU', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                          })}
                        </p>
                      </div>
                      <div className={`flex items-center space-x-2 px-3 py-2 rounded-full text-sm font-medium border ${statusConfig.color}`}>
                        <StatusIcon className="w-4 h-4" />
                        <span>{statusConfig.text}</span>
                      </div>
                    </div>

                    {/* Status Description */}
                    <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600">{statusConfig.description}</p>
                    </div>

                    {/* Application Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 text-sm">
                      <div>
                        <span className="text-gray-500">ИИН:</span>
                        <div className="font-medium">{application.personal_data?.iin}</div>
                      </div>
                      <div>
                        <span className="text-gray-500">Программа:</span>
                        <div className="font-medium">{application.education?.program}</div>
                      </div>
                      <div>
                        <span className="text-gray-500">Уровень:</span>
                        <div className="font-medium">{application.education?.degree}</div>
                      </div>
                      <div>
                        <span className="text-gray-500">Баллы ЕНТ:</span>
                        <div className="font-medium">{application.education?.ent_score}</div>
                      </div>
                    </div>

                    {/* Documents */}
                    <div className="mb-4">
                      <span className="text-sm text-gray-500">Документы:</span>
                      <div className="font-medium text-sm">
                        {application.documents?.length || 0} файлов загружено
                      </div>
                    </div>

                    {/* Progress Timeline */}
                    <div className="pt-4 border-t border-gray-100">
                      <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                        <span>Подана</span>
                        <span>Рассмотрение</span>
                        <span>Решение</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <div className={`flex-1 h-1 mx-1 ${
                          ['reviewing', 'approved', 'rejected', 'accepted'].includes(application.status)
                            ? 'bg-green-500' 
                            : 'bg-gray-200'
                        }`}></div>
                        <div className={`w-3 h-3 rounded-full ${
                          ['reviewing', 'approved', 'rejected', 'accepted'].includes(application.status)
                            ? 'bg-green-500' 
                            : 'bg-gray-300'
                        }`}></div>
                        <div className={`flex-1 h-1 mx-1 ${
                          ['approved', 'rejected', 'accepted'].includes(application.status)
                            ? application.status === 'approved' || application.status === 'accepted' 
                              ? 'bg-green-500' 
                              : 'bg-red-500'
                            : 'bg-gray-200'
                        }`}></div>
                        <div className={`w-3 h-3 rounded-full ${
                          ['approved', 'rejected', 'accepted'].includes(application.status)
                            ? application.status === 'approved' || application.status === 'accepted' 
                              ? 'bg-green-500' 
                              : 'bg-red-500'
                            : 'bg-gray-300'
                        }`}></div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>

        {/* Help Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6"
        >
          <h3 className="font-semibold text-blue-800 mb-3">💬 Нужна помощь?</h3>
          <div className="space-y-2 text-sm text-blue-700">
            <p>• Все поля обязательны для заполнения</p>
            <p>• Документы принимаются в форматах: PDF, JPG, PNG, DOC, DOCX</p>
            <p>• Максимальный размер файла: 10 МБ</p>
            <p>• Рассмотрение заявки занимает 3-5 рабочих дней</p>
          </div>
          <div className="mt-4">
            <a 
              href="mailto:admissions@aitu.edu.kz" 
              className="text-blue-600 hover:text-blue-700 font-medium text-sm"
            >
              Связаться с приемной комиссией →
            </a>
          </div>
        </motion.div>
      </div>

      <Navigation />
    </div>
  );
}