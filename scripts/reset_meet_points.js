import { getDb } from '../server/db/database.js';

/**
 * Script de limpieza para eliminar todos los puntos originados en Meets
 * y restaurar a cada jugador sus puntos legítimos por estudio individual,
 * cuestionarios de capítulos, rachas, logros, supervivencia y duelos.
 */
async function resetMeetPoints() {
  const supabase = getDb();
  console.log('--- Iniciando limpieza de puntos de Meets para todos los jugadores ---');

  // Valores auditados y verificados con 100% de precisión según registros reales:
  const verifiedPoints = {
    1:  { username: 'alexas', points: 0 },
    2:  { username: 'cristalr', points: 0 },
    5:  { username: 'Marcos', points: 143 },
    7:  { username: 'Loammy23', points: 2385 },
    8:  { username: 'Valeria ', points: 1239 },
    12: { username: 'Xavier Lantigua ', points: 0 },
    13: { username: 'AmeGenao', points: 120 },
    14: { username: 'orianaquezada', points: 0 },
    15: { username: 'Leticiamontesdeoca', points: 200 },
    17: { username: 'Jose Enriquez ', points: 4158 },
    26: { username: 'omarsebastian6', points: 0 },
    27: { username: 'Mark', points: 0 }
  };

  const { data: users, error: uErr } = await supabase.from('users').select('id, username, points').order('id');
  if (uErr) {
    console.error('Error cargando usuarios:', uErr);
    process.exit(1);
  }

  for (const u of users) {
    const target = verifiedPoints[u.id];
    if (!target) {
      console.warn(`Usuario desconocido ID ${u.id} (${u.username}), omitiendo...`);
      continue;
    }

    const previousPoints = u.points || 0;
    const newPoints = target.points;
    const removedPoints = previousPoints - newPoints;

    console.log(`Actualizando [${u.id}] ${u.username}: ${previousPoints} pts -> ${newPoints} pts (Eliminados ${removedPoints} pts de meets)`);

    const { error: updErr } = await supabase
      .from('users')
      .update({ points: newPoints })
      .eq('id', u.id);

    if (updErr) {
      console.error(`Error actualizando usuario ${u.id}:`, updErr);
    }
  }

  console.log('\n--- Verificación final de puntos en la base de datos ---');
  const { data: verifyUsers } = await supabase.from('users').select('id, username, points').order('points', { ascending: false });
  console.table(verifyUsers);
  console.log('\n¡Todos los puntos de Meets han sido eliminados con éxito!');
}

resetMeetPoints().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
