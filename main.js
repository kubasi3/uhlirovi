(() => {
  'use strict';

  // =========================
  // i18n (multi-language)
  // =========================

  const DEFAULT_LANG = document.documentElement.getAttribute('data-default-lang') || 'cs';
  const STORAGE_KEY = 'wedding.lang';

  const langSelect = document.getElementById('lang_switcher');

  const embeddedIndex = {
    default: 'cs',
    languages: {
      cs: 'Česky',
      en: 'English',
    },
  };

  // Minimal embedded fallback strings (full translations live in /i18n/*.json).
  const embeddedDicts = {
    cs: {
      meta: { title: 'Svatební stránky' },
      aria: { menuLabel: 'Menu' },
      language: { label: 'Jazyk', ariaLabel: 'Výběr jazyka' },
      countdown: {
        prefixFuture: 'Protože zbývá pouze ',
        prefixPast: 'Od začátku svatby uběhlo již ',
        unitDay: 'd',
        unitHour: 'h',
        unitMinute: 'm',
        unitSecond: 's',
      },
    },
    en: {
      meta: { title: 'Wedding website' },
      aria: { menuLabel: 'Menu' },
      language: { label: 'Language', ariaLabel: 'Select language' },
      countdown: {
        prefixFuture: 'Only ',
        prefixPast: 'It has been ',
        unitDay: 'd',
        unitHour: 'h',
        unitMinute: 'm',
        unitSecond: 's',
      },
    },
  };

  const state = {
    index: null,
    dicts: new Map(),
    currentLang: DEFAULT_LANG,
  };

  const normalizeLang = (raw) => {
    if (!raw) return null;
    return String(raw).toLowerCase().trim().split('-')[0] || null;
  };

  const safeJsonFetch = async (url) => {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (_) {
      return null;
    }
  };

  const getNested = (obj, path) => {
    if (!obj) return undefined;
    const parts = String(path).split('.');
    let cur = obj;
    for (const p of parts) {
      if (cur && Object.prototype.hasOwnProperty.call(cur, p)) cur = cur[p];
      else return undefined;
    }
    return cur;
  };

  const getQueryLang = () => {
    try {
      const url = new URL(window.location.href);
      const raw = url.searchParams.get('lang');
      return normalizeLang(raw);
    } catch (_) {
      return null;
    }
  };

  const getAvailableLangs = (index) => {
    const langs = (index && index.languages) ? index.languages : embeddedIndex.languages;
    return {
      default: (index && index.default) ? index.default : embeddedIndex.default,
      languages: langs,
      codes: new Set(Object.keys(langs)),
    };
  };

  const t = (key) => {
    const lang = state.currentLang;

    const dict = state.dicts.get(lang) || embeddedDicts[lang];
    const fallback = state.dicts.get(DEFAULT_LANG) || embeddedDicts[DEFAULT_LANG];

    const v1 = getNested(dict, key);
    if (typeof v1 === 'string') return v1;

    const v2 = getNested(fallback, key);
    if (typeof v2 === 'string') return v2;

    // If no translation exists, do nothing (keeps original HTML text).
    return null;
  };

  const applyTranslations = () => {
    document.documentElement.lang = state.currentLang;

    const title = t('meta.title');
    if (title) document.title = title;

    const ariaLabel = t('language.ariaLabel');
    if (ariaLabel && langSelect) langSelect.setAttribute('aria-label', ariaLabel);

    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      const val = t(key);
      if (val !== null) el.textContent = val;
    });

    document.querySelectorAll('[data-i18n-html]').forEach((el) => {
      const key = el.getAttribute('data-i18n-html');
      const val = t(key);
      if (val !== null) el.innerHTML = val;
    });

    document.querySelectorAll('[data-i18n-attr]').forEach((el) => {
      const spec = (el.getAttribute('data-i18n-attr') || '').trim();
      if (!spec) return;

      // Format: attr:key|attr:key
      spec.split('|').map((s) => s.trim()).filter(Boolean).forEach((pair) => {
        const idx = pair.indexOf(':');
        if (idx <= 0) return;
        const attr = pair.slice(0, idx).trim();
        const key = pair.slice(idx + 1).trim();
        if (!attr || !key) return;

        const val = t(key);
        if (val !== null) el.setAttribute(attr, val);
      });
    });
  };

  const populateLanguageSelect = (index) => {
    if (!langSelect) return;

    const { languages } = getAvailableLangs(index);

    const current = state.currentLang;
    langSelect.innerHTML = '';

    Object.entries(languages).forEach(([code, label]) => {
      const opt = document.createElement('option');
      opt.value = code;
      opt.textContent = label;
      langSelect.appendChild(opt);
    });

    langSelect.value = current;
  };

  const loadIndex = async () => {
    const idx = await safeJsonFetch('i18n/index.json');
    state.index = idx || embeddedIndex;
    return state.index;
  };

  const loadDict = async (lang) => {
    const code = normalizeLang(lang) || DEFAULT_LANG;
    if (state.dicts.has(code)) return state.dicts.get(code);

    const dict = await safeJsonFetch(`i18n/${code}.json`);
    if (dict) state.dicts.set(code, dict);
    return dict;
  };

  const chooseInitialLang = (index) => {
    const { default: def, codes } = getAvailableLangs(index);

    const fromQuery = getQueryLang();
    if (fromQuery && codes.has(fromQuery)) return fromQuery;

    const stored = normalizeLang(localStorage.getItem(STORAGE_KEY));
    if (stored && codes.has(stored)) return stored;

    const nav = normalizeLang(navigator.language || '');
    if (nav && codes.has(nav)) return nav;

    return def || DEFAULT_LANG;
  };

  const setLang = async (lang, { persist = true } = {}) => {
    const { default: def, codes } = getAvailableLangs(state.index);

    const requested = normalizeLang(lang);
    const next = (requested && codes.has(requested)) ? requested : (def || DEFAULT_LANG);

    state.currentLang = next;

    if (persist) {
      try { localStorage.setItem(STORAGE_KEY, next); } catch (_) { /* ignore */ }
    }

    await loadDict(next);

    if (langSelect) langSelect.value = next;

    applyTranslations();
    renderCountdown();
  };

  // =========================
  // Countdown
  // =========================

  // Interpreted in the visitor's local timezone.
  const WEDDING_START_MS = new Date('2026-06-06T10:00:00').getTime();
  const counterEl = document.getElementById('counter');

  const MS = {
    second: 1000,
    minute: 1000 * 60,
    hour: 1000 * 60 * 60,
    day: 1000 * 60 * 60 * 24,
  };

  const toParts = (ms) => {
    const days = Math.floor(ms / MS.day);
    ms %= MS.day;
    const hours = Math.floor(ms / MS.hour);
    ms %= MS.hour;
    const minutes = Math.floor(ms / MS.minute);
    ms %= MS.minute;
    const seconds = Math.floor(ms / MS.second);
    return { days, hours, minutes, seconds };
  };

  const renderCountdown = () => {
    if (!counterEl || !Number.isFinite(WEDDING_START_MS)) return;

    const now = Date.now();
    const diff = WEDDING_START_MS - now;
    const abs = Math.abs(diff);
    const { days, hours, minutes, seconds } = toParts(abs);

    const prefix = diff >= 0
      ? (t('countdown.prefixFuture') || 'Protože zbývá pouze ')
      : (t('countdown.prefixPast') || 'Od začátku svatby uběhlo již ');

    const dU = t('countdown.unitDay') || 'd';
    const hU = t('countdown.unitHour') || 'h';
    const mU = t('countdown.unitMinute') || 'm';
    const sU = t('countdown.unitSecond') || 's';

    counterEl.textContent = `${prefix}${days}${dU} ${hours}${hU} ${minutes}${mU} ${seconds}${sU}`;
  };

  if (counterEl && Number.isFinite(WEDDING_START_MS)) {
    renderCountdown();
    window.setInterval(renderCountdown, 1000);
  }

  // =========================
  // Mobile menu
  // =========================

  const menuButton = document.getElementById('button_menu');
  const nav = document.getElementById('section_menu');

  if (menuButton && nav) {
    const navLinks = nav.querySelectorAll('a');

    const isOpen = () => menuButton.getAttribute('aria-expanded') === 'true';
    const setOpen = (open) => menuButton.setAttribute('aria-expanded', String(open));

    // Defaults
    if (!menuButton.hasAttribute('aria-expanded')) setOpen(false);

    menuButton.addEventListener('click', () => setOpen(!isOpen()));

    navLinks.forEach((link) => {
      link.addEventListener('click', () => setOpen(false));
    });

    // Close on escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') setOpen(false);
    });

    // Close on outside click (helps on mobile)
    document.addEventListener('click', (e) => {
      const target = e.target;
      if (!(target instanceof Node)) return;
      if (menuButton.contains(target) || nav.contains(target)) return;
      setOpen(false);
    }, { capture: true });
  }

  // =========================
  // Bootstrap
  // =========================

  (async () => {
    const index = await loadIndex();

    // Ensure the default language dictionary is available (for fallback + correct title, etc.).
    await loadDict(DEFAULT_LANG);

    // Pick initial language.
    const initial = chooseInitialLang(index);
    state.currentLang = initial;

    // Populate language selector.
    populateLanguageSelect(index);

    if (langSelect) {
      langSelect.addEventListener('change', () => {
        setLang(langSelect.value);
      });
    }

    // Load current language + apply.
    await setLang(initial, { persist: true });
  })();
})();
