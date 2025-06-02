export interface User {
  id: string;
  telegram_id: number;
  username?: string;
  first_name: string;
  last_name?: string;
  email?: string;
  phone?: string;
  level: number;
  points: number;
  created_at: string;
}

export interface Question {
  id: string;
  text: string;
  options: string[];
  correct_answer: string;
  explanation?: string;
  type: 'multiple_choice' | 'true_false' | 'fill_blank';
}

export interface Test {
  id: string;
  title: string;
  description: string;
  category: 'ict' | 'logical' | 'reading' | 'useofenglish' | 'grammar';
  questions: Question[];
  time_limit: number;
  passing_score: number;
}

export interface TestSession {
  id: string;
  test_id: string;
  user_id: string;
  answers: Record<string, string>;
  score?: number;
  completed: boolean;
  started_at: string;
  completed_at?: string;
}

export interface Application {
  id: string;
  user_id: string;
  personal_data: {
    iin: string;
    gender: 'male' | 'female';
    birth_date: string;
  };
  education: {
    degree: string;
    program: string;
    ent_score: number;
  };
  documents: string[];
  status: 'submitted' | 'reviewing' | 'approved' | 'rejected' | 'accepted';
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'test_result' | 'application_status' | 'achievement' | 'reminder';
  read: boolean;
  created_at: string;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  points: number;
}