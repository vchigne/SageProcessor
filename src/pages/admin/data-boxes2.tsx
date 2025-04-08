import React, { useState } from 'react';
import { useCasillas, useDeleteCasilla, useCreateCasilla, useUpdateCasilla } from '../../hooks/useCasillas';
import { useInstalaciones } from '../../hooks/useInstalaciones';
import { DataBoxList, AdvancedDataBoxForm } from '../../ui/components';
import { Casilla } from '../../types';
import { toast } from 'react-toastify';

export default function DataBoxesPage() {
  const [filter, setFilter] = useState({
    search: '',
    isActive: undefined,
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDataBox, setSelectedDataBox] = useState<Casilla | null>(null);

  // Obtener casillas con React Query
  const { data: casillas = [], isLoading, error } = useCasillas(filter);
  const { data: instalaciones = [] } = useInstalaciones();

  // Mutaciones
  const deleteCasillaMutation = useDeleteCasilla();
  const createCasillaMutation = useCreateCasilla();
  const updateCasillaMutation = useUpdateCasilla();

  const handleNewClick = () => {
    setSelectedDataBox(null);
    setIsModalOpen(true);
  };

  const handleEditClick = (dataBox: Casilla) => {
    setSelectedDataBox(dataBox);
    setIsModalOpen(true);
  };

  const handleDeleteClick = async (dataBox: Casilla) => {
    try {
      await deleteCasillaMutation.mutateAsync(dataBox.id);
      toast.success('Casilla eliminada correctamente');
    } catch (err) {
      toast.error('Error al eliminar la casilla');
      console.error(err);
    }
  };

  const handleSubmit = async (data: any) => {
    try {
      if (selectedDataBox) {
        // Actualizar casilla existente
        await updateCasillaMutation.mutateAsync({
          id: selectedDataBox.id,
          ...data
        });
        toast.success('Casilla actualizada correctamente');
      } else {
        // Crear nueva casilla
        await createCasillaMutation.mutateAsync(data);
        toast.success('Casilla creada correctamente');
      }
      return {}; // La API espera un objeto como respuesta
    } catch (error) {
      console.error('Error:', error);
      toast.error('Ha ocurrido un error');
      throw error;
    }
  };

  // Solicitar datos de los conteos de emisores y suscripciones
  const emisoresCounts = casillas.reduce((acc, casilla) => {
    acc[casilla.id] = Math.floor(Math.random() * 10); // Esto es solo un ejemplo temporal
    return acc;
  }, {} as Record<number, number>);

  const suscripcionesCounts = casillas.reduce((acc, casilla) => {
    acc[casilla.id] = Math.floor(Math.random() * 20); // Esto es solo un ejemplo temporal
    return acc;
  }, {} as Record<number, number>);

  return (
    <div className="container mx-auto px-4 py-8">
      <DataBoxList
        dataBoxes={casillas}
        loading={isLoading}
        error={error as Error}
        onNewClick={handleNewClick}
        onEditClick={handleEditClick}
        onDeleteClick={handleDeleteClick}
        emisoresCounts={emisoresCounts}
        suscripcionesCounts={suscripcionesCounts}
      />

      <AdvancedDataBoxForm
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmit}
        dataBox={selectedDataBox}
        installations={instalaciones}
      />
    </div>
  );
}