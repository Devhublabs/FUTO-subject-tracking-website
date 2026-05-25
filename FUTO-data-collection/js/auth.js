/* ============================================================
   AUTH.JS — Authentication Logic
   FUTO Data Collection Platform
   ============================================================
   RULES:
   - Handles login, register, logout flows
   - Reads/writes token via api.js functions only
   - Writes user data into AppState via state.js setUser()
   - Never calls fetch() directly — always uses api.js
   - index.html is the only page that loads this file

   TABLE OF CONTENTS:
   01. Tab Switching (Login / Register)
   02. Login Flow
   03. Register Flow
   04. Logout (called from other pages)
   05. Password Visibility Toggle
   06. Page Init
   ============================================================ */


/* ════════════════════════════════════════
   01. TAB SWITCHING
════════════════════════════════════════ */

function switchTab(tab) {
  const loginForm    = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");
  const loginTab     = document.getElementById("tab-login");
  const registerTab  = document.getElementById("tab-register");

  if (!loginForm || !registerForm) return;

  if (tab === "login") {
    UI.dom.show(loginForm);
    UI.dom.hide(registerForm);
    loginTab.classList.add("active");
    registerTab.classList.remove("active");
  } else {
    UI.dom.hide(loginForm);
    UI.dom.show(registerForm);
    registerTab.classList.add("active");
    loginTab.classList.remove("active");
  }

  UI.form.clearAll("login-form");
  UI.form.clearAll("register-form");
}


/* ════════════════════════════════════════
   02. LOGIN FLOW
════════════════════════════════════════ */

function validateLoginForm() {
  const email    = document.getElementById("login-email")?.value.trim();
  const password = document.getElementById("login-password")?.value;
  let valid      = true;

  UI.form.clearAll("login-form");

  if (!email) {
    UI.form.setError("login-email", "Email address is required.");
    valid = false;
  } else if (!UI.form.isValidEmail(email)) {
    UI.form.setError("login-email", "Please enter a valid email address.");
    valid = false;
  }

  if (!password) {
    UI.form.setError("login-password", "Password is required.");
    valid = false;
  }

  return valid;
}

async function handleLogin() {
  if (!validateLoginForm()) return;

  const email     = document.getElementById("login-email").value.trim();
  const password  = document.getElementById("login-password").value;
  const submitBtn = document.getElementById("login-submit");

  UI.form.setLoading(submitBtn, true);

  const { data, error } = await apiLogin(email, password);

  UI.form.setLoading(submitBtn, false, "Log In");

  if (error) {
    UI.toast.error(error);
    if (error.toLowerCase().includes("password")) {
      UI.form.setError("login-password", "Incorrect password. Please try again.");
    } else if (error.toLowerCase().includes("email") || error.toLowerCase().includes("user")) {
      UI.form.setError("login-email", "No account found with this email.");
    }
    return;
  }

  if (data) setUser(data);

  UI.toast.success("Welcome back! Redirecting...");
  setTimeout(() => { window.location.href = routeTo("dashboard"); }, 800);
}


/* ════════════════════════════════════════
   03. REGISTER FLOW
════════════════════════════════════════ */

function validateRegisterForm() {
  const name     = document.getElementById("reg-name")?.value.trim();
  const email    = document.getElementById("reg-email")?.value.trim();
  const phone    = document.getElementById("reg-phone")?.value.trim();
  const password = document.getElementById("reg-password")?.value;
  const confirm  = document.getElementById("reg-confirm")?.value;
  let valid      = true;

  UI.form.clearAll("register-form");

  if (!name || name.length < 2) {
    UI.form.setError("reg-name", "Please enter your full name.");
    valid = false;
  }

  if (!email) {
    UI.form.setError("reg-email", "Email address is required.");
    valid = false;
  } else if (!UI.form.isValidEmail(email)) {
    UI.form.setError("reg-email", "Please enter a valid email address.");
    valid = false;
  }

  if (phone && !UI.form.isValidPhone(phone)) {
    UI.form.setError("reg-phone", "Enter a valid Nigerian phone number (e.g. 08012345678).");
    valid = false;
  }

  const pwCheck = UI.form.validatePassword(password);
  if (!pwCheck.valid) {
    UI.form.setError("reg-password", pwCheck.message);
    valid = false;
  }

  if (!confirm) {
    UI.form.setError("reg-confirm", "Please confirm your password.");
    valid = false;
  } else if (password !== confirm) {
    UI.form.setError("reg-confirm", "Passwords do not match.");
    valid = false;
  }

  return valid;
}

async function handleRegister() {
  if (!validateRegisterForm()) return;

  const name      = document.getElementById("reg-name").value.trim();
  const email     = document.getElementById("reg-email").value.trim();
  const phone     = document.getElementById("reg-phone").value.trim();
  const password  = document.getElementById("reg-password").value;
  const submitBtn = document.getElementById("register-submit");

  UI.form.setLoading(submitBtn, true);

  const { data, error } = await apiRegister(name, email, phone, password);

  UI.form.setLoading(submitBtn, false, "Create Account");

  if (error) {
    UI.toast.error(error);
    if (error.toLowerCase().includes("email")) {
      UI.form.setError("reg-email", "This email is already registered.");
    }
    return;
  }

  if (data) setUser({ ...data, name });

  UI.toast.success("Account created! Taking you to your dashboard...");
  setTimeout(() => { window.location.href = routeTo("dashboard"); }, 800);
}


/* ════════════════════════════════════════
   04. LOGOUT
════════════════════════════════════════ */

async function handleLogout() {
  apiLogout().catch(() => {});
  if (typeof resetState === "function") resetState();
  UI.toast.info("You have been logged out.");
  setTimeout(() => { window.location.href = routeTo("login"); }, 600);
}


/* ════════════════════════════════════════
   05. PASSWORD VISIBILITY TOGGLE
════════════════════════════════════════ */

function togglePasswordVisibility(inputId, toggleBtnId) {
  const input = document.getElementById(inputId);
  const btn   = document.getElementById(toggleBtnId);
  if (!input || !btn) return;

  const isHidden  = input.type === "password";
  input.type      = isHidden ? "text" : "password";
  btn.textContent = isHidden ? "🙈" : "👁️";
  btn.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");
}


/* ════════════════════════════════════════
   06. PAGE INIT
════════════════════════════════════════ */

document.addEventListener("DOMContentLoaded", () => {
  // Only run login-page setup on index.html (not dashboard)
  if (!document.getElementById("login-form")) return;

  UI.page.init({ requireAuth: false });

  const tabLogin    = document.getElementById("tab-login");
  const tabRegister = document.getElementById("tab-register");
  if (tabLogin)    tabLogin.addEventListener("click",    () => switchTab("login"));
  if (tabRegister) tabRegister.addEventListener("click", () => switchTab("register"));

  const loginSubmit = document.getElementById("login-submit");
  if (loginSubmit) loginSubmit.addEventListener("click", handleLogin);

  document.getElementById("login-password")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleLogin();
  });

  const registerSubmit = document.getElementById("register-submit");
  if (registerSubmit) registerSubmit.addEventListener("click", handleRegister);

  document.getElementById("reg-confirm")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleRegister();
  });

  document.getElementById("toggle-login-pw")?.addEventListener("click", () => {
    togglePasswordVisibility("login-password", "toggle-login-pw");
  });
  document.getElementById("toggle-reg-pw")?.addEventListener("click", () => {
    togglePasswordVisibility("reg-password", "toggle-reg-pw");
  });
  document.getElementById("toggle-reg-confirm")?.addEventListener("click", () => {
    togglePasswordVisibility("reg-confirm", "toggle-reg-confirm");
  });

  document.getElementById("link-to-register")?.addEventListener("click", (e) => {
    e.preventDefault();
    switchTab("register");
  });
  document.getElementById("link-to-login")?.addEventListener("click", (e) => {
    e.preventDefault();
    switchTab("login");
  });

  switchTab("login");
});
