import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Database from 'better-sqlite3';
import dotenv from 'dotenv';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, '..', 'server', 'db', 'remanente.db');
const db = new Database(dbPath);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const delay = ms => new Promise(res => setTimeout(res, ms));

async function main() {
    console.log("==================================================");
    console.log(" Iniciando Motor de Expansión Bíblica Profunda");
    console.log(" Meta: 35 Preguntas por Capítulo (Estilo RV1960)");
    console.log("==================================================\n");

    const chapters = db.prepare(`SELECT c.id, c.chapter_number, b.name as book_name FROM chapters c JOIN books b ON c.book_id = b.id ORDER BY c.id`).all();
    
    for (const chapter of chapters) {
        const countRow = db.prepare(`SELECT COUNT(*) as c FROM questions WHERE chapter_id = ?`).get(chapter.id);
        const currentCount = countRow.c;
        const needed = 35 - currentCount;
        
        if (needed <= 0) {
            console.log(`✅ [${chapter.book_name} Cap. ${chapter.chapter_number}] Ya cuenta con ${currentCount} preguntas. Omitiendo...`);
            continue;
        }
        
        console.log(`⏳ [${chapter.book_name} Cap. ${chapter.chapter_number}] Generando ${needed} preguntas faltantes...`);
        
        const prompt = `Eres un erudito bíblico experto en la traducción Reina-Valera 1960. 
        Analiza detenidamente el libro de ${chapter.book_name}, específicamente el Capítulo ${chapter.chapter_number}.
        Genera EXACTAMENTE ${needed} preguntas de opción múltiple INÉDITAS sobre los eventos de este capítulo exacto.
        
        INSTRUCCIONES DE ESTILO (CRÍTICO):
        - El estilo debe ser extremadamente analítico, profundo y apegado al texto bíblico exacto (RV1960), similar a un estudio exegético riguroso.
        - Usa lenguaje preciso: cita linajes exactos, cantidades, ubicaciones geográficas y frases directas según el versículo.
        - La opción correcta debe ser milimétricamente precisa.
        - La propiedad 'explanation' DEBE ser la respuesta detallada y textual según la Biblia (Ej: "Era de Ramataim de Zofim, del monte de Efraín; hijo de Jeroham...").
        - El 'verse_reference' debe indicar el versículo exacto.
        
        Devuelve ÚNICAMENTE un Array JSON válido, sin bloques de código markdown, con esta estructura:
        [
          {
            "chapter_id": ${chapter.id},
            "question_text": "¿De qué lugar era el hombre llamado Elcana y cuál era su linaje según el versículo 1?",
            "option_a": "Distractor A",
            "option_b": "Era de Ramataim de Zofim...",
            "option_c": "Distractor C",
            "option_d": "Distractor D",
            "correct_answer": "b", 
            "difficulty": "difícil",
            "explanation": "Era de Ramataim de Zofim, del monte de Efraín; «hijo de Jeroham, hijo de Eliú...»",
            "verse_reference": "${chapter.book_name} ${chapter.chapter_number}:1"
          }
        ]`;

        let success = false;
        let attempts = 0;
        
        while (!success && attempts < 5) {
            attempts++;
            try {
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro:generateContent?key=${GEMINI_API_KEY}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: { response_mime_type: "application/json" }
                    })
                });
                
                const data = await response.json();
                
                if (data.error) {
                    console.error(`❌ Error en la API (Intento ${attempts}): ${data.error.message}`);
                    if (data.error.message.includes('Quota exceeded') || data.error.message.includes('429')) {
                        console.log("   ⏳ Límite de velocidad de Google alcanzado. Pausando el motor 60 segundos para enfriar la API...");
                        await delay(62000);
                        continue; // Vuelve a intentar el mismo capítulo
                    } else {
                        break; // Error irrecuperable
                    }
                }
                
                const jsonText = data.candidates[0].content.parts[0].text;
                const parsedQs = JSON.parse(jsonText);
                
                const insertStmt = db.prepare(`
                    INSERT INTO questions (chapter_id, question_text, option_a, option_b, option_c, option_d, correct_answer, difficulty, explanation, verse_reference)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `);
                
                let inserted = 0;
                db.transaction(() => {
                    for (const q of parsedQs) {
                        insertStmt.run(
                            chapter.id, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, 
                            (q.correct_answer || 'a').toLowerCase(), q.difficulty || 'difícil', q.explanation || '', q.verse_reference || ''
                        );
                        inserted++;
                    }
                })();
                
                console.log(`   ✨ ¡Éxito! Se añadieron ${inserted} preguntas profundas a la base de datos.`);
                success = true;
                
            } catch (err) {
                console.error("   ❌ Fallo al procesar el JSON:", err.message);
                console.log("   Reintentando en 10 segundos...");
                await delay(10000);
            }
        }
        
        // Pausa normal de 6 segundos entre capítulos exitosos
        if (success) await delay(6000);
    }
    
    console.log("\n==================================================");
    console.log("🎉 ¡Expansión completada! Tu base de datos es ahora masiva.");
    console.log("==================================================");
}

main();
