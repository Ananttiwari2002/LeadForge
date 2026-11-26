/**
 * LeadForge — shared front-end behaviour.
 * Static prototype: no network requests, no analytics, no data leaves the browser.
 */
(() => {
  const body = document.body;
  const header = document.querySelector(".site-header");
  const menuButton = document.querySelector(".menu-toggle");
  const nav = document.querySelector(".primary-nav");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  body.classList.add("js-ready");

  /* ---------- injected chrome: scroll progress + back to top ---------- */
  const progress = document.createElement("div");
  progress.className = "scroll-progress";
  progress.setAttribute("aria-hidden", "true");

  const toTop = document.createElement("button");
  toTop.type = "button";
  toTop.className = "to-top";
  toTop.setAttribute("aria-label", "Back to top");
  toTop.textContent = "↑";
  toTop.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  });

  body.append(progress, toTop);

  /* ---------- header state, progress bar, back-to-top visibility ---------- */
  let ticking = false;
  const onScroll = () => {
    const y = window.scrollY;
    if (header) header.classList.toggle("is-scrolled", y > 12);
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.width = `${scrollable > 0 ? Math.min((y / scrollable) * 100, 100) : 0}%`;
    toTop.classList.toggle("is-on", y > 520);
    updateTimeline();
    ticking = false;
  };
  const requestScroll = () => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(onScroll);
  };

  /* ---------- responsive navigation ---------- */
  if (menuButton && nav) {
    menuButton.addEventListener("click", () => {
      const open = body.classList.toggle("menu-open");
      menuButton.setAttribute("aria-expanded", String(open));
      menuButton.setAttribute("aria-label", open ? "Close navigation menu" : "Open navigation menu");
    });
    nav.addEventListener("click", (event) => {
      if (event.target.closest("a")) {
        body.classList.remove("menu-open");
        menuButton.setAttribute("aria-expanded", "false");
        menuButton.setAttribute("aria-label", "Open navigation menu");
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && body.classList.contains("menu-open")) {
        body.classList.remove("menu-open");
        menuButton.setAttribute("aria-expanded", "false");
        menuButton.focus();
      }
    });
  }

  /* ---------- scroll reveal ---------- */
  const revealItems = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && !reduceMotion) {
    const observer = new IntersectionObserver((entries, activeObserver) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          activeObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    revealItems.forEach((item) => observer.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add("is-visible"));
  }

  /* ---------- staggered children ---------- */
  document.querySelectorAll(".stagger").forEach((group) => {
    [...group.children].forEach((child, index) => {
      child.style.setProperty("--delay", `${index * 90}ms`);
    });
  });

  /* ---------- rotating hero phrase ---------- */
  const slot = document.querySelector("[data-rotate]");
  if (slot) {
    const words = (slot.dataset.rotate || "").split("|").map((w) => w.trim()).filter(Boolean);
    if (reduceMotion || !words.length) {
      if (words.length) slot.textContent = words[0];
    } else {
      let wordIndex = 0;
      let charIndex = 0;
      let deleting = false;
      const tick = () => {
        const word = words[wordIndex];
        charIndex += deleting ? -1 : 1;
        slot.textContent = word.slice(0, charIndex);
        let delay = deleting ? 38 : 76;
        if (!deleting && charIndex === word.length) {
          deleting = true;
          delay = 1750;
        } else if (deleting && charIndex === 0) {
          deleting = false;
          wordIndex = (wordIndex + 1) % words.length;
          delay = 320;
        }
        window.setTimeout(tick, delay);
      };
      window.setTimeout(tick, 900);
    }
  }

  /* ---------- animated counters ---------- */
  const counters = document.querySelectorAll("[data-count]");
  if (counters.length) {
    const runCounter = (node) => {
      const target = Number(node.dataset.count || 0);
      const suffix = node.dataset.suffix || "";
      const prefix = node.dataset.prefix || "";
      if (reduceMotion) {
        node.textContent = `${prefix}${target}${suffix}`;
        return;
      }
      const duration = 1350;
      const start = performance.now();
      const step = (now) => {
        const ratio = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - ratio, 3);
        node.textContent = `${prefix}${Math.round(target * eased)}${suffix}`;
        if (ratio < 1) window.requestAnimationFrame(step);
      };
      window.requestAnimationFrame(step);
    };
    if ("IntersectionObserver" in window) {
      const counterObserver = new IntersectionObserver((entries, activeObserver) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            runCounter(entry.target);
            activeObserver.unobserve(entry.target);
          }
        });
      }, { threshold: 0.5 });
      counters.forEach((node) => counterObserver.observe(node));
    } else {
      counters.forEach(runCounter);
    }
  }

  /* ---------- scroll-driven timeline ---------- */
  const timeline = document.querySelector("[data-timeline]");
  function updateTimeline() {
    if (!timeline) return;
    const fill = timeline.querySelector("[data-timeline-fill]");
    if (!fill) return;
    const rect = timeline.getBoundingClientRect();
    const readingLine = window.innerHeight * 0.78;
    const travelled = Math.min(Math.max(readingLine - rect.top, 0), rect.height);
    fill.style.height = `${rect.height > 0 ? (travelled / rect.height) * 100 : 0}%`;
  }

  /* ---------- pointer tilt on cards ---------- */
  if (canHover && !reduceMotion) {
    document.querySelectorAll("[data-tilt]").forEach((card) => {
      card.addEventListener("pointermove", (event) => {
        const rect = card.getBoundingClientRect();
        const px = (event.clientX - rect.left) / rect.width - 0.5;
        const py = (event.clientY - rect.top) / rect.height - 0.5;
        card.style.setProperty("--ry", `${px * 15}deg`);
        card.style.setProperty("--rx", `${-py * 15}deg`);
      });
      card.addEventListener("pointerleave", () => {
        card.style.setProperty("--ry", "0deg");
        card.style.setProperty("--rx", "0deg");
      });
    });
  }

  /* ---------- illustrative lead table filters ---------- */
  const search = document.querySelector("[data-lead-search]");
  const industry = document.querySelector("[data-lead-industry]");
  const sourceType = document.querySelector("[data-lead-source]");
  const confidence = document.querySelector("[data-lead-confidence]");
  const leadRows = [...document.querySelectorAll("[data-lead-row]")];
  const resultCount = document.querySelector("[data-result-count]");
  const emptyState = document.querySelector("[data-empty-result]");

  if (leadRows.length && (search || industry || confidence)) {
    const filterLeads = () => {
      const query = (search?.value || "").trim().toLowerCase();
      const selectedIndustry = industry?.value || "all";
      const selectedSource = sourceType?.value || "all";
      const minimumConfidence = Number(confidence?.value || 0);
      let visible = 0;
      leadRows.forEach((row) => {
        const matchesText = !query || row.textContent.toLowerCase().includes(query);
        const matchesIndustry = selectedIndustry === "all" || row.dataset.industry === selectedIndustry;
        const matchesSource = selectedSource === "all" || row.dataset.source === selectedSource;
        const matchesConfidence = Number(row.dataset.confidence) >= minimumConfidence;
        const show = matchesText && matchesIndustry && matchesSource && matchesConfidence;
        row.hidden = !show;
        if (show) visible += 1;
      });
      if (resultCount) resultCount.textContent = `${visible} illustrative ${visible === 1 ? "record" : "records"} shown`;
      if (emptyState) emptyState.hidden = visible !== 0;
    };
    [search, industry, sourceType, confidence].filter(Boolean).forEach((control) => {
      control.addEventListener(control === search ? "input" : "change", filterLeads);
    });
    filterLeads();
  }

  /* ---------- local-only feedback form ---------- */
  const contactForm = document.querySelector("[data-local-form]");
  if (contactForm) {
    const localButton = contactForm.querySelector("[data-local-submit]");
    localButton?.addEventListener("click", () => {
      if (!contactForm.reportValidity()) return;
      const name = contactForm.querySelector('[name="name"]').value.trim();
      const status = contactForm.querySelector(".form-status");
      if (status) status.textContent = `Thanks${name ? `, ${name}` : ""}. This local preview is complete; nothing was sent or saved.`;
      contactForm.reset();
    });
  }

  window.addEventListener("scroll", requestScroll, { passive: true });
  window.addEventListener("resize", requestScroll);
  onScroll();
})();
