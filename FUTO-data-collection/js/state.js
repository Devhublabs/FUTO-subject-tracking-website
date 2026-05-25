/* ============================================================
   STATE.JS — Shared Application State
   FUTO Data Collection Platform
   ============================================================
   RULES:
   - This is the single source of truth for runtime app data
   - All pages READ from AppState
   - Only auth.js writes user/token data into AppState
   - Only page JS files (dashboard.js, etc.) write page data
   - Never import state.js into api.js
   - Call AppState.reset() on logout

   TABLE OF CONTENTS:
   01. State Object
   02. State Updaters
   03. State Readers
   04. State Persistence (localStorage sync)
   05. State Reset
   ============================================================ */


/* ════════════════════════════════════════
   01. STATE OBJECT
   The single runtime state for the app.
   All values start as null/defaults
   and are populated after API calls.
════════════════════════════════════════ */

const AppState = {

  /* ── User ── */
  user: {
    id:                 null,   // string
    name:               null,   // string
    email:              null,   // string
    phone:              null,   // string
    tier:               null,   // 1 | 2 | 3
    tierLabel:          null,   // "Newcomer" | "Contributor" | "Trusted"
    balance:            0,      // number (₦)
    lifetimeEarnings:   0,      // number (₦)
    dailyQuotaUsed:     0,      // number
    dailyQuotaLimit:    15,     // number (default Tier 1)
    dailyQuotaRemaining:15,     // number
  },

  /* ── Textbooks ── */
  textbooks: [],
  /*
    Each item shape:
    {
      id:             string,
      name:           string,
      total_pages:    number,
      uploaded_count: number,
      percentage:     number,   // computed on load
      status:         "in_progress" | "complete"
    }
  */

  /* ── Upload session (active upload flow) ── */
  upload: {
    selectedBookId:   null,   // string
    selectedBookName: null,   // string
    detectedPage:     null,   // number | null
    manualPage:       null,   // number | null
    imageFile:        null,   // File object
    step:             1,      // 1–4
    isProcessing:     false,
    lastResult:       null,   // "pass" | "fail" | "duplicate"
    lastResultData:   null,   // full API response object
  },

  /* ── Withdrawal session ── */
  withdrawal: {
    pendingTransactionId: null,
    pendingAmount:        0,
    pendingMethod:        null,
    history:              [],
  },

  /* ── UI flags ── */
  ui: {
    isLoading:      false,
    sidebarOpen:    false,
    activeModal:    null,   // string name of open modal, or null
    toastQueue:     [],
  },

  /* ── Tier metadata (static) ── */
  tiers: {
    1: { label: "Newcomer",    quotaPerDay: 15, maxDailyEarnings: 300  },
    2: { label: "Contributor", quotaPerDay: 25, maxDailyEarnings: 500  },
    3: { label: "Trusted",     quotaPerDay: 40, maxDailyEarnings: 800  },
  },

  /* ── Constants ── */
  EARN_PER_IMAGE:       20,      // ₦20 per accepted image
  MIN_WITHDRAWAL:       1000,    // ₦1,000 minimum to withdraw

};


/* ════════════════════════════════════════
   02. STATE UPDATERS
   Call these to write into AppState.
   Never mutate AppState properties directly
   from page JS files — use these functions.
════════════════════════════════════════ */

/**
 * Populate user state from a profile API response.
 * Called by auth.js after login, and by dashboard.js on load.
 *
 * @param {object} profileData - Response from apiGetProfile()
 */
function setUser(profileData) {
  if (!profileData) return;

  const tier = profileData.tier || 1;
  const tierInfo = AppState.tiers[tier] || AppState.tiers[1];

  AppState.user.id                  = profileData.user_id  || profileData.id || null;
  AppState.user.name                = profileData.name     || null;
  AppState.user.email               = profileData.email    || null;
  AppState.user.phone               = profileData.phone    || null;
  AppState.user.tier                = tier;
  AppState.user.tierLabel           = tierInfo.label;
  AppState.user.balance             = profileData.balance  || 0;
  AppState.user.lifetimeEarnings    = profileData.lifetime_earnings || 0;
  AppState.user.dailyQuotaLimit     = tierInfo.quotaPerDay;
  AppState.user.dailyQuotaRemaining = profileData.daily_quota_remaining ?? tierInfo.quotaPerDay;
  AppState.user.dailyQuotaUsed      = tierInfo.quotaPerDay - AppState.user.dailyQuotaRemaining;

  // Persist name and tier to localStorage for fast header render
  localStorage.setItem("futo_user_name",  AppState.user.name  || "");
  localStorage.setItem("futo_user_tier",  String(AppState.user.tier));
}

/**
 * Update only the balance and quota (after an upload or withdrawal).
 *
 * @param {number} newBalance
 * @param {number} newQuotaRemaining
 */
function setBalanceAndQuota(newBalance, newQuotaRemaining) {
  AppState.user.balance             = newBalance;
  AppState.user.dailyQuotaRemaining = newQuotaRemaining;
  AppState.user.dailyQuotaUsed      = AppState.user.dailyQuotaLimit - newQuotaRemaining;
}

/**
 * Populate the textbooks list from API response.
 * Computes percentage for each book.
 *
 * @param {Array} textbooksData - Response array from apiGetTextbooks()
 */
function setTextbooks(textbooksData) {
  if (!Array.isArray(textbooksData)) return;

  AppState.textbooks = textbooksData.map((book) => ({
    id:             book.id,
    name:           book.name,
    total_pages:    book.total_pages,
    uploaded_count: book.uploaded_count,
    percentage:     book.total_pages > 0
                      ? Math.round((book.uploaded_count / book.total_pages) * 100)
                      : 0,
    status:         book.status || "in_progress",
  }));
}

/**
 * Update a single textbook's progress after a successful upload.
 *
 * @param {string|number} bookId
 * @param {object} progressData - { uploaded_count, total_pages, percentage }
 */
function updateTextbookProgress(bookId, progressData) {
  const book = AppState.textbooks.find((b) => String(b.id) === String(bookId));
  if (!book) return;

  book.uploaded_count = progressData.uploaded_count;
  book.total_pages    = progressData.total_pages;
  book.percentage     = progressData.percentage ||
    Math.round((progressData.uploaded_count / progressData.total_pages) * 100);

  if (book.uploaded_count >= book.total_pages) {
    book.status = "complete";
  }
}

/**
 * Set the active upload session data.
 *
 * @param {object} uploadData - Partial upload state to merge
 */
function setUploadSession(uploadData) {
  Object.assign(AppState.upload, uploadData);
}

/**
 * Clear the upload session (after flow completes or is cancelled).
 */
function clearUploadSession() {
  AppState.upload = {
    selectedBookId:   null,
    selectedBookName: null,
    detectedPage:     null,
    manualPage:       null,
    imageFile:        null,
    step:             1,
    isProcessing:     false,
    lastResult:       null,
    lastResultData:   null,
  };
}

/**
 * Set withdrawal history.
 *
 * @param {Array} historyData - Array from apiGetWithdrawalHistory()
 */
function setWithdrawalHistory(historyData) {
  AppState.withdrawal.history = Array.isArray(historyData) ? historyData : [];
}

/**
 * Toggle the sidebar open/closed state.
 */
function toggleSidebar() {
  AppState.ui.sidebarOpen = !AppState.ui.sidebarOpen;
}

/**
 * Set the name of the currently open modal.
 *
 * @param {string|null} modalName
 */
function setActiveModal(modalName) {
  AppState.ui.activeModal = modalName;
}


/* ════════════════════════════════════════
   03. STATE READERS
   Convenience functions to read
   computed values from AppState.
════════════════════════════════════════ */

/**
 * Returns true if the user has quota remaining today.
 * @returns {boolean}
 */
function canUploadToday() {
  return AppState.user.dailyQuotaRemaining > 0;
}

/**
 * Returns true if the user can withdraw (balance ≥ minimum).
 * @returns {boolean}
 */
function canWithdraw() {
  return AppState.user.balance >= AppState.MIN_WITHDRAWAL;
}

/**
 * Returns ₦ amount still needed to reach withdrawal minimum.
 * Returns 0 if already eligible.
 * @returns {number}
 */
function amountNeededToWithdraw() {
  const needed = AppState.MIN_WITHDRAWAL - AppState.user.balance;
  return needed > 0 ? needed : 0;
}

/**
 * Returns number of uploads needed to reach withdrawal minimum
 * at ₦20/image, from current balance.
 * @returns {number}
 */
function uploadsNeededToWithdraw() {
  return Math.ceil(amountNeededToWithdraw() / AppState.EARN_PER_IMAGE);
}

/**
 * Returns estimated days to reach withdrawal minimum
 * based on current tier quota.
 * @returns {number}
 */
function daysToWithdraw() {
  const needed = uploadsNeededToWithdraw();
  const dailyMax = AppState.tiers[AppState.user.tier]?.quotaPerDay || 15;
  return Math.ceil(needed / dailyMax);
}

/**
 * Get a textbook by its ID.
 * @param {string|number} bookId
 * @returns {object|null}
 */
function getTextbookById(bookId) {
  return AppState.textbooks.find((b) => String(b.id) === String(bookId)) || null;
}

/**
 * Get initials from the user's name for the avatar.
 * e.g. "John Doe" → "JD"
 * @returns {string}
 */
function getUserInitials() {
  const name = AppState.user.name || "U";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Format a number as Nigerian Naira.
 * e.g. 1500 → "₦1,500"
 * @param {number} amount
 * @returns {string}
 */
function formatNaira(amount) {
  return `₦${Number(amount || 0).toLocaleString("en-NG")}`;
}

/**
 * Format an ISO date string to a readable format.
 * e.g. "2026-05-22T10:30:00Z" → "22 May 2026"
 * @param {string} isoString
 * @returns {string}
 */
function formatDate(isoString) {
  if (!isoString) return "—";
  return new Date(isoString).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}


/* ════════════════════════════════════════
   04. STATE PERSISTENCE
   Fast-load helpers — these read from
   localStorage so the header can render
   the user's name and tier instantly,
   before the API response comes back.
════════════════════════════════════════ */

/**
 * Pre-populate user name and tier from localStorage
 * for immediate display while API loads.
 * Called at the top of every page's JS init.
 */
function hydrateFromStorage() {
  const storedName = localStorage.getItem("futo_user_name");
  const storedTier = parseInt(localStorage.getItem("futo_user_tier"), 10);

  if (storedName) AppState.user.name = storedName;

  if (storedTier && AppState.tiers[storedTier]) {
    AppState.user.tier      = storedTier;
    AppState.user.tierLabel = AppState.tiers[storedTier].label;
  }
}


/* ════════════════════════════════════════
   05. STATE RESET
   Call on logout. Clears everything.
════════════════════════════════════════ */

/**
 * Reset all app state to defaults and clear localStorage.
 * Called by auth.js during logout.
 */
function resetState() {
  AppState.user = {
    id:                 null,
    name:               null,
    email:              null,
    phone:              null,
    tier:               null,
    tierLabel:          null,
    balance:            0,
    lifetimeEarnings:   0,
    dailyQuotaUsed:     0,
    dailyQuotaLimit:    15,
    dailyQuotaRemaining:15,
  };

  AppState.textbooks  = [];
  AppState.withdrawal = {
    pendingTransactionId: null,
    pendingAmount:        0,
    pendingMethod:        null,
    history:              [],
  };

  AppState.ui = {
    isLoading:   false,
    sidebarOpen: false,
    activeModal: null,
    toastQueue:  [],
  };

  clearUploadSession();

  // Clear persisted user data and session token
  localStorage.removeItem("futo_user_name");
  localStorage.removeItem("futo_user_tier");
  localStorage.removeItem("futo_auth_token");
}
