import React, { useState, useEffect } from 'react';
import { Card, Title, Text, Button } from '@tremor/react';
import { Dialog } from '@headlessui/react';
import { 
  PlusIcon, 
  ListBulletIcon, 
  Squares2X2Icon, 
  PencilIcon, 
  TrashIcon, 
  PencilSquareIcon,
  UserGroupIcon,
  BellIcon
} from '@heroicons/react/24/outline';
import { EditDataBoxModal } from './EditDataBoxModal.jsx';
import { useRouter } from 'next/router';

interface DataBox {
  id: number;
  instalacion: {
    id: number;
    nombre: string;
    organizacion: {
      nombre: string;
    };
    producto: {
      nombre: string;
    };
    pais: {
      nombre: string;
    };
  };
  nombre_yaml: string;
  nombre?: string;
  descripcion?: string;
  yaml_content?: {
    name: string;
    description: string;
  };
  api_endpoint?: string;
  email_casilla?: string;
  is_active: boolean;
}

interface EmisoresCount {
  casilla_id: number;
  emisores_count: number;
}

interface DataBoxGridProps {
  dataBoxes: DataBox[];
  onNewClick: () => void;
  onEditClick: (dataBox: DataBox) => Promise<{ executionUuid?: string }>;
  onDeleteClick: (dataBox: DataBox) => void;
}

export const DataBoxGrid: React.FC<DataBoxGridProps> = ({
  dataBoxes = [],
  onNewClick,
  onEditClick,
  onDeleteClick
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<DataBox | null>(null);
  const [editingBox, setEditingBox] = useState<DataBox | null>(null);
  const [emisoresCounts, setEmisoresCounts] = useState<Record<number, number>>({});
  const [suscripcionesCounts, setSuscripcionesCounts] = useState<Record<number, number>>({});
  const router = useRouter();

  useEffect(() => {
    fetchEmisoresCounts();
    fetchSuscripcionesCounts();
  }, []);

  const fetchEmisoresCounts = async () => {
    try {
      // En lugar de usar un endpoint específico, utilizamos una consulta SQL directa
      // para obtener el conteo correcto de emisores
      console.log('Obteniendo conteo de emisores para todas las casillas...');
      const response = await fetch('/api/data-boxes/emisores-counts');
      if (response.ok) {
        const data: EmisoresCount[] = await response.json();
        console.log('Datos de conteo de emisores:', data);
        const counts = data.reduce((acc, item) => ({
          ...acc,
          [item.casilla_id]: item.emisores_count || 0
        }), {});
        setEmisoresCounts(counts);
      }
    } catch (error) {
      console.error('Error fetching emisores counts:', error);
    }
  };
  
  const fetchSuscripcionesCounts = async () => {
    try {
      const response = await fetch('/api/suscripciones/counts');
      if (response.ok) {
        const data: { casilla_id: number; suscripciones_count: number }[] = await response.json();
        const counts = data.reduce((acc, item) => ({
          ...acc,
          [item.casilla_id]: parseInt(item.suscripciones_count.toString()) || 0
        }), {});
        setSuscripcionesCounts(counts);
      }
    } catch (error) {
      console.error('Error fetching suscripciones counts:', error);
    }
  };

  const handleGestionEmisoresClick = (box: DataBox) => {
    router.push(`/admin/metodos-envio/${box.id}`);
  };
  
  const handleGestionSuscripcionesClick = (box: DataBox) => {
    router.push(`/admin/suscripciones/${box.id}`);
  };

  const renderListView = (box: DataBox) => (
    <Card key={box.id} className="p-4">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="flex-1">
          <Text className="font-medium">{box.nombre || box.yaml_content?.name || 'Sin nombre'}</Text>
          <Text className="text-sm text-gray-500">
            {box.descripcion || box.yaml_content?.description || 'Sin descripción'}
          </Text>
          <Text className="text-xs text-gray-400 mt-1">
            ({box.nombre_yaml}) - ID: {box.id}
          </Text>
          <div className="flex flex-wrap gap-2 mt-2">
            {box.api_endpoint && (
              <Text className="text-sm">API: {box.api_endpoint}</Text>
            )}
            {box.email_casilla && (
              <Text className="text-sm">Email: {box.email_casilla}</Text>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button
              onClick={() => handleGestionEmisoresClick(box)}
              icon={UserGroupIcon}
              size="xs"
              className="bg-blue-600 text-white hover:bg-blue-700 text-xs sm:text-sm whitespace-normal text-left sm:text-center"
            >
              <span className="hidden sm:inline">Gestión de </span>Emisores ({emisoresCounts[box.id] || 0})
            </Button>
            <Button
              onClick={() => handleGestionSuscripcionesClick(box)}
              icon={BellIcon}
              size="xs"
              className="bg-indigo-600 text-white hover:bg-indigo-700 text-xs sm:text-sm whitespace-normal text-left sm:text-center"
            >
              <span className="hidden sm:inline">Gestión de </span>Suscripciones ({suscripcionesCounts[box.id] || 0})
            </Button>
          </div>
          <div className="flex items-center gap-2 ml-auto sm:ml-0">
            <button
              onClick={() => handleEditClick(box)}
              className="p-1 rounded-md hover:bg-gray-100"
            >
              <PencilIcon className="h-5 w-5 text-gray-500" />
            </button>
            <button
              onClick={() => setDeleteConfirm(box)}
              className="p-1 rounded-md hover:bg-gray-100"
            >
              <TrashIcon className="h-5 w-5 text-red-500" />
            </button>
            <span className={`px-2 py-1 rounded-full text-xs ${box.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {box.is_active ? 'Activo' : 'Inactivo'}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );

  const renderGridView = (box: DataBox) => (
    <Card key={box.id} className="p-4">
      <div className="flex justify-between items-start">
        <div>
          <Text className="font-medium">{box.nombre || box.yaml_content?.name || 'Sin nombre'}</Text>
          <Text className="text-sm text-gray-500">
            {box.descripcion || box.yaml_content?.description || 'Sin descripción'}
          </Text>
          <Text className="text-xs text-gray-400 mt-1">
            ({box.nombre_yaml}) - ID: {box.id}
          </Text>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleEditClick(box)}
            className="p-1 rounded-md hover:bg-gray-100"
          >
            <PencilIcon className="h-5 w-5 text-gray-500" />
          </button>
          <button
            onClick={() => setDeleteConfirm(box)}
            className="p-1 rounded-md hover:bg-gray-100"
          >
            <TrashIcon className="h-5 w-5 text-red-500" />
          </button>
          <span className={`px-2 py-1 rounded-full text-xs ${box.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {box.is_active ? 'Activo' : 'Inactivo'}
          </span>
        </div>
      </div>
      <div className="mt-4">
        {box.api_endpoint && (
          <Text className="text-sm">API: {box.api_endpoint}</Text>
        )}
        {box.email_casilla && (
          <Text className="text-sm">Email: {box.email_casilla}</Text>
        )}
        
        <div className="mt-4 flex flex-col sm:flex-row justify-end gap-2">
          <Button
            onClick={() => handleGestionEmisoresClick(box)}
            icon={UserGroupIcon}
            size="xs"
            className="bg-blue-600 text-white hover:bg-blue-700 text-xs sm:text-sm whitespace-normal text-left sm:text-center"
          >
            <span className="hidden sm:inline">Gestión de </span>Emisores ({emisoresCounts[box.id] || 0})
          </Button>
          <Button
            onClick={() => handleGestionSuscripcionesClick(box)}
            icon={BellIcon}
            size="xs"
            className="bg-indigo-600 text-white hover:bg-indigo-700 text-xs sm:text-sm whitespace-normal text-left sm:text-center"
          >
            <span className="hidden sm:inline">Gestión de </span>Suscripciones ({suscripcionesCounts[box.id] || 0})
          </Button>
        </div>
      </div>
    </Card>
  );

  const handleEditClick = (box: DataBox) => {
    setEditingBox(box);
  };

  const handleEditSubmit = async (data: any): Promise<{ executionUuid?: string }> => {
    const result = await onEditClick(data);
    setEditingBox(null);
    return result; // Devolver el resultado del onEditClick
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <Title>Casillas de Datos</Title>
        <div className="flex gap-2">
          <button
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            onClick={onNewClick}
          >
            <PlusIcon className="h-5 w-5" />
            Nueva Casilla
          </button>
        </div>
      </div>

      <div className="mb-6">
        <input
          type="text"
          placeholder="Buscar por instalación, organización, producto o país..."
          className="w-full p-2 border rounded-md"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className={`grid ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'} gap-4`}>
        {Array.isArray(dataBoxes) && dataBoxes.map((box) => (
          viewMode === 'grid' ? renderGridView(box) : renderListView(box)
        ))}
      </div>

      <Dialog
        open={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        className="relative z-50"
      >
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-sm mx-auto">
            <h3 className="text-lg font-medium mb-4">Confirmar eliminación</h3>
            <p className="text-sm text-gray-600 mb-4">
              ¿Está seguro que desea eliminar esta casilla de datos? Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="primary"
                onClick={() => setDeleteConfirm(null)}
              >
                Cancelar
              </Button>
              <Button
                variant="secondary"
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
          </div>
        </div>
      </Dialog>

      <EditDataBoxModal
        isOpen={editingBox !== null}
        onClose={() => setEditingBox(null)}
        dataBox={editingBox}
        onSubmit={handleEditSubmit}
      />
    </div>
  );
};