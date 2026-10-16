import { getDb } from '../server/db/database.js';

async function syncOfficialPoints() {
  const supabase = getDb();
  console.log('--- Sincronizando Logros y Puntos Oficiales según sistema_de_puntos.md ---');

  // 1. Ajustar o insertar logros oficiales en la tabla achievements
  // Perfección a 150 pts
  await supabase.from('achievements').update({ points_reward: 150, name: 'Perfección' }).eq('id', 4);

  // Comprobar si existe "Estudiante Dedicado"
  const { data: existDed } = await supabase.from('achievements').select('*').eq('name', 'Estudiante Dedicado').maybeSingle();
  let dedicadoId = existDed?.id;
  if (!existDed) {
    const { data: newDed, error: errDed } = await supabase.from('achievements').insert([{
      name: 'Estudiante Dedicado',
      description: 'Completar 10 quizzes',
      icon: 'book-open',
      criteria_type: 'total_quizzes',
      criteria_value: 10,
      points_reward: 250
    }]).select().single();
    if (errDed) console.error('Error insertando Estudiante Dedicado:', errDed);
    dedicadoId = newDed?.id;
    console.log(`Logro 'Estudiante Dedicado' creado con ID: ${dedicadoId}`);
  }

  // Comprobar si existe "Explorador de Libro"
  const { data: existExp } = await supabase.from('achievements').select('*').eq('name', 'Explorador de Libro').maybeSingle();
  let exploradorId = existExp?.id;
  if (!existExp) {
    const { data: newExp, error: errExp } = await supabase.from('achievements').insert([{
      name: 'Explorador de Libro',
      description: 'Terminar todos los capítulos de un libro bíblico',
      icon: 'map',
      criteria_type: 'book_completed',
      criteria_value: 1,
      points_reward: 300
    }]).select().single();
    if (errExp) console.error('Error insertando Explorador de Libro:', errExp);
    exploradorId = newExp?.id;
    console.log(`Logro 'Explorador de Libro' creado con ID: ${exploradorId}`);
  }

  // 2. Registrar logros ganados por los usuarios en user_achievements
  const toUnlock = [
    // Jose Enriquez (ID 17): Estudiante Dedicado + Explorador de Libro (1 Samuel)
    { user_id: 17, achievement_id: dedicadoId },
    { user_id: 17, achievement_id: exploradorId },
    // Loammy23 (ID 7): Estudiante Dedicado + Explorador de Libro (1 Samuel)
    { user_id: 7, achievement_id: dedicadoId },
    { user_id: 7, achievement_id: exploradorId },
    // Valeria (ID 8): Estudiante Dedicado
    { user_id: 8, achievement_id: dedicadoId }
  ].filter(item => item.achievement_id);

  for (const ach of toUnlock) {
    const { data: existing } = await supabase.from('user_achievements')
      .select('id')
      .eq('user_id', ach.user_id)
      .eq('achievement_id', ach.achievement_id)
      .maybeSingle();

    if (!existing) {
      await supabase.from('user_achievements').insert([ach]);
      console.log(`Logro ID ${ach.achievement_id} otorgado al usuario ID ${ach.user_id}`);
    }
  }

  // 3. Reemplazar los puntos de todos los jugadores exactamente a lo que estipula el documento oficial
  const officialDocumentPoints = {
    17: { username: 'Jose Enriquez ', points: 4658 },
    7:  { username: 'Loammy23', points: 2985 },
    8:  { username: 'Valeria ', points: 1539 },
    15: { username: 'Leticiamontesdeoca', points: 200 },
    5:  { username: 'Marcos', points: 143 },
    13: { username: 'AmeGenao', points: 120 },
    1:  { username: 'alexas', points: 0 },
    27: { username: 'Mark', points: 0 },
    2:  { username: 'cristalr', points: 0 },
    12: { username: 'Xavier Lantigua ', points: 0 },
    14: { username: 'orianaquezada', points: 0 },
    26: { username: 'omarsebastian6', points: 0 }
  };

  console.log('\n--- Actualizando puntos en la tabla users ---');
  for (const [idStr, data] of Object.entries(officialDocumentPoints)) {
    const userId = parseInt(idStr, 10);
    const { error: updErr } = await supabase
      .from('users')
      .update({ points: data.points })
      .eq('id', userId);

    if (updErr) {
      console.error(`Error actualizando usuario ${userId}:`, updErr);
    } else {
      console.log(`[OK] ${data.username} (ID ${userId}) -> ${data.points} pts`);
    }
  }

  // 4. Verificación final de la tabla de honor
  console.log('\n--- TABLA DE HONOR OFICIAL FINAL ---');
  const { data: leaderboard } = await supabase
    .from('users')
    .select('id, username, points')
    .order('points', { ascending: false });

  console.table(leaderboard);
  console.log('\n¡Todos los puntos de los jugadores han sido reemplazados exitosamente según el documento oficial!');
}

syncOfficialPoints().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
