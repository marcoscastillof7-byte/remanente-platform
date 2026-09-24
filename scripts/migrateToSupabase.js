import { createClient } from '@supabase/supabase-js';
import Database from 'better-sqlite3';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Cargar variables de entorno
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Conectar a SQLite local
const dbPath = join(__dirname, '..', 'server', 'db', 'remanente.db');
const db = new Database(dbPath);

// Conectar a Supabase (usando Service Role para saltar políticas de seguridad)
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Error: Faltan las variables de entorno de Supabase en el archivo .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrateTable(tableName) {
    console.log(`\n⏳ Migrando tabla: ${tableName}...`);
    const rows = db.prepare(`SELECT * FROM ${tableName}`).all();
    
    if (rows.length === 0) {
        console.log(`  - No hay datos en ${tableName}`);
        return;
    }

    // Supabase limita la cantidad de registros por inserción, así que insertamos por bloques (chunks)
    const chunkSize = 500;
    let inserted = 0;
    
    for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        
        // Limpiamos datos que puedan chocar (como UUID vs Integer) si es necesario
        // En este caso, el SQL de Postgres ya está configurado para BIGINT
        
        const { error } = await supabase.from(tableName).insert(chunk);
        
        if (error) {
            console.error(`  ❌ Error insertando bloque en ${tableName}:`, error.message);
            console.error("  Detalles:", error.details);
            return;
        }
        inserted += chunk.length;
    }
    
    console.log(`  ✅ ${inserted} registros migrados a ${tableName}.`);
}

async function main() {
    console.log("==================================================");
    console.log("🚀 Iniciando migración de SQLite a Supabase");
    console.log("==================================================");
    
    // El orden es vital para que las llaves foráneas no den error
    const tables = [
        'users',
        'books',
        'chapters',
        'questions',
        'flashcards',
        'achievements',
        'study_streaks'
    ];

    for (const table of tables) {
        await migrateTable(table);
    }

    console.log("\n==================================================");
    console.log("🎉 ¡Migración de datos completada con éxito!");
    console.log("==================================================");
}

main();
