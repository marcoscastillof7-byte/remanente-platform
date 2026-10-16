import { getDb } from '../server/db/database.js';

/**
 * Script para restaurar todos los puntos de los jugadores tal como estaban
 * antes de la eliminación de puntos de Meets.
 */
async function restorePoints() {
  const supabase = getDb();
  console.log('--- Restaurando puntos de todos los jugadores a su estado previo ---');

  const previousPointsMap = {
    1:  { username: 'alexas', points: 693 },
    2:  { username: 'cristalr', points: 0 },
    5:  { username: 'Marcos', points: 2784 },
    7:  { username: 'Loammy23', points: 5619 },
    8:  { username: 'Valeria ', points: 3952 },
    12: { username: 'Xavier Lantigua ', points: 0 },
    13: { username: 'AmeGenao', points: 120 },
    14: { username: 'orianaquezada', points: 0 },
    15: { username: 'Leticiamontesdeoca', points: 440 },
    17: { username: 'Jose Enriquez ', points: 4370 },
    26: { username: 'omarsebastian6', points: 0 },
    27: { username: 'Mark', points: 551 }
  };

  const { data: users, error: uErr } = await supabase.from('users').select('id, username, points').order('id');
  if (uErr) {
    console.error('Error cargando usuarios:', uErr);
    process.exit(1);
  }

  for (const u of users) {
    const target = previousPointsMap[u.id];
    if (!target) {
      console.warn(`Usuario desconocido ID ${u.id} (${u.username}), omitiendo...`);
      continue;
    }

    const currentPoints = u.points || 0;
    const restoredPoints = target.points;

    console.log(`Restaurando [${u.id}] ${u.username}: ${currentPoints} pts -> ${restoredPoints} pts`);

    const { error: updErr } = await supabase
      .from('users')
      .update({ points: restoredPoints })
      .eq('id', u.id);

    if (updErr) {
      console.error(`Error restaurando usuario ${u.id}:`, updErr);
    }
  }

  console.log('\n--- Verificación de puntos restaurados en la base de datos ---');
  const { data: verifyUsers } = await supabase.from('users').select('id, username, points').order('points', { ascending: false });
  console.table(verifyUsers);
  console.log('\n¡Todos los puntos previos han sido restaurados con éxito!');
}

restorePoints().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
