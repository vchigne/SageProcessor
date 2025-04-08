import React, { useState } from 'react';
import { Card, Title, Text, Button } from '@tremor/react';
import { Dialog } from '@headlessui/react';
import { PlusIcon, ListBulletIcon, Squares2X2Icon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';

interface Responsable {
  id: number;
  emisor: string;
  casilla: string;
  responsable_nombre: string;
  responsable_email: string;
  responsable_telefono?: string;
  organizacion: string;
  pais: string;
  producto: string;
  instalacion_id: string;
  configuracion_frecuencia: {
    tipo: string;
    hora: string;
    dias_semana?: number[];
    dias_mes?: number[];
  };
  activo: boolean;
}

interface ResponsablesGridProps {
  responsables: Responsable[];
  onNewClick: () => void;
  onEditClick: (responsable: Responsable) => void;
  onDeleteClick: (responsable: Responsable) => void;
}

const formatFrecuencia = (config: any) => {
  if (!config) return 'No configurada';

  const hora = config.hora || '09:00';
  const tipo = config.tipo || 'Diaria';

  if (tipo === 'Diaria') {
    return `Diaria a las ${hora}`;
  }

  if (tipo === 'Semanal' && config.dias_semana) {
    const diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const dias = config.dias_semana.map((d: number) => diasSemana[d-1]).join(', ');
    return `Semanal: ${dias} a las ${hora}`;
  }

  if (tipo === 'Mensual' && config.dias_mes) {
    const dias = config.dias_mes.join(', ');
    return `Mensual: días ${dias} a las ${hora}`;
  }

  return `${tipo} a las ${hora}`;
};

export const ResponsablesGrid: React.FC<ResponsablesGridProps> = ({
  responsables = [],
  onNewClick,
  onEditClick,
  onDeleteClick
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<Responsable | null>(null);

  const filteredResponsables = responsables.filter(resp => {
    if (!searchTerm) return true;
    const termino = searchTerm.toLowerCase();
    return (
      resp.responsable_nombre.toLowerCase().includes(termino) ||
      resp.emisor.toLowerCase().includes(termino) ||
      resp.instalacion_id.toString().toLowerCase().includes(termino) ||
      resp.casilla.toLowerCase().includes(termino) ||
      resp.organizacion.toLowerCase().includes(termino) ||
      resp.pais.toLowerCase().includes(termino) ||
      resp.producto.toLowerCase().includes(termino)
    );
  });

  const renderListView = (resp: Responsable) => (
    <Card key={resp.id} className="p-4">
      <div className="flex justify-between items-center">
        <div className="flex-1">
          <Text className="font-medium">{resp.responsable_nombre}</Text>
          <Text className="text-sm text-gray-500">{resp.responsable_email}</Text>
          {resp.responsable_telefono && (
            <Text className="text-sm text-gray-500">Tel: {resp.responsable_telefono}</Text>
          )}
          <Text className="text-sm">
            {resp.emisor} | {resp.casilla}
          </Text>
          <Text className="text-sm text-gray-500">
            {formatFrecuencia(resp.configuracion_frecuencia)}
          </Text>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onEditClick(resp)}
            className="p-1 rounded-md hover:bg-gray-100"
          >
            <PencilIcon className="h-5 w-5 text-gray-500" />
          </button>
          <button
            onClick={() => setDeleteConfirm(resp)}
            className="p-1 rounded-md hover:bg-gray-100"
          >
            <TrashIcon className="h-5 w-5 text-red-500" />
          </button>
        </div>
      </div>
    </Card>
  );

  const renderGridView = (resp: Responsable) => (
    <Card key={resp.id} className="p-4">
      <div className="flex justify-between items-start">
        <div>
          <Text className="font-medium">{resp.responsable_nombre}</Text>
          <Text className="text-sm text-gray-500">{resp.responsable_email}</Text>
          {resp.responsable_telefono && (
            <Text className="text-sm text-gray-500">Tel: {resp.responsable_telefono}</Text>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onEditClick(resp)}
            className="p-1 rounded-md hover:bg-gray-100"
          >
            <PencilIcon className="h-5 w-5 text-gray-500" />
          </button>
          <button
            onClick={() => setDeleteConfirm(resp)}
            className="p-1 rounded-md hover:bg-gray-100"
          >
            <TrashIcon className="h-5 w-5 text-red-500" />
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <Text className="text-gray-500">Emisor:</Text>
          <Text>{resp.emisor}</Text>
          <Text className="text-gray-500">Casilla:</Text>
          <Text>{resp.casilla}</Text>
          <Text className="text-gray-500">Instalación:</Text>
          <Text>{resp.instalacion_id}</Text>
          <Text className="text-gray-500">Organización:</Text>
          <Text>{resp.organizacion}</Text>
          <Text className="text-gray-500">País:</Text>
          <Text>{resp.pais}</Text>
          <Text className="text-gray-500">Producto:</Text>
          <Text>{resp.producto}</Text>
          <Text className="text-gray-500">Frecuencia:</Text>
          <Text>{formatFrecuencia(resp.configuracion_frecuencia)}</Text>
          {resp.responsable_telefono && (
            <>
              <Text className="text-gray-500">Teléfono:</Text>
              <Text>{resp.responsable_telefono}</Text>
            </>
          )}
        </div>
      </div>
    </Card>
  );

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <Title>Responsables</Title>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            className="p-2 rounded-md hover:bg-gray-100"
          >
            {viewMode === 'grid' ? (
              <ListBulletIcon className="h-5 w-5" />
            ) : (
              <Squares2X2Icon className="h-5 w-5" />
            )}
          </button>
          <button
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            onClick={onNewClick}
          >
            <PlusIcon className="h-5 w-5" />
            Nuevo Responsable
          </button>
        </div>
      </div>

      <div className="mb-6">
        <input
          type="text"
          placeholder="Buscar por nombre, emisor, instalación, casilla, organización, país o producto..."
          className="w-full p-2 border rounded-md"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className={`grid ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'} gap-4`}>
        {filteredResponsables.map((resp) => (
          viewMode === 'grid' ? renderGridView(resp) : renderListView(resp)
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
              ¿Está seguro que desea eliminar este responsable? Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setDeleteConfirm(null)}
              >
                Cancelar
              </Button>
              <Button
                variant="secondary"
                color="red"
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
    </div>
  );
};