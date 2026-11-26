/**
 * LeadForge — lead qualification engine (front-end reference implementation).
 *
 * Everything here runs in the browser against a fictional sample set so the
 * workflow can be demonstrated without a backend. The scoring, filtering,
 * pipeline and export functions are deliberately separated from the UI and
 * from the data source, so a production build can replace `Store` with an API
 * client and `LEADS` with a real (permitted, licensed) provider feed without
 * rewriting the interface.
 *
 * No network requests. No personal contact data. No scraping.
 */
window.LeadForge = (function () {
  "use strict";

  const PIPELINE_KEY = "leadforge.pipeline.v1";

  /* ------------------------------------------------------------------
     Sample data — fictional organizations for interface demonstration.
     Source labels describe the *category* of permitted public source a real
     build would use; nothing here was collected from anywhere.
     ------------------------------------------------------------------ */
  const LEADS = [
    { id: "lf-01", org: "Morrow Fieldworks", sector: "industrial-design", region: "pacific-nw", size: "51-200", employees: 48, signal: 82, sourceQuality: 86, source: "Company newsroom", evidence: "Regional expansion and a new studio lead role listed publicly." },
    { id: "lf-02", org: "Alder & Beam", sector: "materials", region: "pacific-nw", size: "21-50", employees: 34, signal: 61, sourceQuality: 54, source: "Trade directory", evidence: "Directory entry lists a new product category; not yet corroborated." },
    { id: "lf-03", org: "Northline Studio", sector: "climate-software", region: "western-europe", size: "21-50", employees: 22, signal: 74, sourceQuality: 79, source: "Careers listing", evidence: "Hiring for a role that maps to the offered service." },
    { id: "lf-04", org: "Juniper Table Labs", sector: "food-systems", region: "great-lakes", size: "21-50", employees: 31, signal: 91, sourceQuality: 88, source: "Press release", evidence: "Public pilot announcement with a stated programme timeline." },
    { id: "lf-05", org: "Common Ground Fiber", sector: "materials", region: "great-lakes", size: "51-200", employees: 120, signal: 78, sourceQuality: 81, source: "Company newsroom", evidence: "Capacity investment described in a dated announcement." },
    { id: "lf-06", org: "Blue Orchard Systems", sector: "climate-software", region: "western-europe", size: "1-20", employees: 15, signal: 54, sourceQuality: 47, source: "Press release", evidence: "Early-stage market signal; organization size may be below target." },
    { id: "lf-07", org: "Halden Loom", sector: "industrial-design", region: "northeast-us", size: "51-200", employees: 76, signal: 69, sourceQuality: 73, source: "Industry listing", evidence: "Award shortlist entry suggesting active client work." },
    { id: "lf-08", org: "Ferro & Pike", sector: "logistics", region: "gulf", size: "201-1000", employees: 340, signal: 66, sourceQuality: 71, source: "Trade directory", evidence: "Route expansion noted in a public directory update." },
    { id: "lf-09", org: "Cassia Bay Foods", sector: "food-systems", region: "southeast-asia", size: "51-200", employees: 88, signal: 84, sourceQuality: 76, source: "Press release", evidence: "New regional distribution partnership announced publicly." },
    { id: "lf-10", org: "Vantage Ledger", sector: "fintech", region: "northeast-us", size: "51-200", employees: 143, signal: 72, sourceQuality: 83, source: "Company newsroom", evidence: "Compliance hiring surge described in a dated post." },
    { id: "lf-11", org: "Kestrel Freight", sector: "logistics", region: "pacific-nw", size: "201-1000", employees: 265, signal: 58, sourceQuality: 49, source: "Trade directory", evidence: "Thin directory record; ownership and size need verification." },
    { id: "lf-12", org: "Aureole Mobility", sector: "climate-software", region: "southeast-asia", size: "21-50", employees: 39, signal: 88, sourceQuality: 91, source: "Company newsroom", evidence: "Dated expansion announcement naming a target market." }
  ];

  const SECTORS = [
    { id: "climate-software", label: "Climate software" },
    { id: "industrial-design", label: "Industrial design" },
    { id: "materials", label: "Advanced materials" },
    { id: "food-systems", label: "Food systems" },
    { id: "logistics", label: "Logistics" },
    { id: "fintech", label: "Fintech" }
  ];

  const REGIONS = [
    { id: "pacific-nw", label: "Pacific Northwest" },
    { id: "great-lakes", label: "Great Lakes" },
    { id: "northeast-us", label: "Northeast US" },
    { id: "gulf", label: "Gulf" },
    { id: "western-europe", label: "Western Europe" },
    { id: "southeast-asia", label: "Southeast Asia" }
  ];

  const SIZES = [
    { id: "1-20", label: "1–20 staff" },
    { id: "21-50", label: "21–50 staff" },
    { id: "51-200", label: "51–200 staff" },
    { id: "201-1000", label: "201–1,000 staff" }
  ];

  const STATES = [
    { id: "new", label: "New" },
    { id: "review", label: "In review" },
    { id: "shortlist", label: "Shortlisted" },
    { id: "pass", label: "Not a fit" }
  ];

  /* ------------------------------------------------------------------
     Scoring model — five inspectable factors, weighted by the user.
     ------------------------------------------------------------------ */
  const FACTORS = [
    { id: "sector", label: "Sector match", note: "Does the organization operate in the target sector?" },
    { id: "size", label: "Company size", note: "Does headcount fall inside the requested band?" },
    { id: "region", label: "Location", note: "Is the organization based in the target region?" },
    { id: "signal", label: "Intent signal", note: "How strong is the dated public signal?" },
    { id: "source", label: "Source quality", note: "How attributable and appropriate is the source?" }
  ];

  const DEFAULT_WEIGHTS = { sector: 30, size: 15, region: 10, signal: 25, source: 20 };

  function sizeDistance(leadSize, targetSize) {
    const from = SIZES.findIndex((s) => s.id === leadSize);
    const to = SIZES.findIndex((s) => s.id === targetSize);
    return from < 0 || to < 0 ? 9 : Math.abs(from - to);
  }

  /** Returns 0–1 for each factor, so the weighting stays explainable. */
  function factorsFor(lead, target) {
    const distance = sizeDistance(lead.size, target.size);
    return {
      sector: lead.sector === target.sector ? 1 : 0,
      size: distance === 0 ? 1 : distance === 1 ? 0.5 : 0,
      region: lead.region === target.region ? 1 : 0,
      signal: Math.min(lead.signal / 100, 1),
      source: Math.min(lead.sourceQuality / 100, 1)
    };
  }

  function scoreLead(lead, target, weights) {
    const factors = factorsFor(lead, target);
    const active = { ...DEFAULT_WEIGHTS, ...(weights || {}) };
    let total = 0;
    let weightSum = 0;
    FACTORS.forEach((factor) => {
      const weight = Number(active[factor.id] ?? 0);
      total += weight * factors[factor.id];
      weightSum += weight;
    });
    const score = weightSum > 0 ? Math.round((total / weightSum) * 100) : 0;
    return { score, factors };
  }

  function labelFor(list, id) {
    return list.find((item) => item.id === id)?.label || "Any";
  }

  function query(leads, options) {
    const target = options.target || { sector: "climate-software", size: "21-50", region: "western-europe" };
    const weights = options.weights || DEFAULT_WEIGHTS;
    const search = (options.search || "").trim().toLowerCase();
    const state = options.state || "all";
    const minScore = Number(options.minScore || 0);
    return leads
      .map((lead) => ({ lead, ...scoreLead(lead, target, weights) }))
      .filter((row) => {
        if (search && !`${row.lead.org} ${row.lead.sector} ${row.lead.evidence} ${row.lead.source}`.toLowerCase().includes(search)) return false;
        if (state !== "all" && (row.lead.state || "new") !== state) return false;
        return row.score >= minScore;
      })
      .sort((a, b) => b.score - a.score);
  }

  /* ------------------------------------------------------------------
     Export — a structured database the business-development team can use.
     ------------------------------------------------------------------ */
  const CSV_COLUMNS = ["Organization", "Sector", "Region", "Size band", "Headcount", "Fit score", "Source quality", "Signal strength", "Pipeline state", "Evidence", "Source category"];

  function toCSV(rows) {
    const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const lines = [CSV_COLUMNS.map(escape).join(",")];
    rows.forEach((row) => {
      lines.push([
        row.lead.org,
        labelFor(SECTORS, row.lead.sector),
        labelFor(REGIONS, row.lead.region),
        row.lead.size,
        row.lead.employees,
        row.score,
        row.lead.sourceQuality,
        row.lead.signal,
        labelFor(STATES, row.lead.state || "new"),
        row.lead.evidence,
        row.lead.source
      ].map(escape).join(","));
    });
    return lines.join("\r\n");
  }

  function download(filename, text) {
    const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
  }

  /* ------------------------------------------------------------------
     Store — swap-in point for a real API client.
     Today: browser memory + localStorage. Later: fetch/GraphQL calls with
     authentication, authorisation and audit logging handled server-side.
     ------------------------------------------------------------------ */
  const Store = {
    read() {
      try {
        return JSON.parse(window.localStorage.getItem(PIPELINE_KEY) || "{}");
      } catch (error) {
        return {};
      }
    },
    write(map) {
      try {
        window.localStorage.setItem(PIPELINE_KEY, JSON.stringify(map));
      } catch (error) {
        /* private mode or storage disabled — the demo still works in memory */
      }
    },
    setState(id, state) {
      const map = this.read();
      map[id] = state;
      this.write(map);
    },
    clear() {
      this.write({});
    }
  };

  function loadLeads() {
    const saved = Store.read();
    return LEADS.map((lead) => ({ ...lead, state: saved[lead.id] || "new" }));
  }

  return { LEADS, FACTORS, SECTORS, REGIONS, SIZES, STATES, DEFAULT_WEIGHTS, scoreLead, factorsFor, query, toCSV, download, Store, loadLeads, labelFor };
})();
