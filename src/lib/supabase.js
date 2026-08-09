import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://wfbfpidkwittvlhgwnnp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndmYmZwaWRrd2l0dHZsaGd3bm5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYyODQ5NzQsImV4cCI6MjEwMTg2MDk3NH0.2klEUJ4uRKJW72_uQZbTHr09bGmUINslu7HVpMmNKoE';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
