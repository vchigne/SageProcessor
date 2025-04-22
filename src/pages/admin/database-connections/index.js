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
  Grid,
  Col,
  Metric,
  Flex
} from '@tremor/react';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  DatabaseIcon,
  ServerIcon,
  LinkIcon
} from '@heroicons/react/24/outline';
import ConfirmDialog from '@/components/ConfirmDialog';
import Breadcrumbs from '@/components/Breadcrumbs';
import { format } from 'date-fns';
import { toast } from 'react-toastify';

export default function DatabaseConnectionsPage() {
  const router = useRouter();
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [connectionToDelete, setConnectionToDelete] = useState(null);

  useEffect(() => {
    fetchConnections();
  }, []);

  const fetchConnections = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/database-connections');
      if (!response.ok) throw new Error('Error al cargar conexiones');
      const data = await response.json();
      setConnections(data);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar las conexiones de bases de datos');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (id) => {
    router.push(`/admin/database-connections/${id}`);
  };

  const handleDelete = (connection) => {
    setConnectionToDelete(connection);
    setConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!connectionToDelete) return;
    
    try {
      const response = await fetch(`/api/admin/database-connections/${connectionToDelete.id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al eliminar la conexión');
      }
      
      setConnections(connections.filter(c => c.id !== connectionToDelete.id));
      toast.success('Conexión eliminada correctamente');
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.message || 'Error al eliminar la conexión');
    } finally {
      setConnectionToDelete(null);
      setConfirmOpen(false);
    }
  };

  const getServerTypeBadge = (type) => {
    switch (type) {
      case 'postgresql':
        return <Badge color="blue">PostgreSQL</Badge>;
      case 'mysql':
        return <Badge color="orange">MySQL</Badge>;
      case 'sqlserver':
        return <Badge color="indigo">SQL Server</Badge>;
      case 'duckdb':
        return <Badge color="green">DuckDB</Badge>;
      default:
        return <Badge color="gray">{type}</Badge>;
    }
  };

  // Estadísticas básicas
  const activeConnections = connections.filter(c => c.activo).length;
  const dbTypes = {};
  connections.forEach(conn => {
    dbTypes[conn.tipo_servidor] = (dbTypes[conn.tipo_servidor] || 0) + 1;
  });

  return (
    <Layout>
      <div className="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-9xl mx-auto">
        <Breadcrumbs items={[
          { label: 'Admin', href: '/admin' },
          { label: 'Materializaciones', href: '/admin/materializations' },
          { label: 'Conexiones BD', current: true }
        ]} />
        
        <div className="sm:flex sm:justify-between sm:items-center mb-8">
          <Title>Conexiones a Bases de Datos</Title>
          <div className="grid grid-flow-col sm:auto-cols-max justify-start sm:justify-end gap-2">
            <Button 
              variant="primary" 
              icon={PlusIcon}
              onClick={() => router.push('/admin/database-connections/new')}
            >
              Agregar Nueva
            </Button>
          </div>
        </div>

        <Grid numCols={1} numColsSm={2} numColsLg={3} className="gap-6 mb-6">
          <Col>
            <Card decoration="top" decorationColor="blue">
              <Flex justifyContent="start" className="space-x-4">
                <DatabaseIcon className="w-8 h-8 text-blue-500" />
                <div>
                  <Text>Conexiones Activas</Text>
                  <Metric>{activeConnections} de {connections.length}</Metric>
                </div>
              </Flex>
            </Card>
          </Col>
          
          <Col>
            <Card decoration="top" decorationColor="orange">
              <Flex justifyContent="start" className="space-x-4">
                <ServerIcon className="w-8 h-8 text-orange-500" />
                <div>
                  <Text>Tipos de Bases de Datos</Text>
                  <Metric>{Object.keys(dbTypes).length}</Metric>
                </div>
              </Flex>
            </Card>
          </Col>
          
          <Col numColSpanSm={2} numColSpanLg={1}>
            <Card decoration="top" decorationColor="green">
              <Flex justifyContent="start" className="space-x-4">
                <LinkIcon className="w-8 h-8 text-green-500" />
                <div>
                  <Text>Tablas Materializadas</Text>
                  <Metric>{connections.reduce((acc, conn) => acc + (conn.table_count || 0), 0)}</Metric>
                </div>
              </Flex>
            </Card>
          </Col>
        </Grid>

        <Card>
          {loading ? (
            <div className="text-center p-4">Cargando...</div>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Nombre</TableHeaderCell>
                  <TableHeaderCell>Base de Datos</TableHeaderCell>
                  <TableHeaderCell>Servidor</TableHeaderCell>
                  <TableHeaderCell>Secret</TableHeaderCell>
                  <TableHeaderCell>Tablas</TableHeaderCell>
                  <TableHeaderCell>Estado</TableHeaderCell>
                  <TableHeaderCell>Acciones</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {connections.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center">
                      <div className="py-8">
                        <Text className="text-lg text-gray-500">No hay conexiones a bases de datos configuradas</Text>
                        <div className="mt-4">
                          <Button
                            variant="light"
                            size="lg"
                            icon={PlusIcon}
                            onClick={() => router.push('/admin/database-connections/new')}
                          >
                            Configurar nueva conexión
                          </Button>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  connections.map((connection) => (
                    <TableRow key={connection.id}>
                      <TableCell>
                        <div className="font-medium">{connection.nombre}</div>
                        {connection.descripcion && (
                          <div className="text-gray-500 text-xs truncate max-w-xs">{connection.descripcion}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{connection.database || '-'}</div>
                        {connection.schema && (
                          <div className="text-gray-500 text-xs">Schema: {connection.schema}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        {getServerTypeBadge(connection.tipo_servidor)}
                      </TableCell>
                      <TableCell>
                        {connection.secret_name || '-'}
                      </TableCell>
                      <TableCell>
                        {connection.table_count || 0}
                      </TableCell>
                      <TableCell>
                        <Badge color={connection.activo ? 'green' : 'gray'}>
                          {connection.activo ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            size="xs"
                            variant="secondary"
                            icon={PencilIcon}
                            onClick={() => handleEdit(connection.id)}
                          >
                            Editar
                          </Button>
                          <Button
                            size="xs"
                            variant="light"
                            color="red"
                            icon={TrashIcon}
                            onClick={() => handleDelete(connection)}
                          >
                            Eliminar
                          </Button>
                        </div>
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
        message={`¿Está seguro que desea eliminar la conexión "${connectionToDelete?.nombre}"? Esta acción no se puede deshacer y podría afectar las materializaciones asociadas.`}
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        onConfirm={confirmDelete}
        onCancel={() => {
          setConnectionToDelete(null);
          setConfirmOpen(false);
        }}
      />
    </Layout>
  );
}