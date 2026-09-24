import { useState, useRef } from 'react';
import { api } from '../../utils/api';
import QuestionCard from './QuestionCard';
import QuizResults from './QuizResults';
import { Loader } from 'lucide-react';

const QuizEngine = ({ questions, chapterId, isCustom = false, configId = null }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [results, setResults] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const questionStartRef = useRef(Date.now());

  const handleSelectAnswer = (letter) => {
    const timeSpent = Math.round((Date.now() - questionStartRef.current) / 1000);
    setAnswers(prev => ({
      ...prev,
      [questions[currentIndex].id]: { selectedAnswer: letter, timeSpent }
    }));
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      questionStartRef.current = Date.now();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      questionStartRef.current = Date.now();
    }
  };

  const handleFinish = async () => {
    setSubmitting(true);
    try {
      const answersList = questions.map(q => ({
        questionId: q.id,
        selectedAnswer: answers[q.id]?.selectedAnswer || null,
        timeSpent: answers[q.id]?.timeSpent || 0,
      }));

      let data;
      if (isCustom && configId) {
        data = await api.post(`/custom-quiz/${configId}/submit`, { answers: answersList });
      } else {
        data = await api.post(`/quiz/${chapterId}/submit`, { answers: answersList });
      }
      setResults(data);
    } catch (err) {
      console.error('Error enviando respuestas:', err);
      alert('Error al enviar las respuestas. Intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  if (results) {
    return (
      <QuizResults
        score={results.score}
        correctCount={results.correctCount}
        totalQuestions={results.totalQuestions}
        results={results.results}
        questions={questions}
        chapterId={chapterId}
      />
    );
  }

  const currentQ = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;
  const allAnswered = questions.every(q => answers[q.id]);

  return (
    <div className="bg-white p-6 rounded-xl shadow-md border border-parchment-dark flex-1 flex flex-col">
      <div className="mb-4">
        <div className="flex justify-between text-sm text-gray-500 mb-2">
          <span>Pregunta {currentIndex + 1} de {questions.length}</span>
          <span>{Object.keys(answers).length} respondidas</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div className="bg-gold h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center py-8">
        <QuestionCard
          question={currentQ}
          selectedAnswer={answers[currentQ.id]?.selectedAnswer}
          onSelect={handleSelectAnswer}
        />
      </div>

      <div className="mt-auto pt-4 border-t border-gray-100 flex justify-between">
        <button
          onClick={handlePrev}
          disabled={currentIndex === 0}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md disabled:opacity-50 hover:bg-gray-200 transition-colors"
        >
          Anterior
        </button>
        {currentIndex === questions.length - 1 ? (
          <button
            onClick={handleFinish}
            disabled={!allAnswered || submitting}
            className="px-6 py-2 bg-primary text-white rounded-md disabled:opacity-50 hover:bg-primary-light font-bold transition-colors flex items-center gap-2"
          >
            {submitting && <Loader className="w-4 h-4 animate-spin" />}
            Finalizar Quiz
          </button>
        ) : (
          <button
            onClick={handleNext}
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-light transition-colors"
          >
            Siguiente
          </button>
        )}
      </div>
    </div>
  );
};

export default QuizEngine;
