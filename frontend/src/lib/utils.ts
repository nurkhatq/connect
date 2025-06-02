import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatPoints(points: number): string {
  return points.toLocaleString('ru-RU');
}

export function getScoreColor(score: number): string {
  if (score >= 90) return 'text-green-600';
  if (score >= 70) return 'text-yellow-600';
  return 'text-red-600';
}

export function getScoreBgColor(score: number): string {
  if (score >= 90) return 'bg-green-100';
  if (score >= 70) return 'bg-yellow-100';
  return 'bg-red-100';
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function validateIIN(iin: string): boolean {
  if (!/^\d{12}$/.test(iin)) return false;
  
  const weights = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  let sum = 0;
  
  for (let i = 0; i < 11; i++) {
    sum += parseInt(iin[i]) * weights[i];
  }
  
  let checkDigit = sum % 11;
  if (checkDigit === 10) {
    sum = 0;
    const secondWeights = [3, 4, 5, 6, 7, 8, 9, 10, 11, 1, 2];
    for (let i = 0; i < 11; i++) {
      sum += parseInt(iin[i]) * secondWeights[i];
    }
    checkDigit = sum % 11;
  }
  
  return checkDigit === parseInt(iin[11]);
}

export function getInitials(firstName?: string, lastName?: string): string {
  const first = firstName?.charAt(0)?.toUpperCase() || '';
  const last = lastName?.charAt(0)?.toUpperCase() || '';
  return `${first}${last}` || '??';
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

export function getRelativeTime(date: string | Date): string {
  const now = new Date();
  const targetDate = new Date(date);
  const diffInHours = Math.floor((now.getTime() - targetDate.getTime()) / (1000 * 60 * 60));
  
  if (diffInHours < 1) return 'только что';
  if (diffInHours < 24) return `${diffInHours} ч. назад`;
  if (diffInHours < 48) return 'вчера';
  
  return targetDate.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short'
  });
}

export function generateRandomId(): string {
  return Math.random().toString(36).substr(2, 9);
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^(\+7|8)?[\s\-]?\(?[0-9]{3}\)?[\s\-]?[0-9]{3}[\s\-]?[0-9]{2}[\s\-]?[0-9]{2}$/;
  return phoneRegex.test(phone);
}
