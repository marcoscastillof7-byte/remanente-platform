/**
 * CONFIGURACIÓN CENTRAL DE CLAUSURA DE LA PLATAFORMA
 * 
 * Este interruptor maestro mantiene activo el mensaje solemne de clausura
 * sobre la plataforma. Solo debe ser desactivado (active: false) cuando
 * el propietario lo solicite expresamente en este chat.
 */
export const CLAUSURA_CONFIG = {
  // Estado maestro: true = ACTIVO PERMANENTEMENTE
  active: true,
  
  // Título oficial de gala
  title: "Olimpiadas 2026 finalizadas",
  
  // Subtítulo conmemorativo
  edition: "EDICIÓN BÍBLICA 2026 • CLAUSURA OFICIAL",
  
  // Rúbrica de cierre
  author: "Marcos",
  signatureTitle: "Desarrollador & Embajador del Reino",
  nextYear: "2027"
};
