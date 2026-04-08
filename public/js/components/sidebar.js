/**
 * Desktop Sidebar Component
 */
(function () {
  function createSidebar() {
    const sidebar = document.createElement("aside");
    sidebar.className = "app-sidebar desktop-only";
    sidebar.id = "desktop-sidebar";

    sidebar.innerHTML = `
      <!-- Logo -->
      <div class="sidebar-header">
        <div class="sidebar-logo">
          <div class="logo-icon">
            <svg class="w-8 h-8" viewBox="0 0 32 32" fill="none">
              <defs>
                <linearGradient id="sidebar-logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#a855f7"/>
                  <stop offset="100%" stop-color="#22d3ee"/>
                </linearGradient>
              </defs>
              <path fill="url(#sidebar-logo-grad)" d="M16 4L28 12v8l-12 8-12-8v-8l12-8z"/>
            </svg>
          </div>
          <div class="logo-text">
            <span class="logo-title">Copilot API</span>
            <span class="logo-version">v0.7.0</span>
          </div>
        </div>
        <button class="sidebar-collapse-btn" id="sidebar-collapse" aria-label="Collapse sidebar">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="m15 18-6-6 6-6"/>
          </svg>
        </button>
      </div>

      <!-- Navigation -->
      <nav class="sidebar-nav">
        <a href="#/" class="sidebar-nav-item" data-page="dashboard">
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9,22 9,12 15,12 15,22"/>
          </svg>
          <span class="nav-label">Dashboard</span>
        </a>
        <a href="#/models" class="sidebar-nav-item" data-page="models">
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="4" y="4" width="16" height="16" rx="2"/>
            <rect x="9" y="9" width="6" height="6"/>
            <path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3"/>
          </svg>
          <span class="nav-label">Models</span>
        </a>
        <a href="#/logs" class="sidebar-nav-item" data-page="logs">
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>
          </svg>
          <span class="nav-label">Logs</span>
        </a>
        <a href="#/accounts" class="sidebar-nav-item" data-page="accounts">
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          <span class="nav-label">Accounts</span>
        </a>
        <a href="#/settings" class="sidebar-nav-item" data-page="settings">
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          <span class="nav-label">Settings</span>
        </a>
      </nav>

      <!-- Footer -->
      <div class="sidebar-footer">
        <div class="user-info">
          <div class="user-avatar" id="sidebar-user-avatar">?</div>
          <div class="user-details">
            <span class="user-name" id="sidebar-user-name">Loading...</span>
            <span class="user-role">GitHub Account</span>
          </div>
        </div>
      </div>
    `;

    return sidebar;
  }

  function init() {
    // Only init on desktop
    if (window.innerWidth < 768) return;

    const sidebar = createSidebar();
    const appContainer = document.querySelector(".app-container");
    if (appContainer) {
      appContainer.insertBefore(sidebar, appContainer.firstChild);
    }

    // Handle active state
    function updateActiveState() {
      const hash = window.location.hash || "#/";
      const page = hash.replace("#/", "") || "dashboard";

      sidebar.querySelectorAll(".sidebar-nav-item").forEach((item) => {
        const itemPage = item.dataset.page;
        const isActive =
          page === itemPage || (page === "" && itemPage === "dashboard");
        item.classList.toggle("active", isActive);
      });
    }

    window.addEventListener("hashchange", updateActiveState);
    updateActiveState();

    // Collapse button
    const collapseBtn = document.getElementById("sidebar-collapse");
    collapseBtn?.addEventListener("click", () => {
      sidebar.classList.toggle("collapsed");
      localStorage.setItem(
        "sidebar-collapsed",
        sidebar.classList.contains("collapsed"),
      );
    });

    // Restore collapsed state
    if (localStorage.getItem("sidebar-collapsed") === "true") {
      sidebar.classList.add("collapsed");
    }

    // Update user info when available
    window.addEventListener("user-loaded", (e) => {
      const user = e.detail;
      if (user) {
        document.getElementById("sidebar-user-name").textContent =
          user.login || "User";
        document.getElementById("sidebar-user-avatar").textContent =
          (user.login || "U")[0].toUpperCase();
      }
    });
  }

  // Handle resize
  let resizeTimeout;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      const existing = document.getElementById("desktop-sidebar");
      if (window.innerWidth >= 768 && !existing) {
        init();
      } else if (window.innerWidth < 768 && existing) {
        existing.remove();
      }
    }, 100);
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.Sidebar = { init };
})();
