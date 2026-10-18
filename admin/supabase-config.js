/* ============================================================================
   PCMC Washing Centre - ERP Admin Portal
   Supabase Configuration & Client Initializer
   ============================================================================ */

(function () {
  // Safe storage keys
  const STORAGE_KEY_URL = 'pcmc_erp_supabase_url';
  const STORAGE_KEY_ANON = 'pcmc_erp_supabase_anon_key';

  // Default placeholders — can be directly edited here or configured via Admin UI / Settings
  const DEFAULT_SUPABASE_URL = 'https://your-project-ref.supabase.co';
  const DEFAULT_SUPABASE_ANON_KEY = 'your-public-anon-key-here';

  // Read configured credentials from window, localStorage, or fallback defaults
  function getCredentials() {
    const savedUrl = localStorage.getItem(STORAGE_KEY_URL);
    const savedAnon = localStorage.getItem(STORAGE_KEY_ANON);

    const url = (window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.url) || savedUrl || DEFAULT_SUPABASE_URL;
    const anonKey = (window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.anonKey) || savedAnon || DEFAULT_SUPABASE_ANON_KEY;

    const isConfigured = url &&
      anonKey &&
      !url.includes('your-project-ref') &&
      !anonKey.includes('your-public-anon-key') &&
      url.startsWith('https://');

    return { url, anonKey, isConfigured };
  }

  // Initialize official Supabase client
  let supabaseClient = null;
  const creds = getCredentials();

  if (window.supabase && creds.isConfigured) {
    try {
      supabaseClient = window.supabase.createClient(creds.url, creds.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });
    } catch (err) {
      console.warn('Supabase client initialization warning:', err);
    }
  }

  // Expose global controller
  window.PCMC_SUPABASE = {
    client: supabaseClient,
    getCredentials,
    saveCredentials: function (url, anonKey) {
      if (!url || !anonKey) return false;
      const cleanUrl = url.trim().replace(/\/+$/, '');
      const cleanAnon = anonKey.trim();

      localStorage.setItem(STORAGE_KEY_URL, cleanUrl);
      localStorage.setItem(STORAGE_KEY_ANON, cleanAnon);

      if (window.supabase) {
        window.PCMC_SUPABASE.client = window.supabase.createClient(cleanUrl, cleanAnon, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
          }
        });
      }
      return true;
    },
    clearCredentials: function () {
      localStorage.removeItem(STORAGE_KEY_URL);
      localStorage.removeItem(STORAGE_KEY_ANON);
      window.PCMC_SUPABASE.client = null;
    },
    isReady: function () {
      return !!(window.PCMC_SUPABASE.client && getCredentials().isConfigured);
    }
  };
})();
