'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Logo } from '@/components/ui/Logo';
import {
  Store,
  PlusCircle,
  Ticket,
  Wallet,
  QrCode,
  BarChart3,
  LogOut,
  ListOrdered,
  Sparkles,
} from 'lucide-react';

interface AppLayoutProps {
  children: React.ReactNode;
  user?: {
    email: string;
    role: 'student' | 'buyer' | 'mess';
    fullName?: string | null;
  } | null;
}

export function AppLayout({ children, user }: AppLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const role = user?.role || 'student';

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch {
      router.push('/login');
    }
  };

  // Role-specific navigation items
  const studentNav = [
    { label: 'Marketplace', href: '/marketplace', icon: Store },
    { label: 'List Meal', href: '/student', icon: PlusCircle },
    { label: 'My Listings', href: '/student/listings', icon: ListOrdered },
    { label: 'My Tokens', href: '/buyer/tokens', icon: Ticket },
    { label: 'Wallet', href: '/student/wallet', icon: Wallet },
  ];

  const buyerNav = [
    { label: 'Marketplace', href: '/marketplace', icon: Store },
    { label: 'My Tokens', href: '/buyer/tokens', icon: Ticket },
  ];

  const messNav = [
    { label: 'Scan Token', href: '/mess', icon: QrCode },
    { label: 'Today Stats', href: '/mess/stats', icon: BarChart3 },
    { label: 'Scan History', href: '/mess/history', icon: ListOrdered },
  ];

  const currentNav = role === 'mess' ? messNav : role === 'buyer' ? buyerNav : studentNav;

  return (
    <div className="min-vh-100 flex flex-col md:flex-row bg-brand-mint text-brand-ink">
      {/* Laptop / Desktop Left Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-white/80 backdrop-blur-md border-r border-emerald-950/5 min-h-screen p-5 shrink-0 justify-between sticky top-0 h-screen">
        <div>
          <div className="pb-6 border-b border-brand-mint">
            <Link href="/marketplace">
              <Logo size="md" showTagline />
            </Link>
          </div>

          {/* User Profile Pill */}
          {user && (
            <div className="mt-5 p-3.5 rounded-2xl bg-brand-mint/70 border border-brand-primary/10">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-brand-primary px-2 py-0.5 rounded-md bg-brand-primary/10">
                  {role}
                </span>
                <span className="text-xs text-brand-muted">Active</span>
              </div>
              <p className="font-bold text-sm text-brand-ink mt-1 truncate">
                {user.fullName || user.email.split('@')[0]}
              </p>
              <p className="text-xs text-brand-muted truncate">{user.email}</p>
            </div>
          )}

          {/* Nav Items */}
          <nav className="mt-6 flex flex-col gap-1.5">
            {currentNav.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all ${
                    isActive
                      ? 'bg-brand-primary text-white shadow-soft scale-[1.02]'
                      : 'text-brand-muted hover:text-brand-ink hover:bg-brand-mint/50'
                  }`}
                >
                  <Icon className="w-5 h-5 stroke-[2.2]" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="pt-4 border-t border-brand-mint">
          {user ? (
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl text-sm font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          ) : (
            <Link
              href="/login"
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-brand-primary text-white text-sm font-bold shadow-sm hover:bg-brand-dark transition-colors"
            >
              Sign In
            </Link>
          )}

          <div className="mt-4 pt-3 text-center border-t border-brand-mint/60">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-brand-muted tracking-wider uppercase">
              <Sparkles className="w-3 h-3 text-brand-yellow fill-brand-yellow" />
              Prototype
            </span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen pb-24 md:pb-6">
        {/* Mobile Top Header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3.5 bg-white/90 backdrop-blur-md border-b border-emerald-950/5 sticky top-0 z-30">
          <Link href="/marketplace">
            <Logo size="sm" />
          </Link>
          <div className="flex items-center gap-2">
            {user ? (
              <span className="text-xs font-bold uppercase tracking-wider text-brand-primary px-2.5 py-1 rounded-full bg-brand-primary/10">
                {role}
              </span>
            ) : (
              <Link
                href="/login"
                className="text-xs font-bold px-3 py-1.5 rounded-full bg-brand-primary text-white"
              >
                Sign In
              </Link>
            )}
            {user && (
              <button
                onClick={handleLogout}
                className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </header>

        {/* Page Children */}
        <main className="flex-1 p-4 md:p-8 max-w-6xl w-full mx-auto">{children}</main>

        {/* Mobile Bottom Navigation Bar (Large touch targets) */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-emerald-950/10 px-2 py-2 flex items-center justify-around shadow-ticket">
          {currentNav.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center flex-1 py-1.5 px-1 rounded-xl transition-all ${
                  isActive ? 'text-brand-primary font-bold' : 'text-brand-muted hover:text-brand-ink'
                }`}
              >
                <div
                  className={`p-1 rounded-xl transition-transform ${
                    isActive ? 'bg-brand-primary/10 scale-110' : ''
                  }`}
                >
                  <Icon className="w-5 h-5 stroke-[2.2]" />
                </div>
                <span className="text-[10px] mt-0.5 tracking-tight font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer Note */}
        <footer className="text-center py-4 text-xs font-medium text-brand-muted/70">
          MealBack &bull; "Skip a meal. Get value back." &bull;{' '}
          <span className="font-semibold text-brand-primary">Prototype</span>
        </footer>
      </div>
    </div>
  );
}
