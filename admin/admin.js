/* ============================================================================
   PCMC Washing Centre - ERP Admin Portal Shared Controller
   Handles layout interactions, toast notifications, confirmation dialogs, formatting
   ============================================================================ */

const PCMC_UI = {
  init() {
    this.setupSidebar();
    this.setupAuthUI();
    this.setupStatusIndicator();
    this.renderToastContainer();
    this.setupTableScrollHints();
    if (window.lucide) {
      window.lucide.createIcons();
    }
  },

  // Setup mobile sidebar toggle, overlay, gestures & close button
  setupSidebar() {
    const toggleBtn = document.getElementById('sidebar-toggle');
    const sidebar = document.querySelector('.admin-sidebar');
    const sidebarHeader = document.querySelector('.sidebar-header');

    // Dynamically inject close button in sidebar header if missing
    let closeBtn = document.getElementById('sidebar-close');
    if (!closeBtn && sidebarHeader) {
      closeBtn = document.createElement('button');
      closeBtn.id = 'sidebar-close';
      closeBtn.className = 'btn-sidebar-close';
      closeBtn.setAttribute('aria-label', 'Close Navigation');
      closeBtn.innerHTML = '<i data-lucide="x" style="width: 18px; height: 18px;"></i>';
      sidebarHeader.appendChild(closeBtn);
    }
    
    // Create overlay for mobile drawer
    let overlay = document.getElementById('sidebar-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'sidebar-overlay';
      overlay.style.cssText = `
        position: fixed; inset: 0; background: rgba(0,0,0,0.7);
        z-index: 990; display: none; backdrop-filter: blur(3px);
      `;
      document.body.appendChild(overlay);
    }

    const openSidebar = () => {
      if (sidebar) sidebar.classList.add('open');
      overlay.style.display = 'block';
      document.body.style.overflow = 'hidden';
    };

    const closeSidebar = () => {
      if (sidebar) sidebar.classList.remove('open');
      overlay.style.display = 'none';
      document.body.style.overflow = '';
    };

    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        if (sidebar && sidebar.classList.contains('open')) {
          closeSidebar();
        } else {
          openSidebar();
        }
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', closeSidebar);
    }

    overlay.addEventListener('click', closeSidebar);

    // Escape key listener for sidebar & active modals
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (sidebar && sidebar.classList.contains('open')) {
          closeSidebar();
        }
        const activeModal = document.querySelector('.modal-backdrop.active');
        if (activeModal) {
          activeModal.classList.remove('active');
        }
      }
    });

    // Touch swipe left on sidebar to dismiss drawer
    let touchStartX = 0;
    if (sidebar) {
      sidebar.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
      }, { passive: true });

      sidebar.addEventListener('touchend', (e) => {
        const touchEndX = e.changedTouches[0].clientX;
        if (touchStartX - touchEndX > 50) {
          closeSidebar();
        }
      }, { passive: true });
    }

    // Highlight current page link and auto-close on mobile
    const currentPath = window.location.pathname.split('/').pop() || 'dashboard.html';
    document.querySelectorAll('.sidebar-link').forEach(link => {
      const href = link.getAttribute('href');
      if (href && (href === currentPath || href.endsWith(currentPath))) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
      link.addEventListener('click', () => {
        if (window.innerWidth <= 1024) closeSidebar();
      });
    });
  },

  // Setup mobile scroll hints on wide tables
  setupTableScrollHints() {
    document.querySelectorAll('.table-responsive, .excel-grid-container').forEach(container => {
      if (!container.previousElementSibling || !container.previousElementSibling.classList.contains('table-scroll-hint')) {
        const hint = document.createElement('div');
        hint.className = 'table-scroll-hint';
        hint.innerHTML = `
          <span><i data-lucide="arrow-left-right" style="width: 12px; height: 12px; display: inline-block; vertical-align: middle; margin-right: 4px;"></i> Swipe horizontally to view all columns</span>
          <span style="font-size: 0.68rem; opacity: 0.7;">&larr; Scroll &rarr;</span>
        `;
        container.parentNode.insertBefore(hint, container);
      }
    });
  },

  setupAuthUI() {
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        PCMC_UI.confirm({
          title: 'Sign Out Confirmation',
          message: 'Are you sure you want to sign out of the PCMC Washing Centre ERP portal?',
          confirmText: 'Sign Out',
          confirmBtnClass: 'btn-danger',
          onConfirm: () => {
            if (window.PCMC_AUTH) {
              window.PCMC_AUTH.logout();
            } else {
              window.location.href = 'login.html';
            }
          }
        });
      });
    }
  },

  setupStatusIndicator() {
    const container = document.getElementById('topbar-status-badge');
    if (!container) return;

    // Live Supabase green tag removed per user request
    container.innerHTML = '';
    container.style.display = 'none';
  },

  // Toast Notification System
  renderToastContainer() {
    if (!document.getElementById('toast-container')) {
      const container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }
  },

  toast(message, type = 'info', duration = 3500) {
    this.renderToastContainer();
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let iconName = 'info';
    if (type === 'success') iconName = 'check-circle';
    if (type === 'error') iconName = 'alert-circle';
    if (type === 'warning') iconName = 'alert-triangle';

    toast.innerHTML = `
      <i data-lucide="${iconName}" style="width: 18px; height: 18px; flex-shrink: 0;"></i>
      <span style="flex: 1;">${message}</span>
    `;

    container.appendChild(toast);
    if (window.lucide) window.lucide.createIcons();

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  // Standard Modal Confirmation Dialog
  confirm({ title, message, confirmText = 'Confirm', confirmBtnClass = 'btn-primary', onConfirm }) {
    let backdrop = document.getElementById('confirm-modal-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'confirm-modal-backdrop';
      backdrop.className = 'modal-backdrop';
      backdrop.innerHTML = `
        <div class="modal-card" style="max-width: 440px;">
          <div class="modal-header">
            <h3 class="modal-title" id="confirm-modal-title">Confirm Action</h3>
            <button class="btn-close-modal" id="confirm-modal-close">&times;</button>
          </div>
          <div class="modal-body">
            <p id="confirm-modal-msg" style="color: var(--text-secondary); line-height: 1.6;"></p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="confirm-modal-cancel">Cancel</button>
            <button class="btn" id="confirm-modal-btn">Confirm</button>
          </div>
        </div>
      `;
      document.body.appendChild(backdrop);
    }

    const titleEl = document.getElementById('confirm-modal-title');
    const msgEl = document.getElementById('confirm-modal-msg');
    const confirmBtn = document.getElementById('confirm-modal-btn');
    const cancelBtn = document.getElementById('confirm-modal-cancel');
    const closeBtn = document.getElementById('confirm-modal-close');

    titleEl.textContent = title;
    msgEl.textContent = message;
    confirmBtn.textContent = confirmText;
    confirmBtn.className = `btn ${confirmBtnClass}`;

    const closeModal = () => {
      backdrop.classList.remove('active');
    };

    closeBtn.onclick = closeModal;
    cancelBtn.onclick = closeModal;
    backdrop.onclick = (e) => {
      if (e.target === backdrop) closeModal();
    };

    confirmBtn.onclick = () => {
      closeModal();
      if (typeof onConfirm === 'function') onConfirm();
    };

    backdrop.classList.add('active');
  },

  // Currency Formatter
  formatINR(amount) {
    const val = parseFloat(amount) || 0;
    return '₹' + val.toLocaleString('en-IN', {
      maximumFractionDigits: 2,
      minimumFractionDigits: val % 1 !== 0 ? 2 : 0
    });
  },

  // Format Date readable e.g. "18 Oct 2026"
  formatDisplayDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }
};

document.addEventListener('DOMContentLoaded', () => {
  PCMC_UI.init();
});
