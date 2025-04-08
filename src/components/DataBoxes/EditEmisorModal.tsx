import React, { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { Button, TextInput, Select, SelectItem } from '@tremor/react';

interface EditEmisorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  emisor: {
    id: number;
    nombre: string;
    tipo_emisor: string;
    email_corporativo: string;
    telefono: string;
    organizacion_id: number;
    activo: boolean;
  };
}

interface Organizacion {
  id: number;
  nombre: string;
}

const TIPOS_EMISOR = [
  'interno',
  'corporativo',
  'distribuidora',
  'bot',
  'cadena mt',
  'eccomerce',
  'erp',
  'otros'
];

export const EditEmisorModal: React.FC<EditEmisorModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  emisor
}) => {
  const [formData, setFormData] = useState({
    id: emisor.id,
    nombre: emisor.nombre,
    tipo_emisor: emisor.tipo_emisor,
    email_corporativo: emisor.email_corporativo,
    telefono: emisor.telefono,
    organizacion_id: emisor.organizacion_id.toString(),
    activo: emisor.activo,
  });

  const [organizaciones, setOrganizaciones] = useState<Organizacion[]>([]);

  useEffect(() => {
    const fetchOrganizaciones = async () => {
      try {
        const response = await fetch('/api/organizaciones');
        if (!response.ok) {
          throw new Error('Error fetching organizaciones');
        }
        const data = await response.json();
        setOrganizaciones(data);
      } catch (error) {
        console.error('Error fetching organizaciones:', error);
      }
    };

    if (isOpen) {
      fetchOrganizaciones();
    }
  }, [isOpen]);

  // Update form data when emisor prop changes
  useEffect(() => {
    setFormData({
      id: emisor.id,
      nombre: emisor.nombre,
      tipo_emisor: emisor.tipo_emisor,
      email_corporativo: emisor.email_corporativo,
      telefono: emisor.telefono,
      organizacion_id: emisor.organizacion_id.toString(),
      activo: emisor.activo,
    });
  }, [emisor]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!formData.tipo_emisor) {
        alert('Por favor seleccione un tipo de emisor');
        return;
      }

      if (!formData.organizacion_id) {
        alert('Por favor seleccione una organización');
        return;
      }

      const dataToSubmit = {
        ...formData,
        organizacion_id: parseInt(formData.organizacion_id),
        tipo_emisor: formData.tipo_emisor.toLowerCase()
      };

      await onSubmit(dataToSubmit);
      onClose();
    } catch (error: any) {
      console.error('Error updating emisor:', error);
      alert(error.message || 'Error al actualizar el emisor');
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
        <Dialog.Panel className="w-full max-w-xl bg-white rounded-lg shadow-xl max-h-[90vh] flex flex-col">
          <div className="p-6 border-b">
            <Dialog.Title className="text-lg font-medium">
              Editar Emisor
            </Dialog.Title>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Nombre
                </label>
                <TextInput
                  className="mt-1"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  placeholder="Nombre del emisor"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Tipo de Emisor
                </label>
                <Select
                  className="mt-1"
                  value={formData.tipo_emisor}
                  onValueChange={(value) => setFormData({ ...formData, tipo_emisor: value })}
                  placeholder="Seleccionar tipo de emisor"
                >
                  {TIPOS_EMISOR.map((tipo) => (
                    <SelectItem key={tipo} value={tipo}>
                      {tipo.charAt(0).toUpperCase() + tipo.slice(1)}
                    </SelectItem>
                  ))}
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Organización
                </label>
                <Select
                  className="mt-1"
                  value={formData.organizacion_id}
                  onValueChange={(value) => setFormData({ ...formData, organizacion_id: value })}
                  placeholder="Seleccionar organización"
                >
                  {organizaciones.map((org) => (
                    <SelectItem key={org.id} value={org.id.toString()}>
                      {org.nombre}
                    </SelectItem>
                  ))}
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Email Corporativo
                </label>
                <TextInput
                  type="email"
                  className="mt-1"
                  value={formData.email_corporativo}
                  onChange={(e) => setFormData({ ...formData, email_corporativo: e.target.value })}
                  placeholder="Email corporativo"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Teléfono
                </label>
                <TextInput
                  className="mt-1"
                  value={formData.telefono}
                  onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                  placeholder="Teléfono"
                />
              </div>

              <div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.activo}
                    onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Emisor activo
                  </span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="secondary" onClick={onClose} type="button">
                  Cancelar
                </Button>
                <Button 
                  variant="primary" 
                  type="submit"
                >
                  Guardar Cambios
                </Button>
              </div>
            </form>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};
