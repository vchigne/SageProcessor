
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import type { Portal, Emisor } from '@/types';
import PortalLayout from '@/components/Portal/PortalLayout';
import {
  DocumentTextIcon,
  CloudArrowUpIcon,
  ClockIcon,
  ChartBarIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline';
import Link from 'next/link';

export default function PortalExterno() {
  const router = useRouter();
  const { uuid, section } = router.query;
  
  const [loading, setLoading] = useState(true);
  const [portalData, setPortalData] = useState<Portal | null>(null);
  const [emisores, setEmisores] = useState<Emisor[]>([]);
  const [portalNoEncontrado, setPortalNoEncontrado] = useState(false);
  const [portalInactivo, setPortalInactivo] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('upload');

  useEffect(() => {
    if (uuid) {
      fetchPortalData();
    }
  }, [uuid]);

  useEffect(() => {
    if (section && typeof section === 'string') {
      setActiveSection(section);
    }
  }, [section]);

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

  const handleSectionChange = (section: string) => {
    setActiveSection(section);
    router.push(`/portal-externo/${uuid}?section=${section}`, undefined, { shallow: true });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (portalNoEncontrado) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 px-4">
        <div className="text-red-500 text-6xl mb-4">404</div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-700 mb-4">Portal no encontrado</h1>
        <p className="text-gray-500 mb-6 text-center">
          El portal que buscas no existe o no tienes acceso a él.
        </p>
        <Link href="/" className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition">
          Volver al inicio
        </Link>
      </div>
    );
  }

  if (portalInactivo) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 px-4">
        <div className="text-yellow-500 text-6xl mb-4">⚠️</div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-700 mb-4">Portal inactivo</h1>
        <p className="text-gray-500 mb-6 text-center">
          Este portal está temporalmente desactivado. Contacta con el administrador para más información.
        </p>
        <Link href="/" className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition">
          Volver al inicio
        </Link>
      </div>
    );
  }

  return (
    <PortalLayout 
      title={portalData?.nombre || "Portal de Datos"}
      organizacion={portalData?.instalacion?.organizacion?.nombre}
      producto={portalData?.instalacion?.producto?.nombre}
      onSectionChange={handleSectionChange}
      activeSection={activeSection}
    >
      <div className="max-w-7xl mx-auto">
        <div className="bg-white shadow-sm rounded-lg p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">{portalData?.nombre}</h1>
          <div className="flex flex-wrap gap-2 mb-4">
            {portalData?.instalacion?.organizacion && (
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                {portalData.instalacion.organizacion.nombre}
              </span>
            )}
            {portalData?.instalacion?.producto && (
              <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">
                {portalData.instalacion.producto.nombre}
              </span>
            )}
            {portalData?.instalacion?.pais && (
              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                {portalData.instalacion.pais.nombre}
              </span>
            )}
          </div>
          {portalData?.descripcion && (
            <p className="text-gray-600">{portalData.descripcion}</p>
          )}
        </div>

        {/* Contenido principal basado en la sección activa */}
        {activeSection === 'emisores' && (
          <div className="bg-white shadow-sm rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Emisores Disponibles</h2>
            {emisores.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {emisores.map(emisor => (
                  <div key={emisor.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <h3 className="font-medium text-lg text-gray-800">{emisor.nombre}</h3>
                    {emisor.descripcion && (
                      <p className="text-gray-600 text-sm mt-1">{emisor.descripcion}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No hay emisores configurados para este portal.
              </div>
            )}
          </div>
        )}

        {activeSection === 'upload' && (
          <div className="bg-white shadow-sm rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Carga de Archivos</h2>
            <p className="text-gray-600 mb-6">Selecciona un emisor y sube tus archivos para procesarlos.</p>
            
            {/* Componente que se implementará completamente en el futuro */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <CloudArrowUpIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600">
                Arrastra archivos aquí o <span className="text-blue-500">selecciona archivos</span>
              </p>
            </div>
          </div>
        )}

        {activeSection === 'history' && (
          <div className="bg-white shadow-sm rounded-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-800">Historial de Cargas</h2>
              <Link 
                href={`/portal-externo/historial/${uuid}`}
                className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
              >
                Ver historial completo
                <ArrowLeftIcon className="h-4 w-4 ml-1 transform rotate-180" />
              </Link>
            </div>
            
            <div className="text-center py-8 text-gray-500">
              <ClockIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p>No hay cargas recientes. El historial completo está disponible en la sección de historial.</p>
            </div>
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
