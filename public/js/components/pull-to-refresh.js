/**
 * Pull to Refresh Component
 */
export class PullToRefresh {
  constructor(options = {}) {
    this.container =
      options.container || document.querySelector(".app-content");
    this.onRefresh = options.onRefresh || (() => Promise.resolve());
    this.threshold = options.threshold || 80;
    this.maxPull = options.maxPull || 120;

    this.isPulling = false;
    this.isRefreshing = false;
    this.pullDistance = 0;
    this.startY = 0;

    this.indicator = null;
    this.init();
  }

  init() {
    this.createIndicator();
    this.bindEvents();
  }

  createIndicator() {
    this.indicator = document.createElement("div");
    this.indicator.className = "ptr-indicator";
    this.indicator.innerHTML = `
      <div class="ptr-content">
        <div class="ptr-spinner">
          <svg class="ptr-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
        </div>
        <span class="ptr-text">Pull to refresh</span>
      </div>
    `;

    if (this.container) {
      this.container.insertBefore(this.indicator, this.container.firstChild);
    }
  }

  bindEvents() {
    if (!this.container) return;

    this.container.addEventListener("touchstart", (e) => this.onTouchStart(e), {
      passive: true,
    });
    this.container.addEventListener("touchmove", (e) => this.onTouchMove(e), {
      passive: false,
    });
    this.container.addEventListener("touchend", () => this.onTouchEnd());
  }

  onTouchStart(e) {
    if (this.isRefreshing) return;
    if (this.container.scrollTop > 0) return;

    this.startY = e.touches[0].clientY;
    this.isPulling = true;
  }

  onTouchMove(e) {
    if (!this.isPulling || this.isRefreshing) return;

    const currentY = e.touches[0].clientY;
    const diff = currentY - this.startY;

    if (diff > 0 && this.container.scrollTop === 0) {
      e.preventDefault();

      // Apply resistance
      this.pullDistance = Math.min(diff * 0.5, this.maxPull);
      this.updateIndicator();
    }
  }

  onTouchEnd() {
    if (!this.isPulling) return;
    this.isPulling = false;

    if (this.pullDistance >= this.threshold && !this.isRefreshing) {
      this.startRefresh();
    } else {
      this.resetIndicator();
    }
  }

  updateIndicator() {
    const progress = Math.min(this.pullDistance / this.threshold, 1);
    const rotation = progress * 180;

    this.indicator.style.height = `${this.pullDistance}px`;
    this.indicator.style.opacity = progress;

    const icon = this.indicator.querySelector(".ptr-icon");
    if (icon) {
      icon.style.transform = `rotate(${rotation}deg)`;
    }

    const text = this.indicator.querySelector(".ptr-text");
    if (text) {
      text.textContent =
        progress >= 1 ? "Release to refresh" : "Pull to refresh";
    }

    this.indicator.classList.toggle("ptr-ready", progress >= 1);
  }

  async startRefresh() {
    this.isRefreshing = true;
    this.indicator.classList.add("ptr-refreshing");
    this.indicator.style.height = "60px";

    const text = this.indicator.querySelector(".ptr-text");
    if (text) text.textContent = "Refreshing...";

    try {
      await this.onRefresh();
    } catch (error) {
      console.error("Refresh failed:", error);
    } finally {
      this.finishRefresh();
    }
  }

  finishRefresh() {
    this.isRefreshing = false;
    this.indicator.classList.remove("ptr-refreshing");
    this.resetIndicator();
  }

  resetIndicator() {
    this.pullDistance = 0;
    this.indicator.style.height = "0";
    this.indicator.style.opacity = "0";
    this.indicator.classList.remove("ptr-ready");

    const icon = this.indicator.querySelector(".ptr-icon");
    if (icon) icon.style.transform = "";
  }

  destroy() {
    if (this.indicator && this.indicator.parentNode) {
      this.indicator.parentNode.removeChild(this.indicator);
    }
  }
}

/**
 * Initialize pull to refresh
 */
export function initPullToRefresh(onRefresh) {
  // Only on mobile
  if (window.innerWidth >= 768) return null;

  return new PullToRefresh({
    container: document.querySelector(".app-content"),
    onRefresh,
  });
}
