import { useState } from 'react';
import { Link } from 'react-router';
import { Award, ArrowLeft, RefreshCw, ChevronDown, ChevronUp, Flag } from 'lucide-react';
import QuestionCard from './QuestionCard';
import ReportModal from './ReportModal';

const QuizResults = ({ score, correctCount, totalQuestions, results, questions, chapterId }) => {
  const [expandedQ, setExpandedQ] = useState(null);
  const [reportingQ, setReportingQ] = useState(null);

  let colorClass = 'text-danger';
  if (score >= 80) colorClass = 'text-success';
  else if (score >= 60) colorClass = 'text-warning';

  return (
    <div className="bg-white p-8 rounded-xl shadow-md border border-parchment-dark">
      <div className="text-center mb-8">
        <Award className={`w-20 h-20 mx-auto ${colorClass}`} />
        <h2 className="font-[Cinzel] text-3xl font-bold mt-4 text-primary-dark">¡Quiz Completado!</h2>
        <div className={`text-6xl font-bold mt-4 ${colorClass}`}>{score}%</div>
        <p className="text-lg text-gray-600 mt-2">Aciertos: {correctCount} de {totalQuestions}</p>
      </div>

      <div className="flex justify-center gap-4 mb-8">
        <button
          onClick={() => window.location.reload()}
          className="flex items-center px-4 py-2 bg-gold text-white rounded-md hover:bg-gold-dark transition-colors"
        >
          <RefreshCw className="w-4 h-4 mr-2" /> Intentar de Nuevo
        </button>
        <Link
          to="/"
          className="flex items-center px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> Volver al Inicio
        </Link>
      </div>

      <div className="border-t border-gray-200 pt-8">
        <h3 className="font-[Cinzel] text-xl font-bold mb-4">Revisión de Respuestas</h3>
        <div className="space-y-4">
          {results && results.map((result, i) => {
            const question = questions.find(q => q.id === result.questionId) || {};
            const isExpanded = expandedQ === i;

            return (
              <div key={i} className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpandedQ(isExpanded ? null : i)}
                  className={`w-full flex items-center justify-between p-4 text-left ${result.isCorrect ? 'bg-green-50' : 'bg-red-50'}`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${result.isCorrect ? 'bg-green-500' : 'bg-red-500'}`}>
                      {i + 1}
                    </span>
                    <span className="text-sm md:text-base font-medium truncate max-w-md">
                      {question.question_text || `Pregunta ${i + 1}`}
                    </span>
                  </div>
                  {isExpanded ? <ChevronUp className="w-5 h-5 shrink-0" /> : <ChevronDown className="w-5 h-5 shrink-0" />}
                </button>

                {isExpanded && (
                  <div className="p-4 bg-white">
                    <QuestionCard
                      question={question}
                      selectedAnswer={result.selectedAnswer}
                      correctAnswer={result.correctAnswer}
                      reviewMode={true}
                    />
                    {result.explanation && (
                      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
                        <p className="text-sm font-bold text-primary mb-1">
                          Explicación ({result.verseReference}):
                        </p>
                        <p className="text-sm text-gray-700">{result.explanation}</p>
                      </div>
                    )}
                    <div className="mt-4 flex justify-end">
                      <button 
                        onClick={() => setReportingQ(question)} 
                        className="flex items-center gap-1 text-sm text-danger hover:text-red-700 font-medium bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <Flag className="w-4 h-4" /> Reportar Pregunta
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      
      {reportingQ && (
        <ReportModal 
          question={reportingQ} 
          onClose={() => setReportingQ(null)} 
        />
      )}
    </div>
  );
};

export default QuizResults;
