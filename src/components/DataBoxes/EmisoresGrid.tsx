import React, { useState } from 'react';
import { Card, Title, Text, Button } from '@tremor/react';
import { Dialog } from '@headlessui/react';
import { PlusIcon, ListBulletIcon, Squares2X2Icon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import { EditEmisorModal } from './EditEmisorModal';

interface Emisor {
  id: number;
  nombre: string;
  tipo_emisor: string;
  email_corporativo: string;
  telefono: string;
  organizacion_id: number;
  creado_en: string;
  activo: boolean;
}

interface EmisoresGridProps {
  emisores: Emisor[];
  onNewClick: () => void;
  onEditClick: (emisor: Emisor) => void;
  onDeleteClick: (emisor: Emisor) => void;
}

export const EmisoresGrid: React.FC<EmisoresGridProps> = ({
  emisores = [],
  onNewClick,
  onEditClick,
  onDeleteClick
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<Emisor | null>(null);
  const [editingEmisor, setEditingEmisor] = useState<Emisor | null>(null);

  const filteredEmisores = emisores.filter(emisor => {
    if (!searchTerm) return true;
    const termino = searchTerm.toLowerCase();
    return emisor.nombre.toLowerCase().includes(termino) ||
           emisor.tipo_emisor?.toLowerCase().includes(termino) ||
           emisor.email_corporativo?.toLowerCase().includes(termino);
  });

  const handleEditClick = (emisor: Emisor) => {
    setEditingEmisor(emisor);
  };

  const handleEditSubmit = async (data: any) => {
    await onEditClick(data);
    setEditingEmisor(null);
  };

  const renderListView = (emisor: Emisor) => (
    <Card key={emisor.id} className="p-4">
      <div className="flex justify-between items-center">
        <div className="flex-1">
          <Text className="font-medium">{emisor.nombre}</Text>
          <Text className="text-sm text-gray-500">{emisor.tipo_emisor}</Text>
          <Text className="text-sm">{emisor.email_corporativo}</Text>
        </div>
        <div className="flex items-center gap-2">
          <Text className="text-sm">Tel: {emisor.telefono}</Text>
          <button
            onClick={() => handleEditClick(emisor)}
            className="p-1 rounded-md hover:bg-gray-100"
          >
            <PencilIcon className="h-5 w-5 text-gray-500" />
          </button>
          <button
            onClick={() => setDeleteConfirm(emisor)}
            className="p-1 rounded-md hover:bg-gray-100"
          >
            <TrashIcon className="h-5 w-5 text-red-500" />
          </button>
          <span className={`px-2 py-1 rounded-full text-xs ${emisor.activo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {emisor.activo ? 'Activo' : 'Inactivo'}
          </span>
        </div>
      </div>
    </Card>
  );

  const renderGridView = (emisor: Emisor) => (
    <Card key={emisor.id} className="p-4">
      <div className="flex justify-between items-start">
        <div>
          <Text className="font-medium">{emisor.nombre}</Text>
          <Text className="text-sm text-gray-500">{emisor.tipo_emisor}</Text>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleEditClick(emisor)}
            className="p-1 rounded-md hover:bg-gray-100"
          >
            <PencilIcon className="h-5 w-5 text-gray-500" />
          </button>
          <button
            onClick={() => setDeleteConfirm(emisor)}
            className="p-1 rounded-md hover:bg-gray-100"
          >
            <TrashIcon className="h-5 w-5 text-red-500" />
          </button>
        </div>
      </div>

      <div className="mt-4">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <Text className="text-gray-500">Email:</Text>
          <Text>{emisor.email_corporativo}</Text>
          <Text className="text-gray-500">Teléfono:</Text>
          <Text>{emisor.telefono}</Text>
          <Text className="text-gray-500">Creado:</Text>
          <Text>{new Date(emisor.creado_en).toLocaleDateString()}</Text>
        </div>
        <div className="mt-2">
          <span className={`px-2 py-1 rounded-full text-xs ${emisor.activo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {emisor.activo ? 'Activo' : 'Inactivo'}
          </span>
        </div>
      </div>
    </Card>
  );

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <Title>Emisores</Title>
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
            Nuevo Emisor
          </button>
        </div>
      </div>

      <div className="mb-6">
        <input
          type="text"
          placeholder="Buscar por nombre, tipo o email..."
          className="w-full p-2 border rounded-md"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className={`grid ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'} gap-4`}>
        {filteredEmisores.map((emisor) => (
          viewMode === 'grid' ? renderGridView(emisor) : renderListView(emisor)
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
              ¿Está seguro que desea eliminar este emisor? Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setDeleteConfirm(null)}
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
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

      {editingEmisor && (
        <EditEmisorModal
          isOpen={true}
          onClose={() => setEditingEmisor(null)}
          onSubmit={handleEditSubmit}
          emisor={editingEmisor}
        />
      )}
    </div>
  );
};