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
  Col
} from '@tremor/react';
import { PlusIcon, ClockIcon, DocumentCheckIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import Breadcrumbs from '@/components/Breadcrumbs';
import { format } from 'date-fns';
import { toast } from 'react-toastify';

export default function MaterializationsPage() {
  const router = useRouter();
  const [materializations, setMaterializations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMaterializations();
  }, []);

  const fetchMaterializations = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/materializations');
      if (!response.ok) throw new Error('Error al cargar materializaciones');
      const data = await response.json();
      setMaterializations(data);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar las materializaciones');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'completado':
        return <Badge color="green">Completado</Badge>;
      case 'error':
        return <Badge color="red">Error</Badge>;
      case 'analizado':
        return <Badge color="blue">Analizado</Badge>;
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
          { label: 'Materializaciones', current: true }
        ]} />
        
        <div className="sm:flex sm:justify-between sm:items-center mb-8">
          <Title>Materializaciones</Title>
        </div>

        <Grid numCols={1} className="gap-6 mb-6">
          <Col>
            <Card className="p-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
                <div>
                  <Title className="text-xl">Gestión de Materializaciones</Title>
                  <Text className="mt-2">
                    En esta sección puede gestionar las materializaciones de datos a diferentes destinos.
                    Las materializaciones permiten convertir datos procesados en estructuras optimizadas
                    para consulta, tanto en sistemas de nube como en bases de datos relacionales.
                  </Text>
                </div>
                <div className="mt-4 md:mt-0 flex flex-col space-y-2">
                  <Button
                    variant="secondary"
                    icon={InformationCircleIcon}
                    onClick={() => router.push('/admin/materialization-servers')}
                  >
                    Servidores de Materialización
                  </Button>
                </div>
              </div>
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
                  <TableHeaderCell>Casilla</TableHeaderCell>
                  <TableHeaderCell>Nombre</TableHeaderCell>
                  <TableHeaderCell>Estado</TableHeaderCell>
                  <TableHeaderCell>Última Materialización</TableHeaderCell>
                  <TableHeaderCell>Tablas</TableHeaderCell>
                  <TableHeaderCell>Destinos</TableHeaderCell>
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
                            size="lg"
                            icon={PlusIcon}
                            onClick={() => router.push('/admin/data-boxes')}
                          >
                            Configurar nueva materialización
                          </Button>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  materializations.map((mat) => (
                    <TableRow key={mat.id}>
                      <TableCell>
                        <div className="font-medium">{mat.casilla_nombre}</div>
                        <div className="text-gray-500 text-xs">ID: {mat.casilla_id}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{mat.nombre}</div>
                        {mat.descripcion && (
                          <div className="text-gray-500 text-xs truncate max-w-xs">{mat.descripcion}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(mat.estado)}
                      </TableCell>
                      <TableCell>
                        {mat.ultima_materializacion ? (
                          <div className="flex items-center">
                            <ClockIcon className="h-4 w-4 mr-1 text-gray-500" />
                            {format(new Date(mat.ultima_materializacion), 'dd/MM/yyyy HH:mm')}
                          </div>
                        ) : (
                          <span className="text-gray-500">Nunca</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge color="blue">{mat.tablas_count || 0}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge color="purple">{mat.destinos_count || 0}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            size="xs"
                            variant="secondary"
                            icon={DocumentCheckIcon}
                            onClick={() => router.push(`/admin/materializations/${mat.id}`)}
                          >
                            Gestionar
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
    </Layout>
  );
}