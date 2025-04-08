import React from 'react';
import { Dialog } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Casilla, Instalacion } from '../../../types';
import { FormField, Button } from '../../components';

interface DataBoxFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<any>;
  dataBox?: Casilla | null;
  installations: Instalacion[];
}

// Esquema de validación para el formulario
const schema = z.object({
  instalacion_id: z.number({
    required_error: 'La instalación es requerida',
    invalid_type_error: 'La instalación debe ser un número'
  }),
  nombre_yaml: z.string().min(1, 'El nombre del archivo YAML es requerido'),
  yaml_content: z.string().min(1, 'El contenido YAML es requerido'),
  api_endpoint: z.string().optional(),
  email_casilla: z.string().email('Email inválido').optional().or(z.literal('')),
  is_active: z.boolean().default(true)
});

export const DataBoxForm: React.FC<DataBoxFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  dataBox,
  installations
}) => {
  // Determinar el valor inicial para yaml_content basado en lo que esté disponible
  const getInitialYamlContent = () => {
    if (dataBox?.yaml_contenido) {
      return dataBox.yaml_contenido;
    } else if (typeof dataBox?.yaml_content === 'string') {
      return dataBox.yaml_content;
    } else if (dataBox?.yaml_content) {
      // Si es un objeto, convertirlo a string
      try {
        return JSON.stringify(dataBox.yaml_content, null, 2);
      } catch (e) {
        console.error("Error stringify yaml_content", e);
        return '';
      }
    }
    return '';
  };

  const methods = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      instalacion_id: dataBox?.instalacion_id || 0,
      nombre_yaml: dataBox?.nombre_yaml || '',
      yaml_content: getInitialYamlContent(),
      api_endpoint: dataBox?.api_endpoint || '',
      email_casilla: dataBox?.email_casilla || '',
      is_active: dataBox?.is_active !== undefined ? dataBox.is_active : true
    }
  });

  const { handleSubmit, formState: { isSubmitting, errors } } = methods;

  const processSubmit = async (data: any) => {
    try {
      await onSubmit(data);
      onClose();
    } catch (error) {
      console.error('Error submitting form:', error);
    }
  };

  return (
    <Dialog 
      open={isOpen} 
      onClose={onClose}
      className="relative z-50"
    >
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="w-full max-w-3xl rounded-lg bg-white p-6">
          <div className="flex justify-between items-center mb-4">
            <Dialog.Title className="text-lg font-medium">
              {dataBox ? 'Editar Casilla' : 'Nueva Casilla'}
            </Dialog.Title>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <FormProvider {...methods}>
            <form onSubmit={handleSubmit(processSubmit)}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <FormField
                  name="instalacion_id"
                  label="Instalación"
                  type="select"
                  required
                  options={installations.map(inst => ({
                    value: inst.id,
                    label: inst.nombre
                  }))}
                />

                <FormField
                  name="nombre_yaml"
                  label="Nombre del archivo YAML"
                  required
                  placeholder="configuracion.yaml"
                  helperText="Nombre del archivo de configuración YAML"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <FormField
                  name="api_endpoint"
                  label="Endpoint API"
                  placeholder="https://api.ejemplo.com/v1/datos"
                  helperText="URL del endpoint de API (opcional)"
                />

                <FormField
                  name="email_casilla"
                  label="Email de la casilla"
                  type="email"
                  placeholder="casilla@ejemplo.com"
                  helperText="Email asociado a la casilla (opcional)"
                />
              </div>

              <FormField
                name="yaml_content"
                label="Contenido YAML"
                type="textarea"
                required
                rows={10}
                placeholder="sage_yaml:\n  name: 'Nombre de la configuración'\n  description: 'Descripción de la configuración'"
                helperText="Contenido del archivo YAML con la configuración"
              />

              <FormField
                name="is_active"
                label="Activo"
                type="checkbox"
                placeholder="La casilla está activa"
              />

              <div className="flex justify-end gap-2 mt-6">
                <Button
                  variant="outline"
                  onClick={onClose}
                  type="button"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  isLoading={isSubmitting}
                >
                  {dataBox ? 'Actualizar' : 'Crear'}
                </Button>
              </div>
            </form>
          </FormProvider>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};