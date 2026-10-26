import type { Exam, Question, Attempt, LeaderboardRow, Announcement, PracticeAttempt } from '@/lib/supabase';

// Clearly-labeled sample data for demo mode. These are static and never
// interact with the database, so demo visitors cannot modify real records.

export const demoExams: Exam[] = [
  {
    id: 'demo-exam-1',
    owner_id: 'demo-teacher',
    title: 'Data Structures & Algorithms — Mock Test',
    subject: 'DSA',
    description: 'A practice exam covering stacks, sorting, binary search and hash tables.',
    instructions: 'Read each question carefully. Negative marking of 0.25 applies for wrong answers. You have 30 minutes.',
    duration_min: 30,
    total_marks: 20,
    start_time: new Date(Date.now() - 86400000).toISOString(),
    end_time: new Date(Date.now() + 86400000).toISOString(),
    max_attempts: 1,
    negative_marking: 0.25,
    shuffle_questions: true,
    shuffle_choices: true,
    results_visible: true,
    explanations_visible: true,
    status: 'published',
    created_at: new Date(Date.now() - 90000000).toISOString(),
  },
  {
    id: 'demo-exam-2',
    owner_id: 'demo-teacher',
    title: 'Operating Systems Fundamentals',
    subject: 'OS',
    description: 'Process scheduling, memory management and deadlocks.',
    instructions: 'Standard exam. No negative marking. 45 minutes.',
    duration_min: 45,
    total_marks: 50,
    start_time: new Date(Date.now() + 3600000).toISOString(),
    end_time: new Date(Date.now() + 86400000).toISOString(),
    max_attempts: 1,
    negative_marking: 0,
    shuffle_questions: false,
    shuffle_choices: false,
    results_visible: true,
    explanations_visible: true,
    status: 'scheduled',
    created_at: new Date(Date.now() - 50000000).toISOString(),
  },
];

export const demoQuestions: Question[] = [
  {
    id: 'demo-q-1',
    owner_id: 'demo-teacher',
    subject: 'DSA',
    topic: 'Stacks',
    difficulty: 'easy',
    marks: 2,
    type: 'mcq',
    question_text: 'Which data structure uses LIFO (Last-In-First-Out) ordering?',
    choices: ['Queue', 'Stack', 'Linked List', 'Tree'],
    correct_index: 1,
    explanation: 'A stack removes the most recently inserted element first, which is LIFO ordering.',
    created_at: new Date(Date.now() - 80000000).toISOString(),
  },
  {
    id: 'demo-q-2',
    owner_id: 'demo-teacher',
    subject: 'DSA',
    topic: 'Sorting',
    difficulty: 'medium',
    marks: 2,
    type: 'mcq',
    question_text: 'What is the average-case time complexity of Quick Sort?',
    choices: ['O(n)', 'O(n log n)', 'O(n^2)', 'O(log n)'],
    correct_index: 1,
    explanation: 'Quick Sort averages O(n log n) due to balanced partitions on random pivots; worst case is O(n^2).',
    created_at: new Date(Date.now() - 79000000).toISOString(),
  },
  {
    id: 'demo-q-3',
    owner_id: 'demo-teacher',
    subject: 'DSA',
    topic: 'Binary Search',
    difficulty: 'medium',
    marks: 2,
    type: 'mcq',
    question_text: 'Binary search requires the input array to be:',
    choices: ['Random', 'Sorted', 'Reversed', 'A power of two in length'],
    correct_index: 1,
    explanation: 'Binary search halves the search range based on ordering, so the array must be sorted.',
    created_at: new Date(Date.now() - 78000000).toISOString(),
  },
  {
    id: 'demo-q-4',
    owner_id: 'demo-teacher',
    subject: 'DSA',
    topic: 'Hash Tables',
    difficulty: 'hard',
    marks: 2,
    type: 'mcq',
    question_text: 'In the worst case, a hash table lookup degrades to O(n) when:',
    choices: ['The table uses chaining', 'All keys collide into the same bucket', 'The load factor is 0.5', 'The hash function is perfect'],
    correct_index: 1,
    explanation: 'If every key hashes to the same bucket, the bucket list must be scanned linearly, giving O(n).',
    created_at: new Date(Date.now() - 77000000).toISOString(),
  },
  {
    id: 'demo-q-5',
    owner_id: 'demo-teacher',
    subject: 'DSA',
    topic: 'Stacks',
    difficulty: 'easy',
    marks: 2,
    type: 'tf',
    question_text: 'A stack can be implemented using an array.',
    choices: ['True', 'False'],
    correct_index: 0,
    explanation: 'An array with a top pointer is a standard stack implementation.',
    created_at: new Date(Date.now() - 76000000).toISOString(),
  },
];

export const demoAttempts: Attempt[] = [
  {
    id: 'demo-attempt-1',
    exam_id: 'demo-exam-1',
    user_id: 'demo-student',
    status: 'submitted',
    score: 14,
    total_marks: 20,
    started_at: new Date(Date.now() - 7200000).toISOString(),
    submitted_at: new Date(Date.now() - 6900000).toISOString(),
    time_taken_sec: 300,
  },
];

export const demoLeaderboard: LeaderboardRow[] = [
  { rank: 1, user_id: 'demo-stu-a', full_name: 'Aarav Sharma', score: 18, total_marks: 20, percentage: 90, submitted_at: new Date(Date.now() - 3600000).toISOString() },
  { rank: 2, user_id: 'demo-stu-b', full_name: 'Priya Nair', score: 16, total_marks: 20, percentage: 80, submitted_at: new Date(Date.now() - 3500000).toISOString() },
  { rank: 3, user_id: 'demo-student', full_name: 'Demo Student', score: 14, total_marks: 20, percentage: 70, submitted_at: new Date(Date.now() - 6900000).toISOString() },
  { rank: 4, user_id: 'demo-stu-d', full_name: 'Rohan Gupta', score: 12, total_marks: 20, percentage: 60, submitted_at: new Date(Date.now() - 3400000).toISOString() },
];

export const demoAnnouncements: Announcement[] = [
  {
    id: 'demo-ann-1',
    owner_id: 'demo-teacher',
    exam_id: 'demo-exam-1',
    title: 'DSA Mock Test now live',
    body: 'The DSA mock test is open for the next 24 hours. Use the Practice Zone first to warm up on stacks and sorting.',
    created_at: new Date(Date.now() - 10000000).toISOString(),
  },
];

export const demoPractice: PracticeAttempt[] = [
  { id: 'p1', user_id: 'demo-student', subject: 'DSA', topic: 'Stacks', difficulty: 'easy', score: 4, total: 5, time_sec: 120, created_at: new Date(Date.now() - 86400000).toISOString() },
  { id: 'p2', user_id: 'demo-student', subject: 'DSA', topic: 'Sorting', difficulty: 'medium', score: 3, total: 5, time_sec: 180, created_at: new Date(Date.now() - 43200000).toISOString() },
  { id: 'p3', user_id: 'demo-student', subject: 'DSA', topic: 'Binary Search', difficulty: 'medium', score: 5, total: 5, time_sec: 90, created_at: new Date(Date.now() - 7200000).toISOString() },
];

// Exam→question mapping for demo
export const demoExamQuestions: Record<string, string[]> = {
  'demo-exam-1': ['demo-q-1', 'demo-q-2', 'demo-q-3', 'demo-q-4', 'demo-q-5'],
};
