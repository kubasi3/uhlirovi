(() => {
  'use strict';

  // ===== Countdown =====
  // Interpreted in the visitor's local timezone.
  const WEDDING_START_MS = new Date('2026-06-06T10:00:00').getTime();
  const counterEl = document.getElementById('counter');

  if (counterEl && Number.isFinite(WEDDING_START_MS)) {
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
      const now = Date.now();
      const diff = WEDDING_START_MS - now;
      const abs = Math.abs(diff);
      const { days, hours, minutes, seconds } = toParts(abs);

      const prefix = diff >= 0
        ? 'Protože zbývá pouze '
        : 'Od začátku svatby uběhlo již ';

      counterEl.textContent = `${prefix}${days}d ${hours}h ${minutes}m ${seconds}s`;
    };

    renderCountdown();
    window.setInterval(renderCountdown, 1000);
  }

  // ===== Mobile menu =====
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
})();
