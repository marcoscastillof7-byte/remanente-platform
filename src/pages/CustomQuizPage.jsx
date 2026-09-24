import { Settings } from 'lucide-react';

const CustomQuizPage = () => {
  return (
    <div className="max-w-4xl mx-auto flex flex-col items-center justify-center py-20 text-center">
      <div className="bg-gray-100 p-8 rounded-full mb-6">
        <Settings className="w-16 h-16 text-gray-400" />
      </div>
      <h1 className="font-[Cinzel] text-3xl font-bold text-gray-800 mb-4">Quiz Personalizado</h1>
      <div className="bg-yellow-50 border border-yellow-200 p-6 rounded-lg max-w-lg">
        <h2 className="text-xl font-bold text-yellow-800 mb-2">No funcionando actualmente</h2>
        <p className="text-yellow-700">
          Esta sección está en mantenimiento y estará disponible próximamente. Por favor, realiza los quizzes directamente desde la página de cada capítulo.
        </p>
      </div>
    </div>
  );
};

export default CustomQuizPage;
