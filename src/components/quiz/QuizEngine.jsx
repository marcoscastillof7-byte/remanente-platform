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
    // If already answered, ignore (lock answer)
    if (answers[questions[currentIndex].id]) return;

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
  const currentAnswer = answers[currentQ.id];
  const isAnswered = !!currentAnswer;
  const isCorrect = isAnswered && currentAnswer.selectedAnswer === currentQ.correct_answer;

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

      <div className="flex-1 flex flex-col py-4">
        <QuestionCard
          question={currentQ}
          selectedAnswer={currentAnswer?.selectedAnswer}
          onSelect={handleSelectAnswer}
          reviewMode={isAnswered}
          correctAnswer={currentQ.correct_answer}
        />

        {/* Feedback Section */}
        {isAnswered && (
          <div className={`mt-6 p-4 rounded-lg border ${isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <h4 className={`font-bold mb-2 flex items-center gap-2 ${isCorrect ? 'text-green-700' : 'text-red-700'}`}>
              {isCorrect ? '¡Correcto! 🎉' : 'Incorrecto ❌'}
            </h4>
            
            {!isCorrect && (
              <p className="text-sm text-gray-700 mb-2">
                La respuesta correcta era la <span className="font-bold uppercase">{currentQ.correct_answer}</span>.
              </p>
            )}
            
            {currentQ.explanation && (
              <p className="text-sm text-gray-700 mb-2">
                <span className="font-bold">Explicación:</span> {currentQ.explanation}
              </p>
            )}
            
            {currentQ.verse_reference && (
              <p className="text-sm text-blue-700 font-medium">
                📖 {currentQ.verse_reference}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="mt-auto pt-4 border-t border-gray-100 flex justify-end">
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
            disabled={!isAnswered}
            className="px-6 py-2 bg-primary text-white rounded-md disabled:opacity-50 hover:bg-primary-light font-bold transition-colors"
          >
            Siguiente
          </button>
        )}
      </div>
    </div>
  );
};

export default QuizEngine;
