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
  Flex
} from '@tremor/react';
import {
  PencilIcon,
  TrashIcon,
  DocumentTextIcon,
  PlusIcon,
  DatabaseIcon
} from '@heroicons/react/24/outline';
import ConfirmDialog from '@/components/ConfirmDialog';
import Breadcrumbs from '@/components/Breadcrumbs';
import { toast } from 'react-toastify';

export default function CasillasPage() {
  const router = useRouter();
  const [casillas, setCasillas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [casillaToDelete, setCasillaToDelete] = useState(null);

  useEffect(() => {
    fetchCasillas();
  }, []);

  const fetchCasillas = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/casillas');
      if (!response.ok) throw new Error('Error al cargar casillas');
      const data = await response.json();
      setCasillas(data);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar las casillas');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (id) => {
    router.push(`/admin/casillas/${id}`);
  };

  const handleDelete = (casilla) => {
    setCasillaToDelete(casilla);
    setConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!casillaToDelete) return;
    
    try {
      const response = await fetch(`/api/admin/casillas/${casillaToDelete.id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al eliminar la casilla');
      }
      
      setCasillas(casillas.filter(c => c.id !== casillaToDelete.id));
      toast.success('Casilla eliminada correctamente');
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.message || 'Error al eliminar la casilla');
    } finally {
      setCasillaToDelete(null);
      setConfirmOpen(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      Activo: 'green',
      Inactivo: 'gray',
      Pendiente: 'yellow',
      Error: 'red'
    };
    
    return <Badge color={statusMap[status] || 'blue'}>{status}</Badge>;
  };

  return (
    <Layout>
      <div className="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-9xl mx-auto">
        <Breadcrumbs items={[
          { label: 'Admin', href: '/admin' },
          { label: 'Casillas', current: true }
        ]} />
        
        <div className="sm:flex sm:justify-between sm:items-center mb-8">
          <Title>Casillas</Title>
          <div className="grid grid-flow-col sm:auto-cols-max justify-start sm:justify-end gap-2">
            <Button 
              variant="primary" 
              icon={PlusIcon}
              onClick={() => router.push('/admin/casillas/new')}
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
                  <TableHeaderCell>ID</TableHeaderCell>
                  <TableHeaderCell>Nombre</TableHeaderCell>
                  <TableHeaderCell>Descripción</TableHeaderCell>
                  <TableHeaderCell>Estado</TableHeaderCell>
                  <TableHeaderCell>Acciones</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {casillas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center">
                      <div className="py-8">
                        <Text className="text-lg text-gray-500">No hay casillas configuradas</Text>
                        <div className="mt-4">
                          <Button
                            variant="light"
                            size="lg"
                            icon={PlusIcon}
                            onClick={() => router.push('/admin/casillas/new')}
                          >
                            Configurar nueva casilla
                          </Button>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  casillas.map((casilla) => (
                    <TableRow key={casilla.id}>
                      <TableCell>{casilla.id}</TableCell>
                      <TableCell>
                        <div className="font-medium">{casilla.nombre}</div>
                      </TableCell>
                      <TableCell>
                        {casilla.descripcion || '-'}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(casilla.estado || 'Activo')}
                      </TableCell>
                      <TableCell>
                        <Flex justifyContent="start" className="space-x-2">
                          <Button
                            size="xs"
                            variant="secondary"
                            icon={PencilIcon}
                            onClick={() => handleEdit(casilla.id)}
                          >
                            Editar
                          </Button>
                          <Button
                            size="xs"
                            variant="light"
                            color="amber"
                            icon={DocumentTextIcon}
                            onClick={() => router.push(`/admin/casillas/${casilla.id}/yaml`)}
                          >
                            YAML
                          </Button>
                          <Button
                            size="xs"
                            variant="light"
                            color="purple"
                            icon={DatabaseIcon}
                            onClick={() => router.push(`/admin/casillas/${casilla.id}/materialization`)}
                          >
                            Materialización
                          </Button>
                          <Button
                            size="xs"
                            variant="light"
                            color="red"
                            icon={TrashIcon}
                            onClick={() => handleDelete(casilla)}
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
        message={`¿Está seguro que desea eliminar la casilla "${casillaToDelete?.nombre}"? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        onConfirm={confirmDelete}
        onCancel={() => {
          setCasillaToDelete(null);
          setConfirmOpen(false);
        }}
      />
    </Layout>
  );
}