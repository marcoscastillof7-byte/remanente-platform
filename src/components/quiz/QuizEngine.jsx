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
  const [instantMode, setInstantMode] = useState(false);
  const [reviewedQuestions, setReviewedQuestions] = useState({});
  const questionStartRef = useRef(Date.now());

  const currentQ = questions[currentIndex];
  const isCurrentReviewed = !!reviewedQuestions[currentQ?.id];
  const isPrevReviewed = currentIndex > 0 && !!reviewedQuestions[questions[currentIndex - 1]?.id];
  const canGoBack = currentIndex > 0 && !isCurrentReviewed && !isPrevReviewed;

  const handleSelectAnswer = (letter) => {
    const currentQId = questions[currentIndex].id;
    // Si la pregunta ya fue revisada, la respuesta queda bloqueada permanentemente
    if (reviewedQuestions[currentQId]) return;
    const timeSpent = Math.round((Date.now() - questionStartRef.current) / 1000);
    setAnswers(prev => ({
      ...prev,
      [currentQId]: { selectedAnswer: letter, timeSpent }
    }));
  };

  const handleNext = () => {
    const currentQId = questions[currentIndex].id;
    // Si está en modo instantáneo y no ha revisado la pregunta actual
    if (instantMode && !isCurrentReviewed) {
      if (!answers[currentQId]) {
        alert('Por favor selecciona una respuesta antes de continuar.');
        return;
      }
      setReviewedQuestions(prev => ({ ...prev, [currentQId]: true }));
      return;
    }

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      questionStartRef.current = Date.now();
    }
  };

  const handlePrev = () => {
    if (canGoBack) {
      setCurrentIndex(currentIndex - 1);
      questionStartRef.current = Date.now();
    }
  };

  const handleLastAction = () => {
    const currentQId = questions[currentIndex].id;
    // Si está en modo instantáneo y no ha revisado la última pregunta
    if (instantMode && !isCurrentReviewed) {
      if (!answers[currentQId]) {
        alert('Por favor selecciona una respuesta antes de finalizar.');
        return;
      }
      setReviewedQuestions(prev => ({ ...prev, [currentQId]: true }));
      return;
    }

    if (!allAnswered) {
      const missing = questions.findIndex(q => !answers[q.id]) + 1;
      alert(`Te falta responder la pregunta ${missing}. Por favor, respóndela antes de finalizar.`);
      return;
    }

    handleFinish();
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
        pointsEarned={results.pointsEarned}
        quizPointsEarned={results.quizPointsEarned}
        isSecondAttempt={results.isSecondAttempt}
        streakPointsEarned={results.streakPointsEarned}
        newStreak={results.newStreak}
        isNewDay={results.isNewDay}
      />
    );
  }

  const progress = ((currentIndex + 1) / questions.length) * 100;
  const allAnswered = questions.every(q => answers[q.id]);

  return (
    <div className="bg-white p-6 rounded-xl shadow-md border border-parchment-dark flex-1 flex flex-col">
      <div className="mb-4 flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-100">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-gray-700">Respuesta al instante</span>
          {isCurrentReviewed && (
            <span className="text-[11px] text-amber-600 font-medium">
              🔒 Respuesta revisada (bloqueada para esta pregunta)
            </span>
          )}
        </div>
        <label className={`relative inline-flex items-center ${isCurrentReviewed ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
          <input
            type="checkbox"
            className="sr-only peer"
            checked={instantMode}
            disabled={isCurrentReviewed}
            onChange={() => !isCurrentReviewed && setInstantMode(!instantMode)}
          />
          <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-primary)]"></div>
        </label>
      </div>

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
          reviewMode={isCurrentReviewed}
          correctAnswer={currentQ.correct_answer}
        />
      </div>

      <div className="mt-auto pt-4 border-t border-gray-100 flex justify-between">
        <button
          onClick={handlePrev}
          disabled={!canGoBack}
          className={`px-4 py-2 rounded-md font-medium transition-colors ${
            !canGoBack
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
          title={!canGoBack ? 'No puedes regresar tras haber revisado la respuesta' : ''}
        >
          Anterior
        </button>

        {currentIndex === questions.length - 1 ? (
          <button
            onClick={handleLastAction}
            disabled={submitting}
            className="px-6 py-2 text-white rounded-md font-bold transition-colors flex items-center gap-2 bg-primary hover:bg-primary-light"
          >
            {submitting && <Loader className="w-4 h-4 animate-spin" />}
            {instantMode && !isCurrentReviewed ? 'Revisar' : 'Finalizar Quiz'}
          </button>
        ) : (
          <button
            onClick={handleNext}
            className="px-6 py-2 bg-[var(--color-primary)] text-white rounded-md hover:bg-[var(--color-primary-light)] font-bold transition-colors"
          >
            {instantMode && !isCurrentReviewed ? 'Revisar' : 'Siguiente'}
          </button>
        )}
      </div>
    </div>
  );
};

export default QuizEngine;
