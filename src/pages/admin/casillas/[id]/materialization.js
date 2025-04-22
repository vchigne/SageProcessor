import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import {
  Card,
  Title,
  Text,
  Badge,
  Button,
  Grid,
  Col,
  Flex,
  TextInput,
  Select,
  SelectItem,
  Switch,
  Divider,
  Metric,
  Table,
  TableHead,
  TableRow,
  TableHeaderCell,
  TableBody,
  TableCell,
  Callout
} from '@tremor/react';
import {
  PlusIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  DocumentTextIcon,
  DatabaseIcon,
  ArrowLeftIcon,
  TableCellsIcon
} from '@heroicons/react/24/outline';
import Breadcrumbs from '@/components/Breadcrumbs';
import { toast } from 'react-toastify';
import Link from 'next/link';

export default function CasillaMaterializationPage() {
  const router = useRouter();
  const { id } = router.query;
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [casilla, setCasilla] = useState(null);
  const [materializations, setMaterializations] = useState([]);
  const [detectedTables, setDetectedTables] = useState([]);
  const [connections, setConnections] = useState([]);
  const [showNewForm, setShowNewForm] = useState(false);
  
  // Formulario para nueva materialización
  const [newMaterialization, setNewMaterialization] = useState({
    nombre: '',
    tipo_materializacion: 'database', // 'database', 'cloud_datalake', 'local'
    connection_id: null,
    tabla_destino: '',
    schema_destino: 'public',
    estrategia_actualizacion: 'append', // 'append', 'truncate_insert', 'delete_insert', 'upsert'
    columnas_clave: [],
    columnas_particion: [],
    activado: true,
    formato_destino: 'parquet', // 'parquet', 'iceberg', 'hudi'
    tabla_origen: null
  });
  
  useEffect(() => {
    if (!router.isReady || !id) return;
    
    // Cargar datos iniciales
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        
        // Cargar información de la casilla
        const casillaResponse = await fetch(`/api/admin/casillas/${id}`);
        if (!casillaResponse.ok) throw new Error('Error al cargar datos de la casilla');
        const casillaData = await casillaResponse.json();
        setCasilla(casillaData);
        
        // Cargar conexiones disponibles
        const connectionsResponse = await fetch('/api/admin/database-connections');
        if (!connectionsResponse.ok) throw new Error('Error al cargar conexiones');
        const connectionsData = await connectionsResponse.json();
        setConnections(connectionsData.filter(c => c.activo));
        
        // Cargar materializaciones de la casilla
        const materializationsResponse = await fetch(`/api/admin/casillas/${id}/materializations`);
        if (!materializationsResponse.ok) throw new Error('Error al cargar materializaciones');
        const materializationsData = await materializationsResponse.json();
        setMaterializations(materializationsData);
        
        // Detectar tablas en YAML de la casilla
        if (casillaData.yaml_config) {
          const detectResponse = await fetch('/api/admin/materializations/detect-tables', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              casilla_id: id,
              yaml_config: casillaData.yaml_config
            }),
          });
          
          if (detectResponse.ok) {
            const detectData = await detectResponse.json();
            setDetectedTables(detectData.tables || []);
          }
        }
      } catch (error) {
        console.error('Error:', error);
        toast.error('Error al cargar datos para la materialización');
      } finally {
        setLoading(false);
      }
    };
    
    fetchInitialData();
  }, [router.isReady, id]);
  
  // Actualizar el connection_id cuando cambia el tipo de materialización
  useEffect(() => {
    const tipo = newMaterialization.tipo_materializacion;
    
    if (tipo === 'database' && connections.length > 0) {
      setNewMaterialization(prev => ({
        ...prev,
        connection_id: connections[0].id,
        formato_destino: null
      }));
    } else if (tipo === 'cloud_datalake') {
      setNewMaterialization(prev => ({
        ...prev,
        connection_id: null,
        formato_destino: 'parquet'
      }));
    } else if (tipo === 'local') {
      setNewMaterialization(prev => ({
        ...prev,
        connection_id: null,
        formato_destino: 'parquet'
      }));
    }
  }, [newMaterialization.tipo_materializacion, connections]);
  
  const handleInputChange = (field, value) => {
    setNewMaterialization(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  const handleSelectTablaOrigen = (tableInfo) => {
    setNewMaterialization(prev => ({
      ...prev,
      tabla_origen: tableInfo.id,
      nombre: tableInfo.suggested_name || `Materialización ${tableInfo.table_name}`,
      tabla_destino: tableInfo.table_name.toLowerCase().replace(/\s+/g, '_')
    }));
  };
  
  const createMaterialization = async () => {
    try {
      // Validaciones básicas
      if (!newMaterialization.nombre) {
        toast.error('El nombre es obligatorio');
        return;
      }
      
      if (!newMaterialization.tabla_origen) {
        toast.error('Debe seleccionar una tabla origen');
        return;
      }
      
      if (newMaterialization.tipo_materializacion === 'database') {
        if (!newMaterialization.connection_id) {
          toast.error('Debe seleccionar una conexión de base de datos');
          return;
        }
        
        if (!newMaterialization.tabla_destino) {
          toast.error('El nombre de la tabla destino es obligatorio');
          return;
        }
      } else if (newMaterialization.tipo_materializacion === 'cloud_datalake') {
        if (!newMaterialization.formato_destino) {
          toast.error('Debe seleccionar un formato para el data lake');
          return;
        }
      }
      
      setSaving(true);
      
      // Preparar datos para enviar
      const materializationData = {
        ...newMaterialization,
        casilla_id: parseInt(id)
      };
      
      // Enviar petición para crear
      const response = await fetch('/api/admin/materializations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(materializationData),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al crear la materialización');
      }
      
      const result = await response.json();
      
      // Actualizar lista de materializaciones
      setMaterializations([...materializations, result]);
      
      // Reiniciar formulario
      setNewMaterialization({
        nombre: '',
        tipo_materializacion: 'database',
        connection_id: connections.length > 0 ? connections[0].id : null,
        tabla_destino: '',
        schema_destino: 'public',
        estrategia_actualizacion: 'append',
        columnas_clave: [],
        columnas_particion: [],
        activado: true,
        formato_destino: 'parquet',
        tabla_origen: null
      });
      
      setShowNewForm(false);
      toast.success('Materialización creada correctamente');
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.message || 'Error al crear la materialización');
    } finally {
      setSaving(false);
    }
  };
  
  const toggleMaterialization = async (materialization, newStatus) => {
    try {
      // Actualizar estado
      const response = await fetch(`/api/admin/materializations/${materialization.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ activado: newStatus }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al actualizar la materialización');
      }
      
      // Actualizar lista local
      setMaterializations(materializations.map(m => {
        if (m.id === materialization.id) {
          return { ...m, activado: newStatus };
        }
        return m;
      }));
      
      toast.success(`Materialización ${newStatus ? 'activada' : 'desactivada'} correctamente`);
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.message || 'Error al actualizar el estado de la materialización');
    }
  };
  
  const refreshDetectedTables = async () => {
    if (!casilla || !casilla.yaml_config) {
      toast.warning('No hay configuración YAML disponible para detectar tablas');
      return;
    }
    
    try {
      setLoading(true);
      
      const detectResponse = await fetch('/api/admin/materializations/detect-tables', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          casilla_id: id,
          yaml_config: casilla.yaml_config
        }),
      });
      
      if (!detectResponse.ok) {
        const error = await detectResponse.json();
        throw new Error(error.message || 'Error al detectar tablas');
      }
      
      const detectData = await detectResponse.json();
      setDetectedTables(detectData.tables || []);
      
      toast.success('Tablas detectadas correctamente');
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.message || 'Error al detectar tablas en el YAML');
    } finally {
      setLoading(false);
    }
  };
  
  const getDestinationBadge = (materialization) => {
    const { tipo_materializacion, formato_destino } = materialization;
    
    switch (tipo_materializacion) {
      case 'database':
        return <Badge color="blue">Base de datos</Badge>;
      case 'cloud_datalake':
        return (
          <Flex justifyContent="start" className="space-x-2">
            <Badge color="purple">Data Lake</Badge>
            {formato_destino && (
              <Badge color="indigo">{formato_destino.toUpperCase()}</Badge>
            )}
          </Flex>
        );
      case 'local':
        return (
          <Flex justifyContent="start" className="space-x-2">
            <Badge color="green">Local</Badge>
            {formato_destino && (
              <Badge color="emerald">{formato_destino.toUpperCase()}</Badge>
            )}
          </Flex>
        );
      default:
        return <Badge color="gray">Desconocido</Badge>;
    }
  };
  
  const getUpdateStrategyBadge = (strategy) => {
    switch (strategy) {
      case 'append':
        return <Badge color="green">Añadir</Badge>;
      case 'truncate_insert':
        return <Badge color="orange">Truncar + Insertar</Badge>;
      case 'delete_insert':
        return <Badge color="amber">Eliminar + Insertar</Badge>;
      case 'upsert':
        return <Badge color="blue">Upsert</Badge>;
      default:
        return <Badge color="gray">{strategy}</Badge>;
    }
  };
  
  if (loading) {
    return (
      <Layout>
        <div className="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-9xl mx-auto">
          <div className="text-center p-12">Cargando...</div>
        </div>
      </Layout>
    );
  }
  
  return (
    <Layout>
      <div className="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-9xl mx-auto">
        <Breadcrumbs items={[
          { label: 'Admin', href: '/admin' },
          { label: 'Casillas', href: '/admin/casillas' },
          { label: casilla?.nombre || `Casilla ${id}`, href: `/admin/casillas/${id}` },
          { label: 'Materialización', current: true }
        ]} />
        
        <div className="sm:flex sm:justify-between sm:items-center mb-8">
          <div>
            <Title>Materialización para {casilla?.nombre || `Casilla ${id}`}</Title>
            <Text>Configuración para convertir datos procesados en estructuras permanentes</Text>
          </div>
          <Link
            href={`/admin/casillas/${id}`}
            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Volver a la casilla
          </Link>
        </div>
        
        <Grid numCols={1} numColsMd={2} numColsLg={3} className="gap-6 mb-6">
          <Col>
            <Card decoration="top" decorationColor="blue">
              <Flex justifyContent="start" className="space-x-4">
                <TableCellsIcon className="w-8 h-8 text-blue-500" />
                <div>
                  <Text>Tablas Detectadas</Text>
                  <Metric>{detectedTables.length}</Metric>
                </div>
              </Flex>
            </Card>
          </Col>
          
          <Col>
            <Card decoration="top" decorationColor="purple">
              <Flex justifyContent="start" className="space-x-4">
                <DatabaseIcon className="w-8 h-8 text-purple-500" />
                <div>
                  <Text>Materializaciones</Text>
                  <Metric>{materializations.length}</Metric>
                </div>
              </Flex>
            </Card>
          </Col>
          
          <Col numColSpanSm={2} numColSpanLg={1}>
            <Card decoration="top" decorationColor="green">
              <Flex justifyContent="start" className="space-x-4">
                <DocumentTextIcon className="w-8 h-8 text-green-500" />
                <div>
                  <Text>Materializaciones Activas</Text>
                  <Metric>{materializations.filter(m => m.activado).length} de {materializations.length}</Metric>
                </div>
              </Flex>
            </Card>
          </Col>
        </Grid>
        
        {/* Sección de Tablas Detectadas */}
        <div className="mb-8">
          <Card>
            <div className="sm:flex sm:justify-between sm:items-center mb-4">
              <Title>Tablas Detectadas en YAML</Title>
              <Button 
                icon={ArrowPathIcon} 
                onClick={refreshDetectedTables}
                disabled={loading}
                loading={loading}
              >
                Actualizar
              </Button>
            </div>
            
            {detectedTables.length === 0 ? (
              <Callout 
                title="No se han detectado tablas" 
                icon={InformationCircleIcon}
                color="blue"
              >
                No se han detectado tablas en la configuración YAML de esta casilla. 
                Asegúrese de que existan transformaciones con output en su configuración.
              </Callout>
            ) : (
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Nombre de Tabla</TableHeaderCell>
                    <TableHeaderCell>Tipo</TableHeaderCell>
                    <TableHeaderCell>Columnas</TableHeaderCell>
                    <TableHeaderCell>Estado</TableHeaderCell>
                    <TableHeaderCell>Acciones</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {detectedTables.map((table) => (
                    <TableRow key={table.id}>
                      <TableCell>
                        <div className="font-medium">{table.table_name}</div>
                        <div className="text-xs text-gray-500">ID: {table.id}</div>
                      </TableCell>
                      <TableCell>
                        <Badge color="indigo">{table.type || 'Dataframe'}</Badge>
                      </TableCell>
                      <TableCell>
                        {table.columns?.length || 0} columnas
                      </TableCell>
                      <TableCell>
                        {materializations.some(m => m.tabla_origen === table.id) ? (
                          <Badge color="green">Materializada</Badge>
                        ) : (
                          <Badge color="gray">No materializada</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="xs"
                          disabled={materializations.some(m => m.tabla_origen === table.id) || showNewForm}
                          onClick={() => {
                            handleSelectTablaOrigen(table);
                            setShowNewForm(true);
                          }}
                        >
                          Materializar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </div>
        
        {/* Formulario para nueva materialización */}
        {showNewForm && (
          <div className="mb-8">
            <Card>
              <Title>Nueva Materialización</Title>
              
              <Grid numCols={1} numColsMd={2} className="gap-6 mt-4">
                <Col>
                  <TextInput
                    label="Nombre de la materialización"
                    placeholder="Ej. Ventas Mensuales Materializadas"
                    value={newMaterialization.nombre}
                    onChange={(value) => handleInputChange('nombre', value)}
                    required
                  />
                  
                  <div className="mt-4">
                    <Text className="mb-1 font-medium">Tabla origen</Text>
                    <div className="p-3 border rounded-md bg-gray-50">
                      {newMaterialization.tabla_origen ? (
                        <div>
                          <div className="font-medium">
                            {detectedTables.find(t => t.id === newMaterialization.tabla_origen)?.table_name}
                          </div>
                          <div className="text-xs text-gray-500">
                            ID: {newMaterialization.tabla_origen}
                          </div>
                        </div>
                      ) : (
                        <Text className="text-gray-500">No se ha seleccionado tabla origen</Text>
                      )}
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <Select
                      label="Tipo de materialización"
                      value={newMaterialization.tipo_materializacion}
                      onValueChange={(value) => handleInputChange('tipo_materializacion', value)}
                    >
                      <SelectItem value="database">Base de datos</SelectItem>
                      <SelectItem value="cloud_datalake">Data Lake en la nube</SelectItem>
                      <SelectItem value="local">Archivo local</SelectItem>
                    </Select>
                  </div>
                  
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Activado
                    </label>
                    <Switch
                      checked={newMaterialization.activado}
                      onChange={() => handleInputChange('activado', !newMaterialization.activado)}
                    />
                  </div>
                </Col>
                
                <Col>
                  {newMaterialization.tipo_materializacion === 'database' ? (
                    <>
                      <Select
                        label="Conexión a base de datos"
                        value={newMaterialization.connection_id || ''}
                        onValueChange={(value) => handleInputChange('connection_id', value)}
                        disabled={connections.length === 0}
                      >
                        {connections.length === 0 ? (
                          <SelectItem value="">No hay conexiones disponibles</SelectItem>
                        ) : (
                          connections.map((conn) => (
                            <SelectItem key={conn.id} value={conn.id}>
                              {conn.nombre} ({conn.tipo_servidor})
                            </SelectItem>
                          ))
                        )}
                      </Select>
                      
                      <div className="mt-4">
                        <TextInput
                          label="Schema"
                          placeholder="public"
                          value={newMaterialization.schema_destino}
                          onChange={(value) => handleInputChange('schema_destino', value)}
                        />
                      </div>
                      
                      <div className="mt-4">
                        <TextInput
                          label="Tabla destino"
                          placeholder="nombre_tabla"
                          value={newMaterialization.tabla_destino}
                          onChange={(value) => handleInputChange('tabla_destino', value)}
                          required
                        />
                      </div>
                      
                      <div className="mt-4">
                        <Select
                          label="Estrategia de actualización"
                          value={newMaterialization.estrategia_actualizacion}
                          onValueChange={(value) => handleInputChange('estrategia_actualizacion', value)}
                        >
                          <SelectItem value="append">Añadir (append)</SelectItem>
                          <SelectItem value="truncate_insert">Truncar e insertar</SelectItem>
                          <SelectItem value="delete_insert">Eliminar e insertar</SelectItem>
                          <SelectItem value="upsert">Upsert (actualizar/insertar)</SelectItem>
                        </Select>
                      </div>
                    </>
                  ) : (
                    <>
                      <Select
                        label="Formato"
                        value={newMaterialization.formato_destino}
                        onValueChange={(value) => handleInputChange('formato_destino', value)}
                      >
                        <SelectItem value="parquet">Parquet</SelectItem>
                        <SelectItem value="csv">CSV</SelectItem>
                        <SelectItem value="iceberg">Apache Iceberg</SelectItem>
                        <SelectItem value="hudi">Apache Hudi</SelectItem>
                      </Select>
                      
                      {(newMaterialization.formato_destino === 'iceberg' || 
                        newMaterialization.formato_destino === 'hudi') && (
                        <div className="mt-4">
                          <TextInput
                            label="Columnas para particionamiento (separadas por coma)"
                            placeholder="fecha, region, producto"
                            value={newMaterialization.columnas_particion.join(', ')}
                            onChange={(value) => handleInputChange('columnas_particion', 
                              value.split(',').map(v => v.trim()).filter(v => v)
                            )}
                          />
                        </div>
                      )}
                      
                      {newMaterialization.formato_destino === 'hudi' && (
                        <div className="mt-4">
                          <TextInput
                            label="Columnas clave (separadas por coma)"
                            placeholder="id, codigo"
                            value={newMaterialization.columnas_clave.join(', ')}
                            onChange={(value) => handleInputChange('columnas_clave', 
                              value.split(',').map(v => v.trim()).filter(v => v)
                            )}
                          />
                        </div>
                      )}
                      
                      {newMaterialization.tipo_materializacion === 'cloud_datalake' && (
                        <div className="mt-4">
                          <Callout
                            title="Configuración de nube" 
                            icon={InformationCircleIcon}
                            color="blue"
                          >
                            La configuración de la nube se tomará del destino predeterminado
                            de la casilla o de la configuración global de materializaciones.
                          </Callout>
                        </div>
                      )}
                    </>
                  )}
                </Col>
              </Grid>
              
              <Divider className="my-4" />
              
              <Flex justifyContent="end" className="space-x-3 mt-4">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowNewForm(false);
                    setNewMaterialization({
                      nombre: '',
                      tipo_materializacion: 'database',
                      connection_id: connections.length > 0 ? connections[0].id : null,
                      tabla_destino: '',
                      schema_destino: 'public',
                      estrategia_actualizacion: 'append',
                      columnas_clave: [],
                      columnas_particion: [],
                      activado: true,
                      formato_destino: 'parquet',
                      tabla_origen: null
                    });
                  }}
                  disabled={saving}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={createMaterialization}
                  disabled={saving}
                  loading={saving}
                >
                  Crear Materialización
                </Button>
              </Flex>
            </Card>
          </div>
        )}
        
        {/* Materializaciones configuradas */}
        <div className="mb-8">
          <Card>
            <div className="sm:flex sm:justify-between sm:items-center mb-4">
              <Title>Materializaciones Configuradas</Title>
              <Button 
                icon={PlusIcon}
                onClick={() => {
                  if (detectedTables.length === 0) {
                    toast.warning('No hay tablas detectadas para materializar');
                    return;
                  }
                  setShowNewForm(!showNewForm);
                }}
                disabled={detectedTables.length === 0}
              >
                Nueva Materialización
              </Button>
            </div>
            
            {materializations.length === 0 ? (
              <div className="text-center py-6">
                <Text className="text-gray-500">No hay materializaciones configuradas para esta casilla</Text>
              </div>
            ) : (
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Nombre</TableHeaderCell>
                    <TableHeaderCell>Tabla Origen</TableHeaderCell>
                    <TableHeaderCell>Destino</TableHeaderCell>
                    <TableHeaderCell>Estrategia</TableHeaderCell>
                    <TableHeaderCell>Estado</TableHeaderCell>
                    <TableHeaderCell>Acciones</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {materializations.map((materialization) => {
                    const sourceTable = detectedTables.find(t => t.id === materialization.tabla_origen);
                    
                    return (
                      <TableRow key={materialization.id}>
                        <TableCell>
                          <div className="font-medium">{materialization.nombre}</div>
                          <div className="text-xs text-gray-500">ID: {materialization.id}</div>
                        </TableCell>
                        <TableCell>
                          {sourceTable ? (
                            <div>
                              <div className="font-medium">{sourceTable.table_name}</div>
                              <div className="text-xs text-gray-500">ID: {materialization.tabla_origen}</div>
                            </div>
                          ) : (
                            <div className="text-gray-500">Tabla desconocida</div>
                          )}
                        </TableCell>
                        <TableCell>
                          {getDestinationBadge(materialization)}
                          {materialization.tipo_materializacion === 'database' && (
                            <div className="text-xs mt-1">
                              {materialization.schema_destino}.{materialization.tabla_destino}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {getUpdateStrategyBadge(materialization.estrategia_actualizacion)}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={materialization.activado}
                            onChange={() => toggleMaterialization(materialization, !materialization.activado)}
                          />
                          <span className="text-xs ml-2">
                            {materialization.activado ? 'Activo' : 'Inactivo'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Flex justifyContent="start" className="space-x-2">
                            <Button
                              size="xs"
                              variant="secondary"
                              onClick={() => router.push(`/admin/materializations/${materialization.id}`)}
                            >
                              Detalles
                            </Button>
                          </Flex>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Card>
        </div>
      </div>
    </Layout>
  );
}