/* Resolve page URLs — index.html and dashboard.html live in the same pages/ folder */

const ROUTES = {
  login: "index.html",
  dashboard: "dashboard.html",
  upload: "upload.html",
};

function routeTo(page) {
  const file = ROUTES[page] || page;
  return new URL(file, window.location.href).href;
}

/** True when the current document is the login page */
function isLoginPage() {
  return !!document.getElementById("login-form");
}

/** True when the current document is the dashboard */
function isDashboardPage() {
  return !!document.querySelector(".books-grid");
}

/** True when the current document is the upload flow */
function isUploadPage() {
  return !!document.getElementById("upload-wizard");
}
