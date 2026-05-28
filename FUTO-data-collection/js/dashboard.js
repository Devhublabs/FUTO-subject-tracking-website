function openUploadModal(bookId) {
  const uploadUrl = new URL(routeTo("upload"));
  uploadUrl.searchParams.set("book", bookId);
  window.location.href = uploadUrl.href;
}


document.addEventListener("DOMContentLoaded", async () => {

  // ── 1. Auth guard + fast header hydration ──
  UI.page.init({ requireAuth: true });


  // ── 2. Load user profile ──
  const { data: profileData, error: profileError } = await apiGetProfile();
  if (profileError) {
    UI.toast.error(profileError);
    return;
  }
  setUser(profileData);


  // ── 3. Populate header ──
  document.getElementById("header-avatar").textContent = getUserInitials();
  document.getElementById("header-tier").textContent   = `⭐ Tier ${AppState.user.tier} — ${AppState.user.tierLabel}`;
  document.getElementById("page-welcome").textContent  = `Welcome, ${AppState.user.name}`;
  document.getElementById("page-tier-desc").textContent = `You are currently on Tier ${AppState.user.tier} — ${AppState.user.tierLabel}.`;


  // ── 4. Populate stats bar ──
  document.getElementById("stat-quota").textContent        = AppState.user.dailyQuotaRemaining;
  document.getElementById("stat-quota-sub").textContent    = `of ${AppState.user.dailyQuotaLimit} remaining today`;
  document.getElementById("stat-balance").textContent      = formatNaira(AppState.user.balance);
  document.getElementById("stat-to-withdraw").textContent  = formatNaira(amountNeededToWithdraw());

  const withdrawBtn = document.getElementById("btn-dashboard-withdraw");
  if (withdrawBtn) {
    withdrawBtn.textContent = canWithdraw() ? "Withdraw" : "View Progress";
    withdrawBtn.addEventListener("click", () => {
      window.location.href = routeTo("withdrawal");
    });
  }


  // ── 5. Populate tier progression panel ──
  const tierProgress = Math.round((AppState.user.balance / AppState.MIN_WITHDRAWAL) * 100);
  const nextTier     = AppState.user.tier < 3 ? AppState.user.tier + 1 : null;
  const nextTierInfo = nextTier ? AppState.tiers[nextTier] : null;

  document.getElementById("tier-badge").textContent =
    `⭐ Tier ${AppState.user.tier} — ${AppState.user.tierLabel}`;

  if (nextTierInfo) {
    document.getElementById("tier-progress-label").textContent =
      `Progress to Tier ${nextTier} — ${nextTierInfo.label}`;
    document.getElementById("tier-progress-value").textContent =
      `${formatNaira(AppState.user.balance)} / ${formatNaira(AppState.MIN_WITHDRAWAL)}`;
    document.getElementById("tier-progress-fill").style.width = `${Math.min(tierProgress, 100)}%`;
    document.getElementById("tier-progress-desc").textContent =
      `Earn ${formatNaira(amountNeededToWithdraw())} more to unlock Tier ${nextTier} (${nextTierInfo.quotaPerDay} uploads/day, ${formatNaira(nextTierInfo.maxDailyEarnings)}/day max).`;
  } else {
    // User is already on max tier
    document.getElementById("tier-progress-label").textContent = "Maximum Tier Reached";
    document.getElementById("tier-progress-value").textContent = "Tier 3 — Trusted";
    document.getElementById("tier-progress-fill").style.width  = "100%";
    document.getElementById("tier-progress-desc").textContent  = "You are on the highest tier. 40 uploads/day, ₦800/day max.";
  }


  // ── 6. Load and render textbook cards ──
  const { data: textbooksData, error: textbooksError } = await apiGetTextbooks();
  if (textbooksError) {
    UI.toast.error(textbooksError);
    return;
  }
  setTextbooks(textbooksData);
  renderBookCards();


  // ── 7. FAB → upload page ──
  const fab = document.getElementById("fab-upload");
  if (canUploadToday()) {
    fab.disabled = false;
    fab.classList.remove("disabled");
    fab.title = "Upload an image";
    fab.addEventListener("click", () => {
      window.location.href = routeTo("upload");
    });
  } else {
    fab.disabled = true;
    fab.classList.add("disabled");
    fab.title = "Come back tomorrow — daily quota reached";
  }


  // ── 8. Tier toggle ──
  const toggle      = document.getElementById("tier-toggle");
  const tierContent = document.getElementById("tier-content");

  if (toggle && tierContent) {
    toggle.addEventListener("click", () => {
      tierContent.classList.toggle("hidden");
      toggle.textContent = tierContent.classList.contains("hidden") ? "Show" : "Hide";
    });
  }


  // ── 9. Logout ──
  document.getElementById("btn-logout")?.addEventListener("click", () => {
    handleLogout();
  });

  // ── 10. Settings ──
  document.getElementById("btn-settings")?.addEventListener("click", () => {
    window.location.href = routeTo("settings");
  });

});


/* ════════════════════════════════════════
   RENDER BOOK CARDS
   Builds card HTML from AppState.textbooks
   and injects into .books-grid
════════════════════════════════════════ */

function renderBookCards() {
  const grid = document.getElementById("books-grid");
  if (!grid) return;

  if (AppState.textbooks.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <p class="text-muted">No textbooks available yet.</p>
      </div>`;
    return;
  }

  grid.innerHTML = AppState.textbooks.map((book) => `
    <div class="book-card" data-book-id="${escapeHTML(book.id)}">
      <div class="book-card-header">
        <div class="book-icon">📚</div>
        <div class="book-info">
          <div class="book-title">${escapeHTML(book.name)}</div>
          <div class="book-meta">${escapeHTML(book.uploaded_count)} / ${escapeHTML(book.total_pages)} pages</div>
        </div>
      </div>

      <div class="progress-wrap">
        <div class="progress-header">
          <span class="progress-label">Progress</span>
          <span class="progress-value">${book.percentage}%</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill" style="width: ${book.percentage}%;"></div>
        </div>
      </div>

      <div class="book-card-actions">
        <button class="btn btn-primary btn-sm" data-action="upload">Upload</button>
        <button class="btn btn-ghost btn-sm" data-action="missing">View Missing</button>
      </div>
    </div>
  `).join("");

  grid.querySelectorAll(".book-card").forEach((card) => {
    const bookId = card.dataset.bookId;
    card.querySelector('[data-action="upload"]')?.addEventListener("click", () => {
      openUploadModal(bookId);
    });
    card.querySelector('[data-action="missing"]')?.addEventListener("click", () => {
      const missingUrl = new URL(routeTo("missingPages"));
      missingUrl.searchParams.set("book", bookId);
      window.location.href = missingUrl.href;
    });
  });
}

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
