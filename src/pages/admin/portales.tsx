import { useState, useEffect } from 'react';
import { PortalesGrid } from '@/components/Portales/PortalesGrid';
import { NewPortalModal } from '@/components/Portales/NewPortalModal';

interface Portal {
  id: number;
  uuid: string;
  nombre: string;
  instalacion: {
    id: number;
    nombre: string;
    organizacion: {
      nombre: string;
    };
    producto: {
      nombre: string;
    };
  };
  creado_en: string;
  activo: boolean;
  ultimo_acceso?: string;
}

export default function PortalesPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [portales, setPortales] = useState<Portal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPortales();
  }, []);

  const fetchPortales = async () => {
    try {
      const response = await fetch('/api/portales');
      if (!response.ok) {
        throw new Error('Error fetching portales');
      }
      const data = await response.json();
      setPortales(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePortal = async (data: any) => {
    try {
      const response = await fetch('/api/portales', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Error creating portal');
      }

      await fetchPortales();
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error:', error);
      throw error;
    }
  };

  if (loading) {
    return <div>Cargando...</div>;
  }

  return (
    <div>
      <PortalesGrid 
        portales={portales}
        onNewClick={() => setIsModalOpen(true)}
      />

      <NewPortalModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreatePortal}
      />
    </div>
  );
}