/**
 * Stats Card Component
 */
(function () {
  function createStatsCard({
    title,
    value,
    subtitle,
    icon,
    trend,
    trendValue,
    color = "purple", // 'purple' | 'cyan' | 'green' | 'yellow' | 'red'
    sparklineData,
  }) {
    const colors = {
      purple: {
        bg: "rgba(168, 85, 247, 0.1)",
        text: "#a855f7",
        border: "rgba(168, 85, 247, 0.2)",
      },
      cyan: {
        bg: "rgba(34, 211, 238, 0.1)",
        text: "#22d3ee",
        border: "rgba(34, 211, 238, 0.2)",
      },
      green: {
        bg: "rgba(34, 197, 94, 0.1)",
        text: "#22c55e",
        border: "rgba(34, 197, 94, 0.2)",
      },
      yellow: {
        bg: "rgba(245, 158, 11, 0.1)",
        text: "#f59e0b",
        border: "rgba(245, 158, 11, 0.2)",
      },
      red: {
        bg: "rgba(239, 68, 68, 0.1)",
        text: "#ef4444",
        border: "rgba(239, 68, 68, 0.2)",
      },
    };

    const colorStyle = colors[color] || colors.purple;

    const trendHtml =
      trend && trendValue !== undefined
        ? `
      <div class="stats-trend ${trend === "up" ? "trend-up" : "trend-down"}" aria-label="${trend === "up" ? "Trending up" : "Trending down"} ${trendValue}%">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          ${
            trend === "up"
              ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18"/>'
              : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"/>'
          }
        </svg>
        <span>${trendValue}%</span>
      </div>
    `
        : "";

    const card = document.createElement("div");
    card.className = "stats-card";
    card.style.setProperty("--card-color", colorStyle.text);
    card.style.setProperty("--card-bg", colorStyle.bg);
    card.style.setProperty("--card-border", colorStyle.border);

    card.innerHTML = `
      <div class="stats-card-header">
        <div class="stats-card-icon" style="background: ${colorStyle.bg}; color: ${colorStyle.text};">
          ${icon || getDefaultIcon()}
        </div>
        ${trendHtml}
      </div>
      <div class="stats-card-body">
        <div class="stats-card-title">${title}</div>
        <div class="stats-card-value">${formatValue(value)}</div>
        ${subtitle ? `<div class="stats-card-subtitle">${subtitle}</div>` : ""}
      </div>
      ${sparklineData ? '<div class="stats-card-sparkline" id="sparkline-container"></div>' : ""}
    `;

    return card;
  }

  function getDefaultIcon() {
    return `<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
    </svg>`;
  }

  function formatValue(value) {
    if (typeof value === "number") {
      if (value >= 1000000) {
        return (value / 1000000).toFixed(1) + "M";
      }
      if (value >= 1000) {
        return (value / 1000).toFixed(1) + "k";
      }
      return value.toLocaleString();
    }
    return value;
  }

  /**
   * Create stats grid
   */
  function createStatsGrid(statsArray) {
    const grid = document.createElement("div");
    grid.className = "stats-grid";

    statsArray.forEach((stat) => {
      grid.appendChild(createStatsCard(stat));
    });

    return grid;
  }

  /**
   * Update stats card value with animation
   */
  function updateStatsCardValue(card, newValue) {
    const valueEl = card.querySelector(".stats-card-value");
    if (!valueEl) return;

    const oldValue = parseInt(valueEl.textContent.replace(/[^0-9]/g, ""));
    const targetValue =
      typeof newValue === "number"
        ? newValue
        : parseInt(newValue.replace(/[^0-9]/g, ""));

    animateValue(valueEl, oldValue, targetValue, 500);
  }

  function animateValue(element, start, end, duration) {
    const range = end - start;
    const startTime = performance.now();

    function update(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + range * easeProgress);
      element.textContent = formatValue(current);

      if (progress < 1) {
        requestAnimationFrame(update);
      }
    }

    requestAnimationFrame(update);
  }

  // Expose to window for global access
  window.createStatsCard = createStatsCard;
  window.createStatsGrid = createStatsGrid;
  window.updateStatsCardValue = updateStatsCardValue;
})();
