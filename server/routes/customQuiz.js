import express from 'express';
import { getDb } from '../db/database.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();
router.use(auth);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

router.post('/generate', async (req, res) => {
    const { timeLimit, questionCount, difficulty, bookIds, chapterIds } = req.body;
    try {
        const supabase = getDb();
        let targetChapterIds = chapterIds || [];
        
        if ((!chapterIds || chapterIds.length === 0) && bookIds && bookIds.length > 0) {
            const { data: chapters } = await supabase.from('chapters').select('id').in('book_id', bookIds);
            if (chapters) {
                targetChapterIds = chapters.map(c => c.id);
            }
        }

        let chapterNames = "";
        if (targetChapterIds.length > 0) {
            const { data: chaps } = await supabase
                .from('chapters')
                .select('id, chapter_number, books(name)')
                .in('id', targetChapterIds);
                
            if (chaps) {
                chapterNames = chaps.map(c => `${c.books?.name} Capítulo ${c.chapter_number} (usa el chapter_id: ${c.id})`).join(', ');
            }
        }

        let generatedQuestions = [];
        let useFallback = false;

        if (chapterNames && GEMINI_API_KEY) {
            const qCount = questionCount || 15;
            const diff = difficulty || 'mixto';
            
            const prompt = `Eres un erudito bíblico experto en la traducción Reina-Valera 1960. Genera exactamente ${qCount} preguntas de opción múltiple basándote EXCLUSIVAMENTE en el contenido de estos capítulos: ${chapterNames}.
            La dificultad debe ser: ${diff}.
            
            INSTRUCCIONES DE ESTILO (CRÍTICO):
            - El estilo de las preguntas debe ser extremadamente analítico, profundo y apegado al texto bíblico exacto (RV1960), similar a un estudio exegético.
            - Usa lenguaje preciso, pide nombres completos, linajes, cantidades exactas y detalles específicos según el texto.
            - La opción correcta debe reflejar el texto bíblico con precisión milimétrica.
            - La propiedad 'explanation' debe contener la respuesta exacta y la cita o contexto directo (Ej: "Era de Ramataim de Zofim, del monte de Efraín; hijo de Jeroham...").
            - El 'verse_reference' debe ser exacto (Ej: "1 Samuel 1:1").

            Devuelve ÚNICAMENTE un Array JSON válido, sin formato markdown. Cada objeto debe tener exactamente esta estructura:
            {
              "chapter_id": <Anota aquí el chapter_id numérico de la lista proporcionada>,
              "question_text": "Texto profundo y analítico de la pregunta...",
              "option_a": "Opción A",
              "option_b": "Opción B",
              "option_c": "Opción C",
              "option_d": "Opción D",
              "correct_answer": "a", 
              "difficulty": "${diff !== 'mixto' ? diff : 'medio'}",
              "explanation": "Respuesta exacta según RV1960 con su contexto",
              "verse_reference": "Ej: 1 Samuel 1:1"
            }`;

            try {
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${GEMINI_API_KEY}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: { response_mime_type: "application/json" }
                    })
                });

                const data = await response.json();
                if (data.error) {
                    console.error("Gemini Error:", data.error);
                    useFallback = true;
                } else {
                    const jsonText = data.candidates[0].content.parts[0].text;
                    const parsedQs = JSON.parse(jsonText);

                    if (Array.isArray(parsedQs) && parsedQs.length > 0) {
                        generatedQuestions = parsedQs;
                    } else {
                        useFallback = true;
                    }
                }
            } catch (err) {
                console.error("Fallo de red o parseo al contactar a Gemini:", err);
                useFallback = true; 
            }
        } else {
            useFallback = true;
        }

        let questions = [];
        let configId = null;

        if (!useFallback && generatedQuestions.length > 0) {
            const formattedQuestions = generatedQuestions.map(q => ({
                chapter_id: q.chapter_id || targetChapterIds[0],
                question_text: q.question_text,
                option_a: q.option_a,
                option_b: q.option_b,
                option_c: q.option_c,
                option_d: q.option_d,
                correct_answer: (q.correct_answer || 'a').toLowerCase(),
                difficulty: q.difficulty || 'medio',
                explanation: q.explanation || '',
                verse_reference: q.verse_reference || ''
            }));
            
            const { data: insertedQs, error: insError } = await supabase
                .from('questions')
                .insert(formattedQuestions)
                .select();
                
            if (insError) throw insError;
            
            questions = insertedQs.map(q => ({
                id: q.id,
                chapter_id: q.chapter_id,
                question_text: q.question_text,
                option_a: q.option_a,
                option_b: q.option_b,
                option_c: q.option_c,
                option_d: q.option_d,
                difficulty: q.difficulty
            }));
        } else {
            // FALLBACK
            let query = supabase.from('questions').select('id, chapter_id, question_text, option_a, option_b, option_c, option_d, correct_answer, explanation, verse_reference, difficulty');
            
            if (difficulty && difficulty !== 'mixto') {
                query = query.eq('difficulty', difficulty);
            }
            if (targetChapterIds.length > 0) {
                query = query.in('chapter_id', targetChapterIds);
            }
            
            const { data: dbQs, error: fallError } = await query;
            if (fallError) throw fallError;
            
            // Randomize and slice
            const shuffled = dbQs ? dbQs.sort(() => 0.5 - Math.random()) : [];
            questions = shuffled.slice(0, questionCount || 15);
        }

        const { data: configResult, error: configError } = await supabase
            .from('custom_quiz_configs')
            .insert([{
                user_id: req.user.id,
                time_limit: timeLimit,
                question_count: questionCount,
                difficulty: difficulty,
                books_selected: JSON.stringify(bookIds),
                chapters_selected: JSON.stringify(chapterIds)
            }])
            .select()
            .single();
            
        if (configError) throw configError;
        configId = configResult.id;

        res.json({ configId, questions });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno' });
    }
});

router.post('/:configId/submit', async (req, res) => {
    const { answers } = req.body;
    const configId = req.params.configId;
    const userId = req.user.id;
    
    if (!Array.isArray(answers) || answers.length === 0) {
        return res.status(400).json({ error: 'Respuestas inválidas' });
    }

    try {
        const supabase = getDb();
        let correctCount = 0;
        const results = [];

        const questionIds = answers.map(a => a.questionId);
        const { data: dbQuestions, error: qError } = await supabase
            .from('questions')
            .select('id, correct_answer, explanation, verse_reference')
            .in('id', questionIds);

        if (qError) throw qError;

        const qMap = {};
        for (let q of dbQuestions) {
            qMap[q.id] = q;
        }

        for (let ans of answers) {
            const q = qMap[ans.questionId];
            if (q) {
                const isCorrect = q.correct_answer === ans.selectedAnswer;
                if (isCorrect) correctCount++;
                results.push({
                    ...ans,
                    correctAnswer: q.correct_answer,
                    isCorrect,
                    explanation: q.explanation,
                    verseReference: q.verse_reference
                });
            }
        }

        const score = Math.round((correctCount / answers.length) * 100);

        const { data: attemptData, error: attemptError } = await supabase
            .from('custom_quiz_attempts')
            .insert([{
                config_id: configId,
                user_id: userId,
                score,
                total_questions: answers.length
            }])
            .select()
            .single();
            
        if (attemptError) throw attemptError;
        const attemptId = attemptData.id;

        const answersToInsert = results.map(res => ({
            attempt_id: attemptId,
            question_id: res.questionId,
            selected_answer: res.selectedAnswer,
            is_correct: res.isCorrect ? 1 : 0,
            time_spent_seconds: res.timeSpent || 0
        }));

        if (answersToInsert.length > 0) {
            const { error: ansError } = await supabase.from('custom_quiz_answers').insert(answersToInsert);
            if (ansError) console.error("Error guardando custom answers:", ansError);
        }

        res.json({ score, correctCount, totalQuestions: answers.length, results });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno' });
    }
});

export default router;
