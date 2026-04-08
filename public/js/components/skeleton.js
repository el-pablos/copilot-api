/**
 * Skeleton Loading Components
 * Accessibility: Includes ARIA attributes for screen readers
 */
(function () {
  window.Skeleton = {
    card: function (count = 1) {
      return Array(count)
        .fill(
          `
        <div class="skeleton-card" role="status" aria-label="Loading content">
          <span class="sr-only">Loading...</span>
          <div class="skeleton skeleton-title" aria-hidden="true"></div>
          <div class="skeleton skeleton-value" aria-hidden="true"></div>
          <div class="skeleton skeleton-line" aria-hidden="true"></div>
        </div>
      `,
        )
        .join("");
    },

    table: function (rows = 5) {
      const header = `
        <div class="skeleton-table-header" aria-hidden="true">
          <div class="skeleton"></div>
          <div class="skeleton"></div>
          <div class="skeleton"></div>
          <div class="skeleton"></div>
        </div>
      `;
      const rowsHtml = Array(rows)
        .fill(
          `
        <div class="skeleton-table-row" aria-hidden="true">
          <div class="skeleton"></div>
          <div class="skeleton"></div>
          <div class="skeleton"></div>
          <div class="skeleton"></div>
        </div>
      `,
        )
        .join("");
      return `<div class="skeleton-table" role="status" aria-label="Loading table"><span class="sr-only">Loading table data...</span>${header}${rowsHtml}</div>`;
    },

    list: function (items = 3) {
      return (
        `<div role="status" aria-label="Loading list"><span class="sr-only">Loading list items...</span>` +
        Array(items)
          .fill(
            `
        <div class="skeleton-list-item" aria-hidden="true">
          <div class="skeleton skeleton-avatar"></div>
          <div class="skeleton-list-content">
            <div class="skeleton"></div>
            <div class="skeleton"></div>
          </div>
        </div>
      `,
          )
          .join("") +
        `</div>`
      );
    },

    // Show skeleton in container
    show: function (container, type = "card", options = {}) {
      const el =
        typeof container === "string"
          ? document.querySelector(container)
          : container;
      if (!el) return;

      el.dataset.originalContent = el.innerHTML;
      el.setAttribute("aria-busy", "true");

      switch (type) {
        case "table":
          el.innerHTML = this.table(options.rows || 5);
          break;
        case "list":
          el.innerHTML = this.list(options.items || 3);
          break;
        default:
          el.innerHTML = this.card(options.count || 1);
      }
    },

    // Hide skeleton and restore content
    hide: function (container) {
      const el =
        typeof container === "string"
          ? document.querySelector(container)
          : container;
      if (!el || !el.dataset.originalContent) return;

      el.innerHTML = el.dataset.originalContent;
      el.removeAttribute("aria-busy");
      delete el.dataset.originalContent;
    },
  };
})();
