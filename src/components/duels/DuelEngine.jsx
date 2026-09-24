import { useState, useEffect, useRef } from 'react';
import { api } from '../../utils/api';
import QuestionCard from '../quiz/QuestionCard';
import { Swords, Clock, Loader } from 'lucide-react';

const DuelEngine = ({ duelId, onFinish }) => {
  const [duelData, setDuelData] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [saving, setSaving] = useState(false);
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    fetchDuel();
  }, [duelId]);

  const fetchDuel = async () => {
    try {
      const data = await api.get(`/duels/${duelId}/play`);
      setDuelData(data.duel);
      setQuestions(data.questions);
      startTimeRef.current = Date.now();
    } catch (err) {
      console.error(err);
      alert('Error cargando el duelo.');
      onFinish();
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAnswer = (letter) => {
    const currentQ = questions[currentIndex];
    const isCorrect = currentQ.correct_answer === letter;

    if (isCorrect) {
      setScore(prev => prev + 1);
    }

    // Avanzar a la siguiente
    setTimeout(() => {
      if (currentIndex < questions.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        handleGameOver(score + (isCorrect ? 1 : 0));
      }
    }, 400);
  };

  const handleGameOver = async (finalScoreRaw) => {
    setGameOver(true);
    setSaving(true);
    const finalScore = Math.round((finalScoreRaw / questions.length) * 100);
    const timeSpent = Math.round((Date.now() - startTimeRef.current) / 1000);

    try {
      await api.post(`/duels/${duelId}/submit`, { score: finalScore, time_spent: timeSpent });
      alert('¡Turno completado! Tus resultados han sido guardados.');
      onFinish();
    } catch (err) {
      console.error(err);
      alert('Error guardando resultados.');
      onFinish();
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Loader className="w-10 h-10 animate-spin text-danger" />
        <p className="font-bold text-gray-600">Preparando tu turno en la arena...</p>
      </div>
    );
  }

  if (gameOver) {
    return (
      <div className="text-center py-20">
        <Loader className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
        <p className="font-bold">Guardando resultados del duelo...</p>
      </div>
    );
  }

  const currentQ = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;

  return (
    <div className="max-w-3xl mx-auto bg-white p-6 rounded-xl shadow-lg border-2 border-danger relative overflow-hidden">
      <div className="absolute top-0 right-0 opacity-5 transform translate-x-1/4 -translate-y-1/4">
        <Swords className="w-64 h-64 text-danger" />
      </div>

      <div className="relative z-10">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2 text-danger font-bold">
            <Swords className="w-6 h-6" />
            <span>DUELO BÍBLICO</span>
          </div>
          <div className="flex items-center gap-2 text-gray-500 text-sm font-bold bg-gray-100 px-3 py-1 rounded-full">
            <Clock className="w-4 h-4" />
            Pregunta {currentIndex + 1} de {questions.length}
          </div>
        </div>

        <div className="w-full bg-gray-200 rounded-full h-2 mb-8">
          <div className="bg-danger h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
        </div>

        {currentQ ? (
          <QuestionCard
            question={currentQ}
            selectedAnswer={null}
            onSelect={handleSelectAnswer}
          />
        ) : (
          <p>Error cargando pregunta.</p>
        )}
      </div>
    </div>
  );
};

export default DuelEngine;
