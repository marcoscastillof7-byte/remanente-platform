import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { ShieldAlert, Plus, Users, Copy, Check, Edit, Save, Trash2, Settings, User } from 'lucide-react';
import Modal from '../../components/shared/Modal';
import { useToast } from '../../components/shared/Toast';

const SuperDashboard = () => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  
  // Edit State
  const [editGroup, setEditGroup] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('config'); // 'config' or 'members'
  const [groupUsers, setGroupUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

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

  const openEditModal = async (group) => {
    setEditGroup({ ...group });
    setActiveTab('config');
    setIsEditModalOpen(true);
    fetchGroupUsers(group.id);
  };

  const fetchGroupUsers = async (groupId) => {
    setLoadingUsers(true);
    try {
      const users = await api.get(`/superadmin/groups/${groupId}/users`);
      setGroupUsers(users);
    } catch (error) {
      addToast('Error al cargar integrantes', 'error');
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleUpdateGroup = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/superadmin/groups/${editGroup.id}`, {
        name: editGroup.name,
        slug: editGroup.slug,
        primary_color: editGroup.primary_color,
        secondary_color: editGroup.secondary_color
      });
      addToast('Grupo actualizado', 'success');
      fetchGroups();
    } catch (error) {
      addToast(error.error || 'Error al actualizar', 'error');
    }
  };

  const handleUpdateUser = async (userId, newRole, newGroupId) => {
    try {
      await api.put(`/superadmin/users/${userId}`, {
        role: newRole,
        group_id: newGroupId
      });
      addToast('Usuario actualizado', 'success');
      // Refetch if group changed (user might disappear from this list) or just role changed
      fetchGroupUsers(editGroup.id);
      fetchGroups(); // Update user counts
    } catch (error) {
      addToast(error.error || 'Error al actualizar usuario', 'error');
    }
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
          <div key={g.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden relative group">
            <div className="h-16 w-full flex" style={{ background: `linear-gradient(to right, ${g.primary_color}, ${g.secondary_color})` }}>
            </div>
            
            <button 
              onClick={() => openEditModal(g)}
              className="absolute top-2 right-2 bg-white/20 hover:bg-white/40 p-2 rounded-full transition-colors backdrop-blur-sm"
              title="Editar Grupo"
            >
              <Edit className="w-5 h-5 text-white shadow-sm" />
            </button>

            <div className="p-5">
              <h3 className="font-bold text-lg mb-1">{g.name}</h3>
              <p className="text-sm text-gray-500 mb-4">Slug: {g.slug}</p>
              
              <div className="flex items-center justify-between mb-4 bg-gray-50 p-2 rounded">
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Users className="w-4 h-4 text-primary" />
                  <span>{g.users_count} usuarios</span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => openEditModal(g)}
                  className="flex-1 flex items-center justify-center gap-2 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded transition-colors text-sm font-medium"
                >
                  <Settings className="w-4 h-4" /> Administrar
                </button>
                <button
                  onClick={() => copyInviteLink(g.slug, g.id)}
                  className="flex-1 flex items-center justify-center gap-2 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors text-sm font-medium"
                >
                  {copiedId === g.id ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                  {copiedId === g.id ? 'Copiado!' : 'Enlace'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal de Crear Grupo */}
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

      {/* Modal de Editar Grupo */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title={`Administrar: ${editGroup?.name}`}>
        {editGroup && (
          <div className="min-h-[400px]">
            {/* Tabs */}
            <div className="flex border-b border-gray-200 mb-4">
              <button
                className={`py-2 px-4 font-medium text-sm flex items-center gap-2 ${activeTab === 'config' ? 'border-b-2 border-primary text-primary' : 'text-gray-500 hover:text-gray-700'}`}
                onClick={() => setActiveTab('config')}
              >
                <Settings className="w-4 h-4" /> Configuración
              </button>
              <button
                className={`py-2 px-4 font-medium text-sm flex items-center gap-2 ${activeTab === 'members' ? 'border-b-2 border-primary text-primary' : 'text-gray-500 hover:text-gray-700'}`}
                onClick={() => setActiveTab('members')}
              >
                <Users className="w-4 h-4" /> Integrantes
              </button>
            </div>

            {/* Tab: Configuración */}
            {activeTab === 'config' && (
              <form onSubmit={handleUpdateGroup} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Grupo</label>
                  <input
                    type="text"
                    required
                    className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-primary outline-none"
                    value={editGroup.name}
                    onChange={(e) => setEditGroup({ ...editGroup, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Slug (URL)</label>
                  <input
                    type="text"
                    required
                    className="w-full p-2 border border-gray-300 rounded outline-none"
                    value={editGroup.slug}
                    onChange={(e) => setEditGroup({ ...editGroup, slug: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Color Primario</label>
                    <input
                      type="color"
                      required
                      className="w-full h-10 p-1 border border-gray-300 rounded cursor-pointer"
                      value={editGroup.primary_color}
                      onChange={(e) => setEditGroup({ ...editGroup, primary_color: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Color Secundario</label>
                    <input
                      type="color"
                      required
                      className="w-full h-10 p-1 border border-gray-300 rounded cursor-pointer"
                      value={editGroup.secondary_color}
                      onChange={(e) => setEditGroup({ ...editGroup, secondary_color: e.target.value })}
                    />
                  </div>
                </div>
                <div className="pt-4 flex justify-between gap-3">
                  <button
                    type="button"
                    onClick={async () => {
                      if (window.confirm('🚨 ¡ADVERTENCIA EXTREMA!\n\n¿Estás absolutamente seguro de que quieres eliminar este grupo?\n\n¡ESTO ELIMINARÁ PERMANENTEMENTE A TODOS LOS USUARIOS DENTRO DEL GRUPO Y TODO SU PROGRESO!\n\nEsta acción NO se puede deshacer.')) {
                        try {
                          await api.del(`/superadmin/groups/${editGroup.id}`);
                          addToast('Grupo y usuarios eliminados', 'success');
                          setIsEditModalOpen(false);
                          fetchGroups();
                        } catch (error) {
                          addToast(error.error || 'Error al eliminar grupo', 'error');
                        }
                      }
                    }}
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors flex items-center gap-2 font-bold"
                  >
                    <Trash2 className="w-4 h-4" /> Eliminar Grupo
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-light transition-colors flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" /> Guardar Cambios
                  </button>
                </div>
              </form>
            )}

            {/* Tab: Integrantes */}
            {activeTab === 'members' && (
              <div className="space-y-4">
                {loadingUsers ? (
                  <div className="text-center py-8 text-gray-500">Cargando integrantes...</div>
                ) : groupUsers.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">No hay usuarios en este grupo todavía.</div>
                ) : (
                  <div className="overflow-y-auto max-h-[350px] pr-2 space-y-2">
                    {groupUsers.map(u => (
                      <div key={u.id} className="flex flex-col md:flex-row md:items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg gap-3">
                        <div className="flex items-center gap-3">
                          <div className="bg-primary/10 p-2 rounded-full">
                            <User className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-bold text-gray-800 leading-tight">{u.username}</p>
                            <p className="text-xs text-gray-500">{u.points} pts</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <select 
                            value={u.role}
                            onChange={(e) => handleUpdateUser(u.id, e.target.value, editGroup.id)}
                            className="text-sm border border-gray-300 rounded p-1 outline-none focus:ring-1 focus:ring-primary"
                          >
                            <option value="user">Usuario Regular</option>
                            <option value="admin">Administrador (Líder)</option>
                          </select>
                          
                          <select
                            value={editGroup.id}
                            onChange={(e) => {
                              if (window.confirm('¿Mover a este usuario de grupo? Desaparecerá de esta lista.')) {
                                handleUpdateUser(u.id, u.role, parseInt(e.target.value, 10));
                              }
                            }}
                            className="text-sm border border-gray-300 rounded p-1 outline-none focus:ring-1 focus:ring-primary"
                          >
                            {groups.map(g => (
                              <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default SuperDashboard;
