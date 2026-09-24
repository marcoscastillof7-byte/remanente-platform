import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { Database, Loader, ArrowRight, CheckCircle, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router';

const GlobalBulkImport = () => {
  const [books, setBooks] = useState([]);
  const [text, setText] = useState('');
  const [parsedQuestions, setParsedQuestions] = useState([]);
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchBooksAndChapters = async () => {
      try {
        const data = await api.get('/books');
        // Para cada libro, traemos sus capítulos
        const booksWithChapters = await Promise.all(data.map(async (book) => {
          const response = await api.get(`/books/${book.id}/chapters`);
          return { ...book, chapters: response.chapters || [] };
        }));
        setBooks(booksWithChapters);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchBooksAndChapters();
  }, []);

  const handleParse = () => {
    setSuccess(false);
    setErrors([]);
    setParsedQuestions([]);
    
    if (!text.trim()) return;

    const lines = text.split('\n');
    const result = [];
    const localErrors = [];

    let currentBook = null;
    let currentChapterId = null;
    let currentQ = null;

    const removeAccents = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    const cleanLines = lines.map(l => l.trim()).filter(l => l.length > 0);

    for (let i = 0; i < cleanLines.length; i++) {
      const line = cleanLines[i];
      
      const matchLibro = line.match(/^LIBRO\s*[:\-]?\s*(.+)$/i);
      if (matchLibro) {
        const bookName = matchLibro[1].trim();
        const foundBook = books.find(b => removeAccents(b.name.toLowerCase()) === removeAccents(bookName.toLowerCase()));
        if (foundBook) {
          currentBook = foundBook;
          currentChapterId = null; 
        } else {
          localErrors.push(`Libro no encontrado: "${bookName}" en la línea ${i+1}`);
          currentBook = null;
        }
        continue;
      }

      const matchCapitulo = line.match(/^CAP[IÍ]TULO\s*[:\-]?\s*(\d+)/i);
      if (matchCapitulo) {
        const chapterNum = parseInt(matchCapitulo[1], 10);
        
        if (!currentBook) {
          localErrors.push(`Capítulo ${chapterNum} declarado sin un libro válido arriba (Línea ${i+1})`);
          continue;
        }

        const foundChapter = currentBook.chapters.find(c => c.chapter_number === chapterNum);
        if (foundChapter) {
          currentChapterId = foundChapter.id;
        } else {
          localErrors.push(`Capítulo ${chapterNum} no encontrado en el libro ${currentBook.name} (Línea ${i+1})`);
          currentChapterId = null;
        }
        continue;
      }

      const matchPregunta = line.match(/^PREGUNTA\s*[:\-]?\s*(.+)$/i);
      if (matchPregunta) {
        if (!currentChapterId) {
          localErrors.push(`Pregunta encontrada sin un capítulo y libro válidos arriba (Línea ${i+1})`);
          continue;
        }
        if (currentQ) result.push(currentQ);

        currentQ = {
          chapter_id: currentChapterId,
          bookName: currentBook.name,
          question_text: matchPregunta[1].trim(),
          difficulty: 'medio',
          explanation: '',
          verse_reference: ''
        };
        continue;
      }

      if (currentQ) {
        const matchA = line.match(/^[A]\s*[.)\-]\s*(.+)$/i);
        const matchB = line.match(/^[B]\s*[.)\-]\s*(.+)$/i);
        const matchC = line.match(/^[C]\s*[.)\-]\s*(.+)$/i);
        const matchD = line.match(/^[D]\s*[.)\-]\s*(.+)$/i);
        const matchResp = line.match(/^RESPUESTA\s*[:\-]?\s*([A-D])/i);
        const matchExp = line.match(/^EXPLICACI[OÓ]N\s*[:\-]?\s*(.+)$/i);
        const matchVer = line.match(/^VERS[IÍ]CULO\s*[:\-]?\s*(.+)$/i);

        if (matchA) currentQ.option_a = matchA[1].trim();
        else if (matchB) currentQ.option_b = matchB[1].trim();
        else if (matchC) currentQ.option_c = matchC[1].trim();
        else if (matchD) currentQ.option_d = matchD[1].trim();
        else if (matchResp) currentQ.correct_answer = matchResp[1].trim().toLowerCase();
        else if (matchExp) currentQ.explanation = matchExp[1].trim();
        else if (matchVer) currentQ.verse_reference = matchVer[1].trim();
      }
    }

    if (currentQ && currentChapterId) {
      result.push(currentQ);
    }

    setParsedQuestions(result);
    setErrors(localErrors);
  };

  const handleSave = async () => {
    if (parsedQuestions.length === 0) return;
    setSubmitting(true);
    try {
      // Remove UI-only fields
      const payload = parsedQuestions.map(q => {
        const { bookName, ...dbQ } = q;
        return dbQ;
      });

      await api.post('/admin/global-bulk', { questions: payload });
      setSuccess(true);
      setText('');
      setParsedQuestions([]);
    } catch (err) {
      alert('Error guardando preguntas: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex justify-center p-12"><Loader className="w-8 h-8 animate-spin text-gold" /></div>;

  return (
    <div className="max-w-6xl mx-auto pb-12">
      <div className="flex items-center gap-3 mb-8">
        <Database className="w-8 h-8 text-primary" />
        <h1 className="font-[Cinzel] text-3xl font-bold text-primary">Importador Global Masivo</h1>
      </div>

      <div className="bg-blue-50 border border-blue-200 p-6 rounded-lg mb-8 text-blue-900">
        <h2 className="font-bold mb-2">Instrucciones de Formato</h2>
        <p className="text-sm mb-4">
          Para importar a múltiples libros y capítulos a la vez, debes usar las etiquetas <code>LIBRO:</code> y <code>CAPITULO:</code> antes de tu bloque de preguntas. 
          El sistema asignará automáticamente cada pregunta al lugar correcto basándose en estas etiquetas.
        </p>
        <pre className="bg-white p-4 rounded text-xs border whitespace-pre-wrap font-mono text-gray-700">
LIBRO: 1 Samuel
CAPITULO: 1

PREGUNTA: ¿Cómo se llamaba el padre de Samuel?
A. Saúl
B. Elcana
C. Elí
D. David
RESPUESTA: b
EXPLICACION: Elcana era del monte de Efraín.
VERSICULO: 1 Samuel 1:1

CAPITULO: 2

PREGUNTA: ¿Qué pecado cometían los hijos de Elí?
A. ...
...

LIBRO: 2 Samuel
CAPITULO: 1
...
        </pre>
      </div>

      <div className="mb-6">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Pega aquí todo el bloque de libros, capítulos y preguntas..."
          className="w-full h-96 p-4 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent font-mono text-sm"
        />
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleParse}
            className="px-6 py-2 bg-gray-800 text-white rounded hover:bg-gray-900 font-bold"
          >
            Analizar Texto
          </button>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-lg mb-6">
          <h3 className="font-bold text-red-800 flex items-center mb-2"><AlertTriangle className="w-5 h-5 mr-2" /> Errores detectados:</h3>
          <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
            {errors.map((err, i) => <li key={i}>{err}</li>)}
          </ul>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 p-4 rounded-lg mb-6 flex items-center text-green-800">
          <CheckCircle className="w-6 h-6 mr-3" />
          <span className="font-bold">¡Importación global exitosa! Las preguntas fueron distribuidas correctamente en sus libros y capítulos.</span>
        </div>
      )}

      {parsedQuestions.length > 0 && (
        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <h2 className="font-bold text-xl mb-4 text-primary">Vista Previa ({parsedQuestions.length} preguntas)</h2>
          
          <div className="max-h-96 overflow-y-auto mb-6 space-y-4 pr-2">
            {parsedQuestions.map((q, i) => (
              <div key={i} className="p-4 border rounded bg-gray-50 text-sm">
                <div className="text-xs font-bold text-gold mb-2 uppercase tracking-wider bg-parchment-dark inline-block px-2 py-1 rounded">
                  {q.bookName} - CAPÍTULO {books.flatMap(b => b.chapters).find(c => c.id === q.chapter_id)?.chapter_number}
                </div>
                <p className="font-bold mb-2">{q.question_text}</p>
                <div className="grid grid-cols-2 gap-2 text-gray-600 mb-2">
                  <div>A. {q.option_a}</div>
                  <div>B. {q.option_b}</div>
                  <div>C. {q.option_c}</div>
                  <div>D. {q.option_d}</div>
                </div>
                <p className="text-green-700"><span className="font-bold">Respuesta:</span> {q.correct_answer?.toUpperCase()}</p>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center pt-4 border-t">
            <Link to="/admin" className="text-gray-500 hover:text-gray-800">Volver al Panel</Link>
            <button
              onClick={handleSave}
              disabled={submitting || errors.length > 0}
              className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-light font-bold flex items-center disabled:opacity-50"
            >
              {submitting ? <Loader className="w-5 h-5 animate-spin mr-2" /> : <Database className="w-5 h-5 mr-2" />}
              Guardar {parsedQuestions.length} Preguntas en la Base de Datos
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GlobalBulkImport;
