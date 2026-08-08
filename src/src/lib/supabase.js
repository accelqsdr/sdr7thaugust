import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gfkgzbhtwpxdrhqevjzl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdma2d6Ymh0d3B4ZHJocWV2anpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMDY4NTgsImV4cCI6MjEwMTU4Mjg1OH0.scaBvDxgf_5ucRr_lz0ECA2n4qVXHkGzShvU3O9rcnE';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
