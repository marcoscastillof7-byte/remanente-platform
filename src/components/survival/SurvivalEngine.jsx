import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import QuestionCard from '../quiz/QuestionCard';
import { 
  Heart, 
  Trophy, 
  RefreshCw, 
  ArrowLeft, 
  ArrowRight, 
  Loader, 
  CheckCircle, 
  XCircle 
} from 'lucide-react';
import { Link } from 'react-router';

const SurvivalEngine = () => {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lives, setLives] = useState(3);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Estado para la respuesta actual y revisión paso a paso
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [isReviewed, setIsReviewed] = useState(false);
  
  // Para animaciones
  const [wrongAnswerTrigger, setWrongAnswerTrigger] = useState(false);

  useEffect(() => {
    fetchQuestions();
  }, []);

  // Atajo de teclado (Enter para Revisar y para Siguiente)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Enter') {
        if (!isReviewed && selectedAnswer) {
          handleReview();
        } else if (isReviewed) {
          if (lives <= 0) {
            handleGameOver(score);
          } else {
            handleNext();
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isReviewed, selectedAnswer, lives, score, currentIndex, questions]);

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const data = await api.get('/survival/start');
      setQuestions(data);
    } catch (err) {
      console.error(err);
      alert('Error cargando preguntas de supervivencia');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAnswer = (letter) => {
    // Si ya fue revisada, queda bloqueada permanentemente
    if (isReviewed) return;
    setSelectedAnswer(letter);
  };

  const handleReview = () => {
    if (!selectedAnswer) return;

    const currentQ = questions[currentIndex];
    const isCorrect = currentQ.correct_answer === selectedAnswer;

    setIsReviewed(true);

    if (isCorrect) {
      setScore(prev => prev + 1);
    } else {
      setWrongAnswerTrigger(true);
      setTimeout(() => setWrongAnswerTrigger(false), 600);
      setLives(prev => prev - 1);
    }
  };

  const handleNext = () => {
    if (lives <= 0) {
      handleGameOver(score);
      return;
    }

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setIsReviewed(false);
    } else {
      // Si respondió todas las preguntas de la tanda
      handleGameOver(score);
    }
  };

  const handleGameOver = async (finalScore) => {
    setGameOver(true);
    setSaving(true);
    try {
      await api.post('/survival/submit', { score: finalScore });
    } catch (err) {
      console.error('Error guardando score:', err);
    } finally {
      setSaving(false);
    }
  };

  const restart = () => {
    setLives(3);
    setScore(0);
    setGameOver(false);
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setIsReviewed(false);
    fetchQuestions();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Loader className="w-10 h-10 animate-spin text-danger" />
        <p className="text-gray-600 font-bold">Preparando Supervivencia...</p>
      </div>
    );
  }

  if (gameOver) {
    return (
      <div className="bg-white p-8 rounded-xl shadow-lg border-2 border-danger text-center max-w-lg mx-auto mt-12 animate-fade-in">
        <Trophy className="w-24 h-24 text-gold mx-auto mb-4" />
        <h2 className="font-[Cinzel] text-3xl font-bold text-primary-dark mb-2">¡Fin del Juego!</h2>
        <p className="text-gray-600 mb-6">Perdiste tus 3 vidas.</p>
        
        <div className="bg-gray-50 rounded-xl p-6 mb-8 border border-gray-100">
          <div className="text-sm text-gray-500 uppercase tracking-wider mb-1">Preguntas Sobrevividas</div>
          <div className="text-6xl font-black text-danger">{score}</div>
        </div>

        <div className="flex justify-center gap-4">
          <button
            onClick={restart}
            disabled={saving}
            className="flex items-center px-6 py-3 bg-danger text-white rounded-lg hover:bg-red-700 transition-colors font-bold cursor-pointer shadow-md disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 mr-2 ${saving ? 'animate-spin' : ''}`} /> 
            {saving ? 'Guardando...' : 'Reintentar'}
          </button>
          <Link
            to="/"
            className="flex items-center px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-bold"
          >
            <ArrowLeft className="w-5 h-5 mr-2" /> Salir
          </Link>
        </div>
      </div>
    );
  }

  const currentQ = questions[currentIndex];
  const isCorrect = isReviewed && currentQ && currentQ.correct_answer === selectedAnswer;

  return (
    <div className={`max-w-2xl mx-auto transition-transform duration-300 ${wrongAnswerTrigger ? 'translate-x-2 -translate-x-2' : ''}`}>
      {/* Header HUD */}
      <div className="flex justify-between items-center mb-6 bg-white p-4 rounded-xl shadow-sm border border-danger/20">
        <div className="flex items-center gap-2">
          {[1, 2, 3].map(heart => (
            <Heart 
              key={heart} 
              className={`w-8 h-8 transition-all duration-300 ${
                heart <= lives 
                  ? 'text-danger fill-danger scale-100' 
                  : 'text-gray-200 scale-90'
              }`} 
            />
          ))}
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-500 uppercase tracking-widest font-bold">Récord Actual</div>
          <div className="text-3xl font-black text-primary">{score}</div>
        </div>
      </div>

      {/* Game Area */}
      {currentQ ? (
        <div className="bg-white p-6 rounded-xl shadow-md border border-parchment-dark flex flex-col">
          {currentQ.chapters && (
            <div className="flex justify-center mb-4">
              <span className="bg-primary-light text-white px-4 py-1 rounded-full text-xs font-bold shadow-xs">
                📖 {currentQ.chapters.books?.name} - Capítulo {currentQ.chapters.chapter_number}
              </span>
            </div>
          )}

          <div className="py-2">
            <QuestionCard
              question={currentQ}
              selectedAnswer={selectedAnswer}
              onSelect={handleSelectAnswer}
              reviewMode={isReviewed}
              correctAnswer={currentQ.correct_answer}
            />
          </div>

          {/* Banner de resultado al revisar */}
          {isReviewed && (
            <div className={`mt-4 p-3.5 rounded-xl text-xs font-bold flex items-center justify-between border animate-fade-in ${
              isCorrect
                ? 'bg-green-50 text-green-800 border-green-200'
                : 'bg-red-50 text-red-800 border-red-200'
            }`}>
              <div className="flex items-center gap-2">
                {isCorrect ? (
                  <>
                    <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
                    <span>¡Respuesta correcta! (+1 punto al récord)</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5 text-red-600 shrink-0" />
                    <span>
                      {lives <= 0 
                        ? '¡Respuesta incorrecta! Has perdido tu última vida 💔' 
                        : `¡Respuesta incorrecta! Has perdido 1 vida (Te ${lives === 1 ? 'queda 1 vida' : `quedan ${lives} vidas`})`}
                    </span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Barra de acción: Revisar / Siguiente */}
          <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between">
            <div className="text-xs text-gray-400">
              {isReviewed ? (
                <span className="text-amber-600 font-medium">🔒 Respuesta bloqueada</span>
              ) : (
                <span>Selecciona tu respuesta y pulsa Revisar</span>
              )}
            </div>

            {!isReviewed ? (
              <button
                onClick={handleReview}
                disabled={!selectedAnswer}
                className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-md flex items-center gap-2 cursor-pointer ${
                  !selectedAnswer
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-primary text-gold hover:bg-primary-light hover:shadow-lg'
                }`}
              >
                Revisar
              </button>
            ) : lives <= 0 ? (
              <button
                onClick={() => handleGameOver(score)}
                disabled={saving}
                className="px-6 py-2.5 bg-danger hover:bg-red-700 text-white rounded-xl font-bold text-sm transition-all shadow-md flex items-center gap-2 cursor-pointer animate-pulse"
              >
                {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Trophy className="w-4 h-4 text-gold" />}
                Ver Resultados
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="px-6 py-2.5 bg-primary hover:bg-primary-light text-white rounded-xl font-bold text-sm transition-all shadow-md flex items-center gap-2 cursor-pointer hover:shadow-lg"
              >
                Siguiente
                <ArrowRight className="w-4 h-4 text-gold" />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center p-8 bg-white rounded-xl">Error al cargar pregunta.</div>
      )}
    </div>
  );
};

export default SurvivalEngine;
