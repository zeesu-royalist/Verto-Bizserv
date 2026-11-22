export enum UserRole {
  RECRUITER = 'recruiter',
  ADMIN = 'admin',
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface CandidateRecord {
  id: string;
  // Exact 9-Column Format
  submissionDate: string; // Col 1: YYYY-MM-DD
  managerName: string; // Col 2
  recruiterName: string; // Col 3
  clientName: string; // Col 4
  purpose: string; // Col 5
  candidateName: string; // Col 6
  candidateMobile: string; // Col 7
  city: string; // Col 8
  resumeUrl: string; // Col 9
  resumeFileName: string;
  resumeStoragePath: string;
  // Row-Level Isolation Metadata
  recruiter_uid: string;
  recruiter_email: string;
  // System Timestamps
  createdAtMs: number;
  updatedAtMs: number;
}

export interface CandidateFormValues {
  submissionDate: string;
  managerName: string;
  recruiterName: string;
  clientName: string;
  purpose: string;
  candidateName: string;
  candidateMobile: string;
  city: string;
  resumeUrl: string;
  resumeFileName: string;
  resumeStoragePath: string;
  assignedRecruiterUid?: string;
  assignedRecruiterEmail?: string;
}

export interface CandidateValidationErrors {
  submissionDate?: string;
  managerName?: string;
  recruiterName?: string;
  clientName?: string;
  purpose?: string;
  candidateName?: string;
  candidateMobile?: string;
  city?: string;
  resumeUrl?: string;
}

export interface CandidateFilters {
  search: string;
  recruiterUid: string; // 'all' or specific recruiter_uid
  managerName: string; // 'all' or specific manager
  clientName: string; // 'all' or specific client
  city: string; // 'all' or specific city
  purpose: string; // 'all' or specific purpose
  dateFrom: string; // YYYY-MM-DD or ''
  dateTo: string; // YYYY-MM-DD or ''
}

export interface RecruiterKpis {
  totalSubmissions: number;
  submittedToday: number;
  activeClients: number;
}

export interface AdminKpis {
  totalSubmissions: number;
  submittedToday: number;
  activeRecruiters: number;
  activeClients: number;
  activeCities: number;
}

export interface RecruiterPerformanceRow {
  recruiterUid: string;
  recruiterName: string;
  recruiterEmail: string;
  totalSubmissions: number;
  submittedToday: number;
  activeClients: number;
  citiesCovered: number;
  topCity: string;
  sharePercent: number;
}

export interface CityPerformanceRow {
  city: string;
  totalSubmissions: number;
  recruitersCount: number;
  topPurpose: string;
  sharePercent: number;
}

export interface DropdownOption {
  id: string;
  name: string;
  isActive: boolean;
  createdAtMs: number;
  updatedAtMs: number;
}

export type ActiveNavSection = 'submissions' | 'new-entry' | 'dropdowns' | 'performance' | 'users';
