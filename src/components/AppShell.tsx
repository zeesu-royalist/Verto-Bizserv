import React, { useState } from 'react';
import {
  BarChart3,
  Database,
  FilePlus2,
  ListChecks,
  LogOut,
  Menu,
  Plus,
  Users,
  X,
} from 'lucide-react';
import { ActiveNavSection, UserProfile, UserRole } from '../types/recruitment';

interface AppShellProps {
  profile: UserProfile;
  activeSection: ActiveNavSection;
  onSelectSection: (section: ActiveNavSection) => void;
  onOpenNewSubmission: () => void;
  onSignOut: () => void;
  children: React.ReactNode;
}

interface NavItem {
  id: ActiveNavSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'submissions', label: 'Submissions', icon: Database },
  { id: 'new-entry', label: 'Data Entry Form', icon: FilePlus2 },
  { id: 'dropdowns', label: 'Managers & Clients', icon: ListChecks, adminOnly: true },
  { id: 'performance', label: 'Performance', icon: BarChart3, adminOnly: true },
  { id: 'users', label: 'User Management', icon: Users, adminOnly: true },
];

export function AppShell({
  profile,
  activeSection,
  onSelectSection,
  onOpenNewSubmission,
  onSignOut,
  children,
}: AppShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isAdmin = profile.role === UserRole.ADMIN;

  const visibleNavItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin).map((item) => ({
    ...item,
    label:
      item.id === 'submissions'
        ? isAdmin
          ? 'Master Database'
          : 'My Submissions'
        : item.label,
  }));

  const currentSectionTitle =
    visibleNavItems.find((item) => item.id === activeSection)?.label || 'Workspace';

  const handleNavClick = (section: ActiveNavSection) => {
    onSelectSection(section);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-56 lg:fixed lg:inset-y-0 bg-white border-r border-slate-200 z-20">
        <div className="h-16 px-5 flex items-center border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-700 text-white font-bold text-sm flex items-center justify-center shrink-0">
              V
            </div>
            <span className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap">
              Verto Bizserv
            </span>
          </div>
        </div>

        <nav aria-label="Workspace navigation" className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                aria-current={active ? 'page' : undefined}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-100 whitespace-nowrap ${
                  active
                    ? 'bg-red-50 text-red-800 font-semibold'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-red-700' : 'text-slate-400'}`} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 shrink-0">
          <div className="px-1.5 py-1">
            <p className="text-sm font-semibold text-slate-900 truncate">{profile.name}</p>
            <p className="text-xs text-slate-500 truncate mt-0.5">{profile.email}</p>
            <p className="text-xs font-medium text-slate-600 mt-1.5">
              {isAdmin ? 'Administrator · Full Access' : 'Recruiter · Isolated Scope'}
            </p>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            className="mt-3 w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative w-72 max-w-[82vw] bg-white h-full flex flex-col border-r border-slate-200 z-10">
            <div className="h-14 px-4 flex items-center justify-between border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-md bg-red-700 text-white font-bold text-xs flex items-center justify-center">
                  V
                </div>
                <span className="text-base font-bold tracking-tight text-slate-900">
                  Verto Bizserv
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close navigation menu"
                className="p-2 text-slate-500 hover:text-slate-900 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav aria-label="Mobile workspace navigation" className="flex-1 px-3 py-4 space-y-1">
              {visibleNavItems.map((item) => {
                const Icon = item.icon;
                const active = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavClick(item.id)}
                    aria-current={active ? 'page' : undefined}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? 'bg-red-50 text-red-800 font-semibold'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-red-700' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="p-4 border-t border-slate-200">
              <p className="text-sm font-semibold text-slate-900 truncate">{profile.name}</p>
              <p className="text-xs text-slate-500 truncate">{profile.email}</p>
              <p className="text-xs font-medium text-slate-600 mt-1">
                {isAdmin ? 'Administrator · Full Access' : 'Recruiter · Isolated Scope'}
              </p>
              <button
                type="button"
                onClick={onSignOut}
                className="mt-3 w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-lg"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-56 min-w-0 flex flex-col">
        <header className="sticky top-0 z-10 h-14 lg:h-16 bg-white/95 backdrop-blur-xs border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-lg"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0 flex items-center gap-2 text-sm">
              <span className="hidden sm:inline text-slate-400 whitespace-nowrap">
                {isAdmin ? 'Admin Console' : 'Recruiter Portal'}
              </span>
              <span className="hidden sm:inline text-slate-300" aria-hidden="true">
                /
              </span>
              <h1 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                {currentSectionTitle}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {activeSection !== 'new-entry' && (
              <button
                type="button"
                onClick={onOpenNewSubmission}
                className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-red-700 hover:bg-red-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>New Submission</span>
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-[1600px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
