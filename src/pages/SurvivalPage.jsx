import { useState, useEffect } from 'react';
import { Flame, Trophy, Award, Zap } from 'lucide-react';
import SurvivalEngine from '../components/survival/SurvivalEngine';
import { api } from '../utils/api';

const SurvivalPage = () => {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loadingLb, setLoadingLb] = useState(true);

  useEffect(() => {
    fetchSurvivalLeaderboard();
  }, []);

  const fetchSurvivalLeaderboard = async () => {
    try {
      const data = await api.get('/survival/leaderboard');
      setLeaderboard(data || []);
    } catch (err) {
      console.error('Error cargando ranking de supervivencia:', err);
    } finally {
      setLoadingLb(false);
    }
  };

  const getMedal = (index) => {
    if (index === 0) return '🥇';
    if (index === 1) return '🥈';
    if (index === 2) return '🥉';
    return `#${index + 1}`;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center">
        <div className="inline-flex items-center justify-center p-3 bg-red-100 rounded-full mb-3 shadow-xs">
          <Flame className="w-10 h-10 text-danger" />
        </div>
        <h1 className="font-[Cinzel] text-3xl font-bold text-danger mb-2">Modo Supervivencia</h1>
        <p className="text-gray-600 max-w-lg mx-auto text-sm leading-relaxed">
          Responde preguntas aleatorias de todos los libros habilitados. Tienes 3 vidas. Un error y pierdes una vida. ¿Cuántas preguntas puedes sobrevivir?
        </p>

        {/* Banner informativo de puntuación */}
        <div className="mt-4 max-w-xl mx-auto bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 rounded-xl p-3 text-xs text-amber-900 flex items-center justify-center gap-2 shadow-xs">
          <Zap className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <strong>Sistema de Puntuación:</strong> Cada respuesta correcta te otorga <strong>+10 Puntos de Sabiduría</strong> directamente a la <strong>Tabla de Honor</strong>.
          </span>
        </div>
      </div>

      <SurvivalEngine />

      {/* Récords de Supervivencia */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mt-12 max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
          <h3 className="font-cinzel text-lg font-bold text-primary flex items-center gap-2">
            <Trophy className="w-5 h-5 text-gold" />
            Mejores Récords de Supervivencia
          </h3>
          <span className="text-xs text-gray-400 font-medium">Top Jugadores</span>
        </div>

        {loadingLb ? (
          <div className="py-8 text-center text-xs text-gray-400">
            Cargando récords...
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="py-8 text-center text-xs text-gray-500">
            Aún no hay récords registrados. ¡Sé el primero en jugar!
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {leaderboard.map((item, idx) => (
              <div 
                key={item.user_id || idx}
                className="py-3 flex items-center justify-between hover:bg-gray-50/50 px-2 rounded-lg transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg w-7 text-center">{getMedal(idx)}</span>
                  <div>
                    <span className="font-bold text-sm text-gray-800">
                      {item.users?.username || 'Estudiante'}
                    </span>
                    <span className="block text-[11px] text-gray-400">
                      +{item.score * 10} puntos acumulados
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-lg font-black text-danger">
                    {item.score}
                  </span>
                  <span className="block text-[10px] text-gray-500 uppercase tracking-wider font-semibold">
                    Aciertos
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SurvivalPage;
