import { useState } from 'react';

const FlashcardItem = ({ flashcard }) => {
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <div
      className="perspective-1000 cursor-pointer"
      onClick={() => setIsFlipped(!isFlipped)}
    >
      <div
        className={`relative w-full min-h-[350px] transform-style-3d transition-transform duration-500 ${
          isFlipped ? 'rotate-y-180' : ''
        }`}
      >
        {/* Front */}
        <div className="absolute inset-0 backface-hidden bg-gradient-to-br from-primary to-primary-dark rounded-2xl p-8 flex flex-col items-center justify-center text-white shadow-lg">
          <div className="text-sm uppercase tracking-widest text-gold mb-4">Pregunta</div>
          <p className="text-xl md:text-2xl text-center font-medium leading-relaxed">
            {flashcard.front_text}
          </p>
          <div className="mt-6 text-sm opacity-60">Toca para voltear</div>
        </div>

        {/* Back */}
        <div className="absolute inset-0 backface-hidden rotate-y-180 bg-gradient-to-br from-gold to-gold-dark rounded-2xl p-6 flex flex-col items-center justify-center text-white shadow-lg overflow-y-auto">
          <div className="text-sm uppercase tracking-widest text-primary-dark mb-2">Respuesta</div>
          
          <p className="text-xl md:text-2xl text-center font-bold leading-snug text-primary-dark mb-4">
            {flashcard.back_text}
          </p>

          {flashcard.verse_reference && (
            <div className="text-sm font-semibold text-primary-dark mb-4 px-3 py-1 bg-white/30 rounded-full flex items-center shadow-sm">
              📖 {flashcard.verse_reference}
            </div>
          )}

          {flashcard.explanation && (
            <div className="mt-2 text-sm text-primary-dark bg-white/20 p-4 rounded-xl text-center leading-relaxed w-full border border-white/20 shadow-inner">
              <span className="font-bold block mb-1 opacity-80 uppercase text-xs tracking-wider">Explicación</span>
              {flashcard.explanation}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FlashcardItem;
