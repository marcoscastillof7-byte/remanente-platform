import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

let supabaseClient = null;

const FALLBACK_SUPABASE_URL = 'https://ltrudmbtqtgonfjctmsz.supabase.co';
const FALLBACK_SUPABASE_KEY = 'sb_publishable_5xNi3foCCy7p-oktfNRhjQ_7t52ob9z';

export const getDb = () => {
  if (!supabaseClient) {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || 
                        process.env.SUPABASE_URL || 
                        FALLBACK_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                        process.env.VITE_SUPABASE_ANON_KEY || 
                        process.env.SUPABASE_KEY || 
                        process.env.VITE_SUPABASE_KEY || 
                        FALLBACK_SUPABASE_KEY;
    try {
      supabaseClient = createClient(supabaseUrl, supabaseKey);
    } catch (err) {
      console.error("[Database] Error inicializando cliente Supabase:", err.message);
      supabaseClient = createClient(FALLBACK_SUPABASE_URL, FALLBACK_SUPABASE_KEY);
    }
  }
  return supabaseClient;
};
