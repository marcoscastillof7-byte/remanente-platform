import { useState, useEffect, useRef } from 'react';
import { api } from '../../utils/api';
import QuestionCard from '../quiz/QuestionCard';
import { Heart, Trophy, RefreshCw, ArrowLeft, Loader } from 'lucide-react';
import { Link } from 'react-router';

const SurvivalEngine = () => {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lives, setLives] = useState(3);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Para animaciones
  const [wrongAnswerTrigger, setWrongAnswerTrigger] = useState(false);

  useEffect(() => {
    fetchQuestions();
  }, []);

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

  const handleSelectAnswer = async (letter) => {
    const currentQ = questions[currentIndex];
    const isCorrect = currentQ.correct_answer === letter;

    if (isCorrect) {
      setScore(prev => prev + 1);
      // Avanzar rápidamente si es correcto
      setTimeout(() => {
        if (currentIndex < questions.length - 1) {
          setCurrentIndex(prev => prev + 1);
        } else {
          // Si por milagro responde 100 bien, fetch más o termina
          handleGameOver(score + 1);
        }
      }, 500);
    } else {
      // Incorrecto
      setWrongAnswerTrigger(true);
      setTimeout(() => setWrongAnswerTrigger(false), 500);
      
      const newLives = lives - 1;
      setLives(newLives);
      
      if (newLives <= 0) {
        handleGameOver(score);
      } else {
        setTimeout(() => {
          if (currentIndex < questions.length - 1) {
            setCurrentIndex(prev => prev + 1);
          }
        }, 1500);
      }
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
      <div className="bg-white p-8 rounded-xl shadow-lg border-2 border-danger text-center max-w-lg mx-auto mt-12">
        <Trophy className="w-24 h-24 text-gold mx-auto mb-4" />
        <h2 className="font-[Cinzel] text-3xl font-bold text-primary-dark mb-2">¡Fin del Juego!</h2>
        <p className="text-gray-600 mb-6">Perdiste tus 3 vidas.</p>
        
        <div className="bg-gray-50 rounded-xl p-6 mb-8">
          <div className="text-sm text-gray-500 uppercase tracking-wider mb-1">Preguntas Sobrevividas</div>
          <div className="text-6xl font-black text-danger">{score}</div>
        </div>

        <div className="flex justify-center gap-4">
          <button
            onClick={restart}
            disabled={saving}
            className="flex items-center px-6 py-3 bg-danger text-white rounded-lg hover:bg-red-700 transition-colors font-bold"
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

  return (
    <div className={`max-w-2xl mx-auto transition-transform duration-300 ${wrongAnswerTrigger ? 'translate-x-2 -translate-x-2' : ''}`}>
      {/* Header HUD */}
      <div className="flex justify-between items-center mb-8 bg-white p-4 rounded-xl shadow-sm border border-danger/20">
        <div className="flex items-center gap-2">
          {[1, 2, 3].map(heart => (
            <Heart 
              key={heart} 
              className={`w-8 h-8 ${heart <= lives ? 'text-danger fill-danger' : 'text-gray-300'}`} 
            />
          ))}
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-500 uppercase tracking-widest font-bold">Récord Actual</div>
          <div className="text-3xl font-black text-primary">{score}</div>
        </div>
      </div>

      {/* Game Area */}
      {currentQ ? (
        <div className={wrongAnswerTrigger ? 'opacity-80' : ''}>
          {currentQ.chapters && (
            <div className="flex justify-center mb-4">
              <span className="bg-primary-light text-white px-4 py-1.5 rounded-full text-sm font-bold shadow-sm">
                📖 {currentQ.chapters.books?.name} - Capítulo {currentQ.chapters.chapter_number}
              </span>
            </div>
          )}
          <QuestionCard
            question={currentQ}
            selectedAnswer={null} // No mantenemos el estado porque avanza rápido
            onSelect={handleSelectAnswer}
          />
        </div>
      ) : (
        <div className="text-center">Error al cargar pregunta.</div>
      )}
    </div>
  );
};

export default SurvivalEngine;
