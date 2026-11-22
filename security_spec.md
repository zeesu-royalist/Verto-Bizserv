# Security Specification — Verto Bizserv (Google Sheets & Apps Script Architecture)

## 1. Data Invariants & Access Control

1. **Strict Recruiter Row-Level Isolation**:
   - A user with `role == "recruiter"` can ONLY read (`getCandidates`), update, or delete records where `recruiter_email == sessionUser.email` and `isActive == true`.
   - Cross-recruiter reads and mutations are blocked by the Google Apps Script backend with HTTP 403.
2. **Admin Master Database Access**:
   - A user with `role == "admin"` and `isActive == true` can read all rows across all recruiters, manage dropdown options, and update user statuses.
3. **Anti-Spoofing Identity Lock**:
   - The backend locks `recruiter_uid`, `recruiter_email`, and `recruiterName` on candidate creation directly from the verified HMAC-signed session token.
4. **Password Hashing & Token Verification**:
   - Passwords are salted with unique 16-byte random salts and hashed via SHA-256 before storing in the `Users` sheet.
   - Session tokens are signed via HMAC-SHA256 with an automatically generated persistent secret key.
   - Any token tampering or expiration triggers immediate rejection (HTTP 401).
5. **Simultaneous Submissions & Concurrency Mutex**:
   - All Google Sheet mutations acquire `LockService.getScriptLock()` with a 15-second timeout, preventing race conditions or cell collisions.
6. **Resume File Security**:
   - Uploads to Google Drive are restricted to `.pdf`, `.doc`, and `.docx` extensions with a 5 MB size cap.
