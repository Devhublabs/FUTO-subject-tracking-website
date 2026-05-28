/* ============================================================
   UPLOAD.JS — Multi-step Upload Flow
   FUTO Data Collection Platform
   ============================================================
   Steps:
   1 — Book selection
   2 — Camera / file input (drag-drop + picker)
   3 — Processing loader (animated status messages)
   4a — Manual page number (OCR failed)
   4b — Result screen (PASS / FAIL / DUPLICATE)
   ============================================================ */

let currentStep = 1;
let processingCycleId = null;

const PROCESSING_MESSAGES = [
  "Checking brightness…",
  "Detecting blur…",
  "Reading text…",
];


document.addEventListener("DOMContentLoaded", async () => {
  UI.page.init({ requireAuth: true });

  const { data: profileData, error: profileError } = await apiGetProfile();
  if (profileError) {
    UI.toast.error(profileError);
    return;
  }
  setUser(profileData);

  if (!canUploadToday()) {
    UI.toast.warning("Daily upload quota reached. Come back tomorrow.");
    window.location.href = routeTo("dashboard");
    return;
  }

  const { data: textbooksData, error: textbooksError } = await apiGetTextbooks();
  if (textbooksError) {
    UI.toast.error(textbooksError);
    return;
  }
  setTextbooks(textbooksData);
  renderBookList();

  const params = new URLSearchParams(window.location.search);
  const preselectedBook = params.get("book");
  const preselectedPage = parseInt(params.get("page"), 10);

  if (preselectedBook) {
    const book = getTextbookById(preselectedBook);
    if (book) {
      if (preselectedPage > 0) {
        setUploadSession({ manualPage: preselectedPage });
      }
      selectBook(book.id, book.name);
      if (preselectedPage > 0) {
        const pageInput = document.getElementById("upload-manual-page");
        if (pageInput) pageInput.value = String(preselectedPage);
      }
    }
  }

  wireFileInput();
  wireStepActions();
});


/* ════════════════════════════════════════
   STEP NAVIGATION
════════════════════════════════════════ */

function goToStep(step) {
  currentStep = step;
  setUploadSession({ step: typeof step === "number" ? step : 4 });

  document.querySelectorAll("[data-step]").forEach((el) => {
    el.classList.toggle("hidden", el.dataset.step !== String(step));
  });

  updateStepDots(step);

  if (step === 2) {
    const label = document.getElementById("step-2-book-label");
    if (label && AppState.upload.selectedBookName) {
      label.textContent = AppState.upload.manualPage
        ? `${AppState.upload.selectedBookName} · Page ${AppState.upload.manualPage}`
        : AppState.upload.selectedBookName;
    }
  }

  if (step === "4a" && AppState.upload.manualPage) {
    const pageInput = document.getElementById("upload-manual-page");
    if (pageInput) pageInput.value = String(AppState.upload.manualPage);
  }
}

function updateStepDots(step) {
  const dotStep = step === "4a" || step === "4b" ? 4 : Number(step);

  document.querySelectorAll("#upload-step-dots .step-dot").forEach((dot) => {
    const n = parseInt(dot.dataset.dot, 10);
    dot.classList.remove("active", "done");
    if (n < dotStep) dot.classList.add("done");
    if (n === dotStep) dot.classList.add("active");
  });
}


/* ════════════════════════════════════════
   STEP 1 — BOOK SELECTION
════════════════════════════════════════ */

function renderBookList() {
  const list = document.getElementById("upload-book-list");
  if (!list) return;

  if (AppState.textbooks.length === 0) {
    list.innerHTML = `<p class="text-muted">No textbooks available.</p>`;
    return;
  }

  list.innerHTML = AppState.textbooks.map((book) => `
    <div class="book-card card-clickable" data-book-id="${book.id}" role="button" tabindex="0">
      <div class="book-card-header">
        <div class="book-icon">📚</div>
        <div class="book-info">
          <div class="book-title">${escapeHtml(book.name)}</div>
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
    </div>
  `).join("");

  list.querySelectorAll(".book-card[data-book-id]").forEach((card) => {
    const pick = () => {
      const book = getTextbookById(card.dataset.bookId);
      if (book) selectBook(book.id, book.name);
    };
    card.addEventListener("click", pick);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        pick();
      }
    });
  });
}

function selectBook(bookId, bookName) {
  setUploadSession({
    selectedBookId:   bookId,
    selectedBookName: bookName,
  });
  goToStep(2);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}


/* ════════════════════════════════════════
   STEP 2 — FILE INPUT
════════════════════════════════════════ */

function wireFileInput() {
  const dropzone  = document.getElementById("upload-dropzone");
  const fileInput = document.getElementById("upload-file-input");
  const preview   = document.getElementById("upload-preview");
  const previewWrap = document.getElementById("upload-preview-wrap");
  const changeBtn = document.getElementById("btn-change-file");

  if (!dropzone || !fileInput) return;

  const openPicker = () => fileInput.click();

  dropzone.addEventListener("click", openPicker);
  dropzone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openPicker();
    }
  });

  changeBtn?.addEventListener("click", openPicker);

  dropzone.addEventListener("dragover", (e) => e.preventDefault());

  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFileSelected(file);
  });

  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (file) handleFileSelected(file);
  });
}

function handleFileSelected(file) {
  if (!file.type.startsWith("image/")) {
    UI.toast.error("Please select a valid image file (JPG, PNG, or WebP).");
    return;
  }

  if (!AppState.upload.selectedBookId) {
    UI.toast.error("Please select a textbook first.");
    goToStep(1);
    return;
  }

  setUploadSession({ imageFile: file });

  const preview     = document.getElementById("upload-preview");
  const previewWrap = document.getElementById("upload-preview-wrap");
  const dropzone    = document.getElementById("upload-dropzone");

  const reader = new FileReader();
  reader.onload = (e) => {
    preview.src = e.target.result;
    previewWrap.classList.remove("hidden");
    dropzone.classList.add("hidden");
  };
  reader.readAsDataURL(file);

  processUpload(file, AppState.upload.manualPage || null);
}


/* ════════════════════════════════════════
   STEP 3 — PROCESSING + API CALL
════════════════════════════════════════ */

async function processUpload(imageFile, pageNumber) {
  goToStep(3);
  startProcessingAnimation();

  const { data, error } = await apiUploadImage(
    imageFile,
    AppState.upload.selectedBookId,
    pageNumber
  );

  stopProcessingAnimation();

  if (error) {
    showResult("fail", { reason: error });
    return;
  }

  handleUploadResponse(data, imageFile);
}

function startProcessingAnimation() {
  const statusEl = document.getElementById("upload-processing-status");
  const checklist = document.getElementById("upload-processing-checklist");

  let index = 0;
  if (statusEl) statusEl.textContent = PROCESSING_MESSAGES[0];

  updateChecklistItems(checklist, 0);

  processingCycleId = setInterval(() => {
    index++;
    if (index >= PROCESSING_MESSAGES.length) {
      clearInterval(processingCycleId);
      processingCycleId = null;
      return;
    }

    if (statusEl) statusEl.textContent = PROCESSING_MESSAGES[index];
    updateChecklistItems(checklist, index);
  }, 900);
}

function updateChecklistItems(checklist, activeIndex) {
  checklist?.querySelectorAll("p").forEach((item, i) => {
    item.className = i < activeIndex ? "text-muted" : i === activeIndex ? "text-primary" : "text-muted";
  });
}

function stopProcessingAnimation() {
  if (processingCycleId) {
    clearInterval(processingCycleId);
    processingCycleId = null;
  }

  const checklist = document.getElementById("upload-processing-checklist");
  checklist?.querySelectorAll("p").forEach((item) => {
    item.className = "text-muted";
  });
}


/* ════════════════════════════════════════
   RESPONSE HANDLING
════════════════════════════════════════ */

function classifyUploadResult(data) {
  if (!data) return "fail";

  if (
    data.is_duplicate === true ||
    data.status === "duplicate" ||
    /duplicate/i.test(data.reason || "")
  ) {
    return "duplicate";
  }

  if (data.quality_passed) return "pass";

  if (
    data.needs_page_number === true ||
    data.page_required === true ||
    data.ocr_failed === true ||
    (data.detected_page == null && data.requires_page_number === true)
  ) {
    return "needs_page";
  }

  return "fail";
}

function handleUploadResponse(data, imageFile) {
  const resultType = classifyUploadResult(data);

  setUploadSession({
    lastResult:     resultType === "pass" ? "pass" : resultType === "duplicate" ? "duplicate" : "fail",
    lastResultData: data,
    detectedPage:   data.detected_page ?? null,
  });

  if (resultType === "needs_page") {
    goToStep("4a");
    return;
  }

  if (resultType === "pass") {
    applyPassUpdates(data);
  }

  showResult(resultType, data);

  if (resultType === "pass" || resultType === "duplicate") {
    resetFileInput();
  }
}

function applyPassUpdates(data) {
  const newQuota = data.daily_quota_remaining != null
    ? data.daily_quota_remaining
    : Math.max(0, AppState.user.dailyQuotaRemaining - 1);
  setBalanceAndQuota(data.new_balance ?? AppState.user.balance, newQuota);

  if (data.textbook_progress && AppState.upload.selectedBookId) {
    updateTextbookProgress(AppState.upload.selectedBookId, data.textbook_progress);
  }
}


/* ════════════════════════════════════════
   STEP 4a — MANUAL PAGE NUMBER
════════════════════════════════════════ */

function wireStepActions() {
  document.getElementById("btn-submit-page")?.addEventListener("click", async () => {
    const pageInput = document.getElementById("upload-manual-page");
    const pageNum   = parseInt(pageInput?.value, 10);

    if (!pageNum || pageNum < 1) {
      UI.toast.error("Please enter a valid page number.");
      return;
    }

    setUploadSession({ manualPage: pageNum });

    const file = AppState.upload.imageFile;
    if (!file) {
      UI.toast.error("No image found. Please select a file again.");
      goToStep(2);
      return;
    }

    await processUpload(file, pageNum);
  });

  document.getElementById("btn-upload-another")?.addEventListener("click", () => {
    if (!canUploadToday()) {
      UI.toast.warning("Daily quota reached.");
      window.location.href = routeTo("dashboard");
      return;
    }
    resetFlow();
  });
}

function resetFlow() {
  clearUploadSession();
  currentStep = 1;
  resetFileInput();

  const preselectedBook = new URLSearchParams(window.location.search).get("book");
  if (preselectedBook) {
    const book = getTextbookById(preselectedBook);
    if (book) {
      selectBook(book.id, book.name);
      return;
    }
  }

  goToStep(1);
}

function resetFileInput() {
  const fileInput   = document.getElementById("upload-file-input");
  const previewWrap = document.getElementById("upload-preview-wrap");
  const dropzone    = document.getElementById("upload-dropzone");
  const pageInput   = document.getElementById("upload-manual-page");

  if (fileInput) fileInput.value = "";
  previewWrap?.classList.add("hidden");
  dropzone?.classList.remove("hidden");
  if (pageInput) pageInput.value = "";
}


/* ════════════════════════════════════════
   STEP 4b — RESULT SCREEN
════════════════════════════════════════ */

function showResult(type, data) {
  goToStep("4b");

  const icon    = document.getElementById("upload-result-icon");
  const title   = document.getElementById("upload-result-title");
  const message = document.getElementById("upload-result-message");
  const detail  = document.getElementById("upload-result-detail");

  title.classList.remove("text-primary", "text-danger", "text-warning");

  if (type === "pass") {
    title.classList.add("text-primary");
    icon.textContent    = "✅";
    title.textContent   = "Page Accepted";
    message.textContent = "Your upload passed all quality checks.";
    detail.textContent  = data.amount_earned
      ? `You earned ${formatNaira(data.amount_earned)}. New balance: ${formatNaira(data.new_balance ?? AppState.user.balance)}.`
      : "";
  } else if (type === "duplicate") {
    title.classList.add("text-warning");
    icon.textContent    = "⚠️";
    title.textContent   = "Duplicate Page";
    message.textContent = "This page has already been uploaded for this textbook.";
    detail.textContent  = data.reason || data.detected_page
      ? `Page ${data.detected_page || "—"} is already in the system.`
      : "";
  } else {
    title.classList.add("text-danger");
    icon.textContent    = "❌";
    title.textContent   = "Upload Failed";
    message.textContent = "Your image did not pass quality checks.";
    detail.textContent  = data.reason || "Try again with a clearer, well-lit photo.";
  }
}
