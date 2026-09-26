import { getDb } from './server/db/database.js';
import bcrypt from 'bcryptjs';

async function createSpecialUsers() {
  const supabase = getDb();
  
  const users = [
    { username: 'Rowlis', pass: '12345' },
    { username: 'Rangelis', pass: '0101' }
  ];
  
  for (const u of users) {
    const hash = await bcrypt.hash(u.pass, 10);
    const { data, error } = await supabase.from('users').insert({
      username: u.username,
      password_hash: hash,
      role: 'user'
    }).select();
    
    if (error) {
      console.error(`Error creating ${u.username}:`, error);
    } else {
      console.log(`Created user ${u.username} with ID ${data[0].id}`);
    }
  }
}

createSpecialUsers();
