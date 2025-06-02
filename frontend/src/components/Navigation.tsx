'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { 
  Home, 
  FileText, 
  Send, 
  Bell, 
  User 
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { telegram } from '@/lib/telegram';
import { useEffect } from 'react';

const navigationItems = [
  { href: '/dashboard', icon: Home, label: 'Главная' },
  { href: '/tests', icon: FileText, label: 'Тесты' },
  { href: '/application', icon: Send, label: 'Заявка' },
  { href: '/notifications', icon: Bell, label: 'Уведомления' },
  { href: '/profile', icon: User, label: 'Профиль' },
];

export default function Navigation() {
  const pathname = usePathname();
  const { unreadCount, setActiveTab } = useAppStore();

  useEffect(() => {
    const activeTab = navigationItems.find(item => pathname.startsWith(item.href));
    if (activeTab) {
      setActiveTab(activeTab.label.toLowerCase());
    }
  }, [pathname, setActiveTab]);

  const handleTabClick = (href: string, label: string) => {
    telegram.hapticFeedback('selection');
    setActiveTab(label.toLowerCase());
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-2 py-1 z-50">
      <div className="flex justify-around items-center max-w-md mx-auto">
        {navigationItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => handleTabClick(item.href, item.label)}
              className="relative flex flex-col items-center p-2 rounded-lg transition-all duration-200"
            >
              <motion.div
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className={`relative p-2 rounded-full transition-all duration-200 ${
                  isActive 
                    ? 'bg-blue-500 text-white' 
                    : 'text-gray-500 hover:text-blue-500'
                }`}
              >
                <Icon className="w-5 h-5" />
                
                {/* Notification badge */}
                {item.label === 'Уведомления' && unreadCount > 0 && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center"
                  >
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </motion.div>
                )}
              </motion.div>
              
              <span className={`text-xs mt-1 transition-colors ${
                isActive ? 'text-blue-500 font-medium' : 'text-gray-500'
              }`}>
                {item.label}
              </span>
              
              {/* Active indicator */}
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute -top-1 w-1 h-1 bg-blue-500 rounded-full"
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}