
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import type { Portal, Emisor } from '@/types';

export default function PortalExterno() {
  const router = useRouter();
  const { uuid } = router.query;
  
  const [loading, setLoading] = useState(true);
  const [portalData, setPortalData] = useState<Portal | null>(null);
  const [emisores, setEmisores] = useState<Emisor[]>([]);
  const [portalNoEncontrado, setPortalNoEncontrado] = useState(false);
  const [portalInactivo, setPortalInactivo] = useState(false);

  useEffect(() => {
    if (uuid) {
      fetchPortalData();
    }
  }, [uuid]);

  const fetchPortalData = async () => {
    try {
      setLoading(true);
      
      // Obtener información del portal
      const portalRes = await fetch(`/api/portales/${uuid}/acceso`);
      
      if (!portalRes.ok) {
        if (portalRes.status === 404) {
          setPortalNoEncontrado(true);
        }
        throw new Error(`Error al obtener datos del portal: ${portalRes.statusText}`);
      }
      
      const portalData = await portalRes.json();
      setPortalData(portalData);
      
      if (!portalData.activo) {
        setPortalInactivo(true);
      }
      
      // Obtener emisores disponibles en este portal
      if (portalData.activo) {
        const emisoresRes = await fetch(`/api/portales/${uuid}/emisores`);
        if (emisoresRes.ok) {
          const emisoresData = await emisoresRes.json();
          setEmisores(emisoresData);
        }
      }
    } catch (error) {
      console.error('Error al cargar datos del portal:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Cargando...</div>;
  }

  if (portalNoEncontrado) {
    return <div>Portal no encontrado</div>;
  }

  if (portalInactivo) {
    return <div>Portal inactivo</div>;
  }

  return (
    <PortalLayout title={portalData?.nombre}>
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white rounded-lg shadow p-6">
            <h1 className="text-2xl font-semibold text-gray-900 mb-6">{portalData?.nombre || 'Portal Externo'}</h1>
            {emisores.length > 0 && (
              <div className="mt-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Emisores disponibles:</h2>
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {emisores.map(emisor => (
                    <div key={emisor.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <span className="text-gray-700">{emisor.nombre}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </PortalLayout>
  );
}
