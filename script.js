const USERS = {
  user: { username: "user", password: "user123" },
  admin: { username: "admin", password: "admin123" }
};

const defaultSettings = {
  companyName: "Neon Ledger Inc.",
  fiscalYear: new Date().getFullYear(),
  currency: "USD",
  taxRate: 8.5
};

const state = {
  activeRole: null,
  activeUser: null,
  records: load("records", []),
  settings: load("settings", defaultSettings),
  search: ""
};

const loginView = document.getElementById("loginView");
const dashboardView = document.getElementById("dashboardView");
const adminView = document.getElementById("adminView");
const sessionInfo = document.getElementById("sessionInfo");
const logoutBtn = document.getElementById("logoutBtn");
const loginMessage = document.getElementById("loginMessage");
const settingsMessage = document.getElementById("settingsMessage");
const companyTitle = document.getElementById("companyTitle");

const loginForm = document.getElementById("loginForm");
const recordForm = document.getElementById("recordForm");
const settingsForm = document.getElementById("settingsForm");

const searchInput = document.getElementById("searchInput");
const recordBody = document.getElementById("recordBody");

const revenueValue = document.getElementById("revenueValue");
const expenseValue = document.getElementById("expenseValue");
const netValue = document.getElementById("netValue");

loginForm.addEventListener("submit", handleLogin);
recordForm.addEventListener("submit", handleRecordCreate);
settingsForm.addEventListener("submit", handleSettingsSave);
logoutBtn.addEventListener("click", logout);
searchInput.addEventListener("input", () => {
  state.search = searchInput.value.trim().toLowerCase();
  renderRecords();
});

bootstrap();

function bootstrap() {
  const existingSession = load("session", null);
  if (existingSession?.role && existingSession?.user) {
    state.activeRole = existingSession.role;
    state.activeUser = existingSession.user;
    showDashboard();
  } else {
    showLogin();
  }
}

function handleLogin(event) {
  event.preventDefault();
  const formData = new FormData(loginForm);
  const role = formData.get("role");
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "");
  const expected = USERS[role];

  if (!expected || username !== expected.username || password !== expected.password) {
    loginMessage.textContent = "Invalid credentials. Please try again.";
    return;
  }

  loginMessage.textContent = "";
  state.activeRole = role;
  state.activeUser = username;
  save("session", { role, user: username });
  showDashboard();
}

function handleRecordCreate(event) {
  event.preventDefault();
  if (!state.activeUser) return;

  const date = document.getElementById("entryDate").value;
  const type = document.getElementById("entryType").value;
  const category = document.getElementById("entryCategory").value.trim();
  const amount = Number(document.getElementById("entryAmount").value);
  const note = document.getElementById("entryNote").value.trim();

  if (!date || !category || !Number.isFinite(amount) || amount < 0) return;

  state.records.unshift({
    id: crypto.randomUUID(),
    date,
    type,
    category,
    amount,
    note
  });
  save("records", state.records);

  recordForm.reset();
  document.getElementById("entryDate").valueAsDate = new Date();
  renderRecords();
  renderKpis();
}

function handleSettingsSave(event) {
  event.preventDefault();
  if (state.activeRole !== "admin") return;

  const companyName = document.getElementById("companyName").value.trim();
  const fiscalYear = Number(document.getElementById("fiscalYear").value);
  const currency = document.getElementById("currency").value.trim().toUpperCase();
  const taxRate = Number(document.getElementById("taxRate").value);

  if (!companyName || !currency || !Number.isFinite(fiscalYear) || !Number.isFinite(taxRate)) {
    settingsMessage.textContent = "Please enter valid settings values.";
    return;
  }

  state.settings = { companyName, fiscalYear, currency, taxRate };
  save("settings", state.settings);
  settingsMessage.textContent = "Settings saved.";
  renderHeader();
  renderKpis();
}

function showLogin() {
  loginView.classList.remove("hidden");
  dashboardView.classList.add("hidden");
  sessionInfo.classList.add("hidden");
  logoutBtn.classList.add("hidden");
}

function showDashboard() {
  loginView.classList.add("hidden");
  dashboardView.classList.remove("hidden");
  sessionInfo.classList.remove("hidden");
  logoutBtn.classList.remove("hidden");
  adminView.classList.toggle("hidden", state.activeRole !== "admin");

  settingsMessage.textContent = "";
  document.getElementById("entryDate").valueAsDate = new Date();
  renderHeader();
  renderKpis();
  renderRecords();
  renderSettingsForm();
}

function logout() {
  state.activeRole = null;
  state.activeUser = null;
  save("session", null);
  showLogin();
}

function renderHeader() {
  companyTitle.textContent = `${state.settings.companyName} — Company Overview`;
  sessionInfo.textContent = `Logged in as ${state.activeUser} (${state.activeRole}) | FY ${state.settings.fiscalYear}`;
}

function renderKpis() {
  const totals = state.records.reduce(
    (acc, record) => {
      if (record.type === "revenue") acc.revenue += record.amount;
      if (record.type === "expense") acc.expense += record.amount;
      return acc;
    },
    { revenue: 0, expense: 0 }
  );

  revenueValue.textContent = formatMoney(totals.revenue);
  expenseValue.textContent = formatMoney(totals.expense);
  netValue.textContent = formatMoney(totals.revenue - totals.expense);
}

function renderRecords() {
  const filtered = state.records.filter((record) => {
    if (!state.search) return true;
    return `${record.category} ${record.note}`.toLowerCase().includes(state.search);
  });

  recordBody.innerHTML = "";
  for (const record of filtered) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(record.date)}</td>
      <td>${escapeHtml(record.type)}</td>
      <td>${escapeHtml(record.category)}</td>
      <td>${escapeHtml(formatMoney(record.amount))}</td>
      <td>${escapeHtml(record.note || "-")}</td>
      <td><button class="action-btn" data-id="${record.id}">Delete</button></td>
    `;
    const button = row.querySelector("button");
    button.addEventListener("click", () => deleteRecord(record.id));
    recordBody.appendChild(row);
  }
}

function deleteRecord(id) {
  state.records = state.records.filter((record) => record.id !== id);
  save("records", state.records);
  renderRecords();
  renderKpis();
}

function renderSettingsForm() {
  if (state.activeRole !== "admin") return;
  document.getElementById("companyName").value = state.settings.companyName;
  document.getElementById("fiscalYear").value = String(state.settings.fiscalYear);
  document.getElementById("currency").value = state.settings.currency;
  document.getElementById("taxRate").value = String(state.settings.taxRate);
}

function formatMoney(value) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: state.settings.currency || "USD"
  }).format(value || 0);
}

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(`db.${key}`);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function save(key, value) {
  if (value === null) {
    localStorage.removeItem(`db.${key}`);
    return;
  }
  localStorage.setItem(`db.${key}`, JSON.stringify(value));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
