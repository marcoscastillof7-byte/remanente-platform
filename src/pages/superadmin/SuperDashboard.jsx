import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { ShieldAlert, Plus, Users, Copy, Check } from 'lucide-react';
import Modal from '../../components/shared/Modal';
import { useToast } from '../../components/shared/Toast';

const SuperDashboard = () => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const { addToast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    primary_color: '#1e3a5f',
    secondary_color: '#d4af37'
  });

  const fetchGroups = async () => {
    try {
      const data = await api.get('/superadmin/groups');
      setGroups(data);
    } catch (error) {
      console.error(error);
      addToast('Error al cargar grupos', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    try {
      await api.post('/superadmin/groups', formData);
      addToast('Grupo creado exitosamente', 'success');
      setIsModalOpen(false);
      setFormData({ name: '', slug: '', primary_color: '#1e3a5f', secondary_color: '#d4af37' });
      fetchGroups();
    } catch (error) {
      addToast(error.error || 'Error al crear grupo', 'error');
    }
  };

  const copyInviteLink = (slug, id) => {
    const url = `${window.location.origin}/register?group=${slug}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    addToast('Enlace copiado al portapapeles', 'success');
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) {
    return <div className="text-center p-8">Cargando...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <h1 className="font-[Cinzel] text-2xl md:text-3xl font-bold text-primary flex items-center gap-2">
          <ShieldAlert className="w-8 h-8 text-gold" />
          Súper Panel MegaAdmin
        </h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-light transition-colors"
        >
          <Plus className="w-5 h-5" /> Crear Nuevo Grupo
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {groups.map(g => (
          <div key={g.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="h-16 w-full flex" style={{ background: `linear-gradient(to right, ${g.primary_color}, ${g.secondary_color})` }}>
            </div>
            <div className="p-5">
              <h3 className="font-bold text-lg mb-1">{g.name}</h3>
              <p className="text-sm text-gray-500 mb-4">Slug: {g.slug}</p>
              
              <div className="flex items-center gap-2 text-sm text-gray-700 mb-4 bg-gray-50 p-2 rounded">
                <Users className="w-4 h-4 text-primary" />
                <span>{g.users_count} usuarios</span>
              </div>

              <button
                onClick={() => copyInviteLink(g.slug, g.id)}
                className="w-full flex items-center justify-center gap-2 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors text-sm font-medium"
              >
                {copiedId === g.id ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                {copiedId === g.id ? 'Copiado!' : 'Copiar Enlace Invitación'}
              </button>
            </div>
          </div>
        ))}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Crear Nuevo Grupo">
        <form onSubmit={handleCreateGroup} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Grupo</label>
            <input
              type="text"
              required
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-primary outline-none"
              value={formData.name}
              onChange={(e) => {
                const name = e.target.value;
                const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                setFormData({ ...formData, name, slug });
              }}
              placeholder="Ej. Jóvenes Norte"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Slug (URL)</label>
            <input
              type="text"
              required
              className="w-full p-2 border border-gray-300 rounded bg-gray-50 outline-none"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              placeholder="jovenes-norte"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Color Primario</label>
              <input
                type="color"
                required
                className="w-full h-10 p-1 border border-gray-300 rounded cursor-pointer"
                value={formData.primary_color}
                onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Color Secundario</label>
              <input
                type="color"
                required
                className="w-full h-10 p-1 border border-gray-300 rounded cursor-pointer"
                value={formData.secondary_color}
                onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
              />
            </div>
          </div>
          <div className="pt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-light transition-colors"
            >
              Crear Grupo
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default SuperDashboard;
