export const getRankInfo = (points) => {
    const pts = points || 0;
    if (pts >= 25000) return { name: 'Remanente', icon: '🔥', color: 'text-red-500', next: null };
    if (pts >= 15000) return { name: 'Erudito Bíblico', icon: '👑', color: 'text-blue-500', next: 25000 };
    if (pts >= 7500) return { name: 'Maestro', icon: '🏛️', color: 'text-yellow-500', next: 15000 };
    if (pts >= 2500) return { name: 'Defensor', icon: '🛡️', color: 'text-gray-400', next: 7500 };
    if (pts >= 500) return { name: 'Discípulo', icon: '📜', color: 'text-gray-500', next: 2500 };
    return { name: 'Buscador', icon: '🕯️', color: 'text-amber-700', next: 500 };
};
