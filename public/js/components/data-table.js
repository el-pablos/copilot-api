/**
 * Responsive Data Table Component
 * Features: sorting, pagination, mobile card view, empty state
 */
(function () {
  "use strict";

  window.DataTable = {
    /**
     * Create a new data table instance
     * @param {string} containerId - Container element ID
     * @param {Object} options - Table configuration
     * @returns {Object|null} Table instance with control methods
     */
    create: function (containerId, options = {}) {
      const container = document.getElementById(containerId);
      if (!container) {
        console.warn(`DataTable: Container #${containerId} not found`);
        return null;
      }

      const config = {
        columns: options.columns || [],
        data: options.data || [],
        cardViewOnMobile: options.cardViewOnMobile !== false,
        sortable: options.sortable !== false,
        pagination: options.pagination || { enabled: false },
        emptyMessage: options.emptyMessage || "No data available",
        onRowClick: options.onRowClick || null,
        ...options,
      };

      let currentSort = { column: null, direction: "asc" };
      let currentPage = 1;
      const perPage = config.pagination.perPage || 10;

      /**
       * Sort data based on current sort state
       */
      function sortData(data) {
        if (!currentSort.column) return data;

        return data.sort((a, b) => {
          const aVal = a[currentSort.column];
          const bVal = b[currentSort.column];

          // Handle null/undefined
          if (aVal == null && bVal == null) return 0;
          if (aVal == null) return 1;
          if (bVal == null) return -1;

          // Handle different types
          let cmp;
          if (typeof aVal === "number" && typeof bVal === "number") {
            cmp = aVal - bVal;
          } else if (aVal instanceof Date && bVal instanceof Date) {
            cmp = aVal.getTime() - bVal.getTime();
          } else {
            cmp = String(aVal).localeCompare(String(bVal));
          }

          return currentSort.direction === "asc" ? cmp : -cmp;
        });
      }

      /**
       * Render pagination controls
       */
      function renderPagination(total) {
        const totalPages = Math.ceil(total / perPage);
        if (totalPages <= 1) return "";

        // Calculate visible page range
        let startPage = Math.max(1, currentPage - 2);
        let endPage = Math.min(totalPages, startPage + 4);
        if (endPage - startPage < 4) {
          startPage = Math.max(1, endPage - 4);
        }

        const pages = [];
        for (let i = startPage; i <= endPage; i++) {
          pages.push(i);
        }

        const start = (currentPage - 1) * perPage + 1;
        const end = Math.min(currentPage * perPage, total);

        return `
          <div class="table-pagination">
            <span class="pagination-info">
              Showing ${start}-${end} of ${total}
            </span>
            <div class="pagination-buttons">
              <button class="pagination-btn" data-page="first" ${currentPage === 1 ? "disabled" : ""} aria-label="First page">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="11 17 6 12 11 7"></polyline>
                  <polyline points="18 17 13 12 18 7"></polyline>
                </svg>
              </button>
              <button class="pagination-btn" data-page="prev" ${currentPage === 1 ? "disabled" : ""} aria-label="Previous page">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
              </button>
              ${pages
                .map(
                  (page) => `
                <button class="pagination-btn ${page === currentPage ? "active" : ""}" data-page="${page}" aria-label="Page ${page}" ${page === currentPage ? 'aria-current="page"' : ""}>
                  ${page}
                </button>
              `,
                )
                .join("")}
              <button class="pagination-btn" data-page="next" ${currentPage === totalPages ? "disabled" : ""} aria-label="Next page">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </button>
              <button class="pagination-btn" data-page="last" ${currentPage === totalPages ? "disabled" : ""} aria-label="Last page">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="6 17 11 12 6 7"></polyline>
                  <polyline points="13 17 18 12 13 7"></polyline>
                </svg>
              </button>
            </div>
          </div>
        `;
      }

      /**
       * Render empty state
       */
      function renderEmptyState() {
        return `
          <div class="data-table-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
            </svg>
            <p>${config.emptyMessage}</p>
          </div>
        `;
      }

      /**
       * Main render function
       */
      function render() {
        const sorted = sortData([...config.data]);
        const totalItems = sorted.length;

        // Handle empty state
        if (totalItems === 0) {
          container.innerHTML = `
            <div class="data-table-container">
              ${renderEmptyState()}
            </div>
          `;
          return;
        }

        // Paginate data
        const paginated = config.pagination.enabled
          ? sorted.slice((currentPage - 1) * perPage, currentPage * perPage)
          : sorted;

        container.innerHTML = `
          <div class="data-table-container ${config.cardViewOnMobile ? "card-view" : ""}">
            <table class="data-table" role="grid">
              <thead>
                <tr>
                  ${config.columns
                    .map(
                      (col) => `
                    <th
                      class="${config.sortable && col.sortable !== false ? "sortable" : ""} ${currentSort.column === col.key ? currentSort.direction : ""}"
                      data-key="${col.key}"
                      ${config.sortable && col.sortable !== false ? 'tabindex="0" role="columnheader" aria-sort="' + (currentSort.column === col.key ? (currentSort.direction === "asc" ? "ascending" : "descending") : "none") + '"' : ""}
                    >
                      ${col.label}
                    </th>
                  `,
                    )
                    .join("")}
                </tr>
              </thead>
              <tbody>
                ${paginated
                  .map(
                    (row, index) => `
                  <tr
                    ${config.onRowClick ? 'tabindex="0" role="row" style="cursor: pointer;"' : ""}
                    data-row-index="${index}"
                  >
                    ${config.columns
                      .map(
                        (col) => `
                      <td data-label="${col.label}" ${col.truncate ? 'class="truncate"' : ""}>
                        ${col.render ? col.render(row[col.key], row) : escapeHtml(row[col.key] ?? "-")}
                      </td>
                    `,
                      )
                      .join("")}
                  </tr>
                `,
                  )
                  .join("")}
              </tbody>
            </table>
            ${config.pagination.enabled ? renderPagination(totalItems) : ""}
          </div>
        `;

        attachEvents(paginated);
      }

      /**
       * Escape HTML to prevent XSS
       */
      function escapeHtml(text) {
        if (text == null) return "";
        const div = document.createElement("div");
        div.textContent = String(text);
        return div.innerHTML;
      }

      /**
       * Attach event listeners
       */
      function attachEvents(currentData) {
        // Sort click handlers
        container.querySelectorAll("th.sortable").forEach((th) => {
          const handleSort = () => {
            const key = th.dataset.key;
            if (currentSort.column === key) {
              currentSort.direction =
                currentSort.direction === "asc" ? "desc" : "asc";
            } else {
              currentSort = { column: key, direction: "asc" };
            }
            currentPage = 1; // Reset to first page on sort
            render();
          };

          th.addEventListener("click", handleSort);
          th.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleSort();
            }
          });
        });

        // Pagination click handlers
        container.querySelectorAll(".pagination-btn").forEach((btn) => {
          btn.addEventListener("click", () => {
            const page = btn.dataset.page;
            const totalPages = Math.ceil(config.data.length / perPage);

            switch (page) {
              case "first":
                currentPage = 1;
                break;
              case "prev":
                currentPage = Math.max(1, currentPage - 1);
                break;
              case "next":
                currentPage = Math.min(totalPages, currentPage + 1);
                break;
              case "last":
                currentPage = totalPages;
                break;
              default:
                currentPage = parseInt(page, 10);
            }
            render();
          });
        });

        // Row click handlers
        if (config.onRowClick) {
          container.querySelectorAll("tbody tr").forEach((tr) => {
            const handleRowClick = () => {
              const index = parseInt(tr.dataset.rowIndex, 10);
              config.onRowClick(currentData[index], index);
            };

            tr.addEventListener("click", handleRowClick);
            tr.addEventListener("keydown", (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleRowClick();
              }
            });
          });
        }
      }

      // Initial render
      render();

      // Return public API
      return {
        /**
         * Update table data
         * @param {Array} data - New data array
         */
        setData: function (data) {
          config.data = data;
          currentPage = 1;
          render();
        },

        /**
         * Get current data
         * @returns {Array} Current data
         */
        getData: function () {
          return config.data;
        },

        /**
         * Refresh table render
         */
        refresh: render,

        /**
         * Go to specific page
         * @param {number} page - Page number
         */
        goToPage: function (page) {
          const totalPages = Math.ceil(config.data.length / perPage);
          currentPage = Math.max(1, Math.min(totalPages, page));
          render();
        },

        /**
         * Set sort state
         * @param {string} column - Column key
         * @param {string} direction - 'asc' or 'desc'
         */
        setSort: function (column, direction = "asc") {
          currentSort = { column, direction };
          render();
        },

        /**
         * Get current sort state
         * @returns {Object} Sort state
         */
        getSort: function () {
          return { ...currentSort };
        },

        /**
         * Destroy table and clean up
         */
        destroy: function () {
          container.innerHTML = "";
        },
      };
    },

    /**
     * Helper to create status badge HTML
     * @param {string} status - Status type (success, error, warning, info)
     * @param {string} text - Badge text
     * @returns {string} HTML string
     */
    statusBadge: function (status, text) {
      return `<span class="status-badge ${status}">${text}</span>`;
    },
  };
})();
