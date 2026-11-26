/**
 * LeadForge — HR app prototype (Track 02) behaviour.
 *
 * Client-side only. Demonstrates the prioritised HR feature set with state
 * kept in localStorage, so the design can be clicked through without a
 * backend. Nothing is transmitted anywhere.
 */
(() => {
  const root = document.querySelector("[data-hrapp]");
  if (!root) return;

  const KEY = "leadforge.hrapp.v1";
  const read = () => {
    try { return JSON.parse(window.localStorage.getItem(KEY) || "{}"); } catch (error) { return {}; }
  };
  const save = () => {
    try { window.localStorage.setItem(KEY, JSON.stringify(state)); } catch (error) { /* storage unavailable */ }
  };

  const state = Object.assign({
    role: "employee",
    tab: "dashboard",
    onboard: {},
    clockIn: null,
    logs: [],
    plan: "",
    goals: {},
    read: {}
  }, read());

  const $ = (selector) => root.querySelector(selector);
  const $$ = (selector) => [...root.querySelectorAll(selector)];
  const fmtTime = (stamp) => new Date(stamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  /* ---------------- tabs ---------------- */
  const tabs = $$("[data-hr-tab]");
  const panels = $$("[data-hr-panel]");

  function selectTab(name) {
    const target = tabs.find((tab) => tab.dataset.hrTab === name) || tabs[0];
    if (!target) return;
    tabs.forEach((tab) => tab.setAttribute("aria-selected", String(tab === target)));
    panels.forEach((panel) => { panel.hidden = panel.dataset.hrPanel !== target.dataset.hrTab; });
    const title = $("[data-hr-tab-title]");
    if (title) title.textContent = (target.childNodes[0]?.textContent || "").trim();
    state.tab = target.dataset.hrTab;
    save();
  }

  tabs.forEach((tab) => tab.addEventListener("click", () => selectTab(tab.dataset.hrTab)));

  /* ---------------- role ---------------- */
  const roleSelect = $("[data-hr-role]");

  function applyRole() {
    $$("[data-role-only]").forEach((node) => {
      node.hidden = node.dataset.roleOnly !== state.role;
    });
    $$("[data-role-text]").forEach((node) => {
      node.textContent = state.role === "hr" ? "HR manager" : "Employee";
    });
    const active = tabs.find((tab) => tab.getAttribute("aria-selected") === "true");
    if (!active || active.hidden) selectTab("dashboard");
  }

  if (roleSelect) {
    roleSelect.value = state.role;
    roleSelect.addEventListener("change", () => {
      state.role = roleSelect.value;
      save();
      applyRole();
    });
  }

  /* ---------------- onboarding (P0) ---------------- */
  const onboardBoxes = $$("[data-onboard]");

  function renderOnboard() {
    let done = 0;
    onboardBoxes.forEach((box) => {
      const on = !!state.onboard[box.dataset.onboard];
      box.checked = on;
      box.closest(".task")?.classList.toggle("is-done", on);
      if (on) done += 1;
    });
    const pct = onboardBoxes.length ? Math.round((done / onboardBoxes.length) * 100) : 0;
    const bar = $("[data-onboard-progress]");
    if (bar) bar.style.width = `${pct}%`;
    const out = $("[data-onboard-out]");
    if (out) out.textContent = `${done} of ${onboardBoxes.length} complete`;
    const badge = $("[data-onboard-badge]");
    if (badge) badge.textContent = String(onboardBoxes.length - done);
    renderReports();
  }

  onboardBoxes.forEach((box) => box.addEventListener("change", () => {
    state.onboard[box.dataset.onboard] = box.checked;
    save();
    renderOnboard();
  }));

  /* ---------------- time and attendance (P0) ---------------- */
  const clockButton = $("[data-clock-btn]");
  const logList = $("[data-clock-log]");

  const elapsed = (from) => {
    const minutes = Math.max(0, Math.floor((Date.now() - from) / 60000));
    return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
  };

  function tickClock() {
    const time = $("[data-clock-time]");
    if (time) time.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const sub = $("[data-clock-sub]");
    if (sub) sub.textContent = state.clockIn ? `Since ${fmtTime(state.clockIn)} · ${elapsed(state.clockIn)}` : "Not clocked in";
  }

  function renderClock() {
    if (clockButton) clockButton.textContent = state.clockIn ? "Clock out" : "Clock in";
    if (logList) {
      logList.innerHTML = state.logs.length
        ? state.logs.slice(-6).reverse().map((entry) => `<li><span>${entry.label}</span><b>${fmtTime(entry.at)}</b></li>`).join("")
        : '<li><span>No entries yet today.</span></li>';
    }
    tickClock();
  }

  clockButton?.addEventListener("click", () => {
    if (state.clockIn) {
      state.logs.push({ label: "Clocked out", at: Date.now() });
      state.clockIn = null;
    } else {
      state.clockIn = Date.now();
      state.logs.push({ label: "Clocked in", at: state.clockIn });
    }
    save();
    renderClock();
  });

  /* ---------------- benefits (P0) ---------------- */
  function renderPlans() {
    $$("[data-plan]").forEach((button) => {
      const on = button.dataset.plan === state.plan;
      button.setAttribute("aria-pressed", String(on));
      button.classList.toggle("ghost", !on);
      button.textContent = on ? "Selected ✓" : "Choose plan";
    });
  }

  $$("[data-plan]").forEach((button) => button.addEventListener("click", () => {
    state.plan = button.dataset.plan;
    save();
    renderPlans();
  }));

  /* ---------------- performance (P1) ---------------- */
  const goalSelects = $$("[data-goal]");

  goalSelects.forEach((select) => {
    select.value = state.goals[select.dataset.goal] || "not-started";
    select.addEventListener("change", () => {
      state.goals[select.dataset.goal] = select.value;
      save();
      renderReports();
    });
  });

  /* ---------------- communication (P1) ---------------- */
  const noteButtons = $$("[data-note]");

  function renderNotes() {
    let unread = 0;
    noteButtons.forEach((button) => {
      const id = button.dataset.note;
      const on = !!state.read[id];
      button.closest(".note-item")?.classList.toggle("is-read", on);
      button.textContent = on ? "Read" : "Mark as read";
      button.disabled = on;
      if (!on) unread += 1;
    });
    const badge = $("[data-note-badge]");
    if (badge) badge.textContent = String(unread);
    renderReports();
  }

  noteButtons.forEach((button) => button.addEventListener("click", () => {
    state.read[button.dataset.note] = true;
    save();
    renderNotes();
  }));

  /* ---------------- reporting and analytics (P1) ---------------- */
  function setBar(key, value) {
    const fill = $(`[data-bar="${key}"]`);
    const out = $(`[data-bar-out="${key}"]`);
    if (fill) fill.style.width = `${value}%`;
    if (out) out.textContent = `${value}%`;
  }

  function renderReports() {
    const onboardDone = Object.values(state.onboard).filter(Boolean).length;
    setBar("onboard", onboardBoxes.length ? Math.round((onboardDone / onboardBoxes.length) * 100) : 0);
    const goalsDone = goalSelects.filter((select) => select.value === "done").length;
    setBar("goals", goalSelects.length ? Math.round((goalsDone / goalSelects.length) * 100) : 0);
    const readCount = Object.values(state.read).filter(Boolean).length;
    setBar("notes", noteButtons.length ? Math.round((readCount / noteButtons.length) * 100) : 0);
  }

  /* ---------------- boot ---------------- */
  applyRole();
  selectTab(state.tab);
  renderOnboard();
  renderClock();
  renderPlans();
  renderNotes();
  renderReports();
  window.setInterval(tickClock, 1000);
})();
