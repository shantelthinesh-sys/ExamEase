import { type ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { GraduationCap, LogOut, Menu, Sparkles } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui';

export type NavItem = { to: string; label: string; icon: ReactNode };

export function DashboardShell({ items, accent }: { items: NavItem[]; accent: 'blue' | 'emerald' }) {
  const { profile, signOut, isDemo } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const accents = {
    blue: { bar: 'bg-blue-600', soft: 'bg-blue-50 text-blue-700', ring: 'ring-blue-200' },
    emerald: { bar: 'bg-emerald-600', soft: 'bg-emerald-50 text-emerald-700', ring: 'ring-emerald-200' },
  };
  const a = accents[accent];

  async function logout() {
    await signOut();
    navigate('/');
  }

  const Sidebar = (
    <div className="flex h-full flex-col">
      <Link to="/" className="flex items-center gap-2 px-5 py-5">
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${a.bar} text-white`}><GraduationCap size={20} /></div>
        <span className="text-lg font-bold">ExamEase</span>
      </Link>
      {isDemo && (
        <div className={`mx-3 mb-2 rounded-lg ${a.soft} px-3 py-2 text-xs font-semibold ring-1 ${a.ring} flex items-center gap-1.5`}>
          <Sparkles size={13} /> Demo mode — sample data
        </div>
      )}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {items.map((it) => {
          const activeLink = location.pathname === it.to || location.pathname.startsWith(it.to + '/');
          return (
            <Link
              key={it.to}
              to={it.to}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${activeLink ? `${a.soft}` : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
            >
              <span className={activeLink ? '' : 'text-slate-400'}>{it.icon}</span>
              {it.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-slate-100 p-3">
        <div className="mb-2 truncate px-2 text-sm">
          <p className="font-semibold text-slate-800">{profile?.full_name}</p>
          <p className="text-xs text-slate-500 capitalize">{profile?.role}</p>
        </div>
        <Button variant="ghost" size="sm" className="w-full justify-start" onClick={logout}>
          <LogOut size={16} /> Sign out
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 bg-white lg:block">{Sidebar}</aside>

      {/* mobile sidebar */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-white">{Sidebar}</aside>
        </div>
      )}

      <div className="lg:pl-64">
        {/* mobile top bar */}
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
          <button onClick={() => setOpen(true)} className="rounded-lg p-2 hover:bg-slate-100"><Menu size={20} /></button>
          <span className="font-bold">ExamEase</span>
          <button onClick={logout} className="rounded-lg p-2 hover:bg-slate-100"><LogOut size={18} /></button>
        </div>
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
