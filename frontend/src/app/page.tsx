'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api';
import { telegram } from '@/lib/telegram';

export default function HomePage() {
  const router = useRouter();
  const { setAuthenticated, setUser } = useAppStore();

  useEffect(() => {
    const authenticateUser = async () => {
      try {
        // Check if already authenticated
        const token = api.getToken();
        if (token) {
          const user = await api.getProfile();
          setUser(user);
          setAuthenticated(true);
          router.push('/dashboard');
          return;
        }

        // Try to authenticate with Telegram
        const initData = telegram.getInitData();
        if (initData) {
          const response = await api.login(initData);
          api.setToken(response.access_token);
          setUser(response.user);
          setAuthenticated(true);
          router.push('/dashboard');
        } else {
          router.push('/login');
        }
      } catch (error) {
        console.error('Authentication failed:', error);
        router.push('/login');
      }
    };

    authenticateUser();
  }, [router, setAuthenticated, setUser]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-600">Загрузка AITU Excellence Test...</p>
      </div>
    </div>
  );
}