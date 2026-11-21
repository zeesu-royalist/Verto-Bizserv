import React from 'react';
import { CityPerformanceRow, RecruiterPerformanceRow } from '../types/recruitment';

interface PerformanceBreakdownViewProps {
  recruiterRows: RecruiterPerformanceRow[];
  cityRows: CityPerformanceRow[];
  totalRecords: number;
  onFilterByRecruiter: (recruiterUid: string) => void;
  onFilterByCity: (city: string) => void;
}

export function PerformanceBreakdownView({
  recruiterRows,
  cityRows,
  totalRecords,
  onFilterByRecruiter,
  onFilterByCity,
}: PerformanceBreakdownViewProps) {
  return (
    <div className="space-y-8">
      {/* Recruiter Performance Summary Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-200 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Recruiter Performance Breakdown
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Submission volume, daily output, active clients, and city reach per recruiter.
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums text-slate-500">
            {recruiterRows.length} active {recruiterRows.length === 1 ? 'recruiter' : 'recruiters'} ·{' '}
            {totalRecords} total records
          </span>
        </div>

        {recruiterRows.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No submissions recorded yet. Breakdown metrics populate automatically as recruiters log
            candidates.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[760px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th scope="col" className="px-6 py-3">
                    Recruiter
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Total Submissions
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Submitted Today
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Active Clients
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Cities Covered
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Top City
                  </th>
                  <th scope="col" className="px-6 py-3 w-48">
                    Master Share
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {recruiterRows.map((row) => (
                  <tr key={row.recruiterUid || row.recruiterName} className="hover:bg-slate-50/70">
                    <td className="px-6 py-3.5">
                      <button
                        type="button"
                        onClick={() => onFilterByRecruiter(row.recruiterUid)}
                        className="text-left group"
                      >
                        <span className="font-semibold text-slate-900 group-hover:text-red-700 group-hover:underline">
                          {row.recruiterName}
                        </span>
                        <span className="block text-xs text-slate-500">{row.recruiterEmail}</span>
                      </button>
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono font-semibold tabular-nums text-slate-900">
                      {row.totalSubmissions}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono tabular-nums text-slate-700">
                      {row.submittedToday}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono tabular-nums text-slate-700">
                      {row.activeClients}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono tabular-nums text-slate-700">
                      {row.citiesCovered}
                    </td>
                    <td className="px-4 py-3.5 text-slate-700">{row.topCity}</td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-red-700 rounded-full"
                            style={{ width: `${Math.min(100, Math.max(2, row.sharePercent))}%` }}
                          />
                        </div>
                        <span className="w-12 text-right font-mono text-xs tabular-nums text-slate-600">
                          {row.sharePercent.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* City Distribution Summary Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-200 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Submissions per City (Store / Warehouse Hubs)
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Click any city to filter the Master Database for that hub.
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums text-slate-500">
            {cityRows.length} {cityRows.length === 1 ? 'location' : 'locations'}
          </span>
        </div>

        {cityRows.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">No city data available yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[640px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th scope="col" className="px-6 py-3">
                    City / Hub
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Submissions
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Contributing Recruiters
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Primary Purpose
                  </th>
                  <th scope="col" className="px-6 py-3 w-48">
                    Volume Share
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {cityRows.map((row) => (
                  <tr key={row.city} className="hover:bg-slate-50/70">
                    <td className="px-6 py-3.5">
                      <button
                        type="button"
                        onClick={() => onFilterByCity(row.city)}
                        className="font-semibold text-slate-900 hover:text-red-700 hover:underline"
                      >
                        {row.city}
                      </button>
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono font-semibold tabular-nums text-slate-900">
                      {row.totalSubmissions}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono tabular-nums text-slate-700">
                      {row.recruitersCount}
                    </td>
                    <td className="px-4 py-3.5 text-slate-700">{row.topPurpose}</td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-slate-700 rounded-full"
                            style={{ width: `${Math.min(100, Math.max(2, row.sharePercent))}%` }}
                          />
                        </div>
                        <span className="w-12 text-right font-mono text-xs tabular-nums text-slate-600">
                          {row.sharePercent.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
