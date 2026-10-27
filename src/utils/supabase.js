import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ltrudmbtqtgonfjctmsz.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_5xNi3foCCy7p-oktfNRhjQ_7t52ob9z';

export const supabase = createClient(supabaseUrl, supabaseKey);
