import { getDb } from './server/db/database.js';
async function run() {
  const supabase = getDb();
  const idStr = "1";
  const { data, error } = await supabase.from('historical_details').select('*').eq('id', idStr).single();
  console.log("With string:", data, error);
}
run();
