import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  Card,
  Title,
  Text,
  Button,
  ProgressCircle,
  Badge,
  Tab,
  TabList,
  TabGroup,
  Grid,
  Col,
  Divider,
  Flex
} from "@tremor/react";
import { 
  ArrowLeftIcon,
  BellAlertIcon,
  EnvelopeIcon,
  ExclamationCircleIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import PortalLayout from '@/components/Portal/PortalLayout';
import PortalSuscripcionesList from '@/components/Suscripciones/PortalSuscripcionesList';
import PortalSuscripcionesForm from '@/components/Suscripciones/PortalSuscripcionesForm';

interface Emisor {
  id: number;
  nombre: string;
}

interface Portal {
  id: number;
  uuid: string;
  nombre: string;
  activo: boolean;
}

interface NombreHumanoCasilla {
  nombre: string;
  nombreArchivo: string | null;
}

export default function PortalSuscripciones() {
  const router = useRouter();
  const { uuid, casillaId } = router.query;
  
  const [loading, setLoading] = useState(true);
  const [portalData, setPortalData] = useState<Portal | null>(null);
  const [emisores, setEmisores] = useState<Emisor[]>([]);
  const [activeTab, setActiveTab] = useState<'list' | 'form'>('list');
  const [portalNoEncontrado, setPortalNoEncontrado] = useState(false);
  const [portalInactivo, setPortalInactivo] = useState(false);
  const [selectedCasilla, setSelectedCasilla] = useState<number | null>(null);
  const [suscripcionParaEditar, setSuscripcionParaEditar] = useState<Suscripcion | null>(null);
  const [nombreHumanoCasilla, setNombreHumanoCasilla] = useState<NombreHumanoCasilla | null>(null);
  
  // Actualizar el ID de la casilla cuando cambia en la URL
  useEffect(() => {
    if (casillaId && typeof casillaId === 'string') {
      const parsedId = parseInt(casillaId);
      console.log('CasillaId actualizado desde URL:', parsedId);
      setSelectedCasilla(parsedId);
      
      // Obtener el nombre humano de la casilla
      fetchNombreHumanoCasilla(parsedId);
    }
  }, [casillaId]);
  
  // Función para obtener el nombre humano de la casilla
  const fetchNombreHumanoCasilla = async (casillaId: number) => {
    try {
      const response = await fetch(`/api/casillas/${casillaId}/nombre-humano`);
      if (response.ok) {
        const data = await response.json();
        setNombreHumanoCasilla(data);
      } else {
        console.error('Error al obtener nombre humano de casilla:', response.statusText);
        setNombreHumanoCasilla(null);
      }
    } catch (error) {
      console.error('Error al obtener nombre humano de casilla:', error);
      setNombreHumanoCasilla(null);
    }
  };
  
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
  
  const handleBackToPortal = () => {
    router.push(`/portal-externo/${uuid}`);
  };
  
  const renderContent = () => {
    // Portal no encontrado
    if (portalNoEncontrado) {
      return (
        <div className="flex flex-col items-center justify-center h-[80vh]">
          <div className="bg-red-50 border border-red-300 rounded-lg p-8 text-center max-w-lg">
            <h2 className="text-2xl font-bold text-red-700 mb-4">Portal no encontrado</h2>
            <p className="text-red-600 mb-4">
              El portal que estás intentando acceder no existe o ha sido eliminado.
            </p>
            <p className="text-gray-600 text-sm">
              Por favor, verifica la URL e intenta nuevamente o contacta al administrador.
            </p>
          </div>
        </div>
      );
    }
    
    // Portal inactivo
    if (portalInactivo) {
      return (
        <div className="flex flex-col items-center justify-center h-[80vh]">
          <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-8 text-center max-w-lg">
            <h2 className="text-2xl font-bold text-yellow-700 mb-4">Portal temporalmente inactivo</h2>
            <p className="text-yellow-600 mb-4">
              Este portal ha sido desactivado temporalmente por el administrador.
            </p>
            <p className="text-gray-600 text-sm">
              Por favor, contacta al administrador para obtener más información.
            </p>
          </div>
        </div>
      );
    }
    
    return (
      <div className="space-y-6">
        <div className="flex items-center">
          <Button 
            icon={ArrowLeftIcon} 
            variant="light" 
            onClick={handleBackToPortal}
            className="mr-4"
          >
            Volver al Portal
          </Button>
          <div>
            {nombreHumanoCasilla ? (
              <Title>
                Suscripciones - {nombreHumanoCasilla.nombre}
                {nombreHumanoCasilla.nombreArchivo && (
                  <span className="text-xs text-gray-500 ml-1">
                    ({nombreHumanoCasilla.nombreArchivo})
                  </span>
                )}
              </Title>
            ) : (
              <Title>Suscripciones</Title>
            )}
          </div>
        </div>
        
        <Card>
          <div className="mb-4">
            <TabGroup defaultIndex={0} onIndexChange={(index) => setActiveTab(index === 0 ? 'list' : 'form')}>
              <TabList>
                <Tab icon={EnvelopeIcon}>Mis Suscripciones</Tab>
                <Tab icon={BellAlertIcon}>Nueva Suscripción</Tab>
              </TabList>
            </TabGroup>
          </div>
          
          <Divider />
          
          {activeTab === 'list' ? (
            <PortalSuscripcionesList 
              portalUuid={uuid as string} 
              portalId={portalData?.id}
              casillaId={selectedCasilla}
              esPortalExterno={true}
              onCreateNew={() => setActiveTab('form')}
              onEdit={(suscripcion) => {
                setSuscripcionParaEditar(suscripcion);
                setActiveTab('form');
              }}
            />
          ) : (
            <PortalSuscripcionesForm 
              portalUuid={uuid as string} 
              portalId={portalData?.id}
              casillaId={selectedCasilla}
              emisores={emisores}
              suscripcionParaEditar={suscripcionParaEditar}
              esEdicion={!!suscripcionParaEditar}
              onCancel={() => {
                setSuscripcionParaEditar(null);
                setActiveTab('list');
              }}
              onSuccess={() => {
                setSuscripcionParaEditar(null);
                setActiveTab('list');
              }}
            />
          )}
        </Card>
        
        <Card className="bg-blue-50">
          <Flex>
            <div className="flex items-start">
              <InformationCircleIcon className="h-5 w-5 text-blue-500 mr-2 flex-shrink-0 mt-0.5" />
              <div>
                <Text className="font-medium">Acerca de las suscripciones</Text>
                <Text className="text-sm text-gray-600">
                  Reciba notificaciones sobre los eventos importantes en este portal. 
                  Puede configurar la frecuencia y los tipos de eventos sobre los que desea recibir información.
                </Text>
              </div>
            </div>
          </Flex>
        </Card>
        
        <Card className="bg-amber-50">
          <Flex>
            <div className="flex items-start">
              <ExclamationCircleIcon className="h-5 w-5 text-amber-500 mr-2 flex-shrink-0 mt-0.5" />
              <div>
                <Text className="font-medium">Aviso de privacidad</Text>
                <Text className="text-sm text-gray-600">
                  Al configurar una suscripción, acepta recibir comunicaciones electrónicas relacionadas con este portal.
                  Puede darse de baja en cualquier momento eliminando sus suscripciones.
                </Text>
              </div>
            </div>
          </Flex>
        </Card>
      </div>
    );
  };
  
  return (
    <PortalLayout title={nombreHumanoCasilla ? `Suscripciones - ${nombreHumanoCasilla.nombre}` : (portalData?.nombre ? `Suscripciones - ${portalData.nombre}` : "Suscripciones")}>
      {loading ? (
        <div className="flex justify-center items-center min-h-screen">
          <ProgressCircle className="h-12 w-12" />
        </div>
      ) : (
        <div className="container mx-auto px-2 sm:px-4 py-6 max-w-6xl">
          {renderContent()}
        </div>
      )}
    </PortalLayout>
  );
}