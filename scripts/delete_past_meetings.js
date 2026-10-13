import { getDb } from '../server/db/database.js';

async function main() {
  const supabase = getDb();
  console.log('Consultando reuniones pasadas / finalizadas...');
  
  const { data: pastMeetings, error: fetchErr } = await supabase
    .from('meetings')
    .select('id, title, status, scheduled_for, created_at')
    .in('status', ['ended', 'finished', 'closed']);

  if (fetchErr) {
    console.error('Error consultando reuniones:', fetchErr);
    process.exit(1);
  }

  console.log(`Se encontraron ${pastMeetings?.length || 0} reuniones pasadas:`);
  (pastMeetings || []).forEach(m => {
    console.log(` - [${m.id}] "${m.title}" (status: ${m.status}, scheduled: ${m.scheduled_for})`);
  });

  if (!pastMeetings || pastMeetings.length === 0) {
    console.log('No hay reuniones pasadas para borrar.');
    process.exit(0);
  }

  const idsToDelete = pastMeetings.map(m => m.id);
  const { data: deleted, error: delErr } = await supabase
    .from('meetings')
    .delete()
    .in('id', idsToDelete)
    .select('id, title');

  if (delErr) {
    console.error('Error eliminando reuniones pasadas:', delErr);
    process.exit(1);
  }

  console.log(`¡Éxito! Se eliminaron ${deleted?.length || idsToDelete.length} reuniones pasadas del historial.`);
  process.exit(0);
}

main().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
