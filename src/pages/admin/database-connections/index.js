import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import { 
  Card, 
  Title, 
  Text, 
  Button, 
  Badge,
  Table,
  TableHead,
  TableRow,
  TableHeaderCell,
  TableBody,
  TableCell
} from '@tremor/react';
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import ConfirmDialog from '@/components/ConfirmDialog';
import Breadcrumbs from '@/components/Breadcrumbs';
import { format } from 'date-fns';
import { toast } from 'react-toastify';

export default function DatabaseConnectionsList() {
  const router = useRouter();
  const [dbConnections, setDBConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [connectionToDelete, setConnectionToDelete] = useState(null);

  useEffect(() => {
    fetchDBConnections();
  }, []);

  const fetchDBConnections = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/database-connections');
      if (!response.ok) throw new Error('Error al cargar conexiones de bases de datos');
      const data = await response.json();
      setDBConnections(data);
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
      
      if (!response.ok) throw new Error('Error al eliminar la conexión');
      
      setDBConnections(dbConnections.filter(c => c.id !== connectionToDelete.id));
      toast.success('Conexión eliminada correctamente');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al eliminar la conexión');
    } finally {
      setConnectionToDelete(null);
      setConfirmOpen(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'activa':
        return <Badge color="green">Activa</Badge>;
      case 'error':
        return <Badge color="red">Error</Badge>;
      case 'pendiente':
      default:
        return <Badge color="gray">Pendiente</Badge>;
    }
  };

  return (
    <Layout>
      <div className="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-9xl mx-auto">
        <Breadcrumbs items={[
          { label: 'Admin', href: '/admin' },
          { label: 'Conexiones a Bases de Datos', current: true }
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
                  <TableHeaderCell>Estado</TableHeaderCell>
                  <TableHeaderCell>Último Test</TableHeaderCell>
                  <TableHeaderCell>Acciones</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {dbConnections.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center">
                      No hay conexiones a bases de datos configuradas
                    </TableCell>
                  </TableRow>
                ) : (
                  dbConnections.map((connection) => (
                    <TableRow key={connection.id}>
                      <TableCell>{connection.nombre}</TableCell>
                      <TableCell>
                        <div>
                          <Text>{connection.base_datos}</Text>
                          {connection.esquema && (
                            <Text className="text-xs text-gray-500">Esquema: {connection.esquema}</Text>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{connection.secret_nombre}</TableCell>
                      <TableCell>
                        {getStatusBadge(connection.estado_conexion)}
                      </TableCell>
                      <TableCell>
                        {connection.ultimo_test ? format(new Date(connection.ultimo_test), 'dd/MM/yyyy HH:mm') : 'Nunca'}
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
        message={`¿Está seguro que desea eliminar la conexión "${connectionToDelete?.nombre}"? Esta acción no se puede deshacer.`}
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