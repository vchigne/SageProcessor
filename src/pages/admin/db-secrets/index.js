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
  ServerIcon, 
  KeyIcon, 
  DatabaseIcon, 
  LockClosedIcon 
} from '@heroicons/react/24/outline';
import ConfirmDialog from '@/components/ConfirmDialog';
import Breadcrumbs from '@/components/Breadcrumbs';
import { format } from 'date-fns';
import { toast } from 'react-toastify';

export default function DBSecretsPage() {
  const router = useRouter();
  const [secrets, setSecrets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [secretToDelete, setSecretToDelete] = useState(null);

  useEffect(() => {
    fetchSecrets();
  }, []);

  const fetchSecrets = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/db-secrets');
      if (!response.ok) throw new Error('Error al cargar secretos');
      const data = await response.json();
      setSecrets(data);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar los secretos de bases de datos');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (id) => {
    router.push(`/admin/db-secrets/${id}`);
  };

  const handleDelete = (secret) => {
    setSecretToDelete(secret);
    setConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!secretToDelete) return;
    
    try {
      const response = await fetch(`/api/admin/db-secrets/${secretToDelete.id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al eliminar el secreto');
      }
      
      setSecrets(secrets.filter(s => s.id !== secretToDelete.id));
      toast.success('Secreto eliminado correctamente');
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.message || 'Error al eliminar el secreto');
    } finally {
      setSecretToDelete(null);
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
  const activeSecrets = secrets.filter(s => s.activo).length;
  const dbTypes = {};
  secrets.forEach(secret => {
    dbTypes[secret.tipo_servidor] = (dbTypes[secret.tipo_servidor] || 0) + 1;
  });

  return (
    <Layout>
      <div className="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-9xl mx-auto">
        <Breadcrumbs items={[
          { label: 'Admin', href: '/admin' },
          { label: 'Materializaciones', href: '/admin/materializations' },
          { label: 'Secretos de BD', current: true }
        ]} />
        
        <div className="sm:flex sm:justify-between sm:items-center mb-8">
          <Title>Secretos de Bases de Datos</Title>
          <div className="grid grid-flow-col sm:auto-cols-max justify-start sm:justify-end gap-2">
            <Button 
              variant="primary" 
              icon={PlusIcon}
              onClick={() => router.push('/admin/db-secrets/new')}
            >
              Agregar Nuevo
            </Button>
          </div>
        </div>

        <Grid numCols={1} numColsSm={2} numColsLg={3} className="gap-6 mb-6">
          <Col>
            <Card decoration="top" decorationColor="blue">
              <Flex justifyContent="start" className="space-x-4">
                <KeyIcon className="w-8 h-8 text-blue-500" />
                <div>
                  <Text>Secretos Activos</Text>
                  <Metric>{activeSecrets} de {secrets.length}</Metric>
                </div>
              </Flex>
            </Card>
          </Col>
          
          <Col>
            <Card decoration="top" decorationColor="orange">
              <Flex justifyContent="start" className="space-x-4">
                <DatabaseIcon className="w-8 h-8 text-orange-500" />
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
                <LockClosedIcon className="w-8 h-8 text-green-500" />
                <div>
                  <Text>Seguridad</Text>
                  <Metric>Activada</Metric>
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
                  <TableHeaderCell>Tipo de Servidor</TableHeaderCell>
                  <TableHeaderCell>Bases de Datos</TableHeaderCell>
                  <TableHeaderCell>Fecha de Creación</TableHeaderCell>
                  <TableHeaderCell>Estado</TableHeaderCell>
                  <TableHeaderCell>Acciones</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {secrets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center">
                      <div className="py-8">
                        <Text className="text-lg text-gray-500">No hay secretos de bases de datos configurados</Text>
                        <div className="mt-4">
                          <Button
                            variant="light"
                            size="lg"
                            icon={PlusIcon}
                            onClick={() => router.push('/admin/db-secrets/new')}
                          >
                            Configurar nuevo secreto
                          </Button>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  secrets.map((secret) => (
                    <TableRow key={secret.id}>
                      <TableCell>
                        <div className="font-medium">{secret.nombre}</div>
                        {secret.descripcion && (
                          <div className="text-gray-500 text-xs truncate max-w-xs">{secret.descripcion}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        {getServerTypeBadge(secret.tipo_servidor)}
                      </TableCell>
                      <TableCell>
                        {secret.database_count || 0}
                      </TableCell>
                      <TableCell>
                        {secret.fecha_creacion && format(new Date(secret.fecha_creacion), 'dd/MM/yyyy HH:mm')}
                      </TableCell>
                      <TableCell>
                        <Badge color={secret.activo ? 'green' : 'gray'}>
                          {secret.activo ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            size="xs"
                            variant="secondary"
                            icon={PencilIcon}
                            onClick={() => handleEdit(secret.id)}
                          >
                            Editar
                          </Button>
                          <Button
                            size="xs"
                            variant="light"
                            color="red"
                            icon={TrashIcon}
                            onClick={() => handleDelete(secret)}
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
        message={`¿Está seguro que desea eliminar el secreto "${secretToDelete?.nombre}"? Esta acción no se puede deshacer y podría afectar las bases de datos asociadas.`}
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        onConfirm={confirmDelete}
        onCancel={() => {
          setSecretToDelete(null);
          setConfirmOpen(false);
        }}
      />
    </Layout>
  );
}