import React from 'react';
import { AdminKpis, RecruiterKpis, UserRole } from '../types/recruitment';

interface KpiStripProps {
  role: UserRole;
  recruiterKpis: RecruiterKpis;
  adminKpis: AdminKpis;
  loading?: boolean;
}

interface MetricItem {
  label: string;
  value: number;
  detail: string;
}

export function KpiStrip({ role, recruiterKpis, adminKpis, loading }: KpiStripProps) {
  const items: MetricItem[] =
    role === UserRole.ADMIN
      ? [
          {
            label: 'Master Total Submissions',
            value: adminKpis.totalSubmissions,
            detail: 'Merged across all recruiters',
          },
          {
            label: 'Submitted Today',
            value: adminKpis.submittedToday,
            detail: 'Entries dated today',
          },
          {
            label: 'Active Recruiters',
            value: adminKpis.activeRecruiters,
            detail: 'Contributors with records',
          },
          {
            label: 'Clients & Cities',
            value: adminKpis.activeClients,
            detail: `Across ${adminKpis.activeCities} ${adminKpis.activeCities === 1 ? 'city' : 'cities'}`,
          },
        ]
      : [
          {
            label: 'My Total Submissions',
            value: recruiterKpis.totalSubmissions,
            detail: 'Strictly isolated to your account',
          },
          {
            label: 'Submitted Today',
            value: recruiterKpis.submittedToday,
            detail: 'Your entries dated today',
          },
          {
            label: 'My Active Clients',
            value: recruiterKpis.activeClients,
            detail: 'Unique clients you sourced for',
          },
        ];

  const gridCols = role === UserRole.ADMIN ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-1 sm:grid-cols-3';

  return (
    <section
      aria-label="Key Performance Indicators"
      className={`bg-slate-200 border border-slate-200 rounded-xl grid ${gridCols} gap-px overflow-hidden`}
    >
      {items.map((item) => (
        <div key={item.label} className="bg-white px-4 py-4 sm:px-6 sm:py-5">
          <p className="text-xs font-medium text-slate-500">{item.label}</p>
          {loading ? (
            <div className="mt-2 h-8 w-16 rounded bg-slate-100 animate-pulse" />
          ) : (
            <p className="mt-1.5 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 font-mono tabular-nums">
              {item.value.toLocaleString()}
            </p>
          )}
          <p className="mt-1 text-xs text-slate-500">{item.detail}</p>
        </div>
      ))}
    </section>
  );
}
