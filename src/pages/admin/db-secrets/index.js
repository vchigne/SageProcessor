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

const tipoServidorLabel = {
  postgresql: 'PostgreSQL',
  mysql: 'MySQL',
  sqlserver: 'SQL Server',
  duckdb: 'DuckDB'
};

export default function DBSecretsList() {
  const router = useRouter();
  const [dbSecrets, setDBSecrets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [secretToDelete, setSecretToDelete] = useState(null);

  useEffect(() => {
    fetchDBSecrets();
  }, []);

  const fetchDBSecrets = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/db-secrets');
      if (!response.ok) throw new Error('Error al cargar secretos de bases de datos');
      const data = await response.json();
      setDBSecrets(data);
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
      
      if (!response.ok) throw new Error('Error al eliminar el secreto');
      
      setDBSecrets(dbSecrets.filter(s => s.id !== secretToDelete.id));
      toast.success('Secreto eliminado correctamente');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al eliminar el secreto');
    } finally {
      setSecretToDelete(null);
      setConfirmOpen(false);
    }
  };

  return (
    <Layout>
      <div className="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-9xl mx-auto">
        <Breadcrumbs items={[
          { label: 'Admin', href: '/admin' },
          { label: 'Secretos de Bases de Datos', current: true }
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

        <Card>
          {loading ? (
            <div className="text-center p-4">Cargando...</div>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Nombre</TableHeaderCell>
                  <TableHeaderCell>Tipo</TableHeaderCell>
                  <TableHeaderCell>Descripción</TableHeaderCell>
                  <TableHeaderCell>Estado</TableHeaderCell>
                  <TableHeaderCell>Creado</TableHeaderCell>
                  <TableHeaderCell>Acciones</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {dbSecrets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center">
                      No hay secretos de bases de datos configurados
                    </TableCell>
                  </TableRow>
                ) : (
                  dbSecrets.map((secret) => (
                    <TableRow key={secret.id}>
                      <TableCell>{secret.nombre}</TableCell>
                      <TableCell>
                        <Badge color="blue">
                          {tipoServidorLabel[secret.tipo_servidor] || secret.tipo_servidor}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Text truncate>{secret.descripcion || 'Sin descripción'}</Text>
                      </TableCell>
                      <TableCell>
                        <Badge color={secret.activo ? 'green' : 'gray'}>
                          {secret.activo ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {secret.creado_en ? format(new Date(secret.creado_en), 'dd/MM/yyyy') : 'N/A'}
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
        message={`¿Está seguro que desea eliminar el secreto "${secretToDelete?.nombre}"? Esta acción no se puede deshacer.`}
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