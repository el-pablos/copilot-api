/**
 * Bottom Navigation Component - Mobile Only
 * Integrates with Alpine.js activeTab state
 */
(function () {
  const navItems = [
    { id: "dashboard", label: "Home", icon: "home" },
    { id: "models", label: "Models", icon: "cpu" },
    { id: "logs", label: "Logs", icon: "scroll" },
    { id: "settings", label: "Settings", icon: "settings" },
  ];

  const icons = {
    home: `<svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>`,
    cpu: `<svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"/></svg>`,
    scroll: `<svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>`,
    settings: `<svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>`,
  };

  function createBottomNav() {
    const nav = document.createElement("nav");
    nav.className = "bottom-nav";
    nav.id = "bottom-nav";
    nav.setAttribute("role", "navigation");
    nav.setAttribute("aria-label", "Main navigation");

    const container = document.createElement("div");
    container.className = "bottom-nav-container";

    navItems.forEach((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "bottom-nav-item";
      button.setAttribute("aria-label", item.label);
      button.dataset.tab = item.id;

      button.innerHTML = `
        <span class="nav-icon">${icons[item.icon]}</span>
        <span class="nav-label">${item.label}</span>
        <span class="nav-indicator"></span>
      `;

      container.appendChild(button);
    });

    nav.appendChild(container);
    return nav;
  }

  function initBottomNav() {
    // Don't init if already exists
    if (document.getElementById("bottom-nav")) return;

    const nav = createBottomNav();
    document.body.appendChild(nav);

    // Handle click events - integrate with Alpine.js
    nav.addEventListener("click", (e) => {
      const item = e.target.closest(".bottom-nav-item");
      if (!item) return;

      const tab = item.dataset.tab;
      if (!tab) return;

      // Find Alpine app instance and update activeTab
      const appEl = document.querySelector("[x-data]");
      if (appEl && appEl._x_dataStack) {
        const appData = appEl._x_dataStack[0];
        if (appData && typeof appData.activeTab !== "undefined") {
          appData.activeTab = tab;
        }
      }
    });

    // Update active state based on Alpine's activeTab
    function updateActiveState(activeTab) {
      nav.querySelectorAll(".bottom-nav-item").forEach((item) => {
        const itemTab = item.dataset.tab;
        const isActive = itemTab === activeTab;
        item.classList.toggle("active", isActive);
        item.setAttribute("aria-current", isActive ? "page" : "false");
      });
    }

    // Watch for Alpine activeTab changes via MutationObserver
    // This runs after Alpine initializes
    function watchAlpineState() {
      const appEl = document.querySelector("[x-data]");
      if (!appEl || !appEl._x_dataStack) {
        // Alpine not ready yet, retry
        setTimeout(watchAlpineState, 100);
        return;
      }

      const appData = appEl._x_dataStack[0];
      if (!appData) return;

      // Initial update
      updateActiveState(appData.activeTab || "dashboard");

      // Use Alpine's effect system if available
      if (typeof Alpine !== "undefined" && Alpine.effect) {
        Alpine.effect(() => {
          updateActiveState(appData.activeTab);
        });
      } else {
        // Fallback: poll for changes
        let lastTab = appData.activeTab;
        setInterval(() => {
          if (appData.activeTab !== lastTab) {
            lastTab = appData.activeTab;
            updateActiveState(lastTab);
          }
        }, 100);
      }
    }

    // Start watching after DOM is ready
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", watchAlpineState);
    } else {
      // Give Alpine time to initialize
      setTimeout(watchAlpineState, 100);
    }

    return nav;
  }

  // Expose to window
  window.BottomNav = {
    create: createBottomNav,
    init: initBottomNav,
  };
})();
