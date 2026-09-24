import { useState } from 'react';

const FlashcardItem = ({ flashcard }) => {
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <div
      className="perspective-1000 cursor-pointer"
      onClick={() => setIsFlipped(!isFlipped)}
    >
      <div
        className={`relative w-full min-h-[280px] transform-style-3d transition-transform duration-500 ${
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
        <div className="absolute inset-0 backface-hidden rotate-y-180 bg-gradient-to-br from-gold to-gold-dark rounded-2xl p-8 flex flex-col items-center justify-center text-white shadow-lg">
          <div className="text-sm uppercase tracking-widest text-primary-dark mb-4">Respuesta</div>
          <p className="text-xl md:text-2xl text-center font-medium leading-relaxed text-primary-dark">
            {flashcard.back_text}
          </p>
          {flashcard.verse_reference && (
            <div className="mt-6 text-sm text-primary-dark/70 italic">
              📖 {flashcard.verse_reference}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FlashcardItem;
