import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import Link from 'next/link';
import {
  Card,
  Title,
  Text,
  Badge,
  Button,
  Table,
  TableHead,
  TableRow,
  TableHeaderCell,
  TableBody,
  TableCell,
  Flex,
  Grid,
  Col,
  Divider,
  Select,
  SelectItem,
  TextInput,
  Switch,
  Callout
} from '@tremor/react';
import {
  ArrowLeftIcon,
  DatabaseIcon,
  CloudArrowUpIcon,
  DocumentTextIcon,
  PlusIcon,
  TrashIcon,
  ArrowPathIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
  LightBulbIcon
} from '@heroicons/react/24/outline';
import Breadcrumbs from '@/components/Breadcrumbs';
import { toast } from 'react-toastify';
import ConfirmDialog from '@/components/ConfirmDialog';

export default function CasillaMaterializationPage() {
  const router = useRouter();
  const { id } = router.query;
  
  const [casilla, setCasilla] = useState(null);
  const [loading, setLoading] = useState(true);
  const [materializations, setMaterializations] = useState([]);
  const [loadingMaterializations, setLoadingMaterializations] = useState(true);
  const [detectedTables, setDetectedTables] = useState([]);
  const [loadingDetection, setLoadingDetection] = useState(false);
  const [dbConnections, setDbConnections] = useState([]);
  const [cloudProviders, setCloudProviders] = useState([]);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [materializationToDelete, setMaterializationToDelete] = useState(null);
  
  // Nuevo formulario
  const [showNewForm, setShowNewForm] = useState(false);
  const [newMaterialization, setNewMaterialization] = useState({
    nombre: '',
    tipo_materializacion: 'database',  // database, cloud_datalake, local
    connection_id: '',  // Para database
    cloud_provider_id: '',  // Para cloud_datalake
    formato_destino: 'parquet',  // parquet, iceberg, hudi
    tabla_destino: '',
    schema_destino: 'public',
    estrategia_actualizacion: 'upsert',  // upsert, delete_insert, append, truncate_insert
    clave_primaria: '',
    particion_por: '',
    activado: true
  });
  
  // Estados para análisis y detectión de tablas
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [selectedTable, setSelectedTable] = useState(null);
  
  useEffect(() => {
    if (!router.isReady) return;
    
    fetchCasilla();
    fetchMaterializations();
    fetchConfigurations();
  }, [router.isReady, id]);
  
  const fetchCasilla = async () => {
    try {
      const response = await fetch(`/api/admin/casillas/${id}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          toast.error('La casilla solicitada no existe.');
          router.push('/admin/casillas');
          return;
        }
        throw new Error('Error al obtener la casilla');
      }
      
      const data = await response.json();
      setCasilla(data);
      setLoading(false);
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.message || 'Error al cargar los datos de la casilla');
      setLoading(false);
    }
  };
  
  const fetchMaterializations = async () => {
    try {
      setLoadingMaterializations(true);
      const response = await fetch(`/api/admin/casillas/${id}/materializations`);
      
      if (!response.ok) {
        throw new Error('Error al obtener materializaciones');
      }
      
      const data = await response.json();
      setMaterializations(data);
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.message || 'Error al cargar las materializaciones');
    } finally {
      setLoadingMaterializations(false);
    }
  };
  
  const fetchConfigurations = async () => {
    try {
      setLoadingConfig(true);
      
      // Obtener conexiones de base de datos
      const dbResponse = await fetch('/api/admin/database-connections');
      const dbData = await dbResponse.json();
      setDbConnections(dbData);
      
      // Obtener proveedores de nube
      const cloudResponse = await fetch('/api/admin/cloud-providers');
      const cloudData = await cloudResponse.json();
      setCloudProviders(cloudData);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar configuraciones');
    } finally {
      setLoadingConfig(false);
    }
  };
  
  const detectTables = async () => {
    try {
      setLoadingDetection(true);
      const response = await fetch(`/api/admin/materializations/detect-tables`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ casilla_id: parseInt(id) }),
      });
      
      if (!response.ok) {
        throw new Error('Error al detectar tablas');
      }
      
      const data = await response.json();
      setDetectedTables(data.tables || []);
      setShowAnalysis(true);
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.message || 'Error al detectar tablas');
    } finally {
      setLoadingDetection(false);
    }
  };
  
  const handleNewMaterializationChange = (field, value) => {
    setNewMaterialization(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  const createMaterialization = async () => {
    try {
      if (!newMaterialization.nombre) {
        toast.error('El nombre es obligatorio');
        return;
      }
      
      if (newMaterialization.tipo_materializacion === 'database' && !newMaterialization.connection_id) {
        toast.error('Debe seleccionar una conexión de base de datos');
        return;
      }
      
      if (newMaterialization.tipo_materializacion === 'cloud_datalake' && !newMaterialization.cloud_provider_id) {
        toast.error('Debe seleccionar un proveedor de nube');
        return;
      }
      
      if (!newMaterialization.tabla_destino) {
        toast.error('Debe especificar una tabla de destino');
        return;
      }
      
      const payload = {
        ...newMaterialization,
        casilla_id: parseInt(id)
      };
      
      const response = await fetch('/api/admin/materializations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al crear materialización');
      }
      
      const responseData = await response.json();
      
      // Actualizar la lista
      setMaterializations(prev => [...prev, responseData]);
      
      // Resetear formulario
      setNewMaterialization({
        nombre: '',
        tipo_materializacion: 'database',
        connection_id: '',
        cloud_provider_id: '',
        formato_destino: 'parquet',
        tabla_destino: '',
        schema_destino: 'public',
        estrategia_actualizacion: 'upsert',
        clave_primaria: '',
        particion_por: '',
        activado: true
      });
      
      setShowNewForm(false);
      toast.success('Materialización creada correctamente');
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.message || 'Error al crear la materialización');
    }
  };
  
  const selectDetectedTable = (table) => {
    setSelectedTable(table);
    
    // Llenar formulario con datos detectados
    setNewMaterialization(prev => ({
      ...prev,
      nombre: `${table.name} - Materialización`,
      tabla_destino: table.name.toLowerCase().replace(/\s+/g, '_'),
      clave_primaria: table.primary_key ? table.primary_key.join(',') : ''
    }));
    
    setShowAnalysis(false);
    setShowNewForm(true);
  };
  
  const handleToggleMaterialization = async (materialization) => {
    try {
      const newStatus = !materialization.activado;
      
      const response = await fetch(`/api/admin/materializations/${materialization.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ activado: newStatus }),
      });
      
      if (!response.ok) {
        throw new Error('Error al actualizar materialización');
      }
      
      // Actualizar la lista
      setMaterializations(prev => 
        prev.map(item => 
          item.id === materialization.id 
            ? { ...item, activado: newStatus } 
            : item
        )
      );
      
      toast.success(`Materialización ${newStatus ? 'activada' : 'desactivada'} correctamente`);
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.message || 'Error al actualizar la materialización');
    }
  };
  
  const handleDeleteMaterialization = (materialization) => {
    setMaterializationToDelete(materialization);
    setConfirmOpen(true);
  };
  
  const confirmDeleteMaterialization = async () => {
    if (!materializationToDelete) return;
    
    try {
      const response = await fetch(`/api/admin/materializations/${materializationToDelete.id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Error al eliminar materialización');
      }
      
      // Actualizar la lista
      setMaterializations(prev => 
        prev.filter(item => item.id !== materializationToDelete.id)
      );
      
      toast.success('Materialización eliminada correctamente');
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.message || 'Error al eliminar la materialización');
    } finally {
      setMaterializationToDelete(null);
      setConfirmOpen(false);
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
          { label: casilla.nombre, href: `/admin/casillas/${id}` },
          { label: 'Materialización', current: true }
        ]} />
        
        <div className="sm:flex sm:justify-between sm:items-center mb-8">
          <div>
            <Title>Materialización de Datos</Title>
            <Text>Configure opciones de materialización para la casilla {casilla.nombre}</Text>
          </div>
          <Flex justifyContent="end" className="mt-4 sm:mt-0 space-x-3">
            <Link
              href={`/admin/casillas/${id}`}
              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              Volver a Casilla
            </Link>
            <Button
              variant="secondary"
              icon={LightBulbIcon}
              loading={loadingDetection}
              onClick={detectTables}
            >
              Detectar Tablas
            </Button>
            <Button
              variant="primary"
              icon={PlusIcon}
              onClick={() => {
                setShowNewForm(true);
                setShowAnalysis(false);
              }}
            >
              Nueva Materialización
            </Button>
          </Flex>
        </div>
        
        {/* Análisis de Tablas */}
        {showAnalysis && (
          <Card className="mb-6">
            <Title>Tablas Detectadas</Title>
            <Text>Estas son las tablas detectadas en la configuración YAML de la casilla.</Text>
            
            <div className="mt-4">
              {detectedTables.length === 0 ? (
                <Callout
                  title="No se detectaron tablas"
                  icon={InformationCircleIcon}
                  color="blue"
                >
                  No se encontraron tablas definidas en la configuración YAML. Si está seguro de que deberían haber tablas, verifique la configuración.
                </Callout>
              ) : (
                <Grid numCols={1} numColsMd={2} numColsLg={3} className="gap-6 mt-4">
                  {detectedTables.map((table, index) => (
                    <Col key={index}>
                      <Card decoration="left" decorationColor="blue">
                        <Flex justifyContent="between" alignItems="center">
                          <Title>{table.name}</Title>
                          <Button size="xs" onClick={() => selectDetectedTable(table)}>
                            Seleccionar
                          </Button>
                        </Flex>
                        <Divider />
                        <div className="mt-2 space-y-2 text-sm">
                          <div>
                            <strong>Columnas:</strong> {table.columns.length}
                          </div>
                          {table.primary_key && table.primary_key.length > 0 && (
                            <div>
                              <strong>Clave Primaria:</strong> {table.primary_key.join(', ')}
                            </div>
                          )}
                          <div>
                            <strong>Archivo:</strong> {table.source_file || 'No especificado'}
                          </div>
                        </div>
                      </Card>
                    </Col>
                  ))}
                </Grid>
              )}
            </div>
          </Card>
        )}
        
        {/* Formulario de Nueva Materialización */}
        {showNewForm && (
          <Card className="mb-6">
            <Flex justifyContent="between" alignItems="center" className="mb-4">
              <Title>Nueva Materialización</Title>
              <Button 
                size="xs" 
                variant="light" 
                color="gray" 
                onClick={() => setShowNewForm(false)}
              >
                Cancelar
              </Button>
            </Flex>
            
            <Grid numCols={1} numColsMd={2} className="gap-4">
              <Col>
                <TextInput
                  label="Nombre"
                  placeholder="Nombre descriptivo"
                  value={newMaterialization.nombre}
                  onChange={(value) => handleNewMaterializationChange('nombre', value)}
                  required
                />
              </Col>
              
              <Col>
                <Select
                  label="Tipo de Materialización"
                  value={newMaterialization.tipo_materializacion}
                  onValueChange={(value) => handleNewMaterializationChange('tipo_materializacion', value)}
                  required
                >
                  <SelectItem value="database" icon={DatabaseIcon}>Base de Datos</SelectItem>
                  <SelectItem value="cloud_datalake" icon={CloudArrowUpIcon}>Data Lake Cloud</SelectItem>
                  <SelectItem value="local" icon={DocumentTextIcon}>Archivo Local</SelectItem>
                </Select>
              </Col>
              
              {newMaterialization.tipo_materializacion === 'database' && (
                <>
                  <Col>
                    <Select
                      label="Conexión de Base de Datos"
                      value={newMaterialization.connection_id}
                      onValueChange={(value) => handleNewMaterializationChange('connection_id', value)}
                      placeholder="Seleccione una conexión"
                      required
                    >
                      {dbConnections.map(connection => (
                        <SelectItem key={connection.id} value={connection.id.toString()}>
                          {connection.nombre}
                        </SelectItem>
                      ))}
                      {dbConnections.length === 0 && (
                        <SelectItem value="none" disabled>
                          No hay conexiones disponibles
                        </SelectItem>
                      )}
                    </Select>
                  </Col>
                  
                  <Col>
                    <TextInput
                      label="Esquema"
                      placeholder="public"
                      value={newMaterialization.schema_destino}
                      onChange={(value) => handleNewMaterializationChange('schema_destino', value)}
                    />
                  </Col>
                </>
              )}
              
              {newMaterialization.tipo_materializacion === 'cloud_datalake' && (
                <>
                  <Col>
                    <Select
                      label="Proveedor de Nube"
                      value={newMaterialization.cloud_provider_id}
                      onValueChange={(value) => handleNewMaterializationChange('cloud_provider_id', value)}
                      placeholder="Seleccione un proveedor"
                      required
                    >
                      {cloudProviders.map(provider => (
                        <SelectItem key={provider.id} value={provider.id.toString()}>
                          {provider.nombre}
                        </SelectItem>
                      ))}
                      {cloudProviders.length === 0 && (
                        <SelectItem value="none" disabled>
                          No hay proveedores disponibles
                        </SelectItem>
                      )}
                    </Select>
                  </Col>
                  
                  <Col>
                    <Select
                      label="Formato de Datos"
                      value={newMaterialization.formato_destino}
                      onValueChange={(value) => handleNewMaterializationChange('formato_destino', value)}
                    >
                      <SelectItem value="parquet">Apache Parquet</SelectItem>
                      <SelectItem value="iceberg">Apache Iceberg</SelectItem>
                      <SelectItem value="hudi">Apache Hudi</SelectItem>
                    </Select>
                  </Col>
                </>
              )}
              
              <Col>
                <TextInput
                  label="Nombre de Tabla"
                  placeholder="tabla_destino"
                  value={newMaterialization.tabla_destino}
                  onChange={(value) => handleNewMaterializationChange('tabla_destino', value)}
                  required
                />
              </Col>
              
              <Col>
                <Select
                  label="Estrategia de Actualización"
                  value={newMaterialization.estrategia_actualizacion}
                  onValueChange={(value) => handleNewMaterializationChange('estrategia_actualizacion', value)}
                >
                  <SelectItem value="upsert">Upsert (Actualizar/Insertar)</SelectItem>
                  <SelectItem value="delete_insert">Delete + Insert</SelectItem>
                  <SelectItem value="append">Append Only (Solo Agregar)</SelectItem>
                  <SelectItem value="truncate_insert">Truncate + Insert</SelectItem>
                </Select>
              </Col>
              
              <Col>
                <TextInput
                  label="Clave Primaria"
                  placeholder="campo1,campo2"
                  value={newMaterialization.clave_primaria}
                  onChange={(value) => handleNewMaterializationChange('clave_primaria', value)}
                  helpText="Separar múltiples campos con comas"
                />
              </Col>
              
              <Col>
                <TextInput
                  label="Partición por"
                  placeholder="año,mes"
                  value={newMaterialization.particion_por}
                  onChange={(value) => handleNewMaterializationChange('particion_por', value)}
                  helpText="Campos para particionar datos (opcional)"
                />
              </Col>
              
              <Col numColSpan={2}>
                <div className="mt-4">
                  <Switch
                    id="activado"
                    name="activado"
                    checked={newMaterialization.activado}
                    onChange={(value) => handleNewMaterializationChange('activado', value)}
                    label="Activar materialización"
                  />
                </div>
              </Col>
            </Grid>
            
            <Flex justifyContent="end" className="mt-6">
              <Button
                variant="primary"
                onClick={createMaterialization}
              >
                Crear Materialización
              </Button>
            </Flex>
          </Card>
        )}
        
        {/* Lista de Materializaciones */}
        <Card>
          <Title>Materializaciones Configuradas</Title>
          {loadingMaterializations ? (
            <div className="text-center p-4">Cargando...</div>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Nombre</TableHeaderCell>
                  <TableHeaderCell>Tipo</TableHeaderCell>
                  <TableHeaderCell>Destino</TableHeaderCell>
                  <TableHeaderCell>Estrategia</TableHeaderCell>
                  <TableHeaderCell>Estado</TableHeaderCell>
                  <TableHeaderCell>Última Ejecución</TableHeaderCell>
                  <TableHeaderCell>Acciones</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {materializations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center">
                      <div className="py-8">
                        <Text className="text-lg text-gray-500">No hay materializaciones configuradas</Text>
                        <div className="mt-4">
                          <Button
                            variant="light"
                            size="md"
                            icon={PlusIcon}
                            onClick={() => setShowNewForm(true)}
                          >
                            Configurar nueva materialización
                          </Button>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  materializations.map((materializacion) => (
                    <TableRow key={materializacion.id}>
                      <TableCell>
                        <div className="font-medium">{materializacion.nombre}</div>
                        <div className="text-xs text-gray-500">ID: {materializacion.id}</div>
                      </TableCell>
                      <TableCell>
                        {materializacion.tipo_materializacion === 'database' && (
                          <Badge icon={DatabaseIcon} color="blue">Base de Datos</Badge>
                        )}
                        {materializacion.tipo_materializacion === 'cloud_datalake' && (
                          <Badge icon={CloudArrowUpIcon} color="purple">Data Lake</Badge>
                        )}
                        {materializacion.tipo_materializacion === 'local' && (
                          <Badge icon={DocumentTextIcon} color="green">Archivo Local</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {materializacion.tipo_materializacion === 'database' ? (
                          <div>
                            {materializacion.connection_name || `BD ${materializacion.connection_id}`}
                            <div className="text-xs text-gray-500">
                              {materializacion.schema_destino || 'public'}.{materializacion.tabla_destino}
                            </div>
                          </div>
                        ) : materializacion.tipo_materializacion === 'cloud_datalake' ? (
                          <div>
                            {materializacion.cloud_provider_name || `Nube ${materializacion.cloud_provider_id}`}
                            <div className="text-xs text-gray-500">
                              Formato: {materializacion.formato_destino?.toUpperCase() || 'PARQUET'}
                            </div>
                          </div>
                        ) : (
                          <div>
                            Archivo local
                            <div className="text-xs text-gray-500">
                              {materializacion.tabla_destino}.{materializacion.formato_destino || 'csv'}
                            </div>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge color="gray">
                          {materializacion.estrategia_actualizacion === 'upsert' && 'Upsert'}
                          {materializacion.estrategia_actualizacion === 'delete_insert' && 'Delete + Insert'}
                          {materializacion.estrategia_actualizacion === 'append' && 'Append Only'}
                          {materializacion.estrategia_actualizacion === 'truncate_insert' && 'Truncate + Insert'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge color={materializacion.activado ? 'green' : 'gray'}>
                          {materializacion.activado ? 'Activa' : 'Inactiva'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {materializacion.ultima_ejecucion 
                          ? new Date(materializacion.ultima_ejecucion).toLocaleString()
                          : 'Nunca ejecutada'
                        }
                      </TableCell>
                      <TableCell>
                        <Flex justifyContent="start" className="space-x-2">
                          <Button
                            size="xs"
                            variant="light"
                            color={materializacion.activado ? 'gray' : 'green'}
                            icon={materializacion.activado ? ExclamationCircleIcon : ArrowPathIcon}
                            onClick={() => handleToggleMaterialization(materializacion)}
                          >
                            {materializacion.activado ? 'Desactivar' : 'Activar'}
                          </Button>
                          <Button
                            size="xs"
                            variant="light"
                            color="red"
                            icon={TrashIcon}
                            onClick={() => handleDeleteMaterialization(materializacion)}
                          >
                            Eliminar
                          </Button>
                        </Flex>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
      
      <ConfirmDialog
        open={confirmOpen}
        title="Confirmar eliminación"
        message={`¿Está seguro que desea eliminar la materialización "${materializationToDelete?.nombre}"? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        onConfirm={confirmDeleteMaterialization}
        onCancel={() => {
          setMaterializationToDelete(null);
          setConfirmOpen(false);
        }}
      />
    </Layout>
  );
}