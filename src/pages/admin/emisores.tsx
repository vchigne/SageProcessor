import { useState, useEffect } from 'react';
import { EmisoresGrid } from '@/components/DataBoxes/EmisoresGrid';
import { NewEmisorModal } from '@/components/DataBoxes/NewEmisorModal';

interface Emisor {
  id: number;
  nombre: string;
  tipo_emisor: string;
  email_corporativo: string;
  telefono: string;
  organizacion_id: number;
  creado_en: string;
  activo: boolean;
  codigo_interno?: string;
  codigo_agente_merlin?: string;
  tipo_origen?: 'sftp' | 'bucket' | null;
  sftp_servidor?: string;
  sftp_puerto?: number;
  sftp_usuario?: string;
  sftp_clave?: string;
  sftp_directorio?: string;
  cloud_secret_id?: number;
  bucket_nombre?: string;
}

export default function EmisoresPage() {
  const [emisores, setEmisores] = useState<Emisor[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchEmisores();
  }, []);

  const fetchEmisores = async () => {
    try {
      const response = await fetch('/api/emisores');
      if (!response.ok) {
        throw new Error('Error fetching emisores');
      }
      const data = await response.json();
      setEmisores(data);
    } catch (error) {
      console.error('Error fetching emisores:', error);
    }
  };

  const handleCreateOrUpdateEmisor = async (data: any) => {
    try {
      const response = await fetch('/api/emisores', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Error creating emisor');
      }

      await fetchEmisores();
    } catch (error) {
      console.error('Error creating emisor:', error);
      throw error;
    }
  };

  const handleEditEmisor = async (data: any) => {
    try {
      const response = await fetch('/api/emisores', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Error updating emisor');
      }

      await fetchEmisores();
    } catch (error) {
      console.error('Error updating emisor:', error);
      throw error;
    }
  };

  const handleDeleteEmisor = async (emisor: Emisor) => {
    try {
      const response = await fetch(`/api/emisores?id=${emisor.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Error deleting emisor');
      }

      await fetchEmisores();
    } catch (error) {
      console.error('Error deleting emisor:', error);
    }
  };

  return (
    <div>
      <EmisoresGrid 
        emisores={emisores}
        onNewClick={() => setIsModalOpen(true)}
        onEditClick={handleEditEmisor}
        onDeleteClick={handleDeleteEmisor}
      />
      <NewEmisorModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateOrUpdateEmisor}
      />
    </div>
  );
}