import React from 'react';
import { motion } from 'framer-motion';

export interface BroadcastModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (data: { title: string; message: string; target: string }) => void;
}

export const BroadcastModal: React.FC<BroadcastModalProps> = ({
  isOpen,
  onClose,
  onSend
}) => {
  const [formData, setFormData] = React.useState({
    title: '',
    message: '',
    target: 'all'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSend(formData);
    setFormData({ title: '', message: '', target: 'all' });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-xl w-full max-w-md"
      >
        <div className="p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Массовая рассылка</h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Заголовок
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Введите заголовок уведомления"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Сообщение
              </label>
              <textarea
                value={formData.message}
                onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Введите текст сообщения"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Получатели
              </label>
              <select
                value={formData.target}
                onChange={(e) => setFormData(prev => ({ ...prev, target: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Все пользователи</option>
                <option value="active">Активные пользователи</option>
                <option value="level_5">Пользователи 5+ уровня</option>
                <option value="level_10">Пользователи 10+ уровня</option>
              </select>
            </div>

            <div className="flex space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Отмена
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                Отправить
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
};
