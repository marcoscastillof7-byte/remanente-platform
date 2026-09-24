import { useState } from 'react';
import FlashcardItem from './FlashcardItem';
import { api } from '../../utils/api';
import { ChevronLeft, ChevronRight, RotateCcw, Flag } from 'lucide-react';
import ReportModal from '../quiz/ReportModal';

const FlashcardDeck = ({ flashcards, chapterId }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [confidences, setConfidences] = useState({});
  const [reportingQ, setReportingQ] = useState(null);

  const handleConfidence = async (level) => {
    const fc = flashcards[currentIndex];
    setConfidences(prev => ({ ...prev, [fc.id]: level }));

    try {
      await api.put(`/flashcards/${fc.id}/progress`, { confidence_level: level });
    } catch (err) {
      console.error(err);
    }

    if (currentIndex < flashcards.length - 1) {
      setTimeout(() => setCurrentIndex(currentIndex + 1), 300);
    }
  };

  const confidenceLabels = [
    { level: 0, label: 'No lo sé', color: 'bg-red-500 hover:bg-red-600' },
    { level: 1, label: 'Más o menos', color: 'bg-yellow-500 hover:bg-yellow-600' },
    { level: 2, label: 'Lo sé', color: 'bg-blue-500 hover:bg-blue-600' },
    { level: 3, label: 'Dominado', color: 'bg-green-500 hover:bg-green-600' },
  ];

  const current = flashcards[currentIndex];
  const isLastCard = currentIndex === flashcards.length - 1;
  const allReviewed = Object.keys(confidences).length === flashcards.length;

  return (
    <div>
      {/* Progress */}
      <div className="flex justify-between text-sm text-gray-500 mb-2">
        <span>Tarjeta {currentIndex + 1} de {flashcards.length}</span>
        <span>{Object.keys(confidences).length} revisadas</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
        <div
          className="bg-gold h-2 rounded-full transition-all duration-300"
          style={{ width: `${((currentIndex + 1) / flashcards.length) * 100}%` }}
        ></div>
      </div>

      {/* Card */}
      <FlashcardItem flashcard={current} />

      {/* Confidence Buttons */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-2">
        {confidenceLabels.map(({ level, label, color }) => (
          <button
            key={level}
            onClick={() => handleConfidence(level)}
            className={`py-3 px-4 text-white rounded-lg text-sm font-medium transition-colors ${color}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Navigation */}
      <div className="mt-6 flex justify-between items-center">
        <button
          onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
          disabled={currentIndex === 0}
          className="flex items-center gap-1 px-4 py-2 bg-gray-100 rounded disabled:opacity-50 hover:bg-gray-200 text-sm"
        >
          <ChevronLeft className="w-4 h-4" /> Anterior
        </button>

        {allReviewed && (
          <button
            onClick={() => { setCurrentIndex(0); setConfidences({}); }}
            className="flex items-center gap-1 px-4 py-2 bg-gold text-white rounded hover:bg-gold-dark text-sm"
          >
            <RotateCcw className="w-4 h-4" /> Repetir
          </button>
        )}

        <button
          onClick={() => setCurrentIndex(Math.min(flashcards.length - 1, currentIndex + 1))}
          disabled={isLastCard}
          className="flex items-center gap-1 px-4 py-2 bg-gray-100 rounded disabled:opacity-50 hover:bg-gray-200 text-sm"
        >
          Siguiente <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Summary */}
      {allReviewed && (
        <div className="mt-8 bg-white rounded-xl p-6 border shadow-sm">
          <h3 className="font-[Cinzel] text-lg font-bold text-primary mb-4">Resumen</h3>
          <div className="grid grid-cols-4 gap-4 text-center">
            {confidenceLabels.map(({ level, label }) => {
              const count = Object.values(confidences).filter(c => c === level).length;
              return (
                <div key={level}>
                  <div className="text-2xl font-bold text-primary">{count}</div>
                  <div className="text-xs text-gray-500">{label}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Report Button */}
      <div className="mt-6 flex justify-center border-t border-gray-100 pt-4">
        <button 
          onClick={() => setReportingQ({ id: current.id, question_text: current.front_text })} 
          className="flex items-center gap-1 text-sm text-danger hover:text-red-700 font-medium bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors"
        >
          <Flag className="w-4 h-4" /> Reportar Error en Tarjeta
        </button>
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

export default FlashcardDeck;
