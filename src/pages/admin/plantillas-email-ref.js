import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { toast } from 'react-toastify';
import {
  PlusIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  ClockIcon,
  InboxIcon,
  PaperAirplaneIcon,
  Cog6ToothIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { Card, Text, Title, Button, Badge, Tab, TabGroup, TabList, TabPanel, TabPanels } from '@tremor/react';

// Tipos
interface EmailConfiguracion {
  id: number;
  nombre: string;
  direccion: string;
  proposito: string;
  servidor_entrada?: string;
  puerto_entrada?: number;
  protocolo_entrada?: string;
  usar_ssl_entrada?: boolean;
  servidor_salida?: string;
  puerto_salida?: number;
  usar_tls_salida?: boolean;
  usuario: string;
  casilla_id?: number;
  casilla_nombre?: string;
  estado: string;
  ultimo_chequeo?: string;
  mensaje_error?: string;
  fecha_creacion: string;
  fecha_modificacion: string;
}

interface EmailStats {
  por_estado: {
    pendiente?: number;
    activo?: number;
    error?: number;
  };
  por_proposito: {
    recepcion?: number;
    envio?: number;
    admin?: number;
    multiple?: number;
  };
  casillas_sin_configuracion: number;
  total: number;
}

// Propósito para texto amigable
const PROPOSITOS = {
  recepcion: 'Recepción',
  envio: 'Envío',
  admin: 'Administración',
  multiple: 'Múltiple'
};

// Estados para estilo
const ESTADO_BADGE = {
  pendiente: { color: 'yellow', text: 'Pendiente', icon: ClockIcon },
  activo: { color: 'green', text: 'Activo', icon: CheckCircleIcon },
  error: { color: 'red', text: 'Error', icon: ExclamationTriangleIcon }
};

export default function ConfiguracionesEmail() {
  const [configuraciones, setConfiguraciones] = useState<EmailConfiguracion[]>([]);
  const [estadisticas, setEstadisticas] = useState<EmailStats | null>(null);
  const [casillasInconf, setCasillasInconf] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState('0');
  const [selectedConfigId, setSelectedConfigId] = useState<number | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  // Cargar configuraciones
  const cargarConfiguraciones = async () => {
    try {
      setIsLoading(true);
      
      // Cargar estadísticas
      const statsResponse = await fetch('/api/email/configuraciones/stats');
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setEstadisticas(statsData);
      }
      
      // Cargar configuraciones
      const configResponse = await fetch('/api/email/configuraciones');
      if (configResponse.ok) {
        const configData = await configResponse.json();
        setConfiguraciones(configData);
      }
      
      // Cargar casillas sin configuración
      // Nota: Este endpoint es hipotético y debería implementarse
      const casillasResponse = await fetch('/api/email/casillas/sin-configurar');
      if (casillasResponse.ok) {
        const casillasData = await casillasResponse.json();
        setCasillasInconf(casillasData);
      } else {
        // Fallback si el endpoint no está disponible
        setCasillasInconf([]);
      }
      
    } catch (error) {
      console.error('Error al cargar datos:', error);
      toast.error('Error al cargar datos de configuraciones');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Verificar una configuración
  const verificarConfiguracion = async (id: number) => {
    try {
      setIsVerifying(true);
      setSelectedConfigId(id);
      
      const response = await fetch(`/api/email/configuraciones/${id}/verificar`, {
        method: 'POST'
      });
      
      const data = await response.json();
      
      if (response.ok) {
        toast.success('Configuración verificada correctamente');
        // Actualizar la configuración en el estado
        setConfiguraciones(prevState => 
          prevState.map(config => 
            config.id === id ? { ...config, estado: 'activo', mensaje_error: null } : config
          )
        );
      } else {
        toast.error(`Error: ${data.mensaje || 'No se pudo verificar la configuración'}`);
        // Actualizar la configuración en el estado
        setConfiguraciones(prevState => 
          prevState.map(config => 
            config.id === id ? { ...config, estado: 'error', mensaje_error: data.mensaje } : config
          )
        );
      }
      
    } catch (error) {
      console.error('Error al verificar configuración:', error);
      toast.error('Error de conexión al verificar configuración');
    } finally {
      setIsVerifying(false);
      setSelectedConfigId(null);
      // Recargar estadísticas
      const statsResponse = await fetch('/api/email/configuraciones/stats');
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setEstadisticas(statsData);
      }
    }
  };
  
  // Eliminar una configuración
  const eliminarConfiguracion = async (id: number) => {
    if (!confirm('¿Está seguro de eliminar esta configuración? Esta acción no se puede deshacer.')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/email/configuraciones/${id}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        toast.success('Configuración eliminada correctamente');
        cargarConfiguraciones(); // Recargar todo
      } else {
        const data = await response.json();
        toast.error(`Error: ${data.error || 'No se pudo eliminar la configuración'}`);
      }
    } catch (error) {
      console.error('Error al eliminar configuración:', error);
      toast.error('Error de conexión al eliminar configuración');
    }
  };

  // Cargar datos al montar
  useEffect(() => {
    cargarConfiguraciones();
  }, []);

  // Filtrar configuraciones según la pestaña seleccionada
  const filtrarConfiguraciones = () => {
    switch (selectedTab) {
      case '0': // Todas
        return configuraciones;
      case '1': // Pendientes
        return configuraciones.filter(config => config.estado === 'pendiente');
      case '2': // Con error
        return configuraciones.filter(config => config.estado === 'error');
      case '3': // Activas
        return configuraciones.filter(config => config.estado === 'activo');
      default:
        return configuraciones;
    }
  };

  // Renderizar icono de propósito
  const renderPropositoIcon = (proposito: string) => {
    switch (proposito) {
      case 'recepcion':
        return <InboxIcon className="h-5 w-5" />;
      case 'envio':
        return <PaperAirplaneIcon className="h-5 w-5" />;
      case 'admin':
        return <Cog6ToothIcon className="h-5 w-5" />;
      case 'multiple':
        return (
          <div className="flex">
            <InboxIcon className="h-4 w-4" />
            <PaperAirplaneIcon className="h-4 w-4 ml-1" />
          </div>
        );
      default:
        return <Cog6ToothIcon className="h-5 w-5" />;
    }
  };

  return (
    <>
      <Head>
        <title>Configuraciones de Email | SAGE</title>
      </Head>

      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Configuraciones de Email
            </h1>
            <p className="text-gray-600 mt-1">
              Administre las configuraciones de correo electrónico utilizadas por el sistema
            </p>
          </div>
          <Link href="/admin/configuraciones-email/nueva">
            <Button icon={PlusIcon}>
              Nueva configuración
            </Button>
          </Link>
        </div>

        {/* Tarjetas de estadísticas */}
        {estadisticas && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card decoration="top" decorationColor="blue">
              <Text>Total de configuraciones</Text>
              <Title>{estadisticas.total}</Title>
            </Card>
            
            <Card decoration="top" decorationColor="green">
              <Text>Configuraciones activas</Text>
              <Title>{estadisticas.por_estado.activo || 0}</Title>
            </Card>
            
            <Card decoration="top" decorationColor="amber">
              <Text>Pendientes de verificación</Text>
              <Title>{estadisticas.por_estado.pendiente || 0}</Title>
            </Card>
            
            <Card decoration="top" decorationColor="red">
              <Text>Configuraciones con error</Text>
              <Title>{estadisticas.por_estado.error || 0}</Title>
            </Card>
          </div>
        )}
        
        <TabGroup index={parseInt(selectedTab)} onIndexChange={index => setSelectedTab(index.toString())}>
          <TabList variant="solid" className="mb-4">
            <Tab>Todas</Tab>
            <Tab>Pendientes</Tab>
            <Tab>Con errores</Tab>
            <Tab>Activas</Tab>
          </TabList>
          
          <TabPanels>
            {/* Las tablas tienen el mismo formato, pero los datos se filtran según la pestaña */}
            {[0, 1, 2, 3].map(tabIndex => (
              <TabPanel key={tabIndex}>
                <Card>
                  {isLoading ? (
                    <div className="flex justify-center items-center h-40">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    </div>
                  ) : filtrarConfiguraciones().length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-500">
                        No hay configuraciones para mostrar
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Configuración
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Propósito
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Casilla
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Estado
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Último Chequeo
                            </th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Acciones
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {filtrarConfiguraciones().map((config) => {
                            const estadoInfo = ESTADO_BADGE[config.estado as keyof typeof ESTADO_BADGE];
                            const EstadoIcono = estadoInfo.icon;
                            
                            return (
                              <tr key={config.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex items-center">
                                    <div>
                                      <div className="text-sm font-medium text-gray-900">
                                        {config.nombre}
                                      </div>
                                      <div className="text-sm text-gray-500">
                                        {config.direccion}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex items-center">
                                    <span className="text-gray-500 mr-2">
                                      {renderPropositoIcon(config.proposito)}
                                    </span>
                                    <span className="text-sm text-gray-900">
                                      {PROPOSITOS[config.proposito as keyof typeof PROPOSITOS] || config.proposito}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm text-gray-900">
                                    {config.casilla_nombre || 'N/A'}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <Badge 
                                    icon={EstadoIcono}
                                    color={estadoInfo.color as any}
                                  >
                                    {estadoInfo.text}
                                  </Badge>
                                  {config.mensaje_error && (
                                    <div className="text-xs text-red-500 mt-1">
                                      {config.mensaje_error.substring(0, 50)}
                                      {config.mensaje_error.length > 50 ? '...' : ''}
                                    </div>
                                  )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {config.ultimo_chequeo 
                                    ? new Date(config.ultimo_chequeo).toLocaleString()
                                    : 'Nunca'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                  <div className="flex justify-end items-center space-x-2">
                                    <button
                                      onClick={() => verificarConfiguracion(config.id)}
                                      disabled={isVerifying && selectedConfigId === config.id}
                                      className="text-blue-600 hover:text-blue-900 p-1"
                                    >
                                      {isVerifying && selectedConfigId === config.id ? (
                                        <ArrowPathIcon className="h-5 w-5 animate-spin" />
                                      ) : (
                                        <ArrowPathIcon className="h-5 w-5" />
                                      )}
                                    </button>
                                    
                                    <Link href={`/admin/configuraciones-email/${config.id}`} className="text-indigo-600 hover:text-indigo-900 p-1">
                                      <Cog6ToothIcon className="h-5 w-5" />
                                    </Link>
                                    
                                    <button
                                      onClick={() => eliminarConfiguracion(config.id)}
                                      className="text-red-600 hover:text-red-900 p-1"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              </TabPanel>
            ))}
          </TabPanels>
        </TabGroup>
        
        {/* Sección de casillas sin configurar */}
        {casillasInconf.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xl font-semibold mb-4 text-gray-900">
              Casillas sin configuración de Email
            </h2>
            
            <Card>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Nombre
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      YAML
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {casillasInconf.map((casilla) => (
                    <tr key={casilla.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {casilla.nombre}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {casilla.nombre_yaml}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Link 
                          href={`/admin/configuraciones-email/nueva?casilla_id=${casilla.id}`} 
                          className="inline-flex items-center text-indigo-600 hover:text-indigo-900"
                        >
                          Configurar
                          <ChevronRightIcon className="ml-1 h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}