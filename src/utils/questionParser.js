/**
 * Utilidad de parsing ultra-robusta y tolerante a fallos para preguntas de Remanente Platform.
 * Soporta:
 * 1. Formato estándar de la plataforma (LIBRO:, CAPÍTULO:, PREGUNTA:, A., B., C., D., RESPUESTA:, EXPLICACIÓN:, VERSÍCULO:)
 * 2. Formatos numerados (1. ..., 1) ..., 1- ...)
 * 3. Formato JSON ([ { question_text, option_a, ... } ])
 * 4. Variaciones de opciones con punto, paréntesis, guion o dos puntos (A., A), A -, A:)
 * 5. Respuestas con mayúsculas/minúsculas y corchetes (RESPUESTA: A, RESPUESTA: [A], RESPUESTA CORRECTA: B)
 */
export function parseQuestionsText(rawText) {
  if (!rawText || !rawText.trim()) return [];

  const trimmed = rawText.trim();

  // 1. Detección de formato JSON directo
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsedJson = JSON.parse(trimmed);
      if (Array.isArray(parsedJson) && parsedJson.length > 0) {
        return parsedJson.map((q, idx) => ({
          id: q.id || `q_json_${Date.now()}_${idx}`,
          question_text: q.question_text || q.question || q.pregunta || '',
          option_a: q.option_a || q.a || q.opcion_a || '',
          option_b: q.option_b || q.b || q.opcion_b || '',
          option_c: q.option_c || q.c || q.opcion_c || '',
          option_d: q.option_d || q.d || q.opcion_d || '',
          correct_answer: String(q.correct_answer || q.correct || q.respuesta || 'a').toLowerCase().trim(),
          explanation: q.explanation || q.explicacion || '',
          verse_reference: q.verse_reference || q.versiculo || q.cita || '',
          time_limit_seconds: Number(q.time_limit_seconds) || 25
        })).filter(q => q.question_text && (q.option_a || q.option_b));
      }
    } catch {
      // Si falla como JSON, continuamos con parser de texto
    }
  }

  // 2. Parser tolerante a fallos línea por línea
  const lines = trimmed.split(/\r?\n/).map(l => l.trim());
  const questions = [];
  let currentQ = null;

  const pushCurrent = () => {
    if (currentQ && currentQ.question_text && (currentQ.option_a || currentQ.option_b)) {
      questions.push({
        id: currentQ.id || `q_${Date.now()}_${questions.length}_${Math.random().toString(36).substring(7)}`,
        question_text: currentQ.question_text.trim(),
        option_a: currentQ.option_a ? currentQ.option_a.trim() : 'Opción A',
        option_b: currentQ.option_b ? currentQ.option_b.trim() : 'Opción B',
        option_c: currentQ.option_c ? currentQ.option_c.trim() : 'Opción C',
        option_d: currentQ.option_d ? currentQ.option_d.trim() : 'Opción D',
        correct_answer: (currentQ.correct_answer || 'a').toLowerCase().trim(),
        explanation: currentQ.explanation ? currentQ.explanation.trim() : '',
        verse_reference: currentQ.verse_reference ? currentQ.verse_reference.trim() : '',
        time_limit_seconds: 25
      });
    }
    currentQ = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    // Ignorar encabezados globales de Libro o Capítulo
    if (/^LIBRO\s*[:\-]?/i.test(line) || /^CAP[IÍ]TULO\s*[:\-]?\s*\d+/i.test(line)) {
      continue;
    }

    // Coincidencia de encabezado de pregunta:
    // PREGUNTA: ..., PREGUNTA 1: ..., 1. ..., 1) ..., 1 - ...
    const matchPreguntaHeader = line.match(/^(?:PREGUNTA\s*(?:\d+)?\s*[:\-]?\s*|\d+[\.\)\-]\s+)(.+)$/i);

    // Opciones A, B, C, D
    const matchA = line.match(/^[A]\s*[.)\-:]\s*(.+)$/i);
    const matchB = line.match(/^[B]\s*[.)\-:]\s*(.+)$/i);
    const matchC = line.match(/^[C]\s*[.)\-:]\s*(.+)$/i);
    const matchD = line.match(/^[D]\s*[.)\-:]\s*(.+)$/i);

    // Metadatos
    const matchResp = line.match(/^(?:RESPUESTA(?:\s*CORRECTA)?|CORRECTA|RESP)\s*[:\-]?\s*\[?([A-D])\]?/i);
    const matchExp = line.match(/^EXPLICACI[OÓ]N\s*[:\-]?\s*(.+)$/i);
    const matchVer = line.match(/^(?:VERS[IÍ]CULO|CITA|REFERENCIA)\s*[:\-]?\s*(.+)$/i);

    if (matchPreguntaHeader) {
      pushCurrent();
      currentQ = {
        question_text: matchPreguntaHeader[1].trim(),
        correct_answer: 'a'
      };
      continue;
    }

    if (currentQ) {
      if (matchA) {
        currentQ.option_a = matchA[1].trim();
      } else if (matchB) {
        currentQ.option_b = matchB[1].trim();
      } else if (matchC) {
        currentQ.option_c = matchC[1].trim();
      } else if (matchD) {
        currentQ.option_d = matchD[1].trim();
      } else if (matchResp) {
        currentQ.correct_answer = matchResp[1].trim().toLowerCase();
      } else if (matchExp) {
        currentQ.explanation = matchExp[1].trim();
      } else if (matchVer) {
        currentQ.verse_reference = matchVer[1].trim();
      } else if (!currentQ.option_a && !matchPreguntaHeader) {
        // Continuación de pregunta multilínea
        currentQ.question_text += ` ${line}`;
      }
    } else {
      // Si la línea parece una pregunta autónoma (termina en '?' o contiene '¿')
      if (line.includes('?') || line.includes('¿')) {
        currentQ = {
          question_text: line.replace(/^\d+[\.\)\-]\s*/, '').trim(),
          correct_answer: 'a'
        };
      }
    }
  }

  pushCurrent();
  return questions;
}
