import React, { useState } from 'react';
import { useCasillas, useDeleteCasilla, useCreateCasilla, useUpdateCasilla } from '../../hooks/useCasillas';
import { useInstalaciones } from '../../hooks/useInstalaciones';
import { DataBoxList, EnhancedDataBoxForm } from '../../ui/components';
import { Casilla } from '../../types';
import { toast } from 'react-toastify';
import FileUploadModal from '../../components/FileUpload/FileUploadModal';
import { useRouter } from 'next/router';

export default function DataBoxesPage() {
  const router = useRouter();
  const [filter, setFilter] = useState({
    search: '',
    isActive: undefined,
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
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

  const handleUploadClick = (dataBox: Casilla) => {
    setSelectedDataBox(dataBox);
    setIsUploadModalOpen(true);
  };
  
  const handleMaterializationsClick = (dataBox: Casilla) => {
    router.push(`/admin/data-boxes/${dataBox.id}/materializations`);
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

  // Estados para almacenar los conteos reales
  const [emisoresCounts, setEmisoresCounts] = useState<Record<number, number>>({});
  const [suscripcionesCounts, setSuscripcionesCounts] = useState<Record<number, number>>({});

  // Función para cargar conteos de emisores
  const fetchEmisoresCounts = async () => {
    try {
      const response = await fetch('/api/data-boxes/emisores-counts');
      if (response.ok) {
        const data = await response.json();
        const counts = data.reduce((acc: Record<number, number>, item: { casilla_id: number, emisores_count: number }) => {
          acc[item.casilla_id] = item.emisores_count || 0;
          return acc;
        }, {});
        setEmisoresCounts(counts);
      }
    } catch (error) {
      console.error('Error al cargar conteos de emisores:', error);
    }
  };

  // Función para cargar conteos de suscripciones
  const fetchSuscripcionesCounts = async () => {
    try {
      const response = await fetch('/api/suscripciones/counts');
      if (response.ok) {
        const data = await response.json();
        const counts = data.reduce((acc: Record<number, number>, item: { casilla_id: number, suscripciones_count: number }) => {
          acc[item.casilla_id] = parseInt(item.suscripciones_count.toString()) || 0;
          return acc;
        }, {});
        setSuscripcionesCounts(counts);
      }
    } catch (error) {
      console.error('Error al cargar conteos de suscripciones:', error);
    }
  };

  // Cargar conteos cuando cambia la lista de casillas
  React.useEffect(() => {
    if (casillas.length > 0) {
      fetchEmisoresCounts();
      fetchSuscripcionesCounts();
    }
  }, [casillas.length]);

  return (
    <div className="container mx-auto px-4 py-8">
      <DataBoxList
        dataBoxes={casillas}
        loading={isLoading}
        error={error as Error}
        onNewClick={handleNewClick}
        onEditClick={handleEditClick}
        onDeleteClick={handleDeleteClick}
        onUploadClick={handleUploadClick}
        onMaterializationsClick={handleMaterializationsClick}
        emisoresCounts={emisoresCounts}
        suscripcionesCounts={suscripcionesCounts}
      />

      <EnhancedDataBoxForm
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmit}
        dataBox={selectedDataBox}
        installations={instalaciones}
      />

      <FileUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        dataBox={selectedDataBox}
      />
    </div>
  );
}