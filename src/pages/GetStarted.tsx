import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useEffect } from 'react';
import { GraduationCap, User, Presentation, Play, ArrowRight, Sparkles, Info } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button, Card } from '@/components/ui';

export default function GetStarted() {
  const { profile, enterDemo } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  useEffect(() => {
    if (profile) navigate(profile.role === 'teacher' ? '/teacher' : '/student', { replace: true });
  }, [profile, navigate]);

  function startDemo(role: 'student' | 'teacher') {
    enterDemo(role);
    navigate(role === 'teacher' ? '/teacher' : '/student');
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 text-white">
            <GraduationCap size={20} />
          </div>
          <span className="text-lg font-bold">ExamEase</span>
        </Link>
        <Link to="/login"><Button variant="ghost" size="sm">Login</Button></Link>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-10 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-200">
            <Sparkles size={13} /> Get Started
          </span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Choose how you'd like to begin</h1>
          <p className="mt-3 text-slate-600">Log in as a student or teacher, or try a fully functional demo with sample data.</p>
        </div>

        {params.get('demo') === '1' && (
          <div className="mx-auto mb-8 flex max-w-2xl items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            <Info size={18} className="mt-0.5 shrink-0" />
            <p>Demo mode lets you explore sample exams, dashboards and analytics with read-only sample data. Create an account to save real progress.</p>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-3">
          <ChoiceCard
            icon={<User size={22} />}
            title="Student Login"
            desc="Take exams, practice in the DSA Lab, track your progress and climb leaderboards."
            cta="Login as Student"
            onClick={() => navigate('/login?role=student')}
            accent="blue"
          />
          <ChoiceCard
            icon={<Presentation size={22} />}
            title="Teacher Login"
            desc="Create exams, manage a question bank, view participation and analytics."
            cta="Login as Teacher"
            onClick={() => navigate('/login?role=teacher')}
            accent="emerald"
          />
          <ChoiceCard
            icon={<Play size={22} />}
            title="Try Demo"
            desc="Explore sample data for both student and teacher views — no account needed."
            cta="Start Student Demo"
            secondaryCta="Start Teacher Demo"
            onClick={() => startDemo('student')}
            onSecondary={() => startDemo('teacher')}
            accent="amber"
            demo
          />
        </div>

        <div className="mt-10 text-center">
          <p className="text-sm text-slate-600">
            New here?{' '}
            <Link to="/register" className="font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1">
              Create an account <ArrowRight size={14} />
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function ChoiceCard({
  icon, title, desc, cta, secondaryCta, onClick, onSecondary, accent, demo,
}: {
  icon: React.ReactNode; title: string; desc: string; cta: string; secondaryCta?: string;
  onClick: () => void; onSecondary?: () => void; accent: 'blue' | 'emerald' | 'amber'; demo?: boolean;
}) {
  const accents = {
    blue: 'from-blue-500 to-blue-600',
    emerald: 'from-emerald-500 to-emerald-600',
    amber: 'from-amber-500 to-amber-600',
  };
  return (
    <Card className={`flex flex-col p-6 ${demo ? 'ring-2 ring-amber-200' : ''}`}>
      <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${accents[accent]} text-white shadow-sm`}>{icon}</div>
      <h2 className="mt-4 text-xl font-bold">{title}</h2>
      <p className="mt-2 flex-1 text-sm text-slate-600">{desc}</p>
      <div className="mt-5 flex flex-col gap-2">
        <Button onClick={onClick}>{cta}</Button>
        {secondaryCta && onSecondary && <Button variant="outline" onClick={onSecondary}>{secondaryCta}</Button>}
      </div>
    </Card>
  );
}
