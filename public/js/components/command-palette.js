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
    document.body.appendChild(container);
    return container;
  }

  function renderResults(filtered, selectedIndex) {
    const results = document.querySelector(".command-palette-results");
    if (!filtered.length) {
      results.innerHTML = '<div class="no-results">No commands found</div>';
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
  }

  function init() {
    const palette = createPalette();
    const input = palette.querySelector("input");
    const backdrop = palette.querySelector(".command-palette-backdrop");
    let selectedIndex = 0;
    let filtered = [...commands];

    function open() {
      palette.classList.remove("hidden");
      input.value = "";
      filtered = [...commands];
      selectedIndex = 0;
      renderResults(filtered, selectedIndex);
      setTimeout(() => input.focus(), 50);
    }

    function close() {
      palette.classList.add("hidden");
    }

    function execute(cmd) {
      close();
      cmd.action();
    }

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
