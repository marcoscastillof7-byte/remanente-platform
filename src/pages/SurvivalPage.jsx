import SurvivalEngine from '../components/survival/SurvivalEngine';
import { Flame } from 'lucide-react';

const SurvivalPage = () => {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center p-3 bg-red-100 rounded-full mb-4">
          <Flame className="w-10 h-10 text-danger" />
        </div>
        <h1 className="font-[Cinzel] text-3xl font-bold text-danger mb-2">Modo Supervivencia</h1>
        <p className="text-gray-600 max-w-lg mx-auto">
          Responde preguntas aleatorias de todos los libros. Tienes 3 vidas. Un error y pierdes una vida. ¿Cuántas preguntas puedes sobrevivir?
        </p>
      </div>

      <SurvivalEngine />
    </div>
  );
};

export default SurvivalPage;
