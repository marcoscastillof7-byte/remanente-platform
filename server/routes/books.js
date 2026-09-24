import express from 'express';
import { getDb } from '../db/database.js';
import jwt from 'jsonwebtoken';

const router = express.Router();
const SECRET = 'remanente_jwt_secret_2024';

const optionalAuth = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (authHeader) {
        const token = authHeader.split(' ')[1];
        try {
            req.user = jwt.verify(token, SECRET);
        } catch (e) {
            // Ignorar
        }
    }
    next();
};

router.get('/', optionalAuth, async (req, res) => {
    try {
        const supabase = getDb();
        const { data: books, error: booksError } = await supabase
            .from('books')
            .select('*')
            .order('order_index');

        if (booksError) throw booksError;

        if (req.user) {
            const userId = req.user.id;
            const { data: attempts, error: attemptsError } = await supabase
                .from('quiz_attempts')
                .select('score, chapter_id, chapters!inner(book_id)')
                .eq('user_id', userId);

            if (!attemptsError && attempts) {
                for (let book of books) {
                    const bookAttempts = attempts.filter(a => a.chapters.book_id === book.id);
                    const uniqueChapters = new Set(bookAttempts.map(a => a.chapter_id));
                    book.chapters_completed = uniqueChapters.size;
                    book.quizzes_completed = bookAttempts.length;
                    const totalScore = bookAttempts.reduce((sum, a) => sum + (a.score || 0), 0);
                    book.avg_score = bookAttempts.length ? Math.round(totalScore / bookAttempts.length) : 0;
                }
            }
        }
        res.json(books);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno' });
    }
});

router.get('/:bookId/chapters', optionalAuth, async (req, res) => {
    try {
        const supabase = getDb();
        const bookId = req.params.bookId;
        
        const { data: book } = await supabase.from('books').select('name').eq('id', bookId).single();
        const { data: chapters, error: chaptersError } = await supabase
            .from('chapters')
            .select('*')
            .eq('book_id', bookId)
            .order('chapter_number');

        if (chaptersError) throw chaptersError;

        if (req.user) {
            const userId = req.user.id;
            const { data: attempts } = await supabase
                .from('quiz_attempts')
                .select('score, chapter_id')
                .eq('user_id', userId);

            for (let chapter of chapters) {
                const chapAttempts = attempts ? attempts.filter(a => a.chapter_id === chapter.id) : [];
                chapter.attempts = chapAttempts.length;
                chapter.best_score = chapAttempts.length ? Math.max(...chapAttempts.map(a => a.score)) : 0;
                const totalScore = chapAttempts.reduce((sum, a) => sum + (a.score || 0), 0);
                chapter.avg_score = chapAttempts.length ? Math.round(totalScore / chapAttempts.length) : 0;
            }
        } else {
            for (let chapter of chapters) {
                chapter.attempts = 0;
                chapter.best_score = 0;
                chapter.avg_score = 0;
            }
        }

        res.json({ bookName: book?.name || 'Libro', chapters });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno' });
    }
});

export default router;
