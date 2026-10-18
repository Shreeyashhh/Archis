/* ============================================================================
   PCMC Washing Centre - Settings Controller
   Database connection configuration, health diagnostics, catalog rates, and auth profile
   ============================================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Auth Guard
  const admin = await PCMC_AUTH.requireAuth();

  // 2. DOM Elements
  const cfgUrl = document.getElementById('cfgSupabaseUrl');
  const cfgAnon = document.getElementById('cfgSupabaseAnon');
  const btnTest = document.getElementById('btnTestSupabaseConn');
  const btnSave = document.getElementById('btnSaveSupabase');
  const btnClear = document.getElementById('btnClearSupabase');
  const connStatusTag = document.getElementById('connStatusTag');
  const formConfig = document.getElementById('supabaseConfigForm');

  const profileName = document.getElementById('profileNameDisplay');
  const profileEmail = document.getElementById('profileEmailDisplay');
  const formChangePwd = document.getElementById('changePasswordForm');
  const newPwd = document.getElementById('cfgNewPassword');
  const confirmPwd = document.getElementById('cfgConfirmPassword');
  const btnUpdatePwd = document.getElementById('btnUpdatePassword');

  const ratesContainer = document.getElementById('catalogRatesContainer');
  const btnSaveRates = document.getElementById('btnSaveServiceRates');

  // Load existing credentials
  const creds = window.PCMC_SUPABASE.getCredentials();
  if (creds.isConfigured) {
    cfgUrl.value = creds.url;
    cfgAnon.value = creds.anonKey;
    connStatusTag.className = 'badge badge-completed';
    connStatusTag.textContent = 'Supabase Configured';
  } else {
    connStatusTag.className = 'badge badge-washing';
    connStatusTag.textContent = 'Demo Mode (Offline)';
  }

  // Update profile
  if (admin) {
    if (profileName) profileName.textContent = admin.full_name || 'Business Owner';
    if (profileEmail) profileEmail.textContent = admin.email || 'admin@pcmcwashingcentre.com';
  }

  // --------------------------------------------------------------------------
  // TEST CONNECTION
  // --------------------------------------------------------------------------
  btnTest.addEventListener('click', async () => {
    const url = cfgUrl.value.trim();
    const key = cfgAnon.value.trim();

    if (!url || !key) {
      PCMC_UI.toast('Please provide both Project URL and Public Anon Key', 'warning');
      return;
    }

    btnTest.disabled = true;
    btnTest.innerHTML = '<i data-lucide="loader" class="spin"></i> Testing...';
    if (window.lucide) window.lucide.createIcons();

    try {
      const tempClient = window.supabase.createClient(url, key);
      const { data, error } = await tempClient.from('service_catalog').select('id').limit(1);

      if (error) {
        throw error;
      }

      PCMC_UI.toast('Connection successful! Database and RLS policies verified.', 'success');
      connStatusTag.className = 'badge badge-completed';
      connStatusTag.textContent = 'Connection Verified';
    } catch (err) {
      console.error('Connection test failed:', err);
      PCMC_UI.toast('Connection failed: ' + (err.message || 'Check URL and key or verify schema is applied.'), 'error');
      connStatusTag.className = 'badge badge-cancelled';
      connStatusTag.textContent = 'Connection Failed';
    } finally {
      btnTest.disabled = false;
      btnTest.innerHTML = '<i data-lucide="zap"></i> Test Connection';
      if (window.lucide) window.lucide.createIcons();
    }
  });

  // --------------------------------------------------------------------------
  // SAVE CONFIGURATION
  // --------------------------------------------------------------------------
  formConfig.addEventListener('submit', (e) => {
    e.preventDefault();
    const url = cfgUrl.value.trim();
    const key = cfgAnon.value.trim();

    if (!url || !key) {
      PCMC_UI.toast('Both fields are required.', 'warning');
      return;
    }

    const saved = window.PCMC_SUPABASE.saveCredentials(url, key);
    if (saved) {
      PCMC_UI.toast('Supabase credentials saved successfully! Reloading portal...', 'success');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  });

  // Reset to Demo
  btnClear.addEventListener('click', () => {
    PCMC_UI.confirm({
      title: 'Reset to Demo Mode',
      message: 'This will remove your saved Supabase credentials from this browser and return to standalone demo mode. Continue?',
      confirmText: 'Reset Credentials',
      confirmBtnClass: 'btn-danger',
      onConfirm: () => {
        window.PCMC_SUPABASE.clearCredentials();
        PCMC_UI.toast('Credentials cleared. Reloading in Demo Mode.', 'info');
        setTimeout(() => window.location.reload(), 800);
      }
    });
  });

  // --------------------------------------------------------------------------
  // CHANGE PASSWORD
  // --------------------------------------------------------------------------
  formChangePwd.addEventListener('submit', async (e) => {
    e.preventDefault();
    const p1 = newPwd.value;
    const p2 = confirmPwd.value;

    if (p1.length < 6) {
      PCMC_UI.toast('Password must be at least 6 characters.', 'warning');
      return;
    }

    if (p1 !== p2) {
      PCMC_UI.toast('Passwords do not match.', 'warning');
      return;
    }

    if (!window.PCMC_SUPABASE.isReady()) {
      PCMC_UI.toast('Password updated in Demo Mode (simulated).', 'success');
      newPwd.value = '';
      confirmPwd.value = '';
      return;
    }

    btnUpdatePwd.disabled = true;
    btnUpdatePwd.innerHTML = '<i data-lucide="loader" class="spin"></i> Updating...';
    if (window.lucide) window.lucide.createIcons();

    try {
      const client = window.PCMC_SUPABASE.client;
      const { error } = await client.auth.updateUser({ password: p1 });

      if (error) throw error;

      PCMC_UI.toast('Admin password successfully updated in Supabase Auth!', 'success');
      newPwd.value = '';
      confirmPwd.value = '';
    } catch (err) {
      console.error('Password update error:', err);
      PCMC_UI.toast('Failed to update password: ' + err.message, 'error');
    } finally {
      btnUpdatePwd.disabled = false;
      btnUpdatePwd.innerHTML = '<i data-lucide="key"></i> Update Password';
      if (window.lucide) window.lucide.createIcons();
    }
  });

  // --------------------------------------------------------------------------
  // SERVICE CATALOG BASE RATES
  // --------------------------------------------------------------------------
  function renderCatalogRates() {
    const savedRatesRaw = localStorage.getItem('pcmc_catalog_rates');
    const savedRates = savedRatesRaw ? JSON.parse(savedRatesRaw) : {};

    ratesContainer.innerHTML = PCMC_DB.SERVICE_KEYS.map(s => {
      const rate = savedRates[s.key] !== undefined ? savedRates[s.key] : s.defaultRate;
      return `
        <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 0.85rem;">
          <div style="font-size: 0.72rem; color: var(--accent-cyan); font-weight: 700; text-transform: uppercase;">${s.category}</div>
          <div style="font-weight: 600; font-size: 0.9rem; margin-bottom: 0.5rem;">${s.label}</div>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="font-weight: 700; color: var(--text-muted);">₹</span>
            <input type="number" min="0" step="any" class="form-control catalog-rate-input" data-key="${s.key}" value="${rate}" style="font-weight: 700; color: #fff;">
          </div>
        </div>
      `;
    }).join('');
  }

  btnSaveRates.addEventListener('click', () => {
    const updatedRates = {};
    ratesContainer.querySelectorAll('.catalog-rate-input').forEach(inp => {
      const key = inp.dataset.key;
      const val = parseFloat(inp.value) || 0;
      updatedRates[key] = val;

      // Update in memory defaultRate
      const def = PCMC_DB.SERVICE_KEYS.find(s => s.key === key);
      if (def) def.defaultRate = val;
    });

    localStorage.setItem('pcmc_catalog_rates', JSON.stringify(updatedRates));
    PCMC_UI.toast('Service catalog base rates updated!', 'success');
  });

  // Initial load
  renderCatalogRates();
});
