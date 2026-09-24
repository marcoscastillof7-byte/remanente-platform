import { CheckCircle, XCircle } from 'lucide-react';

const options = [
  { key: 'a', label: 'A' },
  { key: 'b', label: 'B' },
  { key: 'c', label: 'C' },
  { key: 'd', label: 'D' },
];

const QuestionCard = ({ question, selectedAnswer, onSelect, reviewMode = false, correctAnswer = null }) => {
  const getOptionText = (key) => {
    return question[`option_${key}`];
  };

  return (
    <div className="w-full max-w-2xl">
      <h2 className="text-xl font-medium text-primary-dark mb-6 leading-relaxed">
        {question.question_text}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {options.map(({ key, label }) => {
          const text = getOptionText(key);
          if (!text) return null;

          let bgColor = 'bg-gray-50';
          let borderColor = 'border-gray-200';
          let textColor = 'text-gray-700';

          if (reviewMode) {
            if (key === correctAnswer) {
              bgColor = 'bg-green-100';
              borderColor = 'border-green-500';
              textColor = 'text-green-800';
            } else if (key === selectedAnswer && key !== correctAnswer) {
              bgColor = 'bg-red-100';
              borderColor = 'border-red-500';
              textColor = 'text-red-800';
            }
          } else {
            if (key === selectedAnswer) {
              bgColor = 'bg-parchment-dark';
              borderColor = 'border-gold';
              textColor = 'text-primary-dark';
            }
          }

          return (
            <button
              key={key}
              onClick={() => !reviewMode && onSelect(key)}
              disabled={reviewMode}
              className={`p-4 rounded-lg border-2 text-left transition-all ${bgColor} ${borderColor} ${textColor} ${!reviewMode && 'hover:bg-gray-100 hover:border-gray-300 cursor-pointer'}`}
            >
              <div className="flex justify-between items-center">
                <span className="text-sm md:text-base">{label}. {text}</span>
                {reviewMode && key === correctAnswer && <CheckCircle className="w-5 h-5 text-green-600 shrink-0 ml-2" />}
                {reviewMode && key === selectedAnswer && key !== correctAnswer && <XCircle className="w-5 h-5 text-red-600 shrink-0 ml-2" />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default QuestionCard;
