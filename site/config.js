const supabaseUrl = 'https://tclfxpeutarjrxdovqvh.supabase.co'
  .trim()
  .replace(/\/rest\/v1\/?$/i, '')
  .replace(/\/+$/, '');

const publishableKey = 'sb_publishable_UUZc2PDqnU_YQ1FIgNpMSA_7oIn0CK1'.trim();

window.HILLSIDE_CONFIG = {
  SUPABASE_URL: supabaseUrl,
  SUPABASE_PUBLISHABLE_KEY: publishableKey,
  SITE_NAME: 'Hillside Connect',
  DEFAULT_COUNTRY_CODE: '+1',
  ENABLE_DEMO_MODE: false
};
