document.addEventListener("DOMContentLoaded", async () => {
  UI.page.init({ requireAuth: true });
  hydrateSettingsHeader();
  bindSettingsEvents();

  await loadSettingsProfile();
  await loadPaymentMethods();
});

function bindSettingsEvents() {
  document.getElementById("settings-profile-form")?.addEventListener("submit", handleProfileSave);
  document.getElementById("payment-method-form")?.addEventListener("submit", handlePaymentMethodSave);
  document.getElementById("payment-method-type")?.addEventListener("change", renderPaymentMethodFields);
  document.getElementById("btn-refresh-methods")?.addEventListener("click", loadPaymentMethods);
  document.getElementById("btn-logout")?.addEventListener("click", () => handleLogout());
  document.getElementById("btn-settings-logout")?.addEventListener("click", () => handleLogout());
}

async function loadSettingsProfile() {
  const { data, error } = await apiGetProfile();
  if (error) {
    UI.toast.error(error);
    return;
  }

  setUser(data);
  hydrateSettingsHeader();
  fillProfileForm();
}

function fillProfileForm() {
  const name = document.getElementById("settings-name");
  const phone = document.getElementById("settings-phone");
  const email = document.getElementById("settings-email");

  if (name) name.value = AppState.user.name || "";
  if (phone) phone.value = AppState.user.phone || "";
  if (email) email.value = AppState.user.email || "";
}

async function handleProfileSave(event) {
  event.preventDefault();

  if (!validateProfileForm()) return;

  const name = document.getElementById("settings-name").value.trim();
  const phone = document.getElementById("settings-phone").value.trim();
  const saveBtn = document.getElementById("btn-save-profile");

  UI.form.setLoading(saveBtn, true);
  const { data, error } = await apiUpdateProfile(name, phone);
  UI.form.setLoading(saveBtn, false, "Save Changes");

  if (error) {
    UI.toast.error(error);
    return;
  }

  setUser({
    user_id: AppState.user.id,
    email: AppState.user.email,
    tier: AppState.user.tier,
    balance: AppState.user.balance,
    lifetime_earnings: AppState.user.lifetimeEarnings,
    daily_quota_remaining: AppState.user.dailyQuotaRemaining,
    ...(data || {}),
    name,
    phone,
  });

  hydrateSettingsHeader();
  UI.toast.success("Profile updated.");
}

function validateProfileForm() {
  UI.form.clearAll("settings-profile-form");

  const name = document.getElementById("settings-name")?.value.trim();
  const phone = document.getElementById("settings-phone")?.value.trim();
  let valid = true;

  if (!name || name.length < 2) {
    UI.form.setError("settings-name", "Enter your full name.");
    valid = false;
  }

  if (phone && !UI.form.isValidPhone(phone)) {
    UI.form.setError("settings-phone", "Enter a valid Nigerian phone number.");
    valid = false;
  }

  return valid;
}

async function loadPaymentMethods() {
  const list = document.getElementById("payment-methods-list");
  if (!list) return;

  list.innerHTML = `
    <div class="empty-state">
      <div class="loader-ring"></div>
      <p class="text-muted">Loading payment methods...</p>
    </div>
  `;

  const { data, error } = await apiGetPaymentMethods();
  if (error) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">!</div>
        <p class="text-muted">${escapeHTML(error)}</p>
      </div>
    `;
    UI.toast.error(error);
    return;
  }

  renderPaymentMethods(Array.isArray(data) ? data : data?.payment_methods || data?.methods || []);
}

function renderPaymentMethods(methods) {
  const list = document.getElementById("payment-methods-list");
  if (!list) return;

  if (!methods.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">💳</div>
        <h2 class="empty-state-title">No saved methods</h2>
        <p class="empty-state-desc">Add Opay or a bank account for withdrawals.</p>
      </div>
    `;
    return;
  }

  list.innerHTML = methods.map((method) => {
    const type = method.type || method.payment_method || "payment";
    const label = formatPaymentMethod(type);
    const details = method.last_4
      ? `Ending in ${escapeHTML(method.last_4)}`
      : method.account_name || method.bank_name || method.account_number || "Saved for withdrawals";

    return `
      <article class="card card-sm row-between">
        <div>
          <div class="card-title">${label}</div>
          <div class="card-subtitle">${escapeHTML(details)}</div>
        </div>
        ${method.default ? '<span class="badge badge-primary">Default</span>' : '<span class="badge badge-muted">Saved</span>'}
      </article>
    `;
  }).join("");
}

async function handlePaymentMethodSave(event) {
  event.preventDefault();

  if (!validatePaymentMethodForm()) return;

  const type = document.getElementById("payment-method-type").value;
  const details = buildPaymentMethodDetails(type);
  const saveBtn = document.getElementById("btn-add-payment-method");

  UI.form.setLoading(saveBtn, true);
  const { error } = await apiAddPaymentMethod(type, details);
  UI.form.setLoading(saveBtn, false, "Save Payment Method");

  if (error) {
    UI.toast.error(error);
    return;
  }

  UI.toast.success("Payment method saved.");
  document.getElementById("payment-method-form")?.reset();
  renderPaymentMethodFields();
  await loadPaymentMethods();
}

function validatePaymentMethodForm() {
  UI.form.clearAll("payment-method-form");

  const type = document.getElementById("payment-method-type")?.value;
  let valid = true;

  if (type === "opay") {
    const account = document.getElementById("settings-opay-account")?.value.trim();
    const name = document.getElementById("settings-opay-name")?.value.trim();

    if (!account) {
      UI.form.setError("settings-opay-account", "Enter your Opay phone or account number.");
      valid = false;
    }
    if (!name) {
      UI.form.setError("settings-opay-name", "Enter your Opay account name.");
      valid = false;
    }
  }

  if (type === "bank_transfer") {
    const bank = document.getElementById("settings-bank-name")?.value.trim();
    const account = document.getElementById("settings-bank-account")?.value.trim();
    const name = document.getElementById("settings-bank-account-name")?.value.trim();

    if (!bank) {
      UI.form.setError("settings-bank-name", "Enter your bank name.");
      valid = false;
    }
    if (!/^\d{10}$/.test(account || "")) {
      UI.form.setError("settings-bank-account", "Enter a valid 10-digit account number.");
      valid = false;
    }
    if (!name) {
      UI.form.setError("settings-bank-account-name", "Enter your bank account name.");
      valid = false;
    }
  }

  return valid;
}

function renderPaymentMethodFields() {
  const type = document.getElementById("payment-method-type")?.value || "opay";
  document.getElementById("opay-method-fields")?.classList.toggle("hidden", type !== "opay");
  document.getElementById("bank-method-fields")?.classList.toggle("hidden", type !== "bank_transfer");
}

function buildPaymentMethodDetails(type) {
  if (type === "opay") {
    return {
      account_number: document.getElementById("settings-opay-account").value.trim(),
      account_name: document.getElementById("settings-opay-name").value.trim(),
    };
  }

  return {
    bank_name: document.getElementById("settings-bank-name").value.trim(),
    account_number: document.getElementById("settings-bank-account").value.trim(),
    account_name: document.getElementById("settings-bank-account-name").value.trim(),
  };
}

function hydrateSettingsHeader() {
  const avatar = document.getElementById("header-avatar");
  const tier = document.getElementById("header-tier");

  if (avatar) avatar.textContent = getUserInitials();
  if (tier) tier.textContent = `⭐ Tier ${AppState.user.tier || 1} — ${AppState.user.tierLabel || "Newcomer"}`;
}

function formatPaymentMethod(type) {
  const normalised = String(type || "").toLowerCase();
  if (normalised === "opay") return "Opay";
  if (normalised === "bank_transfer" || normalised === "bank transfer") return "Bank Transfer";
  return escapeHTML(String(type || "Payment Method"));
}

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
