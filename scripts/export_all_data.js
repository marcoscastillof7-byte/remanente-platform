import { createClient } from '@supabase/supabase-js';
import Database from 'better-sqlite3';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Faltan las variables de entorno de Supabase en .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const tables = [
  'users',
  'groups',
  'books',
  'chapters',
  'questions',
  'flashcards',
  'quiz_attempts',
  'quiz_answers',
  'custom_quiz_configs',
  'custom_quiz_attempts',
  'custom_quiz_answers',
  'flashcard_progress',
  'achievements',
  'user_achievements',
  'user_notes',
  'study_streaks',
  'duels',
  'meetings'
];

async function fetchAllRows(tableName) {
  const pageSize = 1000;
  let allRows = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .range(from, from + pageSize - 1);

    if (error) {
      console.warn(`  ⚠️ Error en tabla ${tableName}:`, error.message);
      break;
    }

    if (data && data.length > 0) {
      allRows.push(...data);
      if (data.length < pageSize) {
        hasMore = false;
      } else {
        from += pageSize;
      }
    } else {
      hasMore = false;
    }
  }

  return allRows;
}

async function exportAll() {
  const exportDir = path.join(__dirname, '..', 'database_export');
  const jsonDir = path.join(exportDir, 'json');
  const sqlDir = path.join(exportDir, 'sql');
  const sqliteDir = path.join(exportDir, 'sqlite');

  fs.mkdirSync(jsonDir, { recursive: true });
  fs.mkdirSync(sqlDir, { recursive: true });
  fs.mkdirSync(sqliteDir, { recursive: true });

  console.log('========================================================');
  console.log('📦 DESCARGANDO TODA LA BASE DE DATOS DE SUPABASE...');
  console.log('========================================================');

  const allData = {};
  let sqlDump = `-- DUMP COMPLETO DE BASE DE DATOS REMANENTE PLATFORM / OLIMPIADAS BIBLICAS\n`;
  sqlDump += `-- Generado: ${new Date().toISOString()}\n\n`;

  const sqlitePath = path.join(sqliteDir, 'remanente_completa.db');
  if (fs.existsSync(sqlitePath)) {
    fs.unlinkSync(sqlitePath);
  }
  const sqliteDb = new Database(sqlitePath);
  sqliteDb.pragma('journal_mode = WAL');

  for (const tableName of tables) {
    process.stdout.write(`Descargando ${tableName}... `);
    const rows = await fetchAllRows(tableName);
    allData[tableName] = rows;
    console.log(`(${rows.length} registros)`);

    // 1. Guardar JSON individual
    const jsonPath = path.join(jsonDir, `${tableName}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(rows, null, 2), 'utf8');

    // 2. Generar SQL e insertar en SQLite local
    if (rows.length > 0) {
      const sample = rows[0];
      const columns = Object.keys(sample);

      // Crear tabla en SQLite
      const colDefs = columns.map(c => {
        const val = sample[c];
        if (typeof val === 'number') {
          return Number.isInteger(val) ? `"${c}" INTEGER` : `"${c}" REAL`;
        }
        if (typeof val === 'boolean') {
          return `"${c}" INTEGER`;
        }
        return `"${c}" TEXT`;
      }).join(', ');

      const createSql = `CREATE TABLE IF NOT EXISTS "${tableName}" (${colDefs});`;
      sqliteDb.exec(createSql);
      sqlDump += `${createSql}\n`;

      const insertSql = `INSERT INTO "${tableName}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${columns.map(() => '?').join(', ')});`;
      const insertStmt = sqliteDb.prepare(insertSql);

      const insertMany = sqliteDb.transaction((records) => {
        for (const row of records) {
          const values = columns.map(col => {
            const val = row[col];
            if (val === null || val === undefined) return null;
            if (typeof val === 'object') return JSON.stringify(val);
            if (typeof val === 'boolean') return val ? 1 : 0;
            return val;
          });
          insertStmt.run(...values);

          // Agregar al sql dump
          const escapedValues = values.map(v => {
            if (v === null) return 'NULL';
            if (typeof v === 'number') return v;
            return `'${String(v).replace(/'/g, "''")}'`;
          });
          sqlDump += `INSERT INTO "${tableName}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${escapedValues.join(', ')});\n`;
        }
      });

      insertMany(rows);
      sqlDump += `\n`;
    }
  }

  // Guardar archivo global JSON
  fs.writeFileSync(path.join(exportDir, 'base_de_datos_completa.json'), JSON.stringify(allData, null, 2), 'utf8');

  // Guardar SQL Dump
  fs.writeFileSync(path.join(sqlDir, 'remanente_dump.sql'), sqlDump, 'utf8');

  // Crear archivo README descriptivo de la base de datos
  const readmeContent = `# Base de Datos Completa - Remanente Platform / Olimpiadas Bíblicas

Este directorio contiene una copia completa de todas las bases de datos e información descargada de la plataforma:

## Estructura de Archivos:
- \`base_de_datos_completa.json\`: Toda la base de datos en un único archivo JSON consolidado.
- \`json/\`: Cada tabla en su propio archivo JSON independiente (usuarios, preguntas, libros, capítulos, cuestionarios, duelos, reuniones, etc.).
- \`sql/remanente_dump.sql\`: Script SQL estándar con todas las sentencias DDL y DML para restaurar en cualquier motor relacional (PostgreSQL, SQLite, MySQL, etc.).
- \`sqlite/remanente_completa.db\`: Base de datos SQLite completamente funcional y cargada con todos los registros locales.

## Resumen de Tablas Descargadas:
${tables.map(t => `- **${t}**: ${allData[t]?.length || 0} registros`).join('\n')}

Generado automáticamente: ${new Date().toLocaleString()}
`;
  fs.writeFileSync(path.join(exportDir, 'README.md'), readmeContent, 'utf8');

  console.log('\n========================================================');
  console.log('✅ BASE DE DATOS DESCARGADA Y EXPORTADA EXITOSAMENTE');
  console.log('  - JSON individual por tabla en: database_export/json/');
  console.log('  - Base SQLite local en: database_export/sqlite/remanente_completa.db');
  console.log('  - Dump SQL completo en: database_export/sql/remanente_dump.sql');
  console.log('========================================================');
}

exportAll().catch(err => {
  console.error('Fatal error exporting data:', err);
  process.exit(1);
});
