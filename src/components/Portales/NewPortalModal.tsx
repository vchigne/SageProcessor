import { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import styles from '../../styles/SettingsModals.module.css';

interface Installation {
  id: number;
  nombre: string;
  organizacion: {
    nombre: string;
  };
  producto: {
    nombre: string;
  };
}

interface NewPortalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
}

export const NewPortalModal: React.FC<NewPortalModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [filteredInstallations, setFilteredInstallations] = useState<Installation[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    nombre: '',
    instalacion_id: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchInstallations();
      setSearchTerm('');
      setFormData({
        nombre: '',
        instalacion_id: '',
      });
    }
  }, [isOpen]);
  
  // Filtrar instalaciones cuando cambia el término de búsqueda
  useEffect(() => {
    if (installations.length > 0) {
      if (!searchTerm) {
        // Si no hay término de búsqueda, no mostrar nada
        setFilteredInstallations([]);
      } else {
        // Filtrar por cualquier coincidencia parcial en producto u organización
        const searchTermLower = searchTerm.toLowerCase();
        const filtered = installations.filter(inst => {
          const productoNombre = inst.producto.nombre.toLowerCase();
          const orgNombre = inst.organizacion.nombre.toLowerCase();
          const nombreCompleto = `${productoNombre} ${orgNombre}`;
          
          return nombreCompleto.includes(searchTermLower) || 
                 productoNombre.includes(searchTermLower) || 
                 orgNombre.includes(searchTermLower);
        });
        setFilteredInstallations(filtered);
      }
    } else {
      setFilteredInstallations([]);
    }
  }, [searchTerm, installations]);

  const fetchInstallations = async () => {
    try {
      const response = await fetch('/api/installations');
      if (!response.ok) {
        throw new Error('Error cargando instalaciones');
      }
      const data = await response.json();
      setInstallations(data);
    } catch (error) {
      console.error('Error:', error);
      setError('Error cargando instalaciones');
    }
  };

  const handleInstallationChange = (value: string) => {
    const selectedInstallation = installations.find(inst => inst.id.toString() === value);
    if (selectedInstallation) {
      // Set default portal name based on installation
      const defaultName = `${selectedInstallation.producto.nombre} - ${selectedInstallation.organizacion.nombre}`;
      setFormData({
        instalacion_id: value,
        nombre: defaultName,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (!formData.instalacion_id) {
        throw new Error('Por favor seleccione una instalación');
      }

      setLoading(true);
      await onSubmit({
        nombre: formData.nombre,
        instalacion_id: parseInt(formData.instalacion_id),
      });

      // Reset form
      setFormData({
        nombre: '',
        instalacion_id: '',
      });
      onClose();
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
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
              Nuevo Portal
            </h3>
          </div>

          {error && (
            <div className={styles.errorMessage}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className={styles.modalBody}>
            <div>
              <label className={styles.inputLabel + " mb-1"}>
                Buscar Instalación
              </label>
              <input
                type="text"
                placeholder="Ingresa cualquier parte del nombre"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full p-2 border border-gray-300 dark:border-dark-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-dark-accent mb-2 dark:bg-dark-input dark:text-dark-text"
                disabled={loading}
                style={{ borderWidth: "1px" }}
                autoComplete="off"
              />
              
              {filteredInstallations.length > 0 && searchTerm && (
                <div className="mb-2 border border-gray-300 dark:border-dark-border rounded-md max-h-48 overflow-y-auto dark:bg-dark-card">
                  {filteredInstallations.map((inst) => (
                    <div 
                      key={inst.id} 
                      onClick={() => handleInstallationChange(inst.id.toString())}
                      className={`p-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-dark-cardHover ${
                        formData.instalacion_id === inst.id.toString() 
                          ? 'bg-blue-50 dark:bg-dark-accent/10 border-l-4 border-blue-500 dark:border-dark-accent' 
                          : ''
                      }`}
                    >
                      <div className="font-medium dark:text-dark-text">{inst.producto.nombre}</div>
                      <div className="text-sm text-gray-500 dark:text-dark-text-secondary">{inst.organizacion.nombre}</div>
                    </div>
                  ))}
                </div>
              )}
              
              {searchTerm && filteredInstallations.length === 0 && (
                <div className="text-sm text-gray-500 dark:text-dark-text-secondary mb-2 p-2 bg-gray-50 dark:bg-dark-cardHover rounded border border-gray-200 dark:border-dark-border">
                  No se encontraron instalaciones que coincidan con "{searchTerm}"
                </div>
              )}
              
              {formData.instalacion_id && (
                <div className="mb-2 p-2 bg-blue-50 dark:bg-dark-accent/10 rounded-md border border-blue-200 dark:border-dark-accent/20">
                  <div className="text-sm font-medium dark:text-dark-text">Instalación seleccionada:</div>
                  <div className="font-medium dark:text-dark-accent">
                    {installations.find(i => i.id.toString() === formData.instalacion_id)?.producto.nombre}
                  </div>
                  <div className="text-sm text-gray-700 dark:text-dark-text-secondary">
                    {installations.find(i => i.id.toString() === formData.instalacion_id)?.organizacion.nombre}
                  </div>
                </div>
              )}
              
              <div className="text-xs text-gray-500 dark:text-dark-text-secondary mt-1">
                {searchTerm ? `Mostrando ${filteredInstallations.length} de ${installations.length} instalaciones` : ''}
              </div>
            </div>

            <div>
              <label className={styles.inputLabel}>
                Nombre del Portal
              </label>
              <input
                type="text"
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-dark-border focus:border-blue-500 dark:focus:border-dark-accent focus:ring-blue-500 dark:focus:ring-dark-accent py-2 px-3 text-sm dark:bg-dark-input dark:text-dark-text"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                required
                disabled={loading}
                style={{ borderWidth: "1px" }}
              />
            </div>

            {/* Botones */}
            <div className={styles.buttonContainer}>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className={`${styles.cancelButton} ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className={`${styles.submitButton} ${loading ? 'opacity-50 cursor-not-allowed' : ''} flex items-center justify-center`}
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creando...
                  </>
                ) : (
                  'Crear Portal'
                )}
              </button>
            </div>
          </form>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};