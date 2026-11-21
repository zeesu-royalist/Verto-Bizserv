import {
  AdminKpis,
  CandidateFilters,
  CandidateRecord,
  CityPerformanceRow,
  RecruiterKpis,
  RecruiterPerformanceRow,
  UserProfile,
  UserRole,
} from '../types/recruitment';

export const DEFAULT_FILTERS: CandidateFilters = {
  search: '',
  recruiterUid: 'all',
  managerName: 'all',
  clientName: 'all',
  city: 'all',
  purpose: 'all',
  dateFrom: '',
  dateTo: '',
};

/**
 * Applies row-level isolation (defensive layer matching Firestore Security Rules)
 * followed by search and facet filters.
 */
export function filterCandidates(
  records: CandidateRecord[],
  filters: CandidateFilters,
  currentUser: Pick<UserProfile, 'uid' | 'role' | 'isActive'>
): CandidateRecord[] {
  if (!currentUser.isActive) return [];

  const searchLower = filters.search.trim().toLowerCase();

  return records.filter((record) => {
    // Defensive row-level isolation check
    if (currentUser.role !== UserRole.ADMIN && record.recruiter_uid !== currentUser.uid) {
      return false;
    }

    if (
      currentUser.role === UserRole.ADMIN &&
      filters.recruiterUid !== 'all' &&
      record.recruiter_uid !== filters.recruiterUid
    ) {
      return false;
    }

    if (filters.managerName !== 'all' && record.managerName !== filters.managerName) {
      return false;
    }

    if (filters.clientName !== 'all' && record.clientName !== filters.clientName) {
      return false;
    }

    if (filters.city !== 'all' && record.city !== filters.city) {
      return false;
    }

    if (filters.purpose !== 'all' && record.purpose !== filters.purpose) {
      return false;
    }

    if (filters.dateFrom && record.submissionDate < filters.dateFrom) {
      return false;
    }

    if (filters.dateTo && record.submissionDate > filters.dateTo) {
      return false;
    }

    if (searchLower) {
      const haystack = [
        record.candidateName,
        record.candidateMobile,
        record.clientName,
        record.city,
        record.managerName,
        record.recruiterName,
        record.purpose,
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(searchLower)) {
        return false;
      }
    }

    return true;
  });
}

export function computeRecruiterKpis(
  records: CandidateRecord[],
  todayIso: string
): RecruiterKpis {
  let submittedToday = 0;
  const clients = new Set<string>();

  for (const r of records) {
    if (r.submissionDate === todayIso) {
      submittedToday += 1;
    }
    if (r.clientName.trim()) {
      clients.add(r.clientName.trim().toLowerCase());
    }
  }

  return {
    totalSubmissions: records.length,
    submittedToday,
    activeClients: clients.size,
  };
}

export function computeAdminKpis(
  records: CandidateRecord[],
  todayIso: string
): AdminKpis {
  let submittedToday = 0;
  const recruiters = new Set<string>();
  const clients = new Set<string>();
  const cities = new Set<string>();

  for (const r of records) {
    if (r.submissionDate === todayIso) {
      submittedToday += 1;
    }
    if (r.recruiter_uid) recruiters.add(r.recruiter_uid);
    if (r.clientName.trim()) clients.add(r.clientName.trim().toLowerCase());
    if (r.city.trim()) cities.add(r.city.trim().toLowerCase());
  }

  return {
    totalSubmissions: records.length,
    submittedToday,
    activeRecruiters: recruiters.size,
    activeClients: clients.size,
    activeCities: cities.size,
  };
}

export function computeRecruiterPerformance(
  records: CandidateRecord[],
  todayIso: string
): RecruiterPerformanceRow[] {
  const totalAll = records.length;
  const grouped = new Map<
    string,
    {
      recruiterUid: string;
      recruiterName: string;
      recruiterEmail: string;
      total: number;
      today: number;
      clients: Set<string>;
      cityCounts: Map<string, number>;
    }
  >();

  for (const r of records) {
    const key = r.recruiter_uid || r.recruiterName;
    let entry = grouped.get(key);
    if (!entry) {
      entry = {
        recruiterUid: r.recruiter_uid,
        recruiterName: r.recruiterName,
        recruiterEmail: r.recruiter_email,
        total: 0,
        today: 0,
        clients: new Set<string>(),
        cityCounts: new Map<string, number>(),
      };
      grouped.set(key, entry);
    }

    entry.total += 1;
    if (r.submissionDate === todayIso) entry.today += 1;
    if (r.clientName.trim()) entry.clients.add(r.clientName.trim().toLowerCase());
    if (r.city.trim()) {
      const cityName = r.city.trim();
      entry.cityCounts.set(cityName, (entry.cityCounts.get(cityName) ?? 0) + 1);
    }
  }

  return Array.from(grouped.values())
    .map((entry) => {
      let topCity = '—';
      let topCityCount = 0;
      for (const [city, count] of entry.cityCounts.entries()) {
        if (count > topCityCount) {
          topCity = city;
          topCityCount = count;
        }
      }
      return {
        recruiterUid: entry.recruiterUid,
        recruiterName: entry.recruiterName,
        recruiterEmail: entry.recruiterEmail,
        totalSubmissions: entry.total,
        submittedToday: entry.today,
        activeClients: entry.clients.size,
        citiesCovered: entry.cityCounts.size,
        topCity,
        sharePercent: totalAll > 0 ? Math.round((entry.total / totalAll) * 1000) / 10 : 0,
      };
    })
    .sort((a, b) => b.totalSubmissions - a.totalSubmissions || a.recruiterName.localeCompare(b.recruiterName));
}

export function computeCityPerformance(records: CandidateRecord[]): CityPerformanceRow[] {
  const totalAll = records.length;
  const grouped = new Map<
    string,
    {
      city: string;
      total: number;
      recruiters: Set<string>;
      purposeCounts: Map<string, number>;
    }
  >();

  for (const r of records) {
    const cityLabel = r.city.trim() || 'Unspecified';
    let entry = grouped.get(cityLabel);
    if (!entry) {
      entry = {
        city: cityLabel,
        total: 0,
        recruiters: new Set<string>(),
        purposeCounts: new Map<string, number>(),
      };
      grouped.set(cityLabel, entry);
    }

    entry.total += 1;
    entry.recruiters.add(r.recruiter_uid || r.recruiterName);
    const purpose = r.purpose.trim() || 'Other';
    entry.purposeCounts.set(purpose, (entry.purposeCounts.get(purpose) ?? 0) + 1);
  }

  return Array.from(grouped.values())
    .map((entry) => {
      let topPurpose = '—';
      let topCount = 0;
      for (const [purpose, count] of entry.purposeCounts.entries()) {
        if (count > topCount) {
          topPurpose = purpose;
          topCount = count;
        }
      }
      return {
        city: entry.city,
        totalSubmissions: entry.total,
        recruitersCount: entry.recruiters.size,
        topPurpose,
        sharePercent: totalAll > 0 ? Math.round((entry.total / totalAll) * 1000) / 10 : 0,
      };
    })
    .sort((a, b) => b.totalSubmissions - a.totalSubmissions || a.city.localeCompare(b.city));
}

export function formatSystemTimestamp(ms: number): string {
  if (!ms) return '—';
  const d = new Date(ms);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

export function buildExportRows(
  records: CandidateRecord[],
  includeSystemTimestamp: boolean
): Record<string, string>[] {
  return records.map((r) => {
    const base: Record<string, string> = {
      Date: r.submissionDate,
      'Manager Name': r.managerName,
      'Recruiter Name': r.recruiterName,
      'Client Name': r.clientName,
      Purpose: r.purpose,
      "Candidate's Name": r.candidateName,
      "Candidate's Mobile number": r.candidateMobile,
      'Name of the city where the store/Warehouse is located': r.city,
      "Candidate's Resume (if available)": r.resumeUrl || '',
    };
    if (includeSystemTimestamp) {
      base['System Timestamp'] = formatSystemTimestamp(r.createdAtMs);
    }
    return base;
  });
}

export function extractUniqueValues(
  records: CandidateRecord[],
  selector: (r: CandidateRecord) => string
): string[] {
  const set = new Set<string>();
  for (const r of records) {
    const val = selector(r).trim();
    if (val) set.add(val);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}
