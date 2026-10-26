import { useState } from 'react';
import { Layers, ArrowUpDown, Search, Hash, Play, RotateCcw, CheckCircle2, Lightbulb } from 'lucide-react';
import { Card, Button, Badge, PageHeader } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { useDemo } from '@/hooks/useDemo';
import { useToast } from '@/context/ToastContext';

type Lab = 'stack' | 'sorting' | 'binarysearch' | 'hashtable';

export default function DsaLab() {
  const [lab, setLab] = useState<Lab | null>(null);
  const { profile } = useAuth();
  const { isDemo } = useDemo();
  const { push } = useToast();

  async function recordAchievement() {
    if (isDemo || !profile) return;
    try {
      await supabase.from('achievements').upsert({ user_id: profile.id, code: 'dsa_explorer' }, { onConflict: 'user_id,code' });
    } catch { /* ignore */ }
  }

  return (
    <>
      <PageHeader title="DSA Practice Lab" subtitle="The signature ExamEase novelty — experiment with core data structures and algorithms hands-on." />
      <div className="mb-6 rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-purple-50 p-5">
        <p className="text-sm text-blue-900">
          <strong>Why a DSA Lab in an exam platform?</strong> Many exams test DSA conceptually. Here you don't just answer
          multiple-choice questions — you <em>operate</em> the structures: push and pop a stack, watch quick sort partition,
          step through binary search, and resolve hash collisions. Build the intuition, then ace the exam.
        </p>
      </div>

      {!lab && (
        <div className="grid gap-4 sm:grid-cols-2">
          <LabCard icon={<Layers size={22} />} title="Stack Visualizer" desc="Push, pop and peek. See LIFO ordering live." color="blue" onClick={() => { setLab('stack'); recordAchievement(); }} />
          <LabCard icon={<ArrowUpDown size={22} />} title="Sorting Playground" desc="Bubble, selection and quick sort with step-by-step animation." color="emerald" onClick={() => { setLab('sorting'); recordAchievement(); }} />
          <LabCard icon={<Search size={22} />} title="Binary Search Tracer" desc="Watch the search range halve on a sorted array." color="amber" onClick={() => { setLab('binarysearch'); recordAchievement(); }} />
          <LabCard icon={<Hash size={22} />} title="Hash Table Explorer" desc="Insert keys, watch buckets fill and collisions resolve." color="purple" onClick={() => { setLab('hashtable'); recordAchievement(); }} />
        </div>
      )}

      {lab && (
        <div>
          <Button variant="ghost" size="sm" className="mb-4" onClick={() => setLab(null)}>← Back to labs</Button>
          {lab === 'stack' && <StackLab onAward={recordAchievement} />}
          {lab === 'sorting' && <SortingLab />}
          {lab === 'binarysearch' && <BinarySearchLab />}
          {lab === 'hashtable' && <HashTableLab push={push} />}
        </div>
      )}
    </>
  );
}

function LabCard({ icon, title, desc, color, onClick }: { icon: React.ReactNode; title: string; desc: string; color: 'blue' | 'emerald' | 'amber' | 'purple'; onClick: () => void }) {
  const colors = {
    blue: 'from-blue-500 to-blue-600', emerald: 'from-emerald-500 to-emerald-600',
    amber: 'from-amber-500 to-amber-600', purple: 'from-purple-500 to-purple-600',
  };
  return (
    <Card className="cursor-pointer p-6 transition-shadow hover:shadow-md" >
      <button onClick={onClick} className="text-left w-full">
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${colors[color]} text-white shadow-sm`}>{icon}</div>
        <h3 className="mt-4 text-lg font-bold">{title}</h3>
        <p className="mt-1 text-sm text-slate-600">{desc}</p>
        <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-blue-600"><Play size={14} /> Open lab</span>
      </button>
    </Card>
  );
}

// ---------------- Stack Lab ----------------
function StackLab({ onAward }: { onAward: () => void }) {
  const [stack, setStack] = useState<number[]>([5, 12, 8]);
  const [input, setInput] = useState('');
  const [log, setLog] = useState<string[]>(['Stack initialized with [5, 12, 8]']);
  const counter = useState(() => ({ n: 100 }))[0];

  function push() {
    const v = input.trim() === '' ? counter.n++ : Number(input);
    if (isNaN(v)) return;
    setStack((s) => [...s, v]);
    setLog((l) => [`push(${v}) → top is now ${v}`, ...l]);
    setInput('');
    onAward();
  }
  function pop() {
    if (stack.length === 0) { setLog((l) => ['pop() → stack empty!', ...l]); return; }
    const v = stack[stack.length - 1];
    setStack((s) => s.slice(0, -1));
    setLog((l) => [`pop() → returned ${v} (LIFO)`, ...l]);
  }
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-5">
        <h3 className="font-semibold flex items-center gap-2"><Layers size={18} className="text-blue-600" /> Stack (LIFO)</h3>
        <div className="mt-4 flex gap-2">
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="value (blank=auto)" className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" onKeyDown={(e) => e.key === 'Enter' && push()} />
          <Button size="sm" onClick={push}>Push</Button>
          <Button size="sm" variant="outline" onClick={pop}>Pop</Button>
          <Button size="sm" variant="ghost" onClick={() => { setStack([]); setLog(['Cleared']); }}><RotateCcw size={15} /></Button>
        </div>
        <div className="mt-5 flex flex-col-reverse items-center gap-2">
          <div className="h-6 w-40 rounded-b-lg border-x-2 border-b-2 border-slate-300 text-center text-xs text-slate-400">base</div>
          {stack.length === 0 && <p className="text-sm text-slate-400 py-8">Stack is empty</p>}
          {stack.map((v, i) => (
            <div key={i} className={`w-40 rounded-lg border px-4 py-3 text-center font-mono font-bold ${i === stack.length - 1 ? 'border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-100' : 'border-slate-200 bg-slate-50'}`}>
              {v}{i === stack.length - 1 && <span className="ml-2 text-xs">← top</span>}
            </div>
          ))}
        </div>
      </Card>
      <Card className="p-5">
        <h3 className="font-semibold">Operation log</h3>
        <div className="mt-3 space-y-1.5 font-mono text-xs">
          {log.map((l, i) => <div key={i} className="rounded bg-slate-50 px-2 py-1">{l}</div>)}
        </div>
        <div className="mt-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
          <Lightbulb size={14} className="inline" /> The last element pushed is the first popped — that's LIFO.
        </div>
      </Card>
    </div>
  );
}

// ---------------- Sorting Lab ----------------
function SortingLab() {
  const [arr, setArr] = useState<number[]>([5, 2, 8, 1, 9, 3]);
  const [algo, setAlgo] = useState<'bubble' | 'selection' | 'quick'>('bubble');
  const [steps, setSteps] = useState<number[][]>([]);
  const [step, setStep] = useState(0);
  const [running, setRunning] = useState(false);

  function genBubble(a: number[]): number[][] {
    const out: number[][] = [];
    const x = [...a];
    out.push([...x]);
    for (let i = 0; i < x.length; i++) {
      for (let j = 0; j < x.length - i - 1; j++) {
        if (x[j] > x[j + 1]) { [x[j], x[j + 1]] = [x[j + 1], x[j]]; out.push([...x]); }
      }
    }
    return out;
  }
  function genSelection(a: number[]): number[][] {
    const out: number[][] = [];
    const x = [...a];
    out.push([...x]);
    for (let i = 0; i < x.length; i++) {
      let mi = i;
      for (let j = i + 1; j < x.length; j++) if (x[j] < x[mi]) mi = j;
      if (mi !== i) { [x[i], x[mi]] = [x[mi], x[i]]; out.push([...x]); }
    }
    return out;
  }
  function genQuick(a: number[]): number[][] {
    const out: number[][] = [];
    const x = [...a];
    out.push([...x]);
    function qs(lo: number, hi: number) {
      if (lo >= hi) return;
      const pivot = x[hi];
      let i = lo;
      for (let j = lo; j < hi; j++) {
        if (x[j] < pivot) { [x[i], x[j]] = [x[j], x[i]]; out.push([...x]); i++; }
      }
      [x[i], x[hi]] = [x[hi], x[i]]; out.push([...x]);
      qs(lo, i - 1); qs(i + 1, hi);
    }
    qs(0, x.length - 1);
    return out;
  }

  function run() {
    const gen = algo === 'bubble' ? genBubble : algo === 'selection' ? genSelection : genQuick;
    const s = gen(arr);
    setSteps(s);
    setStep(0);
    setRunning(true);
    let i = 0;
    const t = setInterval(() => {
      i++;
      if (i >= s.length) { clearInterval(t); setRunning(false); return; }
      setStep(i);
    }, 600);
  }

  const display = steps.length ? steps[step] : arr;
  const sorted = !running && steps.length && step === steps.length - 1;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center gap-3">
        <select value={algo} onChange={(e) => setAlgo(e.target.value as 'bubble' | 'selection' | 'quick')} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="bubble">Bubble Sort — O(n²)</option>
          <option value="selection">Selection Sort — O(n²)</option>
          <option value="quick">Quick Sort — O(n log n)</option>
        </select>
        <Button size="sm" onClick={run} disabled={running}><Play size={15} /> Run</Button>
        <Button size="sm" variant="ghost" onClick={() => { setArr(Array.from({ length: 6 }, () => Math.floor(Math.random() * 20) + 1)); setSteps([]); }}><RotateCcw size={15} /> New array</Button>
        {sorted && <Badge color="green"><CheckCircle2 size={13} /> Sorted</Badge>}
      </div>
      <div className="mt-6 flex items-end justify-center gap-2" style={{ height: 220 }}>
        {display.map((v, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <div className="flex items-end rounded-t-lg bg-gradient-to-t from-emerald-500 to-emerald-400 transition-all" style={{ height: `${v * 10 + 10}px`, width: 36 }}>
              <span className="mx-auto pb-1 text-xs font-bold text-white">{v}</span>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-center text-sm text-slate-500">Step {step} of {steps.length - 1}</p>
      <div className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
        <Lightbulb size={14} className="inline" /> {algo === 'quick' ? 'Quick sort partitions around a pivot and recurses — much faster on average.' : 'Bubble and selection sort are simple but O(n²); fine for small arrays.'}
      </div>
    </Card>
  );
}

// ---------------- Binary Search Lab ----------------
function BinarySearchLab() {
  const [arr] = useState<number[]>([3, 7, 11, 14, 19, 23, 28, 33, 41, 47]);
  const [target, setTarget] = useState(23);
  const [trace, setTrace] = useState<{ lo: number; hi: number; mid: number; found: boolean }[]>([]);
  const [stepI, setStepI] = useState(0);
  const [running, setRunning] = useState(false);

  function run() {
    const t: typeof trace = [];
    let lo = 0, hi = arr.length - 1;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      t.push({ lo, hi, mid, found: arr[mid] === target });
      if (arr[mid] === target) break;
      if (arr[mid] < target) lo = mid + 1; else hi = mid - 1;
    }
    setTrace(t);
    setStepI(0);
    setRunning(true);
    let i = 0;
    const timer = setInterval(() => {
      i++;
      if (i >= t.length) { clearInterval(timer); setRunning(false); return; }
      setStepI(i);
    }, 900);
  }

  const cur = trace[stepI];
  const found = cur?.found;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium">Find target:</label>
        <input type="number" value={target} onChange={(e) => setTarget(Number(e.target.value))} className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <Button size="sm" onClick={run} disabled={running}><Play size={15} /> Search</Button>
      </div>
      <p className="mt-3 text-sm text-slate-500">Sorted array: [{arr.join(', ')}]</p>
      <div className="mt-5 flex flex-wrap gap-2">
        {arr.map((v, i) => {
          const inRange = cur && i >= cur.lo && i <= cur.hi;
          const isMid = cur && i === cur.mid;
          const isTarget = found && v === target;
          return (
            <div key={i} className={`flex h-12 w-12 items-center justify-center rounded-lg font-mono font-bold transition-all ${isTarget ? 'bg-emerald-500 text-white' : isMid ? 'bg-amber-500 text-white' : inRange ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-300' : 'bg-slate-100 text-slate-500'}`}>
              {v}
            </div>
          );
        })}
      </div>
      <div className="mt-4 text-sm">
        {cur ? (
          <p>lo={cur.lo}, hi={cur.hi}, mid={cur.mid} → {found ? <span className="font-bold text-emerald-600">found!</span> : `arr[mid]=${arr[cur.mid]} ${arr[cur.mid] < target ? '< target → go right' : '> target → go left'}`}</p>
        ) : <p className="text-slate-500">Press Search to trace.</p>}
      </div>
      <div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
        <Lightbulb size={14} className="inline" /> Each step halves the search range — O(log n). Requires a sorted array.
      </div>
    </Card>
  );
}

// ---------------- Hash Table Lab ----------------
function HashTableLab({ push }: { push: (m: string, t?: 'success' | 'error' | 'info') => void }) {
  const size = 7;
  const [buckets, setBuckets] = useState<number[][]>(Array.from({ length: size }, () => []));
  const [input, setInput] = useState('');

  function h(k: number) { return k % size; }
  function insert() {
    const v = Number(input);
    if (isNaN(v)) return;
    const b = h(v);
    setBuckets((bs) => bs.map((x, i) => i === b ? [...x, v] : x));
    setInput('');
    push(`Inserted ${v} → bucket ${b}${buckets[b].length > 0 ? ' (collision, chained)' : ''}`, 'info');
  }
  function lookup() {
    const v = Number(input);
    if (isNaN(v)) return;
    const b = h(v);
    const found = buckets[b].includes(v);
    push(`Lookup ${v}: bucket ${b} → ${found ? 'found' : 'not found'} (${buckets[b].length} entries in bucket)`, found ? 'success' : 'error');
  }

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center gap-3">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="key (number)" className="w-40 rounded-lg border border-slate-300 px-3 py-2 text-sm" onKeyDown={(e) => e.key === 'Enter' && insert()} />
        <Button size="sm" onClick={insert}>Insert</Button>
        <Button size="sm" variant="outline" onClick={lookup}>Lookup</Button>
        <Button size="sm" variant="ghost" onClick={() => setBuckets(Array.from({ length: size }, () => []))}><RotateCcw size={15} /> Clear</Button>
      </div>
      <p className="mt-3 text-sm text-slate-500">Hash function: h(k) = k mod {size} · collision resolution: separate chaining</p>
      <div className="mt-5 space-y-2">
        {buckets.map((b, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="w-20 text-sm font-semibold text-slate-600">bucket {i}</span>
            <div className="flex flex-1 flex-wrap gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 min-h-[44px]">
              {b.length === 0 && <span className="text-xs text-slate-400">empty</span>}
              {b.map((v, j) => (
                <span key={j} className="rounded-md bg-purple-100 px-2.5 py-1 font-mono text-sm font-bold text-purple-700">{v}{j > 0 && <span className="ml-1 text-xs text-purple-400">↩</span>}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-lg bg-purple-50 p-3 text-sm text-purple-800">
        <Lightbulb size={14} className="inline" /> When two keys share a bucket (a collision), chaining stores both in a list. Worst case: all keys collide → O(n) lookup.
      </div>
    </Card>
  );
}
