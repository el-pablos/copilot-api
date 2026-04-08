/**
 * Skeleton Loading Components
 */
(function () {
  window.Skeleton = {
    card: function (count = 1) {
      return Array(count)
        .fill(
          `
        <div class="skeleton-card">
          <div class="skeleton skeleton-title"></div>
          <div class="skeleton skeleton-value"></div>
          <div class="skeleton skeleton-line"></div>
        </div>
      `,
        )
        .join("");
    },

    table: function (rows = 5) {
      const header = `
        <div class="skeleton-table-header">
          <div class="skeleton"></div>
          <div class="skeleton"></div>
          <div class="skeleton"></div>
          <div class="skeleton"></div>
        </div>
      `;
      const rowsHtml = Array(rows)
        .fill(
          `
        <div class="skeleton-table-row">
          <div class="skeleton"></div>
          <div class="skeleton"></div>
          <div class="skeleton"></div>
          <div class="skeleton"></div>
        </div>
      `,
        )
        .join("");
      return `<div class="skeleton-table">${header}${rowsHtml}</div>`;
    },

    list: function (items = 3) {
      return Array(items)
        .fill(
          `
        <div class="skeleton-list-item">
          <div class="skeleton skeleton-avatar"></div>
          <div class="skeleton-list-content">
            <div class="skeleton"></div>
            <div class="skeleton"></div>
          </div>
        </div>
      `,
        )
        .join("");
    },

    // Show skeleton in container
    show: function (container, type = "card", options = {}) {
      const el =
        typeof container === "string"
          ? document.querySelector(container)
          : container;
      if (!el) return;

      el.dataset.originalContent = el.innerHTML;

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
      delete el.dataset.originalContent;
    },
  };
})();
