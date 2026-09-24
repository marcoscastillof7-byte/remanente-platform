import { X } from 'lucide-react';

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all">
        <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-[var(--color-primary)] text-white">
          <h3 className="font-cinzel font-bold text-lg text-[var(--color-gold)]">{title}</h3>
          <button onClick={onClose} className="text-gray-300 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 text-gray-800">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
