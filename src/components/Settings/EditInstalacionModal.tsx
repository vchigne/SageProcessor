import { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import styles from '../../styles/SettingsModals.module.css';

interface EditInstalacionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (id: number, data: any) => Promise<void>;
  instalacion: any; // La instalación a editar
}

interface Organizacion {
  id: number;
  nombre: string;
}

interface Pais {
  id: number;
  nombre: string;
}

interface Producto {
  id: number;
  nombre: string;
}

export const EditInstalacionModal: React.FC<EditInstalacionModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  instalacion,
}) => {
  const [formData, setFormData] = useState({
    organizacion_id: '',
    pais_id: '',
    producto_id: '',
  });

  const [organizaciones, setOrganizaciones] = useState<Organizacion[]>([]);
  const [paises, setPaises] = useState<Pais[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cargar datos cuando se abre el modal y establecer valores iniciales
  useEffect(() => {
    if (isOpen && instalacion) {
      setFormData({
        organizacion_id: instalacion.organizacion_id.toString(),
        pais_id: instalacion.pais_id.toString(),
        producto_id: instalacion.producto_id.toString(),
      });
      setError(null);
      fetchData();
    }
  }, [isOpen, instalacion]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [orgRes, paisRes, prodRes] = await Promise.all([
        fetch('/api/organizaciones'),
        fetch('/api/paises'),
        fetch('/api/productos'),
      ]);

      if (!orgRes.ok) throw new Error('Error al cargar organizaciones');
      if (!paisRes.ok) throw new Error('Error al cargar países');
      if (!prodRes.ok) throw new Error('Error al cargar productos');

      const [orgData, paisData, prodData] = await Promise.all([
        orgRes.json(),
        paisRes.json(),
        prodRes.json(),
      ]);

      setOrganizaciones(orgData);
      setPaises(paisData);
      setProductos(prodData);
    } catch (error: any) {
      console.error('Error al cargar datos:', error);
      setError(error.message || 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!formData.organizacion_id || !formData.pais_id || !formData.producto_id) {
        setError('Por favor complete todos los campos');
        return;
      }

      const dataToSubmit = {
        organizacion_id: parseInt(formData.organizacion_id),
        pais_id: parseInt(formData.pais_id),
        producto_id: parseInt(formData.producto_id),
      };

      await onSubmit(instalacion.id, dataToSubmit);
      onClose();
    } catch (error: any) {
      console.error('Error al actualizar instalación:', error);
      setError(error.message || 'Error al actualizar la instalación');
    }
  };

  if (!instalacion) return null;

  return (
    <Dialog 
      open={isOpen} 
      onClose={onClose}
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
              Editar Instalación
            </h3>
          </div>

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            {error && (
              <div className="p-3 bg-red-100 dark:bg-red-900/40 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 rounded-md">
                {error}
              </div>
            )}

            {loading ? (
              <div className="py-10 text-center text-gray-500 dark:text-gray-400">Cargando datos...</div>
            ) : (
              <>
                {/* Organizaciones */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Organización
                  </label>
                  <select
                    value={formData.organizacion_id}
                    onChange={(e) => setFormData({ ...formData, organizacion_id: e.target.value })}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  >
                    <option value="">Seleccionar organización</option>
                    {organizaciones.map((org) => (
                      <option key={org.id} value={org.id.toString()}>
                        {org.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Países */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    País
                  </label>
                  <select
                    value={formData.pais_id}
                    onChange={(e) => setFormData({ ...formData, pais_id: e.target.value })}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  >
                    <option value="">Seleccionar país</option>
                    {paises.map((pais) => (
                      <option key={pais.id} value={pais.id.toString()}>
                        {pais.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Productos */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Producto
                  </label>
                  <select
                    value={formData.producto_id}
                    onChange={(e) => setFormData({ ...formData, producto_id: e.target.value })}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  >
                    <option value="">Seleccionar producto</option>
                    {productos.map((prod) => (
                      <option key={prod.id} value={prod.id.toString()}>
                        {prod.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {/* Botones */}
            <div className="mt-6 flex justify-end space-x-3 border-t border-gray-200 dark:border-gray-700 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 border border-transparent rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              >
                Actualizar
              </button>
            </div>
          </form>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};