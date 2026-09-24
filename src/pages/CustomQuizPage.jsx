import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import CustomQuizBuilder from '../components/custom/CustomQuizBuilder';
import QuizEngine from '../components/quiz/QuizEngine';
import { Loader } from 'lucide-react';

const CustomQuizPage = () => {
  const [step, setStep] = useState('config'); // config | quiz
  const [questions, setQuestions] = useState([]);
  const [configId, setConfigId] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async (config) => {
    setLoading(true);
    try {
      const data = await api.post('/custom-quiz/generate', config);
      setQuestions(data.questions || data);
      setConfigId(data.configId);
      setStep('quiz');
    } catch (err) {
      console.error(err);
      alert('Error generando el quiz. Verifica la configuración.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Loader className="w-10 h-10 animate-spin text-gold" />
        <p className="text-gray-600">Generando tu quiz personalizado...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {step === 'config' && (
        <>
          <h1 className="font-[Cinzel] text-3xl font-bold text-primary mb-2">Quiz Personalizado</h1>
          <p className="text-gray-600 mb-8">Configura tu propio quiz eligiendo libros, capítulos, dificultad y más.</p>
          <CustomQuizBuilder onGenerate={handleGenerate} />
        </>
      )}

      {step === 'quiz' && questions.length > 0 && (
        <QuizEngine questions={questions} isCustom={true} configId={configId} />
      )}
    </div>
  );
};

export default CustomQuizPage;
