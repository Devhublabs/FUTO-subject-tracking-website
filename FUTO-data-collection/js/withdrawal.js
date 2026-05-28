const WITHDRAWAL_MODAL_ID = "withdrawal-modal";

document.addEventListener("DOMContentLoaded", async () => {
  UI.page.init({ requireAuth: true });
  hydrateHeader();
  bindWithdrawalEvents();

  await loadWithdrawalPage();
});

async function loadWithdrawalPage() {
  const { data: profileData, error: profileError } = await apiGetProfile();
  if (profileError) {
    UI.toast.error(profileError);
    renderUnavailableState(profileError);
    return;
  }

  setUser(profileData);
  hydrateHeader();
  renderWithdrawalState();
  await loadWithdrawalHistory();
}

function hydrateHeader() {
  const avatar = document.getElementById("header-avatar");
  const tier = document.getElementById("header-tier");

  if (avatar) avatar.textContent = getUserInitials();
  if (tier) tier.textContent = `⭐ Tier ${AppState.user.tier || 1} — ${AppState.user.tierLabel || "Newcomer"}`;
}

function bindWithdrawalEvents() {
  document.getElementById("btn-withdraw")?.addEventListener("click", openWithdrawalModal);
  document.getElementById("btn-close-withdrawal-modal")?.addEventListener("click", closeWithdrawalModal);
  document.getElementById("btn-cancel-withdrawal")?.addEventListener("click", closeWithdrawalModal);
  document.getElementById("btn-refresh-history")?.addEventListener("click", loadWithdrawalHistory);
  document.getElementById("withdrawal-form")?.addEventListener("submit", handleWithdrawalSubmit);
  document.getElementById("withdrawal-amount")?.addEventListener("input", updateWithdrawalSummary);

  document.querySelectorAll('input[name="payment_method"]').forEach((input) => {
    input.addEventListener("change", renderPaymentFields);
  });

  document.getElementById("btn-logout")?.addEventListener("click", () => {
    handleLogout();
  });

  document.getElementById("btn-settings")?.addEventListener("click", () => {
    window.location.href = routeTo("settings");
  });
}

function renderWithdrawalState() {
  const balance = Number(AppState.user.balance || 0);
  const minimum = Number(AppState.MIN_WITHDRAWAL || 1000);
  const needed = Math.max(minimum - balance, 0);
  const progress = minimum > 0 ? Math.min((balance / minimum) * 100, 100) : 100;
  const isEligible = balance >= minimum;

  UI.dom.setText("withdrawal-balance", formatNaira(balance));
  UI.dom.setText(
    "withdrawal-page-desc",
    isEligible
      ? "Your balance is ready for withdrawal."
      : `You need ${formatNaira(needed)} more before you can withdraw.`
  );
  UI.dom.setText(
    "withdrawal-status",
    isEligible
      ? `You can withdraw up to ${formatNaira(balance)}.`
      : `Minimum withdrawal is ${formatNaira(minimum)}.`
  );
  UI.dom.setText(
    "withdrawal-progress-desc",
    isEligible
      ? "You have reached the minimum withdrawal amount."
      : `Earn ${formatNaira(needed)} more to unlock withdrawals.`
  );
  UI.dom.setText("withdrawal-progress-value", `${Math.round(progress)}%`);

  UI.progress.set("withdrawal-progress-fill", progress);

  const badge = document.getElementById("withdrawal-badge");
  if (badge) {
    badge.className = `badge ${isEligible ? "badge-primary" : "badge-warning"}`;
    badge.textContent = isEligible ? "Eligible" : `Need ${formatNaira(needed)}`;
  }

  const button = document.getElementById("btn-withdraw");
  if (button) {
    button.disabled = !isEligible;
    button.textContent = isEligible ? "Request Withdrawal" : `You need ${formatNaira(needed)} more`;
  }
}

function renderUnavailableState(message) {
  UI.dom.setText("withdrawal-balance", "—");
  UI.dom.setText("withdrawal-page-desc", "We could not load your withdrawal balance.");
  UI.dom.setText("withdrawal-status", message || "Please try again.");

  const button = document.getElementById("btn-withdraw");
  if (button) {
    button.disabled = true;
    button.textContent = "Withdrawal unavailable";
  }
}

async function loadWithdrawalHistory() {
  const historyWrap = document.getElementById("withdrawal-history");
  if (!historyWrap) return;

  historyWrap.innerHTML = `
    <div class="empty-state">
      <div class="loader-ring"></div>
      <p class="text-muted">Loading history...</p>
    </div>
  `;

  const { data, error } = await apiGetWithdrawalHistory();
  if (error) {
    historyWrap.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">!</div>
        <p class="text-muted">${escapeHTML(error)}</p>
      </div>
    `;
    UI.toast.error(error);
    return;
  }

  const history = Array.isArray(data) ? data : data?.history || data?.withdrawals || [];
  setWithdrawalHistory(history);
  renderWithdrawalHistory();
}

function renderWithdrawalHistory() {
  const historyWrap = document.getElementById("withdrawal-history");
  if (!historyWrap) return;

  if (!AppState.withdrawal.history.length) {
    historyWrap.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">₦</div>
        <h2 class="empty-state-title">No withdrawals yet</h2>
        <p class="empty-state-desc">Your payout requests will appear here.</p>
      </div>
    `;
    return;
  }

  historyWrap.innerHTML = AppState.withdrawal.history.map((item) => {
    const method = item.method || item.payment_method || "withdrawal";
    const status = item.status || "pending";
    const date = item.date || item.created_at || item.requested_at;
    const arrival = item.estimated_arrival || item.estimated_time || item.estimated_arrival_date;

    return `
      <article class="card card-sm row-between">
        <div>
          <div class="card-title">${formatNaira(item.amount)}</div>
          <div class="card-subtitle">${formatPaymentMethod(method)} · ${formatDate(date)}</div>
          ${arrival ? `<div class="card-subtitle">Est. arrival: ${escapeHTML(String(arrival))}</div>` : ""}
        </div>
        <span class="badge ${statusBadgeClass(status)}">${escapeHTML(formatStatus(status))}</span>
      </article>
    `;
  }).join("");
}

function openWithdrawalModal() {
  if (!canWithdraw()) return;

  const amountInput = document.getElementById("withdrawal-amount");
  if (amountInput) {
    amountInput.max = String(AppState.user.balance || AppState.MIN_WITHDRAWAL);
    amountInput.value = String(AppState.MIN_WITHDRAWAL);
  }

  UI.form.clearAll("withdrawal-form");
  renderPaymentFields();
  updateWithdrawalSummary();
  UI.modal.open(WITHDRAWAL_MODAL_ID);
}

function closeWithdrawalModal() {
  UI.modal.close(WITHDRAWAL_MODAL_ID);
}

function renderPaymentFields() {
  const method = getSelectedPaymentMethod();
  const isOpay = method === "opay";

  document.getElementById("opay-fields")?.classList.toggle("hidden", !isOpay);
  document.getElementById("bank-fields")?.classList.toggle("hidden", isOpay);
}

function updateWithdrawalSummary() {
  const amount = Number(document.getElementById("withdrawal-amount")?.value || 0);
  UI.dom.setText("withdrawal-summary-amount", formatNaira(amount));
}

async function handleWithdrawalSubmit(event) {
  event.preventDefault();

  if (!validateWithdrawalForm()) return;

  const submitBtn = document.getElementById("btn-confirm-withdrawal");
  const amount = Number(document.getElementById("withdrawal-amount").value);
  const method = getSelectedPaymentMethod();
  const paymentData = buildPaymentData(method);

  UI.form.setLoading(submitBtn, true);

  const requestResult = await apiRequestWithdrawal(amount, method);
  if (requestResult.error) {
    UI.form.setLoading(submitBtn, false, "Confirm Withdrawal");
    UI.toast.error(requestResult.error);
    return;
  }

  const transactionId =
    requestResult.data?.transaction_id ||
    requestResult.data?.transactionId ||
    requestResult.data?.id;

  if (!transactionId) {
    UI.form.setLoading(submitBtn, false, "Confirm Withdrawal");
    UI.toast.error("Withdrawal request was created, but no transaction ID was returned.");
    return;
  }

  AppState.withdrawal.pendingTransactionId = transactionId;
  AppState.withdrawal.pendingAmount = amount;
  AppState.withdrawal.pendingMethod = method;

  const confirmResult = await apiConfirmWithdrawal(transactionId, paymentData);
  UI.form.setLoading(submitBtn, false, "Confirm Withdrawal");

  if (confirmResult.error) {
    UI.toast.error(confirmResult.error);
    return;
  }

  UI.toast.success("Withdrawal request submitted.");
  closeWithdrawalModal();
  await loadWithdrawalPage();
}

function validateWithdrawalForm() {
  UI.form.clearAll("withdrawal-form");

  const amount = Number(document.getElementById("withdrawal-amount")?.value || 0);
  const balance = Number(AppState.user.balance || 0);
  const minimum = Number(AppState.MIN_WITHDRAWAL || 1000);
  const method = getSelectedPaymentMethod();
  let valid = true;

  if (!amount || amount < minimum) {
    UI.form.setError("withdrawal-amount", `Enter at least ${formatNaira(minimum)}.`);
    valid = false;
  } else if (amount > balance) {
    UI.form.setError("withdrawal-amount", `You can withdraw up to ${formatNaira(balance)}.`);
    valid = false;
  }

  if (method === "opay") {
    const account = document.getElementById("opay-account")?.value.trim();
    const name = document.getElementById("opay-name")?.value.trim();

    if (!account) {
      UI.form.setError("opay-account", "Enter your Opay phone or account number.");
      valid = false;
    }
    if (!name) {
      UI.form.setError("opay-name", "Enter your Opay account name.");
      valid = false;
    }
  }

  if (method === "bank_transfer") {
    const bank = document.getElementById("bank-name")?.value.trim();
    const account = document.getElementById("bank-account")?.value.trim();
    const name = document.getElementById("bank-account-name")?.value.trim();

    if (!bank) {
      UI.form.setError("bank-name", "Enter your bank name.");
      valid = false;
    }
    if (!/^\d{10}$/.test(account || "")) {
      UI.form.setError("bank-account", "Enter a valid 10-digit account number.");
      valid = false;
    }
    if (!name) {
      UI.form.setError("bank-account-name", "Enter your bank account name.");
      valid = false;
    }
  }

  return valid;
}

function getSelectedPaymentMethod() {
  return document.querySelector('input[name="payment_method"]:checked')?.value || "opay";
}

function buildPaymentData(method) {
  if (method === "opay") {
    return {
      method,
      account_number: document.getElementById("opay-account").value.trim(),
      account_name: document.getElementById("opay-name").value.trim(),
    };
  }

  return {
    method,
    bank_name: document.getElementById("bank-name").value.trim(),
    account_number: document.getElementById("bank-account").value.trim(),
    account_name: document.getElementById("bank-account-name").value.trim(),
  };
}

function formatPaymentMethod(method) {
  const normalised = String(method || "").toLowerCase();
  if (normalised === "opay") return "Opay";
  if (normalised === "bank_transfer" || normalised === "bank transfer") return "Bank Transfer";
  return escapeHTML(String(method || "Withdrawal"));
}

function formatStatus(status) {
  return String(status || "pending")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function statusBadgeClass(status) {
  const normalised = String(status || "").toLowerCase();
  if (["paid", "success", "successful", "completed", "confirmed"].includes(normalised)) {
    return "badge-primary";
  }
  if (["failed", "rejected", "cancelled", "canceled"].includes(normalised)) {
    return "badge-danger";
  }
  if (["processing", "pending", "requested"].includes(normalised)) {
    return "badge-warning";
  }
  return "badge-muted";
}

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
