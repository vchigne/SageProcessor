import React, { useState } from 'react';
import { Casilla } from '../../../types';
import { Card, Button, SearchInput, ContentStatus } from '../../components';
import { 
  PencilIcon, 
  TrashIcon, 
  UserGroupIcon, 
  BellIcon, 
  PlusIcon,
  DocumentArrowUpIcon,
  CircleStackIcon
} from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog } from '@headlessui/react';
import { useRouter } from 'next/router';

interface DataBoxListProps {
  dataBoxes: Casilla[];
  loading: boolean;
  error: Error | null;
  onNewClick: () => void;
  onEditClick: (dataBox: Casilla) => void;
  onDeleteClick: (dataBox: Casilla) => void;
  onUploadClick?: (dataBox: Casilla) => void;
  onMaterializationsClick?: (dataBox: Casilla) => void;
  emisoresCounts?: Record<number, number>;
  suscripcionesCounts?: Record<number, number>;
}

export const DataBoxList: React.FC<DataBoxListProps> = ({
  dataBoxes = [],
  loading = false,
  error = null,
  onNewClick,
  onEditClick,
  onDeleteClick,
  onUploadClick,
  onMaterializationsClick,
  emisoresCounts = {},
  suscripcionesCounts = {}
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<Casilla | null>(null);
  const router = useRouter();

  // Filtrar dataBoxes basado en el término de búsqueda
  const filteredDataBoxes = dataBoxes.filter(box => {
    if (!searchTerm) return true;
    
    const searchTermLower = searchTerm.toLowerCase();
    
    // Comprobar si el término de búsqueda es un número (ID de casilla)
    const searchTermAsId = searchTerm.toString();
    const boxIdAsString = box.id.toString();
    
    return (
      // Buscar por ID de casilla (coincidencia parcial)
      boxIdAsString.includes(searchTermAsId) ||
      // Buscar por instalación
      box.instalacion.nombre.toLowerCase().includes(searchTermLower) ||
      // Buscar por organización, producto, país
      box.instalacion.organizacion.nombre.toLowerCase().includes(searchTermLower) ||
      box.instalacion.producto.nombre.toLowerCase().includes(searchTermLower) ||
      box.instalacion.pais.nombre.toLowerCase().includes(searchTermLower) ||
      // Buscar por nombre y descripción de la casilla
      (box.nombre && box.nombre.toLowerCase().includes(searchTermLower)) ||
      (box.descripcion && box.descripcion.toLowerCase().includes(searchTermLower)) ||
      // Buscar por nombre de archivo YAML
      (box.nombre_yaml && box.nombre_yaml.toLowerCase().includes(searchTermLower))
    );
  });

  const handleGestionEmisoresClick = (box: Casilla) => {
    router.push(`/admin/metodos-envio/${box.id}`);
  };
  
  const handleGestionSuscripcionesClick = (box: Casilla) => {
    router.push(`/admin/suscripciones/${box.id}`);
  };

  // Si estamos cargando, mostrar estado de carga
  if (loading) {
    return <ContentStatus status="loading" title="Cargando casillas" message="Por favor, espera mientras cargamos las casillas de datos." />;
  }

  // Si hay un error, mostrar estado de error
  if (error) {
    return <ContentStatus status="error" title="Error al cargar casillas" message={error.message} retry={() => window.location.reload()} />;
  }

  // Si no hay dataBoxes, mostrar estado vacío
  if (!loading && filteredDataBoxes.length === 0) {
    return (
      <div>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">Casillas de Datos</h2>
          <Button 
            onClick={onNewClick}
            icon={<PlusIcon className="h-5 w-5" />}
          >
            Nueva Casilla
          </Button>
        </div>
        
        <SearchInput
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Buscar por ID, nombre, instalación o descripción..."
          className="mb-6"
        />
        
        <ContentStatus status="empty" title="No hay casillas" message={searchTerm ? "No se encontraron casillas que coincidan con tu búsqueda." : "No hay casillas de datos disponibles. Crea una nueva casilla para comenzar."} />
      </div>
    );
  }

  const renderListView = (box: Casilla) => (
    <motion.div
      key={box.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="p-4 mb-4">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div className="flex-1">
            <h3 className="font-medium text-base md:text-lg dark:text-white">{box.instalacion.nombre}</h3>
            <p className="text-sm md:text-base text-gray-700 dark:text-gray-200 font-medium">
              {box.nombre || box.yaml_content?.name || 'Sin nombre'}
            </p>
            <p className="text-sm md:text-base text-gray-500 dark:text-gray-300">
              {box.descripcion || box.yaml_content?.description || 'Sin descripción'}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-400 mt-1">
              ({box.nombre_yaml}) - ID: {box.id}
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              {box.api_endpoint && (
                <span className="text-sm dark:text-gray-300">API: {box.api_endpoint}</span>
              )}
              {box.email_casilla && (
                <span className="text-sm dark:text-gray-300">Email: {box.email_casilla}</span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Button
                onClick={() => handleGestionEmisoresClick(box)}
                icon={<UserGroupIcon className="h-5 w-5 md:h-6 md:w-6" />}
                size="md"
                variant="info"
                className="text-sm md:text-base lg:text-lg font-bold px-4 py-2.5 shadow-lg hover:shadow-xl dark:bg-blue-600 dark:text-white dark:hover:bg-blue-700"
              >
                Emisores ({emisoresCounts[box.id] || 0})
              </Button>
              <Button
                onClick={() => handleGestionSuscripcionesClick(box)}
                icon={<BellIcon className="h-5 w-5 md:h-6 md:w-6" />}
                size="md"
                variant="primary"
                className="text-sm md:text-base lg:text-lg font-bold px-4 py-2.5 shadow-lg hover:shadow-xl dark:bg-indigo-600 dark:text-white dark:hover:bg-indigo-700"
              >
                Suscriptores ({suscripcionesCounts[box.id] || 0})
              </Button>
              {onUploadClick && (
                <Button
                  onClick={() => onUploadClick(box)}
                  icon={<DocumentArrowUpIcon className="h-5 w-5 md:h-6 md:w-6" />}
                  size="md"
                  variant="secondary"
                  className="text-sm md:text-base lg:text-lg font-bold px-4 py-2.5 shadow-lg hover:shadow-xl dark:bg-gray-600 dark:text-white dark:hover:bg-gray-700"
                >
                  Cargar Archivo
                </Button>
              )}
              {onMaterializationsClick && (
                <Button
                  onClick={() => onMaterializationsClick(box)}
                  icon={<CircleStackIcon className="h-5 w-5 md:h-6 md:w-6" />}
                  size="md"
                  variant="success"
                  className="text-sm md:text-base lg:text-lg font-bold px-4 py-2.5 shadow-lg hover:shadow-xl dark:bg-green-600 dark:text-white dark:hover:bg-green-700"
                >
                  Materializaciones
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2 ml-auto sm:ml-0">
              <button
                onClick={() => onEditClick(box)}
                className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-dark-cardHover"
              >
                <PencilIcon className="h-5 w-5 md:h-6 md:w-6 text-gray-500 dark:text-gray-300" />
              </button>
              <button
                onClick={() => setDeleteConfirm(box)}
                className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-dark-cardHover"
              >
                <TrashIcon className="h-5 w-5 md:h-6 md:w-6 text-red-500 dark:text-red-300" />
              </button>
              <span className={`px-3 py-1.5 rounded-full text-xs md:text-sm font-medium ${
                box.is_active 
                  ? 'bg-green-100 text-green-800 dark:bg-dark-success/30 dark:text-dark-success dark:border dark:border-dark-success/50' 
                  : 'bg-red-100 text-red-800 dark:bg-dark-error/30 dark:text-dark-error dark:border dark:border-dark-error/50'
              }`}>
                {box.is_active ? 'Activo' : 'Inactivo'}
              </span>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );

  // Eliminamos la vista de cuadrícula/tarjetas y solo usamos la vista de lista

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl md:text-2xl font-bold dark:text-white">Casillas de Datos</h2>
        <Button 
          onClick={onNewClick}
          icon={<PlusIcon className="h-5 w-5 md:h-6 md:w-6" />}
          size="md"
          className="text-sm md:text-base lg:text-lg font-medium px-4 py-2 shadow-lg hover:shadow-xl"
        >
          Nueva Casilla
        </Button>
      </div>
      
      <SearchInput
        value={searchTerm}
        onChange={setSearchTerm}
        placeholder="Buscar por ID, nombre, instalación o descripción..."
        className="mb-6"
      />

      <div className="grid grid-cols-1 gap-4">
        <AnimatePresence>
          {filteredDataBoxes.map((box) => renderListView(box))}
        </AnimatePresence>
      </div>

      {/* Modal de confirmación de eliminación */}
      <Dialog
        open={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        className="relative z-50"
      >
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="bg-white dark:bg-dark-card rounded-lg p-6 max-w-sm mx-auto border border-gray-200 dark:border-dark-border shadow-lg dark:shadow-dark">
            <Dialog.Title className="text-lg font-medium mb-4 dark:text-gray-100">Confirmar eliminación</Dialog.Title>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              ¿Está seguro que desea eliminar esta casilla de datos? Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setDeleteConfirm(null)}
              >
                Cancelar
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  if (deleteConfirm) {
                    onDeleteClick(deleteConfirm);
                    setDeleteConfirm(null);
                  }
                }}
              >
                Eliminar
              </Button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
    </div>
  );
};