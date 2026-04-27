const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('必要な環境変数が設定されていません。NEXT_PUBLIC_SUPABASE_URL と (SUPABASE_SERVICE_ROLE_KEY もしくは NEXT_PUBLIC_SUPABASE_ANON_KEY) を .env.local に設定してください。');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

(async () => {
  try {
    const { count, error } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
    if (error) {
      console.error('Supabase error:', error);
      process.exit(1);
    }
    console.log(`profiles テーブルの件数: ${count}`);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
