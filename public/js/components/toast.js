/**
 * Toast Notification System
 */
(function () {
  const icons = {
    success:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>',
    error:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>',
    warning:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
  };

  let container;

  function ensureContainer() {
    if (!container) {
      container = document.createElement("div");
      container.className = "toast-container";
      container.setAttribute("role", "status");
      container.setAttribute("aria-live", "polite");
      container.setAttribute("aria-label", "Notifications");
      document.body.appendChild(container);
    }
    return container;
  }

  function show(type, title, message, duration = 5000) {
    const c = ensureContainer();

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.setAttribute("role", type === "error" ? "alert" : "status");
    toast.innerHTML = `
      <span class="toast-icon" aria-hidden="true">${icons[type]}</span>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        ${message ? `<div class="toast-message">${message}</div>` : ""}
      </div>
      <button class="toast-close" aria-label="Dismiss notification">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
        </svg>
      </button>
    `;

    const close = () => {
      toast.classList.add("removing");
      setTimeout(() => toast.remove(), 200);
    };

    toast.querySelector(".toast-close").addEventListener("click", close);
    c.appendChild(toast);

    if (duration > 0) {
      setTimeout(close, duration);
    }

    return { close };
  }

  window.Toast = {
    success: (title, message, duration) =>
      show("success", title, message, duration),
    error: (title, message, duration) =>
      show("error", title, message, duration),
    warning: (title, message, duration) =>
      show("warning", title, message, duration),
    info: (title, message, duration) => show("info", title, message, duration),
  };
})();
