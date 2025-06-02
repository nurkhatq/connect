import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Providers from './providers';
import TelegramScript from '@/components/TelegramScript';
import TelegramDebugger from '@/components/TelegramDebugger';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'AITU Excellence Test',
  description: 'Astana IT University admission testing platform',
};

export function generateViewport() {
  return {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body className={inter.className}>
        <TelegramScript />
        <Providers>{children}</Providers>
        <TelegramDebugger />
      </body>
    </html>
  );
}
