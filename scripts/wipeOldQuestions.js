import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, '..', 'server', 'db', 'remanente.db');
const db = new Database(dbPath);

console.log("Limpiando la base de datos de preguntas y registros antiguos...");

db.transaction(() => {
    // 1. Borrar dependencias que apuntan a preguntas
    db.prepare('DELETE FROM quiz_answers').run();
    db.prepare('DELETE FROM quiz_attempts').run();
    db.prepare('DELETE FROM custom_quiz_answers').run();
    db.prepare('DELETE FROM custom_quiz_attempts').run();
    
    // Si la tabla reports existe, limpiarla
    try {
        db.prepare('DELETE FROM question_reports').run();
    } catch (e) {
        // Ignorar si no existe
    }

    // 2. Borrar absolutamente TODAS las preguntas viejas
    db.prepare('DELETE FROM questions').run();
})();

console.log("¡Limpieza completa! Cero preguntas antiguas en la base de datos.");
