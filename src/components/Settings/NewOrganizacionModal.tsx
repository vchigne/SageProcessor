import { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { Button, TextInput } from '@tremor/react';

interface NewOrganizacionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
}

export const NewOrganizacionModal: React.FC<NewOrganizacionModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [nombre, setNombre] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onSubmit({ nombre });
      setNombre('');
      onClose();
    } catch (error: any) {
      console.error('Error creating organización:', error);
      alert(error.message || 'Error al crear la organización');
    }
  };

  return (
    <Dialog 
      open={isOpen} 
      onClose={onClose}
      className="relative z-50"
    >
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="w-full max-w-sm bg-white rounded-md">
          
          {/* Título */}
          <div className="p-4 border-b bg-gray-50">
            <h3 className="text-lg font-medium text-gray-900">
              Nueva Organización
            </h3>
          </div>

          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Nombre
              </label>
              <TextInput
                className="mt-1"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Nombre de la organización"
                required
              />
            </div>

            {/* Botones */}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                style={{
                  backgroundColor: '#ef4444', /* Red 500 */
                  color: 'white',
                  borderRadius: '9999px',
                  padding: '0.5rem 1rem',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  border: 'none'
                }}
                className="hover:bg-red-600"
              >
                Cancelar
              </button>
              <button
                type="submit"
                style={{
                  backgroundColor: '#2563eb', /* Blue 600 */
                  color: 'white',
                  borderRadius: '9999px',
                  padding: '0.5rem 1rem',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  border: 'none'
                }}
                className="hover:bg-blue-700"
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
