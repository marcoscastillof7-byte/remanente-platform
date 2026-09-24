import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb } from '../server/db/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const questionsDir = path.join(__dirname, '../data/questions');

function importQuestions() {
  if (!fs.existsSync(questionsDir)) {
    console.log('No se encontró el directorio de preguntas:', questionsDir);
    return;
  }

  const files = fs.readdirSync(questionsDir).filter(f => f.endsWith('.json'));
  if (files.length === 0) {
    console.log('No hay archivos JSON en', questionsDir);
    return;
  }

  const db = getDb();
  let totalImported = 0;

  db.transaction(() => {
    for (const file of files) {
      console.log(`Procesando archivo: ${file}...`);
      const filePath = path.join(questionsDir, file);
      const rawData = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(rawData);

      // El formato esperado es:
      // [{ book_id: 1, chapter_number: 1, questions: [ { question_text, option_a, ... } ] }]
      for (const chapterData of data) {
        // Encontrar el chapter_id basado en book_id y chapter_number
        const chapter = db.prepare('SELECT id FROM chapters WHERE book_id = ? AND chapter_number = ?')
                          .get(chapterData.book_id, chapterData.chapter_number);
        
        if (!chapter) {
          console.error(`❌ Capítulo ${chapterData.chapter_number} del libro ID ${chapterData.book_id} no encontrado.`);
          continue;
        }

        const insertStmt = db.prepare(`
          INSERT INTO questions (chapter_id, question_text, option_a, option_b, option_c, option_d, correct_answer, difficulty, explanation, verse_reference)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const q of chapterData.questions) {
          insertStmt.run(
            chapter.id,
            q.question_text,
            q.option_a,
            q.option_b,
            q.option_c,
            q.option_d,
            q.correct_answer,
            q.difficulty || 'medio',
            q.explanation || '',
            q.verse_reference || ''
          );
          totalImported++;
        }
      }
      console.log(`✅ Importado ${file}`);
    }
  })();

  console.log(`\n🎉 Importación completada. Se añadieron ${totalImported} nuevas preguntas a la base de datos.`);
}

importQuestions();
