import { useState, useEffect } from 'react';
import Head from 'next/head';
import { 
  ChevronLeftIcon, 
  KeyIcon, 
  CloudIcon, 
  PlusIcon, 
  TrashIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  BeakerIcon
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import { toast } from 'react-toastify';
import { 
  Card, 
  Title, 
  Text, 
  Button, 
  TextInput, 
  Select, 
  SelectItem, 
  Grid, 
  Col, 
  Flex,
  Badge,
  Divider
} from '@tremor/react';

export default function CloudSecrets() {
  const [secrets, setSecrets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    nombre: '',
    tipo: 'minio',
    secretos: {
      access_key: '',
      secret_key: '',
      endpoint: '',
      bucket: '',
      region: ''
    }
  });
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionResult, setConnectionResult] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Para gestionar buckets
  const [selectedSecret, setSelectedSecret] = useState(null);
  const [buckets, setBuckets] = useState([]);
  const [loadingBuckets, setLoadingBuckets] = useState(false);
  const [bucketFormData, setBucketFormData] = useState({
    name: '',
    region: 'us-east-1',
    access: 'private'
  });
  const [creatingBucket, setCreatingBucket] = useState(false);

  // Cargar secretos al montar el componente
  useEffect(() => {
    fetchSecrets();
  }, []);

  // Función para obtener los secretos
  const fetchSecrets = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/cloud-secrets');
      const data = await response.json();
      
      if (data.success) {
        setSecrets(data.secrets || []);
      } else {
        toast.error(data.error || 'Error al cargar los secretos');
      }
    } catch (error) {
      console.error('Error fetching secrets:', error);
      toast.error('Error de conexión al obtener los secretos');
    } finally {
      setLoading(false);
    }
  };

  // Función para cambiar entre formulario y lista
  const toggleCreateForm = () => {
    setShowCreateForm(!showCreateForm);
    setEditing(false);
    setEditingId(null);
    setConnectionResult(null);
    
    // Resetear formulario
    setFormData({
      nombre: '',
      tipo: 'minio',
      secretos: {
        access_key: '',
        secret_key: '',
        endpoint: '',
        bucket: '',
        region: ''
      }
    });
  };

  // Manejar cambios en formulario
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData({
        ...formData,
        [parent]: {
          ...formData[parent],
          [child]: value
        }
      });
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
  };

  // Función para manejar la creación de un secreto
  const handleCreateSecret = async (e) => {
    e.preventDefault();
    
    try {
      const response = await fetch('/api/cloud-secrets', {
        method: editing ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(editing ? { ...formData, id: editingId } : formData)
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast.success(editing ? 'Secreto actualizado correctamente' : 'Secreto creado correctamente');
        toggleCreateForm();
        fetchSecrets();
      } else {
        toast.error(data.error || 'Error al guardar el secreto');
      }
    } catch (error) {
      console.error('Error saving secret:', error);
      toast.error('Error de conexión al guardar el secreto');
    }
  };

  // Función para probar la conexión
  const testConnection = async () => {
    setTestingConnection(true);
    setConnectionResult(null);
    
    try {
      let url = '/api/cloud-secrets/test';
      let method = 'POST';
      let payload = formData;
      
      // Si estamos editando, usamos el endpoint específico
      if (editing && editingId) {
        url = `/api/cloud-secrets/${editingId}/test`;
        method = 'POST';
        payload = { ...formData.secretos };
      }
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      const result = await response.json();
      setConnectionResult(result);
      
      if (result.success) {
        toast.success('Conexión exitosa');
      } else {
        toast.error(result.message || 'Error en la conexión');
      }
    } catch (error) {
      console.error('Error testing connection:', error);
      toast.error('Error de red al probar la conexión');
      setConnectionResult({
        success: false,
        message: 'Error de red al probar la conexión'
      });
    } finally {
      setTestingConnection(false);
    }
  };

  // Función para eliminar un secreto
  const deleteSecret = async (id) => {
    setDeletingId(id);
    
    try {
      const response = await fetch(`/api/cloud-secrets/${id}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast.success('Secreto eliminado correctamente');
        fetchSecrets();
      } else {
        toast.error(data.error || 'Error al eliminar el secreto');
      }
    } catch (error) {
      console.error('Error deleting secret:', error);
      toast.error('Error de conexión al eliminar el secreto');
    } finally {
      setDeletingId(null);
    }
  };

  // Función para editar un secreto
  const editSecret = (secret) => {
    // Parsear los secretos si vienen como string
    const parsedSecrets = typeof secret.secretos === 'string'
      ? JSON.parse(secret.secretos)
      : secret.secretos;
    
    setFormData({
      nombre: secret.nombre,
      tipo: secret.tipo,
      secretos: {
        access_key: parsedSecrets.access_key || '',
        secret_key: parsedSecrets.secret_key || '',
        endpoint: parsedSecrets.endpoint || '',
        bucket: parsedSecrets.bucket || '',
        region: parsedSecrets.region || ''
      }
    });
    
    setShowCreateForm(true);
    setEditing(true);
    setEditingId(secret.id);
    setConnectionResult(null);
  };

  // Función para mostrar los buckets de un secreto
  const showBuckets = async (secret) => {
    setSelectedSecret(secret);
    setLoadingBuckets(true);
    setBuckets([]);
    
    try {
      const response = await fetch(`/api/cloud-secrets/${secret.id}/buckets`);
      const data = await response.json();
      
      if (data.success) {
        setBuckets(data.buckets || []);
      } else {
        toast.error(data.error || 'Error al obtener los buckets');
      }
    } catch (error) {
      console.error('Error fetching buckets:', error);
      toast.error('Error de conexión al obtener los buckets');
    } finally {
      setLoadingBuckets(false);
    }
  };

  // Función para crear un bucket
  const createBucket = async (e) => {
    e.preventDefault();
    
    if (!selectedSecret) {
      toast.error('Debes seleccionar un secreto primero');
      return;
    }
    
    setCreatingBucket(true);
    
    try {
      const response = await fetch(`/api/cloud-secrets/${selectedSecret.id}/buckets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(bucketFormData)
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast.success(`Bucket ${bucketFormData.name} creado correctamente`);
        setBucketFormData({
          name: '',
          region: 'us-east-1',
          access: 'private'
        });
        // Recargar los buckets
        showBuckets(selectedSecret);
      } else {
        toast.error(data.error || 'Error al crear el bucket');
      }
    } catch (error) {
      console.error('Error creating bucket:', error);
      toast.error('Error de conexión al crear el bucket');
    } finally {
      setCreatingBucket(false);
    }
  };

  // Función para manejar cambios en el formulario de bucket
  const handleBucketInputChange = (e) => {
    const { name, value } = e.target;
    setBucketFormData({
      ...bucketFormData,
      [name]: value
    });
  };

  return (
    <>
      <Head>
        <title>Secretos de Nube | SAGE</title>
      </Head>
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/admin/clouds" className="inline-flex items-center text-blue-600 hover:text-blue-800">
            <ChevronLeftIcon className="h-5 w-5 mr-1" />
            Volver a Administración de Nubes
          </Link>
        </div>
        
        <Title>Gestión de Secretos de Nube</Title>
        <Text className="mb-4">Administra las credenciales para diferentes proveedores de nube</Text>
        
        {!showCreateForm && !selectedSecret ? (
          <>
            <div className="mb-6">
              <Button
                icon={PlusIcon}
                onClick={toggleCreateForm}
                className="mt-4"
              >
                Crear nuevo secreto
              </Button>
            </div>
            
            {loading ? (
              <p>Cargando secretos...</p>
            ) : (
              <Grid numItemsMd={2} numItemsLg={3} className="gap-6 mt-6">
                {secrets.length === 0 ? (
                  <Col numColSpan={3}>
                    <Card className="text-center p-6">
                      <CloudIcon className="h-12 w-12 mx-auto text-gray-400" />
                      <Text className="mt-2">No hay secretos configurados</Text>
                      <Button
                        onClick={toggleCreateForm}
                        icon={PlusIcon}
                        className="mt-4"
                      >
                        Crear el primer secreto
                      </Button>
                    </Card>
                  </Col>
                ) : (
                  secrets.map(secret => {
                    // Determinar el tipo de secreto para mostrar un icono adecuado
                    let icon = CloudIcon;
                    let tipoBadge = "gray";
                    
                    if (secret.tipo === 'minio') {
                      tipoBadge = "orange";
                    } else if (secret.tipo === 's3') {
                      tipoBadge = "amber";
                    } else if (secret.tipo === 'azure') {
                      tipoBadge = "blue";
                    } else if (secret.tipo === 'gcp') {
                      tipoBadge = "indigo";
                    } else if (secret.tipo === 'sftp') {
                      tipoBadge = "green";
                    }
                    
                    return (
                      <Card key={secret.id} className="p-4 relative">
                        <div className="absolute top-2 right-2">
                          <Badge color={tipoBadge}>
                            {secret.tipo.toUpperCase()}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center mb-4">
                          <KeyIcon className="h-8 w-8 text-gray-500 mr-3" />
                          <div>
                            <Title className="text-lg">{secret.nombre}</Title>
                            <Text className="text-xs">{`ID: ${secret.id}`}</Text>
                          </div>
                        </div>
                        
                        <Divider />
                        
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button
                            variant="secondary"
                            size="xs"
                            onClick={() => editSecret(secret)}
                          >
                            Editar
                          </Button>
                          
                          <Button
                            variant="secondary"
                            size="xs"
                            color="blue"
                            onClick={() => showBuckets(secret)}
                          >
                            Ver Buckets
                          </Button>
                          
                          <Button
                            variant="secondary"
                            size="xs"
                            color="red"
                            icon={TrashIcon}
                            onClick={() => deleteSecret(secret.id)}
                            loading={deletingId === secret.id}
                            disabled={deletingId === secret.id}
                          >
                            Eliminar
                          </Button>
                        </div>
                      </Card>
                    );
                  })
                )}
              </Grid>
            )}
          </>
        ) : selectedSecret ? (
          // Vista de administración de buckets
          <Card className="mt-6">
            <div className="mb-4">
              <Button
                variant="secondary"
                size="xs"
                icon={ChevronLeftIcon}
                onClick={() => setSelectedSecret(null)}
              >
                Volver a Secretos
              </Button>
            </div>
            
            <Title>Buckets para {selectedSecret.nombre}</Title>
            <Text>Administra los buckets disponibles para este secreto</Text>
            
            <div className="mt-6">
              <Card className="bg-gray-50">
                <Title className="text-base">Crear Nuevo Bucket</Title>
                
                <form onSubmit={createBucket} className="mt-4">
                  <Grid numItemsMd={3} className="gap-4">
                    <TextInput
                      name="name"
                      placeholder="Nombre del bucket"
                      value={bucketFormData.name}
                      onChange={handleBucketInputChange}
                      required
                    />
                    
                    <Select
                      name="region"
                      value={bucketFormData.region}
                      onChange={handleBucketInputChange}
                    >
                      <SelectItem value="us-east-1">US East (N. Virginia)</SelectItem>
                      <SelectItem value="us-east-2">US East (Ohio)</SelectItem>
                      <SelectItem value="us-west-1">US West (N. California)</SelectItem>
                      <SelectItem value="us-west-2">US West (Oregon)</SelectItem>
                      <SelectItem value="sa-east-1">South America (São Paulo)</SelectItem>
                      <SelectItem value="eu-west-1">EU (Ireland)</SelectItem>
                      <SelectItem value="eu-central-1">EU (Frankfurt)</SelectItem>
                    </Select>
                    
                    <Select
                      name="access"
                      value={bucketFormData.access}
                      onChange={handleBucketInputChange}
                    >
                      <SelectItem value="private">Privado</SelectItem>
                      <SelectItem value="public-read">Público (lectura)</SelectItem>
                      <SelectItem value="public-read-write">Público (lectura/escritura)</SelectItem>
                    </Select>
                  </Grid>
                  
                  <div className="mt-4">
                    <Button
                      type="submit"
                      loading={creatingBucket}
                      disabled={creatingBucket || !bucketFormData.name}
                    >
                      {creatingBucket ? 'Creando...' : 'Crear Bucket'}
                    </Button>
                  </div>
                </form>
              </Card>
            </div>
            
            <div className="mt-6">
              <Card>
                <Title className="text-base">Buckets Existentes</Title>
                
                {loadingBuckets ? (
                  <div className="py-4 text-center">
                    <Text>Cargando buckets...</Text>
                  </div>
                ) : buckets.length === 0 ? (
                  <div className="py-4 text-center">
                    <Text>No hay buckets disponibles</Text>
                  </div>
                ) : (
                  <div className="mt-4">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Nombre
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Región
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Fecha de Creación
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {buckets.map((bucket, index) => (
                            <tr key={index}>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">
                                  {bucket.name}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-500">
                                  {bucket.region || 'No especificada'}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-500">
                                  {bucket.creationDate 
                                    ? new Date(bucket.creationDate).toLocaleDateString() 
                                    : 'No disponible'}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          </Card>
        ) : (
          // Formulario de creación/edición
          <Card className="mt-6">
            <div className="mb-4">
              <Button
                variant="secondary"
                size="xs"
                icon={ChevronLeftIcon}
                onClick={toggleCreateForm}
              >
                Volver a la lista
              </Button>
            </div>
            
            <Title>{editing ? `Editar Secreto: ${formData.nombre}` : 'Crear Nuevo Secreto'}</Title>
            
            <form onSubmit={handleCreateSecret} className="mt-6">
              <Grid numItemsMd={2} className="gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nombre del Secreto
                  </label>
                  <TextInput
                    name="nombre"
                    placeholder="Nombre descriptivo"
                    value={formData.nombre}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tipo de Proveedor
                  </label>
                  <Select
                    name="tipo"
                    value={formData.tipo}
                    onChange={handleInputChange}
                  >
                    <SelectItem value="minio">MinIO</SelectItem>
                    <SelectItem value="s3">Amazon S3</SelectItem>
                    <SelectItem value="azure">Azure Blob Storage</SelectItem>
                    <SelectItem value="gcp">Google Cloud Storage</SelectItem>
                    <SelectItem value="sftp">SFTP</SelectItem>
                  </Select>
                </div>
              </Grid>
              
              <div className="mt-6">
                <Title className="text-base">Detalles de Credenciales</Title>
                
                <Grid numItemsMd={2} className="gap-6 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Access Key
                    </label>
                    <TextInput
                      name="secretos.access_key"
                      placeholder="Access Key ID"
                      value={formData.secretos.access_key}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Secret Key
                    </label>
                    <TextInput
                      name="secretos.secret_key"
                      placeholder="Secret Access Key"
                      value={formData.secretos.secret_key}
                      onChange={handleInputChange}
                      required
                      type="password"
                    />
                  </div>
                  
                  {formData.tipo === 'minio' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Endpoint
                        </label>
                        <TextInput
                          name="secretos.endpoint"
                          placeholder="Por ejemplo: play.min.io:9000"
                          value={formData.secretos.endpoint}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Bucket predeterminado
                        </label>
                        <TextInput
                          name="secretos.bucket"
                          placeholder="Nombre del bucket (opcional)"
                          value={formData.secretos.bucket}
                          onChange={handleInputChange}
                        />
                      </div>
                    </>
                  )}
                  
                  {formData.tipo === 's3' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Región
                      </label>
                      <Select
                        name="secretos.region"
                        value={formData.secretos.region}
                        onChange={handleInputChange}
                      >
                        <SelectItem value="us-east-1">US East (N. Virginia)</SelectItem>
                        <SelectItem value="us-east-2">US East (Ohio)</SelectItem>
                        <SelectItem value="us-west-1">US West (N. California)</SelectItem>
                        <SelectItem value="us-west-2">US West (Oregon)</SelectItem>
                        <SelectItem value="sa-east-1">South America (São Paulo)</SelectItem>
                        <SelectItem value="eu-west-1">EU (Ireland)</SelectItem>
                        <SelectItem value="eu-central-1">EU (Frankfurt)</SelectItem>
                      </Select>
                    </div>
                  )}
                </Grid>
              </div>
              
              {connectionResult && (
                <div className={`mt-6 p-4 rounded-lg ${connectionResult.success ? 'bg-green-50' : 'bg-red-50'}`}>
                  <Flex>
                    {connectionResult.success ? (
                      <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />
                    ) : (
                      <ExclamationCircleIcon className="h-5 w-5 text-red-500 mr-2" />
                    )}
                    <Text className={connectionResult.success ? 'text-green-700' : 'text-red-700'}>
                      {connectionResult.message}
                    </Text>
                  </Flex>
                </div>
              )}
              
              <div className="mt-6 flex gap-4">
                <Button
                  type="button"
                  variant="secondary"
                  icon={BeakerIcon}
                  onClick={testConnection}
                  loading={testingConnection}
                  disabled={testingConnection}
                >
                  Probar Conexión
                </Button>
                
                <Button
                  type="submit"
                >
                  {editing ? 'Actualizar Secreto' : 'Crear Secreto'}
                </Button>
              </div>
            </form>
          </Card>
        )}
      </div>
    </>
  );
}