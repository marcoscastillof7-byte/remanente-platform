import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

import { getDb } from './db/database.js';
import authRoutes from './routes/auth.js';
import booksRoutes from './routes/books.js';
import quizzesRoutes from './routes/quizzes.js';
import flashcardsRoutes from './routes/flashcards.js';
import customQuizRoutes from './routes/customQuiz.js';
import adminRoutes from './routes/admin.js';
import notesRoutes from './routes/notes.js';
import leaderboardRoutes from './routes/leaderboard.js';
import reportsRoutes from './routes/reports.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE']
    }
});

app.set('io', io);

app.use(cors());
app.use(express.json());

// Verifica la conexión a Supabase al iniciar
const db = getDb();
console.log('Conectado a Supabase exitosamente.');

// Routes
// Si estamos en Netlify (Serverless), las rutas base pueden cambiar dependiendo del build,
// pero mantenemos /api/ por defecto.
const router = express.Router();

router.use('/auth', authRoutes);
router.use('/books', booksRoutes);
router.use('/quiz', quizzesRoutes);
router.use('/flashcards', flashcardsRoutes);
router.use('/custom-quiz', customQuizRoutes);
router.use('/admin', adminRoutes);
router.use('/notes', notesRoutes);
router.use('/leaderboard', leaderboardRoutes);
router.use('/reports', reportsRoutes);

// Usar el enrutador para el prefijo /api
app.use('/api', router);

// En caso de usar Netlify functions, esta ruta atrapa la base de la API
app.use('/.netlify/functions/api', router);

// Fallback universal por si serverless-http recorta la ruta base automáticamente
app.use('/', router);

io.on('connection', (socket) => {
    console.log('User connected via Socket.io');
    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

// Exportamos 'app' para poder usarlo en serverless-http
export { app };

// Si se ejecuta directamente (no a través de un import/serverless)
if (process.env.NODE_ENV !== 'production' || process.env.RUN_LOCAL) {
    const PORT = 3001;
    httpServer.listen(PORT, () => {
        console.log(`Remanente Platform servidor iniciado en puerto ${PORT}`);
    });
}
