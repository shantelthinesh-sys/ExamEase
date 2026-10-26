import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LayoutDashboard, BookOpen, ClipboardList, Code2, BarChart3, Brain,
  Trophy, Bookmark, History, Award, User as UserIcon, Search, Clock,
  CheckCircle2, AlertCircle, TrendingUp, Flame, Target,
} from 'lucide-react';
import { supabase, type Exam, type Attempt, type PracticeAttempt, type Announcement, type LeaderboardRow } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useDemo } from '@/hooks/useDemo';
import { Card, Button, Badge, StatCard, PageHeader, EmptyState, Spinner } from '@/components/ui';
import {
  demoExams, demoAttempts, demoPractice, demoAnnouncements, demoLeaderboard, demoExamQuestions,
} from '@/demo/data';

export const studentNav = [
  { to: '/student', label: 'Overview', icon: <LayoutDashboard size={18} /> },
  { to: '/student/exams', label: 'Available Exams', icon: <BookOpen size={18} /> },
  { to: '/student/my-exams', label: 'My Exams', icon: <ClipboardList size={18} /> },
  { to: '/student/practice', label: 'Practice Zone', icon: <Target size={18} /> },
  { to: '/student/dsa-lab', label: 'DSA Lab', icon: <Code2 size={18} /> },
  { to: '/student/results', label: 'Results & Analytics', icon: <BarChart3 size={18} /> },
  { to: '/student/insights', label: 'Smart Learning Insights', icon: <Brain size={18} /> },
  { to: '/student/leaderboard', label: 'Leaderboard', icon: <Trophy size={18} /> },
  { to: '/student/bookmarks', label: 'Bookmarked Questions', icon: <Bookmark size={18} /> },
  { to: '/student/history', label: 'Exam History', icon: <History size={18} /> },
  { to: '/student/achievements', label: 'Achievements', icon: <Award size={18} /> },
  { to: '/student/profile', label: 'Profile & Settings', icon: <UserIcon size={18} /> },
];

// ---------- Overview ----------
export function StudentOverview() {
  const { profile } = useAuth();
  const { isDemo } = useDemo();
  const [exams, setExams] = useState<Exam[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [practice, setPractice] = useState<PracticeAttempt[]>([]);
  const [anns, setAnns] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isDemo) {
      setExams(demoExams);
      setAttempts(demoAttempts);
      setPractice(demoPractice);
      setAnns(demoAnnouncements);
      setLoading(false);
      return;
    }
    (async () => {
      const [{ data: ex }, { data: at }, { data: pr }, { data: an }] = await Promise.all([
        supabase.from('exams').select('*').eq('status', 'published'),
        supabase.from('attempts').select('*').order('started_at', { ascending: false }),
        supabase.from('practice_attempts').select('*').order('created_at', { ascending: false }).limit(20),
        supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(5),
      ]);
      setExams((ex as Exam[]) || []);
      setAttempts((at as Attempt[]) || []);
      setPractice((pr as PracticeAttempt[]) || []);
      setAnns((an as Announcement[]) || []);
      setLoading(false);
    })();
  }, [isDemo]);

  const stats = useMemo(() => {
    const done = attempts.filter((a) => a.status !== 'in_progress');
    const avg = done.length ? done.reduce((s, a) => s + (a.total_marks ? (a.score / a.total_marks) * 100 : 0), 0) / done.length : 0;
    const best = done.length ? Math.max(...done.map((a) => (a.total_marks ? (a.score / a.total_marks) * 100 : 0))) : 0;
    // streak: consecutive days with a practice attempt
    const days = new Set(practice.map((p) => new Date(p.created_at).toDateString()));
    let streak = 0;
    for (let i = 0; i < 365; i++) {
      const d = new Date(Date.now() - i * 86400000).toDateString();
      if (days.has(d)) streak++;
      else if (i > 0) break;
    }
    return { avg: Math.round(avg), best: Math.round(best), streak, available: exams.filter((e) => new Date(e.start_time) <= new Date() && new Date(e.end_time) >= new Date()).length };
  }, [attempts, practice, exams]);

  if (loading) return <Loading />;

  return (
    <>
      <PageHeader title={`Hello, ${profile?.full_name?.split(' ')[0] || 'Student'}`} subtitle="Here's your learning at a glance." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Average score" value={`${stats.avg}%`} icon={<TrendingUp size={20} />} accent="blue" />
        <StatCard label="Personal best" value={`${stats.best}%`} icon={<Target size={20} />} accent="green" />
        <StatCard label="Practice streak" value={`${stats.streak}d`} icon={<Flame size={20} />} accent="amber" />
        <StatCard label="Available exams" value={stats.available} icon={<BookOpen size={20} />} accent="purple" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h2 className="font-semibold">Available & upcoming exams</h2>
          <div className="mt-4 space-y-3">
            {exams.length === 0 && <EmptyState title="No exams available" subtitle="Check back soon." icon={<BookOpen size={28} />} />}
            {exams.slice(0, 4).map((e) => {
              const now = new Date();
              const open = new Date(e.start_time) <= now && new Date(e.end_time) >= now;
              return (
                <div key={e.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-4">
                  <div>
                    <p className="font-semibold">{e.title}</p>
                    <p className="text-sm text-slate-500">{e.subject} · {e.duration_min} min · {e.total_marks} marks</p>
                  </div>
                  {open ? <Badge color="green">Open</Badge> : new Date(e.start_time) > now ? <Badge color="amber">Upcoming</Badge> : <Badge color="slate">Closed</Badge>}
                </div>
              );
            })}
          </div>
          <Link to="/student/exams" className="mt-4 inline-block text-sm font-semibold text-blue-600 hover:text-blue-700">View all →</Link>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold">Announcements</h2>
          <div className="mt-4 space-y-3">
            {anns.length === 0 && <EmptyState title="No announcements" icon={<AlertCircle size={28} />} />}
            {anns.map((an) => (
              <div key={an.id} className="rounded-xl bg-slate-50 p-3">
                <p className="text-sm font-semibold">{an.title}</p>
                <p className="mt-1 text-xs text-slate-600 line-clamp-2">{an.body}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="mt-6 p-5">
        <h2 className="font-semibold">Recent activity</h2>
        <div className="mt-4 space-y-2">
          {attempts.length === 0 && practice.length === 0 && <EmptyState title="No activity yet" subtitle="Take an exam or try the Practice Zone." />}
          {[...attempts.map((a) => ({ kind: 'exam' as const, at: a.started_at, label: `Attempted exam`, score: a.status !== 'in_progress' ? `${Math.round((a.score / a.total_marks) * 100)}%` : 'In progress' })),
            ...practice.map((p) => ({ kind: 'practice' as const, at: p.created_at, label: `Practiced ${p.topic}`, score: `${p.score}/${p.total}` }))]
            .sort((x, y) => +new Date(y.at) - +new Date(x.at))
            .slice(0, 6)
            .map((r, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-slate-50">
                <span className="text-sm text-slate-700 flex items-center gap-2">
                  {r.kind === 'exam' ? <ClipboardList size={15} className="text-blue-500" /> : <Target size={15} className="text-amber-500" />}
                  {r.label}
                </span>
                <span className="text-sm font-semibold text-slate-600">{r.score}</span>
              </div>
            ))}
        </div>
      </Card>
    </>
  );
}

// ---------- Available Exams ----------
export function StudentExams() {
  const { isDemo } = useDemo();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [subject, setSubject] = useState('all');

  useEffect(() => {
    if (isDemo) { setExams(demoExams); setLoading(false); return; }
    (async () => {
      const { data } = await supabase.from('exams').select('*').eq('status', 'published').order('created_at', { ascending: false });
      setExams((data as Exam[]) || []);
      setLoading(false);
    })();
  }, [isDemo]);

  const subjects = useMemo(() => ['all', ...Array.from(new Set(exams.map((e) => e.subject)))], [exams]);
  const filtered = exams.filter((e) =>
    (subject === 'all' || e.subject === subject) &&
    (e.title.toLowerCase().includes(q.toLowerCase()) || e.subject.toLowerCase().includes(q.toLowerCase()))
  );

  if (loading) return <Loading />;
  return (
    <>
      <PageHeader title="Available Exams" subtitle="Browse exams you're eligible to take." />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2">
          <Search size={16} className="text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search exams…" className="w-full bg-transparent outline-none text-sm" />
        </div>
        <select value={subject} onChange={(e) => setSubject(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm">
          {subjects.map((s) => <option key={s} value={s}>{s === 'all' ? 'All subjects' : s}</option>)}
        </select>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {filtered.length === 0 && <EmptyState title="No exams match" icon={<BookOpen size={28} />} />}
        {filtered.map((e) => <ExamCard key={e.id} exam={e} isDemo={isDemo} />)}
      </div>
    </>
  );
}

export function ExamCard({ exam, isDemo }: { exam: Exam; isDemo: boolean }) {
  const now = new Date();
  const open = new Date(exam.start_time) <= now && new Date(exam.end_time) >= now;
  const upcoming = new Date(exam.start_time) > now;
  const qCount = isDemo ? (demoExamQuestions[exam.id]?.length ?? 0) : null;
  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold">{exam.title}</h3>
          <p className="text-sm text-slate-500">{exam.subject}</p>
        </div>
        {open ? <Badge color="green">Open</Badge> : upcoming ? <Badge color="amber">Upcoming</Badge> : <Badge color="slate">Closed</Badge>}
      </div>
      {exam.description && <p className="mt-3 text-sm text-slate-600">{exam.description}</p>}
      <div className="mt-4 grid grid-cols-2 gap-2 text-sm text-slate-600">
        <span className="flex items-center gap-1.5"><ClipboardList size={15} /> {qCount ?? '—'} questions</span>
        <span className="flex items-center gap-1.5"><Clock size={15} /> {exam.duration_min} min</span>
        <span className="flex items-center gap-1.5"><Target size={15} /> {exam.total_marks} marks</span>
        <span className="flex items-center gap-1.5"><AlertCircle size={15} /> Negative: {exam.negative_marking}</span>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs text-slate-500">Starts {new Date(exam.start_time).toLocaleString()}</span>
        {open ? (
          <Link to={`/student/take/${exam.id}`}><Button size="sm">Start exam</Button></Link>
        ) : upcoming ? (
          <Button size="sm" variant="outline" disabled>Not open yet</Button>
        ) : (
          <Button size="sm" variant="ghost" disabled>Closed</Button>
        )}
      </div>
    </Card>
  );
}

// ---------- My Exams (in-progress + completed) ----------
export function StudentMyExams() {
  const { isDemo } = useDemo();
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [exams, setExams] = useState<Record<string, Exam>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isDemo) {
      setAttempts(demoAttempts);
      setExams(Object.fromEntries(demoExams.map((e) => [e.id, e])));
      setLoading(false);
      return;
    }
    (async () => {
      const { data } = await supabase.from('attempts').select('*').order('started_at', { ascending: false });
      const list = (data as Attempt[]) || [];
      setAttempts(list);
      const ids = Array.from(new Set(list.map((a) => a.exam_id)));
      if (ids.length) {
        const { data: ex } = await supabase.from('exams').select('*').in('id', ids);
        setExams(Object.fromEntries(((ex as Exam[]) || []).map((e) => [e.id, e])));
      }
      setLoading(false);
    })();
  }, [isDemo]);

  if (loading) return <Loading />;
  const inProgress = attempts.filter((a) => a.status === 'in_progress');
  const done = attempts.filter((a) => a.status !== 'in_progress');

  return (
    <>
      <PageHeader title="My Exams" subtitle="Resume in-progress attempts or review completed ones." />
      <h2 className="mb-3 font-semibold text-slate-700">In progress</h2>
      {inProgress.length === 0 ? <EmptyState title="Nothing in progress" subtitle="Start an exam from Available Exams." icon={<ClipboardList size={28} />} /> : (
        <div className="space-y-3">
          {inProgress.map((a) => (
            <Card key={a.id} className="flex items-center justify-between p-4">
              <div>
                <p className="font-semibold">{exams[a.exam_id]?.title || 'Exam'}</p>
                <p className="text-sm text-slate-500">Started {new Date(a.started_at).toLocaleString()}</p>
              </div>
              <Link to={`/student/take/${a.exam_id}`}><Button size="sm">Resume</Button></Link>
            </Card>
          ))}
        </div>
      )}
      <h2 className="mb-3 mt-6 font-semibold text-slate-700">Completed</h2>
      {done.length === 0 ? <EmptyState title="No completed exams yet" icon={<CheckCircle2 size={28} />} /> : (
        <div className="space-y-3">
          {done.map((a) => (
            <Card key={a.id} className="flex items-center justify-between p-4">
              <div>
                <p className="font-semibold">{exams[a.exam_id]?.title || 'Exam'}</p>
                <p className="text-sm text-slate-500">{a.score}/{a.total_marks} · {Math.round((a.score / a.total_marks) * 100)}% · {a.status === 'auto_submitted' ? 'Auto-submitted' : 'Submitted'}</p>
              </div>
              <Link to={`/student/results/${a.id}`}><Button size="sm" variant="outline">View results</Button></Link>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

// ---------- Leaderboard ----------
export function StudentLeaderboard() {
  const { isDemo } = useDemo();
  const { profile } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isDemo) { setExams(demoExams); setSelected(demoExams[0].id); setLoading(false); return; }
    (async () => {
      const { data } = await supabase.from('exams').select('*').order('created_at', { ascending: false });
      const list = (data as Exam[]) || [];
      setExams(list);
      if (list[0]) setSelected(list[0].id);
      setLoading(false);
    })();
  }, [isDemo]);

  useEffect(() => {
    if (!selected) return;
    if (isDemo) { setRows(demoLeaderboard); return; }
    (async () => {
      setRows([]);
      const { data, error } = await supabase.rpc('leaderboard_for_exam', { p_exam_id: selected });
      if (!error) setRows((data as LeaderboardRow[]) || []);
    })();
  }, [selected, isDemo]);

  if (loading) return <Loading />;
  return (
    <>
      <PageHeader title="Leaderboard" subtitle="Official exam rankings — practice scores are excluded." />
      <div className="mb-4 flex items-center gap-2">
        <select value={selected} onChange={(e) => setSelected(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm">
          {exams.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
        </select>
      </div>
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr><th className="px-4 py-3">Rank</th><th className="px-4 py-3">Student</th><th className="px-4 py-3">Score</th><th className="px-4 py-3">%</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={4} className="px-4 py-10 text-center text-slate-500">No submissions yet for this exam.</td></tr>}
            {rows.map((r) => {
              const me = r.user_id === profile?.id || (isDemo && r.user_id === 'demo-student');
              return (
                <tr key={r.user_id} className={`border-t border-slate-100 ${me ? 'bg-blue-50' : ''}`}>
                  <td className="px-4 py-3 font-semibold">#{r.rank}</td>
                  <td className="px-4 py-3">{r.full_name}{me && <Badge color="blue">You</Badge>}</td>
                  <td className="px-4 py-3">{r.score}/{r.total_marks}</td>
                  <td className="px-4 py-3 font-semibold">{r.percentage}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </>
  );
}

// ---------- Bookmarks ----------
export function StudentBookmarks() {
  const { isDemo } = useDemo();
  const [items, setItems] = useState<{ id: string; question_text: string; topic: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isDemo) { setItems([]); setLoading(false); return; }
    (async () => {
      // bookmarks join questions — but students can't select questions directly.
      // Use the get_attempt_review pattern is per-attempt; instead store a
      // lightweight copy in bookmarks via a denormalised approach is not available.
      // For now show empty state with explanation.
      const { data } = await supabase.from('bookmarks').select('id, question_id').order('created_at', { ascending: false });
      setItems((data || []).map(() => ({ id: '', question_text: 'Bookmarked question (visible in practice)', topic: '' })));
      setLoading(false);
    })();
  }, [isDemo]);

  if (loading) return <Loading />;
  if (items.length === 0) return <><PageHeader title="Bookmarked Questions" /><EmptyState title="No bookmarks yet" subtitle="Save questions during practice to revisit them here." icon={<Bookmark size={28} />} /></>;
  return <><PageHeader title="Bookmarked Questions" /><div className="space-y-2">{items.map((i) => <Card key={i.id} className="p-4"><p className="text-sm">{i.question_text}</p></Card>)}</div></>;
}

// ---------- Exam History ----------
export function StudentHistory() {
  const { isDemo } = useDemo();
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [exams, setExams] = useState<Record<string, Exam>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isDemo) { setAttempts(demoAttempts); setExams(Object.fromEntries(demoExams.map((e) => [e.id, e]))); setLoading(false); return; }
    (async () => {
      const { data } = await supabase.from('attempts').select('*').order('started_at', { ascending: false });
      const list = (data as Attempt[]) || [];
      setAttempts(list);
      const ids = Array.from(new Set(list.map((a) => a.exam_id)));
      if (ids.length) {
        const { data: ex } = await supabase.from('exams').select('*').in('id', ids);
        setExams(Object.fromEntries(((ex as Exam[]) || []).map((e) => [e.id, e])));
      }
      setLoading(false);
    })();
  }, [isDemo]);

  if (loading) return <Loading />;
  return (
    <>
      <PageHeader title="Exam History" subtitle="All your exam attempts over time." />
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600"><tr><th className="px-4 py-3">Exam</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Score</th><th className="px-4 py-3">Status</th></tr></thead>
          <tbody>
            {attempts.length === 0 && <tr><td colSpan={4} className="px-4 py-10 text-center text-slate-500">No history yet.</td></tr>}
            {attempts.map((a) => (
              <tr key={a.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium">{exams[a.exam_id]?.title || 'Exam'}</td>
                <td className="px-4 py-3">{new Date(a.started_at).toLocaleDateString()}</td>
                <td className="px-4 py-3">{a.status === 'in_progress' ? '—' : `${a.score}/${a.total_marks}`}</td>
                <td className="px-4 py-3"><Badge color={a.status === 'in_progress' ? 'amber' : 'green'}>{a.status.replace('_', ' ')}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}

// ---------- Achievements ----------
export function StudentAchievements() {
  const { isDemo } = useDemo();
  const [codes, setCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isDemo) { setCodes(['first_practice', 'streak_3', 'first_exam']); setLoading(false); return; }
    (async () => {
      const { data } = await supabase.from('achievements').select('code');
      setCodes((data || []).map((x: { code: string }) => x.code));
      setLoading(false);
    })();
  }, [isDemo]);

  if (loading) return <Loading />;
  const all = [
    { code: 'first_practice', label: 'First Practice', desc: 'Completed your first practice session', icon: <Target size={22} /> },
    { code: 'first_exam', label: 'First Exam', desc: 'Submitted your first exam', icon: <ClipboardList size={22} /> },
    { code: 'streak_3', label: '3-Day Streak', desc: 'Practiced 3 days in a row', icon: <Flame size={22} /> },
    { code: 'streak_7', label: '7-Day Streak', desc: 'Practiced 7 days in a row', icon: <Flame size={22} /> },
    { code: 'high_scorer', label: 'High Scorer', desc: 'Scored 90%+ on an exam', icon: <Trophy size={22} /> },
    { code: 'dsa_explorer', label: 'DSA Explorer', desc: 'Tried the DSA Lab', icon: <Code2 size={22} /> },
  ];
  return (
    <>
      <PageHeader title="Achievements" subtitle="Badges earned from real activity." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {all.map((a) => {
          const earned = codes.includes(a.code);
          return (
            <Card key={a.code} className={`p-5 ${earned ? '' : 'opacity-60'}`}>
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${earned ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-white' : 'bg-slate-100 text-slate-400'}`}>{a.icon}</div>
              <h3 className="mt-3 font-semibold">{a.label}</h3>
              <p className="text-sm text-slate-500">{a.desc}</p>
              {earned && <div className="mt-2"><Badge color="amber">Earned</Badge></div>}
            </Card>
          );
        })}
      </div>
    </>
  );
}

// ---------- Profile ----------
export function StudentProfile() {
  const { profile, isDemo } = useAuth();
  return (
    <>
      <PageHeader title="Profile & Settings" />
      <Card className="max-w-lg p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-2xl font-bold text-blue-700">{profile?.full_name?.[0] || 'S'}</div>
          <div>
            <p className="text-lg font-bold">{profile?.full_name}</p>
            <p className="text-sm text-slate-500">{profile?.email}</p>
            <Badge color="blue">Student</Badge>
            {isDemo && <span className="ml-2"><Badge color="amber">Demo</Badge></span>}
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
          <div><p className="text-slate-500">Department</p><p className="font-medium">{profile?.department || '—'}</p></div>
          <div><p className="text-slate-500">Institution</p><p className="font-medium">{profile?.institution || '—'}</p></div>
          <div><p className="text-slate-500">Student ID</p><p className="font-medium">{profile?.student_id || '—'}</p></div>
        </div>
      </Card>
    </>
  );
}

// ---------- Results & Analytics ----------
export function StudentResults() {
  const { isDemo } = useDemo();
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [exams, setExams] = useState<Record<string, Exam>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isDemo) { setAttempts(demoAttempts); setExams(Object.fromEntries(demoExams.map((e) => [e.id, e]))); setLoading(false); return; }
    (async () => {
      const { data } = await supabase.from('attempts').select('*').order('started_at', { ascending: false });
      const list = ((data as Attempt[]) || []).filter((a) => a.status !== 'in_progress');
      setAttempts(list);
      const ids = Array.from(new Set(list.map((a) => a.exam_id)));
      if (ids.length) {
        const { data: ex } = await supabase.from('exams').select('*').in('id', ids);
        setExams(Object.fromEntries(((ex as Exam[]) || []).map((e) => [e.id, e])));
      }
      setLoading(false);
    })();
  }, [isDemo]);

  if (loading) return <Loading />;
  const pcts = attempts.map((a) => (a.total_marks ? (a.score / a.total_marks) * 100 : 0));
  const avg = pcts.length ? pcts.reduce((s, x) => s + x, 0) / pcts.length : 0;
  return (
    <>
      <PageHeader title="Results & Analytics" subtitle="Your performance across all exams." />
      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <StatCard label="Exams taken" value={attempts.length} icon={<ClipboardList size={20} />} />
        <StatCard label="Average" value={`${Math.round(avg)}%`} icon={<TrendingUp size={20} />} accent="green" />
        <StatCard label="Best" value={pcts.length ? `${Math.round(Math.max(...pcts))}%` : '—'} icon={<Target size={20} />} accent="amber" />
      </div>
      {attempts.length === 0 ? <EmptyState title="No results yet" icon={<BarChart3 size={28} />} /> : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600"><tr><th className="px-4 py-3">Exam</th><th className="px-4 py-3">Score</th><th className="px-4 py-3">%</th><th className="px-4 py-3"></th></tr></thead>
            <tbody>
              {attempts.map((a) => (
                <tr key={a.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium">{exams[a.exam_id]?.title || 'Exam'}</td>
                  <td className="px-4 py-3">{a.score}/{a.total_marks}</td>
                  <td className="px-4 py-3 font-semibold">{Math.round((a.score / a.total_marks) * 100)}%</td>
                  <td className="px-4 py-3"><Link to={`/student/results/${a.id}`}><Button size="sm" variant="outline">Review</Button></Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}

// ---------- Smart Learning Insights ----------
export function StudentInsights() {
  const { isDemo } = useDemo();
  const [practice, setPractice] = useState<PracticeAttempt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isDemo) { setPractice(demoPractice); setLoading(false); return; }
    (async () => {
      const { data } = await supabase.from('practice_attempts').select('*').order('created_at', { ascending: false }).limit(50);
      setPractice((data as PracticeAttempt[]) || []);
      setLoading(false);
    })();
  }, [isDemo]);

  // rule-based topic accuracy
  const byTopic = useMemo(() => {
    const m: Record<string, { correct: number; total: number }> = {};
    practice.forEach((p) => {
      m[p.topic] = m[p.topic] || { correct: 0, total: 0 };
      m[p.topic].correct += p.score;
      m[p.topic].total += p.total;
    });
    return Object.entries(m).map(([topic, v]) => ({ topic, acc: v.total ? Math.round((v.correct / v.total) * 100) : 0 }));
  }, [practice]);

  if (loading) return <Loading />;

  const weak = byTopic.filter((t) => t.acc < 70).sort((a, b) => a.acc - b.acc);
  const strong = byTopic.filter((t) => t.acc >= 70).sort((a, b) => b.acc - a.acc);

  return (
    <>
      <PageHeader title="Smart Learning Insights" subtitle="Explainable, rule-based recommendations from your real practice history." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-semibold flex items-center gap-2"><Brain size={18} className="text-purple-600" /> Topic accuracy</h2>
          <div className="mt-4 space-y-3">
            {byTopic.length === 0 && <EmptyState title="No practice data yet" subtitle="Try the Practice Zone to unlock insights." />}
            {byTopic.map((t) => (
              <div key={t.topic}>
                <div className="flex justify-between text-sm"><span className="font-medium">{t.topic}</span><span className="text-slate-600">{t.acc}%</span></div>
                <div className="mt-1 h-2 rounded-full bg-slate-100"><div className={`h-2 rounded-full ${t.acc >= 70 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${t.acc}%` }} /></div>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="font-semibold flex items-center gap-2"><Target size={18} className="text-amber-600" /> Recommended next steps</h2>
          <div className="mt-4 space-y-3">
            {weak.length === 0 && strong.length === 0 && <p className="text-sm text-slate-500">Complete some practice to get recommendations.</p>}
            {weak.length > 0 && (
              <div className="rounded-xl bg-amber-50 p-3">
                <p className="text-sm font-semibold text-amber-800">Focus areas</p>
                <p className="mt-1 text-sm text-amber-700">Spend extra time on: {weak.map((w) => w.topic).join(', ')}.</p>
                <Link to="/student/practice" className="mt-2 inline-block"><Button size="sm">Practice now</Button></Link>
              </div>
            )}
            {strong.length > 0 && (
              <div className="rounded-xl bg-emerald-50 p-3">
                <p className="text-sm font-semibold text-emerald-800">Your strengths</p>
                <p className="mt-1 text-sm text-emerald-700">You're doing well in: {strong.map((w) => w.topic).join(', ')}.</p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}

function Loading() { return <div className="flex items-center gap-2 text-slate-500"><Spinner /> Loading…</div>; }
