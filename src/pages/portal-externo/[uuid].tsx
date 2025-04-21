
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
    <div>
      <h1>Portal Externo</h1>
      {portalData && (
        <div>
          <h2>{portalData.nombre}</h2>
          <div>
            {emisores.map(emisor => (
              <div key={emisor.id}>
                {emisor.nombre}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
