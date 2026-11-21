import React, { useState } from 'react';
import { Download, FileSpreadsheet, RotateCcw, Search } from 'lucide-react';
import { PURPOSE_OPTIONS } from '../data/constants';
import { CandidateFilters, CandidateRecord, UserRole } from '../types/recruitment';
import { DEFAULT_FILTERS, extractUniqueValues } from '../utils/analytics';

interface FilterBarProps {
  role: UserRole;
  filters: CandidateFilters;
  onChangeFilters: (next: CandidateFilters) => void;
  allRecords: CandidateRecord[];
  filteredRecords: CandidateRecord[];
  onExportCsv: (scope: 'filtered' | 'all') => void;
  onExportExcel: (scope: 'filtered' | 'all') => void;
}

export function FilterBar({
  role,
  filters,
  onChangeFilters,
  allRecords,
  filteredRecords,
  onExportCsv,
  onExportExcel,
}: FilterBarProps) {
  const isAdmin = role === UserRole.ADMIN;
  const [exportScope, setExportScope] = useState<'filtered' | 'all'>('filtered');

  const recruiterOptions = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const r of allRecords) {
      if (r.recruiter_uid && !map.has(r.recruiter_uid)) {
        map.set(r.recruiter_uid, r.recruiterName);
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [allRecords]);

  const managerOptions = React.useMemo(
    () => extractUniqueValues(allRecords, (r) => r.managerName),
    [allRecords]
  );
  const clientOptions = React.useMemo(
    () => extractUniqueValues(allRecords, (r) => r.clientName),
    [allRecords]
  );
  const cityOptions = React.useMemo(
    () => extractUniqueValues(allRecords, (r) => r.city),
    [allRecords]
  );
  const purposeOptions = React.useMemo(() => {
    const existing = extractUniqueValues(allRecords, (r) => r.purpose);
    const extras = existing.filter((p) => !PURPOSE_OPTIONS.includes(p));
    return [...PURPOSE_OPTIONS, ...extras];
  }, [allRecords]);

  const hasActiveFilters =
    filters.search !== '' ||
    filters.recruiterUid !== 'all' ||
    filters.managerName !== 'all' ||
    filters.clientName !== 'all' ||
    filters.city !== 'all' ||
    filters.purpose !== 'all' ||
    filters.dateFrom !== '' ||
    filters.dateTo !== '';

  const targetCount = exportScope === 'all' ? allRecords.length : filteredRecords.length;

  return (
    <section
      aria-label="Search, filters, and data export"
      className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4"
    >
      {/* Top Row: Search + Date Range + Export */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
          {/* Search Input */}
          <div className="sm:col-span-2 lg:col-span-6">
            <label
              htmlFor="filter-search"
              className="block text-xs font-medium text-slate-600 mb-1"
            >
              Search records
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="filter-search"
                type="search"
                value={filters.search}
                onChange={(e) => onChangeFilters({ ...filters, search: e.target.value })}
                placeholder="Search Candidate Name, Mobile, Client, or City..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600"
              />
            </div>
          </div>

          {/* Date From */}
          <div className="lg:col-span-3">
            <label
              htmlFor="filter-date-from"
              className="block text-xs font-medium text-slate-600 mb-1"
            >
              Date From
            </label>
            <input
              id="filter-date-from"
              type="date"
              value={filters.dateFrom}
              onChange={(e) => onChangeFilters({ ...filters, dateFrom: e.target.value })}
              className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600"
            />
          </div>

          {/* Date To */}
          <div className="lg:col-span-3">
            <label
              htmlFor="filter-date-to"
              className="block text-xs font-medium text-slate-600 mb-1"
            >
              Date To
            </label>
            <input
              id="filter-date-to"
              type="date"
              value={filters.dateTo}
              onChange={(e) => onChangeFilters({ ...filters, dateTo: e.target.value })}
              className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600"
            />
          </div>
        </div>

        {/* Export Controls */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {isAdmin && hasActiveFilters && (
            <select
              aria-label="Export dataset scope"
              value={exportScope}
              onChange={(e) => setExportScope(e.target.value as 'filtered' | 'all')}
              className="px-2.5 py-2 text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:border-red-600"
            >
              <option value="filtered">Filtered View ({filteredRecords.length})</option>
              <option value="all">Full Master ({allRecords.length})</option>
            </select>
          )}

          <button
            type="button"
            disabled={targetCount === 0}
            onClick={() => onExportCsv(isAdmin ? exportScope : 'filtered')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isAdmin ? 'Download Merged CSV' : 'Download My CSV'}</span>
          </button>

          <button
            type="button"
            disabled={targetCount === 0}
            onClick={() => onExportExcel(isAdmin ? exportScope : 'filtered')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
            <span>{isAdmin ? 'Download Merged Excel' : 'Download My Excel'}</span>
          </button>
        </div>
      </div>

      {/* Admin Facet Filter Row */}
      {isAdmin && (
        <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label
              htmlFor="filter-recruiter"
              className="block text-xs font-medium text-slate-600 mb-1"
            >
              Recruiter
            </label>
            <select
              id="filter-recruiter"
              value={filters.recruiterUid}
              onChange={(e) => onChangeFilters({ ...filters, recruiterUid: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-red-600"
            >
              <option value="all">All Recruiters</option>
              {recruiterOptions.map(([uid, name]) => (
                <option key={uid} value={uid}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="filter-manager"
              className="block text-xs font-medium text-slate-600 mb-1"
            >
              Manager Name
            </label>
            <select
              id="filter-manager"
              value={filters.managerName}
              onChange={(e) => onChangeFilters({ ...filters, managerName: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-red-600"
            >
              <option value="all">All Managers</option>
              {managerOptions.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="filter-client"
              className="block text-xs font-medium text-slate-600 mb-1"
            >
              Client Name
            </label>
            <select
              id="filter-client"
              value={filters.clientName}
              onChange={(e) => onChangeFilters({ ...filters, clientName: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-red-600"
            >
              <option value="all">All Clients</option>
              {clientOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="filter-city" className="block text-xs font-medium text-slate-600 mb-1">
              Store / Warehouse Location
            </label>
            <select
              id="filter-city"
              value={filters.city}
              onChange={(e) => onChangeFilters({ ...filters, city: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-red-600"
            >
              <option value="all">All Locations</option>
              {cityOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="filter-purpose"
              className="block text-xs font-medium text-slate-600 mb-1"
            >
              Purpose
            </label>
            <select
              id="filter-purpose"
              value={filters.purpose}
              onChange={(e) => onChangeFilters({ ...filters, purpose: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-red-600"
            >
              <option value="all">All Purposes</option>
              {purposeOptions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Results summary & clear filters */}
      <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
        <p className="tabular-nums">
          Showing <span className="font-semibold text-slate-900">{filteredRecords.length}</span> of{' '}
          <span className="font-semibold text-slate-900">{allRecords.length}</span>{' '}
          {isAdmin ? 'merged master records' : 'personal submissions'}
        </p>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => onChangeFilters({ ...DEFAULT_FILTERS })}
            className="inline-flex items-center gap-1 font-medium text-red-700 hover:text-red-900 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Filters
          </button>
        )}
      </div>
    </section>
  );
}
