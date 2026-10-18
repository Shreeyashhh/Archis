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

    const client = window.PCMC_SUPABASE.client;
    const { data, error } = await client.auth.signInWithPassword({
      email: email.trim(),
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
      throw new Error('Access Denied: This account is not registered in authorized administrators list.');
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

  // Render top banner when in demo/preview mode
  renderDemoBanner() {
    if (document.getElementById('demo-mode-banner')) return;
    const banner = document.createElement('div');
    banner.id = 'demo-mode-banner';
    banner.className = 'demo-banner';
    banner.innerHTML = `
      <div class="demo-banner-content">
        <span class="demo-badge"><i data-lucide="info"></i> PREVIEW MODE</span>
        <span>Using offline sample data. Connect your Supabase project in <a href="settings.html" style="text-decoration: underline; font-weight: 700; color: #fff;">Settings</a> to activate live database & secure RLS authentication.</span>
      </div>
      <a href="settings.html#supabase" class="btn btn-xs btn-primary">Connect Supabase</a>
    `;
    document.body.prepend(banner);
    document.body.classList.add('has-demo-banner');
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
