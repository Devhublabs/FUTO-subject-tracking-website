function openUploadModal(bookId, bookName) {
  setUploadSession({ selectedBookId: bookId, selectedBookName: bookName });

  const subtitle = document.getElementById("upload-modal-subtitle");
  if (subtitle) subtitle.textContent = bookName;

  // Pre-select the course in the dropdown
  const select = document.getElementById("upload-course-select");
  if (select) select.value = String(bookId);

  UI.modal.open("upload-modal-backdrop");
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


  // ── 7. Populate upload modal course dropdown ──
  populateCourseDropdown();


  // ── 8. FAB logic ──
  const fab = document.getElementById("fab-upload");
  if (canUploadToday()) {
    fab.disabled = false;
    fab.classList.remove("disabled");
    fab.title = "Upload an image";
    fab.addEventListener("click", () => UI.modal.open("upload-modal-backdrop"));
  } else {
    fab.disabled = true;
    fab.classList.add("disabled");
    fab.title = "Come back tomorrow — daily quota reached";
  }


  // ── 9. Upload modal wiring ──
  document.getElementById("upload-modal-close")?.addEventListener("click", () => {
    UI.modal.close("upload-modal-backdrop");
  });
  document.getElementById("upload-cancel")?.addEventListener("click", () => {
    UI.modal.close("upload-modal-backdrop");
  });

  // File picker
  const fileInput   = document.getElementById("upload-file");
  const pickFileBtn = document.getElementById("upload-pick-file");
  const preview     = document.getElementById("upload-preview");
  const previewWrap = document.getElementById("upload-preview-wrap");
  const submitBtn   = document.getElementById("upload-submit");

  pickFileBtn?.addEventListener("click", () => fileInput.click());

  fileInput?.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) return;

    setUploadSession({ imageFile: file });

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
      preview.src = e.target.result;
      previewWrap.classList.remove("hidden");
    };
    reader.readAsDataURL(file);

    // Enable submit
    submitBtn.disabled = false;
  });

  // Submit upload
  submitBtn?.addEventListener("click", async () => {
    const { imageFile, selectedBookId } = AppState.upload;
    const pageNumber = document.getElementById("upload-page-number")?.value || null;

    if (!imageFile || !selectedBookId) {
      UI.toast.error("Please select a course and an image.");
      return;
    }

    UI.loader.show("upload-loader");
    UI.modal.close("upload-modal-backdrop");

    const { data: uploadResult, error: uploadError } = await apiUploadImage(
      imageFile,
      selectedBookId,
      pageNumber ? parseInt(pageNumber) : null
    );

    UI.loader.hide("upload-loader");

    if (uploadError) {
      UI.toast.error(uploadError);
      return;
    }

    if (uploadResult.quality_passed) {
      UI.toast.success(`✅ Page accepted! You earned ${formatNaira(uploadResult.amount_earned)}`);
      setBalanceAndQuota(uploadResult.new_balance, AppState.user.dailyQuotaRemaining - 1);

      if (uploadResult.textbook_progress) {
        updateTextbookProgress(selectedBookId, uploadResult.textbook_progress);
        renderBookCards(); // re-render cards with updated progress
      }

      // Refresh stats
      document.getElementById("stat-balance").textContent     = formatNaira(AppState.user.balance);
      document.getElementById("stat-quota").textContent       = AppState.user.dailyQuotaRemaining;
      document.getElementById("stat-to-withdraw").textContent = formatNaira(amountNeededToWithdraw());
    } else {
      UI.toast.error(`❌ Page rejected: ${uploadResult.reason || "Quality check failed."}`);
    }

    clearUploadSession();
    fileInput.value = "";
    previewWrap.classList.add("hidden");
    submitBtn.disabled = true;
  });


  // ── 10. Tier toggle ──
  const toggle      = document.getElementById("tier-toggle");
  const tierContent = document.getElementById("tier-content");

  if (toggle && tierContent) {
    toggle.addEventListener("click", () => {
      tierContent.classList.toggle("hidden");
      toggle.textContent = tierContent.classList.contains("hidden") ? "Show" : "Hide";
    });
  }


  // ── 11. Logout ──
  document.getElementById("btn-logout")?.addEventListener("click", () => {
    handleLogout();
  });

  // ── 12. Settings ──
  document.getElementById("btn-settings")?.addEventListener("click", () => {
    window.location.href = "settings.html";
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
    <div class="book-card">
      <div class="book-card-header">
        <div class="book-icon">📚</div>
        <div class="book-info">
          <div class="book-title">${book.name}</div>
          <div class="book-meta">${book.uploaded_count} / ${book.total_pages} pages</div>
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
        <button class="btn btn-primary btn-sm" onclick="openUploadModal(${book.id}, '${book.name}')">Upload</button>
        <button class="btn btn-ghost btn-sm" onclick="window.location.href='missing-pages.html?book=${book.id}'">View Missing</button>
      </div>
    </div>
  `).join("");
}


/* ════════════════════════════════════════
   POPULATE COURSE DROPDOWN
   Fills the upload modal select element
   with all available textbooks
════════════════════════════════════════ */

function populateCourseDropdown() {
  const select = document.getElementById("upload-course-select");
  if (!select) return;

  select.innerHTML = `<option value="">— Select a course —</option>` +
    AppState.textbooks.map((book) =>
      `<option value="${book.id}">${book.name}</option>`
    ).join("");
}