import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildExportRows,
  computeAdminKpis,
  computeCityPerformance,
  computeRecruiterKpis,
  computeRecruiterPerformance,
  DEFAULT_FILTERS,
  filterCandidates,
} from './analytics';
import { createDeterministicSeedData } from '../data/constants';
import { UserRole } from '../types/recruitment';

const TODAY = '2026-11-21';
const { candidates } = createDeterministicSeedData(TODAY);

test('filterCandidates enforces strict recruiter isolation even if recruiter filter is tampered', () => {
  const recruiterPriya = { uid: 'rec-priya-002', role: UserRole.RECRUITER, isActive: true };
  const result = filterCandidates(
    candidates,
    { ...DEFAULT_FILTERS, recruiterUid: 'rec-arjun-003' },
    recruiterPriya
  );
  assert.ok(result.length > 0);
  assert.equal(
    result.every((r) => r.recruiter_uid === 'rec-priya-002'),
    true
  );
});

test('filterCandidates allows Admin to view merged database and filter by recruiter, city, and purpose', () => {
  const admin = { uid: 'admin-rahul-001', role: UserRole.ADMIN, isActive: true };
  const all = filterCandidates(candidates, DEFAULT_FILTERS, admin);
  assert.equal(all.length, candidates.length);

  const onlyArjun = filterCandidates(
    candidates,
    { ...DEFAULT_FILTERS, recruiterUid: 'rec-arjun-003' },
    admin
  );
  assert.equal(onlyArjun.length, 2);
  assert.equal(onlyArjun.every((r) => r.recruiterName === 'Arjun Patel'), true);

  const bySearch = filterCandidates(
    candidates,
    { ...DEFAULT_FILTERS, search: '9820145678' },
    admin
  );
  assert.equal(bySearch.length, 1);
  assert.equal(bySearch[0].candidateName, 'Deepak Sharma');
});

test('computeRecruiterKpis computes total, today, and unique clients accurately', () => {
  const priyaRecords = candidates.filter((c) => c.recruiter_uid === 'rec-priya-002');
  const kpis = computeRecruiterKpis(priyaRecords, TODAY);
  assert.equal(kpis.totalSubmissions, 3);
  assert.equal(kpis.submittedToday, 2);
  assert.equal(kpis.activeClients, 3);
});

test('computeAdminKpis and performance breakdowns summarize per recruiter and per city', () => {
  const adminKpis = computeAdminKpis(candidates, TODAY);
  assert.equal(adminKpis.totalSubmissions, 7);
  assert.equal(adminKpis.submittedToday, 3);
  assert.equal(adminKpis.activeRecruiters, 3);

  const recruiterBreakdown = computeRecruiterPerformance(candidates, TODAY);
  assert.equal(recruiterBreakdown.length, 3);
  assert.equal(recruiterBreakdown[0].recruiterName, 'Priya Menon');
  assert.equal(recruiterBreakdown[0].totalSubmissions, 3);

  const cityBreakdown = computeCityPerformance(candidates);
  assert.equal(cityBreakdown.length, 7);
});

test('buildExportRows preserves the exact 9-column header sequence and optional System Timestamp', () => {
  const recruiterRows = buildExportRows(candidates.slice(0, 1), false);
  assert.deepEqual(Object.keys(recruiterRows[0]), [
    'Date',
    'Manager Name',
    'Recruiter Name',
    'Client Name',
    'Purpose',
    "Candidate's Name",
    "Candidate's Mobile number",
    'Name of the city where the store/Warehouse is located',
    "Candidate's Resume (if available)",
  ]);

  const adminRows = buildExportRows(candidates.slice(0, 1), true);
  assert.equal(Object.keys(adminRows[0]).length, 10);
  assert.equal(Object.keys(adminRows[0])[9], 'System Timestamp');
});
