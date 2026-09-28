import { getDb } from './server/db/database.js';

async function deleteUsers() {
    const supabase = getDb();

    console.log(`Buscando usuarios con username: RGRGDRGDRG`);
    const { data: users, error: userError } = await supabase
        .from('users')
        .select('id, username')
        .eq('username', 'RGRGDRGDRG');
        
    if (userError || !users || users.length === 0) {
        console.log(`Usuario 'RGRGDRGDRG' no encontrado o error:`, userError?.message);
        return;
    }
    
    for (const user of users) {
        const userId = user.id;
        console.log(`Encontrado ${user.username} con ID ${userId}. Eliminando dependencias...`);

        await supabase.from('study_streaks').delete().eq('user_id', userId);
        await supabase.from('user_notes').delete().eq('user_id', userId);
        await supabase.from('user_achievements').delete().eq('user_id', userId);
        await supabase.from('flashcard_progress').delete().eq('user_id', userId);
        
        const { data: cConfigs } = await supabase.from('custom_quiz_configs').select('id').eq('user_id', userId);
        if (cConfigs && cConfigs.length > 0) {
            const configIds = cConfigs.map(c => c.id);
            const { data: cAttempts } = await supabase.from('custom_quiz_attempts').select('id').in('config_id', configIds);
            if (cAttempts && cAttempts.length > 0) {
                const attemptIds = cAttempts.map(a => a.id);
                await supabase.from('custom_quiz_answers').delete().in('attempt_id', attemptIds);
                await supabase.from('custom_quiz_attempts').delete().in('id', attemptIds);
            }
            await supabase.from('custom_quiz_configs').delete().eq('user_id', userId);
        }

        const { data: attempts } = await supabase.from('quiz_attempts').select('id').eq('user_id', userId);
        if (attempts && attempts.length > 0) {
            const attemptIds = attempts.map(a => a.id);
            await supabase.from('quiz_answers').delete().in('attempt_id', attemptIds);
            await supabase.from('quiz_attempts').delete().eq('user_id', userId);
        }

        await supabase.from('survival_attempts').delete().eq('user_id', userId);
        await supabase.from('duels').delete().or(`challenger_id.eq.${userId},opponent_id.eq.${userId}`);
        await supabase.from('notifications').delete().eq('user_id', userId);
        await supabase.from('flashcards').delete().eq('created_by', userId);
        
        const { error: delError } = await supabase.from('users').delete().eq('id', userId);
        if (delError) {
            console.error(`Error borrando usuario ${user.username}:`, delError.message);
        } else {
            console.log(`Usuario ${user.username} eliminado completamente.`);
        }
    }
}

deleteUsers().then(() => console.log('Proceso terminado.'));
