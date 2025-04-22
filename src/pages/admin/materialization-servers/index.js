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
  Flex,
  ProgressBar
} from '@tremor/react';
import { 
  PlusIcon, 
  PencilIcon, 
  TrashIcon, 
  ServerIcon, 
  ArrowPathIcon, 
  InformationCircleIcon 
} from '@heroicons/react/24/outline';
import ConfirmDialog from '@/components/ConfirmDialog';
import Breadcrumbs from '@/components/Breadcrumbs';
import { format } from 'date-fns';
import { toast } from 'react-toastify';

export default function MaterializationServersPage() {
  const router = useRouter();
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [testingServer, setTestingServer] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [serverToDelete, setServerToDelete] = useState(null);

  useEffect(() => {
    fetchServers();
  }, []);

  const fetchServers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/materialization-servers');
      if (!response.ok) throw new Error('Error al cargar servidores');
      const data = await response.json();
      setServers(data);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar los servidores de materialización');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (id) => {
    router.push(`/admin/materialization-servers/${id}`);
  };

  const handleDelete = (server) => {
    setServerToDelete(server);
    setConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!serverToDelete) return;
    
    try {
      const response = await fetch(`/api/admin/materialization-servers/${serverToDelete.id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) throw new Error('Error al eliminar el servidor');
      
      setServers(servers.filter(s => s.id !== serverToDelete.id));
      toast.success('Servidor eliminado correctamente');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al eliminar el servidor');
    } finally {
      setServerToDelete(null);
      setConfirmOpen(false);
    }
  };

  const testServer = async (id) => {
    setTestingServer(id);
    
    try {
      const response = await fetch(`/api/admin/materialization-servers/${id}/test`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al probar el servidor');
      }
      
      const result = await response.json();
      
      // Actualizar el servidor en la lista con los resultados
      setServers(servers.map(server => 
        server.id === id ? { ...server, estado: result.estado, ultimo_test: result.ultimo_test } : server
      ));
      
      toast.success(`Prueba de servidor completada: ${result.estado}`);
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.message || 'Error al probar el servidor');
    } finally {
      setTestingServer(null);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'activo':
        return <Badge color="green">Activo</Badge>;
      case 'error':
        return <Badge color="red">Error</Badge>;
      case 'pendiente':
      default:
        return <Badge color="gray">Pendiente</Badge>;
    }
  };

  const getServerTypeBadge = (type) => {
    switch (type) {
      case 'local':
        return <Badge color="blue">Local</Badge>;
      case 'remote':
        return <Badge color="orange">Remoto</Badge>;
      case 'container':
        return <Badge color="indigo">Contenedor</Badge>;
      default:
        return <Badge color="gray">{type}</Badge>;
    }
  };

  // Calcular estadísticas
  const activeServers = servers.filter(s => s.estado === 'activo').length;
  const totalCapacity = servers.reduce((sum, server) => sum + (server.capacidad || 0), 0);
  const utilizationPercent = servers.length > 0 ? Math.min(100, Math.round((activeServers / servers.length) * 100)) : 0;

  return (
    <Layout>
      <div className="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-9xl mx-auto">
        <Breadcrumbs items={[
          { label: 'Admin', href: '/admin' },
          { label: 'Materializaciones', href: '/admin/materializations' },
          { label: 'Servidores', current: true }
        ]} />
        
        <div className="sm:flex sm:justify-between sm:items-center mb-8">
          <Title>Servidores de Materialización</Title>
          <div className="grid grid-flow-col sm:auto-cols-max justify-start sm:justify-end gap-2">
            <Button 
              variant="primary" 
              icon={PlusIcon}
              onClick={() => router.push('/admin/materialization-servers/new')}
            >
              Agregar Nuevo
            </Button>
          </div>
        </div>

        <Grid numCols={1} numColsSm={2} numColsLg={3} className="gap-6 mb-6">
          <Col>
            <Card decoration="top" decorationColor="blue">
              <Flex justifyContent="start" className="space-x-4">
                <ServerIcon className="w-8 h-8 text-blue-500" />
                <div>
                  <Text>Servidores Activos</Text>
                  <Metric>{activeServers} de {servers.length}</Metric>
                </div>
              </Flex>
              <ProgressBar value={utilizationPercent} color="blue" className="mt-3" />
            </Card>
          </Col>
          
          <Col>
            <Card decoration="top" decorationColor="amber">
              <Flex justifyContent="start" className="space-x-4">
                <InformationCircleIcon className="w-8 h-8 text-amber-500" />
                <div>
                  <Text>Capacidad Total</Text>
                  <Metric>{totalCapacity} operaciones/min</Metric>
                </div>
              </Flex>
            </Card>
          </Col>
          
          <Col numColSpanSm={2} numColSpanLg={1}>
            <Card decoration="top" decorationColor="green">
              <Flex justifyContent="start" className="space-x-4">
                <ArrowPathIcon className="w-8 h-8 text-green-500" />
                <div>
                  <Text>Estado del Sistema</Text>
                  <Metric>{activeServers > 0 ? 'Operativo' : 'Sin Servidores'}</Metric>
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
                  <TableHeaderCell>Tipo</TableHeaderCell>
                  <TableHeaderCell>Endpoint</TableHeaderCell>
                  <TableHeaderCell>Capacidad</TableHeaderCell>
                  <TableHeaderCell>Estado</TableHeaderCell>
                  <TableHeaderCell>Acciones</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {servers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center">
                      <div className="py-8">
                        <Text className="text-lg text-gray-500">No hay servidores configurados</Text>
                        <div className="mt-4">
                          <Button
                            variant="light"
                            size="lg"
                            icon={PlusIcon}
                            onClick={() => router.push('/admin/materialization-servers/new')}
                          >
                            Configurar nuevo servidor
                          </Button>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  servers.map((server) => (
                    <TableRow key={server.id}>
                      <TableCell>
                        <div className="font-medium">{server.nombre}</div>
                        {server.descripcion && (
                          <div className="text-gray-500 text-xs truncate max-w-xs">{server.descripcion}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        {getServerTypeBadge(server.tipo)}
                      </TableCell>
                      <TableCell>
                        <div className="font-mono text-xs truncate max-w-xs">
                          {server.endpoint}
                        </div>
                      </TableCell>
                      <TableCell>
                        {server.capacidad || 'N/A'} op/min
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          {getStatusBadge(server.estado)}
                          {server.ultimo_test && (
                            <Text className="text-xs text-gray-500 mt-1">
                              {format(new Date(server.ultimo_test), 'dd/MM/yyyy HH:mm')}
                            </Text>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            size="xs"
                            variant="secondary"
                            icon={ArrowPathIcon}
                            onClick={() => testServer(server.id)}
                            loading={testingServer === server.id}
                            disabled={testingServer !== null}
                          >
                            Probar
                          </Button>
                          <Button
                            size="xs"
                            variant="secondary"
                            icon={PencilIcon}
                            onClick={() => handleEdit(server.id)}
                          >
                            Editar
                          </Button>
                          <Button
                            size="xs"
                            variant="light"
                            color="red"
                            icon={TrashIcon}
                            onClick={() => handleDelete(server)}
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
        message={`¿Está seguro que desea eliminar el servidor "${serverToDelete?.nombre}"? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        onConfirm={confirmDelete}
        onCancel={() => {
          setServerToDelete(null);
          setConfirmOpen(false);
        }}
      />
    </Layout>
  );
}