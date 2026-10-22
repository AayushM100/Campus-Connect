/**
 * CampusConnect Unified Theme Manager
 * Provides reliable, site-wide light and dark mode toggling, system preference detection,
 * FOUC prevention, and synchronized storage across all CampusConnect modules.
 */

(function () {
  'use strict';

  var STORAGE_KEY = 'campusConnectTheme';
  var COMPAT_CANTEEN_KEY = 'campusBitesTheme';
  var COMPAT_LEGACY_KEY = 'darkMode';

  // SVG Icons for clean rendering without external icon-library dependency
  var SUN_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-sun"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>';
  var MOON_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-moon"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>';

  /**
   * Determine currently active theme
   */
  function getPreferredTheme() {
    try {
      var stored = localStorage.getItem(STORAGE_KEY) ||
                   localStorage.getItem(COMPAT_CANTEEN_KEY) ||
                   (localStorage.getItem(COMPAT_LEGACY_KEY) === 'true' ? 'dark' : (localStorage.getItem(COMPAT_LEGACY_KEY) === 'false' ? 'light' : null));
      if (stored === 'dark' || stored === 'light') {
        return stored;
      }
    } catch (e) {
      console.warn('CampusConnect: localStorage inaccessible', e);
    }

    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  }

  /**
   * Apply theme to DOM and sync storage
   */
  function applyTheme(theme, savePreference) {
    if (theme !== 'dark' && theme !== 'light') {
      theme = 'light';
    }

    var isDark = theme === 'dark';
    document.documentElement.setAttribute('data-theme', theme);

    if (document.body) {
      document.body.classList.toggle('dark-mode', isDark);
    }

    if (savePreference) {
      try {
        localStorage.setItem(STORAGE_KEY, theme);
        localStorage.setItem(COMPAT_CANTEEN_KEY, theme);
        localStorage.setItem(COMPAT_LEGACY_KEY, String(isDark));
      } catch (e) {
        console.warn('CampusConnect: could not persist theme', e);
      }
    }

    updateToggleButtons(theme);

    // Dispatch global event for other components if needed
    window.dispatchEvent(new CustomEvent('campusConnectThemeChanged', { detail: { theme: theme, isDark: isDark } }));
  }

  /**
   * Update visual state of all theme buttons on the page
   */
  function updateToggleButtons(theme) {
    var isDark = theme === 'dark';
    var label = isDark ? 'Switch to light mode' : 'Switch to dark mode';
    var icon = isDark ? SUN_ICON : MOON_ICON;

    var toggles = document.querySelectorAll('.cc-theme-toggle, .theme-button, .dark-mode-btn');
    toggles.forEach(function (btn) {
      btn.innerHTML = icon;
      btn.setAttribute('aria-label', label);
      btn.setAttribute('title', label);
      btn.setAttribute('aria-pressed', String(isDark));
    });
  }

  /**
   * Toggle between themes
   */
  function toggleTheme() {
    var current = document.documentElement.getAttribute('data-theme') || getPreferredTheme();
    var next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next, true);
  }

  /**
   * Auto-mount standard toggle button into navbars if not already present
   */
  function mountThemeButtons() {
    var existing = document.querySelector('.cc-theme-toggle');
    if (!existing) {
      // Look for suitable navigation containers
      var navContainer = document.querySelector('.home-nav-links') ||
                         document.querySelector('.navbar nav') ||
                         document.querySelector('.landing-nav') ||
                         document.querySelector('header nav');

      if (navContainer) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'cc-theme-toggle';
        btn.setAttribute('aria-label', 'Toggle theme');
        btn.addEventListener('click', toggleTheme);
        navContainer.appendChild(btn);
      }
    }

    // Bind any existing buttons
    var allToggles = document.querySelectorAll('.cc-theme-toggle, .theme-button');
    allToggles.forEach(function (btn) {
      btn.removeEventListener('click', toggleTheme);
      btn.addEventListener('click', toggleTheme);
    });

    updateToggleButtons(getPreferredTheme());
  }

  // Initial immediate application
  var initialTheme = getPreferredTheme();
  document.documentElement.setAttribute('data-theme', initialTheme);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      applyTheme(initialTheme, false);
      mountThemeButtons();
    });
  } else {
    applyTheme(initialTheme, false);
    mountThemeButtons();
  }

  // Listen to OS system preference changes (if user hasn't explicitly set in session)
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
      var hasExplicit = false;
      try {
        hasExplicit = Boolean(localStorage.getItem(STORAGE_KEY));
      } catch (err) {}

      if (!hasExplicit) {
        applyTheme(e.matches ? 'dark' : 'light', false);
      }
    });
  }

  // Expose API on window
  window.CampusConnectTheme = {
    get: function () {
      return document.documentElement.getAttribute('data-theme') || getPreferredTheme();
    },
    set: function (theme) {
      applyTheme(theme, true);
    },
    toggle: toggleTheme
  };
})();
