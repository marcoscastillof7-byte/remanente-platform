import express from 'express';
import { getDb } from '../db/database.js';
import { auth } from '../middleware/auth.js';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import { sendPushNotification } from '../utils/pushNotifier.js';

const router = express.Router();

// Rutas de archivos JSON de respaldo local (seguras para entornos Serverless y ESM/CJS)
let questionsJsonPath = '';
let usersJsonPath = '';
let simulacroDuelsPath = '';
let simulacroBankJsonPath = '';

try {
    const baseDir = typeof __dirname !== 'undefined' ? __dirname : process.cwd();
    const jsonDir = path.join(baseDir, 'database_export', 'json');
    questionsJsonPath = path.join(jsonDir, 'questions.json');
    usersJsonPath = path.join(jsonDir, 'users.json');
    simulacroDuelsPath = path.join(jsonDir, 'simulacro_duels.json');
    simulacroBankJsonPath = path.join(jsonDir, 'simulacro_bank.json');
} catch (e) {
    // Silencioso en entornos serverless
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

// ============================================================================
// ARQUITECTURA DE CIENCIA DE DATOS: BANCO INDEPENDIENTE DESVINCULADO DE SIMULACRO
// Particionamiento estratificado por clase: Personajes, Lugares, Cantidades, Eventos
// ============================================================================

const INITIAL_SEEDED_SIMULACRO_BANK = [
    // 👤 CLASE 1: PERSONAJES (8 preguntas verificadas)
    { id: 'sb_p1', class_id: 'personajes', category: 'personajes', question_text: '¿Quién ungió a Saúl como el primer rey de Israel?', option_a: 'Samuel', option_b: 'Natán', option_c: 'Elí', option_d: 'Gad', correct_answer: 'a', explanation: 'Samuel ungió a Saúl por mandato expreso de Dios.', verse_reference: '1 Samuel 10:1', bookName: '1 Samuel', chapterNumber: 10, difficulty: 'fácil' },
    { id: 'sb_p2', class_id: 'personajes', category: 'personajes', question_text: '¿Cómo se llamaba la madre de Samuel que oró fervientemente en el tabernáculo de Silo?', option_a: 'Ana', option_b: 'Penina', option_c: 'Mical', option_d: 'Abigail', correct_answer: 'a', explanation: 'Ana clamó a Dios en Silo y Dios le concedió a Samuel.', verse_reference: '1 Samuel 1:20', bookName: '1 Samuel', chapterNumber: 1, difficulty: 'fácil' },
    { id: 'sb_p3', class_id: 'personajes', category: 'personajes', question_text: '¿Quién era el general comandante del ejército del rey Saúl?', option_a: 'Abner', option_b: 'Joab', option_c: 'Benaía', option_d: 'Amasá', correct_answer: 'a', explanation: 'Abner hijo de Ner era el general del ejército de Saúl.', verse_reference: '1 Samuel 14:50', bookName: '1 Samuel', chapterNumber: 14, difficulty: 'medio' },
    { id: 'sb_p4', class_id: 'personajes', category: 'personajes', question_text: '¿Qué hijo del rey Saúl selló un pacto de entrañable amistad con David?', option_a: 'Jonatán', option_b: 'Is-boset', option_c: 'Malquisúa', option_d: 'Abinadab', correct_answer: 'a', explanation: 'El alma de Jonatán quedó ligada con la de David.', verse_reference: '1 Samuel 18:1-3', bookName: '1 Samuel', chapterNumber: 18, difficulty: 'fácil' },
    { id: 'sb_p5', class_id: 'personajes', category: 'personajes', question_text: '¿Qué hijo de Jonatán estaba lisiado de ambos pies y comió a la mesa de David toda su vida?', option_a: 'Mefiboset', option_b: 'Micaía', option_c: 'Siba', option_d: 'Asael', correct_answer: 'a', explanation: 'David mostró misericordia a Mefiboset por amor a Jonatán.', verse_reference: '2 Samuel 9:7-13', bookName: '2 Samuel', chapterNumber: 9, difficulty: 'medio' },
    { id: 'sb_p6', class_id: 'personajes', category: 'personajes', question_text: '¿Qué profeta confrontó a David con la parábola de la corderita tras la muerte de Urías?', option_a: 'Natán', option_b: 'Gad', option_c: 'Ahías', option_d: 'Samuel', correct_answer: 'a', explanation: 'Natán dijo a David: Tú eres aquel hombre.', verse_reference: '2 Samuel 12:1-7', bookName: '2 Samuel', chapterNumber: 12, difficulty: 'medio' },
    { id: 'sb_p7', class_id: 'personajes', category: 'personajes', question_text: '¿Qué reina malvada usurpó el trono de Judá y exterminó a casi toda la simiente real?', option_a: 'Atalía', option_b: 'Jezabel', option_c: 'Maaca', option_d: 'Cozi', correct_answer: 'a', explanation: 'Atalía madre de Ocozías reinó en Judá seis años.', verse_reference: '2 Reyes 11:1-3', bookName: '2 Reyes', chapterNumber: 11, difficulty: 'difícil' },
    { id: 'sb_p8', class_id: 'personajes', category: 'personajes', question_text: '¿Qué profeta fue llevado al cielo en un torbellino por un carro y caballos de fuego?', option_a: 'Elías', option_b: 'Eliseo', option_c: 'Isaías', option_d: 'Enoc', correct_answer: 'a', explanation: 'Elías subió al cielo en un torbellino.', verse_reference: '2 Reyes 2:11', bookName: '2 Reyes', chapterNumber: 2, difficulty: 'fácil' },

    // 📍 CLASE 2: LUGARES (8 preguntas verificadas)
    { id: 'sb_l1', class_id: 'lugares', category: 'lugares', question_text: '¿En qué ciudad fue coronado David por primera vez como rey sobre la tribu de Judá?', option_a: 'Hebrón', option_b: 'Jerusalén', option_c: 'Belén', option_d: 'Gilgal', correct_answer: 'a', explanation: 'Los hombres de Judá ungieron a David en Hebrón.', verse_reference: '2 Samuel 2:4', bookName: '2 Samuel', chapterNumber: 2, difficulty: 'fácil' },
    { id: 'sb_l2', class_id: 'lugares', category: 'lugares', question_text: '¿En qué monte desafió Elías a los profetas de Baal con fuego que cayó del cielo?', option_a: 'Monte Carmelo', option_b: 'Monte Sinaí', option_c: 'Monte Hermón', option_d: 'Monte de los Olivos', correct_answer: 'a', explanation: 'Elías convocó a todo Israel al monte Carmelo.', verse_reference: '1 Reyes 18:19', bookName: '1 Reyes', chapterNumber: 18, difficulty: 'fácil' },
    { id: 'sb_l3', class_id: 'lugares', category: 'lugares', question_text: '¿En qué cueva perdonó David la vida de Saúl cortando solo la orilla de su manto?', option_a: 'Cueva de En-gadi', option_b: 'Cueva de Adulam', option_c: 'Cueva de Macpela', option_d: 'Cueva de Makeda', correct_answer: 'a', explanation: 'David cortó la orilla del manto de Saúl en En-gadi.', verse_reference: '1 Samuel 24:1-4', bookName: '1 Samuel', chapterNumber: 24, difficulty: 'medio' },
    { id: 'sb_l4', class_id: 'lugares', category: 'lugares', question_text: '¿En qué ciudad filistea colocaron el arca de Jehová dentro del templo del dios Dagón?', option_a: 'Asdod', option_b: 'Gat', option_c: 'Ecrón', option_d: 'Ascalón', correct_answer: 'a', explanation: 'Los filisteos llevaron el arca a Asdod junto a Dagón.', verse_reference: '1 Samuel 5:1-2', bookName: '1 Samuel', chapterNumber: 5, difficulty: 'medio' },
    { id: 'sb_l5', class_id: 'lugares', category: 'lugares', question_text: '¿En qué monte murieron trágicamente Saúl y sus tres hijos en combate contra los filisteos?', option_a: 'Monte Gilboa', option_b: 'Monte Hermón', option_c: 'Monte Nebo', option_d: 'Monte Ebal', correct_answer: 'a', explanation: 'Saúl y Jonatán cayeron en el monte Gilboa.', verse_reference: '1 Samuel 31:1', bookName: '1 Samuel', chapterNumber: 31, difficulty: 'fácil' },
    { id: 'sb_l6', class_id: 'lugares', category: 'lugares', question_text: '¿A qué monte huyó Elías durante 40 días donde Dios le habló en un silbo apacible?', option_a: 'Monte Horeb', option_b: 'Monte Carmelo', option_c: 'Monte Sión', option_d: 'Monte Gerizim', correct_answer: 'a', explanation: 'Elías caminó hasta Horeb, el monte de Dios.', verse_reference: '1 Reyes 19:8-12', bookName: '1 Reyes', chapterNumber: 19, difficulty: 'medio' },
    { id: 'sb_l7', class_id: 'lugares', category: 'lugares', question_text: '¿En qué río se sumergió siete veces el general Naamán para ser limpiado de su lepra?', option_a: 'Río Jordán', option_b: 'Río Éufrates', option_c: 'Río Nilo', option_d: 'Río Quisón', correct_answer: 'a', explanation: 'Naamán se zambulló siete veces en el Jordán y fue sano.', verse_reference: '2 Reyes 5:14', bookName: '2 Reyes', chapterNumber: 5, difficulty: 'fácil' },
    { id: 'sb_l8', class_id: 'lugares', category: 'lugares', question_text: '¿En qué ciudad sacerdotal dio Ahimelec a David los panes de la proposición y la espada de Goliat?', option_a: 'Nob', option_b: 'Silo', option_c: 'Bet-el', option_d: 'Ramá', correct_answer: 'a', explanation: 'David llegó a la ciudad sacerdotal de Nob ante Ahimelec.', verse_reference: '1 Samuel 21:1-9', bookName: '1 Samuel', chapterNumber: 21, difficulty: 'medio' },

    // 🔢 CLASE 3: CANTIDADES (8 preguntas verificadas)
    { id: 'sb_c1', class_id: 'cantidades', category: 'cantidades', question_text: '¿Cuántos años reinó en total el rey David sobre Israel (7 en Hebrón y 33 en Jerusalén)?', option_a: '40 años', option_b: '30 años', option_c: '33 años', option_d: '20 años', correct_answer: 'a', explanation: 'David reinó cuarenta años en total.', verse_reference: '2 Samuel 5:4', bookName: '2 Samuel', chapterNumber: 5, difficulty: 'fácil' },
    { id: 'sb_c2', class_id: 'cantidades', category: 'cantidades', question_text: '¿Cuántas piedras lisas escogió David del arroyo antes de derrotar al gigante Goliat?', option_a: '5 piedras', option_b: '3 piedras', option_c: '7 piedras', option_d: '1 piedra', correct_answer: 'a', explanation: 'David escogió cinco piedras lisas para su honda.', verse_reference: '1 Samuel 17:40', bookName: '1 Samuel', chapterNumber: 17, difficulty: 'fácil' },
    { id: 'sb_c3', class_id: 'cantidades', category: 'cantidades', question_text: '¿Cuántos talentos de oro recibía anualmente el rey Salomón en el apogeo de su riqueza?', option_a: '666 talentos de oro', option_b: '500 talentos de oro', option_c: '1000 talentos de oro', option_d: '120 talentos de oro', correct_answer: 'a', explanation: 'El peso del oro que llegaba a Salomón cada año era 666 talentos.', verse_reference: '1 Reyes 10:14', bookName: '1 Reyes', chapterNumber: 10, difficulty: 'medio' },
    { id: 'sb_c4', class_id: 'cantidades', category: 'cantidades', question_text: '¿Cuántos profetas de Baal enfrentó Elías en el monte Carmelo?', option_a: '450 profetas', option_b: '400 profetas', option_c: '300 profetas', option_d: '50 profetas', correct_answer: 'a', explanation: 'Había cuatrocientos cincuenta profetas de Baal.', verse_reference: '1 Reyes 18:22', bookName: '1 Reyes', chapterNumber: 18, difficulty: 'medio' },
    { id: 'sb_c5', class_id: 'cantidades', category: 'cantidades', question_text: '¿Cuántos soldados del ejército asirio de Senaquerib murieron en una noche por el ángel del Señor?', option_a: '185,000 soldados', option_b: '100,000 soldados', option_c: '50,000 soldados', option_d: '200,000 soldados', correct_answer: 'a', explanation: 'El ángel mató en el campamento asirio a 185,000 hombres.', verse_reference: '2 Reyes 19:35', bookName: '2 Reyes', chapterNumber: 19, difficulty: 'medio' },
    { id: 'sb_c6', class_id: 'cantidades', category: 'cantidades', question_text: '¿Cuántos años de vida añadió Dios al rey Ezequías tras orar con lágrimas?', option_a: '15 años', option_b: '10 años', option_c: '20 años', option_d: '12 años', correct_answer: 'a', explanation: 'Dios añadió quince años a la vida de Ezequías.', verse_reference: '2 Reyes 20:6', bookName: '2 Reyes', chapterNumber: 20, difficulty: 'fácil' },
    { id: 'sb_c7', class_id: 'cantidades', category: 'cantidades', question_text: '¿A qué edad comenzó a reinar Joás en Judá cuando fue proclamado rey por el sacerdote Joiada?', option_a: '7 años', option_b: '8 años', option_c: '12 años', option_d: '16 años', correct_answer: 'a', explanation: 'De siete años era Joás cuando comenzó a reinar.', verse_reference: '2 Reyes 11:21', bookName: '2 Reyes', chapterNumber: 11, difficulty: 'medio' },
    { id: 'sb_c8', class_id: 'cantidades', category: 'cantidades', question_text: '¿Cuántos días desafió el gigante Goliat a los ejércitos de Israel mañana y tarde?', option_a: '40 días', option_b: '30 días', option_c: '7 días', option_d: '12 días', correct_answer: 'a', explanation: 'Goliat salía por la mañana y por la tarde durante 40 días.', verse_reference: '1 Samuel 17:16', bookName: '1 Samuel', chapterNumber: 17, difficulty: 'fácil' },

    // ⚡ CLASE 4: EVENTOS (8 preguntas verificadas)
    { id: 'sb_e1', class_id: 'eventos', category: 'eventos', question_text: '¿Qué milagro ocurrió cuando Elías oró en el monte Carmelo tras empapar tres veces el holocausto?', option_a: 'Descendió fuego del cielo que consumió el holocausto y el agua', option_b: 'Se abrió la tierra bajo el altar', option_c: 'Hubo un gran terremoto en la cima', option_d: 'El sol se detuvo por varias horas', correct_answer: 'a', explanation: 'Fuego de Jehová consumió el holocausto, la leña y el agua.', verse_reference: '1 Reyes 18:38', bookName: '1 Reyes', chapterNumber: 18, difficulty: 'fácil' },
    { id: 'sb_e2', class_id: 'eventos', category: 'eventos', question_text: '¿Qué suceso sobrenatural ocurrió con un hacha de hierro caída al río Jordán ante Eliseo?', option_a: 'El hierro flotó sobre las aguas', option_b: 'El río se secó temporalmente', option_c: 'Un pez trajo el hacha en su boca', option_d: 'Se convirtió en oro', correct_answer: 'a', explanation: 'Eliseo echó un palo allí e hizo flotar el hierro.', verse_reference: '2 Reyes 6:6', bookName: '2 Reyes', chapterNumber: 6, difficulty: 'medio' },
    { id: 'sb_e3', class_id: 'eventos', category: 'eventos', question_text: '¿Qué señal milagrosa ocurrió en el reloj de sol de Acaz confirmando la promesa a Ezequías?', option_a: 'La sombra retrocedió diez grados', option_b: 'El sol resplandeció siete veces más', option_c: 'Apareció una columna de fuego', option_d: 'Hubo un eclipse al mediodía', correct_answer: 'a', explanation: 'La sombra retrocedió diez grados en el reloj de Acaz.', verse_reference: '2 Reyes 20:11', bookName: '2 Reyes', chapterNumber: 20, difficulty: 'medio' },
    { id: 'sb_e4', class_id: 'eventos', category: 'eventos', question_text: '¿Qué hallazgo en el templo motivó al rey Josías a rasgar sus vestidos e iniciar la gran reforma?', option_a: 'El Libro de la Ley de Jehová', option_b: 'El arca de la alianza perdida', option_c: 'La vara florecida de Aarón', option_d: 'El pectoral de Urim y Tumim', correct_answer: 'a', explanation: 'El sacerdote Hilcías halló el libro de la ley en el templo.', verse_reference: '2 Reyes 22:8-11', bookName: '2 Reyes', chapterNumber: 22, difficulty: 'fácil' },
    { id: 'sb_e5', class_id: 'eventos', category: 'eventos', question_text: '¿Qué milagro realizó Dios por medio de Eliseo para librar de la esclavitud a los hijos de una viuda?', option_a: 'Multiplicó inagotablemente una vasija de aceite', option_b: 'Hizo descender maná en su casa', option_c: 'Convirtió el agua en monedas de plata', option_d: 'Hizo brotar un manantial en su huerto', correct_answer: 'a', explanation: 'El aceite no cesó hasta que se llenaron todas las vasijas.', verse_reference: '2 Reyes 4:1-7', bookName: '2 Reyes', chapterNumber: 4, difficulty: 'fácil' },
    { id: 'sb_e6', class_id: 'eventos', category: 'eventos', question_text: '¿Qué juicio ocurrió con Uza en la era de Nacón cuando el arca tropezó en los bueyes?', option_a: 'Murió instantáneamente al tocar el arca sagrada', option_b: 'Quedó leproso como Naamán', option_c: 'Quedó ciego temporalmente', option_d: 'Cayó en profundo estupor', correct_answer: 'a', explanation: 'Dios hirió a Uza por su temeridad y murió allí.', verse_reference: '2 Samuel 6:6-7', bookName: '2 Samuel', chapterNumber: 6, difficulty: 'medio' },
    { id: 'sb_e7', class_id: 'eventos', category: 'eventos', question_text: '¿Qué señal de las flechas acordaron Jonatán y David para comunicarle el peligro de Saúl?', option_a: 'Si las flechas iban más allá del muchacho, debía huir', option_b: 'Si disparaba tres flechas doradas, el rey estaba en paz', option_c: 'Si clavaba la flecha en una roca, debía volver', option_d: 'Si no disparaba flechas, Saúl dormía', correct_answer: 'a', explanation: 'Jonatán gritó: Las flechas van más allá de ti.', verse_reference: '1 Samuel 20:20-22', bookName: '1 Samuel', chapterNumber: 20, difficulty: 'medio' },
    { id: 'sb_e8', class_id: 'eventos', category: 'eventos', question_text: '¿Qué juicio divino sobrevino al rey Uzías cuando entró orgulloso al templo a quemar incienso?', option_a: 'Brotó lepra en su frente ante los sacerdotes', option_b: 'Perdió el habla de por vida', option_c: 'Fue consumido por fuego del altar', option_d: 'Su mano derecha se secó', correct_answer: 'a', explanation: 'La lepra le brotó en la frente y fue rey leproso hasta su muerte.', verse_reference: '2 Reyes 15:5', bookName: '2 Reyes', chapterNumber: 15, difficulty: 'difícil' }
];

// Estructura de almacenamiento en memoria particionada por clase
let decoupledBank = {
    personajes: [],
    lugares: [],
    cantidades: [],
    eventos: []
};

let decoupledBankConfigId = null;
let lastBankFetch = 0;

/**
 * Función de Ciencia de Datos: Cálculo de Métricas y Entropía de Shannon
 * Mide el equilibrio equitativo entre las 4 clases bíblicas
 */
function calculateDistributionMetrics(bank) {
    const counts = {
        personajes: bank.personajes?.length || 0,
        lugares: bank.lugares?.length || 0,
        cantidades: bank.cantidades?.length || 0,
        eventos: bank.eventos?.length || 0
    };

    const total = counts.personajes + counts.lugares + counts.cantidades + counts.eventos;

    if (total === 0) {
        return {
            total: 0,
            counts,
            percentages: { personajes: 0, lugares: 0, cantidades: 0, eventos: 0 },
            entropy: 0,
            equitability: 0,
            status: 'VACIO',
            isBalanced: false,
            idealPerClass: 0
        };
    }

    const percentages = {
        personajes: Number(((counts.personajes / total) * 100).toFixed(1)),
        lugares: Number(((counts.lugares / total) * 100).toFixed(1)),
        cantidades: Number(((counts.cantidades / total) * 100).toFixed(1)),
        eventos: Number(((counts.eventos / total) * 100).toFixed(1))
    };

    // Entropía de Shannon H = - SUM(p_i * log2(p_i))
    let entropy = 0;
    Object.values(counts).forEach(count => {
        if (count > 0) {
            const p = count / total;
            entropy -= p * Math.log2(p);
        }
    });

    const maxEntropy = Math.log2(4); // 2.0 bits (distribución perfectamente uniforme de 4 clases)
    const equitability = Number(Math.min(100, Math.max(0, (entropy / maxEntropy) * 100)).toFixed(1));

    let status = 'OPTIMO';
    if (equitability < 70) {
        status = 'DESBALANCEADO';
    } else if (equitability < 88) {
        status = 'ACEPTABLE';
    } else {
        status = 'EQUILIBRADO';
    }

    return {
        total,
        counts,
        percentages,
        entropy: Number(entropy.toFixed(4)),
        equitability,
        status,
        isBalanced: equitability >= 75,
        idealPerClass: Math.round(total / 4)
    };
}

/**
 * Organiza una lista plana de preguntas en los 4 bancos estratificados
 */
function organizeIntoClassBanks(questionsList) {
    const partitioned = {
        personajes: [],
        lugares: [],
        cantidades: [],
        eventos: []
    };

    const seenTexts = new Set();

    (questionsList || []).forEach(q => {
        if (!q || !q.question_text) return;
        
        // Deduplicación basada en enunciado normalizado
        const cleanKey = q.question_text.trim().toLowerCase();
        if (seenTexts.has(cleanKey)) return;
        seenTexts.add(cleanKey);

        const assignedClass = (q.class_id || q.category || q.custom_category || classifyQuestion(q)).toLowerCase();
        const validClass = ['personajes', 'lugares', 'cantidades', 'eventos'].includes(assignedClass)
            ? assignedClass
            : classifyQuestion(q);

        const formatted = {
            id: q.id || `sb_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            class_id: validClass,
            category: validClass,
            question_text: q.question_text.trim(),
            option_a: (q.option_a || '').trim() || 'Opción A',
            option_b: (q.option_b || '').trim() || 'Opción B',
            option_c: (q.option_c || '').trim() || 'Ninguna de las anteriores',
            option_d: (q.option_d || '').trim() || 'Todas las anteriores',
            correct_answer: (q.correct_answer || 'a').toString().toLowerCase().match(/[a-d]/)?.[0] || 'a',
            explanation: (q.explanation || 'Respuesta bíblica oficial NTV.').trim(),
            verse_reference: (q.verse_reference || '').trim(),
            bookName: q.bookName || q.book || '1 Samuel',
            chapterNumber: parseInt(q.chapterNumber || q.chapter_number || q.chapter_id || 1, 10),
            difficulty: q.difficulty || 'medio',
            created_at: q.created_at || new Date().toISOString()
        };

        partitioned[validClass].push(formatted);
    });

    return partitioned;
}

/**
 * Carga el Banco Desvinculado de Simulacro desde Supabase o Backup Local
 */
async function ensureSimulacroBankLoaded(forceRefresh = false) {
    const now = Date.now();
    const hasItems = Object.values(decoupledBank).some(arr => arr.length > 0);

    if (!forceRefresh && hasItems && (now - lastBankFetch < 30000)) {
        return decoupledBank;
    }

    try {
        const supabase = getDb();
        const { data, error } = await supabase
            .from('custom_quiz_configs')
            .select('*')
            .eq('difficulty', 'simulacro_bank_v2')
            .order('id', { ascending: false })
            .limit(1);

        if (!error && data && data.length > 0 && data[0].books_selected) {
            decoupledBankConfigId = data[0].id;
            const parsedList = JSON.parse(data[0].books_selected);
            if (Array.isArray(parsedList) && parsedList.length > 0) {
                decoupledBank = organizeIntoClassBanks(parsedList);
                lastBankFetch = now;

                // Guardar réplica local segura
                try {
                    if (simulacroBankJsonPath && fs.existsSync(path.dirname(simulacroBankJsonPath))) {
                        fs.writeFileSync(simulacroBankJsonPath, JSON.stringify(parsedList, null, 2), 'utf8');
                    }
                } catch (e) {}

                return decoupledBank;
            }
        }
    } catch (dbErr) {
        console.warn('[Simulacro] Error consultando banco desvinculado en Supabase:', dbErr.message);
    }

    // 2. Intentar leer desde archivo de respaldo simulacro_bank.json
    try {
        if (simulacroBankJsonPath && fs.existsSync(simulacroBankJsonPath)) {
            const raw = fs.readFileSync(simulacroBankJsonPath, 'utf8');
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
                decoupledBank = organizeIntoClassBanks(parsed);
                lastBankFetch = now;
                return decoupledBank;
            }
        }
    } catch (fsErr) {
        console.warn('[Simulacro] Error leyendo simulacro_bank.json:', fsErr.message);
    }

    // 3. Inicializar con la semilla científica verificada de 32 preguntas equilibradas
    decoupledBank = organizeIntoClassBanks(INITIAL_SEEDED_SIMULACRO_BANK);
    lastBankFetch = now;

    // Persistir la semilla en Supabase para que quede grabada permanentemente en la nube
    try {
        await persistSimulacroBank(decoupledBank);
    } catch (seedPersistErr) {}

    return decoupledBank;
}

/**
 * Persiste el Banco Desvinculado en Supabase (custom_quiz_configs) y archivo local
 */
async function persistSimulacroBank(bankToSave) {
    const allQuestions = [
        ...(bankToSave.personajes || []),
        ...(bankToSave.lugares || []),
        ...(bankToSave.cantidades || []),
        ...(bankToSave.eventos || [])
    ];

    const metrics = calculateDistributionMetrics(bankToSave);

    // 1. Guardar en Supabase
    try {
        const supabase = getDb();
        if (decoupledBankConfigId) {
            await supabase
                .from('custom_quiz_configs')
                .update({
                    question_count: allQuestions.length,
                    books_selected: JSON.stringify(allQuestions),
                    chapters_selected: JSON.stringify(metrics)
                })
                .eq('id', decoupledBankConfigId);
        } else {
            const { data, error } = await supabase
                .from('custom_quiz_configs')
                .insert([{
                    user_id: 1,
                    difficulty: 'simulacro_bank_v2',
                    question_count: allQuestions.length,
                    books_selected: JSON.stringify(allQuestions),
                    chapters_selected: JSON.stringify(metrics)
                }])
                .select();
            if (data && data[0]?.id) {
                decoupledBankConfigId = data[0].id;
            }
        }
    } catch (saveDbErr) {
        console.warn('[Simulacro] Aviso persistiendo banco en Supabase:', saveDbErr.message);
    }

    // 2. Guardar en archivo local si es posible
    try {
        if (simulacroBankJsonPath && fs.existsSync(path.dirname(simulacroBankJsonPath))) {
            fs.writeFileSync(simulacroBankJsonPath, JSON.stringify(allQuestions, null, 2), 'utf8');
        }
    } catch (e) {}

    decoupledBank = bankToSave;
    lastBankFetch = Date.now();

    return { success: true, count: allQuestions.length, metrics };
}

/**
 * Algoritmo de Muestreo Estratificado Aleatorio para competencias de Simulacro
 */
function getStratifiedBankSample(bank, requestedCount = 20, forcedCategory = null) {
    const categories = ['personajes', 'lugares', 'cantidades', 'eventos'];

    if (forcedCategory && categories.includes(forcedCategory)) {
        const pool = bank[forcedCategory] || [];
        return [...pool].sort(() => 0.5 - Math.random()).slice(0, requestedCount);
    }

    const quotaPerCategory = Math.max(1, Math.floor(requestedCount / categories.length));
    const selected = [];

    // Muestreo uniforme por estrato
    categories.forEach(cat => {
        const pool = bank[cat] || [];
        const sampled = [...pool].sort(() => 0.5 - Math.random()).slice(0, quotaPerCategory);
        selected.push(...sampled);
    });

    // Si aún faltan elementos para satisfacer el tamaño de muestra solicitado
    if (selected.length < requestedCount) {
        const allRemaining = categories
            .flatMap(c => bank[c] || [])
            .filter(q => !selected.some(s => s.id === q.id))
            .sort(() => 0.5 - Math.random());
        selected.push(...allRemaining.slice(0, requestedCount - selected.length));
    }

    // Barajar aleatoriamente el conjunto estratificado final
    return selected.sort(() => 0.5 - Math.random()).slice(0, requestedCount);
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

// Helper para clasificar preguntas por palabra clave en las subcategorías de Fire Questions
function classifyQuestion(q) {
    if (q.custom_category) {
        return q.custom_category.toLowerCase();
    }
    if (q.category) {
        return q.category.toLowerCase();
    }
    const text = ((q.question_text || '') + ' ' + (q.explanation || '') + ' ' + (q.verse_reference || '')).toLowerCase();
    
    // Si viene la etiqueta explícita de categoría [PERSONAJES], [LUGARES], etc.
    if (text.includes('[personajes]') || text.includes('[categoría: personajes]') || text.includes('[categoria: personajes]')) return 'personajes';
    if (text.includes('[lugares]') || text.includes('[categoría: lugares]') || text.includes('[categoria: lugares]')) return 'lugares';
    if (text.includes('[cantidades]') || text.includes('[categoría: cantidades]') || text.includes('[categoria: cantidades]')) return 'cantidades';
    if (text.includes('[eventos]') || text.includes('[categoría: eventos]') || text.includes('[categoria: eventos]')) return 'eventos';

    // 1. Cantidades (¿cuántos?, números, años, medidas)
    if (
        text.includes('cuánt') || text.includes('cuant') || text.includes('años') ||
        text.includes('días') || text.includes('meses') || text.includes('siclos') ||
        text.includes('codos') || text.includes('hombres') || text.includes('veces') ||
        text.includes('talent') || text.includes('soldad') || text.includes('edad') ||
        text.includes('número') || text.includes('numero') || text.includes('total') ||
        text.includes('primero') || text.includes('segundo') || text.includes('tercero')
    ) {
        return 'cantidades';
    }

    // 2. Lugares (ciudades, montes, valles, ríos)
    if (
        text.includes('dónde') || text.includes('donde') || text.includes('lugar') ||
        text.includes('ciudad') || text.includes('monte') || text.includes('valle') ||
        text.includes('cueva') || text.includes('río') || text.includes('rio') ||
        text.includes('jerusalén') || text.includes('belén') || text.includes('hebrón') ||
        text.includes('gilgal') || text.includes('silo') || text.includes('bet-el') ||
        text.includes('carmelo') || text.includes('samaria') || text.includes('gat') ||
        text.includes('siclag') || text.includes('nob') || text.includes('en-gadi') ||
        text.includes('jordán') || text.includes('jordan') || text.includes('egipto') ||
        text.includes('asiria') || text.includes('babilonia') || text.includes('tiro') ||
        text.includes('sión') || text.includes('sion') || text.includes('mizpa') ||
        text.includes('jabes') || text.includes('tabernáculo')
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
        text.includes('honda') || text.includes('estatua') || text.includes('manto') ||
        text.includes('hambre') || text.includes('peste') || text.includes('plaga') ||
        text.includes('edificó') || text.includes('construyó') || text.includes('resucitó')
    ) {
        return 'eventos';
    }

    // 4. Personajes (por defecto o si menciona nombres propios / quién)
    return 'personajes';
}

// Banco temático para El Dado Dado (6 Caras)
const DADO_THEMES = [
    { 
        face: 1, 
        name: 'Reyes y Conquistadores', 
        filter: ['rey', 'reyes', 'reinó', 'reino', 'saúl', 'david', 'salomón', 'acab', 'roboam', 'jeroboam', 'ezequías', 'josías', 'trono', 'corona', 'judá', 'israel', 'conquist'] 
    },
    { 
        face: 2, 
        name: 'Profetas de Dios', 
        filter: ['profeta', 'profetas', 'profetizó', 'samuel', 'elías', 'eliseo', 'natán', 'gad', 'jehú', 'isaías', 'hulda', 'ahías', 'palabra', 'voz', 'visión', 'vidente'] 
    },
    { 
        face: 3, 
        name: 'Batallas y Estrategias', 
        filter: ['guerra', 'ejército', 'filisteo', 'filisteos', 'espada', 'lanza', 'goliat', 'batalla', 'honda', 'escudo', 'campamento', 'valiente', 'soldado', 'arco', 'flecha'] 
    },
    { 
        face: 4, 
        name: 'Milagros y Señales', 
        filter: ['milagro', 'fuego', 'resucitó', 'aceite', 'lepra', 'lepras', 'agua', 'cielo', 'hacha', 'flotó', 'sanó', 'sanado', 'señal', 'visión', 'ángel', 'sombra'] 
    },
    { 
        face: 5, 
        name: 'Sabiduría y Ley', 
        filter: ['sabiduría', 'sabio', 'juicio', 'templo', 'arca', 'mandamiento', 'libro', 'ley', 'pacto', 'oró', 'oración', 'altar', 'justicia', 'proverbio', 'obedec'] 
    },
    { 
        face: 6, 
        name: 'Desafío de Oro (Pregunta Crucial)', 
        filter: [] 
    }
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
 * GET /api/simulacro/bank
 * Obtiene el banco de preguntas completo desvinculado de Simulacro, particionado por clase
 */
router.get('/bank', async (req, res) => {
    try {
        const bank = await ensureSimulacroBankLoaded();
        const metrics = calculateDistributionMetrics(bank);
        res.json({
            success: true,
            metrics,
            bank,
            classes: [
                { id: 'personajes', name: 'Personajes Bíblicos', count: bank.personajes.length, icon: '👤', color: 'from-blue-600 to-indigo-600' },
                { id: 'lugares', name: 'Lugares Bíblicos', count: bank.lugares.length, icon: '📍', color: 'from-emerald-600 to-teal-600' },
                { id: 'cantidades', name: 'Cantidades Bíblicas', count: bank.cantidades.length, icon: '🔢', color: 'from-amber-600 to-yellow-600' },
                { id: 'eventos', name: 'Eventos Bíblicos', count: bank.eventos.length, icon: '⚡', color: 'from-purple-600 to-pink-600' }
            ]
        });
    } catch (err) {
        console.error('[Simulacro] Error obteniendo banco:', err);
        res.status(500).json({ error: 'Error cargando banco desvinculado de Simulacro' });
    }
});

/**
 * GET /api/simulacro/bank/metrics
 * Métricas de ciencia de datos: Entropía de Shannon, equitabilidad muestral y proporciones
 */
router.get('/bank/metrics', async (req, res) => {
    try {
        const bank = await ensureSimulacroBankLoaded();
        const metrics = calculateDistributionMetrics(bank);
        res.json({ success: true, metrics });
    } catch (err) {
        res.status(500).json({ error: 'Error calculando métricas de ciencia de datos' });
    }
});

/**
 * GET /api/simulacro/bank/:classId
 * Obtiene las preguntas de una clase específica (personajes, lugares, cantidades, eventos)
 */
router.get('/bank/:classId', async (req, res) => {
    try {
        const { classId } = req.params;
        const validClasses = ['personajes', 'lugares', 'cantidades', 'eventos'];
        const target = classId.toLowerCase();
        if (!validClasses.includes(target)) {
            return res.status(400).json({ error: 'Clase no válida. Use: personajes, lugares, cantidades o eventos.' });
        }
        const bank = await ensureSimulacroBankLoaded();
        const list = bank[target] || [];
        res.json({
            success: true,
            classId: target,
            count: list.length,
            questions: list
        });
    } catch (err) {
        res.status(500).json({ error: 'Error cargando banco de la clase ' + req.params.classId });
    }
});

/**
 * POST /api/simulacro/bank/:classId/questions
 * Añade una pregunta directamente al banco de la clase especificada
 */
router.post('/bank/:classId/questions', async (req, res) => {
    try {
        const { classId } = req.params;
        const validClasses = ['personajes', 'lugares', 'cantidades', 'eventos'];
        const targetClass = classId.toLowerCase();
        if (!validClasses.includes(targetClass)) {
            return res.status(400).json({ error: 'Clase no válida.' });
        }
        const q = req.body;
        if (!q.question_text || !q.option_a || !q.option_b) {
            return res.status(400).json({ error: 'La pregunta requiere al menos el enunciado y las opciones A y B.' });
        }

        const bank = await ensureSimulacroBankLoaded();
        const matchAns = String(q.correct_answer || 'a').toLowerCase().match(/[a-d]/);

        const newQuestion = {
            id: `sb_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            class_id: targetClass,
            category: targetClass,
            question_text: q.question_text.trim(),
            option_a: q.option_a.trim(),
            option_b: q.option_b.trim(),
            option_c: (q.option_c || '').trim() || 'Ninguna de las anteriores',
            option_d: (q.option_d || '').trim() || 'Todas las anteriores',
            correct_answer: matchAns ? matchAns[0] : 'a',
            explanation: (q.explanation || 'Respuesta bíblica oficial NTV.').trim(),
            verse_reference: (q.verse_reference || '').trim(),
            bookName: q.bookName || '1 Samuel',
            chapterNumber: parseInt(q.chapterNumber || q.chapter_id || 1, 10),
            difficulty: q.difficulty || 'medio',
            created_at: new Date().toISOString()
        };

        bank[targetClass].unshift(newQuestion);
        await persistSimulacroBank(bank);

        res.json({
            success: true,
            message: `Pregunta añadida exitosamente al Banco de ${targetClass}`,
            question: newQuestion,
            classCount: bank[targetClass].length,
            metrics: calculateDistributionMetrics(bank)
        });
    } catch (err) {
        console.error('[Simulacro] Error añadiendo pregunta a clase:', err);
        res.status(500).json({ error: 'Error al agregar pregunta al banco.' });
    }
});

/**
 * PUT /api/simulacro/bank/:classId/questions/:questionId
 * Modifica una pregunta existente en el banco de la clase indicada
 */
router.put('/bank/:classId/questions/:questionId', async (req, res) => {
    try {
        const { classId, questionId } = req.params;
        const bank = await ensureSimulacroBankLoaded();
        const targetClass = classId.toLowerCase();
        const list = bank[targetClass];
        if (!list) return res.status(404).json({ error: 'Clase no encontrada' });

        const idx = list.findIndex(q => q.id === questionId);
        if (idx === -1) return res.status(404).json({ error: 'Pregunta no encontrada en este banco' });

        const matchAns = String(req.body.correct_answer || list[idx].correct_answer).toLowerCase().match(/[a-d]/);
        list[idx] = {
            ...list[idx],
            question_text: req.body.question_text ? req.body.question_text.trim() : list[idx].question_text,
            option_a: req.body.option_a ? req.body.option_a.trim() : list[idx].option_a,
            option_b: req.body.option_b ? req.body.option_b.trim() : list[idx].option_b,
            option_c: req.body.option_c !== undefined ? req.body.option_c.trim() : list[idx].option_c,
            option_d: req.body.option_d !== undefined ? req.body.option_d.trim() : list[idx].option_d,
            correct_answer: matchAns ? matchAns[0] : list[idx].correct_answer,
            explanation: req.body.explanation !== undefined ? req.body.explanation.trim() : list[idx].explanation,
            verse_reference: req.body.verse_reference !== undefined ? req.body.verse_reference.trim() : list[idx].verse_reference,
            bookName: req.body.bookName || list[idx].bookName,
            chapterNumber: parseInt(req.body.chapterNumber || list[idx].chapterNumber, 10),
            difficulty: req.body.difficulty || list[idx].difficulty,
            updated_at: new Date().toISOString()
        };

        await persistSimulacroBank(bank);
        res.json({ success: true, question: list[idx] });
    } catch (err) {
        res.status(500).json({ error: 'Error actualizando pregunta' });
    }
});

/**
 * DELETE /api/simulacro/bank/:classId/questions/:questionId
 * Elimina una pregunta de un banco de clase específico
 */
router.delete('/bank/:classId/questions/:questionId', async (req, res) => {
    try {
        const { classId, questionId } = req.params;
        const bank = await ensureSimulacroBankLoaded();
        const targetClass = classId.toLowerCase();
        if (!bank[targetClass]) return res.status(404).json({ error: 'Clase no encontrada' });

        const prevCount = bank[targetClass].length;
        bank[targetClass] = bank[targetClass].filter(q => q.id !== questionId);
        if (bank[targetClass].length === prevCount) {
            return res.status(404).json({ error: 'Pregunta no encontrada' });
        }

        await persistSimulacroBank(bank);
        res.json({
            success: true,
            message: 'Pregunta eliminada del banco exitosamente',
            remainingInClass: bank[targetClass].length,
            metrics: calculateDistributionMetrics(bank)
        });
    } catch (err) {
        res.status(500).json({ error: 'Error eliminando pregunta' });
    }
});

/**
 * POST /api/simulacro/bank/reset-to-seed
 * Restablece el banco desvinculado a la semilla original equilibrada de 32 preguntas
 */
router.post('/bank/reset-to-seed', async (req, res) => {
    try {
        const resetBank = organizeIntoClassBanks(INITIAL_SEEDED_SIMULACRO_BANK);
        await persistSimulacroBank(resetBank);
        res.json({
            success: true,
            message: 'Banco de Simulacro restablecido exitosamente con las 32 preguntas equilibradas.',
            metrics: calculateDistributionMetrics(resetBank)
        });
    } catch (err) {
        res.status(500).json({ error: 'Error restableciendo banco' });
    }
});

/**
 * GET /api/simulacro/questions/fire-questions/stats
 * Obtener estadísticas de conteo de preguntas por cada una de las clases del banco desvinculado
 */
router.get('/questions/fire-questions/stats', async (req, res) => {
    try {
        const bank = await ensureSimulacroBankLoaded();
        const metrics = calculateDistributionMetrics(bank);

        res.json({
            stats: {
                personajes: bank.personajes.length,
                lugares: bank.lugares.length,
                cantidades: bank.cantidades.length,
                eventos: bank.eventos.length,
                total: metrics.total
            },
            metrics
        });
    } catch (err) {
        console.error('[Simulacro] Error calculando stats:', err);
        res.status(500).json({ error: 'Error calculando estadísticas' });
    }
});

/**
 * POST /api/simulacro/questions/fire-questions/import, /api/simulacro/questions/import y /api/simulacro/bank/import
 * Importador de preguntas para el BANCO DESVINCULADO de Simulacro y sus clases respectivas.
 * Guarda exclusivamente en el almacén de Simulacro en Supabase SIN modificar la tabla 'questions' del quiz general.
 * Body: { category?: string, questions: [...], mode?: 'append' | 'replace' }
 */
const handleQuestionsImport = async (req, res) => {
    try {
        const { category, questions, mode = 'append' } = req.body;

        if (!Array.isArray(questions) || questions.length === 0) {
            return res.status(400).json({ error: 'La lista de preguntas está vacía o tiene formato incorrecto.' });
        }

        const validCategories = ['personajes', 'lugares', 'cantidades', 'eventos'];
        const targetCategory = category && validCategories.includes(category.toLowerCase().trim())
            ? category.toLowerCase().trim()
            : null;

        const currentBank = await ensureSimulacroBankLoaded();

        // Si el modo es 'replace'
        if (mode === 'replace') {
            if (targetCategory) {
                currentBank[targetCategory] = [];
            } else {
                currentBank.personajes = [];
                currentBank.lugares = [];
                currentBank.cantidades = [];
                currentBank.eventos = [];
            }
        }

        let importedCount = 0;
        const timestamp = Date.now();

        questions.forEach((q, idx) => {
            if (!q.question_text || !q.option_a || !q.option_b) return;

            const assignedClass = targetCategory || q.class_id || q.custom_category || q.category || classifyQuestion(q);
            const validClass = validCategories.includes(assignedClass) ? assignedClass : classifyQuestion(q);

            const matchAns = String(q.correct_answer || 'a').toLowerCase().match(/[a-d]/);

            const formatted = {
                id: `sb_imp_${timestamp}_${idx}_${Math.random().toString(36).substr(2, 5)}`,
                class_id: validClass,
                category: validClass,
                question_text: q.question_text.trim(),
                option_a: q.option_a.trim(),
                option_b: q.option_b.trim(),
                option_c: (q.option_c || '').trim() || 'Ninguna de las anteriores',
                option_d: (q.option_d || '').trim() || 'Todas las anteriores',
                correct_answer: matchAns ? matchAns[0] : 'a',
                explanation: (q.explanation || 'Respuesta bíblica oficial NTV.').trim(),
                verse_reference: (q.verse_reference || '').trim(),
                bookName: q.bookName || q.book || '1 Samuel',
                chapterNumber: parseInt(q.chapterNumber || q.chapter_number || q.chapter_id || 1, 10),
                difficulty: q.difficulty || 'medio',
                created_at: new Date().toISOString()
            };

            currentBank[validClass].unshift(formatted);
            importedCount++;
        });

        // Persistir en Supabase (custom_quiz_configs) y archivo local de respaldo
        const saveRes = await persistSimulacroBank(currentBank);

        res.json({
            success: true,
            importedCount,
            mode,
            category: targetCategory || 'todas las clases',
            totalOverall: saveRes.count,
            metrics: saveRes.metrics,
            message: `¡Se importaron ${importedCount} preguntas exitosamente al Banco Desvinculado de Simulacro (${mode === 'replace' ? 'reemplazando anteriores' : 'agregando a existentes'})!`
        });
    } catch (err) {
        console.error('[Simulacro] Error importando preguntas al banco:', err);
        res.status(500).json({ error: 'Error al importar las preguntas: ' + (err.message || 'error interno') });
    }
};

router.post('/questions/fire-questions/import', handleQuestionsImport);
router.post('/questions/import', handleQuestionsImport);
router.post('/bank/import', handleQuestionsImport);

/**
 * GET /api/simulacro/questions/fire-questions
 * Obtener preguntas filtradas por la clase de Fire Questions desde el Banco Desvinculado
 */
router.get('/questions/fire-questions', async (req, res) => {
    try {
        const bank = await ensureSimulacroBankLoaded();
        const targetCategory = (req.query.category || 'all').toLowerCase();
        const count = parseInt(req.query.count || '60', 10);

        let sampledQuestions = [];
        if (targetCategory === 'all' || targetCategory === 'todas') {
            sampledQuestions = getStratifiedBankSample(bank, count);
        } else {
            sampledQuestions = getStratifiedBankSample(bank, count, targetCategory);
        }

        const formatted = sampledQuestions.map(q => ({
            id: q.id,
            question_text: q.question_text,
            option_a: q.option_a,
            option_b: q.option_b,
            option_c: q.option_c,
            option_d: q.option_d,
            correct_answer: q.correct_answer,
            explanation: q.explanation,
            verse_reference: q.verse_reference,
            category: q.category || q.class_id,
            time_limit_seconds: 90
        }));

        res.json({ category: targetCategory, count: formatted.length, questions: formatted });
    } catch (err) {
        console.error('[Simulacro] Error en fire-questions:', err);
        res.status(500).json({ error: 'Error cargando preguntas de Fire Questions' });
    }
});

/**
 * GET /api/simulacro/questions/david-goliat y /import-from-fire
 * 20 preguntas con MUESTREO ESTRATIFICADO PERFECTO (5 de Personajes, 5 de Lugares, 5 de Cantidades, 5 de Eventos)
 * Extraídas exclusivamente del Banco Desvinculado de Simulacro
 */
const handleDavidGoliatQuestions = async (req, res) => {
    try {
        const bank = await ensureSimulacroBankLoaded();
        const sample = getStratifiedBankSample(bank, 20);

        const formatted = sample.map((q, idx) => ({
            id: q.id,
            question_number: idx + 1,
            question_text: q.question_text,
            option_a: q.option_a,
            option_b: q.option_b,
            option_c: q.option_c,
            option_d: q.option_d,
            correct_answer: q.correct_answer,
            explanation: q.explanation,
            verse_reference: q.verse_reference,
            source_category: q.category || q.class_id,
            points: 10
        }));

        res.json({
            count: formatted.length,
            questions: formatted,
            message: '20 preguntas equilibradas y estratificadas listas para David contra Goliat.'
        });
    } catch (err) {
        console.error('[Simulacro] Error cargando preguntas para david-goliat:', err);
        res.status(500).json({ error: 'Error cargando preguntas de David contra Goliat' });
    }
};

router.get('/questions/david-goliat/import-from-fire', handleDavidGoliatQuestions);
router.get('/questions/david-goliat', handleDavidGoliatQuestions);

/**
 * GET /api/simulacro/questions/dado
 * Pregunta aleatoria y temática determinada por la cara del dado (1-6)
 * Se eligen aleatoriamente de todas las preguntas importadas y almacenadas según su estilo
 */
router.get('/questions/dado', async (req, res) => {
    try {
        const bank = await ensureSimulacroBankLoaded();
        const allBankQuestions = [
            ...bank.personajes,
            ...bank.lugares,
            ...bank.cantidades,
            ...bank.eventos
        ];

        const face = parseInt(req.query.face || '1', 10);
        const theme = DADO_THEMES.find(t => t.face === face) || DADO_THEMES[0];
        const excludeIds = (req.query.exclude || '').split(',').map(s => s.trim()).filter(Boolean);

        let pool = allBankQuestions.filter(q => !excludeIds.includes(String(q.id)));
        if (pool.length === 0) pool = [...allBankQuestions];

        // Filtrar por la temática oficial de la cara del dado
        let filtered = pool;
        if (theme.filter && theme.filter.length > 0) {
            filtered = pool.filter(q => {
                const text = ((q.question_text || '') + ' ' + (q.explanation || '') + ' ' + (q.verse_reference || '')).toLowerCase();
                return theme.filter.some(k => text.includes(k));
            });
        }

        // Si la temática específica tiene pocas preguntas, usar todo el pool barajado
        if (filtered.length === 0) {
            filtered = pool;
        }

        // Barajar aleatoriamente para garantizar sorpresa y variedad
        const shuffled = [...filtered].sort(() => 0.5 - Math.random());
        const picked = shuffled[0] || allBankQuestions[0] || INITIAL_SEEDED_SIMULACRO_BANK[0];

        res.json({
            face,
            themeName: theme.name,
            totalAvailable: filtered.length,
            question: {
                id: picked.id,
                question_text: picked.question_text,
                option_a: picked.option_a,
                option_b: picked.option_b,
                option_c: picked.option_c || 'Ninguna de las anteriores',
                option_d: picked.option_d || 'Todas las anteriores',
                correct_answer: (picked.correct_answer || 'a').toLowerCase().trim(),
                explanation: picked.explanation || 'Respuesta bíblica oficial NTV.',
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
 * Pregunta aleatoria y temática determinada por el sector de la ruleta (1-8)
 * Se eligen aleatoriamente del Banco Desvinculado de Simulacro según su estilo y libro
 */
router.get('/questions/ruleta', async (req, res) => {
    try {
        const bank = await ensureSimulacroBankLoaded();
        const allBankQuestions = [
            ...bank.personajes,
            ...bank.lugares,
            ...bank.cantidades,
            ...bank.eventos
        ];

        const sectorIdx = parseInt(req.query.sector || '1', 10);
        const sector = RULETA_SECTORS.find(s => s.index === sectorIdx) || RULETA_SECTORS[0];
        const excludeIds = (req.query.exclude || '').split(',').map(s => s.trim()).filter(Boolean);

        let pool = allBankQuestions.filter(q => !excludeIds.includes(String(q.id)));
        if (pool.length === 0) pool = [...allBankQuestions];

        // Mapeo temático y por libros para las 8 divisiones de La Ruleta
        let filtered = pool.filter(q => {
            const ref = ((q.verse_reference || '') + ' ' + (q.bookName || '')).toLowerCase();
            const text = ((q.question_text || '') + ' ' + (q.explanation || '')).toLowerCase();
            const chNum = typeof q.chapterNumber === 'number' ? q.chapterNumber : parseInt(q.chapterNumber || q.chapter_id || 1, 10);

            if (sectorIdx === 1) {
                // 1 Samuel: El Llamado y Saúl (caps 1 a 15)
                return (ref.includes('1 samuel') && chNum <= 15) ||
                       (!ref.includes('2 samuel') && (text.includes('saúl') || text.includes('samuel') || text.includes('ana') || text.includes('elí') || text.includes('cis') || text.includes('jabes') || text.includes('silo')));
            } else if (sectorIdx === 2) {
                // 1 Samuel: David y Goliat (caps 16 a 31)
                return (ref.includes('1 samuel') && chNum > 15) ||
                       (!ref.includes('2 samuel') && (text.includes('goliat') || text.includes('jonatán') || text.includes('adulam') || text.includes('nob') || text.includes('abigail') || text.includes('siclag') || text.includes('gilboa')));
            } else if (sectorIdx === 3) {
                // 2 Samuel: El Reino de David (caps 1 a 12)
                return (ref.includes('2 samuel') && chNum <= 12) ||
                       (text.includes('hebrón') || text.includes('is-boset') || text.includes('abner') || text.includes('sion') || text.includes('obed-edom') || text.includes('mefiboset') || text.includes('betsabé') || text.includes('urías'));
            } else if (sectorIdx === 4) {
                // 2 Samuel: Valientes y Victorias (caps 13 a 24)
                return (ref.includes('2 samuel') && chNum > 12) ||
                       (text.includes('absalón') || text.includes('amón') || text.includes('tamar') || text.includes('joab') || text.includes('ahitofel') || text.includes('husai') || text.includes('seba') || text.includes('valientes') || text.includes('arauna'));
            } else if (sectorIdx === 5) {
                // 1 Reyes: El Templo de Salomón (caps 1 a 11)
                return (ref.includes('1 reyes') && chNum <= 11) ||
                       (text.includes('salomón') || text.includes('adonías') || text.includes('templo') || text.includes('hiram') || text.includes('jaquín') || text.includes('boaz') || text.includes('sabá'));
            } else if (sectorIdx === 6) {
                // 1 Reyes: Elías en el Carmelo (caps 12 a 22)
                return (ref.includes('1 reyes') && chNum > 11) ||
                       (text.includes('elías') || text.includes('carmelo') || text.includes('baal') || text.includes('acab') || text.includes('jezabel') || text.includes('nabot') || text.includes('roboam') || text.includes('jeroboam'));
            } else if (sectorIdx === 7) {
                // 2 Reyes: Eliseo y sus Milagros (caps 1 a 13)
                return (ref.includes('2 reyes') && chNum <= 13) ||
                       (text.includes('eliseo') || text.includes('ocozías') || text.includes('sunamita') || text.includes('naamán') || text.includes('giezi') || text.includes('hacha') || text.includes('carro de fuego'));
            } else {
                // 2 Reyes: Reyes de Judá e Israel (caps 14 a 25)
                return (ref.includes('2 reyes') && chNum > 13) ||
                       (text.includes('jehú') || text.includes('atalía') || text.includes('joás') || text.includes('ezequías') || text.includes('josías') || text.includes('manasés') || text.includes('babilonia') || text.includes('senaquerib'));
            }
        });

        if (filtered.length === 0) {
            filtered = pool;
        }

        const shuffled = [...filtered].sort(() => 0.5 - Math.random());
        const picked = shuffled[0] || allBankQuestions[0] || INITIAL_SEEDED_SIMULACRO_BANK[0];

        res.json({
            sector: sectorIdx,
            sectorName: sector.name,
            totalAvailable: filtered.length,
            question: {
                id: picked.id,
                question_text: picked.question_text,
                option_a: picked.option_a,
                option_b: picked.option_b,
                option_c: picked.option_c || 'Ninguna de las anteriores',
                option_d: picked.option_d || 'Todas las anteriores',
                correct_answer: (picked.correct_answer || 'a').toLowerCase().trim(),
                explanation: picked.explanation || 'Respuesta bíblica oficial NTV.',
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

/**
 * POST /api/simulacro/points/award
 * Transfiere los puntos ganados en cualquier competición de Simulacro
 * directamente a la cuenta del usuario como "Puntos de Sabiduría" en Supabase.
 * Body: { competition: 'fire' | 'david' | 'dado' | 'ruleta', score: number, details?: object }
 */
router.post('/points/award', async (req, res) => {
    try {
        const user = getUserFromReq(req);
        if (!user || !user.id) {
            return res.status(401).json({ error: 'Debes iniciar sesión para acumular puntos de sabiduría.' });
        }

        const userId = user.id;
        const { competition = 'simulacro', score = 0, details = {} } = req.body;
        const pointsToAdd = Math.max(0, parseInt(score, 10) || 0);

        if (pointsToAdd === 0) {
            return res.json({ success: true, pointsAwarded: 0, message: '0 puntos para agregar' });
        }

        const competitionNames = {
            fire: 'Fire Questions',
            david: 'David contra Goliat',
            dado: 'El Dado Dado',
            ruleta: 'La Ruleta Bíblica'
        };
        const compLabel = competitionNames[competition] || 'Simulacro Oficial';

        let newTotalPoints = null;
        try {
            const supabase = getDb();
            // 1. Obtener puntos actuales de la base de datos
            const { data: userData, error: uErr } = await supabase
                .from('users')
                .select('points, username')
                .eq('id', userId)
                .single();

            if (!uErr && userData) {
                const curPts = typeof userData.points === 'number' ? userData.points : 0;
                newTotalPoints = curPts + pointsToAdd;

                // 2. Actualizar en Supabase
                await supabase
                    .from('users')
                    .update({ points: newTotalPoints })
                    .eq('id', userId);

                // 3. Crear notificación interna de recompensa de sabiduría
                await supabase.from('notifications').insert([{
                    user_id: userId,
                    title: `🌟 ¡+${pointsToAdd} Puntos de Sabiduría!`,
                    message: `Has ganado ${pointsToAdd} puntos de sabiduría en ${compLabel}. ¡Nuevo saldo: ${newTotalPoints} pts!`,
                    link: '/profile'
                }]).catch(() => {});
            }
        } catch (dbErr) {
            console.warn('[Simulacro] Error actualizando puntos en Supabase:', dbErr.message);
        }

        // 4. Emitir eventos en tiempo real si io está activo
        if (req.app.get('io')) {
            req.app.get('io').emit('leaderboard-update');
        }

        res.json({
            success: true,
            pointsAwarded: pointsToAdd,
            competition,
            newTotalPoints
        });
    } catch (err) {
        console.error('[Simulacro] Error en /points/award:', err);
        res.status(500).json({ error: 'Error al transferir puntos de sabiduría' });
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
