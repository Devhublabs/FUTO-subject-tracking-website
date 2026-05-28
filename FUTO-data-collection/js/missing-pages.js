document.addEventListener("DOMContentLoaded", async () => {
  UI.page.init({ requireAuth: true });
  hydrateHeader();

  document.getElementById("btn-refresh-missing")?.addEventListener("click", loadMissingPages);
  document.getElementById("btn-logout")?.addEventListener("click", () => handleLogout());
  document.getElementById("btn-settings")?.addEventListener("click", () => {
    window.location.href = routeTo("settings");
  });

  const { data: profileData, error: profileError } = await apiGetProfile();
  if (!profileError && profileData) {
    setUser(profileData);
    hydrateHeader();
  }

  await loadMissingPages();
});

async function loadMissingPages() {
  const bookId = getBookIdFromUrl();
  const list = document.getElementById("missing-pages-list");

  if (!bookId) {
    renderMissingPagesError("No textbook was selected.");
    return;
  }

  if (list) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="loader-ring"></div>
        <p class="text-muted">Loading missing pages...</p>
      </div>
    `;
  }

  UI.dom.setText("missing-pages-title", `Textbook #${bookId}`);
  UI.dom.setText("missing-pages-desc", "Pages that still need uploads for this textbook.");

  const { data, error } = await apiGetMissingPages(bookId);
  if (error) {
    UI.toast.error(error);
    renderMissingPagesError(error);
    return;
  }

  const pages = Array.isArray(data) ? data : data?.missing_pages || [];
  renderMissingPages(bookId, pages);
}

function renderMissingPages(bookId, pages) {
  const list = document.getElementById("missing-pages-list");
  if (!list) return;

  UI.dom.setText(
    "missing-pages-count",
    pages.length === 1 ? "1 missing page" : `${pages.length} missing pages`
  );

  if (!pages.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">✅</div>
        <h2 class="empty-state-title">No missing pages</h2>
        <p class="empty-state-desc">This textbook is fully covered for now.</p>
      </div>
    `;
    return;
  }

  list.innerHTML = pages.map((pageNumber) => `
    <article class="card card-sm stack">
      <div>
        <span class="stat-label">Page</span>
        <div class="stat-value">${escapeHTML(pageNumber)}</div>
      </div>
      <button type="button" class="btn btn-primary btn-sm btn-full" data-page="${escapeHTML(pageNumber)}">
        Upload this page
      </button>
    </article>
  `).join("");

  list.querySelectorAll("button[data-page]").forEach((button) => {
    button.addEventListener("click", () => {
      openUploadForPage(bookId, button.dataset.page);
    });
  });
}

function renderMissingPagesError(message) {
  const list = document.getElementById("missing-pages-list");
  UI.dom.setText("missing-pages-count", "Unable to load pages");

  if (!list) return;
  list.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">!</div>
      <h2 class="empty-state-title">Could not load missing pages</h2>
      <p class="empty-state-desc">${escapeHTML(message)}</p>
    </div>
  `;
}

function openUploadForPage(bookId, pageNumber) {
  const uploadUrl = new URL(routeTo("upload"));
  uploadUrl.searchParams.set("book", bookId);
  uploadUrl.searchParams.set("page", pageNumber);
  window.location.href = uploadUrl.href;
}

function getBookIdFromUrl() {
  return new URLSearchParams(window.location.search).get("book");
}

function hydrateHeader() {
  const avatar = document.getElementById("header-avatar");
  const tier = document.getElementById("header-tier");

  if (avatar) avatar.textContent = getUserInitials();
  if (tier) tier.textContent = `⭐ Tier ${AppState.user.tier || 1} — ${AppState.user.tierLabel || "Newcomer"}`;
}

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
