import express from 'express';
import { getDb } from '../db/database.js';
import { auth } from '../middleware/auth.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import { sendPushNotification } from '../utils/pushNotifier.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Rutas de archivos JSON de respaldo local
const jsonDir = path.join(__dirname, '..', '..', 'database_export', 'json');
const questionsJsonPath = path.join(jsonDir, 'questions.json');
const usersJsonPath = path.join(jsonDir, 'users.json');
const simulacroDuelsPath = path.join(jsonDir, 'simulacro_duels.json');

// Cargar backup local de preguntas si está disponible
let cachedQuestions = [];
try {
    if (fs.existsSync(questionsJsonPath)) {
        cachedQuestions = JSON.parse(fs.readFileSync(questionsJsonPath, 'utf8'));
    }
} catch (e) {
    console.warn('[Simulacro] No se pudo precargar questions.json local:', e.message);
}

// Cargar backup local de usuarios registrados
let cachedUsers = [];
try {
    if (fs.existsSync(usersJsonPath)) {
        cachedUsers = JSON.parse(fs.readFileSync(usersJsonPath, 'utf8'));
    }
} catch (e) {
    console.warn('[Simulacro] Error leyendo users.json local:', e.message);
}

// Fallback de seguridad de preguntas bíblicas
const FALLBACK_BIBLICAL_QUESTIONS = [
    { id: 'fb_1', question_text: '¿Quién ungió a Saúl como el primer rey de Israel?', option_a: 'Samuel', option_b: 'Natán', option_c: 'Elí', option_d: 'Gad', correct_answer: 'a', explanation: 'Samuel ungió a Saúl por mandato de Jehová.', verse_reference: '1 Samuel 10:1', custom_category: 'personajes' },
    { id: 'fb_2', question_text: '¿Cómo se llamaba la madre de Samuel que oró en el tabernáculo de Silo?', option_a: 'Ana', option_b: 'Penina', option_c: 'Mical', option_d: 'Abigail', correct_answer: 'a', explanation: 'Ana oró con fervor por un hijo y concibió a Samuel.', verse_reference: '1 Samuel 1:20', custom_category: 'personajes' },
    { id: 'fb_3', question_text: '¿En qué ciudad fue coronado David por primera vez como rey sobre Judá?', option_a: 'Hebrón', option_b: 'Jerusalén', option_c: 'Belén', option_d: 'Gilgal', correct_answer: 'a', explanation: 'David fue ungido rey sobre Judá en Hebrón.', verse_reference: '2 Samuel 2:4', custom_category: 'lugares' },
    { id: 'fb_4', question_text: '¿En qué monte desafió Elías a los profetas de Baal?', option_a: 'Monte Carmelo', option_b: 'Monte Sinaí', option_c: 'Monte Hermón', option_d: 'Monte de los Olivos', correct_answer: 'a', explanation: 'Elías convocó a todo Israel al Monte Carmelo.', verse_reference: '1 Reyes 18:19', custom_category: 'lugares' },
    { id: 'fb_5', question_text: '¿Cuántos años reinó el rey David en total sobre Israel?', option_a: '40 años', option_b: '30 años', option_c: '33 años', option_d: '20 años', correct_answer: 'a', explanation: 'David reinó 7 años en Hebrón y 33 años en Jerusalén.', verse_reference: '2 Samuel 5:4', custom_category: 'cantidades' },
    { id: 'fb_6', question_text: '¿Cuántas piedras lisas recogió David del arroyo antes de enfrentar a Goliat?', option_a: '5 piedras', option_b: '3 piedras', option_c: '7 piedras', option_d: '1 piedra', correct_answer: 'a', explanation: 'David escogió cinco piedras lisas del arroyo.', verse_reference: '1 Samuel 17:40', custom_category: 'cantidades' },
    { id: 'fb_7', question_text: '¿Qué milagro ocurrió cuando Elías oró en el monte Carmelo?', option_a: 'Descendió fuego del cielo que consumió el holocausto', option_b: 'Se abrió la tierra', option_c: 'Hubo un gran terremoto', option_d: 'El sol se detuvo', correct_answer: 'a', explanation: 'Fuego de Jehová cayó y consumió el holocausto y el agua.', verse_reference: '1 Reyes 18:38', custom_category: 'eventos' },
    { id: 'fb_8', question_text: '¿Cómo subió el profeta Elías al cielo en el torbellino?', option_a: 'En un carro de fuego con caballos de fuego', option_b: 'En una nube de gloria', option_c: 'Llevado por dos ángeles', option_d: 'En un carro de oro', correct_answer: 'a', explanation: 'Un carro de fuego con caballos de fuego apartó a ambos, y Elías subió al cielo.', verse_reference: '2 Reyes 2:11', custom_category: 'eventos' }
];

async function ensureQuestionsLoaded() {
    if (cachedQuestions.length >= 20) return cachedQuestions;
    try {
        const supabase = getDb();
        const { data } = await supabase.from('questions').select('*').limit(500);
        if (data && data.length > 0) {
            cachedQuestions = data;
            return cachedQuestions;
        }
    } catch (e) {
        console.warn('[Simulacro] Error consultando preguntas de Supabase:', e.message);
    }
    if (cachedQuestions.length === 0) {
        cachedQuestions = [...FALLBACK_BIBLICAL_QUESTIONS];
    }
    return cachedQuestions;
}

// 5 Equipos oficiales de las Olimpiadas Bíblicas
const DEFAULT_TEAMS = [
    {
        id: 'codigodavid',
        name: 'CodigoDavid',
        color: '#3b82f6',
        badge: '👑',
        members: [
            'David (Capitán)', 'Moisés', 'Josué', 'Caleb', 
            'Samuel', 'Natán', 'Asaf', 'Abisai', 'Itay', 'Benaía'
        ]
    },
    {
        id: 'ebenezer',
        name: 'Ebenezer',
        color: '#10b981',
        badge: '🪨',
        members: [
            'Samuel (Capitán)', 'Elcana', 'Ana', 'Jonatán', 
            'Saúl', 'Ahimelec', 'Abiatar', 'Finees', 'Gedeón', 'Barac'
        ]
    },
    {
        id: 'los7000',
        name: 'Los 7000',
        color: '#f59e0b',
        badge: '🔥',
        members: [
            'Elías (Capitán)', 'Eliseo', 'Abdías', 'Micaías', 
            'Jehú', 'Josafat', 'Ezequías', 'Isaías', 'Hulda', 'Safán'
        ]
    },
    {
        id: 'sion',
        name: 'SION',
        color: '#8b5cf6',
        badge: '⛰️',
        members: [
            'Salomón (Capitán)', 'Zadok', 'Benaía', 'Hiram', 
            'Josías', 'Hilcías', 'Esdras', 'Nehemías', 'Zorobabel', 'Daniel'
        ]
    },
    {
        id: 'malkuth',
        name: 'MALKUTH',
        color: '#ec4899',
        badge: '🛡️',
        members: [
            'Joab (Capitán)', 'Abner', 'Amasá', 'Sama', 
            'Eleazar', 'Joseb', 'Urías', 'Barzilai', 'Mefiboset', 'Ahitofel'
        ]
    }
];

// Helper para clasificar preguntas por palabra clave en las 5 subcategorías de Fire Questions
function classifyQuestion(q) {
    if (q.custom_category) {
        return q.custom_category.toLowerCase();
    }
    const text = (q.question_text || '').toLowerCase();
    
    // 1. Cantidades (¿cuántos?, números, años, medidas)
    if (
        text.includes('cuánt') || text.includes('cuant') || text.includes('años') ||
        text.includes('días') || text.includes('meses') || text.includes('siclos') ||
        text.includes('codos') || text.includes('hombres') || text.includes('veces') ||
        text.includes('talent') || text.includes('soldad') || text.includes('edad')
    ) {
        return 'cantidades';
    }

    // 2. Lugares (ciudades, montes, valles, ríos)
    if (
        text.includes('dónde') || text.includes('donde') || text.includes('lugar') ||
        text.includes('ciudad') || text.includes('monte') || text.includes('valle') ||
        text.includes('cueva') || text.includes('río') || text.includes('jerusalén') ||
        text.includes('belén') || text.includes('hebrón') || text.includes('gilgal') ||
        text.includes('silo') || text.includes('bet-el') || text.includes('carmelo') ||
        text.includes('samaria') || text.includes('gat') || text.includes('siclag') ||
        text.includes('nob') || text.includes('en-gadi') || text.includes('jordán')
    ) {
        return 'lugares';
    }

    // 3. Eventos (sucesos, batallas, pactos, milagros, muertes, juicios, objetos en contexto)
    if (
        text.includes('batalla') || text.includes('guerra') || text.includes('murió') ||
        text.includes('mató') || text.includes('pacto') || text.includes('milagro') ||
        text.includes('sucedió') || text.includes('pasó') || text.includes('castigo') ||
        text.includes('derrotó') || text.includes('escapó') || text.includes('ungió') ||
        text.includes('oró') || text.includes('sueño') || text.includes('visión') ||
        text.includes('arca') || text.includes('altar') || text.includes('fuego') ||
        text.includes('becerro') || text.includes('espada') || text.includes('lanza') ||
        text.includes('honda') || text.includes('estatua') || text.includes('manto')
    ) {
        return 'eventos';
    }

    // 4. Personajes (por defecto o si menciona nombres propios / quién)
    return 'personajes';
}

// Banco temático para El Dado Dado (6 Caras)
const DADO_THEMES = [
    { face: 1, name: 'Reyes y Conquistadores', filter: ['rey', 'reinó', 'saúl', 'david', 'salomón', 'acab'] },
    { face: 2, name: 'Profetas de Dios', filter: ['profeta', 'samuel', 'elías', 'eliseo', 'natán', 'gad', 'jehú'] },
    { face: 3, name: 'Batallas y Estrategias', filter: ['guerra', 'ejército', 'filisteo', 'espada', 'lanza', 'goliat', 'batalla'] },
    { face: 4, name: 'Milagros y Señales', filter: ['milagro', 'fuego', 'resucitó', 'aceite', 'lepras', 'agua', 'cielo'] },
    { face: 5, name: 'Sabiduría y Ley', filter: ['sabiduría', 'juicio', 'templo', 'arca', 'mandamiento', 'libro', 'ley'] },
    { face: 6, name: 'Desafío de Oro (Pregunta Crucial)', filter: [] }
];

// Banco temático para La Ruleta (8 Sectores)
const RULETA_SECTORS = [
    { index: 1, name: '1 Samuel: El Llamado y Saúl', color: '#3b82f6' },
    { index: 2, name: '1 Samuel: David y Goliat', color: '#10b981' },
    { index: 3, name: '2 Samuel: El Reino de David', color: '#f59e0b' },
    { index: 4, name: '2 Samuel: Valientes y Victorias', color: '#8b5cf6' },
    { index: 5, name: '1 Reyes: El Templo de Salomón', color: '#ec4899' },
    { index: 6, name: '1 Reyes: Elías en el Carmelo', color: '#ef4444' },
    { index: 7, name: '2 Reyes: Eliseo y sus Milagros', color: '#06b6d4' },
    { index: 8, name: '2 Reyes: Reyes de Judá e Israel', color: '#eab308' }
];

/**
 * GET /api/simulacro/users
 * Obtener todos los usuarios registrados en la plataforma para competir individualmente
 */
router.get('/users', async (req, res) => {
    try {
        let userList = [];
        try {
            const supabase = getDb();
            const { data } = await supabase
                .from('users')
                .select('id, username, points, role')
                .order('username');
            if (data && data.length > 0) userList = data;
        } catch (e) {
            console.warn('[Simulacro] Error consultando Supabase users:', e.message);
        }

        if (userList.length === 0 && cachedUsers.length > 0) {
            userList = cachedUsers.map(u => ({
                id: u.id,
                username: u.username,
                points: typeof u.points === 'number' ? u.points : 0,
                role: u.role || 'user'
            }));
        }

        res.json({ users: userList });
    } catch (err) {
        console.error('[Simulacro] Error cargando usuarios:', err);
        res.status(500).json({ error: 'Error cargando usuarios' });
    }
});

/**
 * GET /api/simulacro/teams
 * Obtener los 5 equipos configurados
 */
router.get('/teams', (req, res) => {
    res.json({ teams: DEFAULT_TEAMS });
});

/**
 * GET /api/simulacro/questions/fire-questions/stats
 * Obtener estadísticas de conteo de preguntas por cada una de las 5 categorías de Fire Questions
 */
router.get('/questions/fire-questions/stats', async (req, res) => {
    try {
        await ensureQuestionsLoaded();

        const stats = {
            personajes: 0,
            lugares: 0,
            cantidades: 0,
            eventos: 0,
            total: cachedQuestions.length
        };

        for (const q of cachedQuestions) {
            const cat = classifyQuestion(q);
            if (stats[cat] !== undefined) {
                stats[cat]++;
            }
        }

        res.json({ stats });
    } catch (err) {
        console.error('[Simulacro] Error calculando stats:', err);
        res.status(500).json({ error: 'Error calculando estadísticas' });
    }
});

/**
 * POST /api/simulacro/questions/fire-questions/import
 * Importador de preguntas dedicado para cada apartado de Fire Questions
 * Body: { category: 'personajes'|'lugares'|'cantidades'|'eventos', questions: [...] }
 */
router.post('/questions/fire-questions/import', async (req, res) => {
    try {
        await ensureQuestionsLoaded();
        const { category, questions } = req.body;
        const validCategories = ['personajes', 'lugares', 'cantidades', 'eventos'];
        const targetCategory = (category || 'personajes').toLowerCase();

        if (!validCategories.includes(targetCategory)) {
            return res.status(400).json({ error: 'Categoría no válida. Debe ser: personajes, lugares, cantidades o eventos.' });
        }

        if (!Array.isArray(questions) || questions.length === 0) {
            return res.status(400).json({ error: 'La lista de preguntas está vacía o tiene formato incorrecto.' });
        }

        const newQuestions = [];
        const timestamp = Date.now();

        questions.forEach((q, idx) => {
            if (!q.question_text || !q.option_a || !q.option_b) return;

            const formatted = {
                id: `fq_imp_${timestamp}_${idx}_${Math.random().toString(36).substr(2, 5)}`,
                chapter_id: q.chapter_id || 1,
                question_text: q.question_text.trim(),
                option_a: q.option_a.trim(),
                option_b: q.option_b.trim(),
                option_c: (q.option_c || '').trim() || 'Ninguna de las anteriores',
                option_d: (q.option_d || '').trim() || 'Todas las anteriores',
                correct_answer: (q.correct_answer || 'a').toLowerCase().trim(),
                explanation: (q.explanation || 'Respuesta bíblica oficial NTV.').trim(),
                verse_reference: (q.verse_reference || '').trim(),
                custom_category: targetCategory,
                created_at: new Date().toISOString()
            };
            newQuestions.push(formatted);
        });

        if (newQuestions.length === 0) {
            return res.status(400).json({ error: 'No se pudieron procesar las preguntas. Verifica el formato.' });
        }

        // Agregar al pool en memoria
        cachedQuestions.push(...newQuestions);

        // Intentar guardar persistentemente en Supabase si está disponible
        try {
            const supabase = getDb();
            const rowsToInsert = newQuestions.map(q => ({
                chapter_id: q.chapter_id || 1,
                question_text: q.question_text,
                option_a: q.option_a,
                option_b: q.option_b,
                option_c: q.option_c,
                option_d: q.option_d,
                correct_answer: q.correct_answer,
                explanation: q.explanation,
                verse_reference: q.verse_reference
            }));
            await supabase.from('questions').insert(rowsToInsert);
        } catch (supaErr) {
            console.warn('[Simulacro] Nota: no se persistió en Supabase:', supaErr.message);
        }

        // Guardar persistentemente en questions.json (si el sistema de archivos lo permite)
        try {
            if (fs.existsSync(questionsJsonPath)) {
                fs.writeFileSync(questionsJsonPath, JSON.stringify(cachedQuestions, null, 2), 'utf8');
            }
        } catch (saveErr) {
            // Silencioso en entornos serverless de solo lectura como Netlify
        }

        // Contar el nuevo total en esta categoría
        const countInCat = cachedQuestions.filter(q => classifyQuestion(q) === targetCategory).length;

        res.json({
            success: true,
            importedCount: newQuestions.length,
            category: targetCategory,
            totalInCategory: countInCat,
            message: `¡Se importaron ${newQuestions.length} preguntas correctamente a la categoría ${targetCategory}!`
        });
    } catch (err) {
        console.error('[Simulacro] Error importando preguntas:', err);
        res.status(500).json({ error: 'Error al importar las preguntas.' });
    }
});

/**
 * GET /api/simulacro/questions/fire-questions
 * Obtener preguntas filtradas por la subcategoría de Fire Questions
 */
router.get('/questions/fire-questions', async (req, res) => {
    try {
        await ensureQuestionsLoaded();
        const targetCategory = (req.query.category || 'personajes').toLowerCase();
        const count = parseInt(req.query.count || '40', 10);

        let questionsPool = [];

        // 1. Filtrar desde preguntas locales cacheadas
        if (cachedQuestions.length > 0) {
            questionsPool = cachedQuestions.filter(q => classifyQuestion(q) === targetCategory);
        }

        // 2. Si aún faltan, usar todas mezcladas
        if (questionsPool.length === 0) {
            questionsPool = cachedQuestions.length > 0 ? cachedQuestions : [...FALLBACK_BIBLICAL_QUESTIONS];
        }

        // Mezclar aleatoriamente
        const shuffled = questionsPool.sort(() => 0.5 - Math.random()).slice(0, count);

        const formatted = shuffled.map((q, idx) => ({
            id: q.id || `fq_${idx}`,
            question_text: q.question_text,
            option_a: q.option_a,
            option_b: q.option_b,
            option_c: q.option_c,
            option_d: q.option_d,
            correct_answer: (q.correct_answer || 'a').toLowerCase(),
            explanation: q.explanation || 'Respuesta bíblica oficial NTV.',
            verse_reference: q.verse_reference || '',
            category: targetCategory,
            time_limit_seconds: 90
        }));

        res.json({ category: targetCategory, count: formatted.length, questions: formatted });
    } catch (err) {
        console.error('[Simulacro] Error en fire-questions:', err);
        res.status(500).json({ error: 'Error cargando preguntas de Fire Questions' });
    }
});

/**
 * GET /api/simulacro/questions/david-goliat/import-from-fire
 * Importador de preguntas para David contra Goliat:
 * Importa 20 preguntas aleatorias y equilibradas tomadas directamente de los 4 apartados de Fire Questions
 */
router.get('/questions/david-goliat/import-from-fire', async (req, res) => {
    try {
        await ensureQuestionsLoaded();
        const categories = ['personajes', 'lugares', 'cantidades', 'eventos'];
        const selected = [];

        // Tomar 5 preguntas de cada una de las 4 categorías para completar 20 preguntas perfectamente equilibradas
        categories.forEach(cat => {
            const catPool = cachedQuestions.filter(q => classifyQuestion(q) === cat);
            const shuffled = catPool.sort(() => 0.5 - Math.random());
            const picked = shuffled.slice(0, 5);
            selected.push(...picked);
        });

        // Si faltan para llegar a 20, rellenar del pool general
        if (selected.length < 20) {
            const remainingCount = 20 - selected.length;
            const extra = cachedQuestions
                .filter(q => !selected.some(s => s.id === q.id))
                .sort(() => 0.5 - Math.random())
                .slice(0, remainingCount);
            selected.push(...extra);
        }

        // Mezclar las 20 preguntas finales
        const final20 = selected.sort(() => 0.5 - Math.random()).slice(0, 20);

        const formatted = final20.map((q, idx) => ({
            id: q.id || `dg_imp_${idx}`,
            question_number: idx + 1,
            question_text: q.question_text,
            option_a: q.option_a,
            option_b: q.option_b,
            option_c: q.option_c,
            option_d: q.option_d,
            correct_answer: (q.correct_answer || 'a').toLowerCase(),
            explanation: q.explanation || 'Respuesta bíblica oficial NTV.',
            verse_reference: q.verse_reference || '',
            source_category: classifyQuestion(q),
            points: 10
        }));

        res.json({
            count: formatted.length,
            questions: formatted,
            message: '20 preguntas equilibradas importadas exitosamente desde Fire Questions.'
        });
    } catch (err) {
        console.error('[Simulacro] Error importando desde fire para david-goliat:', err);
        res.status(500).json({ error: 'Error importando preguntas desde Fire Questions' });
    }
});

/**
 * GET /api/simulacro/questions/david-goliat
 * 20 preguntas seleccionadas para enfrentamiento con buzzer
 */
router.get('/questions/david-goliat', async (req, res) => {
    try {
        const count = 20;
        let pool = cachedQuestions.length > 0 ? cachedQuestions : [];

        if (pool.length === 0) {
            try {
                const supabase = getDb();
                const { data } = await supabase.from('questions').select('*').limit(100);
                pool = data || [];
            } catch (e) {}
        }

        const shuffled = pool.sort(() => 0.5 - Math.random()).slice(0, count);

        const formatted = shuffled.map((q, idx) => ({
            id: q.id || `dg_${idx}`,
            question_number: idx + 1,
            question_text: q.question_text,
            option_a: q.option_a,
            option_b: q.option_b,
            option_c: q.option_c,
            option_d: q.option_d,
            correct_answer: (q.correct_answer || 'a').toLowerCase(),
            explanation: q.explanation || 'Respuesta bíblica oficial NTV.',
            verse_reference: q.verse_reference || '',
            points: 10
        }));

        res.json({ count: formatted.length, questions: formatted });
    } catch (err) {
        console.error('[Simulacro] Error en david-goliat:', err);
        res.status(500).json({ error: 'Error cargando preguntas de David contra Goliat' });
    }
});

/**
 * GET /api/simulacro/questions/dado
 * Pregunta específica determinada por la cara del dado (1-6)
 */
router.get('/questions/dado', async (req, res) => {
    try {
        const face = parseInt(req.query.face || '1', 10);
        const theme = DADO_THEMES.find(t => t.face === face) || DADO_THEMES[0];

        let pool = cachedQuestions.length > 0 ? cachedQuestions : [];
        if (pool.length === 0) {
            try {
                const supabase = getDb();
                const { data } = await supabase.from('questions').select('*').limit(100);
                pool = data || [];
            } catch (e) {}
        }

        let filtered = pool;
        if (theme.filter.length > 0) {
            filtered = pool.filter(q => {
                const text = (q.question_text || '').toLowerCase();
                return theme.filter.some(k => text.includes(k));
            });
        }

        if (filtered.length === 0) filtered = pool;

        const picked = filtered[Math.floor(Math.random() * filtered.length)] || pool[0];

        res.json({
            face,
            themeName: theme.name,
            question: {
                id: picked.id,
                question_text: picked.question_text,
                option_a: picked.option_a,
                option_b: picked.option_b,
                option_c: picked.option_c,
                option_d: picked.option_d,
                correct_answer: (picked.correct_answer || 'a').toLowerCase(),
                explanation: picked.explanation || 'Respuesta bíblica NTV.',
                verse_reference: picked.verse_reference || '',
                time_limit_seconds: 30,
                points: 10
            }
        });
    } catch (err) {
        console.error('[Simulacro] Error en dado:', err);
        res.status(500).json({ error: 'Error cargando pregunta de El Dado Dado' });
    }
});

/**
 * GET /api/simulacro/questions/ruleta
 * Pregunta específica determinada por el sector de la ruleta (1-8)
 */
router.get('/questions/ruleta', async (req, res) => {
    try {
        const sectorIdx = parseInt(req.query.sector || '1', 10);
        const sector = RULETA_SECTORS.find(s => s.index === sectorIdx) || RULETA_SECTORS[0];

        let pool = cachedQuestions.length > 0 ? cachedQuestions : [];
        if (pool.length === 0) {
            try {
                const supabase = getDb();
                const { data } = await supabase.from('questions').select('*').limit(100);
                pool = data || [];
            } catch (e) {}
        }

        let filtered = pool;
        if (sectorIdx <= 2) {
            filtered = pool.filter(q => (q.verse_reference || '').toLowerCase().includes('1 samuel') || (q.chapter_id && q.chapter_id <= 31));
        } else if (sectorIdx <= 4) {
            filtered = pool.filter(q => (q.verse_reference || '').toLowerCase().includes('2 samuel') || (q.chapter_id && q.chapter_id > 31 && q.chapter_id <= 55));
        } else if (sectorIdx <= 6) {
            filtered = pool.filter(q => (q.verse_reference || '').toLowerCase().includes('1 reyes') || (q.chapter_id && q.chapter_id > 55 && q.chapter_id <= 77));
        } else {
            filtered = pool.filter(q => (q.verse_reference || '').toLowerCase().includes('2 reyes') || (q.chapter_id && q.chapter_id > 77));
        }

        if (filtered.length === 0) filtered = pool;
        const picked = filtered[Math.floor(Math.random() * filtered.length)] || pool[0];

        res.json({
            sectorIndex: sectorIdx,
            sectorName: sector.name,
            question: {
                id: picked.id,
                question_text: picked.question_text,
                option_a: picked.option_a,
                option_b: picked.option_b,
                option_c: picked.option_c,
                option_d: picked.option_d,
                correct_answer: (picked.correct_answer || 'a').toLowerCase(),
                explanation: picked.explanation || 'Respuesta bíblica NTV.',
                verse_reference: picked.verse_reference || '',
                time_limit_seconds: 30,
                points: 10
            }
        });
    } catch (err) {
        console.error('[Simulacro] Error en ruleta:', err);
        res.status(500).json({ error: 'Error cargando pregunta de La Ruleta' });
    }
});

// ==============================================================================
// SISTEMA OFICIAL DE DESAFÍOS Y ENFRENTAMIENTOS (DAVID CONTRA GOLIAT)
// Implementa el flujo idéntico al módulo de Duelos de la plataforma:
// Solicitud -> Notificación Push/In-App -> Aceptar/Rechazar/Cancelar -> Arena 20 Qs
// ==============================================================================

// Helper para extraer usuario autenticado desde token JWT o sesión
function getUserFromReq(req) {
    if (req.user) return req.user;
    const authHeader = req.headers['authorization'];
    if (authHeader) {
        const token = authHeader.split(' ')[1];
        if (token) {
            try {
                return jwt.verify(token, 'remanente_jwt_secret_2024');
            } catch (e) {}
        }
    }
    return null;
}

// Almacenamiento en memoria resiliente para serverless/Netlify
let memoryDuels = [];

// Cargar almacenamiento persistente de desafíos de David contra Goliat
function loadSimulacroDuels() {
    if (memoryDuels.length > 0) return memoryDuels;
    try {
        if (fs.existsSync(simulacroDuelsPath)) {
            const data = JSON.parse(fs.readFileSync(simulacroDuelsPath, 'utf8'));
            if (Array.isArray(data)) {
                memoryDuels = data;
                return memoryDuels;
            }
        }
    } catch (e) {
        console.warn('[Simulacro] Error leyendo simulacro_duels.json:', e.message);
    }
    return memoryDuels;
}

// Guardar almacenamiento persistente de desafíos
function saveSimulacroDuels(duelsList) {
    memoryDuels = duelsList;
    try {
        if (fs.existsSync(path.dirname(simulacroDuelsPath))) {
            fs.writeFileSync(simulacroDuelsPath, JSON.stringify(duelsList, null, 2), 'utf8');
        }
    } catch (e) {
        // En Netlify / Serverless el sistema de archivos es de solo lectura, por lo que se mantiene en memoria
    }
}

// Generador de 20 preguntas equilibradas (5 de cada categoría de Fire Questions)
function generate20BalancedQuestions() {
    const categories = ['personajes', 'lugares', 'cantidades', 'eventos'];
    const selected = [];
    const pool = cachedQuestions.length > 0 ? cachedQuestions : FALLBACK_BIBLICAL_QUESTIONS;

    categories.forEach(cat => {
        const catPool = pool.filter(q => classifyQuestion(q) === cat);
        const shuffled = catPool.sort(() => 0.5 - Math.random());
        selected.push(...shuffled.slice(0, 5));
    });

    if (selected.length < 20) {
        const remaining = 20 - selected.length;
        const extra = pool
            .filter(q => !selected.some(s => s.id === q.id))
            .sort(() => 0.5 - Math.random())
            .slice(0, remaining);
        selected.push(...extra);
    }

    // Si aún no alcanza 20 porque el pool es pequeño, duplicar con ids únicos
    while (selected.length < 20 && selected.length > 0) {
        const item = selected[Math.floor(Math.random() * selected.length)];
        selected.push({ ...item, id: `${item.id}_${Math.random().toString(36).substr(2, 4)}` });
    }

    return selected.sort(() => 0.5 - Math.random()).slice(0, 20).map((q, idx) => ({
        id: q.id || `dg_imp_${idx}`,
        question_number: idx + 1,
        question_text: q.question_text,
        option_a: q.option_a,
        option_b: q.option_b,
        option_c: q.option_c,
        option_d: q.option_d,
        correct_answer: (q.correct_answer || 'a').toLowerCase(),
        explanation: q.explanation || 'Respuesta bíblica oficial NTV.',
        verse_reference: q.verse_reference || '',
        source_category: classifyQuestion(q),
        points: 10
    }));
}

/**
 * GET /api/simulacro/duels/users
 * Obtener usuarios registrados a los que puedes retar en David contra Goliat
 */
router.get('/duels/users', async (req, res) => {
    try {
        const currentUser = getUserFromReq(req);
        let userList = [];

        try {
            const supabase = getDb();
            const { data } = await supabase
                .from('users')
                .select('id, username, points, role, groups(name)')
                .order('username');
            if (data && data.length > 0) userList = data;
        } catch (e) {}

        if (userList.length === 0 && cachedUsers.length > 0) {
            userList = cachedUsers;
        }

        const filtered = userList.filter(u => {
            if (!currentUser) return true;
            return String(u.id) !== String(currentUser.id);
        }).map(u => ({
            id: u.id,
            username: u.username,
            points: typeof u.points === 'number' ? u.points : 0,
            groupName: u.groups?.name || 'Comunidad',
            badge: (typeof u.points === 'number' && u.points > 2000) ? '👑' : '⚔️'
        }));

        res.json(filtered);
    } catch (err) {
        console.error('[Simulacro] Error cargando usuarios para retar:', err);
        res.status(500).json({ error: 'Error cargando usuarios' });
    }
});

/**
 * GET /api/simulacro/duels
 * Obtener tus solicitudes de enfrentamiento (recibidas, enviadas, aceptadas y completadas)
 */
router.get('/duels', async (req, res) => {
    try {
        const currentUser = getUserFromReq(req);
        const currentUserId = currentUser ? String(currentUser.id) : null;
        let allDuels = loadSimulacroDuels();

        // Auto-limpieza de duelos completados hace más de 7 días
        const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        const cleanedDuels = allDuels.filter(d => {
            if (d.status === 'completed' && d.created_at_ms && d.created_at_ms < oneWeekAgo) {
                return false;
            }
            return true;
        });
        if (cleanedDuels.length !== allDuels.length) {
            allDuels = cleanedDuels;
            saveSimulacroDuels(allDuels);
        }

        // Si hay usuario autenticado, filtrar duelos relacionados
        const userDuels = currentUserId
            ? allDuels.filter(d => String(d.challenger_id) === currentUserId || String(d.opponent_id) === currentUserId)
            : allDuels;

        res.json(userDuels);
    } catch (err) {
        console.error('[Simulacro] Error cargando duelos:', err);
        res.status(500).json({ error: 'Error cargando duelos' });
    }
});

/**
 * POST /api/simulacro/duels/challenge
 * Retar a un usuario a un enfrentamiento oficial de David contra Goliat
 * Body: { opponent_id, wager, message }
 */
router.post('/duels/challenge', async (req, res) => {
    try {
        const currentUser = getUserFromReq(req);
        const { opponent_id, wager = 0, message = '' } = req.body;

        const challengerId = currentUser ? currentUser.id : req.body.challenger_id;
        if (!challengerId || !opponent_id) {
            return res.status(400).json({ error: 'Debes especificar retador y oponente.' });
        }

        if (String(challengerId) === String(opponent_id)) {
            return res.status(400).json({ error: 'No puedes retarte a ti mismo.' });
        }

        const wagerNum = Math.max(0, parseInt(wager, 10) || 0);

        // Buscar datos de retador y oponente
        let challengerUser = currentUser || null;
        let opponentUser = null;

        try {
            const supabase = getDb();
            if (!challengerUser) {
                const { data: cData } = await supabase.from('users').select('id, username, points').eq('id', challengerId).single();
                challengerUser = cData;
            }
            const { data: oData } = await supabase.from('users').select('id, username, points').eq('id', opponent_id).single();
            opponentUser = oData;
        } catch (e) {}

        if (!challengerUser && cachedUsers.length > 0) {
            challengerUser = cachedUsers.find(u => String(u.id) === String(challengerId));
        }
        if (!opponentUser && cachedUsers.length > 0) {
            opponentUser = cachedUsers.find(u => String(u.id) === String(opponent_id));
        }

        if (!opponentUser) {
            return res.status(404).json({ error: 'El oponente especificado no existe.' });
        }

        const challengerPoints = typeof challengerUser?.points === 'number' ? challengerUser.points : 0;
        if (wagerNum > challengerPoints) {
            return res.status(400).json({ error: `No tienes suficientes puntos para esta apuesta (Saldo: ${challengerPoints} pts).` });
        }

        // Descontar puntos de la apuesta al retador
        if (wagerNum > 0) {
            try {
                const supabase = getDb();
                await supabase.from('users').update({ points: challengerPoints - wagerNum }).eq('id', challengerId);
            } catch (e) {}
            if (challengerUser) challengerUser.points = challengerPoints - wagerNum;
        }

        // Generar las 20 preguntas oficiales de David contra Goliat
        const questions20 = generate20BalancedQuestions();

        const matchId = `dg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const newDuel = {
            id: matchId,
            type: 'david_goliat',
            challenger_id: challengerId,
            challenger: {
                id: challengerId,
                username: challengerUser?.username || 'Retador',
                points: challengerPoints - wagerNum,
                badge: '⚔️'
            },
            opponent_id: opponent_id,
            opponent: {
                id: opponent_id,
                username: opponentUser?.username || 'Oponente',
                points: typeof opponentUser?.points === 'number' ? opponentUser.points : 0,
                badge: '🛡️'
            },
            wager: wagerNum,
            message: message.trim() || '¡Te desafío en David contra Goliat!',
            status: 'pending_acceptance', // pending_acceptance -> accepted -> completed / rejected
            questions: questions20,
            challenger_score: 0,
            opponent_score: 0,
            winner_id: null,
            created_at: new Date().toISOString(),
            created_at_ms: Date.now()
        };

        const allDuels = loadSimulacroDuels();
        allDuels.unshift(newDuel);
        saveSimulacroDuels(allDuels);

        // Notificaciones al oponente (in-app y push)
        try {
            const supabase = getDb();
            await supabase.from('notifications').insert([{
                user_id: opponent_id,
                title: '⚔️ ¡Nuevo Desafío: David contra Goliat!',
                message: `${challengerUser?.username || 'Un hermano'} te ha retado por ${wagerNum} pts en David contra Goliat.`,
                link: '/simulacro'
            }]);
        } catch (e) {}

        sendPushNotification(opponent_id, {
            title: '⚔️ ¡Nuevo Desafío: David contra Goliat!',
            body: `${challengerUser?.username || 'Un hermano'} te desafió a un duelo de 20 preguntas por ${wagerNum} pts. ¿Aceptas el reto?`,
            url: '/simulacro'
        }).catch(err => console.error('[Push] Error notificando reto:', err.message));

        // Notificar en tiempo real por Socket.io
        if (req.app.get('io')) {
            req.app.get('io').emit('simulacro:challenge-update');
            req.app.get('io').emit('duels-update');
            req.app.get('io').emit('leaderboard-update');
        }

        res.json(newDuel);
    } catch (err) {
        console.error('[Simulacro] Error creando reto:', err);
        res.status(500).json({ error: 'Error enviando el reto' });
    }
});

/**
 * POST /api/simulacro/duels/:id/accept
 * Aceptar solicitud de enfrentamiento
 */
router.post('/duels/:id/accept', async (req, res) => {
    try {
        const currentUser = getUserFromReq(req);
        const duelId = req.params.id;
        const allDuels = loadSimulacroDuels();
        const duel = allDuels.find(d => d.id === duelId);

        if (!duel) {
            return res.status(404).json({ error: 'Enfrentamiento no encontrado' });
        }

        if (duel.status !== 'pending_acceptance') {
            return res.status(400).json({ error: 'Este enfrentamiento ya no está pendiente de aceptación' });
        }

        // Verificar puntos del oponente para la apuesta
        if (duel.wager > 0) {
            let oppUser = null;
            try {
                const supabase = getDb();
                const { data } = await supabase.from('users').select('id, points').eq('id', duel.opponent_id).single();
                oppUser = data;
            } catch (e) {}

            const oppPts = typeof oppUser?.points === 'number' ? oppUser.points : (duel.opponent?.points || 0);
            if (oppPts < duel.wager) {
                return res.status(400).json({ error: 'No tienes suficientes puntos para aceptar esta apuesta.' });
            }

            // Descontar puntos de apuesta al oponente
            try {
                const supabase = getDb();
                await supabase.from('users').update({ points: oppPts - duel.wager }).eq('id', duel.opponent_id);
            } catch (e) {}
            if (duel.opponent) duel.opponent.points = oppPts - duel.wager;
        }

        duel.status = 'accepted';
        duel.accepted_at = new Date().toISOString();
        saveSimulacroDuels(allDuels);

        // Notificar al retador
        try {
            const supabase = getDb();
            await supabase.from('notifications').insert([{
                user_id: duel.challenger_id,
                title: '⚔️ ¡Desafío Aceptado!',
                message: `${duel.opponent?.username || 'Tu oponente'} aceptó tu reto de David contra Goliat. ¡Entren a competir!`,
                link: '/simulacro'
            }]);
        } catch (e) {}

        sendPushNotification(duel.challenger_id, {
            title: '⚔️ ¡Desafío Aceptado!',
            body: `${duel.opponent?.username || 'Tu oponente'} aceptó tu reto de ${duel.wager} pts. ¡Que comience el duelo en la Arena!`,
            url: '/simulacro'
        }).catch(err => console.error('[Push] Error accept notif:', err.message));

        if (req.app.get('io')) {
            req.app.get('io').emit('simulacro:challenge-update');
            req.app.get('io').emit('duels-update');
            req.app.get('io').emit('leaderboard-update');
        }

        res.json({ message: 'Enfrentamiento aceptado con éxito', duel });
    } catch (err) {
        console.error('[Simulacro] Error aceptando reto:', err);
        res.status(500).json({ error: 'Error al aceptar el enfrentamiento' });
    }
});

/**
 * POST /api/simulacro/duels/:id/reject
 * Rechazar solicitud de enfrentamiento (devuelve puntos al retador)
 */
router.post('/duels/:id/reject', async (req, res) => {
    try {
        const duelId = req.params.id;
        const allDuels = loadSimulacroDuels();
        const duel = allDuels.find(d => d.id === duelId);

        if (!duel) {
            return res.status(404).json({ error: 'Enfrentamiento no encontrado' });
        }

        if (duel.status !== 'pending_acceptance') {
            return res.status(400).json({ error: 'Este enfrentamiento no está pendiente' });
        }

        // Reembolsar apuesta al retador
        if (duel.wager > 0) {
            try {
                const supabase = getDb();
                const { data: cUser } = await supabase.from('users').select('points').eq('id', duel.challenger_id).single();
                if (cUser) {
                    const curPts = typeof cUser.points === 'number' ? cUser.points : 0;
                    await supabase.from('users').update({ points: curPts + duel.wager }).eq('id', duel.challenger_id);
                }
            } catch (e) {}
        }

        duel.status = 'rejected';
        saveSimulacroDuels(allDuels);

        // Notificar al retador
        try {
            const supabase = getDb();
            await supabase.from('notifications').insert([{
                user_id: duel.challenger_id,
                title: '🛡️ Reto Rechazado',
                message: `Tu reto a ${duel.opponent?.username || 'tu oponente'} fue rechazado. Se te han devuelto tus ${duel.wager} pts.`,
                link: '/simulacro'
            }]);
        } catch (e) {}

        sendPushNotification(duel.challenger_id, {
            title: '🛡️ Reto Rechazado',
            body: `Tu reto fue rechazado. Se te han devuelto tus ${duel.wager} puntos a tu saldo.`,
            url: '/simulacro'
        }).catch(err => console.error('[Push] Error reject notif:', err.message));

        if (req.app.get('io')) {
            req.app.get('io').emit('simulacro:challenge-update');
            req.app.get('io').emit('duels-update');
            req.app.get('io').emit('leaderboard-update');
        }

        res.json({ message: 'Enfrentamiento rechazado y puntos reembolsados' });
    } catch (err) {
        console.error('[Simulacro] Error rechazando reto:', err);
        res.status(500).json({ error: 'Error al rechazar el enfrentamiento' });
    }
});

/**
 * POST /api/simulacro/duels/:id/cancel
 * Cancelar solicitud enviada (reembolsa inmediatamente la apuesta al retador)
 */
router.post('/duels/:id/cancel', async (req, res) => {
    try {
        const duelId = req.params.id;
        let allDuels = loadSimulacroDuels();
        const duel = allDuels.find(d => d.id === duelId);

        if (!duel) {
            return res.status(404).json({ error: 'Enfrentamiento no encontrado' });
        }

        if (duel.status !== 'pending_acceptance') {
            return res.status(400).json({ error: 'Solo se pueden cancelar retos pendientes de aceptación' });
        }

        // Reembolsar puntos al retador
        if (duel.wager > 0) {
            try {
                const supabase = getDb();
                const { data: cUser } = await supabase.from('users').select('points').eq('id', duel.challenger_id).single();
                if (cUser) {
                    const curPts = typeof cUser.points === 'number' ? cUser.points : 0;
                    await supabase.from('users').update({ points: curPts + duel.wager }).eq('id', duel.challenger_id);
                }
            } catch (e) {}
        }

        // Eliminar el reto cancelado
        allDuels = allDuels.filter(d => d.id !== duelId);
        saveSimulacroDuels(allDuels);

        if (req.app.get('io')) {
            req.app.get('io').emit('simulacro:challenge-update');
            req.app.get('io').emit('duels-update');
            req.app.get('io').emit('leaderboard-update');
        }

        res.json({ message: 'Reto cancelado exitosamente y puntos devueltos' });
    } catch (err) {
        console.error('[Simulacro] Error cancelando reto:', err);
        res.status(500).json({ error: 'Error al cancelar el reto' });
    }
});

/**
 * DELETE /api/simulacro/duels/:id
 * Descartar reto completado o rechazado de la vista
 */
router.delete('/duels/:id', (req, res) => {
    try {
        const duelId = req.params.id;
        let allDuels = loadSimulacroDuels();
        allDuels = allDuels.filter(d => d.id !== duelId);
        saveSimulacroDuels(allDuels);

        if (req.app.get('io')) {
            req.app.get('io').emit('simulacro:challenge-update');
        }

        res.json({ message: 'Enfrentamiento eliminado' });
    } catch (err) {
        res.status(500).json({ error: 'Error descartando enfrentamiento' });
    }
});

/**
 * GET /api/simulacro/duels/:id/play
 * Obtener datos y preguntas del enfrentamiento para jugar en la Arena
 */
router.get('/duels/:id/play', (req, res) => {
    try {
        const duelId = req.params.id;
        const allDuels = loadSimulacroDuels();
        const duel = allDuels.find(d => d.id === duelId);

        if (!duel) {
            return res.status(404).json({ error: 'Enfrentamiento no encontrado' });
        }

        // Si aún no tiene preguntas o son menos de 20, generarlas
        if (!duel.questions || duel.questions.length < 20) {
            duel.questions = generate20BalancedQuestions();
            saveSimulacroDuels(allDuels);
        }

        res.json({ duel, questions: duel.questions });
    } catch (err) {
        res.status(500).json({ error: 'Error cargando datos del enfrentamiento' });
    }
});

/**
 * POST /api/simulacro/duels/:id/submit
 * Registrar resultados de David contra Goliat, proclamar ganador y liquidar apuestas
 * Body: { player1_score, player2_score, winner_id }
 */
router.post('/duels/:id/submit', async (req, res) => {
    try {
        const duelId = req.params.id;
        const { player1_score = 0, player2_score = 0, winner_id = null } = req.body;
        const allDuels = loadSimulacroDuels();
        const duel = allDuels.find(d => d.id === duelId);

        if (!duel) {
            return res.status(404).json({ error: 'Enfrentamiento no encontrado' });
        }

        duel.challenger_score = parseInt(player1_score, 10) || 0;
        duel.opponent_score = parseInt(player2_score, 10) || 0;
        duel.status = 'completed';
        duel.completed_at = new Date().toISOString();

        // Determinar ganador
        let effectiveWinnerId = winner_id;
        if (!effectiveWinnerId) {
            if (duel.challenger_score > duel.opponent_score) {
                effectiveWinnerId = duel.challenger_id;
            } else if (duel.opponent_score > duel.challenger_score) {
                effectiveWinnerId = duel.opponent_id;
            }
        }
        duel.winner_id = effectiveWinnerId;

        // Liquidar apuesta de puntos
        const wager = duel.wager || 0;
        if (wager > 0) {
            try {
                const supabase = getDb();
                if (effectiveWinnerId) {
                    // El ganador se lleva el doble de la apuesta (su apuesta + la del rival)
                    const { data: wUser } = await supabase.from('users').select('points').eq('id', effectiveWinnerId).single();
                    if (wUser) {
                        const curPts = typeof wUser.points === 'number' ? wUser.points : 0;
                        await supabase.from('users').update({ points: curPts + (wager * 2) }).eq('id', effectiveWinnerId);
                    }
                } else {
                    // Empate: devolver apuesta a ambos
                    const { data: cUser } = await supabase.from('users').select('points').eq('id', duel.challenger_id).single();
                    if (cUser) {
                        const curPts = typeof cUser.points === 'number' ? cUser.points : 0;
                        await supabase.from('users').update({ points: curPts + wager }).eq('id', duel.challenger_id);
                    }
                    const { data: oUser } = await supabase.from('users').select('points').eq('id', duel.opponent_id).single();
                    if (oUser) {
                        const curPts = typeof oUser.points === 'number' ? oUser.points : 0;
                        await supabase.from('users').update({ points: curPts + wager }).eq('id', duel.opponent_id);
                    }
                }
            } catch (e) {
                console.warn('[Simulacro] Error actualizando puntos en Supabase:', e.message);
            }
        }

        saveSimulacroDuels(allDuels);

        // Notificaciones finales (in-app y push)
        if (effectiveWinnerId) {
            const loserId = String(effectiveWinnerId) === String(duel.challenger_id) ? duel.opponent_id : duel.challenger_id;
            
            sendPushNotification(effectiveWinnerId, {
                title: '🏆 ¡Victoria en David contra Goliat!',
                body: `¡Felicidades! Has ganado el enfrentamiento y te llevas ${wager * 2} puntos.`,
                url: '/simulacro'
            }).catch(() => {});

            sendPushNotification(loserId, {
                title: '⚔️ Enfrentamiento Finalizado',
                body: `Tu oponente ganó el enfrentamiento de David contra Goliat. ¡Prepárate para la revancha!`,
                url: '/simulacro'
            }).catch(() => {});
        } else {
            sendPushNotification(duel.challenger_id, {
                title: '🤝 ¡Empate en David contra Goliat!',
                body: `El enfrentamiento concluyó en empate. Se han reembolsado tus ${wager} puntos.`,
                url: '/simulacro'
            }).catch(() => {});
            sendPushNotification(duel.opponent_id, {
                title: '🤝 ¡Empate en David contra Goliat!',
                body: `El enfrentamiento concluyó en empate. Se han reembolsado tus ${wager} puntos.`,
                url: '/simulacro'
            }).catch(() => {});
        }

        if (req.app.get('io')) {
            req.app.get('io').emit('simulacro:challenge-update');
            req.app.get('io').emit('duels-update');
            req.app.get('io').emit('leaderboard-update');
        }

        res.json({ message: 'Resultados guardados y apuestas liquidadas exitosamente', duel });
    } catch (err) {
        console.error('[Simulacro] Error enviando resultados:', err);
        res.status(500).json({ error: 'Error guardando resultados del enfrentamiento' });
    }
});

// Almacenamiento en memoria para sesiones activas de simulacro
const activeSimulacroSessions = new Map();

router.post('/session/save', (req, res) => {
    try {
        const { sessionId, state } = req.body;
        const id = sessionId || `sim_${Date.now()}`;
        activeSimulacroSessions.set(id, {
            ...state,
            id,
            updatedAt: Date.now()
        });
        res.json({ success: true, sessionId: id });
    } catch (err) {
        res.status(500).json({ error: 'Error guardando sesión' });
    }
});

router.get('/session/:id', (req, res) => {
    const session = activeSimulacroSessions.get(req.params.id);
    if (!session) {
        return res.status(404).json({ error: 'Sesión no encontrada' });
    }
    res.json({ session });
});

export default router;
export { DADO_THEMES, RULETA_SECTORS, DEFAULT_TEAMS, classifyQuestion };
