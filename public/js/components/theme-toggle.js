/**
 * Theme Toggle Component
 * Supports: dark, light, system (auto)
 * Features: localStorage persistence, system preference detection, dropdown menu
 */
(function () {
  "use strict";

  const STORAGE_KEY = "copilot-api-theme";
  const THEMES = ["light", "dark", "system"];
  const DEFAULT_THEME = "system";

  // SVG Icons
  const icons = {
    sun: `<svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="5"/>
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
    </svg>`,
    moon: `<svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>`,
    system: `<svg class="icon-system" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
      <line x1="8" y1="21" x2="16" y2="21"/>
      <line x1="12" y1="17" x2="12" y2="21"/>
    </svg>`,
    check: `<svg class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>`,
  };

  // Theme labels
  const labels = {
    light: "Light",
    dark: "Dark",
    system: "System",
  };

  /**
   * Get system color scheme preference
   */
  function getSystemTheme() {
    return window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  }

  /**
   * Get stored theme preference
   */
  function getStoredTheme() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored && THEMES.includes(stored) ? stored : null;
    } catch {
      return null;
    }
  }

  /**
   * Get current theme preference (stored or default)
   */
  function getPreferredTheme() {
    return getStoredTheme() || DEFAULT_THEME;
  }

  /**
   * Get the effective theme (resolved system preference)
   */
  function getEffectiveTheme(theme) {
    if (theme === "system") {
      return getSystemTheme();
    }
    return theme;
  }

  /**
   * Apply theme to document
   */
  function applyTheme(theme, withTransition = true) {
    const root = document.documentElement;

    // Add transition class for smooth theme change
    if (withTransition) {
      root.classList.add("theme-transitioning");
    }

    // Set theme attribute
    root.setAttribute("data-theme", theme);

    // Update meta theme-color for mobile browsers
    updateMetaThemeColor(theme);

    // Remove transition class after animation
    if (withTransition) {
      setTimeout(() => {
        root.classList.remove("theme-transitioning");
      }, 300);
    }
  }

  /**
   * Update meta theme-color for mobile browser chrome
   */
  function updateMetaThemeColor(theme) {
    const effectiveTheme = getEffectiveTheme(theme);
    const color = effectiveTheme === "light" ? "#fafafc" : "#0f0f1a";

    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }
    meta.content = color;
  }

  /**
   * Save theme preference to localStorage
   */
  function saveTheme(theme) {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // localStorage not available
    }
  }

  /**
   * Set theme (save and apply)
   */
  function setTheme(theme) {
    if (!THEMES.includes(theme)) {
      theme = DEFAULT_THEME;
    }

    saveTheme(theme);
    applyTheme(theme);
    updateAllToggles(theme);
    dispatchThemeChangeEvent(theme);
  }

  /**
   * Toggle between themes (light -> dark -> system -> light)
   */
  function toggle() {
    const current = getPreferredTheme();
    const currentIndex = THEMES.indexOf(current);
    const nextIndex = (currentIndex + 1) % THEMES.length;
    setTheme(THEMES[nextIndex]);
  }

  /**
   * Quick toggle between light and dark only
   */
  function quickToggle() {
    const current = getPreferredTheme();
    const effective = getEffectiveTheme(current);
    setTheme(effective === "dark" ? "light" : "dark");
  }

  /**
   * Dispatch custom event for theme changes
   */
  function dispatchThemeChangeEvent(theme) {
    const event = new CustomEvent("themechange", {
      detail: {
        theme,
        effectiveTheme: getEffectiveTheme(theme),
      },
    });
    window.dispatchEvent(event);
  }

  /**
   * Update all theme toggle buttons
   */
  function updateAllToggles(theme) {
    document.querySelectorAll(".theme-toggle").forEach((btn) => {
      const effectiveTheme = getEffectiveTheme(theme);
      btn.setAttribute(
        "aria-label",
        `Current theme: ${labels[theme]}. Click to change.`,
      );
      btn.dataset.theme = theme;
      btn.dataset.effectiveTheme = effectiveTheme;
    });

    // Update dropdown items
    document.querySelectorAll(".theme-dropdown-item").forEach((item) => {
      const itemTheme = item.dataset.theme;
      item.classList.toggle("active", itemTheme === theme);
      item.setAttribute("aria-checked", itemTheme === theme);
    });
  }

  /**
   * Create theme toggle button (simple version)
   */
  function createToggleButton() {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "theme-toggle";
    btn.setAttribute("aria-label", "Toggle theme");
    btn.innerHTML = icons.sun + icons.moon + icons.system;

    btn.addEventListener("click", quickToggle);

    return btn;
  }

  /**
   * Create theme toggle with dropdown menu
   */
  function createToggleWithDropdown() {
    const wrapper = document.createElement("div");
    wrapper.className = "theme-toggle-wrapper";

    // Toggle button
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "theme-toggle";
    btn.setAttribute("aria-label", "Toggle theme");
    btn.setAttribute("aria-haspopup", "true");
    btn.setAttribute("aria-expanded", "false");
    btn.innerHTML = icons.sun + icons.moon + icons.system;

    // Dropdown menu
    const dropdown = document.createElement("div");
    dropdown.className = "theme-dropdown";
    dropdown.setAttribute("role", "menu");
    dropdown.setAttribute("aria-label", "Theme options");

    THEMES.forEach((theme) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "theme-dropdown-item";
      item.dataset.theme = theme;
      item.setAttribute("role", "menuitemradio");
      item.setAttribute("aria-checked", "false");

      const iconKey =
        theme === "system" ? "system" : theme === "light" ? "sun" : "moon";
      item.innerHTML = `
        ${icons[iconKey].replace(/class="[^"]*"/, 'class="item-icon"')}
        <span>${labels[theme]}</span>
        ${icons.check}
      `;

      item.addEventListener("click", () => {
        setTheme(theme);
        closeDropdown();
      });

      dropdown.appendChild(item);
    });

    wrapper.appendChild(btn);
    wrapper.appendChild(dropdown);

    // Toggle dropdown
    function toggleDropdown() {
      const isOpen = dropdown.classList.contains("open");
      if (isOpen) {
        closeDropdown();
      } else {
        openDropdown();
      }
    }

    function openDropdown() {
      dropdown.classList.add("open");
      btn.setAttribute("aria-expanded", "true");
    }

    function closeDropdown() {
      dropdown.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
    }

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleDropdown();
    });

    // Close on outside click
    document.addEventListener("click", (e) => {
      if (!wrapper.contains(e.target)) {
        closeDropdown();
      }
    });

    // Close on escape
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeDropdown();
      }
    });

    return wrapper;
  }

  /**
   * Initialize theme system
   */
  function init() {
    // Apply initial theme without transition
    const initialTheme = getPreferredTheme();
    applyTheme(initialTheme, false);

    // Listen for system preference changes
    const mediaQuery = window.matchMedia("(prefers-color-scheme: light)");
    mediaQuery.addEventListener("change", () => {
      const current = getPreferredTheme();
      if (current === "system") {
        // Re-apply system theme to trigger visual update
        applyTheme("system");
        updateAllToggles("system");
        dispatchThemeChangeEvent("system");
      }
    });

    // Listen for storage changes (sync across tabs)
    window.addEventListener("storage", (e) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        const newTheme = e.newValue;
        if (THEMES.includes(newTheme)) {
          applyTheme(newTheme);
          updateAllToggles(newTheme);
        }
      }
    });

    // Auto-add toggle to header if exists
    const headerActions = document.querySelector(".app-header-actions");
    if (headerActions) {
      const toggle = createToggleWithDropdown();
      headerActions.insertBefore(toggle, headerActions.firstChild);
      updateAllToggles(initialTheme);
    }
  }

  // Initialize on DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Expose API
  window.ThemeToggle = {
    // Methods
    toggle,
    quickToggle,
    setTheme,
    getTheme: getPreferredTheme,
    getEffectiveTheme: () => getEffectiveTheme(getPreferredTheme()),
    getSystemTheme,

    // Factory methods
    createToggleButton,
    createToggleWithDropdown,

    // Constants
    THEMES,
    STORAGE_KEY,
  };
})();
