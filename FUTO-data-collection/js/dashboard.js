/* Dashboard page — auth guard, tier toggle, logout */

document.addEventListener("DOMContentLoaded", async () => {

  // ── 1. Fast-load name/tier from localStorage ──
  hydrateFromStorage();

  // ── 2. Redirect to login if not logged in ──
  UI.page.init({ requireAuth: true });

  // ── 3. Tier toggle ──
  const toggle = document.getElementById("tier-toggle");
  const tierContent = document.getElementById("tier-content");

  if (toggle && tierContent) {
    toggle.addEventListener("click", () => {
      tierContent.classList.toggle("hidden");
      toggle.textContent = tierContent.classList.contains("hidden") ? "Show" : "Hide";
    });
  }

  // ── 4. Load user profile from API ──
  const { data, error } = await apiGetProfile();
  if (error) {
    UI.toast.error(error);
    return;
  }
  setUser(data);
  console.log(AppState.user); // check this in browser console

  // ── 5. FAB logic ──
  const fab = document.getElementById("fab-upload");
  if (canUploadToday()) {
    fab.disabled = false;
    fab.classList.remove("disabled");
    fab.title = "Upload an image";
  } else {
    fab.disabled = true;
    fab.classList.add("disabled");
    fab.title = "Come back tomorrow";
  }

  // ── 6. Logout ──
  document.getElementById("btn-logout")?.addEventListener("click", () => {
    handleLogout();
  });

});