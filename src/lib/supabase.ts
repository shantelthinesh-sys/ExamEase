import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !anonKey) {
  console.error('Missing Supabase env vars. Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.');
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: 'student' | 'teacher';
  department: string | null;
  institution: string | null;
  student_id: string | null;
};

export type Exam = {
  id: string;
  owner_id: string;
  title: string;
  subject: string;
  description: string | null;
  instructions: string | null;
  duration_min: number;
  total_marks: number;
  start_time: string;
  end_time: string;
  max_attempts: number;
  negative_marking: number;
  shuffle_questions: boolean;
  shuffle_choices: boolean;
  results_visible: boolean;
  explanations_visible: boolean;
  status: 'draft' | 'scheduled' | 'published' | 'closed';
  created_at: string;
};

export type Question = {
  id: string;
  owner_id: string;
  subject: string;
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  marks: number;
  type: 'mcq' | 'tf';
  question_text: string;
  choices: string[];
  correct_index: number;
  explanation: string | null;
  created_at: string;
};

export type Attempt = {
  id: string;
  exam_id: string;
  user_id: string;
  status: 'in_progress' | 'submitted' | 'auto_submitted';
  score: number;
  total_marks: number;
  started_at: string;
  submitted_at: string | null;
  time_taken_sec: number | null;
};

export type StartExamQuestion = {
  id: string;
  text: string;
  choices: string[];
  display_order: number[];
  type: 'mcq' | 'tf';
  marks: number;
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
};

export type ReviewItem = {
  question_id: string;
  question_text: string;
  choices: string[];
  display_order: number[] | null;
  selected_index: number | null;
  correct_index: number | null;
  is_correct: boolean | null;
  marks_awarded: number | null;
  explanation: string | null;
  topic: string;
  marks: number;
};

export type LeaderboardRow = {
  rank: number;
  user_id: string;
  full_name: string;
  score: number;
  total_marks: number;
  percentage: number;
  submitted_at: string;
};

export type Announcement = {
  id: string;
  owner_id: string;
  exam_id: string | null;
  title: string;
  body: string;
  created_at: string;
};

export type PracticeAttempt = {
  id: string;
  user_id: string;
  subject: string;
  topic: string;
  difficulty: string;
  score: number;
  total: number;
  time_sec: number;
  created_at: string;
};

export type Achievement = {
  id: string;
  user_id: string;
  code: string;
  awarded_at: string;
};
