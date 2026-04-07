/**
 * Mobile Header Component
 * Self-contained module that exposes functions to window object
 */
(function () {
  "use strict";

  /**
   * Create mobile header element
   */
  function createMobileHeader() {
    const header = document.createElement("header");
    header.className = "app-header mobile-only";
    header.id = "mobile-header";

    header.innerHTML = `
    <div class="header-left">
      <div class="header-logo">
        <svg class="w-8 h-8" viewBox="0 0 32 32" fill="none">
          <defs>
            <linearGradient id="logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#a855f7"/>
              <stop offset="100%" stop-color="#22d3ee"/>
            </linearGradient>
          </defs>
          <path fill="url(#logo-gradient)" d="M16 4L28 12v8l-12 8-12-8v-8l12-8z"/>
          <path fill="white" d="M16 8l8 5.33v5.34L16 24l-8-5.33v-5.34L16 8z" opacity="0.3"/>
        </svg>
        <span class="header-title">Copilot</span>
      </div>
    </div>

    <div class="header-center">
      <div class="status-badge" id="status-badge">
        <span class="status-dot"></span>
        <span class="status-text">Connecting...</span>
      </div>
    </div>

    <div class="header-right">
      <button class="header-menu-btn" id="header-menu-btn" aria-label="Open menu">
        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
        </svg>
      </button>
    </div>
  `;

    return header;
  }

  /**
   * Update status badge state
   * @param {string} status - Status type: 'online', 'offline', 'warning'
   * @param {string} text - Status text to display
   */
  function updateStatusBadge(status, text) {
    const badge = document.getElementById("status-badge");
    if (!badge) return;

    badge.className = `status-badge status-${status}`;
    const textEl = badge.querySelector(".status-text");
    if (textEl) {
      textEl.textContent = text;
    }
  }

  /**
   * Initialize mobile header and attach to DOM
   * @returns {HTMLElement} The created header element
   */
  function initMobileHeader() {
    // Prevent duplicate initialization
    if (document.getElementById("mobile-header")) {
      return document.getElementById("mobile-header");
    }

    const header = createMobileHeader();
    const appContainer = document.querySelector(".app-container");

    if (appContainer) {
      appContainer.insertBefore(header, appContainer.firstChild);
    } else {
      document.body.insertBefore(header, document.body.firstChild);
    }

    // Menu button handler - dispatch custom event
    const menuBtn = document.getElementById("header-menu-btn");
    if (menuBtn) {
      menuBtn.addEventListener("click", () => {
        document.dispatchEvent(new CustomEvent("toggle-menu"));
      });
    }

    return header;
  }

  // Expose to window object
  window.MobileHeader = {
    init: initMobileHeader,
    updateStatus: updateStatusBadge,
  };
})();
