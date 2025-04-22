import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import {
  Card,
  Title,
  Text,
  Badge,
  Table,
  TableHead,
  TableRow,
  TableHeaderCell,
  TableBody,
  TableCell,
  Button,
  Metric,
  Grid,
  Col,
  Flex,
  Select,
  SelectItem,
  TextInput
} from '@tremor/react';
import {
  PencilIcon,
  TrashIcon,
  PlusIcon,
  DatabaseIcon,
  CloudIcon,
  DocumentTextIcon,
  ServerIcon,
  ArrowPathIcon,
  AdjustmentsHorizontalIcon
} from '@heroicons/react/24/outline';
import ConfirmDialog from '@/components/ConfirmDialog';
import Breadcrumbs from '@/components/Breadcrumbs';
import { toast } from 'react-toastify';

export default function MaterializationsPage() {
  const router = useRouter();
  const [materializations, setMaterializations] = useState([]);
  const [filteredMaterializations, setFilteredMaterializations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [materializationToDelete, setMaterializationToDelete] = useState(null);
  
  // Filtros
  const [filters, setFilters] = useState({
    casillaId: 'todas',
    tipo: 'todos',
    estado: 'todos',
    search: ''
  });
  
  // Stats
  const [stats, setStats] = useState({
    total: 0,
    activas: 0,
    baseDatos: 0,
    dataLake: 0,
    local: 0
  });

  useEffect(() => {
    fetchMaterializations();
  }, []);
  
  // Efecto para aplicar filtros
  useEffect(() => {
    if (!materializations.length) return;
    
    let filtered = [...materializations];
    
    // Filtrar por casilla
    if (filters.casillaId !== 'todas') {
      filtered = filtered.filter(m => m.casilla_id === parseInt(filters.casillaId));
    }
    
    // Filtrar por tipo
    if (filters.tipo !== 'todos') {
      filtered = filtered.filter(m => m.tipo_materializacion === filters.tipo);
    }
    
    // Filtrar por estado
    if (filters.estado !== 'todos') {
      filtered = filtered.filter(m => {
        if (filters.estado === 'activo') return m.activado;
        if (filters.estado === 'inactivo') return !m.activado;
        return true;
      });
    }
    
    // Buscar por texto
    if (filters.search) {
      const searchText = filters.search.toLowerCase();
      filtered = filtered.filter(m => 
        m.nombre.toLowerCase().includes(searchText) ||
        m.nombre_casilla?.toLowerCase().includes(searchText) ||
        m.tabla_destino?.toLowerCase().includes(searchText)
      );
    }
    
    setFilteredMaterializations(filtered);
  }, [filters, materializations]);

  const fetchMaterializations = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/materializations');
      if (!response.ok) throw new Error('Error al cargar materializaciones');
      const data = await response.json();
      setMaterializations(data);
      setFilteredMaterializations(data);
      
      // Calcular estadísticas
      const statsData = {
        total: data.length,
        activas: data.filter(m => m.activado).length,
        baseDatos: data.filter(m => m.tipo_materializacion === 'database').length,
        dataLake: data.filter(m => m.tipo_materializacion === 'cloud_datalake').length,
        local: data.filter(m => m.tipo_materializacion === 'local').length
      };
      setStats(statsData);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar las materializaciones');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (id) => {
    router.push(`/admin/materializations/${id}`);
  };

  const handleDelete = (materialization) => {
    setMaterializationToDelete(materialization);
    setConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!materializationToDelete) return;
    
    try {
      const response = await fetch(`/api/admin/materializations/${materializationToDelete.id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al eliminar la materialización');
      }
      
      setMaterializations(materializations.filter(m => m.id !== materializationToDelete.id));
      toast.success('Materialización eliminada correctamente');
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.message || 'Error al eliminar la materialización');
    } finally {
      setMaterializationToDelete(null);
      setConfirmOpen(false);
    }
  };
  
  const toggleMaterialization = async (materialization) => {
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
        const error = await response.json();
        throw new Error(error.message);
      }
      
      // Actualizar el estado en la lista
      const updatedMaterializations = materializations.map(m => {
        if (m.id === materialization.id) {
          return { ...m, activado: newStatus };
        }
        return m;
      });
      
      setMaterializations(updatedMaterializations);
      toast.success(`Materialización ${newStatus ? 'activada' : 'desactivada'} correctamente`);
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.message || `Error al ${materialization.activado ? 'desactivar' : 'activar'} la materialización`);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'database':
        return <DatabaseIcon className="h-5 w-5 text-blue-500" />;
      case 'cloud_datalake':
        return <CloudIcon className="h-5 w-5 text-purple-500" />;
      case 'local':
        return <DocumentTextIcon className="h-5 w-5 text-green-500" />;
      default:
        return <AdjustmentsHorizontalIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  // Obtener lista única de casillas para el filtro
  const casillas = materializations.reduce((acc, m) => {
    if (m.nombre_casilla && !acc.some(c => c.id === m.casilla_id)) {
      acc.push({ id: m.casilla_id, nombre: m.nombre_casilla });
    }
    return acc;
  }, []);

  return (
    <Layout>
      <div className="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-9xl mx-auto">
        <Breadcrumbs items={[
          { label: 'Admin', href: '/admin' },
          { label: 'Materializaciones', current: true }
        ]} />
        
        <div className="sm:flex sm:justify-between sm:items-center mb-8">
          <Title>Materializaciones</Title>
          <div className="mt-4 sm:mt-0 flex space-x-3">
            <Button 
              variant="secondary" 
              icon={ServerIcon}
              onClick={() => router.push('/admin/materialization-servers')}
            >
              Servidores
            </Button>
            <Button 
              variant="secondary" 
              icon={DatabaseIcon}
              onClick={() => router.push('/admin/database-connections')}
            >
              Conexiones BD
            </Button>
          </div>
        </div>

        <Grid numCols={1} numColsMd={2} numColsLg={5} className="gap-6 mb-6">
          <Col>
            <Card decoration="top" decorationColor="blue">
              <Flex justifyContent="start" className="space-x-4">
                <DatabaseIcon className="w-8 h-8 text-blue-500" />
                <div>
                  <Text>Total</Text>
                  <Metric>{stats.total}</Metric>
                </div>
              </Flex>
            </Card>
          </Col>
          
          <Col>
            <Card decoration="top" decorationColor="green">
              <Flex justifyContent="start" className="space-x-4">
                <ArrowPathIcon className="w-8 h-8 text-green-500" />
                <div>
                  <Text>Activas</Text>
                  <Metric>{stats.activas}</Metric>
                </div>
              </Flex>
            </Card>
          </Col>
          
          <Col>
            <Card decoration="top" decorationColor="indigo">
              <Flex justifyContent="start" className="space-x-4">
                <ServerIcon className="w-8 h-8 text-indigo-500" />
                <div>
                  <Text>Base de Datos</Text>
                  <Metric>{stats.baseDatos}</Metric>
                </div>
              </Flex>
            </Card>
          </Col>
          
          <Col>
            <Card decoration="top" decorationColor="purple">
              <Flex justifyContent="start" className="space-x-4">
                <CloudIcon className="w-8 h-8 text-purple-500" />
                <div>
                  <Text>Data Lake</Text>
                  <Metric>{stats.dataLake}</Metric>
                </div>
              </Flex>
            </Card>
          </Col>
          
          <Col>
            <Card decoration="top" decorationColor="amber">
              <Flex justifyContent="start" className="space-x-4">
                <DocumentTextIcon className="w-8 h-8 text-amber-500" />
                <div>
                  <Text>Local</Text>
                  <Metric>{stats.local}</Metric>
                </div>
              </Flex>
            </Card>
          </Col>
        </Grid>

        <Card className="mb-6">
          <Flex className="space-x-2 flex-col sm:flex-row space-y-2 sm:space-y-0">
            <Select
              value={filters.casillaId}
              onValueChange={(value) => handleFilterChange('casillaId', value)}
              placeholder="Casilla"
            >
              <SelectItem value="todas">Todas las casillas</SelectItem>
              {casillas.map(casilla => (
                <SelectItem key={casilla.id} value={casilla.id.toString()}>
                  {casilla.nombre}
                </SelectItem>
              ))}
            </Select>
            
            <Select
              value={filters.tipo}
              onValueChange={(value) => handleFilterChange('tipo', value)}
              placeholder="Tipo"
            >
              <SelectItem value="todos">Todos los tipos</SelectItem>
              <SelectItem value="database">Base de datos</SelectItem>
              <SelectItem value="cloud_datalake">Data Lake Cloud</SelectItem>
              <SelectItem value="local">Archivo Local</SelectItem>
            </Select>
            
            <Select
              value={filters.estado}
              onValueChange={(value) => handleFilterChange('estado', value)}
              placeholder="Estado"
            >
              <SelectItem value="todos">Todos los estados</SelectItem>
              <SelectItem value="activo">Activas</SelectItem>
              <SelectItem value="inactivo">Inactivas</SelectItem>
            </Select>
            
            <TextInput
              value={filters.search}
              onChange={(value) => handleFilterChange('search', value)}
              placeholder="Buscar por nombre..."
              className="flex-grow"
            />
          </Flex>
        </Card>

        <Card>
          {loading ? (
            <div className="text-center p-4">Cargando...</div>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Nombre</TableHeaderCell>
                  <TableHeaderCell>Casilla</TableHeaderCell>
                  <TableHeaderCell>Tipo</TableHeaderCell>
                  <TableHeaderCell>Destino</TableHeaderCell>
                  <TableHeaderCell>Última Ejecución</TableHeaderCell>
                  <TableHeaderCell>Estado</TableHeaderCell>
                  <TableHeaderCell>Acciones</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredMaterializations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center">
                      <div className="py-8">
                        <Text className="text-lg text-gray-500">No hay materializaciones que coincidan con los filtros</Text>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMaterializations.map((materialization) => (
                    <TableRow key={materialization.id}>
                      <TableCell>
                        <div className="font-medium">{materialization.nombre}</div>
                        <div className="text-xs text-gray-500">ID: {materialization.id}</div>
                      </TableCell>
                      <TableCell>
                        {materialization.nombre_casilla || `Casilla ${materialization.casilla_id}`}
                      </TableCell>
                      <TableCell>
                        <Flex justifyContent="start" className="space-x-2">
                          {getTypeIcon(materialization.tipo_materializacion)}
                          <div>
                            {materialization.tipo_materializacion === 'database' && 'Base de Datos'}
                            {materialization.tipo_materializacion === 'cloud_datalake' && 'Data Lake Cloud'}
                            {materialization.tipo_materializacion === 'local' && 'Archivo Local'}
                          </div>
                        </Flex>
                      </TableCell>
                      <TableCell>
                        {materialization.tipo_materializacion === 'database' ? (
                          <div>
                            <Badge color="blue">
                              {materialization.connection_name || `Conexión ${materialization.connection_id}`}
                            </Badge>
                            <div className="text-xs mt-1">
                              {materialization.schema_destino || 'public'}.{materialization.tabla_destino}
                            </div>
                          </div>
                        ) : (
                          <Badge color={materialization.tipo_materializacion === 'cloud_datalake' ? 'purple' : 'green'}>
                            {materialization.formato_destino?.toUpperCase() || 'PARQUET'}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {materialization.ultima_ejecucion ? 
                          new Date(materialization.ultima_ejecucion).toLocaleString() : 
                          'Nunca ejecutada'}
                      </TableCell>
                      <TableCell>
                        <Badge color={materialization.activado ? 'green' : 'gray'}>
                          {materialization.activado ? 'Activa' : 'Inactiva'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Flex justifyContent="start" className="space-x-2">
                          <Button
                            size="xs"
                            variant="secondary"
                            icon={PencilIcon}
                            onClick={() => handleEdit(materialization.id)}
                          >
                            Editar
                          </Button>
                          <Button
                            size="xs"
                            variant="light"
                            color={materialization.activado ? 'gray' : 'green'}
                            icon={ArrowPathIcon}
                            onClick={() => toggleMaterialization(materialization)}
                          >
                            {materialization.activado ? 'Desactivar' : 'Activar'}
                          </Button>
                          <Button
                            size="xs"
                            variant="light"
                            color="red"
                            icon={TrashIcon}
                            onClick={() => handleDelete(materialization)}
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
        onConfirm={confirmDelete}
        onCancel={() => {
          setMaterializationToDelete(null);
          setConfirmOpen(false);
        }}
      />
    </Layout>
  );
}