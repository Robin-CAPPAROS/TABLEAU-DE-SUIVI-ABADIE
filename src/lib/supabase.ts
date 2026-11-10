import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL ?? 'http://localhost:54321',
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? 'cle-absente',
  { auth: { persistSession: true, autoRefreshToken: true } },
);
