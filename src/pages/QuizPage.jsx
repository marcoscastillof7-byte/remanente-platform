import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router';
import { api } from '../utils/api';
import QuizEngine from '../components/quiz/QuizEngine';
import { Loader, ArrowLeft } from 'lucide-react';

const QuizPage = () => {
  const { chapterId } = useParams();
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    const fetchQuestionsAndHistory = async () => {
      try {
        const [data, historyData] = await Promise.all([
          api.get(`/quiz/${chapterId}`),
          api.get(`/quiz/history/${chapterId}`).catch(() => [])
        ]);

        if (historyData.length >= 2) {
          setError('Has alcanzado el límite máximo de intentos (2) para este capítulo.');
          setLoading(false);
          return;
        }

        setQuestions(data);
        startTimeRef.current = Date.now();
      } catch (err) {
        setError('Error cargando las preguntas. Intenta de nuevo.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchQuestionsAndHistory();
  }, [chapterId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Loader className="w-10 h-10 animate-spin text-gold" />
        <p className="text-gray-600">Cargando preguntas...</p>
      </div>
    );
  }

  if (error || questions.length === 0) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <p className="text-xl text-gray-600 mb-4">{error || 'No hay preguntas disponibles para este capítulo.'}</p>
        <Link to="/" className="inline-flex items-center px-4 py-2 bg-primary text-white rounded hover:bg-primary-light">
          <ArrowLeft className="w-4 h-4 mr-2" /> Volver al Inicio
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto h-full flex flex-col">
      <QuizEngine questions={questions} chapterId={chapterId} />
    </div>
  );
};

export default QuizPage;
