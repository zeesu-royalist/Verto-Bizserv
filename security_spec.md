# Security Specification — HireLedger Recruitment RBAC

## 1. Data Invariants

1. **Strict Recruiter Row-Level Isolation**: A user with `role == "recruiter"` may ONLY read (`get` / `list`), create, update, or delete `/candidates/{candidateId}` documents where `recruiter_uid == request.auth.uid` and their user profile has `isActive == true`.
2. **Admin Master Database Access**: A user with `role == "admin"` and `isActive == true` (or the verified bootstrapped admin email `rahul.kumar376603@gmail.com`) can read, list, create, update, and delete across all `/candidates/{candidateId}` records and manage user roles/status in `/users/{userId}`.
3. **Anti-Spoofing Identity Lock**:
   - Recruiters cannot create a candidate record with another user's `recruiter_uid`, `recruiter_email`, or `recruiterName`.
   - Recruiters cannot reassign `recruiter_uid`, `recruiter_email`, or `recruiterName` during updates.
4. **No Self-Privilege Escalation**:
   - During self-registration on `/users/{userId}`, a user cannot assign `role: "admin"` unless their verified token email matches the bootstrapped admin email.
   - Users cannot modify their own `role` or `isActive` fields.
5. **Deactivation Revocation**: When an admin sets `isActive: false` on a user document, that user immediately loses read/write access to `/candidates/{candidateId}` and profile mutations.
6. **Strict Schema & Field Validation**:
   - `candidateName` must match `^[A-Za-z ]+$` (letters and spaces only, 1–100 chars).
   - `candidateMobile` must match `^[0-9]{10}$` (exactly 10 numeric digits).
   - `submissionDate` must match `^[0-9]{4}-[0-9]{2}-[0-9]{2}$`.
   - `resumeUrl` must be empty string `""` or start with `https://` / `http://` (<= 2000 chars), blocking `javascript:` XSS URIs.
   - No shadow/extra fields are allowed on any create or update (`hasOnly` + `affectedKeys().hasOnly()`).
   - `createdAt` is immutable and strictly equal to `request.time` on create; `updatedAt` equals `request.time` on create and update.

## 2. The "Dirty Dozen" Adversarial Payloads (All Must Fail with PERMISSION_DENIED)

1. **Cross-Recruiter Read (`get`)**: Recruiter A requests `/candidates/{candidateOfRecruiterB}` -> DENIED.
2. **Unfiltered Recruiter List (`list`)**: Recruiter A executes `getDocs(collection(db, 'candidates'))` without `where('recruiter_uid', '==', uidA)` -> DENIED.
3. **Recruiter UID Spoofing on Create**: Recruiter A creates a candidate with `recruiter_uid: uidB` -> DENIED.
4. **Recruiter Name Spoofing on Create**: Recruiter A creates a candidate with `recruiter_uid: uidA` but `recruiterName: "Other Recruiter"` -> DENIED.
5. **Self-Admin Promotion on Registration**: New user signs up and writes `/users/{uid}` with `role: "admin"` -> DENIED.
6. **Self-Admin Escalation on Update**: Existing recruiter updates `/users/{uid}` changing `role` to `"admin"` -> DENIED.
7. **Shadow Field Injection**: Recruiter creates/updates candidate with extra field `isApproved: true` -> DENIED.
8. **Candidate Name Validation Bypass**: Create candidate with `candidateName: "John123!"` -> DENIED.
9. **Candidate Mobile Validation Bypass**: Create candidate with `candidateMobile: "98765"` or `"987654321a"` -> DENIED.
10. **XSS Resume URL Injection**: Create candidate with `resumeUrl: "javascript:alert(1)"` -> DENIED.
11. **Deactivated Recruiter Mutation**: User with `isActive: false` attempts to create or update a candidate -> DENIED.
12. **Unverified Email Spoof**: Request with `email: "rahul.kumar376603@gmail.com"` and `email_verified: false` attempts admin read/write -> DENIED.
