import { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { Button, TextInput } from '@tremor/react';
import styles from '@/styles/SettingsModals.module.css';

interface EditOrganizacionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  organizacion: {
    id: number;
    nombre: string;
  };
}

export const EditOrganizacionModal: React.FC<EditOrganizacionModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  organizacion,
}) => {
  const [nombre, setNombre] = useState(organizacion.nombre);

  useEffect(() => {
    setNombre(organizacion.nombre);
  }, [organizacion]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onSubmit({ id: organizacion.id, nombre });
      onClose();
    } catch (error: any) {
      console.error('Error updating organización:', error);
      alert(error.message || 'Error al actualizar la organización');
    }
  };

  return (
    <Dialog 
      open={isOpen} 
      onClose={onClose}
      className="relative z-50"
    >
      <div className={styles.modalOverlay} aria-hidden="true" />
      <div className={styles.modalContainer}>
        <Dialog.Panel className={styles.modalPanel}>
          
          {/* Título */}
          <div className={styles.modalHeader}>
            <h3 className={styles.modalTitle}>
              Editar Organización
            </h3>
          </div>

          <form onSubmit={handleSubmit} className={styles.modalBody}>
            <div>
              <label className={styles.inputLabel}>
                Nombre
              </label>
              <TextInput
                className="mt-1 dark:bg-dark-input dark:border-dark-border dark:text-dark-text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Nombre de la organización"
                required
              />
            </div>

            {/* Botones */}
            <div className={styles.buttonContainer}>
              <button
                type="button"
                onClick={onClose}
                className={styles.cancelButton}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className={styles.submitButton}
              >
                Guardar Cambios
              </button>
            </div>
          </form>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};
