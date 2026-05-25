/* ============================================================
   UI.JS — Reusable UI Helper Functions
   FUTO Data Collection Platform
   ============================================================
   RULES:
   - This file only manipulates the DOM and UI state
   - Never calls fetch() directly — use api.js for that
   - Never writes to AppState directly — use state.js for that
   - Every page script imports and uses these functions
   - All functions are globally available (no module syntax)

   TABLE OF CONTENTS:
   01. Modal System
   02. Toast Notification System
   03. Loader / Spinner System
   04. Progress Bar Helpers
   05. Form Helpers
   06. DOM Utilities
   07. Sidebar Toggle
   08. Page Initialiser
   ============================================================ */


/* ════════════════════════════════════════
   01. MODAL SYSTEM
   Controls the .modal-backdrop + .modal
   elements defined in components.css

   Usage:
     UI.modal.open("upload-modal")
     UI.modal.close("upload-modal")
     UI.modal.closeAll()
════════════════════════════════════════ */

const UI = {

  modal: {

    /**
     * Open a modal by its backdrop ID.
     * Locks body scroll while modal is open.
     *
     * @param {string} backdropId - ID of the .modal-backdrop element
     */
    open(backdropId) {
      const backdrop = document.getElementById(backdropId);
      if (!backdrop) {
        console.warn(`[UI.modal.open] No element found with id="${backdropId}"`);
        return;
      }
      backdrop.classList.add("active");
      document.body.style.overflow = "hidden";

      // Track in AppState if available
      if (typeof setActiveModal === "function") {
        setActiveModal(backdropId);
      }

      // Focus first focusable element inside modal (accessibility)
      const focusable = backdrop.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable) {
        setTimeout(() => focusable.focus(), 50);
      }

      // Close on backdrop click (outside modal box)
      backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) {
          UI.modal.close(backdropId);
        }
      }, { once: true });

      // Close on Escape key
      const escHandler = (e) => {
        if (e.key === "Escape") {
          UI.modal.close(backdropId);
          document.removeEventListener("keydown", escHandler);
        }
      };
      document.addEventListener("keydown", escHandler);
    },

    /**
     * Close a modal by its backdrop ID.
     * Restores body scroll.
     *
     * @param {string} backdropId
     */
    close(backdropId) {
      const backdrop = document.getElementById(backdropId);
      if (!backdrop) return;
      backdrop.classList.remove("active");

      // Only restore scroll if no other modals are open
      const anyOpen = document.querySelector(".modal-backdrop.active");
      if (!anyOpen) {
        document.body.style.overflow = "";
      }

      if (typeof setActiveModal === "function") {
        setActiveModal(null);
      }
    },

    /**
     * Close all open modals at once.
     */
    closeAll() {
      document.querySelectorAll(".modal-backdrop.active").forEach((el) => {
        el.classList.remove("active");
      });
      document.body.style.overflow = "";
      if (typeof setActiveModal === "function") {
        setActiveModal(null);
      }
    },

    /**
     * Check if a specific modal is currently open.
     *
     * @param {string} backdropId
     * @returns {boolean}
     */
    isOpen(backdropId) {
      const backdrop = document.getElementById(backdropId);
      return backdrop ? backdrop.classList.contains("active") : false;
    },

  },


  /* ════════════════════════════════════════
     02. TOAST NOTIFICATION SYSTEM
     Injects toasts into .toast-container.
     Auto-dismisses after duration.
     Creates the container if it doesn't exist.

     Usage:
       UI.toast.show("Upload successful!", "success")
       UI.toast.show("Something went wrong.", "error")
       UI.toast.show("Duplicate page detected.", "warning")
       UI.toast.show("Processing your image...", "info")
  ════════════════════════════════════════ */

  toast: {

    /**
     * Show a toast notification.
     *
     * @param {string} message       - Text to display
     * @param {"success"|"error"|"warning"|"info"} type
     * @param {number} duration      - Auto-dismiss time in ms (default 3500)
     */
    show(message, type = "info", duration = 3500) {
      // Ensure container exists
      let container = document.querySelector(".toast-container");
      if (!container) {
        container = document.createElement("div");
        container.className = "toast-container";
        document.body.appendChild(container);
      }

      // Icon map
      const icons = {
        success: "✅",
        error:   "❌",
        warning: "⚠️",
        info:    "ℹ️",
      };

      const toast = document.createElement("div");
      toast.className = `toast ${type}`;
      toast.innerHTML = `
        <span class="toast-icon">${icons[type] || icons.info}</span>
        <span class="toast-message">${message}</span>
      `;

      container.appendChild(toast);

      // Trigger slide-in animation
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          toast.classList.add("show");
        });
      });

      // Auto dismiss
      const dismiss = () => {
        toast.classList.remove("show");
        toast.addEventListener("transitionend", () => toast.remove(), { once: true });
      };

      const timer = setTimeout(dismiss, duration);

      // Click to dismiss early
      toast.addEventListener("click", () => {
        clearTimeout(timer);
        dismiss();
      });
    },

    /** Shorthand helpers */
    success(message, duration)  { UI.toast.show(message, "success", duration); },
    error(message, duration)    { UI.toast.show(message, "error",   duration); },
    warning(message, duration)  { UI.toast.show(message, "warning", duration); },
    info(message, duration)     { UI.toast.show(message, "info",    duration); },

  },


  /* ════════════════════════════════════════
     03. LOADER / SPINNER SYSTEM
     Controls the .loader-overlay element.
     Creates it if it doesn't exist on the page.

     Usage:
       UI.loader.show("Processing your image...")
       UI.loader.updateText("Checking brightness...")
       UI.loader.hide()
  ════════════════════════════════════════ */

  loader: {

    _overlay: null,
    _textEl:  null,

    /**
     * Get or create the loader overlay element.
     * @returns {HTMLElement}
     */
    _getOverlay() {
      if (this._overlay && document.body.contains(this._overlay)) {
        return this._overlay;
      }

      let overlay = document.querySelector(".loader-overlay");
      if (!overlay) {
        overlay = document.createElement("div");
        overlay.className = "loader-overlay";
        overlay.innerHTML = `
          <div class="loader-ring"></div>
          <p class="loader-text">Please wait...</p>
        `;
        document.body.appendChild(overlay);
      }

      this._overlay = overlay;
      this._textEl  = overlay.querySelector(".loader-text");
      return overlay;
    },

    /**
     * Show the full-screen loading overlay.
     *
     * @param {string} message - Optional message to display
     */
    show(message = "Please wait...") {
      const overlay = this._getOverlay();
      if (this._textEl) this._textEl.textContent = message;
      overlay.classList.add("active");
      document.body.style.overflow = "hidden";
    },

    /**
     * Update the loader message text without hiding/showing.
     *
     * @param {string} message
     */
    updateText(message) {
      const overlay = this._getOverlay();
      if (this._textEl) this._textEl.textContent = message;
    },

    /**
     * Cycle through multiple messages with a delay between each.
     * Useful for the OCR processing steps.
     *
     * @param {string[]} messages    - Array of messages to cycle through
     * @param {number}   interval    - Time between messages in ms
     * @returns {number} intervalId  - Pass to UI.loader.stopCycle() if needed
     */
    cycleText(messages, interval = 900) {
      let index = 0;
      this.updateText(messages[0]);

      const id = setInterval(() => {
        index++;
        if (index < messages.length) {
          this.updateText(messages[index]);
        } else {
          clearInterval(id);
        }
      }, interval);

      return id;
    },

    /**
     * Hide the loading overlay and restore scroll.
     */
    hide() {
      const overlay = this._getOverlay();
      overlay.classList.remove("active");
      const anyModalOpen = document.querySelector(".modal-backdrop.active");
      if (!anyModalOpen) {
        document.body.style.overflow = "";
      }
    },

  },


  /* ════════════════════════════════════════
     04. PROGRESS BAR HELPERS
     Works with .progress-track / .progress-fill
     elements from components.css

     Usage:
       UI.progress.set("calculus-bar", 78)
       UI.progress.animate("calculus-bar", 0, 78)
  ════════════════════════════════════════ */

  progress: {

    /**
     * Instantly set a progress bar's fill width and value label.
     *
     * @param {string} fillId     - ID of the .progress-fill element
     * @param {number} percent    - 0–100
     * @param {string} [labelId] - Optional ID of the .progress-value label
     */
    set(fillId, percent, labelId = null) {
      const fill = document.getElementById(fillId);
      if (!fill) return;

      const clamped = Math.min(100, Math.max(0, percent));
      fill.style.width = `${clamped}%`;

      // Apply colour variant based on value
      fill.classList.remove("danger", "warning", "info");
      if (clamped < 25)      fill.classList.add("info");
      else if (clamped < 50) fill.classList.add("warning");
      // default (green) for 50%+

      if (labelId) {
        const label = document.getElementById(labelId);
        if (label) label.textContent = `${Math.round(clamped)}%`;
      }
    },

    /**
     * Animate a progress bar from one value to another.
     *
     * @param {string} fillId    - ID of the .progress-fill element
     * @param {number} from      - Start percentage (0–100)
     * @param {number} to        - End percentage (0–100)
     * @param {string} [labelId] - Optional ID of the label element
     * @param {number} [duration]- Animation duration in ms (default 800)
     */
    animate(fillId, from, to, labelId = null, duration = 800) {
      const fill = document.getElementById(fillId);
      if (!fill) return;

      const start     = performance.now();
      const fromVal   = Math.min(100, Math.max(0, from));
      const toVal     = Math.min(100, Math.max(0, to));

      const step = (now) => {
        const elapsed  = now - start;
        const progress = Math.min(elapsed / duration, 1);
        // Ease out cubic
        const eased    = 1 - Math.pow(1 - progress, 3);
        const current  = fromVal + (toVal - fromVal) * eased;

        fill.style.width = `${current}%`;

        if (labelId) {
          const label = document.getElementById(labelId);
          if (label) label.textContent = `${Math.round(current)}%`;
        }

        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          // Apply final colour variant
          fill.classList.remove("danger", "warning", "info");
          if (toVal < 25)      fill.classList.add("info");
          else if (toVal < 50) fill.classList.add("warning");
        }
      };

      requestAnimationFrame(step);
    },

  },


  /* ════════════════════════════════════════
     05. FORM HELPERS
     Validates, marks errors, resets forms.

     Usage:
       UI.form.setError("email-input", "Invalid email address")
       UI.form.clearError("email-input")
       UI.form.setLoading(submitBtn, true)
       UI.form.getData("login-form")
  ════════════════════════════════════════ */

  form: {

    /**
     * Mark an input as having an error and show a hint message.
     *
     * @param {string} inputId   - ID of the input element
     * @param {string} message   - Error message to display
     */
    setError(inputId, message) {
      const input = document.getElementById(inputId);
      if (!input) return;

      const wrap = input.closest(".input-wrap");
      if (wrap) {
        wrap.classList.add("has-error");
        wrap.classList.remove("has-success");

        // Find or create hint element
        let hint = wrap.querySelector(".input-hint.error");
        if (!hint) {
          hint = document.createElement("span");
          hint.className = "input-hint error";
          wrap.appendChild(hint);
        }
        hint.textContent = message;
      }
    },

    /**
     * Remove error state from an input.
     *
     * @param {string} inputId
     */
    clearError(inputId) {
      const input = document.getElementById(inputId);
      if (!input) return;

      const wrap = input.closest(".input-wrap");
      if (wrap) {
        wrap.classList.remove("has-error");
        const hint = wrap.querySelector(".input-hint.error");
        if (hint) hint.remove();
      }
    },

    /**
     * Mark an input as valid/success.
     *
     * @param {string} inputId
     */
    setSuccess(inputId) {
      const input = document.getElementById(inputId);
      if (!input) return;

      const wrap = input.closest(".input-wrap");
      if (wrap) {
        wrap.classList.remove("has-error");
        wrap.classList.add("has-success");
        const hint = wrap.querySelector(".input-hint.error");
        if (hint) hint.remove();
      }
    },

    /**
     * Clear all error/success states in a form.
     *
     * @param {string} formId - ID of the form or container element
     */
    clearAll(formId) {
      const form = document.getElementById(formId);
      if (!form) return;

      form.querySelectorAll(".input-wrap").forEach((wrap) => {
        wrap.classList.remove("has-error", "has-success");
        const hint = wrap.querySelector(".input-hint.error");
        if (hint) hint.remove();
      });
    },

    /**
     * Put a button into loading state (disabled + spinner).
     *
     * @param {HTMLElement|string} btn     - Button element or its ID
     * @param {boolean}            loading - true = loading, false = restore
     * @param {string}             [originalText] - Text to restore when done
     */
    setLoading(btn, loading, originalText = null) {
      const el = typeof btn === "string" ? document.getElementById(btn) : btn;
      if (!el) return;

      if (loading) {
        el.dataset.originalText = el.innerHTML;
        el.innerHTML = `<span class="spinner"></span>`;
        el.disabled  = true;
      } else {
        el.innerHTML = originalText || el.dataset.originalText || "Submit";
        el.disabled  = false;
        delete el.dataset.originalText;
      }
    },

    /**
     * Get all named input values from a form as a plain object.
     *
     * @param {string} formId
     * @returns {object} - { fieldName: value, ... }
     */
    getData(formId) {
      const form = document.getElementById(formId);
      if (!form) return {};

      const data = {};
      form.querySelectorAll("input[name], textarea[name], select[name]").forEach((el) => {
        if (el.type === "checkbox") {
          data[el.name] = el.checked;
        } else if (el.type === "radio") {
          if (el.checked) data[el.name] = el.value;
        } else {
          data[el.name] = el.value.trim();
        }
      });

      return data;
    },

    /**
     * Validate an email address format.
     * @param {string} email
     * @returns {boolean}
     */
    isValidEmail(email) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    },

    /**
     * Validate a Nigerian phone number.
     * Accepts: 080xxxxxxxx, 070xxxxxxxx, +2348xxxxxxxx, etc.
     * @param {string} phone
     * @returns {boolean}
     */
    isValidPhone(phone) {
      return /^(\+?234|0)[789][01]\d{8}$/.test(phone.replace(/\s/g, ""));
    },

    /**
     * Validate a password meets minimum requirements.
     * Min 8 chars, at least one number.
     * @param {string} password
     * @returns {{ valid: boolean, message: string }}
     */
    validatePassword(password) {
      if (!password || password.length < 8) {
        return { valid: false, message: "Password must be at least 8 characters." };
      }
      if (!/\d/.test(password)) {
        return { valid: false, message: "Password must contain at least one number." };
      }
      return { valid: true, message: "" };
    },

  },


  /* ════════════════════════════════════════
     06. DOM UTILITIES
     Small helpers used throughout all pages.

     Usage:
       UI.dom.show("my-element")
       UI.dom.hide("my-element")
       UI.dom.setText("balance-display", "₦1,200")
       UI.dom.on("upload-btn", "click", handler)
  ════════════════════════════════════════ */

  dom: {

    /**
     * Show an element (removes "hidden" class).
     * @param {string|HTMLElement} el
     */
    show(el) {
      const node = typeof el === "string" ? document.getElementById(el) : el;
      if (node) node.classList.remove("hidden");
    },

    /**
     * Hide an element (adds "hidden" class).
     * @param {string|HTMLElement} el
     */
    hide(el) {
      const node = typeof el === "string" ? document.getElementById(el) : el;
      if (node) node.classList.add("hidden");
    },

    /**
     * Toggle visibility of an element.
     * @param {string|HTMLElement} el
     */
    toggle(el) {
      const node = typeof el === "string" ? document.getElementById(el) : el;
      if (node) node.classList.toggle("hidden");
    },

    /**
     * Set the text content of an element safely.
     * @param {string|HTMLElement} el
     * @param {string} text
     */
    setText(el, text) {
      const node = typeof el === "string" ? document.getElementById(el) : el;
      if (node) node.textContent = text;
    },

    /**
     * Set the inner HTML of an element.
     * Only use when you control the HTML (not user input).
     * @param {string|HTMLElement} el
     * @param {string} html
     */
    setHTML(el, html) {
      const node = typeof el === "string" ? document.getElementById(el) : el;
      if (node) node.innerHTML = html;
    },

    /**
     * Add a class to an element.
     * @param {string|HTMLElement} el
     * @param {string} className
     */
    addClass(el, className) {
      const node = typeof el === "string" ? document.getElementById(el) : el;
      if (node) node.classList.add(className);
    },

    /**
     * Remove a class from an element.
     * @param {string|HTMLElement} el
     * @param {string} className
     */
    removeClass(el, className) {
      const node = typeof el === "string" ? document.getElementById(el) : el;
      if (node) node.classList.remove(className);
    },

    /**
     * Attach an event listener with optional auto-removal.
     * @param {string|HTMLElement} el
     * @param {string} event
     * @param {Function} handler
     * @param {boolean} [once=false]
     */
    on(el, event, handler, once = false) {
      const node = typeof el === "string" ? document.getElementById(el) : el;
      if (node) node.addEventListener(event, handler, { once });
    },

    /**
     * Create an HTML element with optional class and text.
     * @param {string} tag
     * @param {string} [className]
     * @param {string} [text]
     * @returns {HTMLElement}
     */
    create(tag, className = "", text = "") {
      const el = document.createElement(tag);
      if (className) el.className = className;
      if (text) el.textContent = text;
      return el;
    },

    /**
     * Empty all children from an element.
     * @param {string|HTMLElement} el
     */
    empty(el) {
      const node = typeof el === "string" ? document.getElementById(el) : el;
      if (node) node.innerHTML = "";
    },

    /**
     * Scroll an element into view smoothly.
     * @param {string|HTMLElement} el
     */
    scrollTo(el) {
      const node = typeof el === "string" ? document.getElementById(el) : el;
      if (node) node.scrollIntoView({ behavior: "smooth", block: "start" });
    },

  },


  /* ════════════════════════════════════════
     07. SIDEBAR TOGGLE
     Controls open/close of the glassmorphic
     sidebar on mobile and tablet.

     Usage:
       UI.sidebar.init()   ← call once on page load
       UI.sidebar.open()
       UI.sidebar.close()
  ════════════════════════════════════════ */

  sidebar: {

    /**
     * Initialise sidebar toggle behaviour.
     * Wires up hamburger button and overlay click.
     * Call once at the bottom of any page that has a sidebar.
     */
    init() {
      const hamburger = document.querySelector(".hamburger");
      const sidebar   = document.querySelector(".sidebar");
      const overlay   = document.querySelector(".sidebar-overlay");

      if (!sidebar) return;

      if (hamburger) {
        hamburger.addEventListener("click", () => {
          UI.sidebar.toggle();
        });
      }

      if (overlay) {
        overlay.addEventListener("click", () => {
          UI.sidebar.close();
        });
      }

      // Close sidebar on nav link click (mobile UX)
      sidebar.querySelectorAll(".sidebar-link").forEach((link) => {
        link.addEventListener("click", () => {
          if (window.innerWidth <= 1024) {
            UI.sidebar.close();
          }
        });
      });
    },

    open() {
      const sidebar = document.querySelector(".sidebar");
      const overlay = document.querySelector(".sidebar-overlay");
      const hamburger = document.querySelector(".hamburger");

      if (sidebar)   sidebar.classList.add("open");
      if (overlay)   overlay.classList.add("active");
      if (hamburger) hamburger.classList.add("open");

      if (typeof toggleSidebar === "function") toggleSidebar();
    },

    close() {
      const sidebar   = document.querySelector(".sidebar");
      const overlay   = document.querySelector(".sidebar-overlay");
      const hamburger = document.querySelector(".hamburger");

      if (sidebar)   sidebar.classList.remove("open");
      if (overlay)   overlay.classList.remove("active");
      if (hamburger) hamburger.classList.remove("open");
    },

    toggle() {
      const sidebar = document.querySelector(".sidebar");
      if (!sidebar) return;
      const isOpen = sidebar.classList.contains("open");
      isOpen ? UI.sidebar.close() : UI.sidebar.open();
    },

  },


  /* ════════════════════════════════════════
     08. PAGE INITIALISER
     Runs shared setup on every page load.
     Call UI.page.init() at the top of
     every page's JS file.

     Usage:
       UI.page.init()
       UI.page.init({ requireAuth: false }) ← for index.html
  ════════════════════════════════════════ */

  page: {

    /**
     * Standard page initialiser.
     * - Hydrates state from localStorage (fast header render)
     * - Checks auth (redirects to login if no token)
     * - Adds .bg-blob-2 to body if not present
     * - Applies .page-enter animation to main content
     * - Sets active nav link based on current URL
     *
     * @param {object} [options]
     * @param {boolean} [options.requireAuth=true] - Set false for login page
     */
    init({ requireAuth = true } = {}) {

      // Hydrate name/tier from localStorage immediately
      if (typeof hydrateFromStorage === "function") {
        hydrateFromStorage();
      }

      // Auth guard
      if (requireAuth && typeof apiIsLoggedIn === "function") {
        if (!apiIsLoggedIn()) {
          window.location.href =
            typeof routeTo === "function" ? routeTo("login") : "index.html";
          return;
        }
      }

      // If on auth page and already logged in, go to dashboard
      if (!requireAuth && typeof apiIsLoggedIn === "function") {
        if (apiIsLoggedIn()) {
          window.location.href =
            typeof routeTo === "function" ? routeTo("dashboard") : "dashboard.html";
          return;
        }
      }

      // Add second background blob if not present
      if (!document.querySelector(".bg-blob-2")) {
        const blob = document.createElement("div");
        blob.className = "bg-blob-2";
        document.body.appendChild(blob);
      }

      // Animate main content entrance
      const main = document.querySelector(".main, .auth-page");
      if (main) {
        main.classList.add("page-enter");
      }

      // Highlight active nav/sidebar link
      UI.page._setActiveNav();

      // Pre-fill header username if element exists
      UI.page._fillHeaderUser();
    },

    /**
     * Mark the current page's nav link as active.
     * Matches href against current pathname.
     * @private
     */
    _setActiveNav() {
      const currentPath = window.location.pathname;

      document.querySelectorAll(".nav-link, .sidebar-link").forEach((link) => {
        const href = link.getAttribute("href");
        if (href && currentPath.includes(href.replace("..", "").replace("/", ""))) {
          link.classList.add("active");
        }
      });
    },

    /**
     * Fill the header avatar and username with stored values.
     * Gives a fast render before the API responds.
     * @private
     */
    _fillHeaderUser() {
      const nameEl = document.querySelector(".header-username");
      const initEl = document.querySelector(".header-avatar");

      if (typeof AppState !== "undefined") {
        if (nameEl && AppState.user.name) {
          nameEl.textContent = AppState.user.name;
        }
        if (initEl && typeof getUserInitials === "function") {
          initEl.textContent = getUserInitials();
        }
      }
    },

  },

};
