import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Button, Card, Title, Text } from '@tremor/react';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import PortalSuscripcionesForm from '@/components/Suscripciones/PortalSuscripcionesForm';
import PortalSuscripcionesList from '@/components/Suscripciones/PortalSuscripcionesList';

interface Casilla {
  id: number;
  nombre_yaml: string;
  nombre_humano?: string;
  organizacion: string;
  producto: string;
  pais: string;
  email_casilla?: string;
}

interface Suscripcion {
  id: number;
  casilla_id: number;
  nombre: string;
  email: string;
  telefono?: string;
  frecuencia: string;
  nivel_detalle: string;
  tipos_evento: string[];
  hora_envio: string | number;
  dia_envio?: number;
  metodo_envio: string;
  emisores: number[] | any[];
  es_tecnico: boolean;
  webhook_url?: string;
  api_key?: string;
}

interface Emisor {
  id: number;
  nombre: string;
  activo: boolean;
}

export default function SuscripcionesCasillaPage() {
  const router = useRouter();
  const { id } = router.query;
  const [loading, setLoading] = useState(true);
  const [casilla, setCasilla] = useState<Casilla | null>(null);
  const [emisores, setEmisores] = useState<Emisor[]>([]);
  const [suscripciones, setSuscripciones] = useState<Suscripcion[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [suscripcionEnEdicion, setSuscripcionEnEdicion] = useState<Suscripcion | null>(null);

  useEffect(() => {
    if (id) {
      loadCasillaData();
    }
  }, [id]);

  const loadCasillaData = async () => {
    try {
      setLoading(true);
      // Obtener datos de la casilla
      const casRes = await fetch(`/api/data-boxes/${id}`);
      if (casRes.ok) {
        const casData = await casRes.json();
        setCasilla(casData);

        // Obtener emisores asociados a la casilla
        const emisoresRes = await fetch(`/api/portales/admin/emisores/${id}`);
        if (emisoresRes.ok) {
          const emisoresData = await emisoresRes.json();
          setEmisores(emisoresData);
        }

        // Obtener suscripciones de la casilla
        const susRes = await fetch(`/api/suscripciones?casilla_id=${id}`);
        if (susRes.ok) {
          const susData = await susRes.json();
          setSuscripciones(susData);
        }
      }
    } catch (error) {
      console.error('Error al cargar datos de la casilla:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBackToDataBoxes = () => {
    router.push('/admin/data-boxes');
  };

  const handleCreateSuscripcion = async (data: any) => {
    try {
      // Si estamos editando, actualizamos la suscripción existente
      if (suscripcionEnEdicion) {
        const response = await fetch(`/api/suscripciones/${suscripcionEnEdicion.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...data,
            casilla_id: Number(id),
          }),
        });

        if (!response.ok) {
          throw new Error('Error al actualizar suscripción');
        }
      } else {
        // Si no estamos editando, creamos una nueva suscripción
        const response = await fetch('/api/suscripciones', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...data,
            casilla_id: Number(id),
          }),
        });

        if (!response.ok) {
          throw new Error('Error al crear suscripción');
        }
      }

      // Recargar datos y limpiar estado de edición
      await loadCasillaData();
      setShowForm(false);
      setSuscripcionEnEdicion(null);
    } catch (error) {
      console.error('Error al procesar suscripción:', error);
      alert('Error al procesar la suscripción. Por favor, inténtalo de nuevo.');
    }
  };

  const handleEditSuscripcion = (suscripcion: Suscripcion) => {
    setSuscripcionEnEdicion(suscripcion);
    setShowForm(true);
  };

  const handleDeleteSuscripcion = async (suscripcionId: number) => {
    try {
      const response = await fetch(`/api/suscripciones/${suscripcionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Error al eliminar suscripción');
      }

      await loadCasillaData();
    } catch (error) {
      console.error('Error al eliminar suscripción:', error);
      alert('Error al eliminar la suscripción. Por favor, inténtalo de nuevo.');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!casilla) {
    return (
      <div className="p-6">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p>Casilla no encontrada. Verifique el ID e intente nuevamente.</p>
          <Button
            onClick={handleBackToDataBoxes}
            className="mt-4"
            icon={ArrowLeftIcon}
          >
            Volver a Casillas
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-2">
          <Button
            icon={ArrowLeftIcon}
            variant="secondary"
            onClick={handleBackToDataBoxes}
          >
            Regresar
          </Button>
          <Title>
            Suscripciones - {casilla.nombre_humano || casilla.nombre_yaml}
            <span className="text-sm font-normal text-gray-500 ml-2">({casilla.nombre_yaml})</span>
          </Title>
        </div>
        <Text className="text-gray-500">
          {casilla.organizacion} - {casilla.producto} ({casilla.pais})
        </Text>
        {casilla.email_casilla && (
          <Text className="text-gray-500">
            Email: {casilla.email_casilla}
          </Text>
        )}
      </div>

      {showForm ? (
        <Card className="mb-6">
          <PortalSuscripcionesForm
            emisores={emisores}
            onSubmit={handleCreateSuscripcion}
            onCancel={() => {
              setShowForm(false);
              setSuscripcionEnEdicion(null);
            }}
            permitirSuscripcionesTecnicas={true} // Permitir suscripciones técnicas en panel admin
            suscripcionParaEditar={suscripcionEnEdicion || undefined}
            esEdicion={!!suscripcionEnEdicion}
          />
        </Card>
      ) : (
        <div className="mb-6 flex justify-end">
          <Button 
            onClick={() => {
              setSuscripcionEnEdicion(null);
              setShowForm(true);
            }} 
            className="bg-blue-600 text-white"
          >
            Nueva Suscripción
          </Button>
        </div>
      )}

      <PortalSuscripcionesList
        suscripciones={suscripciones}
        emisores={emisores}
        onDelete={handleDeleteSuscripcion}
        onEdit={handleEditSuscripcion}
      />
    </div>
  );
}