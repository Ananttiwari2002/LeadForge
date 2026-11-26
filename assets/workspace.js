/**
 * LeadForge — interactive qualification workspace.
 * Binds the controls on workspace.html to the LeadForge engine.
 */
(() => {
  const root = document.querySelector("[data-ws]");
  if (!root || !window.LeadForge) return;

  const LF = window.LeadForge;
  const $ = (selector) => root.querySelector(selector);
  const $$ = (selector) => [...root.querySelectorAll(selector)];
  const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[character]));

  let leads = LF.loadLeads();
  const weights = { ...LF.DEFAULT_WEIGHTS };
  let visibleRows = [];

  /* ---------- populate selects from the single source of truth ---------- */
  const fill = (select, items, includeAny) => {
    if (!select) return;
    const options = items.map((item) => `<option value="${item.id}">${escapeHTML(item.label)}</option>`);
    select.innerHTML = (includeAny ? '<option value="all">All states</option>' : "") + options.join("");
  };
  fill($("[data-ws-sector]"), LF.SECTORS);
  fill($("[data-ws-size]"), LF.SIZES);
  fill($("[data-ws-region]"), LF.REGIONS);
  fill($("[data-ws-state]"), LF.STATES, true);

  if ($("[data-ws-sector]")) $("[data-ws-sector]").value = "climate-software";
  if ($("[data-ws-size]")) $("[data-ws-size]").value = "21-50";
  if ($("[data-ws-region]")) $("[data-ws-region]").value = "western-europe";

  /* ---------- weight sliders ---------- */
  $$("[data-ws-weight]").forEach((input) => {
    const key = input.dataset.wsWeight;
    const output = $(`[data-ws-weight-out="${key}"]`);
    input.value = weights[key];
    if (output) output.textContent = weights[key];
    input.addEventListener("input", () => {
      weights[key] = Number(input.value);
      if (output) output.textContent = input.value;
      render();
    });
  });

  /* ---------- controls ---------- */
  const controls = ["[data-ws-sector]", "[data-ws-size]", "[data-ws-region]", "[data-ws-min]", "[data-ws-state]"];
  controls.forEach((selector) => {
    const node = $(selector);
    if (node) node.addEventListener("change", render);
  });
  const searchBox = $("[data-ws-search]");
  if (searchBox) searchBox.addEventListener("input", render);

  $$("[data-ws-weight]").forEach((input) => input.addEventListener("change", render));

  /* ---------- pipeline state changes ---------- */
  root.addEventListener("change", (event) => {
    const select = event.target.closest("[data-ws-row-state]");
    if (!select) return;
    const id = select.dataset.wsRowState;
    LF.Store.setState(id, select.value);
    leads = leads.map((lead) => (lead.id === id ? { ...lead, state: select.value } : lead));
    render();
  });

  /* ---------- export + reset ---------- */
  $("[data-ws-export]")?.addEventListener("click", () => {
    if (!visibleRows.length) return;
    LF.download("leadforge-qualified-leads.csv", LF.toCSV(visibleRows));
  });

  $("[data-ws-reset]")?.addEventListener("click", () => {
    LF.Store.clear();
    leads = LF.loadLeads();
    render();
  });

  /* ---------- render ---------- */
  function render() {
    const target = {
      sector: $("[data-ws-sector]")?.value || "climate-software",
      size: $("[data-ws-size]")?.value || "21-50",
      region: $("[data-ws-region]")?.value || "western-europe"
    };
    const options = {
      target,
      weights,
      search: searchBox?.value || "",
      state: $("[data-ws-state]")?.value || "all",
      minScore: Number($("[data-ws-min]")?.value || 0)
    };

    visibleRows = LF.query(leads, options);

    const tbody = $("[data-ws-rows]");
    const empty = $("[data-ws-empty]");
    if (tbody) {
      tbody.innerHTML = visibleRows.map((row) => {
        const state = row.lead.state || "new";
        const stateOptions = LF.STATES.map((option) =>
          `<option value="${option.id}"${option.id === state ? " selected" : ""}>${escapeHTML(option.label)}</option>`
        ).join("");
        return `<tr>
          <td class="ws-org"><strong>${escapeHTML(row.lead.org)}</strong><span>${escapeHTML(LF.labelFor(LF.SECTORS, row.lead.sector))} · ${row.lead.employees} staff</span></td>
          <td>${escapeHTML(LF.labelFor(LF.REGIONS, row.lead.region))}</td>
          <td><span class="score-pill">${row.score}%<i aria-hidden="true"><b style="width:${row.score}%"></b></i></span></td>
          <td>${row.lead.signal}</td>
          <td><span class="chip">${escapeHTML(row.lead.source)}</span></td>
          <td><label class="sr-only" for="state-${row.lead.id}">Pipeline state for ${escapeHTML(row.lead.org)}</label><select id="state-${row.lead.id}" class="chip state-${state}" data-ws-row-state="${row.lead.id}">${stateOptions}</select></td>
        </tr>`;
      }).join("");
    }
    if (empty) empty.hidden = visibleRows.length !== 0;

    const count = $("[data-ws-count]");
    if (count) count.textContent = String(visibleRows.length);
    const avg = $("[data-ws-avg]");
    if (avg) {
      const average = visibleRows.length
        ? Math.round(visibleRows.reduce((sum, row) => sum + row.score, 0) / visibleRows.length)
        : 0;
      avg.textContent = `${average}%`;
    }
    const shortlisted = $("[data-ws-shortlist]");
    if (shortlisted) shortlisted.textContent = String(visibleRows.filter((row) => (row.lead.state || "new") === "shortlist").length);
    const exportButton = $("[data-ws-export]");
    if (exportButton) exportButton.disabled = visibleRows.length === 0;
  }

  render();
})();
