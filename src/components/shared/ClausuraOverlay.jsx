import { useState } from 'react';
import { 
  Trophy, Flame, Sparkles, BookOpen, Award, 
  Heart, Eye, EyeOff, ShieldCheck, ChevronDown, ChevronUp 
} from 'lucide-react';
import { CLAUSURA_CONFIG } from '../../config/clausuraConfig';

export default function ClausuraOverlay() {
  const [minimized, setMinimized] = useState(false);

  // Si el interruptor maestro está apagado, no se renderiza nada
  if (!CLAUSURA_CONFIG.active) return null;

  return (
    <>
      {/* VISTA 1: MODO FLOTANTE MINIMIZADO (PERMITE VER LA PLATAFORMA DE FONDO) */}
      {minimized ? (
        <aside 
          aria-label="Aviso de clausura minimizado"
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] w-[95%] max-w-2xl animate-bounce-subtle"
        >
          <div className="bg-slate-950/95 border-2 border-amber-400/80 rounded-2xl p-3.5 shadow-2xl shadow-amber-500/20 backdrop-blur-xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 to-yellow-400 text-slate-950 flex items-center justify-center font-black shadow-lg">
                <Trophy className="w-5 h-5 text-slate-950" />
              </div>
              <div className="text-left">
                <span className="text-[10px] uppercase font-mono font-extrabold text-amber-400 tracking-wider block">
                  {CLAUSURA_CONFIG.edition}
                </span>
                <h4 className="text-sm sm:text-base font-bold text-white font-[Cinzel] tracking-wide">
                  {CLAUSURA_CONFIG.title}
                </h4>
              </div>
            </div>

            <button
              onClick={() => setMinimized(false)}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs rounded-xl shadow-lg transition transform hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-1.5 shrink-0"
              title="Abrir mensaje oficial de clausura"
            >
              <Eye className="w-4 h-4" />
              <span className="hidden sm:inline">Ver Comunicado Oficial</span>
              <span className="sm:hidden">Ver Mensaje</span>
            </button>
          </div>
        </aside>
      ) : (
        /* VISTA 2: PANTALLA COMPLETA DE CLAUSURA SOLEMNE (SOBRE TODA LA PLATAFORMA) */
        <div 
          role="dialog"
          aria-modal="true"
          aria-labelledby="clausura-modal-title"
          className="fixed inset-0 z-[9999] overflow-y-auto bg-slate-950/85 backdrop-blur-2xl flex items-center justify-center p-3 sm:p-6 transition-all duration-300"
        >
          {/* Destello de fondo y ambientación lumínica */}
          <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-600/15 via-slate-950/40 to-slate-950/95" />

          {/* Tarjeta Monumental de Clausura */}
          <section className="relative w-full max-w-2xl bg-gradient-to-b from-slate-900/98 via-slate-950/98 to-slate-950 border-2 border-amber-500/50 rounded-3xl p-6 sm:p-10 shadow-2xl shadow-amber-500/25 my-8 text-center animate-fadeIn border-t-amber-400">
            
            {/* Corona de Laureles & Emblema Superior */}
            <div className="flex flex-col items-center justify-center space-y-3 mb-6">
              <div className="relative">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-tr from-amber-600 via-yellow-500 to-amber-400 p-1 shadow-xl shadow-amber-500/30 flex items-center justify-center">
                  <div className="w-full h-full bg-slate-950 rounded-[22px] flex items-center justify-center relative overflow-hidden">
                    <Trophy className="w-10 h-10 sm:w-12 sm:h-12 text-amber-400 animate-pulse" />
                    <Sparkles className="w-4 h-4 text-yellow-300 absolute top-2 right-2 animate-ping" />
                  </div>
                </div>

                {/* Insignia 2026 */}
                <div className="absolute -bottom-2 -right-2 px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black font-mono text-[11px] shadow-md border border-yellow-200">
                  2026
                </div>
              </div>

              {/* Distintivo de Clausura */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-mono font-bold tracking-widest uppercase">
                <Flame className="w-3.5 h-3.5 text-amber-400 fill-current" />
                <span>{CLAUSURA_CONFIG.edition}</span>
              </div>

              {/* Título Monumental Oficial */}
              <h1 id="clausura-modal-title" className="text-2xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-200 font-[Cinzel] tracking-wide leading-tight pt-1">
                {CLAUSURA_CONFIG.title}
              </h1>

              <div className="w-32 h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent mt-2" />
            </div>

            {/* CUERPO DEL MENSAJE CON PUNTOS CLAVE SUBRAYADOS */}
            <div className="p-6 sm:p-8 rounded-2xl bg-slate-950/80 border border-slate-800 text-slate-200 text-sm sm:text-base leading-relaxed text-justify sm:text-center space-y-4 shadow-inner">
              
              <p className="font-serif text-slate-100 sm:text-lg leading-relaxed">
                Muchas gracias por utilizar esta plataforma la cual le invertí tiempo, pero{' '}
                <u className="decoration-amber-400 decoration-[2.5px] underline-offset-4 text-amber-200 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded">
                  tiempo que valió la pena
                </u>.
              </p>

              <p className="font-serif text-slate-100 sm:text-lg leading-relaxed">
                Gracias a Dios que me permitió usar mi talento para poder{' '}
                <u className="decoration-amber-400 decoration-[2.5px] underline-offset-4 text-amber-200 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded">
                  ayudar a otros y seguir siendo embajador de su reino
                </u>.
              </p>

              <p className="font-serif text-slate-100 sm:text-lg leading-relaxed">
                <u className="decoration-amber-400 decoration-[2.5px] underline-offset-4 text-amber-200 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded">
                  No pares de estudiar Su palabra y de seguir buscándolo
                </u>.
              </p>

              <p className="font-serif text-slate-100 sm:text-lg leading-relaxed">
                Si Dios lo permite,{' '}
                <u className="decoration-amber-400 decoration-[2.5px] underline-offset-4 text-amber-200 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded">
                  tendremos otra plataforma para el año 2027
                </u>.
              </p>

            </div>

            {/* SELLO Y FIRMA DE MARCOS */}
            <div className="mt-8 pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-left">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-600 via-amber-500 to-yellow-400 flex items-center justify-center text-slate-950 font-black text-xl font-[Cinzel] shadow-lg border border-amber-300">
                  M
                </div>
                <div>
                  <h2 className="text-lg font-black text-white font-[Cinzel] tracking-wider">
                    Un abrazo, Marcos
                  </h2>
                  <p className="text-xs text-amber-400 font-mono flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                    <span>Plataforma Oficial Olimpiadas GVY</span>
                  </p>
                </div>
              </div>

              {/* Botón para inspeccionar la plataforma de fondo */}
              <button
                onClick={() => setMinimized(true)}
                className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-amber-400 text-slate-300 hover:text-white text-xs sm:text-sm font-bold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-md group"
                title="Minimizar comunicado para ver la plataforma y su contenido detrás"
              >
                <Eye className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                <span>Ver plataforma de fondo</span>
              </button>
            </div>

            {/* Cita de Cierre / Esperanza */}
            <div className="mt-5 text-[11px] font-mono text-slate-400 text-center flex items-center justify-center gap-2">
              <BookOpen className="w-3.5 h-3.5 text-amber-400" />
              <span>«La hierba se seca, y la flor se marchita; mas la palabra del Dios nuestro permanece para siempre.»</span>
            </div>

          </section>
        </div>
      )}
    </>
  );
}
