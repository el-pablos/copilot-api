/**
 * Command Palette Component - Cmd+K
 */
(function () {
  const commands = [
    {
      id: "dashboard",
      label: "Go to Dashboard",
      shortcut: "G D",
      icon: "home",
      action: () => navigateTo("dashboard"),
    },
    {
      id: "models",
      label: "View Models",
      shortcut: "G M",
      icon: "cpu",
      action: () => navigateTo("models"),
    },
    {
      id: "logs",
      label: "View Logs",
      shortcut: "G L",
      icon: "scroll",
      action: () => navigateTo("logs"),
    },
    {
      id: "settings",
      label: "Settings",
      shortcut: "G S",
      icon: "settings",
      action: () => navigateTo("settings"),
    },
    {
      id: "refresh",
      label: "Refresh Data",
      shortcut: "R",
      icon: "refresh",
      action: () => window.dispatchEvent(new CustomEvent("refresh-data")),
    },
  ];

  function createPalette() {
    const container = document.createElement("div");
    container.id = "command-palette";
    container.className = "command-palette-overlay hidden";
    container.innerHTML = `
      <div class="command-palette-backdrop"></div>
      <div class="command-palette-modal">
        <h2 id="command-palette-title" class="sr-only">Command Palette</h2>
        <div class="command-palette-search">
          <svg class="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input type="text" placeholder="Type a command or search..." autofocus />
          <kbd>ESC</kbd>
        </div>
        <div class="command-palette-results"></div>
      </div>
    `;

    // Add ARIA attributes programmatically for accessibility
    const modal = container.querySelector(".command-palette-modal");
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "command-palette-title");

    const searchInput = container.querySelector("input");
    searchInput.setAttribute("aria-label", "Search commands");

    const searchIcon = container.querySelector(".search-icon");
    searchIcon.setAttribute("aria-hidden", "true");

    const results = container.querySelector(".command-palette-results");
    results.setAttribute("role", "listbox");
    results.setAttribute("aria-label", "Available commands");

    document.body.appendChild(container);
    return container;
  }

  function renderResults(filtered, selectedIndex) {
    const results = document.querySelector(".command-palette-results");
    if (!filtered.length) {
      const noResults = document.createElement("div");
      noResults.className = "no-results";
      noResults.setAttribute("role", "status");
      noResults.textContent = "No commands found";
      results.innerHTML = "";
      results.appendChild(noResults);
      return;
    }
    results.innerHTML = filtered
      .map(
        (cmd, i) => `
      <button class="command-item ${i === selectedIndex ? "selected" : ""}" data-id="${cmd.id}">
        <span class="command-label">${cmd.label}</span>
        <kbd>${cmd.shortcut}</kbd>
      </button>
    `,
      )
      .join("");

    // Add ARIA attributes to command items
    results.querySelectorAll(".command-item").forEach((item, i) => {
      item.setAttribute("role", "option");
      item.setAttribute(
        "aria-selected",
        i === selectedIndex ? "true" : "false",
      );
    });
  }

  function init() {
    const palette = createPalette();
    const input = palette.querySelector("input");
    const backdrop = palette.querySelector(".command-palette-backdrop");
    let selectedIndex = 0;
    let filtered = [...commands];

    function open() {
      palette.classList.remove("hidden");
      document.body.style.overflow = "hidden"; // Prevent background scroll
      input.value = "";
      filtered = [...commands];
      selectedIndex = 0;
      renderResults(filtered, selectedIndex);
      setTimeout(() => input.focus(), 50);
    }

    function close() {
      palette.classList.add("hidden");
      document.body.style.overflow = ""; // Restore scroll
    }

    function execute(cmd) {
      close();
      cmd.action();
    }

    // Focus trap for accessibility - keep focus within dialog
    function trapFocus(e) {
      if (palette.classList.contains("hidden")) return;
      if (e.key !== "Tab") return;

      const focusableElements = palette.querySelectorAll(
        "input, button:not([disabled])",
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }

    palette.addEventListener("keydown", trapFocus);

    // Keyboard shortcut Cmd/Ctrl + K
    document.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        palette.classList.contains("hidden") ? open() : close();
      }
      if (e.key === "Escape") close();
    });

    // Search input
    input.addEventListener("input", (e) => {
      const query = e.target.value.toLowerCase();
      filtered = commands.filter((cmd) =>
        cmd.label.toLowerCase().includes(query),
      );
      selectedIndex = 0;
      renderResults(filtered, selectedIndex);
    });

    // Keyboard navigation
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, filtered.length - 1);
        renderResults(filtered, selectedIndex);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        renderResults(filtered, selectedIndex);
      } else if (e.key === "Enter" && filtered[selectedIndex]) {
        execute(filtered[selectedIndex]);
      }
    });

    // Click backdrop to close
    backdrop.addEventListener("click", close);

    // Click command item
    palette.addEventListener("click", (e) => {
      const item = e.target.closest(".command-item");
      if (item) {
        const cmd = commands.find((c) => c.id === item.dataset.id);
        if (cmd) execute(cmd);
      }
    });

    window.CommandPalette = { open, close };
  }

  function navigateTo(page) {
    if (window.Alpine) {
      Alpine.store("app").activeTab = page;
    }
    window.location.hash = "#/" + (page === "dashboard" ? "" : page);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
