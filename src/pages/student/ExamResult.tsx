import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { CheckCircle2, XCircle, Circle, Clock, Target, TrendingUp, ArrowLeft, Lightbulb } from 'lucide-react';
import { supabase, type Exam, type ReviewItem, type Attempt, type StartExamQuestion } from '@/lib/supabase';
import { useDemo } from '@/hooks/useDemo';
import { Card, Button, Spinner, Badge, StatCard, EmptyState, PageHeader } from '@/components/ui';
import { demoExams, demoQuestions } from '@/demo/data';

export default function ExamResult() {
  const { id } = useParams();
  const location = useLocation();
  const { isDemo } = useDemo();
  const demoState = location.state as { demoScore?: number; demoTotal?: number; demoExamId?: string; demoAnswers?: Record<string, number | null>; demoQuestions?: StartExamQuestion[] } | null;

  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [exam, setExam] = useState<Exam | null>(null);
  const [review, setReview] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isDemo && demoState) {
      const ex = demoExams.find((e) => e.id === demoState.demoExamId) || null;
      setExam(ex);
      setAttempt({ id: id || '', exam_id: demoState.demoExamId || '', user_id: '', status: 'submitted', score: demoState.demoScore || 0, total_marks: demoState.demoTotal || 0, started_at: new Date().toISOString(), submitted_at: new Date().toISOString(), time_taken_sec: null });
      // build review from demo questions + answers
      const items: ReviewItem[] = ((demoState.demoQuestions as StartExamQuestion[]) || []).map((q) => {
        const sel = demoState.demoAnswers?.[q.id] ?? null;
        const actual = sel == null ? null : q.display_order[sel];
        const demoQ = demoQuestions.find((d) => d.id === q.id)!;
        return {
          question_id: q.id, question_text: q.text, choices: q.choices, display_order: q.display_order,
          selected_index: actual, correct_index: demoQ.correct_index,
          is_correct: actual != null && actual === demoQ.correct_index,
          marks_awarded: actual === demoQ.correct_index ? q.marks : (actual == null ? 0 : -(ex?.negative_marking || 0) * q.marks),
          explanation: demoQ.explanation, topic: q.topic, marks: q.marks,
        };
      });
      setReview(items);
      setLoading(false);
      return;
    }
    if (!id) return;
    (async () => {
      const { data: at } = await supabase.from('attempts').select('*').eq('id', id).maybeSingle();
      if (!at) { setError('Attempt not found'); setLoading(false); return; }
      setAttempt(at as Attempt);
      const { data: ex } = await supabase.from('exams').select('*').eq('id', (at as Attempt).exam_id).maybeSingle();
      setExam(ex as Exam);
      const { data: rv, error: rErr } = await supabase.rpc('get_attempt_review', { p_attempt_id: id });
      if (rErr) setError(rErr.message);
      else setReview((rv as ReviewItem[]) || []);
      setLoading(false);
    })();
  }, [id, isDemo, demoState]);

  if (loading) return <div className="flex items-center gap-2 text-slate-500"><Spinner /> Loading result…</div>;
  if (error) return <Card className="p-6"><p className="text-red-600">{error}</p><Link to="/student/results" className="mt-3 inline-block"><Button variant="outline" size="sm">Back</Button></Link></Card>;
  if (!attempt) return <EmptyState title="Result not found" />;

  const pct = attempt.total_marks ? Math.round((attempt.score / attempt.total_marks) * 100) : 0;
  const correct = review.filter((r) => r.is_correct).length;
  const incorrect = review.filter((r) => r.selected_index != null && !r.is_correct).length;
  const unanswered = review.filter((r) => r.selected_index == null).length;
  const accuracy = correct + incorrect > 0 ? Math.round((correct / (correct + incorrect)) * 100) : 0;

  return (
    <>
      <Link to="/student/results" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900"><ArrowLeft size={15} /> Back to results</Link>
      <PageHeader title="Exam Result" subtitle={exam?.title} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard label="Score" value={`${attempt.score}/${attempt.total_marks}`} icon={<Target size={20} />} />
        <StatCard label="Percentage" value={`${pct}%`} icon={<TrendingUp size={20} />} accent={pct >= 60 ? 'green' : 'amber'} />
        <StatCard label="Accuracy" value={`${accuracy}%`} icon={<CheckCircle2 size={20} />} accent="purple" />
        <StatCard label="Time" value={attempt.time_taken_sec ? `${Math.floor(attempt.time_taken_sec / 60)}m ${attempt.time_taken_sec % 60}s` : '—'} icon={<Clock size={20} />} accent="amber" />
      </div>

      <div className="mb-4 flex gap-2 text-sm">
        <Badge color="green">{correct} correct</Badge>
        <Badge color="red">{incorrect} incorrect</Badge>
        <Badge color="slate">{unanswered} unanswered</Badge>
      </div>

      <h2 className="mb-3 font-semibold text-slate-700">Question review</h2>
      {review.length === 0 ? (
        <EmptyState title="Review not available" subtitle="Results may not be released for this exam yet." icon={<Lightbulb size={28} />} />
      ) : (
        <div className="space-y-3">
          {review.map((r, i) => (
            <Card key={r.question_id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium">{i + 1}. {r.question_text}</p>
                {r.is_correct ? <Badge color="green"><CheckCircle2 size={13} /> Correct</Badge>
                  : r.selected_index == null ? <Badge color="slate"><Circle size={13} /> Skipped</Badge>
                  : <Badge color="red"><XCircle size={13} /> Incorrect</Badge>}
              </div>
              <div className="mt-3 space-y-1.5">
                {r.choices.map((c, i) => {
                  const isCorrect = r.correct_index === i;
                  const isSel = r.selected_index === i;
                  return (
                    <div key={i} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${isCorrect ? 'bg-emerald-50 text-emerald-800' : isSel ? 'bg-red-50 text-red-800' : 'bg-slate-50 text-slate-700'}`}>
                      <span className="font-bold">{String.fromCharCode(65 + i)}</span> {c}
                      {isCorrect && <CheckCircle2 size={14} className="ml-auto" />}
                      {isSel && !isCorrect && <XCircle size={14} className="ml-auto" />}
                    </div>
                  );
                })}
              </div>
              {r.explanation && (
                <div className="mt-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
                  <p className="font-semibold flex items-center gap-1.5"><Lightbulb size={14} /> Explanation</p>
                  <p className="mt-1">{r.explanation}</p>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
