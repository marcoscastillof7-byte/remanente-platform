import { getDb } from './server/db/database.js';

async function resetLeaderboard() {
    console.log("Iniciando reseteo de la Tabla de Honor...");
    const supabase = getDb();
    
    // 1. Borrar todas las respuestas de los quizzes
    console.log("Borrando quiz_answers...");
    const { error: ansError } = await supabase.from('quiz_answers').delete().neq('id', 0); // neq id 0 is a hack to delete all in supabase
    if (ansError) {
        console.error("Error al borrar quiz_answers:", ansError);
    } else {
        console.log("quiz_answers borradas.");
    }

    // 2. Borrar todos los intentos de quizzes
    console.log("Borrando quiz_attempts...");
    const { error: attError } = await supabase.from('quiz_attempts').delete().neq('id', 0);
    if (attError) {
        console.error("Error al borrar quiz_attempts:", attError);
    } else {
        console.log("quiz_attempts borrados.");
    }

    // 3. Borrar custom_quiz_answers y attempts
    console.log("Borrando custom quizzes...");
    await supabase.from('custom_quiz_answers').delete().neq('id', 0);
    await supabase.from('custom_quiz_attempts').delete().neq('id', 0);

    // 4. Borrar survival_attempts
    console.log("Borrando survival_attempts...");
    await supabase.from('survival_attempts').delete().neq('id', 0);

    // 5. Opcional: si queremos resetear rachas y logros tambin
    // const { error: streakError } = await supabase.from('study_streaks').update({ current_streak: 0, longest_streak: 0, last_study_date: null }).neq('id', 0);
    
    console.log("Tabla de Honor reseteada exitosamente.");
}

resetLeaderboard().catch(console.error);
