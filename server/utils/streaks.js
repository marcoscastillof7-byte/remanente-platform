/**
 * Utilidades para el manejo robusto y consistente de rachas (streaks) de estudio
 */

export const PLATFORM_TIMEZONE = 'America/Santo_Domingo';

/**
 * Obtiene la fecha en formato YYYY-MM-DD para una zona horaria específica
 */
export const getLocalDate = (date = new Date(), timeZone = PLATFORM_TIMEZONE) => {
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(d);
  } catch (e) {
    // Fallback simple si la zona horaria falla
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toISOString().split('T')[0];
  }
};

/**
 * Calcula la diferencia en días naturales entre dos fechas YYYY-MM-DD
 */
export const getDaysDiff = (dateStr1, dateStr2) => {
  if (!dateStr1 || !dateStr2) return null;
  const d1 = new Date(dateStr1 + 'T00:00:00Z');
  const d2 = new Date(dateStr2 + 'T00:00:00Z');
  return Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
};

/**
 * Obtiene la racha actual de un usuario de forma segura y verifica si sigue activa
 */
export const getSafeUserStreak = async (supabase, userId, clientDate = null) => {
  const today = clientDate && /^\d{4}-\d{2}-\d{2}$/.test(clientDate) 
    ? clientDate 
    : getLocalDate(new Date());

  // Obtenemos el registro sin usar .single() para evitar caídas si existieran duplicados
  const { data: rows, error } = await supabase
    .from('study_streaks')
    .select('*')
    .eq('user_id', userId)
    .order('id', { ascending: false });

  if (error) {
    console.error('Error obteniendo study_streaks:', error);
  }

  let record = rows && rows.length > 0 ? rows[0] : null;

  // Si había duplicados, limpiamos los antiguos en segundo plano
  if (rows && rows.length > 1) {
    const duplicateIds = rows.slice(1).map(r => r.id);
    supabase.from('study_streaks').delete().in('id', duplicateIds).then(() => {});
  }

  // Si el usuario no tiene registro de racha, lo creamos
  if (!record) {
    const { data: newRow } = await supabase
      .from('study_streaks')
      .insert([{ user_id: userId, current_streak: 0, longest_streak: 0, last_study_date: null }])
      .select()
      .maybeSingle();

    record = newRow || { user_id: userId, current_streak: 0, longest_streak: 0, last_study_date: null };
  }

  let activeStreak = record.current_streak || 0;
  let studiedToday = false;
  let streakAtRisk = false;

  if (record.last_study_date) {
    const lastDay = getLocalDate(record.last_study_date);
    const diff = getDaysDiff(lastDay, today);

    if (diff === 0) {
      // Estudió hoy
      studiedToday = true;
      streakAtRisk = false;
      activeStreak = record.current_streak || 1;
    } else if (diff === 1) {
      // Estudió ayer: la racha sigue viva pero aún no ha estudiado hoy
      studiedToday = false;
      streakAtRisk = activeStreak > 0;
      // activeStreak se mantiene intacto
    } else if (diff > 1 || diff < 0) {
      // Pasaron 2 o más días: la racha expiró
      studiedToday = false;
      streakAtRisk = false;
      activeStreak = 0;

      // Sincronizamos en la BD si aún decía un número mayor a 0
      if (record.current_streak > 0) {
        supabase
          .from('study_streaks')
          .update({ current_streak: 0 })
          .eq('id', record.id)
          .then(() => {});
      }
    }
  } else {
    activeStreak = 0;
    studiedToday = false;
    streakAtRisk = false;
  }

  return {
    ...record,
    current_streak: activeStreak,
    longest_streak: record.longest_streak || 0,
    studied_today: studiedToday,
    streak_at_risk: streakAtRisk,
    today_date: today
  };
};

/**
 * Registra una sesión de estudio completada (Quiz) y avanza la racha
 */
export const recordStudySession = async (supabase, userId, clientDate = null) => {
  const today = clientDate && /^\d{4}-\d{2}-\d{2}$/.test(clientDate)
    ? clientDate
    : getLocalDate(new Date());

  const currentStatus = await getSafeUserStreak(supabase, userId, today);
  
  let newStreak = 1;
  let isNewDay = true;
  let streakPointsEarned = 0;

  if (currentStatus.last_study_date) {
    const lastDay = getLocalDate(currentStatus.last_study_date);
    const diff = getDaysDiff(lastDay, today);

    if (diff === 0) {
      // Ya estudió hoy: mantiene su racha actual sin duplicar puntos de racha
      newStreak = Math.max(1, currentStatus.current_streak);
      isNewDay = false;
      streakPointsEarned = 0;
    } else if (diff === 1) {
      // Estudió ayer: ¡Aumenta la racha!
      newStreak = (currentStatus.current_streak || 0) + 1;
      isNewDay = true;
    } else {
      // Se rompió la racha: reinicia en 1
      newStreak = 1;
      isNewDay = true;
    }
  } else {
    // Primer estudio de su vida
    newStreak = 1;
    isNewDay = true;
  }

  if (isNewDay) {
    if (newStreak === 1) streakPointsEarned = 10;
    else if (newStreak === 2) streakPointsEarned = 20;
    else if (newStreak === 3) streakPointsEarned = 30;
    else if (newStreak >= 7) streakPointsEarned = 50;
    else streakPointsEarned = 40; // Días 4, 5, 6
  }

  const longestStreak = Math.max(currentStatus.longest_streak || 0, newStreak);
  const nowIso = new Date().toISOString();

  // Guardamos en la base de datos
  if (currentStatus.id) {
    await supabase
      .from('study_streaks')
      .update({
        current_streak: newStreak,
        longest_streak: longestStreak,
        last_study_date: nowIso
      })
      .eq('id', currentStatus.id);
  } else {
    await supabase
      .from('study_streaks')
      .insert([{
        user_id: userId,
        current_streak: newStreak,
        longest_streak: longestStreak,
        last_study_date: nowIso
      }]);
  }

  return {
    current_streak: newStreak,
    longest_streak: longestStreak,
    streakPointsEarned,
    isNewDay,
    studied_today: true,
    streak_at_risk: false
  };
};
