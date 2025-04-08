import React, { useState } from 'react';
import { Suscripcion } from '../../../types';
import { Card, Button, ContentStatus, SearchInput, FormField } from '../../components';
import { PencilIcon, TrashIcon, PlusIcon } from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog } from '@headlessui/react';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

interface SuscripcionesListProps {
  suscripciones: Suscripcion[];
  loading: boolean;
  error: Error | null;
  casillaId: number;
  onAdd: (suscripcion: Partial<Suscripcion>) => Promise<void>;
  onEdit: (suscripcion: Suscripcion) => Promise<void>;
  onDelete: (suscripcion: Suscripcion) => Promise<void>;
}

// Esquema de validación
const schema = z.object({
  nombre: z.string().min(1, { message: 'El nombre es requerido' }),
  email: z.string().email({ message: 'Debes ingresar un email válido' }),
  tipo: z.enum(['error', 'warning', 'info', 'all'], {
    required_error: 'Debes seleccionar un tipo de notificación',
  }),
  is_active: z.boolean().default(true),
});

export const SuscripcionesList: React.FC<SuscripcionesListProps> = ({
  suscripciones = [],
  loading = false,
  error = null,
  casillaId,
  onAdd,
  onEdit,
  onDelete,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSuscripcion, setSelectedSuscripcion] = useState<Suscripcion | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Suscripcion | null>(null);

  const methods = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      nombre: selectedSuscripcion?.nombre || '',
      email: selectedSuscripcion?.email || '',
      tipo: selectedSuscripcion?.tipo || 'all',
      is_active: selectedSuscripcion?.is_active !== undefined ? selectedSuscripcion.is_active : true,
    },
  });

  const { handleSubmit, reset, formState } = methods;

  // Resetear form cuando cambia la suscripción seleccionada
  React.useEffect(() => {
    if (isModalOpen) {
      reset({
        nombre: selectedSuscripcion?.nombre || '',
        email: selectedSuscripcion?.email || '',
        tipo: selectedSuscripcion?.tipo || 'all',
        is_active: selectedSuscripcion?.is_active !== undefined ? selectedSuscripcion.is_active : true,
      });
    }
  }, [selectedSuscripcion, isModalOpen, reset]);

  // Filtrar suscripciones por término de búsqueda
  const filteredSuscripciones = suscripciones.filter((suscripcion) => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    return (
      suscripcion.nombre.toLowerCase().includes(searchLower) ||
      suscripcion.email.toLowerCase().includes(searchLower)
    );
  });

  const handleEditClick = (suscripcion: Suscripcion) => {
    setSelectedSuscripcion(suscripcion);
    setIsModalOpen(true);
  };

  const handleAddClick = () => {
    setSelectedSuscripcion(null);
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (data: any) => {
    try {
      if (selectedSuscripcion) {
        // Editar suscripción existente
        await onEdit({
          ...selectedSuscripcion,
          ...data,
        });
      } else {
        // Agregar nueva suscripción
        await onAdd({
          ...data,
          casilla_id: casillaId,
        });
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error al guardar suscripción:', error);
    }
  };

  // Obtener color de badge según el tipo de notificación
  const getTipoBadgeClass = (tipo: string) => {
    switch (tipo) {
      case 'error':
        return 'bg-red-100 text-red-800';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800';
      case 'info':
        return 'bg-blue-100 text-blue-800';
      case 'all':
        return 'bg-indigo-100 text-indigo-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Obtener texto según el tipo de notificación
  const getTipoText = (tipo: string) => {
    switch (tipo) {
      case 'error':
        return 'Errores';
      case 'warning':
        return 'Advertencias';
      case 'info':
        return 'Información';
      case 'all':
        return 'Todos';
      default:
        return tipo;
    }
  };

  // Mostrar estados de carga y error
  if (loading) {
    return <ContentStatus status="loading" title="Cargando suscripciones" />;
  }

  if (error) {
    return <ContentStatus status="error" title="Error al cargar suscripciones" message={error.message} />;
  }

  if (suscripciones.length === 0) {
    return (
      <div>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Suscripciones</h2>
          <Button 
            onClick={handleAddClick}
            icon={<PlusIcon className="h-5 w-5" />}
          >
            Agregar Suscripción
          </Button>
        </div>
        <ContentStatus 
          status="empty" 
          title="No hay suscripciones configuradas" 
          message="Agrega una nueva suscripción para comenzar a recibir notificaciones."
        />
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Suscripciones</h2>
        <Button 
          onClick={handleAddClick}
          icon={<PlusIcon className="h-5 w-5" />}
        >
          Agregar Suscripción
        </Button>
      </div>

      <div className="mb-6">
        <SearchInput
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Buscar por nombre o email..."
        />
      </div>

      {filteredSuscripciones.length === 0 ? (
        <ContentStatus 
          status="empty" 
          title="No se encontraron resultados" 
          message="No hay suscripciones que coincidan con tu búsqueda."
        />
      ) : (
        <div className="space-y-4">
          <AnimatePresence>
            {filteredSuscripciones.map((suscripcion) => (
              <motion.div
                key={suscripcion.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.2 }}
              >
                <Card>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">{suscripcion.nombre}</h3>
                      <p className="text-sm text-gray-600">{suscripcion.email}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-1 rounded-full text-xs ${getTipoBadgeClass(suscripcion.tipo)}`}>
                        {getTipoText(suscripcion.tipo)}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs ${suscripcion.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {suscripcion.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                      <button
                        onClick={() => handleEditClick(suscripcion)}
                        className="p-1 rounded-md hover:bg-gray-100"
                      >
                        <PencilIcon className="h-5 w-5 text-gray-500" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(suscripcion)}
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
              {selectedSuscripcion ? 'Editar Suscripción' : 'Agregar Suscripción'}
            </Dialog.Title>
            
            <FormProvider {...methods}>
              <form onSubmit={handleSubmit(handleFormSubmit)}>
                <FormField
                  name="nombre"
                  label="Nombre"
                  required
                  placeholder="Nombre de la persona o equipo"
                />
                
                <FormField
                  name="email"
                  label="Email"
                  type="email"
                  required
                  placeholder="email@ejemplo.com"
                />
                
                <FormField
                  name="tipo"
                  label="Tipo de notificaciones"
                  type="select"
                  required
                  options={[
                    { value: 'error', label: 'Errores' },
                    { value: 'warning', label: 'Advertencias' },
                    { value: 'info', label: 'Información' },
                    { value: 'all', label: 'Todos' },
                  ]}
                  helperText="Determina qué tipo de notificaciones recibirá esta suscripción"
                />
                
                <FormField
                  name="is_active"
                  label="Activo"
                  type="checkbox"
                  placeholder="La suscripción está activa"
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
                    {selectedSuscripcion ? 'Actualizar' : 'Agregar'}
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
              ¿Estás seguro de que deseas eliminar la suscripción "{deleteConfirm?.nombre}"? Esta acción no se puede deshacer.
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