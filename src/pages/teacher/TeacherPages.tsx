import { useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard, ClipboardList, Library, Users, BarChart3,
  Megaphone, User as UserIcon, Plus, Edit3, Trash2, Search, Save, X, Download,
  TrendingUp, Award, CheckCircle2,
} from 'lucide-react';
import { supabase, type Exam, type Question, type Attempt, type Announcement, type LeaderboardRow } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useDemo } from '@/hooks/useDemo';
import { useToast } from '@/context/ToastContext';
import { Card, Button, Badge, StatCard, PageHeader, EmptyState, Spinner } from '@/components/ui';
import { demoExams, demoQuestions, demoAttempts, demoAnnouncements } from '@/demo/data';

export const teacherNav = [
  { to: '/teacher', label: 'Overview', icon: <LayoutDashboard size={18} /> },
  { to: '/teacher/create', label: 'Create Examination', icon: <Plus size={18} /> },
  { to: '/teacher/questions', label: 'Question Bank', icon: <Library size={18} /> },
  { to: '/teacher/manage', label: 'Manage Examinations', icon: <ClipboardList size={18} /> },
  { to: '/teacher/students', label: 'Students & Attempts', icon: <Users size={18} /> },
  { to: '/teacher/analytics', label: 'Performance Analytics', icon: <BarChart3 size={18} /> },
  { to: '/teacher/leaderboard', label: 'Leaderboard', icon: <Award size={18} /> },
  { to: '/teacher/announcements', label: 'Announcements', icon: <Megaphone size={18} /> },
  { to: '/teacher/profile', label: 'Profile & Settings', icon: <UserIcon size={18} /> },
];

// ---------- Overview ----------
export function TeacherOverview() {
  const { profile } = useAuth();
  const { isDemo } = useDemo();
  const [exams, setExams] = useState<Exam[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [students, setStudents] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isDemo) {
      setExams(demoExams); setAttempts(demoAttempts); setStudents(24); setLoading(false); return;
    }
    (async () => {
      const [{ data: ex }, { data: at }] = await Promise.all([
        supabase.from('exams').select('*').order('created_at', { ascending: false }),
        supabase.from('attempts').select('*'),
      ]);
      setExams((ex as Exam[]) || []);
      const myExamIds = new Set(((ex as Exam[]) || []).map((e) => e.id));
      setAttempts(((at as Attempt[]) || []).filter((a) => myExamIds.has(a.exam_id)));
      const { count } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student');
      setStudents(count || 0);
      setLoading(false);
    })();
  }, [isDemo]);

  const stats = useMemo(() => {
    const published = exams.filter((e) => e.status === 'published').length;
    const active = exams.filter((e) => e.status === 'published' && new Date(e.start_time) <= new Date() && new Date(e.end_time) >= new Date()).length;
    const done = attempts.filter((a) => a.status !== 'in_progress');
    const avg = done.length ? done.reduce((s, a) => s + (a.total_marks ? (a.score / a.total_marks) * 100 : 0), 0) / done.length : 0;
    return { published, active, avg: Math.round(avg), attempts: attempts.length };
  }, [exams, attempts]);

  if (loading) return <div className="flex items-center gap-2 text-slate-500"><Spinner /> Loading…</div>;

  return (
    <>
      <PageHeader title={`Hello, ${profile?.full_name?.split(' ')[0] || 'Teacher'}`} subtitle="Your teaching dashboard at a glance." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Registered students" value={students} icon={<Users size={20} />} />
        <StatCard label="Exams created" value={exams.length} icon={<ClipboardList size={20} />} accent="green" />
        <StatCard label="Active exams" value={stats.active} icon={<CheckCircle2 size={20} />} accent="amber" />
        <StatCard label="Avg class score" value={`${stats.avg}%`} icon={<TrendingUp size={20} />} accent="purple" />
      </div>
      <Card className="mt-6 p-5">
        <h2 className="font-semibold">Recent submissions</h2>
        <div className="mt-3 space-y-2">
          {attempts.filter((a) => a.status !== 'in_progress').slice(0, 6).map((a) => {
            const ex = exams.find((e) => e.id === a.exam_id);
            return (
              <div key={a.id} className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-slate-50">
                <span className="text-sm">{ex?.title || 'Exam'}</span>
                <span className="text-sm font-semibold">{a.score}/{a.total_marks} · {Math.round((a.score / a.total_marks) * 100)}%</span>
              </div>
            );
          })}
          {attempts.length === 0 && <EmptyState title="No submissions yet" icon={<Users size={28} />} />}
        </div>
      </Card>
    </>
  );
}

// ---------- Create Exam ----------
export function CreateExam() {
  const { isDemo } = useDemo();
  const { push } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '', subject: '', description: '', instructions: '',
    duration_min: 60, total_marks: 100,
    start_time: new Date(Date.now() + 3600000).toISOString().slice(0, 16),
    end_time: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
    max_attempts: 1, negative_marking: 0,
    shuffle_questions: false, shuffle_choices: false,
    results_visible: true, explanations_visible: true, status: 'draft' as Exam['status'],
  });
  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) { setForm((f) => ({ ...f, [k]: v })); }

  async function save(publish: boolean) {
    if (!form.title || !form.subject) { push('Title and subject are required.', 'error'); return; }
    if (isDemo) { push('Demo mode: exams cannot be saved. Create an account to publish.', 'error'); return; }
    setSaving(true);
    const payload = { ...form, status: publish ? 'published' : form.status, start_time: new Date(form.start_time).toISOString(), end_time: new Date(form.end_time).toISOString() };
    const { data, error } = await supabase.from('exams').insert(payload).select().single();
    setSaving(false);
    if (error) { push(error.message, 'error'); return; }
    push(publish ? 'Exam published!' : 'Draft saved.', 'success');
    // navigate to question bank for this exam via state? simpler: link
    window.location.hash = `/teacher/questions?exam=${(data as Exam).id}`;
  }

  return (
    <>
      <PageHeader title="Create Examination" subtitle="Configure your exam, then add questions from the Question Bank." />
      <Card className="p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <Input label="Title *" value={form.title} onChange={(v) => set('title', v)} />
          <Input label="Subject *" value={form.subject} onChange={(v) => set('subject', v)} />
          <div className="md:col-span-2"><Textarea label="Description" value={form.description} onChange={(v) => set('description', v)} /></div>
          <div className="md:col-span-2"><Textarea label="Instructions" value={form.instructions} onChange={(v) => set('instructions', v)} /></div>
          <Input label="Duration (min)" type="number" value={String(form.duration_min)} onChange={(v) => set('duration_min', Number(v))} />
          <Input label="Total marks" type="number" value={String(form.total_marks)} onChange={(v) => set('total_marks', Number(v))} />
          <Input label="Start time" type="datetime-local" value={form.start_time} onChange={(v) => set('start_time', v)} />
          <Input label="End time" type="datetime-local" value={form.end_time} onChange={(v) => set('end_time', v)} />
          <Input label="Max attempts" type="number" value={String(form.max_attempts)} onChange={(v) => set('max_attempts', Number(v))} />
          <Input label="Negative marking (0–1)" type="number" value={String(form.negative_marking)} onChange={(v) => set('negative_marking', Number(v))} />
          <Toggle label="Shuffle questions" checked={form.shuffle_questions} onChange={(v) => set('shuffle_questions', v)} />
          <Toggle label="Shuffle choices" checked={form.shuffle_choices} onChange={(v) => set('shuffle_choices', v)} />
          <Toggle label="Results visible to students" checked={form.results_visible} onChange={(v) => set('results_visible', v)} />
          <Toggle label="Explanations visible" checked={form.explanations_visible} onChange={(v) => set('explanations_visible', v)} />
        </div>
        <div className="mt-6 flex gap-2">
          <Button onClick={() => save(false)} disabled={saving}>{saving ? <Spinner /> : <Save size={15} />} Save draft</Button>
          <Button onClick={() => save(true)} disabled={saving}>Publish</Button>
        </div>
      </Card>
    </>
  );
}

// ---------- Question Bank ----------
export function QuestionBank() {
  const { isDemo } = useDemo();
  const { push } = useToast();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Partial<Question> | null>(null);

  async function load() {
    if (isDemo) { setQuestions(demoQuestions); setLoading(false); return; }
    const { data } = await supabase.from('questions').select('*').order('created_at', { ascending: false });
    setQuestions((data as Question[]) || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [isDemo]);

  async function saveQ() {
    if (!editing) return;
    if (!editing.question_text || !editing.choices || editing.correct_index == null) { push('Fill question, choices and correct answer.', 'error'); return; }
    if (isDemo) { push('Demo mode: read-only.', 'error'); return; }
    const payload = {
      subject: editing.subject || 'General', topic: editing.topic || 'General',
      difficulty: editing.difficulty || 'medium', marks: editing.marks || 1,
      type: editing.type || 'mcq', question_text: editing.question_text,
      choices: editing.choices, correct_index: editing.correct_index, explanation: editing.explanation || null,
    };
    if (editing.id) {
      const { error } = await supabase.from('questions').update(payload).eq('id', editing.id);
      if (error) { push(error.message, 'error'); return; }
      push('Question updated.', 'success');
    } else {
      const { error } = await supabase.from('questions').insert(payload);
      if (error) { push(error.message, 'error'); return; }
      push('Question added.', 'success');
    }
    setEditing(null);
    load();
  }

  async function del(id: string) {
    if (isDemo) { push('Demo mode: read-only.', 'error'); return; }
    if (!confirm('Delete this question?')) return;
    const { error } = await supabase.from('questions').delete().eq('id', id);
    if (error) { push(error.message, 'error'); return; }
    push('Deleted.', 'success'); load();
  }

  const filtered = questions.filter((x) => x.question_text.toLowerCase().includes(q.toLowerCase()) || x.subject.toLowerCase().includes(q.toLowerCase()));

  if (loading) return <div className="flex items-center gap-2 text-slate-500"><Spinner /> Loading…</div>;

  return (
    <>
      <PageHeader title="Question Bank" subtitle="Create, edit and reuse questions across exams." action={<Button onClick={() => setEditing({ subject: 'DSA', topic: 'General', difficulty: 'medium', marks: 1, type: 'mcq', choices: ['', '', '', ''], correct_index: 0 })}><Plus size={15} /> New question</Button>} />
      <div className="mb-4 flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 max-w-md">
        <Search size={16} className="text-slate-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search questions…" className="w-full bg-transparent outline-none text-sm" />
      </div>
      <div className="space-y-2">
        {filtered.length === 0 && <EmptyState title="No questions" subtitle="Create your first question." icon={<Library size={28} />} />}
        {filtered.map((qq) => (
          <Card key={qq.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex gap-2"><Badge color="blue">{qq.subject}</Badge><Badge color="slate">{qq.topic}</Badge><Badge color={qq.difficulty === 'easy' ? 'green' : qq.difficulty === 'medium' ? 'amber' : 'red'}>{qq.difficulty}</Badge><Badge color="purple">{qq.marks}m</Badge></div>
                <p className="mt-2 font-medium">{qq.question_text}</p>
                <ol className="mt-2 list-[upper-alpha] pl-5 text-sm text-slate-600">
                  {qq.choices.map((c, i) => <li key={i} className={i === qq.correct_index ? 'font-semibold text-emerald-700' : ''}>{c}{i === qq.correct_index && ' ✓'}</li>)}
                </ol>
                {qq.explanation && <p className="mt-2 text-xs text-slate-500">Explanation: {qq.explanation}</p>}
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => setEditing(qq)}><Edit3 size={15} /></Button>
                {!isDemo && <Button size="sm" variant="ghost" onClick={() => del(qq.id)}><Trash2 size={15} /></Button>}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {editing && (
        <Modal title={editing.id ? 'Edit question' : 'New question'} onClose={() => setEditing(null)}>
          <div className="space-y-3">
            <Textarea label="Question text" value={editing.question_text || ''} onChange={(v) => setEditing({ ...editing, question_text: v })} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Subject" value={editing.subject || ''} onChange={(v) => setEditing({ ...editing, subject: v })} />
              <Input label="Topic" value={editing.topic || ''} onChange={(v) => setEditing({ ...editing, topic: v })} />
              <select value={editing.difficulty} onChange={(e) => setEditing({ ...editing, difficulty: e.target.value as 'easy' | 'medium' | 'hard' })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
              </select>
              <select value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value as 'mcq' | 'tf', choices: e.target.value === 'tf' ? ['True', 'False'] : editing.choices })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="mcq">Multiple choice</option><option value="tf">True / False</option>
              </select>
              <Input label="Marks" type="number" value={String(editing.marks || 1)} onChange={(v) => setEditing({ ...editing, marks: Number(v) })} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Choices (select the correct one)</label>
              <div className="space-y-2">
                {(editing.choices || []).map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input type="radio" checked={editing.correct_index === i} onChange={() => setEditing({ ...editing, correct_index: i })} />
                    <input value={c} onChange={(e) => setEditing({ ...editing, choices: (editing.choices || []).map((x, j) => j === i ? e.target.value : x) })} className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                    {(editing.choices || []).length > 2 && <button onClick={() => setEditing({ ...editing, choices: (editing.choices || []).filter((_, j) => j !== i) })}><X size={15} /></button>}
                  </div>
                ))}
                <Button size="sm" variant="outline" onClick={() => setEditing({ ...editing, choices: [...(editing.choices || []), ''] })}><Plus size={14} /> Add choice</Button>
              </div>
            </div>
            <Textarea label="Explanation" value={editing.explanation || ''} onChange={(v) => setEditing({ ...editing, explanation: v })} />
            <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button><Button onClick={saveQ}><Save size={15} /> Save</Button></div>
          </div>
        </Modal>
      )}
    </>
  );
}

// ---------- Manage Exams ----------
export function ManageExams() {
  const { isDemo } = useDemo();
  const { push } = useToast();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (isDemo) { setExams(demoExams); setLoading(false); return; }
    const { data } = await supabase.from('exams').select('*').order('created_at', { ascending: false });
    setExams((data as Exam[]) || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [isDemo]);

  async function setStatus(e: Exam, status: Exam['status']) {
    if (isDemo) { push('Demo mode: read-only.', 'error'); return; }
    const { error } = await supabase.from('exams').update({ status }).eq('id', e.id);
    if (error) { push(error.message, 'error'); return; }
    push(`Exam ${status}.`, 'success'); load();
  }
  async function del(e: Exam) {
    if (isDemo) { push('Demo mode: read-only.', 'error'); return; }
    if (!confirm('Delete this exam and all its attempts?')) return;
    const { error } = await supabase.from('exams').delete().eq('id', e.id);
    if (error) { push(error.message, 'error'); return; }
    push('Deleted.', 'success'); load();
  }

  if (loading) return <div className="flex items-center gap-2 text-slate-500"><Spinner /> Loading…</div>;
  return (
    <>
      <PageHeader title="Manage Examinations" subtitle="Control the lifecycle of your exams." />
      <div className="space-y-2">
        {exams.length === 0 && <EmptyState title="No exams yet" subtitle="Create one first." icon={<ClipboardList size={28} />} />}
        {exams.map((e) => (
          <Card key={e.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="font-semibold">{e.title}</p>
              <p className="text-sm text-slate-500">{e.subject} · {e.total_marks} marks · {e.duration_min} min</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge color={e.status === 'published' ? 'green' : e.status === 'draft' ? 'slate' : e.status === 'scheduled' ? 'amber' : 'red'}>{e.status}</Badge>
              {!isDemo && <>
                {e.status !== 'published' && <Button size="sm" variant="outline" onClick={() => setStatus(e, 'published')}>Publish</Button>}
                {e.status === 'published' && <Button size="sm" variant="outline" onClick={() => setStatus(e, 'closed')}>Close</Button>}
                <Button size="sm" variant="ghost" onClick={() => del(e)}><Trash2 size={15} /></Button>
              </>}
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}

// ---------- Students & Attempts ----------
export function TeacherStudents() {
  const { isDemo } = useDemo();
  const [exams, setExams] = useState<Exam[]>([]);
  const [attempts, setAttempts] = useState<(Attempt & { exam_title?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [examFilter, setExamFilter] = useState('all');

  useEffect(() => {
    if (isDemo) {
      setExams(demoExams);
      setAttempts(demoAttempts.map((a) => ({ ...a, exam_title: demoExams.find((e) => e.id === a.exam_id)?.title })));
      setLoading(false); return;
    }
    (async () => {
      const { data: ex } = await supabase.from('exams').select('*');
      const exList = (ex as Exam[]) || [];
      setExams(exList);
      const { data: at } = await supabase.from('attempts').select('*');
      const atList = ((at as Attempt[]) || []).map((a) => ({ ...a, exam_title: exList.find((e) => e.id === a.exam_id)?.title }));
      setAttempts(atList);
      setLoading(false);
    })();
  }, [isDemo]);

  const filtered = examFilter === 'all' ? attempts : attempts.filter((a) => a.exam_id === examFilter);
  if (loading) return <div className="flex items-center gap-2 text-slate-500"><Spinner /> Loading…</div>;

  return (
    <>
      <PageHeader title="Students & Attempts" subtitle="Participation across your exams, calculated from real attempts." />
      <div className="mb-4">
        <select value={examFilter} onChange={(e) => setExamFilter(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm">
          <option value="all">All exams</option>
          {exams.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
        </select>
      </div>
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600"><tr><th className="px-4 py-3">Exam</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Started</th><th className="px-4 py-3">Score</th><th className="px-4 py-3">%</th></tr></thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-500">No attempts.</td></tr>}
            {filtered.map((a) => (
              <tr key={a.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium">{a.exam_title || 'Exam'}</td>
                <td className="px-4 py-3"><Badge color={a.status === 'in_progress' ? 'amber' : 'green'}>{a.status.replace('_', ' ')}</Badge></td>
                <td className="px-4 py-3">{new Date(a.started_at).toLocaleString()}</td>
                <td className="px-4 py-3">{a.status === 'in_progress' ? '—' : `${a.score}/${a.total_marks}`}</td>
                <td className="px-4 py-3 font-semibold">{a.status === 'in_progress' ? '—' : `${Math.round((a.score / a.total_marks) * 100)}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}

// ---------- Analytics ----------
export function TeacherAnalytics() {
  const { isDemo } = useDemo();
  const [exams, setExams] = useState<Exam[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isDemo) { setExams(demoExams); setAttempts(demoAttempts); setQuestions(demoQuestions); setLoading(false); return; }
    (async () => {
      const [{ data: ex }, { data: at }, { data: q }] = await Promise.all([
        supabase.from('exams').select('*'),
        supabase.from('attempts').select('*'),
        supabase.from('questions').select('*'),
      ]);
      setExams((ex as Exam[]) || []);
      setAttempts((at as Attempt[]) || []);
      setQuestions((q as Question[]) || []);
      setLoading(false);
    })();
  }, [isDemo]);

  if (loading) return <div className="flex items-center gap-2 text-slate-500"><Spinner /> Loading…</div>;
  const done = attempts.filter((a) => a.status !== 'in_progress');
  const avg = done.length ? Math.round(done.reduce((s, a) => s + (a.total_marks ? (a.score / a.total_marks) * 100 : 0), 0) / done.length) : 0;
  // distribution buckets
  const buckets = [0, 0, 0, 0, 0];
  done.forEach((a) => { const p = a.total_marks ? (a.score / a.total_marks) * 100 : 0; buckets[Math.min(4, Math.floor(p / 20))]++; });

  function exportCsv() {
    const rows = [['exam', 'score', 'total', 'percent', 'status']];
    done.forEach((a) => rows.push([exams.find((e) => e.id === a.exam_id)?.title || '', String(a.score), String(a.total_marks), String(Math.round((a.score / a.total_marks) * 100)), a.status]));
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'examease_results.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHeader title="Performance Analytics" subtitle="Class-wide insights from real exam data." action={<Button variant="outline" size="sm" onClick={exportCsv}><Download size={15} /> Export CSV</Button>} />
      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <StatCard label="Total attempts" value={attempts.length} icon={<Users size={20} />} />
        <StatCard label="Completion rate" value={done.length && attempts.length ? `${Math.round((done.length / attempts.length) * 100)}%` : '—'} icon={<CheckCircle2 size={20} />} accent="green" />
        <StatCard label="Class average" value={`${avg}%`} icon={<TrendingUp size={20} />} accent="purple" />
      </div>
      <Card className="p-5">
        <h2 className="font-semibold">Score distribution</h2>
        <div className="mt-4 flex items-end gap-4" style={{ height: 160 }}>
          {['0-20', '20-40', '40-60', '60-80', '80-100'].map((label, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-2">
              <div className="w-full rounded-t-lg bg-gradient-to-t from-blue-500 to-blue-400" style={{ height: `${(buckets[i] / Math.max(1, ...buckets)) * 120}px` }} />
              <span className="text-xs text-slate-500">{label}</span>
              <span className="text-xs font-semibold">{buckets[i]}</span>
            </div>
          ))}
        </div>
      </Card>
      <Card className="mt-4 p-5">
        <h2 className="font-semibold">Question difficulty intelligence</h2>
        <p className="mt-1 text-sm text-slate-500">Observed statistics from submitted attempts (correct-rate per question).</p>
        <div className="mt-4 space-y-2">
          {questions.slice(0, 8).map((qq) => {
            // crude: in demo we approximate; real per-question accuracy needs
            // a join not exposed here. Show question + a note.
            return (
              <div key={qq.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                <span className="text-sm">{qq.question_text}</span>
                <Badge color={qq.difficulty === 'hard' ? 'red' : qq.difficulty === 'medium' ? 'amber' : 'green'}>{qq.difficulty}</Badge>
              </div>
            );
          })}
          {questions.length === 0 && <EmptyState title="No questions to analyze" icon={<BarChart3 size={28} />} />}
        </div>
      </Card>
    </>
  );
}

// ---------- Leaderboard (teacher view) ----------
export function TeacherLeaderboard() {
  const { isDemo } = useDemo();
  const [exams, setExams] = useState<Exam[]>([]);
  const [selected, setSelected] = useState('');
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isDemo) { setExams(demoExams); setSelected(demoExams[0].id); setLoading(false); return; }
    (async () => {
      const { data } = await supabase.from('exams').select('*').order('created_at', { ascending: false });
      const list = (data as Exam[]) || []; setExams(list); if (list[0]) setSelected(list[0].id); setLoading(false);
    })();
  }, [isDemo]);
  useEffect(() => {
    if (!selected) return;
    if (isDemo) { setRows([]); return; }
    (async () => { const { data } = await supabase.rpc('leaderboard_for_exam', { p_exam_id: selected }); setRows((data as LeaderboardRow[]) || []); })();
  }, [selected, isDemo]);

  if (loading) return <div className="flex items-center gap-2 text-slate-500"><Spinner /> Loading…</div>;
  return (
    <>
      <PageHeader title="Leaderboard" subtitle="Official rankings per exam." />
      <select value={selected} onChange={(e) => setSelected(e.target.value)} className="mb-4 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm">
        {exams.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
      </select>
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600"><tr><th className="px-4 py-3">Rank</th><th className="px-4 py-3">Student</th><th className="px-4 py-3">Score</th><th className="px-4 py-3">%</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={4} className="px-4 py-10 text-center text-slate-500">No submissions yet.</td></tr>}
            {rows.map((r) => <tr key={r.user_id} className="border-t border-slate-100"><td className="px-4 py-3 font-semibold">#{r.rank}</td><td className="px-4 py-3">{r.full_name}</td><td className="px-4 py-3">{r.score}/{r.total_marks}</td><td className="px-4 py-3 font-semibold">{r.percentage}%</td></tr>)}
          </tbody>
        </table>
      </Card>
    </>
  );
}

// ---------- Announcements ----------
export function TeacherAnnouncements() {
  const { isDemo } = useDemo();
  const { profile } = useAuth();
  const { push } = useToast();
  const [items, setItems] = useState<Announcement[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState({ title: '', body: '', exam_id: '' });

  async function load() {
    if (isDemo) { setItems(demoAnnouncements); setExams(demoExams); setLoading(false); return; }
    const [{ data: an }, { data: ex }] = await Promise.all([
      supabase.from('announcements').select('*').order('created_at', { ascending: false }),
      supabase.from('exams').select('*'),
    ]);
    setItems((an as Announcement[]) || []); setExams((ex as Exam[]) || []); setLoading(false);
  }
  useEffect(() => { load(); }, [isDemo]);

  async function post() {
    if (!draft.title || !draft.body) { push('Title and body required.', 'error'); return; }
    if (isDemo) { push('Demo mode: read-only.', 'error'); return; }
    const { error } = await supabase.from('announcements').insert({ owner_id: profile?.id, title: draft.title, body: draft.body, exam_id: draft.exam_id || null });
    if (error) { push(error.message, 'error'); return; }
    push('Announcement posted.', 'success'); setDraft({ title: '', body: '', exam_id: '' }); load();
  }

  if (loading) return <div className="flex items-center gap-2 text-slate-500"><Spinner /> Loading…</div>;
  return (
    <>
      <PageHeader title="Announcements" subtitle="Post updates visible on student dashboards." />
      <Card className="mb-6 p-5">
        <div className="space-y-3">
          <Input label="Title" value={draft.title} onChange={(v) => setDraft({ ...draft, title: v })} />
          <Textarea label="Body" value={draft.body} onChange={(v) => setDraft({ ...draft, body: v })} />
          <select value={draft.exam_id} onChange={(e) => setDraft({ ...draft, exam_id: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">No specific exam</option>
            {exams.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
          </select>
          <Button onClick={post}><Megaphone size={15} /> Post</Button>
        </div>
      </Card>
      <div className="space-y-2">
        {items.length === 0 && <EmptyState title="No announcements" icon={<Megaphone size={28} />} />}
        {items.map((a) => (
          <Card key={a.id} className="p-4">
            <p className="font-semibold">{a.title}</p>
            <p className="mt-1 text-sm text-slate-600">{a.body}</p>
            <p className="mt-2 text-xs text-slate-400">{new Date(a.created_at).toLocaleString()}</p>
          </Card>
        ))}
      </div>
    </>
  );
}

// ---------- Profile ----------
export function TeacherProfile() {
  const { profile, isDemo } = useAuth();
  return (
    <>
      <PageHeader title="Profile & Settings" />
      <Card className="max-w-lg p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-2xl font-bold text-emerald-700">{profile?.full_name?.[0] || 'T'}</div>
          <div><p className="text-lg font-bold">{profile?.full_name}</p><p className="text-sm text-slate-500">{profile?.email}</p><Badge color="green">Teacher</Badge>{isDemo && <span className="ml-2"><Badge color="amber">Demo</Badge></span>}</div>
        </div>
      </Card>
    </>
  );
}

// ---------- shared form bits ----------
function Input({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return <label className="block"><span className="mb-1 block text-sm font-medium text-slate-700">{label}</span><input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none" /></label>;
}
function Textarea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return <label className="block"><span className="mb-1 block text-sm font-medium text-slate-700">{label}</span><textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none" /></label>;
}
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return <label className="flex items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="rounded" /> {label}</label>;
}
function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <Card className="w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-bold">{title}</h3><button onClick={onClose}><X size={18} /></button></div>
        {children}
      </Card>
    </div>
  );
}
