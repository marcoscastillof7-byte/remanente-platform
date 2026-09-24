CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'user' CHECK(role IN ('admin','user')),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS books (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE,
    chapters_count INTEGER,
    description TEXT,
    order_index INTEGER
);

CREATE TABLE IF NOT EXISTS chapters (
    id INTEGER PRIMARY KEY,
    book_id INTEGER REFERENCES books(id),
    chapter_number INTEGER,
    title TEXT,
    summary TEXT
);

CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY,
    chapter_id INTEGER REFERENCES chapters(id),
    question_text TEXT NOT NULL,
    option_a TEXT,
    option_b TEXT,
    option_c TEXT,
    option_d TEXT,
    correct_answer TEXT CHECK(correct_answer IN ('a','b','c','d')),
    difficulty TEXT DEFAULT 'medio',
    explanation TEXT,
    verse_reference TEXT
);

CREATE TABLE IF NOT EXISTS flashcards (
    id INTEGER PRIMARY KEY,
    chapter_id INTEGER REFERENCES chapters(id),
    front_text TEXT,
    back_text TEXT,
    verse_reference TEXT,
    created_by INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS quiz_attempts (
    id INTEGER PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    chapter_id INTEGER REFERENCES chapters(id),
    score INTEGER,
    total_questions INTEGER,
    started_at TEXT,
    completed_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS quiz_answers (
    id INTEGER PRIMARY KEY,
    attempt_id INTEGER REFERENCES quiz_attempts(id),
    question_id INTEGER REFERENCES questions(id),
    selected_answer TEXT,
    is_correct INTEGER,
    time_spent_seconds INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS custom_quiz_configs (
    id INTEGER PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    time_limit INTEGER,
    question_count INTEGER,
    difficulty TEXT,
    books_selected TEXT,
    chapters_selected TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS custom_quiz_attempts (
    id INTEGER PRIMARY KEY,
    config_id INTEGER REFERENCES custom_quiz_configs(id),
    user_id INTEGER REFERENCES users(id),
    score INTEGER,
    total_questions INTEGER,
    started_at TEXT,
    completed_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS custom_quiz_answers (
    id INTEGER PRIMARY KEY,
    attempt_id INTEGER REFERENCES custom_quiz_attempts(id),
    question_id INTEGER REFERENCES questions(id),
    selected_answer TEXT,
    is_correct INTEGER,
    time_spent_seconds INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS flashcard_progress (
    id INTEGER PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    flashcard_id INTEGER REFERENCES flashcards(id),
    confidence_level INTEGER DEFAULT 0,
    last_reviewed TEXT,
    review_count INTEGER DEFAULT 0,
    UNIQUE(user_id, flashcard_id)
);

CREATE TABLE IF NOT EXISTS achievements (
    id INTEGER PRIMARY KEY,
    name TEXT,
    description TEXT,
    icon TEXT,
    criteria_type TEXT,
    criteria_value INTEGER
);

CREATE TABLE IF NOT EXISTS user_achievements (
    id INTEGER PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    achievement_id INTEGER REFERENCES achievements(id),
    earned_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, achievement_id)
);

CREATE TABLE IF NOT EXISTS user_notes (
    id INTEGER PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    chapter_id INTEGER REFERENCES chapters(id),
    content TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT,
    UNIQUE(user_id, chapter_id)
);

CREATE TABLE IF NOT EXISTS study_streaks (
    id INTEGER PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_study_date TEXT
);
