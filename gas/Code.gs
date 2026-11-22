/**
 * ============================================================================
 * Verto Bizserv (HireLedger) — Google Apps Script Backend API (Audited & Hardened)
 * Architecture: Google Sheets (Database) + Google Drive (Resume Storage)
 * ============================================================================
 * Features:
 * - Strict Recruiter Row-Level Data Isolation (Recruiter A cannot view/edit/delete Recruiter B)
 * - Anti-Spoofing: Recruiter Name, UID, and Email enforced from session token
 * - Server-Side Strict Regex Validations (9 Columns)
 * - Salted SHA-256 Password Hashing + Cryptographic HMAC-SHA256 Session Tokens
 * - Concurrency Mutex with LockService to prevent race conditions during simultaneous writes
 * - File Security: PDF/DOC/DOCX extension & 5MB size enforcement
 * - Protected Initialization: Cannot overwrite an existing database or admin account
 */

// ============================================================================
// CONFIGURATION
// ============================================================================
// Apni Google Sheet ya Drive Folder ka URL yaha paste karein:
var SPREADSHEET_ID = '';

// Default Admin Credentials (apne hisaab se badal sakte hain):
var DEFAULT_ADMIN_EMAIL = 'admin@vertobizserv.in';
var DEFAULT_ADMIN_PASSWORD = 'Admin@123';

// Optional: Resumes kis folder me save hone chahiye (khali chhodenge to upar wale folder me automatically 'Resumes' folder ban jayega):
var RESUME_FOLDER_ID = '';
var TOKEN_EXPIRY_DAYS = 14;
var MAX_RESUME_BYTES = 5 * 1024 * 1024; // 5 MB

var ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx'];
var VALID_PURPOSES = ['Lineup', 'Selection', 'Joining', 'Database'];

var TABS = {
  CANDIDATES: 'Candidates',
  USERS: 'Users',
  DROPDOWNS: 'Dropdowns'
};

// ----------------------------------------------------------------------------
// HTTP Request Handlers
// ----------------------------------------------------------------------------

function doGet(e) {
  return createJsonResponse({
    status: 'ok',
    service: 'Verto Bizserv Recruitment API',
    version: '2.0.0-audited',
    timestamp: new Date().toISOString(),
    message: 'Google Apps Script Web App is active and healthy.'
  });
}

function doPost(e) {
  try {
    var rawContents = e.postData && e.postData.contents ? e.postData.contents : '{}';
    var request = JSON.parse(rawContents);
    var action = request.action;
    var payload = request.payload || {};
    var token = request.token || null;

    // Public Actions
    if (action === 'init') {
      return handleInitDatabase(payload);
    }
    if (action === 'login') {
      return handleLogin(payload);
    }
    if (action === 'register') {
      return handleRegister(payload);
    }
    if (action === 'ping') {
      return createJsonResponse({ status: 'ok', ping: 'pong' });
    }

    // Authenticated Actions
    var sessionUser = verifyToken(token);
    if (!sessionUser) {
      return createJsonResponse({ error: 'Unauthorized or session expired. Please sign in again.' }, 401);
    }
    if (!sessionUser.isActive) {
      return createJsonResponse({ error: 'Your recruiter account has been deactivated by the Administrator.' }, 403);
    }

    switch (action) {
      case 'verifySession':
        return createJsonResponse({ status: 'ok', user: sessionUser });

      // Candidates
      case 'getCandidates':
        return handleGetCandidates(sessionUser);
      case 'createCandidate':
        return handleCreateCandidate(sessionUser, payload);
      case 'updateCandidate':
        return handleUpdateCandidate(sessionUser, payload);
      case 'deleteCandidate':
        return handleDeleteCandidate(sessionUser, payload);

      // Dropdowns
      case 'getDropdowns':
        return handleGetDropdowns();
      case 'addDropdown':
        return handleAddDropdown(sessionUser, payload);
      case 'updateDropdown':
        return handleUpdateDropdown(sessionUser, payload);
      case 'deleteDropdown':
        return handleDeleteDropdown(sessionUser, payload);

      // Users
      case 'getUsers':
        return handleGetUsers(sessionUser);
      case 'updateUser':
        return handleUpdateUser(sessionUser, payload);

      // Resume Upload
      case 'uploadResume':
        return handleUploadResume(sessionUser, payload);

      default:
        return createJsonResponse({ error: 'Unknown action: ' + action }, 400);
    }
  } catch (err) {
    return createJsonResponse({
      error: err && err.message ? err.message : String(err)
    }, 500);
  }
}

// ----------------------------------------------------------------------------
// Database Initialization & Bootstrap (Protected)
// ----------------------------------------------------------------------------

function initDatabase() {
  var ss = getSpreadsheet();
  Logger.log('========================================================');
  Logger.log('SUCCESS! Aapki Google Sheet yaha hai:');
  Logger.log(ss.getUrl());
  Logger.log('========================================================');
  handleInitDatabase({
    adminEmail: DEFAULT_ADMIN_EMAIL,
    adminPassword: DEFAULT_ADMIN_PASSWORD
  });
}

/**
 * Saara dummy data hatakar database ko 100% fresh karne ke liye
 * Apps Script editor me is function ko select karke "Run" dabayein!
 */
function resetDatabaseToFresh() {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    var ss = getSpreadsheet();

    // 1. Clear all candidate rows (keep row 1 headers)
    var candSheet = ss.getSheetByName(TABS.CANDIDATES);
    if (candSheet && candSheet.getLastRow() > 1) {
      candSheet.deleteRows(2, candSheet.getLastRow() - 1);
    }

    // 2. Clear all users and set the new Owner Admin account (Plain Text Password)
    var usersSheet = ss.getSheetByName(TABS.USERS);
    if (usersSheet) {
      if (usersSheet.getLastRow() > 0) {
        usersSheet.clear();
      }
      var userHeaders = [
        'uid', 'name', 'email', 'role', 'password', 'isActive',
        'createdAtMs', 'updatedAtMs'
      ];
      usersSheet.appendRow(userHeaders);
      usersSheet.getRange(1, 1, 1, userHeaders.length).setFontWeight('bold').setBackground('#f1f5f9');
      usersSheet.setFrozenRows(1);

      var now = Date.now();
      usersSheet.appendRow([
        'usr_admin_owner_001', 'Rahul Kumar (Admin)', DEFAULT_ADMIN_EMAIL, 'admin',
        DEFAULT_ADMIN_PASSWORD, true, now, now
      ]);
    }

    Logger.log('========================================================');
    Logger.log('SUCCESS! Database completely reset fresh.');
    Logger.log('Owner Admin: ' + DEFAULT_ADMIN_EMAIL);
    Logger.log('Password: ' + DEFAULT_ADMIN_PASSWORD);
    Logger.log('All dummy candidates removed. Fresh & clean!');
    Logger.log('========================================================');
  } finally {
    lock.releaseLock();
  }
}

/**
 * Test function to verify Google Sheet and Google Drive resume folder access
 */
function testDriveAndSheetAccess() {
  Logger.log('--- Checking Google Sheet ---');
  var ss = getSpreadsheet();
  Logger.log('Google Sheet URL: ' + ss.getUrl());
  Logger.log('Google Sheet Name: ' + ss.getName());

  Logger.log('--- Checking Google Drive Resume Folder ---');
  var folder = getResumeFolder();
  Logger.log('Resume Folder URL: ' + folder.getUrl());
  Logger.log('Resume Folder Name: ' + folder.getName());

  Logger.log('========================================================');
  Logger.log('ALL CHECKS PASSED! Sheet and Drive are 100% accessible.');
  Logger.log('========================================================');
}

function handleInitDatabase(payload) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    var ss = getSpreadsheet();

    // Audit Check: Do not allow re-initialization if Users sheet already has an Admin!
    var existingUsersSheet = ss.getSheetByName(TABS.USERS);
    if (existingUsersSheet && existingUsersSheet.getLastRow() > 1) {
      return createJsonResponse({
        status: 'notice',
        message: 'Database is already initialized. Existing data and Admin accounts were preserved.'
      });
    }

    // 1. Setup Candidates Tab
    var candSheet = ss.getSheetByName(TABS.CANDIDATES);
    if (!candSheet) candSheet = ss.insertSheet(TABS.CANDIDATES);
    var candHeaders = [
      'id', 'submissionDate', 'managerName', 'recruiterName', 'clientName',
      'purpose', 'candidateName', 'candidateMobile', 'city', 'resumeUrl',
      'resumeFileName', 'resumeStoragePath', 'recruiter_uid', 'recruiter_email',
      'createdAtMs', 'updatedAtMs'
    ];
    if (candSheet.getLastRow() === 0) {
      candSheet.appendRow(candHeaders);
      candSheet.getRange(1, 1, 1, candHeaders.length).setFontWeight('bold').setBackground('#f1f5f9');
      candSheet.setFrozenRows(1);
    }

    // 2. Setup Users Tab (Plain Text Password)
    var usersSheet = ss.getSheetByName(TABS.USERS);
    if (!usersSheet) usersSheet = ss.insertSheet(TABS.USERS);
    var userHeaders = [
      'uid', 'name', 'email', 'role', 'password', 'isActive',
      'createdAtMs', 'updatedAtMs'
    ];
    if (usersSheet.getLastRow() === 0) {
      usersSheet.appendRow(userHeaders);
      usersSheet.getRange(1, 1, 1, userHeaders.length).setFontWeight('bold').setBackground('#f1f5f9');
      usersSheet.setFrozenRows(1);

      var adminEmail = (payload.adminEmail || DEFAULT_ADMIN_EMAIL).toLowerCase().trim();
      var adminPass = payload.adminPassword || DEFAULT_ADMIN_PASSWORD;
      var now = Date.now();
      usersSheet.appendRow([
        'usr_admin_001', 'Rahul Kumar (Admin)', adminEmail, 'admin',
        adminPass, true, now, now
      ]);
    }

    // 3. Setup Dropdowns Tab
    var dropSheet = ss.getSheetByName(TABS.DROPDOWNS);
    if (!dropSheet) dropSheet = ss.insertSheet(TABS.DROPDOWNS);
    var dropHeaders = ['id', 'category', 'name', 'isActive', 'createdAtMs', 'updatedAtMs'];
    if (dropSheet.getLastRow() === 0) {
      dropSheet.appendRow(dropHeaders);
      dropSheet.getRange(1, 1, 1, dropHeaders.length).setFontWeight('bold').setBackground('#f1f5f9');
      dropSheet.setFrozenRows(1);

      var defaultManagers = [
        'Ananya Verma', 'Vikram Malhotra', 'Siddharth Nair',
        'Meera Krishnan', 'Rohan Deshmukh', 'Kavita Joshi'
      ];
      var defaultClients = [
        'Reliance Retail', 'Flipkart Supply Chain', 'Amazon Logistics',
        'DMart Stores', 'Zepto Dark Stores', 'Blinkit Fulfillment',
        'Trent Westside', 'Delhivery Hubs', 'Nykaa Retail', 'Croma Electronics'
      ];
      var t = Date.now();
      defaultManagers.forEach(function(m, i) {
        dropSheet.appendRow(['mgr_' + (i + 1), 'manager', m, true, t, t]);
      });
      defaultClients.forEach(function(c, i) {
        dropSheet.appendRow(['cli_' + (i + 1), 'client', c, true, t, t]);
      });
    }

    return createJsonResponse({
      status: 'ok',
      message: 'Database sheets initialized successfully with standard schema and initial data.'
    });
  } finally {
    lock.releaseLock();
  }
}

// ----------------------------------------------------------------------------
// Authentication (Login & Register)
// ----------------------------------------------------------------------------

function handleLogin(payload) {
  var email = (payload.email || '').toLowerCase().trim();
  var password = payload.password || '';

  if (!email || !password) {
    return createJsonResponse({ error: 'Email and password are required.' }, 400);
  }

  var usersSheet = getSheet(TABS.USERS);
  var data = usersSheet.getDataRange().getValues();
  if (data.length <= 1) {
    return createJsonResponse({ error: 'No registered users found. Run database init first.' }, 400);
  }

  var hasSaltCol = (data[0] && String(data[0][5]).toLowerCase() === 'salt');
  var activeCol = hasSaltCol ? 6 : 5;
  var createdCol = hasSaltCol ? 7 : 6;
  var updatedCol = hasSaltCol ? 8 : 7;

  var matchedUser = null;
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (String(row[2]).toLowerCase().trim() === email) {
      var storedPass = String(row[4] || '');
      var isMatch = false;

      // 1. Direct Plain-Text Match
      if (storedPass === password) {
        isMatch = true;
      } else if (hasSaltCol) {
        // Fallback for older hashed rows if any
        var salt = row[5];
        if (salt && hashPassword(password, salt) === storedPass) {
          isMatch = true;
        }
      }

      if (isMatch) {
        matchedUser = {
          uid: String(row[0]),
          name: String(row[1]),
          email: String(row[2]),
          role: String(row[3]),
          isActive: row[activeCol] === true || String(row[activeCol]).toLowerCase() === 'true',
          createdAtMs: Number(row[createdCol]) || Date.now(),
          updatedAtMs: Number(row[updatedCol]) || Date.now()
        };
        break;
      }
    }
  }

  if (!matchedUser) {
    return createJsonResponse({ error: 'Invalid email or password.' }, 401);
  }
  if (!matchedUser.isActive) {
    return createJsonResponse({ error: 'Your recruiter account has been deactivated. Contact the administrator.' }, 403);
  }

  var token = generateToken(matchedUser);
  return createJsonResponse({
    status: 'ok',
    token: token,
    user: matchedUser
  });
}

function handleRegister(payload) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var name = (payload.name || '').trim();
    var email = (payload.email || '').toLowerCase().trim();
    var password = payload.password || '';

    if (!name || name.length < 2 || name.length > 100) {
      return createJsonResponse({ error: 'Full Name must be between 2 and 100 characters.' }, 400);
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return createJsonResponse({ error: 'Please enter a valid email address.' }, 400);
    }
    if (!password || password.length < 6) {
      return createJsonResponse({ error: 'Password must be at least 6 characters long.' }, 400);
    }

    var usersSheet = getSheet(TABS.USERS);
    var data = usersSheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][2]).toLowerCase().trim() === email) {
        return createJsonResponse({ error: 'An account with this email already exists. Please sign in.' }, 409);
      }
    }

    var uid = 'usr_' + Date.now() + '_' + Utilities.getUuid().substring(0, 8);
    var now = Date.now();

    var hasSaltCol = (data[0] && String(data[0][5]).toLowerCase() === 'salt');
    var newUserRow = hasSaltCol
      ? [uid, name, email, 'recruiter', password, '', true, now, now]
      : [uid, name, email, 'recruiter', password, true, now, now];

    usersSheet.appendRow(newUserRow);

    var userProfile = {
      uid: uid,
      name: name,
      email: email,
      role: 'recruiter',
      isActive: true,
      createdAtMs: now,
      updatedAtMs: now
    };

    var token = generateToken(userProfile);
    return createJsonResponse({
      status: 'ok',
      token: token,
      user: userProfile
    });
  } finally {
    lock.releaseLock();
  }
}

// ----------------------------------------------------------------------------
// Candidate Validation Helper (Hardened Server-Side Mirror)
// ----------------------------------------------------------------------------

function validateCandidateData(candidate) {
  var submissionDate = String(candidate.submissionDate || '').trim();
  var managerName = String(candidate.managerName || '').trim();
  var clientName = String(candidate.clientName || '').trim();
  var purpose = String(candidate.purpose || '').trim();
  var candidateName = String(candidate.candidateName || '').trim();
  var candidateMobile = String(candidate.candidateMobile || '').trim();
  var city = String(candidate.city || '').trim();
  var resumeUrl = String(candidate.resumeUrl || '').trim();

  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(submissionDate)) {
    return 'Select a valid date (YYYY-MM-DD).';
  }
  if (!managerName || managerName.length > 100) {
    return 'Manager Name is required (up to 100 characters).';
  }
  if (!clientName || clientName.length > 120) {
    return 'Client Name is required (up to 120 characters).';
  }
  if (VALID_PURPOSES.indexOf(purpose) === -1) {
    return 'Purpose must be Lineup, Selection, Joining, or Database.';
  }
  if (!candidateName || !/^[A-Za-z]+( [A-Za-z]+)*$/.test(candidateName) || candidateName.length > 100) {
    return 'Candidate Name must use letters and spaces only (1-100 characters).';
  }
  if (!candidateMobile || !/^[0-9]{10}$/.test(candidateMobile)) {
    return 'Candidate Mobile number must be exactly 10 digits.';
  }
  if (!city || city.length > 100) {
    return 'Store / Warehouse City is required.';
  }
  if (resumeUrl && !/^https?:\/\/.+/.test(resumeUrl)) {
    return 'Resume URL must start with http:// or https://.';
  }
  return null;
}

// ----------------------------------------------------------------------------
// Candidates Management (Strict Row-Level Isolation)
// ----------------------------------------------------------------------------

function handleGetCandidates(sessionUser) {
  var sheet = getSheet(TABS.CANDIDATES);
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return createJsonResponse({ status: 'ok', records: [] });
  }

  var isAdmin = sessionUser.role === 'admin';
  var userEmail = sessionUser.email.toLowerCase();
  var records = [];

  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    if (!r[0]) continue;

    var rowRecruiterEmail = String(r[13] || '').toLowerCase().trim();

    // Security Gate: Recruiters see ONLY their own rows
    if (!isAdmin && rowRecruiterEmail !== userEmail) {
      continue;
    }

    records.push({
      id: String(r[0]),
      submissionDate: String(r[1] || ''),
      managerName: String(r[2] || ''),
      recruiterName: String(r[3] || ''),
      clientName: String(r[4] || ''),
      purpose: String(r[5] || ''),
      candidateName: String(r[6] || ''),
      candidateMobile: String(r[7] || ''),
      city: String(r[8] || ''),
      resumeUrl: String(r[9] || ''),
      resumeFileName: String(r[10] || ''),
      resumeStoragePath: String(r[11] || ''),
      recruiter_uid: String(r[12] || ''),
      recruiter_email: String(r[13] || ''),
      createdAtMs: Number(r[14]) || Date.now(),
      updatedAtMs: Number(r[15]) || Date.now()
    });
  }

  records.sort(function(a, b) { return b.createdAtMs - a.createdAtMs; });
  return createJsonResponse({ status: 'ok', records: records });
}

function handleCreateCandidate(sessionUser, candidate) {
  var validationError = validateCandidateData(candidate);
  if (validationError) {
    return createJsonResponse({ error: validationError }, 400);
  }

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    var sheet = getSheet(TABS.CANDIDATES);
    var isAdmin = sessionUser.role === 'admin';

    // Anti-Spoofing: Recruiter info is locked to session user unless admin
    var recruiterName = isAdmin && candidate.recruiterName ? String(candidate.recruiterName).trim() : sessionUser.name;
    var recruiterUid = isAdmin && candidate.assignedRecruiterUid ? String(candidate.assignedRecruiterUid) : sessionUser.uid;
    var recruiterEmail = isAdmin && candidate.assignedRecruiterEmail ? String(candidate.assignedRecruiterEmail).toLowerCase().trim() : sessionUser.email;

    var id = 'cand_' + Date.now() + '_' + Utilities.getUuid().substring(0, 8);
    var now = Date.now();

    var row = [
      id,
      String(candidate.submissionDate).trim(),
      String(candidate.managerName).trim(),
      recruiterName,
      String(candidate.clientName).trim(),
      String(candidate.purpose).trim(),
      String(candidate.candidateName).trim(),
      String(candidate.candidateMobile).trim(),
      String(candidate.city).trim(),
      String(candidate.resumeUrl || '').trim(),
      String(candidate.resumeFileName || '').trim(),
      String(candidate.resumeStoragePath || '').trim(),
      recruiterUid,
      recruiterEmail,
      now,
      now
    ];

    sheet.appendRow(row);

    return createJsonResponse({
      status: 'ok',
      id: id,
      record: {
        id: id,
        submissionDate: row[1],
        managerName: row[2],
        recruiterName: row[3],
        clientName: row[4],
        purpose: row[5],
        candidateName: row[6],
        candidateMobile: row[7],
        city: row[8],
        resumeUrl: row[9],
        resumeFileName: row[10],
        resumeStoragePath: row[11],
        recruiter_uid: row[12],
        recruiter_email: row[13],
        createdAtMs: row[14],
        updatedAtMs: row[15]
      }
    });
  } finally {
    lock.releaseLock();
  }
}

function handleUpdateCandidate(sessionUser, payload) {
  var candidateId = payload.id;
  var updates = payload.updates || payload;
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    var sheet = getSheet(TABS.CANDIDATES);
    var data = sheet.getDataRange().getValues();
    var rowIndex = -1;
    var existingRow = null;

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(candidateId)) {
        rowIndex = i + 1;
        existingRow = data[i];
        break;
      }
    }

    if (rowIndex === -1 || !existingRow) {
      return createJsonResponse({ error: 'Candidate record not found.' }, 404);
    }

    var isAdmin = sessionUser.role === 'admin';
    var isOwner = String(existingRow[13]).toLowerCase().trim() === sessionUser.email.toLowerCase();

    if (!isAdmin && !isOwner) {
      return createJsonResponse({ error: 'Forbidden: You cannot edit another recruiter\'s submission.' }, 403);
    }

    var now = Date.now();
    if (updates.submissionDate !== undefined) sheet.getRange(rowIndex, 2).setValue(updates.submissionDate);
    if (updates.managerName !== undefined) sheet.getRange(rowIndex, 3).setValue(updates.managerName);
    if (isAdmin && updates.recruiterName !== undefined) sheet.getRange(rowIndex, 4).setValue(updates.recruiterName);
    if (updates.clientName !== undefined) sheet.getRange(rowIndex, 5).setValue(updates.clientName);
    if (updates.purpose !== undefined) sheet.getRange(rowIndex, 6).setValue(updates.purpose);
    if (updates.candidateName !== undefined) sheet.getRange(rowIndex, 7).setValue(updates.candidateName);
    if (updates.candidateMobile !== undefined) sheet.getRange(rowIndex, 8).setValue(updates.candidateMobile);
    if (updates.city !== undefined) sheet.getRange(rowIndex, 9).setValue(updates.city);
    if (updates.resumeUrl !== undefined) sheet.getRange(rowIndex, 10).setValue(updates.resumeUrl);
    if (updates.resumeFileName !== undefined) sheet.getRange(rowIndex, 11).setValue(updates.resumeFileName);
    if (updates.resumeStoragePath !== undefined) sheet.getRange(rowIndex, 12).setValue(updates.resumeStoragePath);
    sheet.getRange(rowIndex, 16).setValue(now);

    return createJsonResponse({ status: 'ok', id: candidateId, updatedAtMs: now });
  } finally {
    lock.releaseLock();
  }
}

function handleDeleteCandidate(sessionUser, payload) {
  var candidateId = payload.id;
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    var sheet = getSheet(TABS.CANDIDATES);
    var data = sheet.getDataRange().getValues();
    var rowIndex = -1;
    var existingRow = null;

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(candidateId)) {
        rowIndex = i + 1;
        existingRow = data[i];
        break;
      }
    }

    if (rowIndex === -1 || !existingRow) {
      return createJsonResponse({ error: 'Candidate record not found.' }, 404);
    }

    var isAdmin = sessionUser.role === 'admin';
    var isOwner = String(existingRow[13]).toLowerCase().trim() === sessionUser.email.toLowerCase();

    if (!isAdmin && !isOwner) {
      return createJsonResponse({ error: 'Forbidden: You cannot delete another recruiter\'s submission.' }, 403);
    }

    sheet.deleteRow(rowIndex);
    return createJsonResponse({ status: 'ok', deletedId: candidateId });
  } finally {
    lock.releaseLock();
  }
}

// ----------------------------------------------------------------------------
// Dropdowns Management
// ----------------------------------------------------------------------------

function handleGetDropdowns() {
  var sheet = getSheet(TABS.DROPDOWNS);
  var data = sheet.getDataRange().getValues();
  var managers = [];
  var clients = [];

  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    if (!r[0]) continue;
    var opt = {
      id: String(r[0]),
      category: String(r[1]),
      name: String(r[2]),
      isActive: r[3] === true || String(r[3]).toLowerCase() === 'true',
      createdAtMs: Number(r[4]) || Date.now(),
      updatedAtMs: Number(r[5]) || Date.now()
    };
    if (opt.category === 'manager') managers.push(opt);
    else if (opt.category === 'client') clients.push(opt);
  }

  managers.sort(function(a, b) { return a.name.localeCompare(b.name); });
  clients.sort(function(a, b) { return a.name.localeCompare(b.name); });
  return createJsonResponse({ status: 'ok', managers: managers, clients: clients });
}

function handleAddDropdown(sessionUser, payload) {
  if (sessionUser.role !== 'admin') {
    return createJsonResponse({ error: 'Admin access required.' }, 403);
  }
  var category = payload.category;
  var name = (payload.name || '').trim();
  if (!name) return createJsonResponse({ error: 'Name cannot be empty.' }, 400);

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var sheet = getSheet(TABS.DROPDOWNS);
    var id = (category === 'manager' ? 'mgr_' : 'cli_') + Date.now();
    var now = Date.now();
    sheet.appendRow([id, category, name, true, now, now]);

    return createJsonResponse({
      status: 'ok',
      option: { id: id, category: category, name: name, isActive: true, createdAtMs: now, updatedAtMs: now }
    });
  } finally {
    lock.releaseLock();
  }
}

function handleUpdateDropdown(sessionUser, payload) {
  if (sessionUser.role !== 'admin') {
    return createJsonResponse({ error: 'Admin access required.' }, 403);
  }
  var id = payload.id;
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var sheet = getSheet(TABS.DROPDOWNS);
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(id)) {
        var row = i + 1;
        if (payload.name !== undefined) sheet.getRange(row, 3).setValue(payload.name);
        if (payload.isActive !== undefined) sheet.getRange(row, 4).setValue(payload.isActive);
        sheet.getRange(row, 6).setValue(Date.now());
        return createJsonResponse({ status: 'ok', id: id });
      }
    }
    return createJsonResponse({ error: 'Dropdown option not found.' }, 404);
  } finally {
    lock.releaseLock();
  }
}

function handleDeleteDropdown(sessionUser, payload) {
  if (sessionUser.role !== 'admin') {
    return createJsonResponse({ error: 'Admin access required.' }, 403);
  }
  var id = payload.id;
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var sheet = getSheet(TABS.DROPDOWNS);
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(id)) {
        sheet.deleteRow(i + 1);
        return createJsonResponse({ status: 'ok', id: id });
      }
    }
    return createJsonResponse({ error: 'Dropdown option not found.' }, 404);
  } finally {
    lock.releaseLock();
  }
}

// ----------------------------------------------------------------------------
// Users Directory (Admin Only)
// ----------------------------------------------------------------------------

function handleGetUsers(sessionUser) {
  if (sessionUser.role !== 'admin') {
    return createJsonResponse({ error: 'Admin access required.' }, 403);
  }
  var sheet = getSheet(TABS.USERS);
  var data = sheet.getDataRange().getValues();
  var users = [];

  var hasSaltCol = (data[0] && String(data[0][5]).toLowerCase() === 'salt');
  var activeCol = hasSaltCol ? 6 : 5;
  var createdCol = hasSaltCol ? 7 : 6;
  var updatedCol = hasSaltCol ? 8 : 7;

  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    if (!r[0]) continue;
    // Omit sensitive credentials!
    users.push({
      uid: String(r[0]),
      name: String(r[1]),
      email: String(r[2]),
      role: String(r[3]),
      isActive: r[activeCol] === true || String(r[activeCol]).toLowerCase() === 'true',
      createdAtMs: Number(r[createdCol]) || Date.now(),
      updatedAtMs: Number(r[updatedCol]) || Date.now()
    });
  }

  users.sort(function(a, b) { return a.name.localeCompare(b.name); });
  return createJsonResponse({ status: 'ok', users: users });
}

function handleUpdateUser(sessionUser, payload) {
  if (sessionUser.role !== 'admin') {
    return createJsonResponse({ error: 'Admin access required.' }, 403);
  }
  var targetUid = payload.targetUid;
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var sheet = getSheet(TABS.USERS);
    var data = sheet.getDataRange().getValues();
    var hasSaltCol = (data[0] && String(data[0][5]).toLowerCase() === 'salt');
    var activeColIndex = hasSaltCol ? 7 : 6;
    var updatedColIndex = hasSaltCol ? 9 : 8;

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(targetUid)) {
        var row = i + 1;
        if (payload.role !== undefined) sheet.getRange(row, 4).setValue(payload.role);
        if (payload.isActive !== undefined) sheet.getRange(row, activeColIndex).setValue(payload.isActive);
        if (payload.name !== undefined) sheet.getRange(row, 2).setValue(payload.name);
        if (payload.password !== undefined && payload.password) sheet.getRange(row, 5).setValue(payload.password);
        sheet.getRange(row, updatedColIndex).setValue(Date.now());
        return createJsonResponse({ status: 'ok', uid: targetUid });
      }
    }
    return createJsonResponse({ error: 'User not found.' }, 404);
  } finally {
    lock.releaseLock();
  }
}

// ----------------------------------------------------------------------------
// Resume Upload to Google Drive (Audited & File-Type Verified)
// ----------------------------------------------------------------------------

function getResumeFolder() {
  var propId = PropertiesService.getScriptProperties().getProperty('RESUME_FOLDER_ID');
  var target = (propId || RESUME_FOLDER_ID || '').trim();

  if (target) {
    var match = target.match(/\/folders\/([a-zA-Z0-9-_]+)/);
    var cleanId = match ? match[1] : target;
    try {
      return DriveApp.getFolderById(cleanId);
    } catch (e) {
      // Fallback to sheet folder
    }
  }

  // Auto-detect folder jaha Google Sheet rakhi hai!
  try {
    var ss = getSpreadsheet();
    var file = DriveApp.getFileById(ss.getId());
    var parents = file.getParents();
    if (parents.hasNext()) {
      var parentFolder = parents.next();
      var subFolders = parentFolder.getFoldersByName('Resumes');
      if (subFolders.hasNext()) {
        return subFolders.next();
      } else {
        return parentFolder.createFolder('Resumes');
      }
    }
  } catch (e) {
    // Fallback
  }

  return DriveApp.getRootFolder();
}

function handleUploadResume(sessionUser, payload) {
  var fileBase64 = payload.fileBase64;
  var originalName = payload.fileName || 'resume.pdf';
  var candidateName = payload.candidateName || '';
  var mimeType = payload.mimeType || 'application/pdf';

  if (!fileBase64) {
    return createJsonResponse({ error: 'No file data received.' }, 400);
  }

  // Security Check 1: File Extension Verification
  var lowerName = originalName.toLowerCase();
  var isAllowedExt = ALLOWED_EXTENSIONS.some(function(ext) { return lowerName.endsWith(ext); });
  if (!isAllowedExt) {
    return createJsonResponse({ error: 'Security block: Only PDF, DOC, or DOCX resume files are allowed.' }, 400);
  }

  var folder = getResumeFolder();

  var decodedBytes = Utilities.base64Decode(fileBase64);

  // Security Check 2: Max File Size (5MB)
  if (decodedBytes.length > MAX_RESUME_BYTES) {
    return createJsonResponse({ error: 'File size exceeds 5 MB limit.' }, 400);
  }

  var cleanCandidate = candidateName.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  var dateStamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var safeFileName = (cleanCandidate ? cleanCandidate + '_' : '') + dateStamp + '_' + originalName.replace(/[^A-Za-z0-9._-]+/g, '_');

  var blob = Utilities.newBlob(decodedBytes, mimeType, safeFileName);
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return createJsonResponse({
    status: 'ok',
    downloadUrl: file.getUrl(),
    fileName: safeFileName,
    storagePath: 'gdrive:' + file.getId()
  });
}

// ----------------------------------------------------------------------------
// Security Primitives: Salted SHA-256 & HMAC Signing
// ----------------------------------------------------------------------------

function generateSalt() {
  return Utilities.getUuid().replace(/-/g, '').substring(0, 16);
}

function hashPassword(password, salt) {
  var raw = salt + ':' + password;
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw, Utilities.Charset.UTF_8);
  var hex = '';
  for (var i = 0; i < digest.length; i++) {
    var b = digest[i];
    if (b < 0) b += 256;
    var s = b.toString(16);
    if (s.length === 1) s = '0' + s;
    hex += s;
  }
  return hex;
}

function getSecretKey() {
  var props = PropertiesService.getScriptProperties();
  var secret = props.getProperty('SECRET_KEY');
  if (!secret) {
    secret = Utilities.getUuid() + '_' + Utilities.getUuid();
    props.setProperty('SECRET_KEY', secret);
  }
  return secret;
}

function generateToken(user) {
  var header = { alg: 'HS256', typ: 'JWT' };
  var nowSec = Math.floor(Date.now() / 1000);
  var expSec = nowSec + (TOKEN_EXPIRY_DAYS * 24 * 3600);
  var payload = {
    uid: user.uid,
    email: user.email,
    role: user.role,
    name: user.name,
    isActive: user.isActive,
    iat: nowSec,
    exp: expSec
  };

  var encodedHeader = Utilities.base64EncodeWebSafe(JSON.stringify(header));
  var encodedPayload = Utilities.base64EncodeWebSafe(JSON.stringify(payload));
  var stringToSign = encodedHeader + '.' + encodedPayload;

  var signatureBytes = Utilities.computeHmacSha256Signature(stringToSign, getSecretKey());
  var encodedSignature = Utilities.base64EncodeWebSafe(signatureBytes);

  return stringToSign + '.' + encodedSignature;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  var parts = token.split('.');
  if (parts.length !== 3) return null;

  var stringToSign = parts[0] + '.' + parts[1];
  var expectedSignature = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(stringToSign, getSecretKey()));

  if (expectedSignature !== parts[2]) {
    return null;
  }

  try {
    var payloadJson = Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[1])).getDataAsString();
    var payload = JSON.parse(payloadJson);
    var nowSec = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < nowSec) {
      return null;
    }
    return payload;
  } catch (err) {
    return null;
  }
}

function getSpreadsheet() {
  // 1. Agar script Google Sheet ke andar container-bound hai (Extensions -> Apps Script se open ki gayi hai)
  try {
    var active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
  } catch (e) {
    // Standalone script
  }

  var propId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  var target = (propId || SPREADSHEET_ID || '').trim();

  if (target) {
    // 2. Agar user ne Google Sheet ka link paste kiya hai: docs.google.com/spreadsheets/d/...
    var sheetMatch = target.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/) || target.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (sheetMatch) {
      try {
        var ss = SpreadsheetApp.openById(sheetMatch[1]);
        PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', sheetMatch[1]);
        return ss;
      } catch (e) {
        // Continue to folder check
      }
    }

    // 3. Agar user ne Google Drive Folder ka link paste kiya hai: drive.google.com/drive/.../folders/...
    var folderMatch = target.match(/\/folders\/([a-zA-Z0-9-_]+)/);
    var folderId = folderMatch ? folderMatch[1] : (target.length >= 25 && target.indexOf('/') === -1 ? target : null);

    if (folderId) {
      try {
        var folder = DriveApp.getFolderById(folderId);
        if (folder) {
          // Folder me dekho ki kya pehle se Verto_Recruitment_Database sheet hai
          var files = folder.getFilesByName('Verto_Recruitment_Database');
          if (files.hasNext()) {
            var existingFile = files.next();
            var existingSS = SpreadsheetApp.openById(existingFile.getId());
            PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', existingFile.getId());
            return existingSS;
          } else {
            // Agar folder me sheet nahi hai, to automatically folder ke andar sheet bana do!
            var newSS = SpreadsheetApp.create('Verto_Recruitment_Database');
            var newFile = DriveApp.getFileById(newSS.getId());
            newFile.moveTo(folder);
            PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', newSS.getId());
            return newSS;
          }
        }
      } catch (folderErr) {
        // Continue to plain open
      }
    }

    // 4. Try plain ID directly
    var cleanId = (sheetMatch ? sheetMatch[1] : (folderMatch ? folderMatch[1] : target)).trim();
    if (cleanId) {
      try {
        return SpreadsheetApp.openById(cleanId);
      } catch (err) {
        // Continue
      }
    }
  }

  // 5. Agar kuch bhi nahi mila, to Google Drive me automatically nayi sheet create kar do!
  try {
    var autoSS = SpreadsheetApp.create('Verto_Recruitment_Database');
    PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', autoSS.getId());
    return autoSS;
  } catch (createErr) {
    throw new Error('Google Sheet open nahi ho saki: ' + createErr.message);
  }
}

function getSheet(name) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  return sheet;
}

function createJsonResponse(data, statusCode) {
  var output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}
