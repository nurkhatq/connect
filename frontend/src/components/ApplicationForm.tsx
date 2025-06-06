'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
  ArrowRight, 
  Upload, 
  X, 
  CheckCircle,
  FileText,
  User,
  GraduationCap,
  AlertCircle
} from 'lucide-react';
import { api } from '@/lib/api';
import { telegram } from '@/lib/telegram';
import { validateIIN } from '@/lib/utils';

interface ApplicationFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export default function ApplicationForm({ onSuccess, onCancel }: ApplicationFormProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    personalData: {
      iin: '',
      gender: '',
      birthDate: ''
    },
    education: {
      degree: '',
      program: '',
      entScore: ''
    },
    documents: [] as string[]
  });

  const steps = [
    {
      title: 'Личные данные',
      description: 'Основная информация',
      icon: User,
      fields: ['iin', 'gender', 'birthDate']
    },
    {
      title: 'Образование',
      description: 'Академическая информация',
      icon: GraduationCap,
      fields: ['degree', 'program', 'entScore']
    },
    {
      title: 'Документы',
      description: 'Загрузка файлов',
      icon: FileText,
      fields: ['documents']
    },
    {
      title: 'Подтверждение',
      description: 'Проверка и отправка',
      icon: CheckCircle,
      fields: []
    }
  ];

  const programs = [
    'Информационные системы',
    'Программная инженерия',
    'Кибербезопасность',
    'Искусственный интеллект',
    'Компьютерные науки',
    'IT-менеджмент',
    'Цифровые технологии',
    'Разработка игр'
  ];

  const degrees = [
    'Бакалавриат',
    'Магистратура',
    'Докторантура'
  ];

  const updateFormData = (section: string, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...prev[section as keyof typeof prev],
        [field]: value
      }
    }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateStep = (stepIndex: number): boolean => {
    const newErrors: Record<string, string> = {};

    switch (stepIndex) {
      case 0:
        if (!formData.personalData.iin) {
          newErrors.iin = 'ИИН обязателен для заполнения';
        } else if (formData.personalData.iin.length !== 12) {
          newErrors.iin = 'ИИН должен содержать 12 цифр';
        } else if (!validateIIN(formData.personalData.iin)) {
          newErrors.iin = 'Некорректный ИИН';
        }
        
        if (!formData.personalData.gender) {
          newErrors.gender = 'Выберите пол';
        }
        
        if (!formData.personalData.birthDate) {
          newErrors.birthDate = 'Выберите дату рождения';
        } else {
          const birthYear = new Date(formData.personalData.birthDate).getFullYear();
          const currentYear = new Date().getFullYear();
          if (currentYear - birthYear < 16 || currentYear - birthYear > 80) {
            newErrors.birthDate = 'Проверьте корректность даты рождения';
          }
        }
        break;

      case 1:
        if (!formData.education.degree) {
          newErrors.degree = 'Выберите уровень образования';
        }
        
        if (!formData.education.program) {
          newErrors.program = 'Выберите программу обучения';
        }
        
        if (!formData.education.entScore) {
          newErrors.entScore = 'Укажите баллы ЕНТ';
        } else {
          const score = parseInt(formData.education.entScore);
          if (isNaN(score) || score < 0 || score > 140) {
            newErrors.entScore = 'Баллы ЕНТ должны быть от 0 до 140';
          }
        }
        break;

      case 2:
        if (formData.documents.length === 0) {
          newErrors.documents = 'Загрузите хотя бы один документ';
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 🔥 ИСПРАВЛЕННЫЙ handleFileUpload
  const handleFileUpload = async (file: File) => {
    if (isUploading) return;
    
    console.log('📁 Starting file upload:', file.name, file.size, file.type);
    
    setIsUploading(true);
    try {
      // Дополнительная валидация на фронтенде
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        throw new Error(`Файл "${file.name}" слишком большой. Максимальный размер: 10MB`);
      }
      
      const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'];
      const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
      if (!allowedExtensions.includes(fileExtension)) {
        throw new Error(`Неподдерживаемый тип файла "${fileExtension}". Разрешены: PDF, JPG, PNG, DOC, DOCX`);
      }
      
      console.log('✅ File validation passed, uploading...');
      const response = await api.uploadDocument(file);
      
      console.log('✅ Upload successful:', response);
      
      setUploadedFiles(prev => [...prev, response]);
      setFormData(prev => ({
        ...prev,
        documents: [...prev.documents, response.filename]
      }));
      
      telegram.hapticFeedback('notification', 'success');
      
      // Clear documents error if exists
      if (errors.documents) {
        setErrors(prev => ({ ...prev, documents: '' }));
      }
      
    } catch (error: any) {
      console.error('❌ Upload failed:', error);
      telegram.hapticFeedback('notification', 'error');
      
      // Показываем конкретную ошибку пользователю
      setErrors(prev => ({ 
        ...prev, 
        documents: error.message || 'Ошибка загрузки файла' 
      }));
      
    } finally {
      setIsUploading(false);
    }
  };

  // 🔥 УЛУЧШЕННЫЙ handleFileSelect с лучшей обработкой множественных файлов
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    if (files.length === 0) return;
    
    console.log(`📁 Selected ${files.length} files for upload`);
    
    // Загружаем файлы последовательно для избежания проблем
    for (const file of files) {
      try {
        await handleFileUpload(file);
        // Небольшая пауза между загрузками
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Failed to upload ${file.name}:`, error);
        // Продолжаем с остальными файлами
      }
    }
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
    setFormData(prev => ({
      ...prev,
      documents: prev.documents.filter((_, i) => i !== index)
    }));
    telegram.hapticFeedback('impact', 'light');
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => prev + 1);
      telegram.hapticFeedback('impact', 'light');
    } else {
      telegram.hapticFeedback('notification', 'error');
    }
  };

  const handlePrevious = () => {
    setCurrentStep(prev => prev - 1);
    telegram.hapticFeedback('impact', 'light');
  };

  // 🔥 ИСПРАВЛЕННЫЙ handleSubmit
  const handleSubmit = async () => {
    if (isSubmitting) return;
    
    console.log('📋 Starting application submission...');
    console.log('Form data:', formData);
    
    setIsSubmitting(true);
    
    try {
      // Финальная валидация перед отправкой
      if (!formData.personalData.iin || formData.personalData.iin.length !== 12) {
        throw new Error('ИИН должен содержать 12 цифр');
      }
      
      if (!formData.personalData.gender) {
        throw new Error('Выберите пол');
      }
      
      if (!formData.personalData.birthDate) {
        throw new Error('Выберите дату рождения');
      }
      
      if (!formData.education.degree) {
        throw new Error('Выберите уровень образования');
      }
      
      if (!formData.education.program) {
        throw new Error('Выберите программу обучения');
      }
      
      const entScore = parseInt(formData.education.entScore);
      if (isNaN(entScore) || entScore < 0 || entScore > 140) {
        throw new Error('Баллы ЕНТ должны быть от 0 до 140');
      }
      
      if (formData.documents.length === 0) {
        throw new Error('Загрузите хотя бы один документ');
      }
      
      // 🔥 Формируем данные для отправки точно как ожидает бэкенд
      const applicationData = {
        personal_data: {
          iin: formData.personalData.iin,
          gender: formData.personalData.gender,
          birth_date: formData.personalData.birthDate
        },
        education: {
          degree: formData.education.degree,
          program: formData.education.program,
          ent_score: entScore // Убеждаемся что это число
        },
        documents: formData.documents
      };
      
      console.log('📤 Sending application data:', applicationData);
      
      const response = await api.submitApplication(applicationData);
      
      console.log('✅ Application submitted successfully:', response);
      
      telegram.hapticFeedback('notification', 'success');
      onSuccess();
      
    } catch (error: any) {
      console.error('❌ Application submission failed:', error);
      telegram.hapticFeedback('notification', 'error');
      
      // Показываем конкретную ошибку
      alert(`Ошибка подачи заявки: ${error.message || 'Неизвестная ошибка'}`);
      
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ИИН <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                maxLength={12}
                value={formData.personalData.iin}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '');
                  updateFormData('personalData', 'iin', value);
                }}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                  errors.iin ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="123456789012"
              />
              {errors.iin && (
                <p className="text-red-500 text-sm mt-1 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {errors.iin}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Пол <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'male', label: 'Мужской', emoji: '👨' },
                  { value: 'female', label: 'Женский', emoji: '👩' }
                ].map((option) => (
                  <motion.button
                    key={option.value}
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => updateFormData('personalData', 'gender', option.value)}
                    className={`p-4 rounded-lg border-2 transition-all flex items-center justify-center space-x-2 ${
                      formData.personalData.gender === option.value
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className="text-xl">{option.emoji}</span>
                    <span>{option.label}</span>
                  </motion.button>
                ))}
              </div>
              {errors.gender && (
                <p className="text-red-500 text-sm mt-1 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {errors.gender}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Дата рождения <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.personalData.birthDate}
                onChange={(e) => updateFormData('personalData', 'birthDate', e.target.value)}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                  errors.birthDate ? 'border-red-500' : 'border-gray-300'
                }`}
                max={new Date(Date.now() - 16 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
              />
              {errors.birthDate && (
                <p className="text-red-500 text-sm mt-1 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {errors.birthDate}
                </p>
              )}
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Уровень образования <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.education.degree}
                onChange={(e) => updateFormData('education', 'degree', e.target.value)}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                  errors.degree ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                <option value="">Выберите уровень</option>
                {degrees.map((degree) => (
                  <option key={degree} value={degree}>{degree}</option>
                ))}
              </select>
              {errors.degree && (
                <p className="text-red-500 text-sm mt-1 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {errors.degree}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Программа обучения <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.education.program}
                onChange={(e) => updateFormData('education', 'program', e.target.value)}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                  errors.program ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                <option value="">Выберите программу</option>
                {programs.map((program) => (
                  <option key={program} value={program}>{program}</option>
                ))}
              </select>
              {errors.program && (
                <p className="text-red-500 text-sm mt-1 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {errors.program}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Баллы ЕНТ <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                max="140"
                value={formData.education.entScore}
                onChange={(e) => updateFormData('education', 'entScore', e.target.value)}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                  errors.entScore ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="0-140"
              />
              {errors.entScore && (
                <p className="text-red-500 text-sm mt-1 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {errors.entScore}
                </p>
              )}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-800 mb-2">💡 Информация о баллах ЕНТ</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Минимальный проходной балл: 70</li>
                <li>• Рекомендуемый балл для IT специальностей: 100+</li>
                <li>• Максимальный балл: 140</li>
              </ul>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Документы <span className="text-red-500">*</span>
              </label>
              <p className="text-sm text-gray-600 mb-4">
                Загрузите необходимые документы (PDF, JPG, PNG, DOC, DOCX, до 10MB)
              </p>
              
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                onChange={handleFileSelect}
                className="hidden"
              />
              
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className={`w-full border-2 border-dashed rounded-lg p-8 text-center transition-all ${
                  errors.documents 
                    ? 'border-red-300 bg-red-50' 
                    : 'border-gray-300 hover:border-blue-400 bg-gray-50'
                } ${isUploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                {isUploading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                    <span className="text-gray-600">Загрузка...</span>
                  </div>
                ) : (
                  <>
                    <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600 font-medium">Нажмите для выбора файлов</p>
                    <p className="text-sm text-gray-500 mt-1">или перетащите файлы сюда</p>
                  </>
                )}
              </motion.button>
              
              {errors.documents && (
                <p className="text-red-500 text-sm mt-2 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {errors.documents}
                </p>
              )}
            </div>

            {uploadedFiles.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium text-gray-800">Загруженные файлы:</h4>
                {uploadedFiles.map((file, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between bg-gray-50 p-4 rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <FileText className="w-5 h-5 text-blue-500" />
                      <div>
                        <p className="text-sm font-medium text-gray-800">{file.original_name}</p>
                        <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                      </div>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      type="button"
                      onClick={() => removeFile(index)}
                      className="p-1 hover:bg-gray-200 rounded-full transition-colors"
                    >
                      <X className="w-4 h-4 text-gray-500" />
                    </motion.button>
                  </motion.div>
                ))}
              </div>
            )}

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 className="font-medium text-yellow-800 mb-2">📋 Необходимые документы:</h4>
              <ul className="text-sm text-yellow-700 space-y-1">
                <li>• Документ об образовании</li>
                <li>• Результаты ЕНТ</li>
                <li>• Копия удостоверения личности</li>
                <li>• Медицинская справка (форма 086-у)</li>
                <li>• Фотографии 3x4 (6 штук)</li>
              </ul>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="bg-blue-50 rounded-lg p-6">
              <h3 className="font-semibold text-blue-800 mb-4 flex items-center">
                <CheckCircle className="w-5 h-5 mr-2" />
                Проверьте данные перед отправкой
              </h3>
              
              <div className="space-y-6">
                <div>
                  <h4 className="font-medium text-gray-800 mb-2">👤 Личные данные</h4>
                  <div className="bg-white rounded-lg p-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">ИИН:</span>
                      <span className="font-medium">{formData.personalData.iin}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Пол:</span>
                      <span className="font-medium">
                        {formData.personalData.gender === 'male' ? 'Мужской' : 'Женский'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Дата рождения:</span>
                      <span className="font-medium">
                        {new Date(formData.personalData.birthDate).toLocaleDateString('ru-RU')}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-800 mb-2">🎓 Образование</h4>
                  <div className="bg-white rounded-lg p-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Уровень:</span>
                      <span className="font-medium">{formData.education.degree}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Программа:</span>
                      <span className="font-medium">{formData.education.program}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Баллы ЕНТ:</span>
                      <span className="font-medium">{formData.education.entScore}</span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-800 mb-2">📄 Документы</h4>
                  <div className="bg-white rounded-lg p-4">
                    <p className="text-gray-600">
                      Загружено файлов: <span className="font-medium">{uploadedFiles.length}</span>
                    </p>
                    <div className="mt-2 space-y-1">
                      {uploadedFiles.map((file, index) => (
                        <p key={index} className="text-sm text-gray-500">
                          • {file.original_name}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div>
                  <p className="text-sm text-yellow-800 font-medium">Важно!</p>
                  <p className="text-sm text-yellow-700 mt-1">
                    После отправки заявки вы не сможете изменить данные. 
                    Убедитесь, что вся информация указана верно.
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="flex items-center justify-between p-4">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onCancel}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </motion.button>
          <h1 className="text-lg font-semibold">Подача заявки</h1>
          <div className="w-9" /> {/* Spacer */}
        </div>
        
        {/* Progress Steps */}
        <div className="px-4 pb-4">
          <div className="flex items-center space-x-2">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = index === currentStep;
              const isCompleted = index < currentStep;
              
              return (
                <div key={index} className="flex items-center flex-1">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: index * 0.1 }}
                    className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all ${
                      isCompleted 
                        ? 'bg-green-500 border-green-500 text-white'
                        : isActive
                        ? 'bg-blue-500 border-blue-500 text-white'
                        : 'border-gray-300 text-gray-400'
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      <Icon className="w-5 h-5" />
                    )}
                  </motion.div>
                  {index < steps.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-2 transition-all ${
                      isCompleted ? 'bg-green-500' : 'bg-gray-300'
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
          
          <div className="mt-3">
            <h2 className="font-semibold text-gray-800">{steps[currentStep].title}</h2>
            <p className="text-sm text-gray-600">{steps[currentStep].description}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="bg-white rounded-xl p-6 shadow-sm"
          >
            {renderStepContent()}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handlePrevious}
            disabled={currentStep === 0}
            className="flex items-center space-x-2 px-4 py-3 text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Назад</span>
          </motion.button>

          {currentStep === steps.length - 1 ? (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex items-center space-x-2 bg-green-500 hover:bg-green-600 text-white px-8 py-3 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  <span>Отправка...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>Подать заявку</span>
                </>
              )}
            </motion.button>
          ) : (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleNext}
              className="flex items-center space-x-2 bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium transition-all"
            >
              <span>Далее</span>
              <ArrowRight className="w-4 h-4" />
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
}