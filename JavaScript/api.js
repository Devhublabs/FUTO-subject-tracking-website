/* ============================================================
   API.JS — Backend Communication Layer
   FUTO Data Collection Platform
   ============================================================
   RULES:
   - This is the ONLY file that calls fetch()
   - No other JS file ever makes a direct fetch() call
   - All functions are async and return parsed JSON
   - Backend team only needs to change BASE_URL to deploy
   - Every request automatically attaches the auth token
   - Every response is checked for auth errors (401 → logout)

   TABLE OF CONTENTS:
   01. Configuration
   02. Core Request Helper
   03. Auth Endpoints
   04. User Endpoints
   05. Textbook Endpoints
   06. Upload Endpoints
   07. Withdrawal Endpoints
   08. Payment Method Endpoints
   ============================================================ */


/* ════════════════════════════════════════
   01. CONFIGURATION
════════════════════════════════════════ */

const BASE_URL = "http://localhost:8000";

// Token key used in localStorage
const TOKEN_KEY = "futo_auth_token";


/* ════════════════════════════════════════
   02. CORE REQUEST HELPER
   All fetch calls go through this function.
   Handles: headers, token injection,
   error parsing, 401 auto-logout.
════════════════════════════════════════ */

/**
 * Internal request helper — do not call directly from other files.
 * Use the named API functions below instead.
 *
 * @param {string} endpoint    - e.g. "/api/auth/login"
 * @param {string} method      - "GET" | "POST" | "PUT" | "DELETE"
 * @param {object|null} body   - JSON body (for POST/PUT), or null
 * @param {boolean} isFormData - true when sending FormData (file uploads)
 * @returns {Promise<{data: any, error: string|null, status: number}>}
 */
async function request(endpoint, method = "GET", body = null, isFormData = false) {
  const token = localStorage.getItem(TOKEN_KEY);

  const headers = {};

  // Only set Content-Type for JSON — FormData sets its own boundary
  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }

  // Attach token if it exists
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const config = {
    method,
    headers,
  };

  if (body) {
    config.body = isFormData ? body : JSON.stringify(body);
  }

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, config);

    // Token expired or invalid — force logout
    if (response.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      window.location.href = "/index.html";
      return { data: null, error: "Session expired. Please log in again.", status: 401 };
    }

    // Try to parse JSON response
    let data = null;
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      data = await response.json();
    }

    // Non-2xx response
    if (!response.ok) {
      const errorMessage =
        (data && (data.detail || data.message || data.error)) ||
        `Request failed with status ${response.status}`;
      return { data: null, error: errorMessage, status: response.status };
    }

    return { data, error: null, status: response.status };

  } catch (err) {
    // Network error (no connection, server down, CORS)
    console.error(`[API] Network error on ${method} ${endpoint}:`, err);
    return {
      data: null,
      error: "Network error. Please check your connection and try again.",
      status: 0,
    };
  }
}


/* ════════════════════════════════════════
   03. AUTH ENDPOINTS
════════════════════════════════════════ */

/**
 * Register a new user account.
 * On success, saves token to localStorage.
 *
 * @param {string} name
 * @param {string} email
 * @param {string} phone
 * @param {string} password
 * @returns {Promise<{data: {user_id, token, tier}|null, error: string|null}>}
 */
async function apiRegister(name, email, phone, password) {
  const result = await request("/api/auth/register", "POST", {
    name,
    email,
    phone,
    password,
  });

  if (result.data && result.data.token) {
    localStorage.setItem(TOKEN_KEY, result.data.token);
  }

  return result;
}

/**
 * Log in with email and password.
 * On success, saves token to localStorage.
 *
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{data: {user_id, token, tier, balance}|null, error: string|null}>}
 */
async function apiLogin(email, password) {
  const result = await request("/api/auth/login", "POST", { email, password });

  if (result.data && result.data.token) {
    localStorage.setItem(TOKEN_KEY, result.data.token);
  }

  return result;
}

/**
 * Log out the current user.
 * Always clears the local token regardless of server response.
 *
 * @returns {Promise<{data: {success: bool}|null, error: string|null}>}
 */
async function apiLogout() {
  const result = await request("/api/auth/logout", "POST");
  localStorage.removeItem(TOKEN_KEY);
  return result;
}

/**
 * Request a password reset email.
 *
 * @param {string} email
 * @returns {Promise<{data: {message: string}|null, error: string|null}>}
 */
async function apiForgotPassword(email) {
  return await request("/api/auth/forgot-password", "POST", { email });
}

/**
 * Check whether a valid token exists in localStorage.
 * Does NOT hit the server — local check only.
 *
 * @returns {boolean}
 */
function apiIsLoggedIn() {
  return !!localStorage.getItem(TOKEN_KEY);
}

/**
 * Retrieve the raw token string (e.g. for debugging).
 *
 * @returns {string|null}
 */
function apiGetToken() {
  return localStorage.getItem(TOKEN_KEY);
}


/* ════════════════════════════════════════
   04. USER ENDPOINTS
════════════════════════════════════════ */

/**
 * Get the full profile of the logged-in user.
 *
 * @returns {Promise<{data: {
 *   name, email, phone, tier,
 *   balance, lifetime_earnings,
 *   daily_quota_remaining
 * }|null, error: string|null}>}
 */
async function apiGetProfile() {
  return await request("/api/user/profile", "GET");
}

/**
 * Get the current balance and minimum withdrawal amount.
 *
 * @returns {Promise<{data: {balance, minimum_to_withdraw}|null, error: string|null}>}
 */
async function apiGetBalance() {
  return await request("/api/user/balance", "GET");
}

/**
 * Get today's upload quota usage for the logged-in user.
 *
 * @returns {Promise<{data: {used, limit, remaining}|null, error: string|null}>}
 */
async function apiGetDailyQuota() {
  return await request("/api/user/daily-quota", "GET");
}

/**
 * Get the user's current tier and next tier requirements.
 *
 * @returns {Promise<{data: {current_tier, next_tier_requirement}|null, error: string|null}>}
 */
async function apiGetTier() {
  return await request("/api/user/tier", "GET");
}


/* ════════════════════════════════════════
   05. TEXTBOOK ENDPOINTS
════════════════════════════════════════ */

/**
 * Get all textbooks with their upload progress.
 *
 * @returns {Promise<{data: Array<{
 *   id, name, total_pages,
 *   uploaded_count, status
 * }>|null, error: string|null}>}
 */
async function apiGetTextbooks() {
  return await request("/api/textbooks", "GET");
}

/**
 * Get the list of missing page numbers for a specific textbook.
 *
 * @param {string|number} textbookId
 * @returns {Promise<{data: {missing_pages: number[]}|null, error: string|null}>}
 */
async function apiGetMissingPages(textbookId) {
  return await request(`/api/textbooks/${textbookId}/missing-pages`, "GET");
}


/* ════════════════════════════════════════
   06. UPLOAD ENDPOINTS
════════════════════════════════════════ */

/**
 * Upload and process a textbook page image.
 * Sends as multipart FormData (not JSON).
 *
 * @param {File}        imageFile   - The image file object from input
 * @param {string|number} bookId    - ID of the selected textbook
 * @param {number|null} pageNumber  - Manual page number (null = let OCR detect)
 * @returns {Promise<{data: {
 *   quality_passed: boolean,
 *   reason?: string,
 *   detected_page?: number,
 *   amount_earned?: number,
 *   new_balance?: number,
 *   textbook_progress?: {
 *     uploaded_count: number,
 *     total_pages: number,
 *     percentage: number
 *   }
 * }|null, error: string|null}>}
 */
async function apiUploadImage(imageFile, bookId, pageNumber = null) {
  const formData = new FormData();
  formData.append("image", imageFile);
  formData.append("book_id", bookId);

  if (pageNumber !== null) {
    formData.append("page_number", pageNumber);
  }

  return await request("/api/upload/process", "POST", formData, true);
}


/* ════════════════════════════════════════
   07. WITHDRAWAL ENDPOINTS
════════════════════════════════════════ */

/**
 * Request a withdrawal from the user's balance.
 *
 * @param {number} amount                - Amount in ₦
 * @param {string} paymentMethod         - "opay" | "bank_transfer"
 * @returns {Promise<{data: {
 *   transaction_id,
 *   status,
 *   estimated_time,
 *   processing_fee
 * }|null, error: string|null}>}
 */
async function apiRequestWithdrawal(amount, paymentMethod) {
  return await request("/api/withdrawal/request", "POST", {
    amount,
    payment_method: paymentMethod,
  });
}

/**
 * Confirm a pending withdrawal transaction.
 *
 * @param {string} transactionId
 * @param {object} paymentData     - Payment-method-specific data
 * @returns {Promise<{data: {success: boolean, transaction_id: string}|null, error: string|null}>}
 */
async function apiConfirmWithdrawal(transactionId, paymentData) {
  return await request("/api/withdrawal/confirm", "POST", {
    transaction_id: transactionId,
    payment_data: paymentData,
  });
}

/**
 * Get the full withdrawal history for the logged-in user.
 *
 * @returns {Promise<{data: Array<{
 *   id, amount, method, status,
 *   date, estimated_arrival
 * }>|null, error: string|null}>}
 */
async function apiGetWithdrawalHistory() {
  return await request("/api/withdrawal/history", "GET");
}


/* ════════════════════════════════════════
   08. PAYMENT METHOD ENDPOINTS
════════════════════════════════════════ */

/**
 * Get all saved payment methods for the logged-in user.
 *
 * @returns {Promise<{data: Array<{
 *   id, type, last_4, default
 * }>|null, error: string|null}>}
 */
async function apiGetPaymentMethods() {
  return await request("/api/payment-methods", "GET");
}

/**
 * Save a new payment method.
 *
 * @param {string} type              - "opay" | "bank_transfer"
 * @param {object} accountDetails    - Bank/Opay account details
 * @returns {Promise<{data: {id, type}|null, error: string|null}>}
 */
async function apiAddPaymentMethod(type, accountDetails) {
  return await request("/api/payment-methods", "POST", {
    type,
    account_details: accountDetails,
  });
}
