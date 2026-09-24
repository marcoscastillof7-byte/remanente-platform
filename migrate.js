import { getDb } from './server/db/database.js';

const db = getDb();

console.log("Ejecutando migración para tabla question_reports...");

db.exec(`
  CREATE TABLE IF NOT EXISTS question_reports (
      id INTEGER PRIMARY KEY,
      question_id INTEGER REFERENCES questions(id),
      user_id INTEGER REFERENCES users(id),
      reason TEXT NOT NULL,
      details TEXT,
      status TEXT DEFAULT 'pendiente' CHECK(status IN ('pendiente', 'resuelto', 'descartado')),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

console.log("Migración completada exitosamente.");
