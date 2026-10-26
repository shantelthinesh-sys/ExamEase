import { useEffect, useMemo, useState } from 'react';
import { Target, CheckCircle2, XCircle, Lightbulb, Clock } from 'lucide-react';
import { Card, Button, Badge, PageHeader, EmptyState, Spinner } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useDemo } from '@/hooks/useDemo';
import { useToast } from '@/context/ToastContext';
import { supabase, type Question, type PracticeAttempt } from '@/lib/supabase';
import { demoQuestions, demoPractice } from '@/demo/data';

export default function PracticeZone() {
  const { isDemo } = useDemo();
  const { profile } = useAuth();
  const { push } = useToast();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState('all');
  const [difficulty, setDifficulty] = useState('all');
  const [timed, setTimed] = useState(false);

  const [active, setActive] = useState<Question[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const [secsLeft, setSecsLeft] = useState(0);
  const [history, setHistory] = useState<PracticeAttempt[]>([]);

  useEffect(() => {
    if (isDemo) { setQuestions(demoQuestions); setHistory(demoPractice); setLoading(false); return; }
    (async () => {
      // students can't SELECT questions directly (RLS). For practice we use
      // demo-style seeded questions OR a teacher's published pool via a public
      // read RPC would be ideal. To keep it working without that RPC, we fall
      // back to demo questions for the practice pool when none are returned.
      const { data } = await supabase.from('questions').select('*');
      const list = (data as Question[]) || [];
      setQuestions(list.length ? list : demoQuestions);
      const { data: ph } = await supabase.from('practice_attempts').select('*').order('created_at', { ascending: false }).limit(10);
      setHistory((ph as PracticeAttempt[]) || []);
      setLoading(false);
    })();
  }, [isDemo]);

  const subjects = useMemo(() => ['all', ...Array.from(new Set(questions.map((q) => q.subject)))], [questions]);

  const filtered = useMemo(() =>
    questions.filter((q) =>
      (subject === 'all' || q.subject === subject) &&
      (difficulty === 'all' || q.difficulty === difficulty)
    ), [questions, subject, difficulty]);

  function start() {
    if (filtered.length === 0) { push('No questions match those filters.', 'error'); return; }
    setActive(filtered.slice(0, 8));
    setIdx(0); setSelected(null); setRevealed(false); setScore(0);
    setStartedAt(Date.now());
    if (timed) {
      const total = filtered.slice(0, 8).length * 30;
      setSecsLeft(total);
    }
  }

  // timer
  useEffect(() => {
    if (!active || !timed) return;
    const t = setInterval(() => {
      setSecsLeft((s) => {
        if (s <= 1) { clearInterval(t); finish([...(active as Question[])], score); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, timed]);

  function reveal() {
    if (selected == null) return;
    const q = active![idx];
    if (selected === q.correct_index) setScore((s) => s + 1);
    setRevealed(true);
  }

  function next() {
    if (idx + 1 >= active!.length) { finish(active!, score); return; }
    setIdx((i) => i + 1); setSelected(null); setRevealed(false);
  }

  async function finish(qs: Question[], finalScore: number) {
    const time = Math.floor((Date.now() - startedAt) / 1000);
    const subj = qs[0]?.subject || 'General';
    const topic = qs[0]?.topic || 'General';
    const diff = qs[0]?.difficulty || 'medium';
    if (!isDemo && profile) {
      const { error } = await supabase.from('practice_attempts').insert({
        user_id: profile.id, subject: subj, topic, difficulty: diff,
        score: finalScore, total: qs.length, time_sec: time,
      });
      if (!error) {
        // award first practice + streak achievements
        await supabase.from('achievements').upsert({ user_id: profile.id, code: 'first_practice' }, { onConflict: 'user_id,code' });
        push(`Practice complete: ${finalScore}/${qs.length}`, 'success');
        const { data: ph } = await supabase.from('practice_attempts').select('*').order('created_at', { ascending: false }).limit(10);
        setHistory((ph as PracticeAttempt[]) || []);
      } else { push(error.message, 'error'); }
    } else {
      push(`Practice complete: ${finalScore}/${qs.length}`, 'success');
    }
    setActive(null);
  }

  if (loading) return <div className="flex items-center gap-2 text-slate-500"><Spinner /> Loading…</div>;

  if (active) {
    const q = active[idx];
    return (
      <>
        <div className="mb-4 flex items-center justify-between">
          <Badge color="blue">Question {idx + 1}/{active.length}</Badge>
          <div className="flex items-center gap-3">
            <Badge color="green">Score {score}</Badge>
            {timed && <span className="font-mono font-bold text-slate-700 flex items-center gap-1"><Clock size={15} /> {Math.floor(secsLeft / 60)}:{String(secsLeft % 60).padStart(2, '0')}</span>}
          </div>
        </div>
        <Card className="p-6">
          <div className="flex gap-2"><Badge color="blue">{q.topic}</Badge><Badge color={q.difficulty === 'easy' ? 'green' : q.difficulty === 'medium' ? 'amber' : 'red'}>{q.difficulty}</Badge></div>
          <p className="mt-4 text-lg font-medium">{q.question_text}</p>
          <div className="mt-5 space-y-2">
            {q.choices.map((c, i) => {
              const sel = selected === i;
              const isCorrect = revealed && i === q.correct_index;
              const isWrong = revealed && sel && i !== q.correct_index;
              return (
                <button key={i} disabled={revealed} onClick={() => setSelected(i)}
                  className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-all ${isCorrect ? 'border-emerald-500 bg-emerald-50' : isWrong ? 'border-red-500 bg-red-50' : sel ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <span className="font-bold">{String.fromCharCode(65 + i)}</span> {c}
                  {isCorrect && <CheckCircle2 size={16} className="ml-auto text-emerald-600" />}
                  {isWrong && <XCircle size={16} className="ml-auto text-red-600" />}
                </button>
              );
            })}
          </div>
          {revealed && q.explanation && (
            <div className="mt-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
              <p className="font-semibold flex items-center gap-1.5"><Lightbulb size={14} /> Explanation</p>
              <p className="mt-1">{q.explanation}</p>
            </div>
          )}
          <div className="mt-6 flex justify-end gap-2">
            {!revealed ? <Button onClick={reveal} disabled={selected == null}>Check answer</Button> : <Button onClick={next}>{idx + 1 >= active.length ? 'Finish' : 'Next'}</Button>}
          </div>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Practice Zone" subtitle="Topic-wise practice with immediate feedback. Practice never affects official exam scores." />
      <Card className="mb-6 p-5">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Subject</label>
            <select value={subject} onChange={(e) => setSubject(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              {subjects.map((s) => <option key={s} value={s}>{s === 'all' ? 'All' : s}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Difficulty</label>
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="all">All</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input type="checkbox" checked={timed} onChange={(e) => setTimed(e.target.checked)} className="rounded" /> Timed (30s/q)
          </label>
          <Button onClick={start}><Target size={15} /> Start practice ({Math.min(8, filtered.length)} questions)</Button>
        </div>
      </Card>

      <h2 className="mb-3 font-semibold text-slate-700">Recent practice</h2>
      {history.length === 0 ? <EmptyState title="No practice yet" subtitle="Start a session above." icon={<Target size={28} />} /> : (
        <div className="space-y-2">
          {history.map((p) => (
            <Card key={p.id} className="flex items-center justify-between p-4">
              <div><p className="font-medium text-sm">{p.topic} <span className="text-slate-400">· {p.difficulty}</span></p><p className="text-xs text-slate-500">{new Date(p.created_at).toLocaleString()}</p></div>
              <div className="flex items-center gap-3"><span className="text-sm font-semibold">{p.score}/{p.total}</span><span className="text-xs text-slate-500">{p.time_sec}s</span></div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
