import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { ToastProvider } from '@/context/ToastContext';
import { DashboardShell } from '@/components/DashboardShell';
import { RequireAuth } from '@/components/RequireAuth';

import Landing from '@/pages/Landing';
import GetStarted from '@/pages/GetStarted';
import Login from '@/pages/Login';
import Register from '@/pages/Register';

import {
  StudentOverview, StudentExams, StudentMyExams, StudentResults, StudentInsights,
  StudentLeaderboard, StudentBookmarks, StudentHistory, StudentAchievements, StudentProfile,
  studentNav,
} from '@/pages/student/StudentPages';
import TakeExam from '@/pages/student/TakeExam';
import ExamResult from '@/pages/student/ExamResult';
import PracticeZone from '@/pages/student/PracticeZone';
import DsaLab from '@/pages/student/DsaLab';

import {
  TeacherOverview, CreateExam, QuestionBank, ManageExams, TeacherStudents,
  TeacherAnalytics, TeacherLeaderboard, TeacherAnnouncements, TeacherProfile,
  teacherNav,
} from '@/pages/teacher/TeacherPages';

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/get-started" element={<GetStarted />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            <Route path="/student" element={<RequireAuth role="student"><DashboardShell items={studentNav} accent="blue" /></RequireAuth>}>
              <Route index element={<StudentOverview />} />
              <Route path="exams" element={<StudentExams />} />
              <Route path="my-exams" element={<StudentMyExams />} />
              <Route path="practice" element={<PracticeZone />} />
              <Route path="dsa-lab" element={<DsaLab />} />
              <Route path="results" element={<StudentResults />} />
              <Route path="results/:id" element={<ExamResult />} />
              <Route path="insights" element={<StudentInsights />} />
              <Route path="leaderboard" element={<StudentLeaderboard />} />
              <Route path="bookmarks" element={<StudentBookmarks />} />
              <Route path="history" element={<StudentHistory />} />
              <Route path="achievements" element={<StudentAchievements />} />
              <Route path="profile" element={<StudentProfile />} />
              <Route path="take/:id" element={<TakeExam />} />
            </Route>

            <Route path="/teacher" element={<RequireAuth role="teacher"><DashboardShell items={teacherNav} accent="emerald" /></RequireAuth>}>
              <Route index element={<TeacherOverview />} />
              <Route path="create" element={<CreateExam />} />
              <Route path="questions" element={<QuestionBank />} />
              <Route path="manage" element={<ManageExams />} />
              <Route path="students" element={<TeacherStudents />} />
              <Route path="analytics" element={<TeacherAnalytics />} />
              <Route path="leaderboard" element={<TeacherLeaderboard />} />
              <Route path="announcements" element={<TeacherAnnouncements />} />
              <Route path="profile" element={<TeacherProfile />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
