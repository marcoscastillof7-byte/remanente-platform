import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
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
import notificationRoutes from './routes/notifications.js';
import duelsRoutes from './routes/duels.js';
import survivalRoutes from './routes/survival.js';
import historicalRoutes from './routes/historical.js';
import meetingsRoutes from './routes/meetings.js';
import superAdminRoutes from './routes/superadmin.js';
import groupsRoutes from './routes/groups.js';
import pushRoutes from './routes/push.js';
import simulacroRoutes from './routes/simulacro.js';
import jwt from 'jsonwebtoken';
import { setupMeetSocket, getPlatformOnlineCount, getPlatformOnlineUsers, getPlatformOnlineStats } from './socket/meetSocket.js';
import { setupSimulacroSocket } from './socket/simulacroSocket.js';

const app = express();
app.disable('x-powered-by');
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE']
    },
    pingInterval: 20000,
    pingTimeout: 25000,
    transports: ['websocket', 'polling'],
    allowUpgrades: true,
    maxHttpBufferSize: 1e6
});

app.set('io', io);

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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
router.use('/notifications', notificationRoutes);
router.use('/duels', duelsRoutes);
router.use('/survival', survivalRoutes);
router.use('/historical-details', historicalRoutes);
router.use('/meetings', meetingsRoutes);
router.use('/meets', meetingsRoutes);
router.use('/superadmin', superAdminRoutes);
router.use('/groups', groupsRoutes);
router.use('/push', pushRoutes);
router.use('/simulacro', simulacroRoutes);

// Contador global de usuarios en línea en tiempo real (Lista detallada solo para Admin y Líderes)
router.get('/stats/online', async (req, res) => {
    let isLeaderOrAdmin = false;
    const authHeader = req.headers['authorization'];
    if (authHeader) {
        const token = authHeader.split(' ')[1];
        if (token) {
            try {
                const decoded = jwt.verify(token, 'remanente_jwt_secret_2024');
                const role = (decoded?.role || '').toLowerCase();
                const username = (decoded?.username || '').toLowerCase();
                if (['admin', 'superadmin', 'lider', 'leader'].includes(role) || username === 'marcos') {
                    isLeaderOrAdmin = true;
                }
            } catch (e) {
                // Token inválido o no autenticado, se mantiene en false
            }
        }
    }

    try {
        const stats = await getPlatformOnlineStats();
        res.json({
            onlineCount: stats.onlineCount,
            users: isLeaderOrAdmin ? stats.users : []
        });
    } catch (err) {
        res.json({ 
            onlineCount: getPlatformOnlineCount(),
            users: isLeaderOrAdmin ? getPlatformOnlineUsers() : []
        });
    }
});

// Usar el enrutador para el prefijo /api
app.use('/api', router);

// En caso de usar Netlify functions, esta ruta atrapa la base de la API
app.use('/.netlify/functions/api', router);

// Fallback universal por si serverless-http recorta la ruta base automáticamente
app.use('/', router);

// Configuración de WebSockets en tiempo real para Meets y Simulacro
setupMeetSocket(io);
setupSimulacroSocket(io);

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
