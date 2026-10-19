/* ============================================================================
   PCMC Washing Centre - ERP Admin Portal
   Authentication & Route Guard
   ============================================================================ */

const PCMC_AUTH = {
  // Check auth state on protected pages
  async requireAuth(options = { allowDemo: true }) {
    const isLoginPage = window.location.pathname.endsWith('login.html');
    const isConfigured = window.PCMC_SUPABASE && window.PCMC_SUPABASE.isReady();

    // If Supabase is not configured yet and demo is allowed, enable preview mode
    if (!isConfigured) {
      if (isLoginPage) {
        // Can stay on login page or let them click explore demo
        return null;
      }
      console.info('Supabase not configured: Running in Demo / Standalone Mode.');
      window.PCMC_DEMO_MODE = true;
      PCMC_AUTH.renderDemoBanner();
      return { email: 'demo.owner@pcmcwashingcentre.com', full_name: 'Business Owner (Demo)' };
    }

    try {
      const client = window.PCMC_SUPABASE.client;
      const { data: { session }, error } = await client.auth.getSession();

      if (error || !session) {
        if (!isLoginPage) {
          const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
          window.location.href = `login.html?redirect=${returnUrl}`;
          return null;
        }
        return null;
      }

      // Check if user is in authorized_admins
      const { data: adminRecord, error: adminError } = await client
        .from('authorized_admins')
        .select('*')
        .eq('id', session.user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (adminError || !adminRecord) {
        console.warn('User is authenticated in Supabase but not authorized in authorized_admins table');
        // If not registered as admin, sign out
        await client.auth.signOut();
        if (!isLoginPage) {
          window.location.href = `login.html?error=unauthorized`;
        }
        return null;
      }

      if (isLoginPage) {
        // Already logged in, redirect to dashboard
        window.location.href = 'dashboard.html';
        return adminRecord;
      }

      // Update UI with admin details
      PCMC_AUTH.updateUserUI(adminRecord);
      return adminRecord;
    } catch (err) {
      console.error('Authentication verification error:', err);
      if (!isLoginPage) {
        window.location.href = 'login.html?error=auth_error';
      }
      return null;
    }
  },

  // Perform Email & Password login
  async login(email, password) {
    if (!window.PCMC_SUPABASE || !window.PCMC_SUPABASE.isReady()) {
      throw new Error('Supabase is not configured yet. Please configure your Supabase Project URL and Anon Key in Settings.');
    }

    const cleanEmail = (email || '').trim().toLowerCase();
    const client = window.PCMC_SUPABASE.client;
    const { data, error } = await client.auth.signInWithPassword({
      email: cleanEmail,
      password: password
    });

    if (error) {
      throw error;
    }

    // Verify authorized admin record
    const { data: adminRecord, error: adminErr } = await client
      .from('authorized_admins')
      .select('*')
      .eq('id', data.user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (adminErr || !adminRecord) {
      await client.auth.signOut();
      throw new Error(`Access Denied: "${cleanEmail}" is authenticated, but not yet added to authorized administrators. Please run in Supabase SQL Editor: SELECT public.register_initial_admin('${cleanEmail}', 'Business Owner');`);
    }

    return { user: data.user, admin: adminRecord };
  },

  // Perform sign out
  async logout() {
    if (window.PCMC_SUPABASE && window.PCMC_SUPABASE.client) {
      try {
        await window.PCMC_SUPABASE.client.auth.signOut();
      } catch (err) {
        console.warn('Error signing out:', err);
      }
    }
    sessionStorage.clear();
    window.location.href = 'login.html';
  },

  // Render clean non-intrusive notice when in demo/preview mode
  renderDemoBanner() {
    if (document.getElementById('demo-mode-banner')) return;
    const contentArea = document.querySelector('.admin-content');
    if (!contentArea) return;

    const banner = document.createElement('div');
    banner.id = 'demo-mode-banner';
    banner.className = 'demo-inline-notice';
    banner.innerHTML = `
      <div style="display: flex; align-items: center; gap: 0.65rem; flex-wrap: wrap;">
        <span class="badge badge-washing" style="font-weight: 700;"><i data-lucide="info" style="width: 12px; height: 12px;"></i> PREVIEW MODE</span>
        <span style="font-size: 0.82rem; color: var(--text-secondary);">Running with sample operational records. Connect your Supabase project in <a href="settings.html#supabase" style="color: var(--accent-primary); font-weight: 600; text-decoration: underline;">Settings</a> to activate live PostgreSQL data.</span>
      </div>
      <a href="settings.html#supabase" class="btn btn-xs btn-primary">Connect Supabase</a>
    `;
    contentArea.prepend(banner);
    if (window.lucide) window.lucide.createIcons();
  },

  updateUserUI(adminRecord) {
    const nameEl = document.getElementById('admin-display-name');
    const emailEl = document.getElementById('admin-display-email');
    const avatarEl = document.getElementById('admin-display-avatar');

    if (nameEl) nameEl.textContent = adminRecord.full_name || 'Admin';
    if (emailEl) emailEl.textContent = adminRecord.email || '';
    if (avatarEl) {
      const initial = (adminRecord.full_name || adminRecord.email || 'A').charAt(0).toUpperCase();
      avatarEl.textContent = initial;
    }
  }
};

// Explicitly bind to global window
window.PCMC_AUTH = PCMC_AUTH;
