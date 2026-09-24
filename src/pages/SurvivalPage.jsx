import { Flame, Wrench } from 'lucide-react';

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

      <div className="bg-white rounded-xl shadow-md border p-12 text-center">
        <div className="flex justify-center mb-4">
          <Wrench className="w-16 h-16 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">En Mantenimiento 🚧</h2>
        <p className="text-gray-600">
          Estamos ajustando y mejorando el código interno de este modo para darte la mejor experiencia. 
          ¡Estará disponible para el público muy pronto!
        </p>
      </div>
    </div>
  );
};

export default SurvivalPage;
