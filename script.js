const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function throttleWithRaf(fn) {
  let scheduled = false;
  return (...args) => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      fn(...args);
    });
  };
}

function onIdle(cb) {
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(cb, { timeout: 1200 });
  } else {
    setTimeout(cb, 180);
  }
}

function lazyInit(selector, init, options = { threshold: 0 }) {
  const el = document.querySelector(selector);
  if (!el) return;
  const obs = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    init(el);
    obs.disconnect();
  }, options);
  obs.observe(el);
}


function createScrollyStepObserver(container, steps, applyStep) {
  const stepList = Array.from(steps || []);
  if (!container || !stepList.length) return () => {};

  const getClosestStepIndex = () => {
    const viewportAnchor = window.innerHeight * 0.5;
    let closestIndex = 0;
    let closestDistance = Infinity;

    stepList.forEach((step, index) => {
      const rect = step.getBoundingClientRect();
      const center = rect.top + rect.height * 0.5;
      const distance = Math.abs(center - viewportAnchor);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });

    return closestIndex;
  };

  const sync = throttleWithRaf(() => {
    const rect = container.getBoundingClientRect();
    const anchor = window.innerHeight * 0.5;
    if (rect.bottom < 0 || rect.top > window.innerHeight) return;

    if (rect.top > anchor) {
      applyStep(0);
      return;
    }
    if (rect.bottom < anchor) {
      applyStep(stepList.length - 1);
      return;
    }

    applyStep(getClosestStepIndex());
  });

  window.addEventListener('scroll', sync, { passive: true });
  window.addEventListener('resize', sync, { passive: true });
  sync();

  return sync;
}

// ── Hero particle canvas ──
(function () {
  const canvas = document.getElementById('hero-canvas');
  if (!canvas || prefersReducedMotion) return;
  const ctx = canvas.getContext('2d');
  let W, H, particles = [], raf;
  const getAccentRgb = () => {
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    const hex = accent.replace('#', '');
    if (!/^[0-9a-fA-F]{6}$/.test(hex)) return '0,148,224';
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `${r},${g},${b}`;
  };

  function resize() {
    W = canvas.width  = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
  }

  function spawn() {
    return {
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.2 + 0.3,
      alpha: Math.random() * 0.5 + 0.1,
      drift: (Math.random() - 0.5) * 0.15,
      rise: -(Math.random() * 0.25 + 0.05),
    };
  }

  function init() {
    resize();
    particles = Array.from({ length: 120 }, spawn);
    window.addEventListener('resize', resize, { passive: true });
    loop();
  }

  function loop() {
    ctx.clearRect(0, 0, W, H);
    particles.forEach((p, i) => {
      p.x += p.drift;
      p.y += p.rise;
      if (p.y < -4) { particles[i] = spawn(); particles[i].y = H + 4; }
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${getAccentRgb()},${p.alpha})`;
      ctx.fill();
    });
    raf = requestAnimationFrame(loop);
  }

  // Stop animating when hero leaves viewport (perf)
  const heroObs = new IntersectionObserver(([e]) => {
    if (e.isIntersecting) { if (!raf) loop(); }
    else { cancelAnimationFrame(raf); raf = null; }
  });
  heroObs.observe(canvas.parentElement);

  init();
})();

// ── Hero parallax ──
(function () {
  const bg = document.querySelector('.hero-bg');
  const hero = document.querySelector('.hero-cinematic');
  if (!bg || !hero) return;
  const onScroll = throttleWithRaf(() => {
    const y = window.scrollY;
    if (y < hero.offsetHeight * 1.5) {
      bg.style.transform = `translateY(${y * 0.35}px)`;
    }
  });
  window.addEventListener('scroll', onScroll, { passive: true });
})();

// ── Dark mode ──
(function () {
  const btn = document.getElementById('dark-toggle');
  if (!btn) return;
  function apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('sbf-theme', theme);
    btn.setAttribute('aria-pressed', String(theme === 'dark'));
  }
  apply(document.documentElement.getAttribute('data-theme') || 'dark');
  btn.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    apply(isDark ? 'light' : 'dark');
  });
})();

// ── Progress bar ──
const bar = document.getElementById('progress-bar');

function updateProgress() {
  const scrolled = window.scrollY;
  const total = document.body.scrollHeight - window.innerHeight;
  bar.style.width = (total > 0 ? (scrolled / total) * 100 : 0) + '%';
}

// ── Active TOC ──
const tocLinks = document.querySelectorAll('.toc-link');
const anchoredEls = [...document.querySelectorAll('[id]')];

function updateTOC() {
  let current = '';
  anchoredEls.forEach(el => {
    if (window.scrollY >= el.offsetTop - 150) current = el.id;
  });
  tocLinks.forEach(a => {
    const href = a.getAttribute('href')?.slice(1);
    a.classList.toggle('active', href === current);
  });
}

const onMainScroll = throttleWithRaf(() => { updateProgress(); updateTOC(); });
window.addEventListener('scroll', onMainScroll, { passive: true });
updateProgress();
updateTOC();

// ── Mobile TOC toggle ──
const tocToggle = document.getElementById('toc-toggle');
const toc = document.getElementById('toc');

function setTocState(open) {
  if (!toc) return;
  toc.classList.toggle('open', open);
  tocToggle?.setAttribute('aria-expanded', String(open));
  document.body.classList.toggle('toc-open', open);
}

tocToggle?.addEventListener('click', (e) => {
  e.stopPropagation();
  setTocState(!toc.classList.contains('open'));
});
document.addEventListener('click', e => {
  if (!toc?.classList.contains('open')) return;
  if (toc.contains(e.target) || tocToggle?.contains(e.target)) return;
  setTocState(false);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && toc?.classList.contains('open')) setTocState(false);
});
window.addEventListener('resize', throttleWithRaf(() => {
  if (window.innerWidth > 860 && toc?.classList.contains('open')) {
    setTocState(false);
  }
}));

// ── Smooth-scroll TOC links ──
tocLinks.forEach(a => {
  a.addEventListener('click', e => {
    e.preventDefault();
    const id = a.getAttribute('href').slice(1);
    const target = document.getElementById(id);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    history.replaceState(null, '', `#${id}`);
    setTocState(false);
  });
});

// ── Casefile accordions + hash deep-linking ──
(function () {
  const casefiles = Array.from(document.querySelectorAll('[data-casefile]'));
  if (!casefiles.length) return;

  function setCasefileOpen(card, open) {
    const button = card.querySelector('.casefile-toggle');
    const panel = card.querySelector('.casefile-panel');
    if (!button || !panel) return;
    card.classList.toggle('is-open', open);
    button.setAttribute('aria-expanded', String(open));
    panel.hidden = !open;
  }

  function openCasefileById(id, shouldScroll = true) {
    const card = document.getElementById(id);
    if (!card || !card.matches('[data-casefile]')) return false;
    setCasefileOpen(card, true);
    if (shouldScroll) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return true;
  }

  casefiles.forEach(card => {
    setCasefileOpen(card, false);
    const button = card.querySelector('.casefile-toggle');
    if (!button) return;
    button.addEventListener('click', () => {
      const expanded = button.getAttribute('aria-expanded') === 'true';
      const open = !expanded;
      setCasefileOpen(card, open);
      if (open) {
        history.replaceState(null, '', `#${card.id}`);
      }
    });
  });

  function syncCasefileToHash(shouldScroll = false) {
    const id = window.location.hash.replace('#', '');
    if (!id) return;
    openCasefileById(id, shouldScroll);
  }

  window.addEventListener('hashchange', () => syncCasefileToHash(true));
  syncCasefileToHash(window.location.hash === '#campaign-finance' || window.location.hash === '#bribery');
})();

// ── Evidence rail + source panel ──
(function () {
  const sourceMeta = {
    'gov-reply-18-29': {
      title: 'Government Reply Brief (Second Circuit) pp. 18–29',
      summary: 'Government summary of its strongest trial theory: unauthorized customer-fund use, deceptive public assurances, and circumstantial proof of intent.',
      citation: 'United States v. Bankman-Fried, Gov’t Reply Br. at 18–29 (2d Cir.).',
      url: 'https://storage.courtlistener.com/recap/gov.uscourts.ca2.9d455c17-4ee8-40a0-bafd-1eeeb19acafb/gov.uscourts.ca2.9d455c17-4ee8-40a0-bafd-1eeeb19acafb.50.0.pdf#page=18',
      section: 'section-ii'
    },
    'appeal-brief-12': {
      title: 'Appeal Brief §I.B (Judicial Error)',
      summary: 'Argues key evidentiary rulings and exclusions prevented the jury from hearing central defense theories.',
      citation: 'U.S. v. Bankman-Fried, No. 24-CR-673 (2d Cir.), Appellant Br. at 12–19.',
      url: 'https://www.courtlistener.com/docket/66635085/united-states-v-bankman-fried/',
      section: 'criminal-intent'
    },
    'sentencing-transcript-41': {
      title: 'Sentencing Transcript (March 28, 2024)',
      summary: 'Summarizes loss framing and deterrence arguments discussed during sentencing.',
      citation: 'Sentencing Hr\'g Tr. at 41–58, S.D.N.Y. No. 22-cr-673.',
      url: 'https://www.courtlistener.com/docket/66635085/united-states-v-bankman-fried/',
      section: 'criminal-intent'
    },
    'trial-transcript-ellison': {
      title: 'Trial Transcript (Cooperator Testimony)',
      summary: 'Cross-examination excerpts addressing liquidity, valuation, and internal account treatment.',
      citation: 'Trial Tr., Oct. 2023, S.D.N.Y. No. 22-cr-673.',
      url: 'https://www.courtlistener.com/docket/66635085/united-states-v-bankman-fried/',
      section: 'cooperators'
    },
    'tos-8-2': {
      title: 'FTX Terms of Service §8.2',
      summary: 'Provision discussing lending/borrowing permissions for spot customer assets.',
      citation: 'FTX Trading Ltd. Terms of Service (May 2022), §8.2.',
      url: 'https://web.archive.org/web/20220501000000*/https://ftx.com/legal/terms',
      section: 'misappropriation'
    },
    'tos-16-4': {
      title: 'FTX Terms of Service §16.4',
      summary: 'Provision describing custody and estate treatment language for deposited assets.',
      citation: 'FTX Trading Ltd. Terms of Service (May 2022), §16.4.',
      url: 'https://web.archive.org/web/20220501000000*/https://ftx.com/legal/terms',
      section: 'misappropriation'
    },
    'fiat-ledger-2022': {
      title: 'fiat@ Internal Ledger (June 2022)',
      summary: 'Internal reconciliation snapshots describing the growth and remediation plan for fiat@ balances.',
      citation: 'Defense Ex. summary references; leadership meeting records, June 16, 2022.',
      url: 'https://www.courtlistener.com/docket/66635085/united-states-v-bankman-fried/',
      section: 'misappropriation'
    },
    'docket-experts': {
      title: 'Docket Entries: Expert Exclusions',
      summary: 'Pre-trial and in limine rulings limiting defense expert testimony scope.',
      citation: 'Order(s) on motions in limine, S.D.N.Y. No. 22-cr-673.',
      url: 'https://www.courtlistener.com/docket/66635085/united-states-v-bankman-fried/',
      section: 'misappropriation'
    },
    'bankruptcy-disclosure': {
      title: 'Bankruptcy Disclosure Statement',
      summary: 'Reorganization materials describing customer claims treatment and asset segregation language.',
      citation: 'In re FTX Trading Ltd., Ch. 11 Disclosure Statement.',
      url: 'https://restructuring.ra.kroll.com/FTX/',
      section: 'misappropriation'
    },
    'cooperator-sentencing': {
      title: 'Cooperator Sentencing Letters',
      summary: 'Government submissions describing cooperation value and recommended sentencing outcomes.',
      citation: 'Gov’t sentencing submissions in related cooperator matters.',
      url: 'https://www.courtlistener.com/docket/66635085/united-states-v-bankman-fried/',
      section: 'cooperators'
    }
  };

  const chips = Array.from(document.querySelectorAll('.source-chip[data-source]'));
  const panel = document.getElementById('evidence-panel');
  if (!chips.length || !panel) return;
  const railGroups = Array.from(document.querySelectorAll('.evidence-rail__group[data-section]'));
  const activeSectionEl = document.getElementById('evidence-active-section');
  const trackedSections = Array.from(
    new Set(
      railGroups
        .map((group) => group.dataset.section)
        .filter(Boolean)
    )
  );
  const sectionNames = {
    intro: 'Introduction',
    'section-i': 'I. What Happened to FTX',
    'section-ii': 'II. The Government\'s Case',
    'section-iii': 'III. Red Herrings',
    appendix: 'Appendix: Severed Charges',
    cooperators: 'The Role of Cooperating Witnesses',
    misappropriation: 'A. Misappropriation',
    'criminal-intent': 'C. Criminal Intent'
  };

  const titleEl = panel.querySelector('.evidence-panel__title');
  const summaryEl = panel.querySelector('.evidence-panel__summary');
  const metaEl = panel.querySelector('.evidence-panel__meta');
  const sourceIdEl = panel.querySelector('#evidence-source-id');
  const linkEl = panel.querySelector('.evidence-panel__link');
  const closeEls = panel.querySelectorAll('[data-close-evidence]');
  let activeSource = null;
  let lastTrigger = null;

  function setActiveSource(sourceId) {
    activeSource = sourceId;
    chips.forEach((chip) => {
      chip.classList.toggle('is-active', chip.dataset.source === sourceId);
    });
  }

  function openPanel(sourceId, trigger) {
    const source = sourceMeta[sourceId];
    if (!source) return;
    if (titleEl) titleEl.textContent = source.title;
    if (summaryEl) summaryEl.textContent = source.summary;
    if (metaEl) metaEl.textContent = source.citation;
    if (sourceIdEl) sourceIdEl.textContent = sourceId;
    if (linkEl) linkEl.href = source.url;
    setActiveSource(sourceId);
    panel.hidden = false;
    document.body.classList.add('evidence-open');
    lastTrigger = trigger || null;
  }

  function closePanel() {
    panel.hidden = true;
    document.body.classList.remove('evidence-open');
    if (lastTrigger) lastTrigger.focus();
  }

  chips.forEach((chip, index) => {
    if (chip.tagName === 'SPAN') {
      chip.setAttribute('role', 'button');
      chip.setAttribute('tabindex', '0');
      chip.setAttribute('aria-label', `Open evidence source ${index + 1}`);
    }
    chip.addEventListener('click', () => openPanel(chip.dataset.source, chip));
    chip.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openPanel(chip.dataset.source, chip);
      }
    });
  });

  closeEls.forEach((el) => el.addEventListener('click', closePanel));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !panel.hidden) closePanel();
  });

  function setSection(sectionId) {
    railGroups.forEach((group) => {
      group.classList.toggle('is-context-active', group.dataset.section === sectionId);
      group.classList.toggle('is-context-dimmed', sectionId && group.dataset.section !== sectionId);
    });
    if (activeSectionEl) {
      activeSectionEl.textContent = sectionNames[sectionId] || 'All sections';
    }
  }

  const sectionObs = new IntersectionObserver((entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
    if (!visible.length) return;
    setSection(visible[0].target.id);
  }, { threshold: [0.35, 0.6, 0.85], rootMargin: '-20% 0px -38% 0px' });

  trackedSections.forEach((id) => {
    const el = document.getElementById(id);
    if (el) sectionObs.observe(el);
  });

  setSection(null);
})();

// ── Scroll reveals (IntersectionObserver) ──
const revealObs = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObs.unobserve(entry.target);
    }
  });
}, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll('.reveal, .reveal-section').forEach(el => revealObs.observe(el));

// ── Intro argument map branch highlights ──
(function () {
  if (prefersReducedMotion) return;
  const map = document.querySelector('.intro-argument-map');
  if (!map) return;
  const branches = Array.from(map.querySelectorAll('.argument-branch'));
  if (!branches.length) return;

  let activeIndex = 0;
  let intervalId = null;

  function setActive(index) {
    branches.forEach((branch, i) => branch.classList.toggle('is-active', i === index));
  }

  function startPulse() {
    if (intervalId) return;
    setActive(activeIndex);
    intervalId = setInterval(() => {
      activeIndex = (activeIndex + 1) % branches.length;
      setActive(activeIndex);
    }, 1300);
  }

  function stopPulse() {
    if (!intervalId) return;
    clearInterval(intervalId);
    intervalId = null;
    branches.forEach(branch => branch.classList.remove('is-active'));
  }

  const branchObs = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) startPulse();
    else stopPulse();
  }, { threshold: 0.45, rootMargin: '-8% 0px -8% 0px' });

  branchObs.observe(map);
})();

// ── Animated stat counters ──
function animateCounter(el) {
  const target = parseFloat(el.dataset.target);
  const suffix = el.dataset.suffix || '';
  const duration = 1800;
  const startTime = performance.now();

  function tick(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    // Ease-out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const val = Math.round(target * eased);
    el.textContent = val + suffix;
    if (progress < 1) requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

const statObs = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const el = entry.target;
      if (!el.dataset.static) animateCounter(el);
      statObs.unobserve(el);
    }
  });
}, { threshold: 0.6 });

document.querySelectorAll('.stat-num').forEach(el => statObs.observe(el));

// ── Witness cards expand/collapse ──
document.querySelectorAll('.witness-card').forEach((card, index) => {
  const hint = card.querySelector('.witness-hint');
  const back = card.querySelector('.witness-back');
  const panelId = `witness-panel-${index + 1}`;
  if (back) back.id = panelId;
  card.setAttribute('role', 'button');
  card.setAttribute('tabindex', '0');
  card.setAttribute('aria-expanded', 'false');
  if (back) card.setAttribute('aria-controls', panelId);

  function toggleCard() {
    const isOpen = card.classList.toggle('open');
    card.setAttribute('aria-expanded', String(isOpen));
    if (hint) hint.textContent = isOpen ? '▲ Click to close' : '▼ Click to expand';
  }

  card.addEventListener('click', toggleCard);
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleCard();
    }
  });
});

// ── Prosecution speed gauge ──
(function () {
  const gauge = document.querySelector('.speed-gauge');
  if (!gauge) return;
  const MAX_DAYS = 540;

  const obs = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    gauge.querySelectorAll('.sg-bar').forEach(bar => {
      const days = parseInt(bar.dataset.days, 10);
      const pct  = Math.min((days / MAX_DAYS) * 100, 100);
      bar.style.width = pct + '%';
    });
    obs.unobserve(gauge);
  }, { threshold: 0.3 });

  obs.observe(gauge);
})();

// ── Legal glossary tooltips ──
onIdle(() => (function () {
  const tooltip = document.getElementById('term-tooltip');
  if (!tooltip) return;
  let hideTimer;
  function positionTooltipAtRect(rect) {
    const pad = 12;
    const tw = 270;
    const th = 90;
    let x = rect.left + rect.width / 2 - tw / 2;
    let y = rect.bottom + pad;
    if (x < pad) x = pad;
    if (x + tw > window.innerWidth - pad) x = window.innerWidth - tw - pad;
    if (y + th > window.innerHeight - pad) y = rect.top - th - pad;
    tooltip.style.left = x + 'px';
    tooltip.style.top = y + 'px';
  }
  function show(term, e) {
    clearTimeout(hideTimer);
    tooltip.textContent = term.dataset.tip;
    tooltip.classList.add('visible');
    if (e) {
      positionTooltip(e);
    } else {
      positionTooltipAtRect(term.getBoundingClientRect());
    }
  }

  document.querySelectorAll('.term').forEach((term, i) => {
    term.setAttribute('tabindex', '0');
    term.setAttribute('role', 'button');
    term.setAttribute('aria-describedby', 'term-tooltip');
    term.setAttribute('aria-label', `Definition: ${term.textContent?.trim() || `term ${i + 1}`}`);
    term.addEventListener('mouseenter', e => {
      show(term, e);
    });
    term.addEventListener('mousemove', positionTooltip);
    term.addEventListener('mouseleave', () => {
      hideTimer = setTimeout(() => tooltip.classList.remove('visible'), 80);
    });
    term.addEventListener('focus', () => show(term));
    term.addEventListener('blur', () => tooltip.classList.remove('visible'));
  });

  function positionTooltip(e) {
    const pad = 12;
    let x = e.clientX + pad;
    let y = e.clientY + pad;
    const tw = 270, th = 90;
    if (x + tw > window.innerWidth)  x = e.clientX - tw - pad;
    if (y + th > window.innerHeight) y = e.clientY - th - pad;
    tooltip.style.left = x + 'px';
    tooltip.style.top  = y + 'px';
  }
})());

// ── Verdict stamp sequence ──
(function () {
  const stamps = document.querySelectorAll('.verdict-stamp');
  if (!stamps.length) return;

  const obs = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el    = entry.target;
        const delay = parseInt(el.dataset.delay || '0', 10);
        setTimeout(() => el.classList.add('stamped'), delay);
        obs.unobserve(el);
      }
    });
  }, { threshold: 0.15 });

  stamps.forEach(s => obs.observe(s));
})();

// ── Was This Fraud? quiz ──
document.querySelectorAll('.fq-card').forEach(card => {
  const revealEl = card.querySelector('.fq-reveal');
  const fraudBtn = card.querySelector('.fq-btn--fraud');
  const notBtn   = card.querySelector('.fq-btn--notfraud');

  function vote(isFraud) {
    fraudBtn.classList.toggle('selected-fraud',    isFraud);
    notBtn.classList.toggle('selected-notfraud', !isFraud);
    fraudBtn.disabled = true;
    notBtn.disabled   = true;
    if (revealEl) {
      revealEl.hidden = false;
      revealEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  fraudBtn?.addEventListener('click', () => vote(true));
  notBtn?.addEventListener('click',   () => vote(false));
});

// ── Sentence comparison bubble tooltips ──
onIdle(() => (function () {
  const svg     = document.getElementById('sc-svg');
  const tooltip = document.getElementById('sc-tooltip');
  if (!svg || !tooltip) return;
  let activeBubble = null;

  const ttName = document.getElementById('sc-tt-name');
  const ttLoss = document.getElementById('sc-tt-loss');
  const ttSent = document.getElementById('sc-tt-sent');
  const ttNote = document.getElementById('sc-tt-note');

  function positionTip(bubble) {
    const rect = svg.parentElement.getBoundingClientRect();
    const cx = parseFloat(bubble.getAttribute('cx') || '70');
    const cy = parseFloat(bubble.getAttribute('cy') || '280');
    const svgBox = svg.viewBox.baseVal;
    let x = ((cx / svgBox.width) * rect.width) + 14;
    let y = ((cy / svgBox.height) * rect.height) - 28;
    if (x + 270 > rect.width) x = x - 280;
    if (y < 0) y = 8;
    tooltip.style.left = x + 'px';
    tooltip.style.top = y + 'px';
  }

  function showBubbleTip(bubble, keepPosition = false) {
    ttName.textContent = bubble.dataset.name;
    ttLoss.textContent = bubble.dataset.loss;
    ttSent.textContent = bubble.dataset.sentence;
    ttNote.textContent = bubble.dataset.note;
    if (!keepPosition) positionTip(bubble);
    tooltip.hidden = false;
  }
  function positionBubbleTipAtRect(rect) {
    const wrapRect = svg.parentElement.getBoundingClientRect();
    const xCenter = rect.left + rect.width / 2 - wrapRect.left;
    const yTop = rect.top - wrapRect.top;
    let x = xCenter - 135;
    let y = yTop - 150;
    if (x < 8) x = 8;
    if (x + 270 > wrapRect.width - 8) x = wrapRect.width - 278;
    if (y < 8) y = yTop + rect.height + 12;
    tooltip.style.left = x + 'px';
    tooltip.style.top  = y + 'px';
  }
  function toggleBubbleTip(bubble) {
    const shouldClose = activeBubble === bubble && !tooltip.hidden;
    if (shouldClose) {
      tooltip.hidden = true;
      activeBubble = null;
      return;
    }
    showBubbleTip(bubble);
    positionBubbleTipAtRect(bubble.getBoundingClientRect());
    activeBubble = bubble;
  }
  function hideBubbleTip() {
    tooltip.hidden = true;
    activeBubble = null;
  }

  window.setSentenceGraphFocus = (caseKey) => {
    svg.querySelectorAll('.sc-bubble').forEach(b => b.classList.remove('is-focused'));
    const focusBubble = svg.querySelector(`.sc-bubble[data-case-key="${caseKey}"]`);
    if (!focusBubble) return;
    focusBubble.classList.add('is-focused');
    showBubbleTip(focusBubble, false);
  };

  svg.querySelectorAll('.sc-bubble').forEach((bubble, i) => {
    bubble.setAttribute('tabindex', '0');
    bubble.setAttribute('role', 'button');
    bubble.setAttribute('aria-label', `${bubble.dataset.name || `Case ${i + 1}`}: ${bubble.dataset.sentence || ''}`);
    bubble.addEventListener('mouseenter', () => {
      showBubbleTip(bubble);
    });
    bubble.addEventListener('mousemove', e => {
      const rect = svg.parentElement.getBoundingClientRect();
      let x = e.clientX - rect.left + 12;
      let y = e.clientY - rect.top  + 12;
      if (x + 270 > rect.width)  x = e.clientX - rect.left - 270;
      if (y + 140 > rect.height) y = e.clientY - rect.top  - 140;
      tooltip.style.left = x + 'px';
      tooltip.style.top  = y + 'px';
    });
    bubble.addEventListener('mouseleave', hideBubbleTip);
    bubble.addEventListener('focus', () => {
      showBubbleTip(bubble);
      positionBubbleTipAtRect(bubble.getBoundingClientRect());
      activeBubble = bubble;
    });
    bubble.addEventListener('blur', hideBubbleTip);
    bubble.addEventListener('click', () => toggleBubbleTip(bubble));
    bubble.addEventListener('touchstart', () => toggleBubbleTip(bubble), { passive: true });
  });
  document.addEventListener('click', (e) => {
    if (tooltip.hidden) return;
    if (e.target.closest('.sc-bubble') || tooltip.contains(e.target)) return;
    hideBubbleTip();
  });
})());

// ── Bank Run Canvas ──
lazyInit('#bank-run-wrap', (wrap) => {
  const canvas = document.getElementById('bank-run-canvas');
  const amtEl  = document.getElementById('brc-amount');
  const endMsg = document.getElementById('brc-end-msg');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let W, H, level = 1.0, particles = [], raf = null, running = false, startTs = null;

  function resize() {
    W = canvas.width  = canvas.offsetWidth  || 400;
    H = canvas.height = Math.round(W * 0.38);
    canvas.style.height = H + 'px';
  }
  resize();
  window.addEventListener('resize', () => { resize(); }, { passive: true });

  function mkParticle() {
    return {
      x: W * (0.72 + Math.random() * 0.05),
      y: H * (1 - level) + Math.random() * H * level * 0.9,
      vx: 2.5 + Math.random() * 4,
      vy: (Math.random() - 0.5) * 1.5,
      r: 1.5 + Math.random() * 3,
      life: 1,
    };
  }

  function draw(ts) {
    if (!startTs) startTs = ts;
    const elapsed = (ts - startTs) / 1000;

    ctx.clearRect(0, 0, W, H);

    // Drain level over ~7 seconds with ease-out feel
    if (level > 0.01) {
      level = Math.max(0, 1 - Math.pow(elapsed / 7.5, 0.55));
    }

    // Water body
    if (level > 0.005) {
      const waterY = H * (1 - level);
      const t2 = elapsed * 1.8;

      ctx.beginPath();
      ctx.moveTo(0, waterY);
      for (let x = 0; x <= W * 0.78; x += 3) {
        const wave = level > 0.04 ? Math.sin(x * 0.045 + t2) * 2.5 : 0;
        ctx.lineTo(x, waterY + wave);
      }
      ctx.lineTo(W * 0.78, H);
      ctx.lineTo(0, H);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, waterY, 0, H);
      grad.addColorStop(0, 'rgba(52,152,219,0.75)');
      grad.addColorStop(1, 'rgba(41,128,185,0.92)');
      ctx.fillStyle = grad;
      ctx.fill();

      // Water surface shimmer
      ctx.strokeStyle = 'rgba(174,214,241,0.35)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Spawn particles while draining
    if (level > 0.015 && Math.random() < 0.65) particles.push(mkParticle());

    // Particles
    particles = particles.filter(p => p.life > 0.02);
    particles.forEach(p => {
      p.x  += p.vx;
      p.y  += p.vy;
      p.vy += 0.06;
      p.life -= 0.022;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(52,152,219,${p.life * 0.65})`;
      ctx.fill();
    });

    // Counter
    const withdrawn = Math.min(8, (1 - level) * 8);
    if (amtEl) amtEl.textContent = '$' + withdrawn.toFixed(1) + 'B';

    if (level <= 0.01 && particles.length < 3) {
      if (endMsg) endMsg.classList.add('visible');
      return;
    }
    raf = requestAnimationFrame(draw);
  }

  const obs = new IntersectionObserver(([e]) => {
    if (e.isIntersecting && !running) {
      running = true;
      level = 1.0; particles = []; startTs = null;
      raf = requestAnimationFrame(draw);
      return;
    }
    if (!e.isIntersecting && raf) {
      cancelAnimationFrame(raf);
      raf = null;
    }
  }, { threshold: 0.4 });
  obs.observe(wrap);
});

// ── Scrollytelling: $9B Discovery ──
lazyInit('#collapse-pipeline', (container) => {
  const section = document.getElementById('section-i');
  const steps = container.querySelectorAll('.cp-step-item');
  const cards = container.querySelectorAll('.cp-card[data-step]');
  const arrows = container.querySelectorAll('.cp-arrow[data-arrow]');
  let cur = -1;

  function applyStep(i) {
    if (i === cur) return;
    cur = i;
    steps.forEach((step, idx) => step.classList.toggle('active', idx === i));
    cards.forEach((card, idx) => card.classList.toggle('is-active', idx <= i));
    arrows.forEach((arrow, idx) => arrow.classList.toggle('active', idx < i));
  }

  const baseSync = createScrollyStepObserver(container, steps, applyStep);
  const syncWithinSection = throttleWithRaf(() => {
    if (!section) {
      baseSync();
      return;
    }
    const rect = section.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) baseSync();
  });

  window.addEventListener('scroll', syncWithinSection, { passive: true });
  window.addEventListener('resize', syncWithinSection, { passive: true });
  applyStep(0);
  syncWithinSection();
});

// ── Scrollytelling: $9B Discovery ──
lazyInit('.scrolly-9b', (container) => {

  const steps     = container.querySelectorAll('.s9b-step');
  const numEl     = document.getElementById('s9b-num');
  const yearEl    = document.getElementById('s9b-year');
  const fillEl    = document.getElementById('s9b-fill');
  const statusEl  = document.getElementById('s9b-status');
  const card      = container.querySelector('.s9b-card');
  const wangEl    = document.getElementById('s9b-wang');
  const singhEl   = document.getElementById('s9b-singh');
  const ellisonEl = document.getElementById('s9b-ellison');
  const samEl     = document.getElementById('s9b-sam');

  const data = [
    { balance: 0,   year: '2019',         fill: 0,   status: 'Payment agent arrangement begins',     wang: 0, singh: 0, ellison: 0, sam: 0 },
    { balance: 0.5, year: '2020–2021',    fill: 6,   status: 'Software bug accumulates silently…',   wang: 0, singh: 0, ellison: 0, sam: 0 },
    { balance: 4,   year: 'Summer 2021',  fill: 44,  status: 'Co-founders know. Sam is not told.', wang: 1, singh: 1, ellison: 1, sam: 0 },
    { balance: 7,   year: 'Early 2022',   fill: 77,  status: 'Crypto boom accelerates deposits',     wang: 1, singh: 1, ellison: 1, sam: 0 },
    { balance: 9,   year: 'Jun 16, 2022', fill: 100, status: 'Sam learns the truth.',             wang: 1, singh: 1, ellison: 1, sam: 1 },
  ];

  let currentStep = -1;
  let animRaf = null;

  function animNum(target) {
    const start = parseFloat(numEl.dataset.val || '0');
    const end   = target;
    const dur   = 700;
    const t0    = performance.now();
    cancelAnimationFrame(animRaf);
    function tick(now) {
      const p = Math.min((now - t0) / dur, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      const v = start + (end - start) * ease;
      numEl.textContent = v < 1 ? v.toFixed(1) : v.toFixed(0);
      if (p < 1) animRaf = requestAnimationFrame(tick);
    }
    animRaf = requestAnimationFrame(tick);
    numEl.dataset.val = target;
  }

  function applyStep(i) {
    if (i === currentStep) return;
    currentStep = i;
    const d = data[i];

    animNum(d.balance);
    yearEl.textContent   = d.year;
    fillEl.style.width   = d.fill + '%';
    statusEl.textContent = d.status;

    const colors = ['#2ecc71', '#f39c12', '#e67e22', '#e74c3c', '#c0392b'];
    fillEl.style.background = colors[i];
    const figureEl = numEl.closest ? numEl : numEl.parentElement;
    figureEl.style.color = colors[i];

    card.classList.toggle('alarm', i === 4);

    function setKnows(el, knows) { el.classList.toggle('knows', !!knows); }
    setKnows(wangEl,    d.wang);
    setKnows(singhEl,   d.singh);
    setKnows(ellisonEl, d.ellison);
    setKnows(samEl,     d.sam);

    steps.forEach((s, j) => s.classList.toggle('active', j === i));
  }

  applyStep(0);
  createScrollyStepObserver(container, steps, applyStep);
});

// ── Chapter openers: animate in on scroll ──
const chapterObs = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const inner = entry.target.querySelector('.chapter-inner');
      if (inner) {
        inner.style.transition = 'opacity 0.9s ease 0.1s, transform 0.9s ease 0.1s';
        inner.style.opacity = '1';
        inner.style.transform = 'none';
      }
      chapterObs.unobserve(entry.target);
    }
  });
}, { threshold: 0.25 });

document.querySelectorAll('.chapter-opener').forEach(opener => {
  const inner = opener.querySelector('.chapter-inner');
  if (inner) {
    inner.style.opacity = '0';
    inner.style.transform = 'translateY(30px)';
  }
  chapterObs.observe(opener);
});

// ── Scrollytelling: Bank Run ──
lazyInit('#bank-run-scrolly', (container) => {
  const steps     = container.querySelectorAll('.sbr-step');
  const waterEl   = document.getElementById('sbr-water');
  const withdrawn = document.getElementById('sbr-withdrawn');
  const timeEl    = document.getElementById('sbr-time');
  const statusEl  = document.getElementById('sbr-status');
  let cur = -1;

  function applyStep(i) {
    if (i === cur) return;
    cur = i;
    const d = steps[i].dataset;
    if (waterEl)   waterEl.style.height = d.pct + '%';
    if (withdrawn) withdrawn.textContent = d.withdrawn === '0' ? '$0B' : '$' + d.withdrawn + 'B';
    if (timeEl)    timeEl.textContent = d.time;
    if (statusEl)  statusEl.textContent = d.status;
    // color withdrawn red when draining
    if (withdrawn) withdrawn.style.color = parseFloat(d.withdrawn) > 0 ? '#e74c3c' : 'rgba(240,237,232,0.5)';
    steps.forEach((s, j) => s.classList.toggle('active', j === i));
  }

  applyStep(0);
  createScrollyStepObserver(container, steps, applyStep);
});

// ── Scrollytelling: Crypto Apocalypse ──
lazyInit('#crypto-scrolly', (container) => {
  const steps   = container.querySelectorAll('.sca-step');
  const numEl   = document.getElementById('sca-num');
  const statusEl= document.getElementById('sca-status');
  const firmIds = ['luna','3ac','celsius','blockfi','voyager','ftx'];
  let cur = -1, animRaf = null;

  function animNum(target) {
    const start = parseFloat(numEl.dataset.val || '0');
    const end   = target;
    const dur   = 700;
    const t0    = performance.now();
    cancelAnimationFrame(animRaf);
    function tick(now) {
      const p = Math.min((now - t0) / dur, 1);
      const v = start + (end - start) * (1 - Math.pow(1 - p, 3));
      numEl.textContent = Math.round(v);
      if (p < 1) animRaf = requestAnimationFrame(tick);
    }
    animRaf = requestAnimationFrame(tick);
    numEl.dataset.val = target;
  }

  function applyStep(i) {
    if (i === cur) return;
    cur = i;
    const d = steps[i].dataset;
    animNum(parseFloat(d.losses));
    if (statusEl) statusEl.textContent = d.status;
    const active = d.firms ? d.firms.split(',').filter(Boolean) : [];
    firmIds.forEach(id => {
      const el = document.getElementById('sca-' + id);
      if (el) el.classList.toggle('active', active.includes(id));
    });
    steps.forEach((s, j) => s.classList.toggle('active', j === i));
  }

  applyStep(0);
  createScrollyStepObserver(container, steps, applyStep);
});

// ── Scrollytelling: Deal They Couldn't Refuse ──
lazyInit('#deal-scrolly', (container) => {
  const steps    = container.querySelectorAll('.sdl-step');
  const nameEl   = document.getElementById('sdl-name');
  const barFaced = document.getElementById('sdl-bar-faced');
  const barGot   = document.getElementById('sdl-bar-got');
  const numFaced = document.getElementById('sdl-num-faced');
  const numGot   = document.getElementById('sdl-num-got');
  const meter    = document.getElementById('sdl-meter');
  const meterVal = document.getElementById('sdl-meter-val');
  let cur = -1;

  function applyStep(i) {
    if (i === cur) return;
    cur = i;
    const d = steps[i].dataset;
    if (nameEl)   nameEl.textContent = d.name;
    if (barFaced) barFaced.style.width = d.facedPct + '%';
    if (barGot)   barGot.style.width   = d.gotPct   + '%';
    if (numFaced) numFaced.textContent = d.faced;
    if (numGot)   numGot.textContent   = d.got;
    if (meter)    meter.style.width    = d.meter + '%';
    if (meterVal) meterVal.textContent = d.meterVal;
    steps.forEach((s, j) => s.classList.toggle('active', j === i));
  }

  applyStep(0);
  createScrollyStepObserver(container, steps, applyStep);
});

// ── Scrollytelling: Repayment Counter ──
lazyInit('#repayment-scrolly', (container) => {
  const steps   = container.querySelectorAll('.srp-step');
  const pctEl   = document.getElementById('srp-pct');
  const barEl   = document.getElementById('srp-bar');
  const paidEl  = document.getElementById('srp-paid');
  const noteEl  = document.getElementById('srp-note');
  const verdEl  = document.getElementById('srp-verdict');
  let cur = -1, animRaf = null;

  function animPct(target) {
    const start = parseFloat(pctEl.dataset.val || '0');
    const end   = target;
    const dur   = 900;
    const t0    = performance.now();
    cancelAnimationFrame(animRaf);
    function tick(now) {
      const p = Math.min((now - t0) / dur, 1);
      const v = start + (end - start) * (1 - Math.pow(1 - p, 3));
      pctEl.textContent = Math.round(v);
      if (p < 1) animRaf = requestAnimationFrame(tick);
    }
    animRaf = requestAnimationFrame(tick);
    pctEl.dataset.val = target;
  }

  function applyStep(i) {
    if (i === cur) return;
    cur = i;
    const d = steps[i].dataset;
    const pct = parseFloat(d.pct);
    animPct(pct);
    if (barEl)  { barEl.style.width = d.bar + '%'; barEl.style.background = pct >= 98 ? '#2ecc71' : pct > 50 ? '#f39c12' : '#e74c3c'; }
    if (pctEl)  pctEl.style.color = pct >= 98 ? '#2ecc71' : pct > 0 ? '#f39c12' : 'rgba(240,237,232,0.6)';
    if (paidEl) paidEl.textContent = d.paid;
    if (noteEl) noteEl.textContent = d.note;
    if (verdEl) verdEl.textContent = d.verdict;
    steps.forEach((s, j) => s.classList.toggle('active', j === i));
  }

  applyStep(0);
  createScrollyStepObserver(container, steps, applyStep);
});

// ── Scrollytelling: Sentence That Doesn't Fit ──
lazyInit('#sentence-scrolly', (container) => {
  const steps      = container.querySelectorAll('.sst-step');
  const insightEl  = document.getElementById('sst-insight');
  const activeCase = document.getElementById('sst-activecase');
  const insights = {
    ebbers:  'Proportionate: $11B harm → 25 years',
    skilling:'Proportionate: $74B harm → 24 years',
    madoff:  'Proportionate: $17.5B harm → 150 years',
    sbf:     'NOT proportionate: $0 net harm → 25 years',
  };
  const labels = {
    ebbers: 'Focused case: WorldCom (Ebbers)',
    skilling: 'Focused case: Enron (Skilling)',
    madoff: 'Focused case: Madoff',
    sbf: 'Focused case: Sam Bankman-Fried',
  };
  let cur = -1;

  function applyStep(i) {
    if (i === cur) return;
    cur = i;
    const reveal = steps[i].dataset.reveal;
    if (insightEl) insightEl.textContent = insights[reveal] || '';
    if (activeCase) activeCase.textContent = labels[reveal] || 'Read the context first, then compare cases.';
    if (reveal && typeof window.setSentenceGraphFocus === 'function') {
      window.setSentenceGraphFocus(reveal);
    }
    steps.forEach((s, j) => s.classList.toggle('active', j === i));
  }

  applyStep(0);
  createScrollyStepObserver(container, steps, applyStep);
});

// ── Evidence Wall: BLOCKED stamp animation ──
(function () {
  const cards = document.querySelectorAll('.eg-card--blocked');
  if (!cards.length) return;
  const stampObs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const card = entry.target;
      const i = [...cards].indexOf(card);
      setTimeout(() => card.classList.add('stamp-revealed'), i * 150);
      stampObs.unobserve(card);
    });
  }, { threshold: 0.4 });

  cards.forEach(card => stampObs.observe(card));
})();

// ── Marker-pen highlights ──
(function () {
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('highlight-swept');
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.7 });
  document.querySelectorAll('mark.highlight-mark').forEach(el => obs.observe(el));
})();

// ── Typewriter pull quotes ──
(function () {
  if (prefersReducedMotion) return;
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const bq = e.target;
      if (bq.dataset.typed) return;
      bq.dataset.typed = '1';
      obs.unobserve(bq);
      const text = bq.textContent;
      bq.setAttribute('aria-label', text);
      bq.textContent = '';
      const cursor = document.createElement('span');
      cursor.className = 'tw-cursor';
      cursor.setAttribute('aria-hidden', 'true');
      bq.appendChild(cursor);
      let i = 0;
      function typeNext() {
        if (i >= text.length) {
          let blinks = 0;
          const t = setInterval(() => {
            cursor.style.opacity = blinks % 2 === 0 ? '0' : '1';
            if (++blinks >= 6) { clearInterval(t); cursor.remove(); }
          }, 300);
          return;
        }
        const ch = text[i++];
        bq.insertBefore(document.createTextNode(ch), cursor);
        setTimeout(typeNext, /[.!?,]/.test(ch) ? 340 : 26);
      }
      typeNext();
    });
  }, { threshold: 0.5 });
  document.querySelectorAll('.pull-quote blockquote').forEach(bq => obs.observe(bq));
})();

// ── Inline number poppers ──
onIdle(() => {
  const tooltip = document.getElementById('num-pop-tooltip');
  if (!tooltip) return;
  let hideTimer;
  let activeEl = null;

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function positionForRect(rect) {
    const pad = 12;
    const gap = 10;
    const tw = tooltip.offsetWidth || 280;
    const th = tooltip.offsetHeight || 88;
    const candidates = [
      { x: rect.left, y: rect.bottom + gap },                 // bottom-left
      { x: rect.right - tw, y: rect.bottom + gap },           // bottom-right
      { x: rect.left, y: rect.top - th - gap },               // top-left
      { x: rect.right - tw, y: rect.top - th - gap },         // top-right
      { x: rect.left + (rect.width - tw) / 2, y: rect.bottom + gap }, // centered below
      { x: rect.left + (rect.width - tw) / 2, y: rect.top - th - gap } // centered above
    ];

    const inViewport = ({ x, y }) =>
      x >= pad &&
      y >= pad &&
      x + tw <= window.innerWidth - pad &&
      y + th <= window.innerHeight - pad;

    const chosen = candidates.find(inViewport) || candidates[0];
    const x = clamp(chosen.x, pad, window.innerWidth - tw - pad);
    const y = clamp(chosen.y, pad, window.innerHeight - th - pad);
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
  }

  function showTooltip(el) {
    clearTimeout(hideTimer);
    activeEl = el;
    tooltip.textContent = el.dataset.fact;
    tooltip.classList.add('visible');
    positionForRect(el.getBoundingClientRect());
  }

  document.querySelectorAll('.num-pop').forEach(el => {
    el.addEventListener('mouseenter', () => showTooltip(el));
    el.addEventListener('mouseleave', () => {
      hideTimer = setTimeout(() => {
        tooltip.classList.remove('visible');
        activeEl = null;
      }, 80);
    });
    el.addEventListener('focus', () => showTooltip(el));
    el.addEventListener('blur', () => {
      tooltip.classList.remove('visible');
      activeEl = null;
    });
  });

  const reposition = throttleWithRaf(() => {
    if (!activeEl || !tooltip.classList.contains('visible')) return;
    positionForRect(activeEl.getBoundingClientRect());
  });
  window.addEventListener('scroll', reposition, { passive: true });
  window.addEventListener('resize', reposition, { passive: true });
});

// ── Person profile cards ──
onIdle(() => {
  const PEOPLE = {
    sbf: {
      emoji: '🧑‍💼', color: '#c0392b',
      name: 'Sam Bankman-Fried',
      role: 'Founder & CEO, FTX',
      quote: '"I was CEO. The buck stopped with me." — Sam, day one after collapse.',
      status: 'Convicted on 7 counts. Sentenced to 25 years. Appeal pending before the Second Circuit (Nov 2025).'
    },
    ellison: {
      emoji: '👩‍💼', color: '#e67e22',
      name: 'Caroline Ellison',
      role: 'CEO, Alameda Research · Sam\'s ex-girlfriend',
      quote: '"To my knowledge, customers were never told their money was being taken."',
      status: 'Cooperated. Faced 110 years. Sentenced to 2 years. Released 2025. Failed to hedge Alameda\'s positions in 2022.'
    },
    wang: {
      emoji: '👨‍💻', color: '#2980b9',
      name: 'Gary Wang',
      role: 'Co-founder & CTO, FTX',
      quote: 'Confirmed on cross-examination that Alameda had a $250M positive surplus at the moment of the "FTX is fine" tweet.',
      status: 'Cooperated. Faced 50+ years. Sentenced to probation — zero prison time. Knew the fiat@ balance was growing for months.'
    },
    singh: {
      emoji: '🔧', color: '#27ae60',
      name: 'Nishad Singh',
      role: 'Head of Engineering, FTX',
      quote: 'Discovered the fiat@ software bug in November 2021. Did not alert Sam for six months.',
      status: 'Cooperated. Faced 50+ years. Sentenced to probation — zero prison time.'
    },
    kaplan: {
      emoji: '👨‍⚖️', color: '#8e44ad',
      name: 'Judge Lewis A. Kaplan',
      role: 'U.S. District Court, S.D.N.Y.',
      quote: '"I am unpersuaded." — Kaplan\'s response to nearly every defense request.',
      status: 'Blocked 6 of 7 defense experts. Barred all bankruptcy recovery evidence. Excluded FTX attorney testimony. Rulings form the core of the appeal.'
    },
    johnray: {
      emoji: '🏦', color: '#16a085',
      name: 'John Ray',
      role: 'Restructuring CEO, FTX (post-collapse)',
      quote: '"This is unprecedented." — Ray on the FTX estate, after filing Chapter 11 without consulting Sam.',
      status: 'Led the recovery that repaid 98% of customers with 20% interest — billions remain in the estate.'
    },
    cz: {
      emoji: '🐋', color: '#d35400',
      name: 'Changpeng "CZ" Zhao',
      role: 'Founder & CEO, Binance',
      quote: '"We won\'t support people who lobby against other crypto companies." — CZ\'s tweet before dumping FTT.',
      status: 'Triggered the bank run by publicly announcing FTT liquidation. Later pled guilty to US money laundering charges himself (2023).'
    }
  };

  const card = document.getElementById('person-card');
  const emojiEl = document.getElementById('pc-emoji');
  const nameEl  = document.getElementById('pc-name');
  const roleEl  = document.getElementById('pc-role');
  const quoteEl = document.getElementById('pc-quote');
  const statEl  = document.getElementById('pc-status');
  const closeBtn = document.getElementById('pc-close');
  if (!card) return;

  let lastTrigger = null;
  let suppressFocusReturn = false;

  function openCard(data, trigger) {
    card.style.setProperty('--pc-color', data.color);
    emojiEl.textContent = data.emoji;
    nameEl.textContent  = data.name;
    roleEl.textContent  = data.role;
    quoteEl.textContent = data.quote;
    statEl.textContent  = data.status;

    const rect = trigger.getBoundingClientRect();
    const pad = 10;
    const gap = 10;
    const cw = card.offsetWidth || 290;
    const ch = card.offsetHeight || 210;
    const candidates = [
      { x: rect.right + gap, y: rect.top },                         // right
      { x: rect.left - cw - gap, y: rect.top },                     // left
      { x: rect.left, y: rect.bottom + gap },                       // below
      { x: rect.left, y: rect.top - ch - gap }                      // above
    ];
    const inViewport = ({ x, y }) =>
      x >= pad &&
      y >= pad &&
      x + cw <= window.innerWidth - pad &&
      y + ch <= window.innerHeight - pad;
    const chosen = candidates.find(inViewport) || candidates[2];
    const x = Math.min(Math.max(chosen.x, pad), window.innerWidth - cw - pad);
    const y = Math.min(Math.max(chosen.y, pad), window.innerHeight - ch - pad);

    card.style.left = `${x}px`;
    card.style.top = `${y}px`;

    card.classList.add('pc-visible');
    lastTrigger = trigger;
  }

  function closeCard({ returnFocus = true } = {}) {
    card.classList.remove('pc-visible');
    if (returnFocus && lastTrigger && !suppressFocusReturn) lastTrigger.focus();
    lastTrigger = null;
  }

  document.querySelectorAll('.person-link').forEach(el => {
    const data = PEOPLE[el.dataset.person];
    if (!data) return;
    el.style.textDecorationColor = data.color;
    el.addEventListener('click', () => {
      if (card.classList.contains('pc-visible') && lastTrigger === el) {
        closeCard({ returnFocus: false });
      } else {
        openCard(data, el);
      }
    });
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openCard(data, el); }
    });
  });

  closeBtn?.addEventListener('click', closeCard);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && card.classList.contains('pc-visible')) closeCard();
  });
  document.addEventListener('click', e => {
    if (!card.contains(e.target) && !e.target.closest('.person-link')) closeCard({ returnFocus: false });
  });

  const repositionCard = throttleWithRaf(() => {
    if (!lastTrigger || !card.classList.contains('pc-visible')) return;
    const key = lastTrigger.dataset.person;
    const data = key ? PEOPLE[key] : null;
    if (!data) return;
    suppressFocusReturn = true;
    openCard(data, lastTrigger);
    suppressFocusReturn = false;
  });
  window.addEventListener('scroll', repositionCard, { passive: true });
  window.addEventListener('resize', repositionCard, { passive: true });
});

// ── Confetti + Jury-Never-Knew banner at 98% repayment ──
(function () {
  const banner = document.getElementById('jury-banner');
  if (!banner) return;

  function showBanner() {
    banner.classList.add('jury-banner--visible');
    setTimeout(() => banner.classList.remove('jury-banner--visible'), 4200);
  }

  function launchConfetti() {
    if (prefersReducedMotion) return;
    const canvas = document.createElement('canvas');
    canvas.id = 'confetti-canvas';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#c0392b','#e74c3c','#f39c12','#2ecc71','#3498db','#9b59b6','#f1c40f'];
    const particles = Array.from({ length: 90 }, () => ({
      x: Math.random() * canvas.width,
      y: -10 - Math.random() * 40,
      vx: (Math.random() - 0.5) * 3,
      vy: 2 + Math.random() * 3,
      rot: Math.random() * 360,
      rotV: (Math.random() - 0.5) * 6,
      w: 7 + Math.random() * 8,
      h: 4 + Math.random() * 5,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 1,
    }));

    let rafId;
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      particles.forEach(p => {
        p.x  += p.vx;
        p.y  += p.vy;
        p.vy += 0.05;
        p.rot += p.rotV;
        p.life -= 0.008;
        if (p.life <= 0 || p.y > canvas.height + 20) return;
        alive = true;
        ctx.save();
        ctx.globalAlpha = Math.min(p.life, 1);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot * Math.PI / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      if (alive) { rafId = requestAnimationFrame(draw); }
      else { canvas.remove(); }
    }
    rafId = requestAnimationFrame(draw);
    setTimeout(() => { cancelAnimationFrame(rafId); canvas.remove(); }, 3800);
  }

  // Hook into repayment scrolly step 5 (98%)
  const step98 = document.querySelector('.srp-step[data-pct="98"]');
  if (!step98) return;
  let fired = false;
  const obs = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && !fired) {
      fired = true;
      launchConfetti();
      showBanner();
    }
  }, { threshold: 0.5 });
  obs.observe(step98);
})();
