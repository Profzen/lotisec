import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Export null if missing env variables, same defensive pattern as mobile
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

if (!supabase) {
  console.warn("⚠️ Supabase Client: Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Realtime features (Zem) will be disabled.");
}
