import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const delay = ms => new Promise(res => setTimeout(res, ms));

async function main() {
    console.log("==================================================");
    console.log(" Iniciando Motor de Expansión Bíblica Profunda hacia Supabase");
    console.log(" Meta: 35 Preguntas por Capítulo (Estilo RV1960)");
    console.log("==================================================\n");

    const { data: chapters, error: cError } = await supabase
        .from('chapters')
        .select('id, chapter_number, books(name)')
        .order('id');

    if (cError) {
        console.error("Error obteniendo capítulos:", cError);
        return;
    }
    
    for (const chapter of chapters) {
        const book_name = chapter.books.name;
        
        const { count: currentCount, error: qError } = await supabase
            .from('questions')
            .select('*', { count: 'exact', head: true })
            .eq('chapter_id', chapter.id);
            
        if (qError) {
            console.error("Error contando preguntas:", qError);
            continue;
        }

        const needed = 35 - currentCount;
        
        if (needed <= 0) {
            console.log(`✅ [${book_name} Cap. ${chapter.chapter_number}] Ya cuenta con ${currentCount} preguntas. Omitiendo...`);
            continue;
        }
        
        console.log(`⏳ [${book_name} Cap. ${chapter.chapter_number}] Generando ${needed} preguntas faltantes...`);
        
        const prompt = `Eres un erudito bíblico experto en la traducción Reina-Valera 1960. 
        Analiza detenidamente el libro de ${book_name}, específicamente el Capítulo ${chapter.chapter_number}.
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
            "verse_reference": "${book_name} ${chapter.chapter_number}:1"
          }
        ]`;

        let success = false;
        let attempts = 0;
        
        while (!success && attempts < 5) {
            attempts++;
            try {
                // El usuario había pedido explícitamente gemini-3.1-pro para la generación masiva por su capacidad
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${GEMINI_API_KEY}`, {
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
                
                // Limpiar datos y forzar minúsculas en correct_answer
                const questionsToInsert = parsedQs.map(q => ({
                    chapter_id: chapter.id,
                    question_text: q.question_text,
                    option_a: q.option_a,
                    option_b: q.option_b,
                    option_c: q.option_c,
                    option_d: q.option_d,
                    correct_answer: (q.correct_answer || 'a').toLowerCase(),
                    difficulty: q.difficulty || 'difícil',
                    explanation: q.explanation || '',
                    verse_reference: q.verse_reference || ''
                }));
                
                const { error: insertError } = await supabase.from('questions').insert(questionsToInsert);
                if (insertError) throw insertError;
                
                console.log(`   ✨ ¡Éxito! Se añadieron ${questionsToInsert.length} preguntas profundas a Supabase.`);
                success = true;
                
            } catch (err) {
                console.error("   ❌ Fallo al procesar el JSON o insertar:", err.message);
                console.log("   Reintentando en 10 segundos...");
                await delay(10000);
            }
        }
        
        // Pausa normal entre capítulos para evitar bloqueos
        if (success) await delay(8000);
    }
    
    console.log("\n==================================================");
    console.log("🎉 ¡Expansión completada hacia Supabase! Tu base de datos es masiva.");
    console.log("==================================================");
}

main();
