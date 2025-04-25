import { useState, useEffect } from 'react';
import {
  Card,
  Title,
  Text,
  Grid,
  Metric,
  Flex,
  Badge,
  // DateRangePicker, // Comentado para evitar errores de ESM
  List,
  ListItem,
  Select,
  SelectItem,
  Tab,
  TabGroup,
  TabList,
  TabPanel,
  TabPanels,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  BarChart,
  LineChart,
  Color,
  Legend,
  Subtitle,
  ProgressBar
} from "@tremor/react";

import { Dialog } from '@headlessui/react';

import { 
  DocumentCheckIcon, 
  ExclamationTriangleIcon,
  ClockIcon,
  ArrowUpTrayIcon,
  ChartBarIcon,
  ServerIcon,
  CubeTransparentIcon,
  UserGroupIcon,
  DocumentIcon,
  DocumentMagnifyingGlassIcon,
  ChevronRightIcon,
  ClipboardDocumentCheckIcon
} from "@heroicons/react/24/outline";

// Función para formatear fechas
const formatDate = (dateString) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Función para determinar el color según el estado
const getStatusColor = (status) => {
  if (!status) return 'gray';
  
  switch (status.toLowerCase()) {
    case 'éxito':
      return 'emerald';
    case 'error':
    case 'fallido':
      return 'red';
    case 'pendiente':
      return 'amber';
    default:
      return 'blue';
  }
};

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().setDate(new Date().getDate() - 30)),
    to: new Date()
  });

  // Estados para filtros
  const [organizaciones, setOrganizaciones] = useState([]);
  const [paises, setPaises] = useState([]);
  const [productos, setProductos] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState('todas');
  const [selectedPais, setSelectedPais] = useState('todos');
  const [selectedProducto, setSelectedProducto] = useState('todos');

  // Estados para datos del dashboard
  const [stats, setStats] = useState({
    archivos_procesados: 0,
    tasa_exito: 0,
    archivos_pendientes: 0,
    casillas_por_vencer: 0
  });
  
  const [ultimasEjecuciones, setUltimasEjecuciones] = useState([]);
  const [tendencia, setTendencia] = useState([]);
  const [estadisticasEntidades, setEstadisticasEntidades] = useState({
    casillas: [],
    emisores: []
  });

  const [selectedMetric, setSelectedMetric] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsData, setDetailsData] = useState([]);
  const [selectedInterval, setSelectedInterval] = useState('day');
  const [instalacionesCasillas, setInstalacionesCasillas] = useState([]);

  useEffect(() => {
    fetchFiltersData();
    fetchAllDashboardData();
  }, [dateRange, selectedOrg, selectedPais, selectedProducto]);
  
  // Efecto para actualizar tendencia cuando cambia el intervalo
  useEffect(() => {
    fetchTendenciaData();
  }, [selectedInterval, dateRange]);

  const fetchFiltersData = async () => {
    try {
      const [orgRes, paisRes, prodRes] = await Promise.all([
        fetch('/api/organizaciones'),
        fetch('/api/paises'),
        fetch('/api/productos')
      ]);

      const [orgData, paisData, prodData] = await Promise.all([
        orgRes.json(),
        paisRes.json(),
        prodRes.json()
      ]);

      // Asegurarse de que orgData es un array
      setOrganizaciones(Array.isArray(orgData) ? orgData : []);
      setPaises(Array.isArray(paisData) ? paisData : []);
      setProductos(Array.isArray(prodData) ? prodData : []);
    } catch (error) {
      console.error('Error fetching filters data:', error);
    }
  };

  const fetchAllDashboardData = async () => {
    setLoading(true);
    
    try {
      await Promise.all([
        fetchStatsData(),
        fetchUltimasEjecuciones(),
        fetchTendenciaData(),
        fetchEstadisticasEntidades(),
        fetchInstalacionesCasillas()
      ]);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchInstalacionesCasillas = async () => {
    try {
      const params = new URLSearchParams({
        from: dateRange.from.toISOString(),
        to: dateRange.to.toISOString(),
        limite: 10
      });

      const response = await fetch(`/api/dashboard/instalaciones-casillas?${params}`);
      const data = await response.json();
      if (data && data.instalaciones) {
        setInstalacionesCasillas(data.instalaciones);
      }
    } catch (error) {
      console.error('Error fetching installation statistics:', error);
    }
  };

  const fetchStatsData = async () => {
    try {
      const params = new URLSearchParams({
        from: dateRange.from.toISOString(),
        to: dateRange.to.toISOString(),
        organizacion: selectedOrg,
        pais: selectedPais,
        producto: selectedProducto
      });

      const response = await fetch(`/api/dashboard/stats?${params}`);
      const data = await response.json();
      if (data && data.stats) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchUltimasEjecuciones = async () => {
    try {
      const response = await fetch('/api/dashboard/ultimas-ejecuciones?limit=5');
      const data = await response.json();
      if (data && data.ejecuciones) {
        setUltimasEjecuciones(data.ejecuciones);
      }
    } catch (error) {
      console.error('Error fetching last executions:', error);
    }
  };

  const fetchTendenciaData = async () => {
    try {
      const params = new URLSearchParams({
        from: dateRange.from.toISOString(),
        to: dateRange.to.toISOString(),
        intervalType: selectedInterval
      });

      const response = await fetch(`/api/dashboard/tendencia?${params}`);
      const data = await response.json();
      if (data && data.tendencia) {
        setTendencia(data.tendencia);
      }
    } catch (error) {
      console.error('Error fetching trend data:', error);
    }
  };

  const fetchEstadisticasEntidades = async () => {
    try {
      const params = new URLSearchParams({
        from: dateRange.from.toISOString(),
        to: dateRange.to.toISOString(),
        limite: 5
      });

      const response = await fetch(`/api/dashboard/estadisticas-entidades?${params}`);
      const data = await response.json();
      if (data) {
        setEstadisticasEntidades({
          casillas: data.casillas || [],
          emisores: data.emisores || []
        });
      }
    } catch (error) {
      console.error('Error fetching entity statistics:', error);
    }
  };

  const handleMetricClick = async (metric) => {
    try {
      setSelectedMetric(metric);
      const params = new URLSearchParams({
        from: dateRange.from.toISOString(),
        to: dateRange.to.toISOString(),
        metric,
        organizacion: selectedOrg,
        pais: selectedPais,
        producto: selectedProducto
      });

      const response = await fetch(`/api/dashboard/details?${params}`);
      const data = await response.json();
      setDetailsData(data.details || []);
      setDetailsOpen(true);
    } catch (error) {
      console.error('Error fetching metric details:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Datos para los gráficos
  const tendenciaData = tendencia.map(item => ({
    periodo: item.periodo,
    Éxito: parseInt(item.exito),
    Error: parseInt(item.error),
    Pendiente: parseInt(item.pendiente),
    Total: parseInt(item.total)
  }));

  return (
    <main className="p-4 sm:p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <Flex>
            <div>
              <Title>Dashboard SAGE</Title>
              <Text>Panel de control y monitoreo del sistema</Text>
            </div>
            <div className="flex items-center">
              <CubeTransparentIcon className="h-6 w-6 text-indigo-500 mr-2" />
              <Text>
                <span className="text-indigo-500 font-semibold">SAGE</span>
                <span className="text-xs ml-1 text-indigo-400">by Vida Software</span>
              </Text>
            </div>
          </Flex>
        </div>

        {/* Filtros */}
        <Card className="mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Filtro de fecha simple en lugar de DateRangePicker */}
            <div className="flex flex-col space-y-2">
              <div className="text-sm font-medium">Rango de fechas</div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs mb-1 block">Desde</label>
                  <input 
                    type="date" 
                    className="w-full p-2 border rounded"
                    value={dateRange.from.toISOString().split('T')[0]}
                    onChange={(e) => {
                      const newDate = new Date(e.target.value);
                      setDateRange(prev => ({...prev, from: newDate}));
                    }}
                  />
                </div>
                <div>
                  <label className="text-xs mb-1 block">Hasta</label>
                  <input 
                    type="date" 
                    className="w-full p-2 border rounded"
                    value={dateRange.to.toISOString().split('T')[0]}
                    onChange={(e) => {
                      const newDate = new Date(e.target.value);
                      setDateRange(prev => ({...prev, to: newDate}));
                    }}
                  />
                </div>
              </div>
            </div>
            <Select value={selectedOrg} onValueChange={setSelectedOrg}>
              <SelectItem value="todas">Todas las organizaciones</SelectItem>
              {organizaciones.map((org) => (
                <SelectItem key={org.id} value={org.id}>
                  {org.nombre}
                </SelectItem>
              ))}
            </Select>
            <Select value={selectedPais} onValueChange={setSelectedPais}>
              <SelectItem value="todos">Todos los países</SelectItem>
              {Array.isArray(paises) && paises.map((pais) => (
                <SelectItem key={pais.id} value={pais.id}>
                  {pais.nombre}
                </SelectItem>
              ))}
            </Select>
            <Select value={selectedProducto} onValueChange={setSelectedProducto}>
              <SelectItem value="todos">Todos los productos</SelectItem>
              {Array.isArray(productos) && productos.map((prod) => (
                <SelectItem key={prod.id} value={prod.id}>
                  {prod.nombre}
                </SelectItem>
              ))}
            </Select>
          </div>
        </Card>

        {/* Métricas Principales */}
        <Grid numItemsSm={2} numItemsLg={4} className="gap-4 sm:gap-6 mb-6">
          <Card 
            decoration="top" 
            decorationColor="emerald"
            onClick={() => handleMetricClick('archivos_procesados')}
            className="cursor-pointer hover:shadow-lg transition-shadow"
          >
            <Flex alignItems="start">
              <div>
                <Text>Archivos Procesados</Text>
                <Metric>{stats.archivos_procesados}</Metric>
              </div>
              <DocumentCheckIcon className="h-6 w-6 text-emerald-500" />
            </Flex>
          </Card>

          <Card 
            decoration="top" 
            decorationColor="blue"
            onClick={() => handleMetricClick('tasa_exito')}
            className="cursor-pointer hover:shadow-lg transition-shadow"
          >
            <Flex alignItems="start">
              <div>
                <Text>Tasa de Éxito</Text>
                <Metric>{stats.tasa_exito}%</Metric>
              </div>
              <Badge color="blue">{`↑ ${Math.max(0, stats.tasa_exito - 80)}%`}</Badge>
            </Flex>
          </Card>

          <Card 
            decoration="top" 
            decorationColor="amber"
            onClick={() => handleMetricClick('archivos_pendientes')}
            className="cursor-pointer hover:shadow-lg transition-shadow"
          >
            <Flex alignItems="start">
              <div>
                <Text>Archivos Pendientes</Text>
                <Metric>{stats.archivos_pendientes}</Metric>
              </div>
              <ClockIcon className="h-6 w-6 text-amber-500" />
            </Flex>
          </Card>

          <Card 
            decoration="top" 
            decorationColor="red"
            onClick={() => handleMetricClick('casillas_por_vencer')}
            className="cursor-pointer hover:shadow-lg transition-shadow"
          >
            <Flex alignItems="start">
              <div>
                <Text>Casillas por Vencer</Text>
                <Metric>{stats.casillas_por_vencer}</Metric>
              </div>
              <ExclamationTriangleIcon className="h-6 w-6 text-red-500" />
            </Flex>
          </Card>
        </Grid>

        {/* Contenido Principal */}
        <TabGroup className="mt-6">
          <TabList>
            <Tab icon={ServerIcon}>Estado General</Tab>
            <Tab icon={ChartBarIcon}>Tendencias</Tab>
            <Tab icon={UserGroupIcon}>Casillas y Emisores</Tab>
          </TabList>
          
          <TabPanels>
            {/* Panel 1: Estado General */}
            <TabPanel>
              <Grid numItems={1} numItemsMd={2} className="gap-6 mt-6">
                {/* Últimas Ejecuciones */}
                <Card>
                  <Flex>
                    <Title>Últimas Ejecuciones</Title>
                    <Text className="text-blue-500 cursor-pointer">Ver todos</Text>
                  </Flex>
                  <Table className="mt-4">
                    <TableHead>
                      <TableRow>
                        <TableHeaderCell>Fecha</TableHeaderCell>
                        <TableHeaderCell>Casilla</TableHeaderCell>
                        <TableHeaderCell>Emisor</TableHeaderCell>
                        <TableHeaderCell>Estado</TableHeaderCell>
                        <TableHeaderCell>Detalles</TableHeaderCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {ultimasEjecuciones
                        .filter(ejecucion => ejecucion.casilla?.nombre) // Solo mostrar ejecuciones con casilla asignada
                        .map((ejecucion) => {
                          const isFailed = ejecucion.estado?.toLowerCase() === 'fallido' || ejecucion.estado?.toLowerCase() === 'error';
                          
                          return (
                            <TableRow 
                              key={ejecucion.uuid}
                              className={isFailed ? 'bg-red-50' : ''}
                            >
                              <TableCell className={isFailed ? 'text-red-700' : ''}>
                                {formatDate(ejecucion.fecha)}
                              </TableCell>
                              <TableCell className={isFailed ? 'text-red-700' : ''}>
                                <div className="flex items-center">
                                  <DocumentIcon className={`h-4 w-4 mr-2 ${isFailed ? 'text-red-500' : 'text-blue-500'}`} />
                                  <span>{ejecucion.casilla?.nombre || ''}</span>
                                </div>
                              </TableCell>
                              <TableCell className={isFailed ? 'text-red-700' : ''}>
                                <div className="flex items-center">
                                  {ejecucion.emisor?.nombre && (
                                    <>
                                      <UserGroupIcon className={`h-4 w-4 mr-2 ${isFailed ? 'text-red-500' : 'text-indigo-500'}`} />
                                      <span>{ejecucion.emisor.nombre}</span>
                                    </>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge color={getStatusColor(ejecucion.estado)}>
                                  {ejecucion.estado || 'Desconocido'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <a href={`/portal-externo/historial/${ejecucion.uuid}`} 
                                   className={`hover:underline flex items-center ${isFailed ? 'text-red-500' : 'text-blue-500'}`}>
                                  <DocumentMagnifyingGlassIcon className="h-4 w-4 mr-1" />
                                  Ver
                                </a>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      }
                    </TableBody>
                  </Table>
                </Card>

                {/* Estado del Sistema */}
                <Card>
                  <Title>Estado del Sistema</Title>
                  <div className="mt-4 space-y-6">
                    <div>
                      <Flex>
                        <Text>Tasa de Éxito</Text>
                        <Text>{stats.tasa_exito}%</Text>
                      </Flex>
                      <ProgressBar value={stats.tasa_exito} color="emerald" className="mt-2" />
                    </div>
                    
                    <div>
                      <Flex>
                        <Text>Archivos Procesados</Text>
                        <Flex>
                          <DocumentCheckIcon className="h-4 w-4 text-emerald-500 mr-1" />
                          <Text>{stats.archivos_procesados}</Text>
                        </Flex>
                      </Flex>
                    </div>
                    
                    <div>
                      <Flex>
                        <Text>Archivos Pendientes</Text>
                        <Flex>
                          <ClockIcon className="h-4 w-4 text-amber-500 mr-1" />
                          <Text>{stats.archivos_pendientes}</Text>
                        </Flex>
                      </Flex>
                    </div>
                    
                    <div>
                      <Flex>
                        <Text>Casillas Activas</Text>
                        <Flex>
                          <CubeTransparentIcon className="h-4 w-4 text-blue-500 mr-1" />
                          <Text>{stats.casillas_por_vencer}</Text>
                        </Flex>
                      </Flex>
                    </div>
                    
                    <Flex>
                      <div className="inline-flex items-center">
                        <div className="h-3 w-3 rounded-full bg-emerald-500 mr-1"></div>
                        <Text className="text-xs">Éxito</Text>
                      </div>
                      <div className="inline-flex items-center">
                        <div className="h-3 w-3 rounded-full bg-red-500 mr-1"></div>
                        <Text className="text-xs">Error</Text>
                      </div>
                      <div className="inline-flex items-center">
                        <div className="h-3 w-3 rounded-full bg-amber-500 mr-1"></div>
                        <Text className="text-xs">Pendiente</Text>
                      </div>
                    </Flex>
                  </div>
                </Card>
              </Grid>
            </TabPanel>
            
            {/* Panel 2: Tendencias */}
            <TabPanel>
              <Card className="mt-6">
                <div className="mb-4">
                  <Flex className="mb-4">
                    <Title>Tendencia de Ejecuciones</Title>
                    <Select 
                      className="w-36"
                      value={selectedInterval}
                      onValueChange={setSelectedInterval}
                    >
                      <SelectItem value="day">Diario</SelectItem>
                      <SelectItem value="week">Semanal</SelectItem>
                      <SelectItem value="month">Mensual</SelectItem>
                    </Select>
                  </Flex>
                  <Subtitle>
                    Visualización de la tendencia de ejecuciones en el periodo seleccionado
                  </Subtitle>
                </div>
                
                <div className="mt-8">
                  <BarChart
                    data={tendenciaData}
                    index="periodo"
                    categories={["Éxito", "Error", "Pendiente"]}
                    colors={["emerald", "red", "amber"]}
                    valueFormatter={(number) => number.toString()}
                    yAxisWidth={40}
                    showLegend={true}
                    onValueChange={(v) => console.log(v)}
                  />
                </div>
                
                <div className="mt-8">
                  <LineChart
                    data={tendenciaData}
                    index="periodo"
                    categories={["Total"]}
                    colors={["blue"]}
                    valueFormatter={(number) => number.toString()}
                    yAxisWidth={40}
                    showLegend={true}
                  />
                </div>
              </Card>
              
              {/* Tabla de Instalaciones y Casillas */}
              <Card className="mt-6">
                <div className="mb-4">
                  <Title>Instalaciones y Casillas</Title>
                  <Text className="mt-2">Estadísticas por instalación y casilla de recepción</Text>
                </div>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>Instalación</TableHeaderCell>
                      <TableHeaderCell>Casilla</TableHeaderCell>
                      <TableHeaderCell>Emisores</TableHeaderCell>
                      <TableHeaderCell>Archivos</TableHeaderCell>
                      <TableHeaderCell>Estado</TableHeaderCell>
                      <TableHeaderCell>Última Act.</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {instalacionesCasillas.map((item, idx) => {
                      const isFailed = item.ultimoEstado?.toLowerCase() === 'fallido' || item.ultimoEstado?.toLowerCase() === 'error';
                      
                      return (
                        <TableRow key={`instalacion-casilla-${idx}`} className={isFailed ? 'bg-red-50' : ''}>
                          <TableCell className={isFailed ? 'text-red-700' : ''}>
                            <div className="flex items-center">
                              <ServerIcon className={`h-4 w-4 mr-2 ${isFailed ? 'text-red-500' : 'text-emerald-500'}`} />
                              <span className="font-medium">{item.instalacion.nombre}</span>
                            </div>
                          </TableCell>
                          <TableCell className={isFailed ? 'text-red-700' : ''}>
                            <div className="flex items-center">
                              <CubeTransparentIcon className={`h-4 w-4 mr-2 ${isFailed ? 'text-red-500' : 'text-blue-500'}`} />
                              <span>{item.casilla.nombre}</span>
                            </div>
                          </TableCell>
                          <TableCell className={isFailed ? 'text-red-700' : ''}>
                            {item.cantidadEmisores}
                          </TableCell>
                          <TableCell className={isFailed ? 'text-red-700' : ''}>
                            {item.archivosProc}
                          </TableCell>
                          <TableCell>
                            <Badge color={getStatusColor(item.ultimoEstado)}>
                              {item.ultimoEstado || 'Sin datos'}
                            </Badge>
                          </TableCell>
                          <TableCell className={isFailed ? 'text-red-700' : ''}>
                            {formatDate(item.ultimaEjecucion)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Card>
            </TabPanel>
          </TabPanels>
        </TabGroup>

        {/* Modal de detalles */}
        <Dialog
          open={detailsOpen}
          onClose={() => setDetailsOpen(false)}
          className="relative z-50"
        >
          <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
              <Dialog.Title className="text-lg font-medium leading-6 text-gray-900 mb-4">
                Detalles {selectedMetric && selectedMetric.replace(/_/g, ' ')}
              </Dialog.Title>
              <List>
                {detailsData.map((item, index) => (
                  <ListItem key={index}>
                    <span className="font-medium">{item.nombre}</span>
                    <Text>{item.valor}</Text>
                  </ListItem>
                ))}
              </List>
            </Dialog.Panel>
          </div>
        </Dialog>
      </div>
    </main>
  );
}