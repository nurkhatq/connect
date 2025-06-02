import { create } from 'zustand';
import { User, TestSession, Application, Notification } from '@/types';

interface AppState {
  // User state
  user: User | null;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  setAuthenticated: (auth: boolean) => void;

  // Test state
  activeTestSession: TestSession | null;
  testProgress: Record<string, number>;
  setActiveTestSession: (session: TestSession | null) => void;
  updateTestProgress: (testId: string, progress: number) => void;

  // Application state
  applicationData: Partial<Application>;
  applicationStep: number;
  updateApplicationData: (data: Partial<Application>) => void;
  setApplicationStep: (step: number) => void;

  // Notification state
  notifications: Notification[];
  unreadCount: number;
  setNotifications: (notifications: Notification[]) => void;
  markNotificationRead: (id: string) => void;

  // UI state
  theme: 'light' | 'dark';
  activeTab: string;
  setTheme: (theme: 'light' | 'dark') => void;
  setActiveTab: (tab: string) => void;
}

export const useAppStore = create<AppState>()((set) => ({
  // User state
  user: null,
  isAuthenticated: false,
  setUser: (user) => set({ user }),
  setAuthenticated: (isAuthenticated) => set({ isAuthenticated }),

  // Test state
  activeTestSession: null,
  testProgress: {},
  setActiveTestSession: (activeTestSession) => set({ activeTestSession }),
  updateTestProgress: (testId, progress) =>
    set((state) => ({
      testProgress: { ...state.testProgress, [testId]: progress },
    })),

  // Application state
  applicationData: {},
  applicationStep: 0,
  updateApplicationData: (data) =>
    set((state) => ({
      applicationData: { ...state.applicationData, ...data },
    })),
  setApplicationStep: (applicationStep) => set({ applicationStep }),

  // Notification state
  notifications: [],
  unreadCount: 0,
  setNotifications: (notifications) =>
    set({
      notifications,
      unreadCount: notifications.filter((n) => !n.read).length,
    }),
  markNotificationRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    })),

  // UI state
  theme: 'light',
  activeTab: 'home',
  setTheme: (theme) => set({ theme }),
  setActiveTab: (activeTab) => set({ activeTab }),
}));