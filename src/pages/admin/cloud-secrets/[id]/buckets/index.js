import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { 
  Card, Title, Text, Button, TextInput, 
  Grid, Col, Badge, Flex, Divider,
  Table, TableHead, TableHeaderCell, TableBody, TableRow, TableCell
} from '@tremor/react';
import { ArrowLeftIcon, PlusIcon, CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { toast } from 'react-toastify';
import AdminLayout from '@/components/layouts/AdminLayout';

/**
 * Página para administrar buckets asociados a un Cloud Secret específico
 */
export default function AdminCloudSecretBuckets() {
  const router = useRouter();
  const { id } = router.query;
  
  const [secreto, setSecreto] = useState(null);
  const [buckets, setBuckets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creatingBucket, setCreatingBucket] = useState(false);
  const [newBucketName, setNewBucketName] = useState('');
  const [error, setError] = useState(null);
  
  // Cargar detalles del secreto y buckets cuando cambia el ID
  useEffect(() => {
    if (id) {
      loadSecretDetails();
      loadBuckets();
    }
  }, [id]);
  
  // Cargar detalles del secreto
  const loadSecretDetails = async () => {
    try {
      const response = await fetch(`/api/cloud-secrets/${id}`);
      const data = await response.json();
      
      if (!response.ok) {
        setError(data.message || 'Error al cargar los detalles del secreto');
        return;
      }
      
      setSecreto(data);
      setError(null);
    } catch (error) {
      console.error('Error al cargar detalles del secreto:', error);
      setError('Error de conexión al cargar detalles del secreto');
    }
  };
  
  // Cargar lista de buckets
  const loadBuckets = async () => {
    if (!id) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/cloud-secrets/${id}/buckets`);
      const data = await response.json();
      
      if (!response.ok) {
        setBuckets([]);
        setError(data.message || 'Error al cargar los buckets');
        return;
      }
      
      console.log('Buckets recibidos:', data);
      setBuckets(data.data || []);
      setError(null);
    } catch (error) {
      console.error('Error al cargar buckets:', error);
      setError('Error de conexión al cargar buckets');
      setBuckets([]);
    } finally {
      setLoading(false);
    }
  };
  
  // Crear un nuevo bucket
  const handleCreateBucket = async (e) => {
    e.preventDefault();
    
    if (!newBucketName.trim()) {
      toast.error('El nombre del bucket es requerido');
      return;
    }
    
    setCreatingBucket(true);
    try {
      const response = await fetch(`/api/cloud-secrets/${id}/buckets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ bucketName: newBucketName.trim() })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        toast.error(data.message || 'Error al crear el bucket');
        return;
      }
      
      toast.success(`Bucket "${newBucketName}" creado con éxito`);
      setNewBucketName('');
      loadBuckets(); // Recargar la lista de buckets
    } catch (error) {
      console.error('Error al crear bucket:', error);
      toast.error('Error de conexión al crear el bucket');
    } finally {
      setCreatingBucket(false);
    }
  };
  
  // Formatear el tipo de proveedor para mostrar (nombre amigable)
  const formatProviderType = (type) => {
    const types = {
      's3': 'Amazon S3',
      'minio': 'MinIO',
      'azure': 'Azure Blob Storage',
      'gcp': 'Google Cloud Storage',
      'sftp': 'SFTP'
    };
    
    return types[type] || type;
  };
  
  // Obtener el color del badge según el tipo de proveedor
  const getProviderColor = (type) => {
    const colors = {
      's3': 'orange',
      'minio': 'blue',
      'azure': 'blue',
      'gcp': 'green',
      'sftp': 'purple'
    };
    
    return colors[type] || 'gray';
  };
  
  return (
    <AdminLayout>
      <Card className="mt-4">
        <div className="flex justify-between items-center mb-4">
          <Link href="/admin/cloud-secrets" className="flex items-center text-blue-600 hover:text-blue-800">
            <ArrowLeftIcon className="h-4 w-4 mr-1" />
            <span>Volver a Cloud Secrets</span>
          </Link>
          
          {secreto && (
            <Badge color={getProviderColor(secreto.tipo)}>
              {formatProviderType(secreto.tipo)}
            </Badge>
          )}
        </div>
        
        <Title>Gestión de Buckets</Title>
        {secreto && (
          <Text className="mt-2 mb-4">
            Secreto: <span className="font-semibold">{secreto.nombre}</span>
          </Text>
        )}
        
        <Divider />
        
        <Grid numItems={1} numItemsMd={2} className="gap-6 mt-6">
          <Col>
            <Card decoration="top" decorationColor="blue">
              <Title className="text-xl">Buckets Existentes</Title>
              
              {loading ? (
                <div className="py-4 text-center">Cargando buckets...</div>
              ) : error ? (
                <div className="py-4 text-center text-red-500 flex items-center justify-center">
                  <ExclamationCircleIcon className="h-5 w-5 mr-2" />
                  {error}
                </div>
              ) : (
                <div className="mt-4">
                  {buckets.length === 0 ? (
                    <div className="py-4 text-center text-gray-500">
                      No se encontraron buckets
                    </div>
                  ) : (
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableHeaderCell>Nombre del Bucket</TableHeaderCell>
                          <TableHeaderCell>Acciones</TableHeaderCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {buckets.map((bucket, index) => (
                          <TableRow key={bucket.name || index}>
                            <TableCell>{bucket.name}</TableCell>
                            <TableCell>
                              <Button 
                                size="xs" 
                                variant="secondary"
                                onClick={() => router.push(`/admin/cloud-secrets/${id}/buckets/${encodeURIComponent(bucket.name)}`)}
                              >
                                Ver contenido
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                  
                  <div className="mt-4 flex justify-end">
                    <Button 
                      size="sm"
                      variant="light"
                      color="blue"
                      icon={CheckCircleIcon}
                      onClick={loadBuckets}
                      loading={loading}
                      disabled={loading}
                    >
                      Actualizar lista
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </Col>
          
          <Col>
            <Card decoration="top" decorationColor="green">
              <Title className="text-xl">Crear Nuevo Bucket</Title>
              
              <form onSubmit={handleCreateBucket} className="mt-4">
                <div className="mb-4">
                  <Text className="mb-2">Nombre del bucket</Text>
                  <TextInput
                    placeholder="Escriba el nombre del bucket"
                    value={newBucketName}
                    onChange={(e) => setNewBucketName(e.target.value)}
                    disabled={creatingBucket}
                    required
                  />
                  <Text className="mt-1 text-xs text-gray-500">
                    El nombre del bucket debe ser único y no contener caracteres especiales.
                  </Text>
                </div>
                
                <div className="flex justify-between">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setNewBucketName('rawmondelezperustrategiotradicional')}
                    disabled={creatingBucket}
                  >
                    Usar bucket predefinido
                  </Button>
                  
                  <Button
                    type="submit"
                    color="green"
                    icon={PlusIcon}
                    loading={creatingBucket}
                    disabled={creatingBucket || !newBucketName.trim()}
                  >
                    Crear Bucket
                  </Button>
                </div>
              </form>
            </Card>
          </Col>
        </Grid>
      </Card>
    </AdminLayout>
  );
}