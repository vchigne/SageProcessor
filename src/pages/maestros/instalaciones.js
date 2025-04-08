import { useState, useEffect } from 'react'
import { 
  Title, 
  Card,
  Text,
  Button,
  Grid,
} from "@tremor/react"
import { 
  BuildingStorefrontIcon,
  PlusIcon,
} from '@heroicons/react/24/outline'
import { NewInstalacionModal } from '@/components/Settings/NewInstalacionModal'
import { EditInstalacionModal } from '@/components/Settings/EditInstalacionModal'
// Quitamos el Layout para usar el principal

export default function InstalacionesMaestro() {
  const [instalaciones, setInstalaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedInstalacion, setSelectedInstalacion] = useState(null);

  useEffect(() => {
    fetchInstalaciones();
  }, []);

  const fetchInstalaciones = async () => {
    try {
      const response = await fetch('/api/instalaciones');
      if (response.ok) {
        const data = await response.json();
        setInstalaciones(data);
      }
    } catch (error) {
      console.error('Error fetching instalaciones:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (data) => {
    try {
      const response = await fetch('/api/instalaciones', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Error al crear la instalación');
      }

      fetchInstalaciones();
    } catch (error) {
      throw error;
    }
  };

  const handleEdit = async (data) => {
    try {
      const response = await fetch(`/api/instalaciones/${data.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Error al actualizar la instalación');
      }

      fetchInstalaciones();
    } catch (error) {
      throw error;
    }
  };

  if (loading) return <div>Cargando...</div>;

  return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <Title className="flex items-center">
            <BuildingStorefrontIcon className="h-6 w-6 mr-2" />
            Instalaciones
          </Title>
          <button 
            onClick={() => setIsModalOpen(true)}
            style={{
              backgroundColor: '#2563eb',
              color: 'white',
              borderRadius: '9999px',
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              fontWeight: '500',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem'
            }}
            className="hover:bg-blue-700"
          >
            <PlusIcon className="h-4 w-4" />
            <span>Nueva Instalación</span>
          </button>
        </div>

        <Grid numItems={1} numItemsMd={2} numItemsLg={3} className="gap-6">
          {instalaciones.map((inst) => (
            <Card key={inst.id} className="space-y-4 dark:bg-dark-card">
              <div className="flex justify-between items-start">
                <div>
                  <Text className="font-medium">{inst.producto}</Text>
                  <Text className="text-sm text-gray-500 dark:text-gray-400">{inst.organizacion}</Text>
                  <Text className="text-sm text-gray-500 dark:text-gray-400">{inst.pais}</Text>
                </div>
                <button
                  onClick={() => {
                    setSelectedInstalacion(inst);
                    setIsEditModalOpen(true);
                  }}
                  style={{
                    backgroundColor: '#ef4444',
                    color: 'white',
                    borderRadius: '9999px',
                    padding: '0.25rem 0.75rem',
                    fontSize: '0.75rem',
                    fontWeight: '500',
                    border: 'none'
                  }}
                  className="hover:bg-red-600"
                >
                  Editar
                </button>
              </div>
            </Card>
          ))}
        </Grid>

        <NewInstalacionModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleSubmit}
        />

        {selectedInstalacion && (
          <EditInstalacionModal
            isOpen={isEditModalOpen}
            onClose={() => {
              setIsEditModalOpen(false);
              setSelectedInstalacion(null);
            }}
            onSubmit={handleEdit}
            instalacion={selectedInstalacion}
          />
        )}
      </div>
  );
}