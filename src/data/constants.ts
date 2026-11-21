import { CandidateRecord, DropdownOption, UserProfile, UserRole } from '../types/recruitment';

export const PURPOSE_OPTIONS: readonly string[] = [
  'Lineup',
  'Selection',
  'Joining',
  'Database',
];

export const MANAGER_SUGGESTIONS: readonly string[] = [
  'Ananya Verma',
  'Vikram Malhotra',
  'Siddharth Nair',
  'Meera Krishnan',
  'Rohan Deshmukh',
  'Kavita Joshi',
];

export const CLIENT_SUGGESTIONS: readonly string[] = [
  'Reliance Retail',
  'Flipkart Supply Chain',
  'Amazon Logistics',
  'DMart Stores',
  'Zepto Dark Stores',
  'Blinkit Fulfillment',
  'Trent Westside',
  'Delhivery Hubs',
  'Nykaa Retail',
  'Croma Electronics',
];

export function createDeterministicSeedData(todayIso: string): {
  users: UserProfile[];
  candidates: CandidateRecord[];
  managers: DropdownOption[];
  clients: DropdownOption[];
} {
  const now = Date.now();
  const yesterday = new Date(now - 86400000).toISOString().slice(0, 10);
  const twoDaysAgo = new Date(now - 2 * 86400000).toISOString().slice(0, 10);
  const fourDaysAgo = new Date(now - 4 * 86400000).toISOString().slice(0, 10);

  const managers: DropdownOption[] = MANAGER_SUGGESTIONS.map((name, idx) => ({
    id: `mgr-seed-${idx + 1}`,
    name,
    isActive: true,
    createdAtMs: now - (20 - idx) * 86400000,
    updatedAtMs: now - (20 - idx) * 86400000,
  }));

  const clients: DropdownOption[] = CLIENT_SUGGESTIONS.map((name, idx) => ({
    id: `cli-seed-${idx + 1}`,
    name,
    isActive: true,
    createdAtMs: now - (20 - idx) * 86400000,
    updatedAtMs: now - (20 - idx) * 86400000,
  }));

  const users: UserProfile[] = [
    {
      uid: 'admin-rahul-001',
      name: 'Rahul Kumar',
      email: 'rahul.kumar376603@gmail.com',
      role: UserRole.ADMIN,
      isActive: true,
      createdAtMs: now - 30 * 86400000,
      updatedAtMs: now - 86400000,
    },
    {
      uid: 'rec-priya-002',
      name: 'Priya Menon',
      email: 'priya.menon@vertobizserv.in',
      role: UserRole.RECRUITER,
      isActive: true,
      createdAtMs: now - 25 * 86400000,
      updatedAtMs: now - 2 * 86400000,
    },
    {
      uid: 'rec-arjun-003',
      name: 'Arjun Patel',
      email: 'arjun.patel@vertobizserv.in',
      role: UserRole.RECRUITER,
      isActive: true,
      createdAtMs: now - 20 * 86400000,
      updatedAtMs: now - 3 * 86400000,
    },
    {
      uid: 'rec-neha-004',
      name: 'Neha Kapoor',
      email: 'neha.kapoor@vertobizserv.in',
      role: UserRole.RECRUITER,
      isActive: true,
      createdAtMs: now - 15 * 86400000,
      updatedAtMs: now - 5 * 86400000,
    },
    {
      uid: 'rec-karan-005',
      name: 'Karan Singhania',
      email: 'karan.s@vertobizserv.in',
      role: UserRole.RECRUITER,
      isActive: false,
      createdAtMs: now - 40 * 86400000,
      updatedAtMs: now - 7 * 86400000,
    },
  ];

  const candidates: CandidateRecord[] = [
    {
      id: 'cand-1001',
      submissionDate: todayIso,
      managerName: 'Ananya Verma',
      recruiterName: 'Priya Menon',
      clientName: 'Flipkart Supply Chain',
      purpose: 'Lineup',
      candidateName: 'Deepak Sharma',
      candidateMobile: '9820145678',
      city: 'Bhiwandi',
      resumeUrl: 'https://drive.google.com/drive/folders/12xg-IyGuOFIDmoeD_jB1avsLq7_i3Jfc?usp=sharing',
      resumeFileName: 'Deepak_Sharma_Warehouse_CV.pdf',
      resumeStoragePath: 'gdrive:preview-1001',
      recruiter_uid: 'rec-priya-002',
      recruiter_email: 'priya.menon@vertobizserv.in',
      createdAtMs: now - 45 * 60000,
      updatedAtMs: now - 45 * 60000,
    },
    {
      id: 'cand-1002',
      submissionDate: todayIso,
      managerName: 'Vikram Malhotra',
      recruiterName: 'Arjun Patel',
      clientName: 'Reliance Retail',
      purpose: 'Selection',
      candidateName: 'Sneha Kulkarni',
      candidateMobile: '9765432109',
      city: 'Pune',
      resumeUrl: 'https://drive.google.com/drive/folders/12xg-IyGuOFIDmoeD_jB1avsLq7_i3Jfc?usp=sharing',
      resumeFileName: 'Sneha_Kulkarni_StoreMgr.pdf',
      resumeStoragePath: 'gdrive:preview-1002',
      recruiter_uid: 'rec-arjun-003',
      recruiter_email: 'arjun.patel@vertobizserv.in',
      createdAtMs: now - 110 * 60000,
      updatedAtMs: now - 110 * 60000,
    },
    {
      id: 'cand-1003',
      submissionDate: todayIso,
      managerName: 'Ananya Verma',
      recruiterName: 'Priya Menon',
      clientName: 'Zepto Dark Stores',
      purpose: 'Lineup',
      candidateName: 'Imran Qureshi',
      candidateMobile: '9845120987',
      city: 'Bengaluru',
      resumeUrl: '',
      resumeFileName: '',
      resumeStoragePath: '',
      recruiter_uid: 'rec-priya-002',
      recruiter_email: 'priya.menon@vertobizserv.in',
      createdAtMs: now - 180 * 60000,
      updatedAtMs: now - 180 * 60000,
    },
    {
      id: 'cand-1004',
      submissionDate: yesterday,
      managerName: 'Siddharth Nair',
      recruiterName: 'Neha Kapoor',
      clientName: 'Amazon Logistics',
      purpose: 'Joining',
      candidateName: 'Ritu Chaudhary',
      candidateMobile: '9910456723',
      city: 'Gurugram',
      resumeUrl: 'https://drive.google.com/drive/folders/12xg-IyGuOFIDmoeD_jB1avsLq7_i3Jfc?usp=sharing',
      resumeFileName: 'Ritu_Chaudhary_OpsLead.pdf',
      resumeStoragePath: 'gdrive:preview-1004',
      recruiter_uid: 'rec-neha-004',
      recruiter_email: 'neha.kapoor@vertobizserv.in',
      createdAtMs: now - 26 * 3600000,
      updatedAtMs: now - 26 * 3600000,
    },
    {
      id: 'cand-1005',
      submissionDate: yesterday,
      managerName: 'Vikram Malhotra',
      recruiterName: 'Arjun Patel',
      clientName: 'DMart Stores',
      purpose: 'Database',
      candidateName: 'Manoj Tiwari',
      candidateMobile: '9833210456',
      city: 'Mumbai',
      resumeUrl: '',
      resumeFileName: '',
      resumeStoragePath: '',
      recruiter_uid: 'rec-arjun-003',
      recruiter_email: 'arjun.patel@vertobizserv.in',
      createdAtMs: now - 30 * 3600000,
      updatedAtMs: now - 30 * 3600000,
    },
    {
      id: 'cand-1006',
      submissionDate: twoDaysAgo,
      managerName: 'Meera Krishnan',
      recruiterName: 'Priya Menon',
      clientName: 'Blinkit Fulfillment',
      purpose: 'Database',
      candidateName: 'Karthik Subramanian',
      candidateMobile: '9444109821',
      city: 'Chennai',
      resumeUrl: 'https://drive.google.com/drive/folders/12xg-IyGuOFIDmoeD_jB1avsLq7_i3Jfc?usp=sharing',
      resumeFileName: 'Karthik_S_Resume.pdf',
      resumeStoragePath: 'gdrive:preview-1006',
      recruiter_uid: 'rec-priya-002',
      recruiter_email: 'priya.menon@vertobizserv.in',
      createdAtMs: now - 52 * 3600000,
      updatedAtMs: now - 52 * 3600000,
    },
    {
      id: 'cand-1007',
      submissionDate: fourDaysAgo,
      managerName: 'Siddharth Nair',
      recruiterName: 'Neha Kapoor',
      clientName: 'Delhivery Hubs',
      purpose: 'Joining',
      candidateName: 'Sandeep Yadav',
      candidateMobile: '9811902345',
      city: 'Noida',
      resumeUrl: 'https://drive.google.com/drive/folders/12xg-IyGuOFIDmoeD_jB1avsLq7_i3Jfc?usp=sharing',
      resumeFileName: 'Sandeep_Yadav_HubSup.pdf',
      resumeStoragePath: 'gdrive:preview-1007',
      recruiter_uid: 'rec-neha-004',
      recruiter_email: 'neha.kapoor@vertobizserv.in',
      createdAtMs: now - 96 * 3600000,
      updatedAtMs: now - 96 * 3600000,
    },
  ];

  return { users, candidates, managers, clients };
}
