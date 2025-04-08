import React, { useState } from 'react';
import { Emisor } from '../../../types';
import { Card, Button, ContentStatus, SearchInput, FormField } from '../../components';
import { PencilIcon, TrashIcon, PlusIcon } from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog } from '@headlessui/react';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

interface EmisoresListProps {
  emisores: Emisor[];
  loading: boolean;
  error: Error | null;
  casillaId: number;
  onAdd: (emisor: Partial<Emisor>) => Promise<void>;
  onEdit: (emisor: Emisor) => Promise<void>;
  onDelete: (emisor: Emisor) => Promise<void>;
}

// Esquema de validación
const schema = z.object({
  nombre: z.string().min(1, { message: 'El nombre es requerido' }),
  email: z.string().email({ message: 'Debes ingresar un email válido' }),
  is_active: z.boolean().default(true),
});

export const EmisoresList: React.FC<EmisoresListProps> = ({
  emisores = [],
  loading = false,
  error = null,
  casillaId,
  onAdd,
  onEdit,
  onDelete,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEmisor, setSelectedEmisor] = useState<Emisor | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Emisor | null>(null);

  const methods = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      nombre: selectedEmisor?.nombre || '',
      email: selectedEmisor?.email || '',
      is_active: selectedEmisor?.is_active !== undefined ? selectedEmisor.is_active : true,
    },
  });

  const { handleSubmit, reset, formState } = methods;

  // Resetear form cuando cambia el emisor seleccionado
  React.useEffect(() => {
    if (isModalOpen) {
      reset({
        nombre: selectedEmisor?.nombre || '',
        email: selectedEmisor?.email || '',
        is_active: selectedEmisor?.is_active !== undefined ? selectedEmisor.is_active : true,
      });
    }
  }, [selectedEmisor, isModalOpen, reset]);

  // Filtrar emisores por término de búsqueda
  const filteredEmisores = emisores.filter((emisor) => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    return (
      emisor.nombre.toLowerCase().includes(searchLower) ||
      emisor.email.toLowerCase().includes(searchLower)
    );
  });

  const handleEditClick = (emisor: Emisor) => {
    setSelectedEmisor(emisor);
    setIsModalOpen(true);
  };

  const handleAddClick = () => {
    setSelectedEmisor(null);
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (data: any) => {
    try {
      if (selectedEmisor) {
        // Editar emisor existente
        await onEdit({
          ...selectedEmisor,
          ...data,
        });
      } else {
        // Agregar nuevo emisor
        await onAdd({
          ...data,
          casilla_id: casillaId,
        });
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error al guardar emisor:', error);
    }
  };

  // Mostrar estados de carga y error
  if (loading) {
    return <ContentStatus status="loading" title="Cargando emisores" />;
  }

  if (error) {
    return <ContentStatus status="error" title="Error al cargar emisores" message={error.message} />;
  }

  if (emisores.length === 0) {
    return (
      <div>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Emisores</h2>
          <Button 
            onClick={handleAddClick}
            icon={<PlusIcon className="h-5 w-5" />}
          >
            Agregar Emisor
          </Button>
        </div>
        <ContentStatus 
          status="empty" 
          title="No hay emisores configurados" 
          message="Agrega un nuevo emisor para comenzar a recibir notificaciones."
        />
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Emisores</h2>
        <Button 
          onClick={handleAddClick}
          icon={<PlusIcon className="h-5 w-5" />}
        >
          Agregar Emisor
        </Button>
      </div>

      <div className="mb-6">
        <SearchInput
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Buscar por nombre o email..."
        />
      </div>

      {filteredEmisores.length === 0 ? (
        <ContentStatus 
          status="empty" 
          title="No se encontraron resultados" 
          message="No hay emisores que coincidan con tu búsqueda."
        />
      ) : (
        <div className="space-y-4">
          <AnimatePresence>
            {filteredEmisores.map((emisor) => (
              <motion.div
                key={emisor.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.2 }}
              >
                <Card>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">{emisor.nombre}</h3>
                      <p className="text-sm text-gray-600">{emisor.email}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-1 rounded-full text-xs ${emisor.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {emisor.is_active ? 'Activo' : 'Inactivo'}
                      </span>
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
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Modal de Edición/Creación */}
      <Dialog
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        className="relative z-50"
      >
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="w-full max-w-md rounded-lg bg-white p-6">
            <Dialog.Title className="text-lg font-medium mb-4">
              {selectedEmisor ? 'Editar Emisor' : 'Agregar Emisor'}
            </Dialog.Title>
            
            <FormProvider {...methods}>
              <form onSubmit={handleSubmit(handleFormSubmit)}>
                <FormField
                  name="nombre"
                  label="Nombre"
                  required
                  placeholder="Nombre del emisor"
                />
                
                <FormField
                  name="email"
                  label="Email"
                  type="email"
                  required
                  placeholder="email@ejemplo.com"
                />
                
                <FormField
                  name="is_active"
                  label="Activo"
                  type="checkbox"
                  placeholder="El emisor está activo"
                />
                
                <div className="flex justify-end gap-2 mt-6">
                  <Button
                    variant="outline"
                    onClick={() => setIsModalOpen(false)}
                    type="button"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    isLoading={formState.isSubmitting}
                  >
                    {selectedEmisor ? 'Actualizar' : 'Agregar'}
                  </Button>
                </div>
              </form>
            </FormProvider>
          </Dialog.Panel>
        </div>
      </Dialog>

      {/* Modal de Confirmación de Eliminación */}
      <Dialog
        open={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        className="relative z-50"
      >
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="w-full max-w-sm rounded-lg bg-white p-6">
            <Dialog.Title className="text-lg font-medium mb-4">Confirmar eliminación</Dialog.Title>
            
            <p className="text-sm text-gray-600 mb-4">
              ¿Estás seguro de que deseas eliminar el emisor "{deleteConfirm?.nombre}"? Esta acción no se puede deshacer.
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
                onClick={async () => {
                  if (deleteConfirm) {
                    await onDelete(deleteConfirm);
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