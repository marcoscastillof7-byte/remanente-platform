import { useState, useEffect } from 'react';
import { useParams } from 'react-router';
import { api } from '../utils/api';
import FlashcardDeck from '../components/flashcards/FlashcardDeck';
import { Loader, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router';

const FlashcardsPage = () => {
  const { chapterId } = useParams();
  const [flashcards, setFlashcards] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFlashcards = async () => {
      try {
        const data = await api.get(`/flashcards/${chapterId}`);
        setFlashcards(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchFlashcards();
  }, [chapterId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="w-8 h-8 animate-spin text-gold" />
      </div>
    );
  }

  if (flashcards.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-600 text-lg mb-4">No hay flashcards disponibles para este capítulo.</p>
        <Link to="/" className="inline-flex items-center px-4 py-2 bg-primary text-white rounded">
          <ArrowLeft className="w-4 h-4 mr-2" /> Volver
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="font-[Cinzel] text-2xl font-bold text-primary mb-6">
        Tarjetas de Estudio
      </h1>
      <FlashcardDeck flashcards={flashcards} chapterId={chapterId} />
    </div>
  );
};

export default FlashcardsPage;
