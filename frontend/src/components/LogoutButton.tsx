'use client';

import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { telegram } from '@/lib/telegram';

interface LogoutButtonProps {
  className?: string;
}

export default function LogoutButton({ className = '' }: LogoutButtonProps) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (isLoggingOut) return;

    const confirmed = confirm('Вы уверены, что хотите выйти?');
    if (!confirmed) return;

    setIsLoggingOut(true);
    
    try {
      // Haptic feedback
      telegram.hapticFeedback('impact', 'medium');
      
      // Просто перенаправляем на страницу logout - там все происходит
      window.location.href = '/logout';
      
    } catch (error) {
      console.error('Logout error:', error);
      // Fallback на прямой logout
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
  };

  return (
    <button
      onClick={handleLogout}
      disabled={isLoggingOut}
      className={`flex items-center space-x-2 text-gray-500 hover:text-red-600 transition-colors disabled:opacity-50 ${className}`}
      title="Выйти"
    >
      <LogOut className="w-5 h-5" />
      {isLoggingOut && <span className="text-sm">Выход...</span>}
    </button>
  );
}
