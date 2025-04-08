import { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { Button, TextInput } from '@tremor/react';
import styles from '../../styles/SettingsModals.module.css';

interface EditPaisModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  pais: {
    id: number;
    codigo_iso: string;
    nombre: string;
    es_territorio_personalizado: boolean;
  };
}

export const EditPaisModal: React.FC<EditPaisModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  pais,
}) => {
  const [formData, setFormData] = useState({
    codigo_iso: pais.codigo_iso,
    nombre: pais.nombre,
    es_territorio_personalizado: pais.es_territorio_personalizado,
  });

  useEffect(() => {
    setFormData({
      codigo_iso: pais.codigo_iso,
      nombre: pais.nombre,
      es_territorio_personalizado: pais.es_territorio_personalizado,
    });
  }, [pais]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onSubmit({ id: pais.id, ...formData });
      onClose();
    } catch (error: any) {
      console.error('Error updating país:', error);
      alert(error.message || 'Error al actualizar el país');
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
              Editar País
            </h3>
          </div>

          <form onSubmit={handleSubmit} className={styles.modalBody}>
            <div>
              <label className={styles.inputLabel}>
                Código ISO
              </label>
              <TextInput
                className="mt-1 dark:bg-dark-input dark:border-dark-border dark:text-dark-text"
                value={formData.codigo_iso}
                onChange={(e) => setFormData({ ...formData, codigo_iso: e.target.value })}
                placeholder="Código ISO del país"
                required
                maxLength={2}
              />
            </div>

            <div>
              <label className={styles.inputLabel}>
                Nombre
              </label>
              <TextInput
                className="mt-1 dark:bg-dark-input dark:border-dark-border dark:text-dark-text"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                placeholder="Nombre del país"
                required
              />
            </div>

            <div>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData.es_territorio_personalizado}
                  onChange={(e) => setFormData({ ...formData, es_territorio_personalizado: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-dark-border dark:bg-dark-input"
                />
                <span className={styles.inputLabel}>
                  Es territorio personalizado
                </span>
              </label>
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
