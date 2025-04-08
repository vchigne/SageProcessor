import { useState } from 'react';
import { Dialog } from '@headlessui/react';
import styles from '../../styles/SettingsModals.module.css';

interface NewProductoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { nombre: string }) => Promise<void>;
}

export const NewProductoModal: React.FC<NewProductoModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) {
      setError('El nombre es requerido');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    
    try {
      await onSubmit({ nombre });
      onClose();
      setNombre('');
    } catch (error: any) {
      console.error('Error al crear producto:', error);
      setError(error.message || 'Error al crear el producto');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setNombre('');
    setError(null);
    onClose();
  };

  return (
    <Dialog 
      open={isOpen} 
      onClose={resetForm}
      className="relative z-50"
    >
      {/* Overlay con soporte para modo oscuro */}
      <div className="fixed inset-0 bg-black/30 dark:bg-gray-900/60" aria-hidden="true" />
      
      {/* Contenedor del modal */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="w-full max-w-md rounded-lg bg-white dark:bg-gray-800 shadow-xl overflow-hidden">
          
          {/* Encabezado */}
          <div className="border-b border-gray-200 dark:border-gray-700 px-4 py-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              Nuevo Producto
            </h3>
          </div>

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            {error && (
              <div className="p-3 bg-red-100 dark:bg-red-900/40 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 rounded-md">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nombre
              </label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                placeholder="Nombre del producto"
              />
            </div>

            {/* Botones */}
            <div className="mt-6 flex justify-end space-x-3 border-t border-gray-200 dark:border-gray-700 pt-4">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 border border-transparent rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              >
                Crear
              </button>
            </div>
          </form>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};