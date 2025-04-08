import { useState, useEffect } from 'react'
import { 
  Title, 
  Card,
  Text,
  Button,
  Grid,
} from "@tremor/react"
import { 
  BuildingOfficeIcon,
  PlusIcon,
} from '@heroicons/react/24/outline'
import { NewOrganizacionModal } from '@/components/Settings/NewOrganizacionModal'
import { EditOrganizacionModal } from '@/components/Settings/EditOrganizacionModal'
// Quitamos el Layout para usar el principal

export default function OrganizacionesMaestro() {
  const [organizaciones, setOrganizaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedOrganizacion, setSelectedOrganizacion] = useState(null);

  useEffect(() => {
    fetchOrganizaciones();
  }, []);

  const fetchOrganizaciones = async () => {
    try {
      const response = await fetch('/api/organizaciones');
      if (response.ok) {
        const data = await response.json();
        setOrganizaciones(data);
      }
    } catch (error) {
      console.error('Error fetching organizaciones:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (data) => {
    try {
      const response = await fetch('/api/organizaciones', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Error al crear la organización');
      }

      fetchOrganizaciones();
    } catch (error) {
      throw error;
    }
  };

  const handleEdit = async (data) => {
    try {
      const response = await fetch(`/api/organizaciones/${data.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Error al actualizar la organización');
      }

      fetchOrganizaciones();
    } catch (error) {
      throw error;
    }
  };

  if (loading) return <div>Cargando...</div>;

  return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <Title className="flex items-center">
            <BuildingOfficeIcon className="h-6 w-6 mr-2" />
            Organizaciones
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
            <span>Nueva Organización</span>
          </button>
        </div>

        <Grid numItems={1} numItemsMd={2} numItemsLg={3} className="gap-6">
          {organizaciones.map((org) => (
            <Card key={org.id} className="space-y-4 dark:bg-dark-card">
              <div className="flex justify-between items-start">
                <div>
                  <Text className="font-medium">{org.nombre}</Text>
                  <Text className="text-sm text-gray-500 dark:text-gray-400">
                    Creado: {new Date(org.creado_en).toLocaleDateString()}
                  </Text>
                </div>
                <button
                  onClick={() => {
                    setSelectedOrganizacion(org);
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

        <NewOrganizacionModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleSubmit}
        />

        {selectedOrganizacion && (
          <EditOrganizacionModal
            isOpen={isEditModalOpen}
            onClose={() => {
              setIsEditModalOpen(false);
              setSelectedOrganizacion(null);
            }}
            onSubmit={handleEdit}
            organizacion={selectedOrganizacion}
          />
        )}
      </div>
  );
}