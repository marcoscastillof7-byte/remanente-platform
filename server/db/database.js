import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

let supabaseClient = null;

export const getDb = () => {
  if (!supabaseClient) {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || 
                        process.env.SUPABASE_URL || 
                        'https://ltrudmbtqtgonfjctmsz.supabase.co';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                        process.env.VITE_SUPABASE_ANON_KEY || 
                        process.env.SUPABASE_KEY || 
                        process.env.VITE_SUPABASE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      console.warn("[Database] Faltan credenciales de Supabase en las variables de entorno.");
    }
    try {
      supabaseClient = createClient(supabaseUrl, supabaseKey || '');
    } catch (err) {
      console.error("[Database] Error inicializando cliente Supabase:", err.message);
    }
  }
  return supabaseClient;
};
