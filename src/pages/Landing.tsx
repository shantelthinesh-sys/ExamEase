import { Link } from 'react-router-dom';
import { GraduationCap, BookOpen, BarChart3, Trophy, Clock, ShieldCheck, ArrowRight, Sparkles, Users, LineChart, Brain, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui';

export default function Landing() {
  const { profile } = useAuth();
  const ctaTo = profile ? (profile.role === 'teacher' ? '/teacher' : '/student') : '/get-started';

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-sm">
              <GraduationCap size={20} />
            </div>
            <span className="text-lg font-bold tracking-tight">ExamEase</span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex">
            <a href="#features" className="hover:text-slate-900">Features</a>
            <a href="#how" className="hover:text-slate-900">How It Works</a>
            <a href="#about" className="hover:text-slate-900">About</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login"><Button variant="ghost" size="sm">Login</Button></Link>
            <Link to={ctaTo}><Button size="sm">Get Started <ArrowRight size={15} /></Button></Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-50 to-white">
        <div className="absolute inset-0 -z-10 opacity-40">
          <div className="absolute left-1/4 top-10 h-72 w-72 rounded-full bg-blue-200/40 blur-3xl" />
          <div className="absolute right-1/4 top-40 h-72 w-72 rounded-full bg-emerald-200/30 blur-3xl" />
        </div>
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 py-20 lg:grid-cols-2 lg:py-28">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-200">
              <Sparkles size={13} /> Smart Learning Intelligence built in
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
              Exams Made Smarter.<br />Performance Made Clear.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-slate-600">
              A smarter examination platform that helps students perform better and empowers teachers with meaningful learning insights.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={ctaTo}><Button size="lg">Get Started <ArrowRight size={18} /></Button></Link>
              <Link to="/get-started?demo=1"><Button size="lg" variant="outline">Explore Demo</Button></Link>
            </div>
            <div className="mt-8 flex items-center gap-6 text-sm text-slate-500">
              <span className="flex items-center gap-1.5"><ShieldCheck size={16} className="text-emerald-600" /> Secure accounts</span>
              <span className="flex items-center gap-1.5"><Clock size={16} className="text-blue-600" /> Timed exams</span>
              <span className="flex items-center gap-1.5"><Brain size={16} className="text-purple-600" /> Adaptive practice</span>
            </div>
          </div>

          {/* Preview collage */}
          <div className="relative">
            <div className="grid gap-4">
              <PreviewCard icon={<BarChart3 size={18} />} title="Student Dashboard" lines={['Average score 78%', 'Practice streak 6 days', 'Best score 92%']} accent="blue" />
              <div className="grid grid-cols-2 gap-4">
                <PreviewCard icon={<LineChart size={18} />} title="Teacher Analytics" lines={['Class avg 74%', 'Top topic: Stacks']} accent="emerald" small />
                <PreviewCard icon={<Trophy size={18} />} title="Leaderboard" lines={['#1 Aarav — 90%', '#2 Priya — 80%']} accent="amber" small />
              </div>
              <PreviewCard icon={<BookOpen size={18} />} title="Examination Interface" lines={['Timer, navigation grid', 'Mark for review, auto-submit']} accent="purple" />
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-7xl px-6 py-20">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight">Everything an exam platform needs</h2>
          <p className="mt-3 text-slate-600">Designed for students and teachers, with a signature DSA practice lab.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          <Feature icon={<Clock />} title="Distraction-free exams" text="Countdown timer, question grid, mark-for-review, auto-submit on timeout, and server-side scoring with negative marking." />
          <Feature icon={<Brain />} title="Smart Learning Intelligence" text="Adaptive practice engine, explain-my-mistakes, personal improvement tracker, and question difficulty analytics." />
          <Feature icon={<Trophy />} title="Leaderboards & gamification" text="Exam-specific rankings, practice streaks, improvement and completion badges awarded from real activity." />
          <Feature icon={<BarChart3 />} title="Teacher analytics" text="Class averages, score distributions, topic-wise performance, frequently missed questions and participation rates." />
          <Feature icon={<BookOpen />} title="Question bank" text="Reusable, topic-tagged questions with difficulty levels, explanations, and MCQ or True/False support." />
          <Feature icon={<Code />} title="DSA Practice Lab" text="A unique, hands-on lab for stacks, sorting, binary search and hash tables — the signature ExamEase novelty." />
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="bg-slate-50 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight">How it works</h2>
            <p className="mt-3 text-slate-600">From sign-up to insights in four steps.</p>
          </div>
          <div className="grid gap-6 md:grid-cols-4">
            {[
              { n: 1, t: 'Create an account', d: 'Pick Student or Teacher, add your details.' },
              { n: 2, t: 'Find or create exams', d: 'Students browse; teachers build exams and a question bank.' },
              { n: 3, t: 'Take or proctor', d: 'Timed exams with auto-submit; teachers watch participation live.' },
              { n: 4, t: 'Learn from results', d: 'Review mistakes, track trends, climb the leaderboard.' },
            ].map((s) => (
              <div key={s.n} className="rounded-2xl border border-slate-200 bg-white p-6">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">{s.n}</div>
                <h3 className="mt-4 font-semibold">{s.t}</h3>
                <p className="mt-1 text-sm text-slate-600">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="mx-auto max-w-4xl px-6 py-20 text-center">
        <h2 className="text-3xl font-bold tracking-tight">About ExamEase</h2>
        <p className="mt-4 text-slate-600">
          ExamEase is a modern online examination and performance-intelligence platform. Beyond standard exam delivery,
          it introduces a hands-on <strong>DSA Practice Lab</strong> where students actively experiment with core data
          structures and algorithms — turning abstract concepts into intuition. Teachers get rich, database-driven
          analytics; students get personalised, explainable recommendations.
        </p>
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {['Server-side scoring', 'Adaptive practice', 'Real leaderboards'].map((x) => (
            <div key={x} className="flex items-center justify-center gap-2 rounded-xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
              <CheckCircle2 size={16} className="text-emerald-600" /> {x}
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-br from-blue-600 to-blue-800 py-16">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 px-6 text-center text-white">
          <Users size={32} />
          <h2 className="text-3xl font-bold">Ready to get started?</h2>
          <p className="max-w-xl text-blue-100">Create an account or explore a fully functional demo — no signup required.</p>
          <div className="flex gap-3">
            <Link to="/get-started"><Button size="lg" variant="secondary">Get Started</Button></Link>
            <Link to="/get-started?demo=1"><Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">Explore Demo</Button></Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-100 py-8 text-center text-sm text-slate-500">
        ExamEase — Smart Online Examination & Performance Intelligence Platform
      </footer>
    </div>
  );
}

function PreviewCard({ icon, title, lines, accent, small }: { icon: React.ReactNode; title: string; lines: string[]; accent: 'blue' | 'emerald' | 'amber' | 'purple'; small?: boolean }) {
  const accents = {
    blue: 'from-blue-500 to-blue-600',
    emerald: 'from-emerald-500 to-emerald-600',
    amber: 'from-amber-500 to-amber-600',
    purple: 'from-purple-500 to-purple-600',
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-transform hover:-translate-y-0.5">
      <div className="flex items-center gap-2">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${accents[accent]} text-white`}>{icon}</div>
        <span className={`font-semibold ${small ? 'text-sm' : ''}`}>{title}</span>
      </div>
      <div className="mt-3 space-y-1.5">
        {lines.map((l) => (
          <div key={l} className="flex items-center gap-2 text-sm text-slate-600">
            <div className="h-1.5 w-1.5 rounded-full bg-slate-300" /> {l}
          </div>
        ))}
      </div>
    </div>
  );
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 transition-shadow hover:shadow-md">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">{icon}</div>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-slate-600">{text}</p>
    </div>
  );
}

// local icon import fallback for Code
import { Code } from 'lucide-react';
