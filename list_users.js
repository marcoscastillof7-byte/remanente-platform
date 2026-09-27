import { getDb } from './server/db/database.js';

async function listUsers() {
    const supabase = getDb();
    const { data } = await supabase.from('users').select('username');
    console.log("Usuarios actuales:", data?.map(u => u.username).join(', '));
}

listUsers();
