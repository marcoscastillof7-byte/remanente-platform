import { useState, useEffect } from 'react';
import { AlertTriangle, ShieldAlert, X, Check } from 'lucide-react';

export default function DisciplinaryCardModal({ 
  isOpen = false, 
  onClose, 
  players = [], 
  activePlayer = null,
  teams = [], 
  activeTeam = null, 
  onApplyCard, 
  onAnnulQuestion 
}) {
  // Soporte universal para jugadores individuales (prioritario) o equipos
  const participants = (Array.isArray(players) && players.length > 0)
    ? players
    : ((Array.isArray(teams) && teams.length > 0) ? teams : []);

  const initialTarget = activePlayer?.id || activeTeam?.id || participants[0]?.id || '';
  const [selectedParticipantId, setSelectedParticipantId] = useState(initialTarget);
  const [cardType, setCardType] = useState('yellow'); // 'yellow' | 'red'
  const [reason, setReason] = useState('Hablar o interrumpir durante la pregunta');
  const [annulReason, setAnnulReason] = useState('Falla técnica o ambigüedad');

  useEffect(() => {
    if (activePlayer?.id) {
      setSelectedParticipantId(activePlayer.id);
    } else if (activeTeam?.id) {
      setSelectedParticipantId(activeTeam.id);
    } else if (participants.length > 0 && !selectedParticipantId) {
      setSelectedParticipantId(participants[0].id);
    }
  }, [activePlayer, activeTeam, participants, selectedParticipantId]);

  if (!isOpen) return null;

  const handleSubmitCard = (e) => {
    e.preventDefault();
    if (!selectedParticipantId) return;
    if (onApplyCard) {
      onApplyCard({
        playerId: selectedPlayerIdOrTeam(selectedParticipantId),
        teamId: selectedParticipantId,
        cardType,
        reason
      });
    }
    if (onClose) onClose();
  };

  const selectedPlayerIdOrTeam = (id) => id;

  const handleAnnul = () => {
    if (onAnnulQuestion) {
      onAnnulQuestion(annulReason);
    }
    if (onClose) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border-2 border-amber-500/40 rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl text-white space-y-5">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-6 h-6 text-amber-400" />
            <h3 className="text-lg font-bold font-serif text-amber-400">Panel Arbitral y Disciplinario</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sección 1: Tarjetas Disciplinarias */}
        <form onSubmit={handleSubmitCard} className="space-y-4">
          <div className="bg-slate-950/70 p-3.5 rounded-xl border border-white/5 space-y-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-300">
              1. Seleccionar Jugador / Participante a Sancionar:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto pr-1">
              {participants.map(p => {
                const isSelected = String(selectedParticipantId) === String(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedParticipantId(p.id)}
                    className={`p-2 rounded-lg text-xs font-bold border flex items-center gap-1.5 transition-all cursor-pointer truncate ${
                      isSelected 
                        ? 'border-amber-400 bg-amber-500/20 text-white shadow-md ring-1 ring-amber-400' 
                        : 'border-white/10 bg-slate-800 text-gray-400 hover:text-white'
                    }`}
                  >
                    <span>{p.badge || '👤'}</span>
                    <span className="truncate">{p.username || p.name}</span>
                  </button>
                );
              })}
            </div>

            <label className="block text-xs font-bold uppercase tracking-wider text-gray-300 pt-2">
              2. Tipo de Tarjeta:
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setCardType('yellow')}
                className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                  cardType === 'yellow'
                    ? 'border-yellow-400 bg-yellow-500/20 shadow-lg shadow-yellow-500/20'
                    : 'border-white/10 bg-slate-800 hover:border-yellow-500/40 text-gray-400'
                }`}
              >
                <div className="w-8 h-12 bg-yellow-400 rounded-sm shadow border border-yellow-200"></div>
                <span className="text-xs font-black text-yellow-300">TARJETA AMARILLA</span>
                <span className="text-[10px] text-gray-300 text-center">Amonestación verbal</span>
              </button>

              <button
                type="button"
                onClick={() => setCardType('red')}
                className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                  cardType === 'red'
                    ? 'border-red-500 bg-red-500/20 shadow-lg shadow-red-500/20'
                    : 'border-white/10 bg-slate-800 hover:border-red-500/40 text-gray-400'
                }`}
              >
                <div className="w-8 h-12 bg-red-600 rounded-sm shadow border border-red-300"></div>
                <span className="text-xs font-black text-red-400">TARJETA ROJA</span>
                <span className="text-[10px] text-red-200 text-center font-bold">-100 PUNTOS DE PENALIZACIÓN</span>
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1">Motivo de la Sanción:</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full bg-slate-900 border border-white/20 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
              >
                <option value="Hablar o interrumpir durante la formulación o respuesta">Hablar o interrumpir (Silencio en competencia)</option>
                <option value="Soplar respuestas o ayuda externa">Soplar respuestas o recibir ayuda</option>
                <option value="Uso no autorizado de dispositivos o Biblias">Uso no autorizado de celular/dispositivos</option>
                <option value="Conducta antideportiva o reclamo indebido">Conducta antideportiva o reclamo indebido</option>
                <option value="Reiteración de faltas tras amonestación">Reiteración de faltas tras amonestación</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-bold text-xs rounded-xl shadow transition cursor-pointer"
            >
              Aplicar Sanción Disciplinaria
            </button>
          </div>
        </form>

        {/* Sección 2: Anulación de Pregunta */}
        <div className="p-3.5 rounded-xl bg-slate-950/70 border border-white/5 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase text-amber-400">
            <AlertTriangle className="w-4 h-4" />
            <span>Anular Pregunta Actual</span>
          </div>
          <p className="text-[11px] text-gray-400">
            Si hubo una falla técnica, ruido extremo o ambigüedad, el árbitro puede anular la pregunta sin restar puntos.
          </p>
          <div className="flex gap-2 pt-1">
            <input
              type="text"
              value={annulReason}
              onChange={(e) => setAnnulReason(e.target.value)}
              placeholder="Motivo de anulación..."
              className="flex-1 bg-slate-900 border border-white/20 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
            />
            <button
              type="button"
              onClick={handleAnnul}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-yellow-300 font-bold text-xs rounded-lg border border-yellow-500/40 transition cursor-pointer"
            >
              Anular
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
