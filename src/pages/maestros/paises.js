import { useState, useEffect } from 'react'
import { 
  Title, 
  Card,
  Text,
  Button,
} from "@tremor/react"
import { 
  GlobeAmericasIcon,
  PlusIcon,
} from '@heroicons/react/24/outline'
import { NewPaisModal } from '@/components/Settings/NewPaisModal'
import { EditPaisModal } from '@/components/Settings/EditPaisModal'
// Quitamos el Layout para usar el principal

export default function PaisesMaestro() {
  const [paises, setPaises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedPais, setSelectedPais] = useState(null);

  useEffect(() => {
    fetchPaises();
  }, []);

  const fetchPaises = async () => {
    try {
      const response = await fetch('/api/paises');
      if (response.ok) {
        const data = await response.json();
        setPaises(data);
      }
    } catch (error) {
      console.error('Error fetching paises:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (data) => {
    try {
      const response = await fetch('/api/paises', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Error al crear el país');
      }

      fetchPaises();
    } catch (error) {
      throw error;
    }
  };

  const handleEdit = async (data) => {
    try {
      const response = await fetch(`/api/paises/${data.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Error al actualizar el país');
      }

      fetchPaises();
    } catch (error) {
      throw error;
    }
  };

  if (loading) return <div>Cargando...</div>;

  return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <Title className="flex items-center">
            <GlobeAmericasIcon className="h-6 w-6 mr-2" />
            Países
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
            <span>Nuevo País</span>
          </button>
        </div>

        <Card className="dark:bg-dark-card">
          <div className="space-y-4">
            {paises.map((pais) => (
              <div key={pais.id} className="flex justify-between items-center p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg">
                <div>
                  <Text>{pais.nombre}</Text>
                  <Text className="text-sm text-gray-500 dark:text-gray-400">Código ISO: {pais.codigo_iso}</Text>
                </div>
                <button
                  onClick={() => {
                    setSelectedPais(pais);
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
            ))}
          </div>
        </Card>

        <NewPaisModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleSubmit}
        />

        {selectedPais && (
          <EditPaisModal
            isOpen={isEditModalOpen}
            onClose={() => {
              setIsEditModalOpen(false);
              setSelectedPais(null);
            }}
            onSubmit={handleEdit}
            pais={selectedPais}
          />
        )}
      </div>
  );
}