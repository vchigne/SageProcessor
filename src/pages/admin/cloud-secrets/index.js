import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { toast } from 'react-toastify';
import { 
  KeyIcon, 
  PlusCircleIcon, 
  TrashIcon, 
  PencilIcon, 
  CheckCircleIcon, 
  XCircleIcon,
  ExclamationCircleIcon,
  ArrowPathIcon,
  CloudIcon
} from '@heroicons/react/24/outline';
import { Metric, Text, Title, Subtitle, Badge, Button, Card, Table } from '@tremor/react';

// Estado inicial para un nuevo secreto
const initialSecretState = {
  nombre: '',
  descripcion: '',
  tipo: 'minio',
  secretos: {},
  activo: true
};

// Tipos de proveedores soportados
const providerTypes = [
  { value: 's3', label: 'Amazon S3' },
  { value: 'azure', label: 'Azure Blob Storage' },
  { value: 'gcp', label: 'Google Cloud Storage' },
  { value: 'sftp', label: 'SFTP' },
  { value: 'minio', label: 'MinIO' }
];

// Esquemas de credenciales para cada tipo de proveedor
const credentialSchemas = {
  's3': [
    { name: 'access_key', label: 'Access Key ID', type: 'text', required: true },
    { name: 'secret_key', label: 'Secret Access Key', type: 'password', required: true },
    { name: 'region', label: 'Región', type: 'text', required: false, default: 'us-east-1' }
  ],
  'azure': [
    { name: 'connection_string', label: 'Connection String', type: 'password', required: true },
    { name: 'container_name', label: 'Nombre del Container (opcional)', type: 'text', required: false }
  ],
  'gcp': [
    { name: 'key_file', label: 'Archivo de Clave JSON', type: 'textarea', required: true }
  ],
  'sftp': [
    { name: 'host', label: 'Hostname', type: 'text', required: true },
    { name: 'port', label: 'Puerto', type: 'number', required: false, default: '22' },
    { name: 'user', label: 'Usuario', type: 'text', required: true },
    { name: 'password', label: 'Contraseña', type: 'password', required: false },
    { name: 'key_path', label: 'Ruta a Clave SSH', type: 'text', required: false }
  ],
  'minio': [
    { name: 'endpoint', label: 'Endpoint', type: 'text', required: true },
    { name: 'access_key', label: 'Access Key', type: 'text', required: true },
    { name: 'secret_key', label: 'Secret Key', type: 'password', required: true },
    { name: 'secure', label: 'Usar SSL', type: 'checkbox', required: false, default: true }
  ]
};

export default function CloudSecrets() {
  const router = useRouter();
  const [secrets, setSecrets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [currentSecret, setCurrentSecret] = useState(initialSecretState);
  const [isEditing, setIsEditing] = useState(false);
  const [testingId, setTestingId] = useState(null);
  const [showBucketDialog, setShowBucketDialog] = useState(false);
  const [currentSecretId, setCurrentSecretId] = useState(null);
  const [bucketName, setBucketName] = useState('');
  const [loadingBuckets, setLoadingBuckets] = useState(false);
  const [buckets, setBuckets] = useState([]);

  // Cargar secretos
  useEffect(() => {
    fetchSecrets();
  }, []);

  // Obtener todos los secretos
  const fetchSecrets = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/cloud-secrets');
      if (!response.ok) throw new Error('Error al cargar secretos de nube');
      const data = await response.json();
      
      setSecrets(data);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar secretos de nube: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Manejar cambios en los campos del formulario
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name.includes('.')) {
      // Manejar propiedades anidadas (secretos.property)
      const [obj, prop] = name.split('.');
      setCurrentSecret(prev => ({
        ...prev,
        [obj]: {
          ...prev[obj],
          [prop]: type === 'checkbox' ? checked : value
        }
      }));
    } else {
      // Manejar propiedades directas
      setCurrentSecret(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }));
    }
  };

  // Manejar cambio de tipo de proveedor
  const handleProviderTypeChange = (e) => {
    const tipo = e.target.value;
    
    // Inicializar campos de credenciales específicos para este tipo
    const secretosIniciales = {};
    
    credentialSchemas[tipo].forEach(field => {
      if (field.default !== undefined) {
        secretosIniciales[field.name] = field.default;
      }
    });
    
    setCurrentSecret(prev => ({
      ...prev,
      tipo,
      secretos: secretosIniciales
    }));
  };

  // Función para validar el formulario
  const validateForm = () => {
    if (!currentSecret.nombre.trim()) {
      toast.error('El nombre del secreto es obligatorio');
      return false;
    }

    if (!currentSecret.tipo) {
      toast.error('El tipo de proveedor es obligatorio');
      return false;
    }

    // Validar credenciales obligatorias
    const requiredCredentials = credentialSchemas[currentSecret.tipo]
      .filter(cred => cred.required)
      .map(cred => cred.name);

    for (const credential of requiredCredentials) {
      if (!currentSecret.secretos[credential]) {
        toast.error(`La credencial ${credential} es obligatoria`);
        return false;
      }
    }

    return true;
  };

  // Resetear formulario
  const resetForm = () => {
    setCurrentSecret(initialSecretState);
    setIsEditing(false);
    setShowForm(false);
  };

  // Guardar un secreto (crear o actualizar)
  const saveSecret = async () => {
    if (!validateForm()) return;

    try {
      const url = isEditing 
        ? `/api/cloud-secrets/${currentSecret.id}` 
        : '/api/cloud-secrets';
      
      const method = isEditing ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentSecret)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al guardar el secreto');
      }

      toast.success(`Secreto ${isEditing ? 'actualizado' : 'creado'} correctamente`);
      resetForm();
      fetchSecrets();
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.message);
    }
  };

  // Editar un secreto
  const editSecret = async (secret) => {
    try {
      // Cargar los detalles completos del secreto desde la API
      const response = await fetch(`/api/cloud-secrets/${secret.id}`);
      if (!response.ok) throw new Error('Error al cargar detalles del secreto');
      
      const secretoCompleto = await response.json();
      
      // Asegurarse de que las credenciales sean un objeto
      const secretos = typeof secretoCompleto.secretos === 'string'
        ? JSON.parse(secretoCompleto.secretos)
        : (secretoCompleto.secretos || {});
      
      setCurrentSecret({
        ...secretoCompleto,
        secretos: secretos
      });
      
      setIsEditing(true);
      setShowForm(true);
    } catch (error) {
      console.error('Error al obtener detalles del secreto:', error);
      toast.error(`Error al editar: ${error.message}`);
    }
  };

  // Eliminar un secreto
  const deleteSecret = async (id) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este secreto?')) {
      return;
    }

    try {
      const response = await fetch(`/api/cloud-secrets/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al eliminar el secreto');
      }

      toast.success('Secreto eliminado correctamente');
      fetchSecrets();
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.message);
    }
  };

  // Probar un secreto
  const testSecret = async (id) => {
    try {
      setTestingId(id);
      
      const response = await fetch(`/api/cloud-secrets/${id}/test`, {
        method: 'POST'
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast.success('Conexión exitosa');
      } else {
        toast.error(`Error de conexión: ${result.message}`);
      }
      
      // Actualizar la lista para reflejar el nuevo estado
      fetchSecrets();
    } catch (error) {
      console.error('Error:', error);
      toast.error(`Error al probar la conexión: ${error.message}`);
    } finally {
      setTestingId(null);
    }
  };

  // Mostrar diálogo para gestionar buckets
  const showBucketsManager = async (secretId) => {
    setCurrentSecretId(secretId);
    setBucketName('');
    setShowBucketDialog(true);
    await fetchBuckets(secretId);
  };

  // Obtener buckets de un secreto
  const fetchBuckets = async (secretId) => {
    try {
      setLoadingBuckets(true);
      const response = await fetch(`/api/cloud-secrets/${secretId}/buckets`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al obtener buckets');
      }
      
      const data = await response.json();
      console.log('Buckets recibidos:', data);
      setBuckets(data.data || []);
    } catch (error) {
      console.error('Error al obtener buckets:', error);
      toast.error(`Error al obtener buckets: ${error.message}`);
      setBuckets([]);
    } finally {
      setLoadingBuckets(false);
    }
  };

  // Crear un nuevo bucket
  const createBucket = async () => {
    if (!bucketName.trim()) {
      toast.error('El nombre del bucket es obligatorio');
      return;
    }

    try {
      const response = await fetch(`/api/cloud-secrets/${currentSecretId}/buckets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucketName })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al crear bucket');
      }

      toast.success(`Bucket ${bucketName} creado correctamente`);
      setBucketName('');
      await fetchBuckets(currentSecretId);
    } catch (error) {
      console.error('Error al crear bucket:', error);
      toast.error(`Error al crear bucket: ${error.message}`);
    }
  };

  return (
    <>
      <Head>
        <title>SAGE Cloud - Gestión de Secretos</title>
      </Head>
      
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <Title>Gestión de Secretos de Nube</Title>
            <Text>Administra las credenciales para conexiones a proveedores de almacenamiento en la nube</Text>
          </div>
          <div className="flex space-x-3">
            <Button 
              icon={CloudIcon} 
              onClick={() => router.push('/admin/clouds')}
              color="cyan"
            >
              Gestionar Proveedores
            </Button>
            <Button 
              icon={PlusCircleIcon} 
              onClick={() => setShowForm(!showForm)}
              color="indigo"
            >
              {showForm ? 'Cancelar' : 'Nuevo Secreto'}
            </Button>
          </div>
        </div>
        
        {showForm && (
          <Card className="mb-6">
            <Subtitle className="mb-4">
              {isEditing ? 'Editar Secreto' : 'Nuevo Secreto de Nube'}
            </Subtitle>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre del Secreto*
                </label>
                <input
                  type="text"
                  name="nombre"
                  value={currentSecret.nombre}
                  onChange={handleInputChange}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  placeholder="Nombre descriptivo"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Proveedor*
                </label>
                <select
                  name="tipo"
                  value={currentSecret.tipo}
                  onChange={handleProviderTypeChange}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  required
                >
                  {providerTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción
                </label>
                <textarea
                  name="descripcion"
                  value={currentSecret.descripcion || ''}
                  onChange={handleInputChange}
                  rows="2"
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  placeholder="Descripción opcional"
                />
              </div>
            </div>
            
            <div className="mb-6">
              <Subtitle className="mb-3">Credenciales</Subtitle>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {credentialSchemas[currentSecret.tipo].map((field) => (
                  <div key={field.name}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {field.label} {field.required && '*'}
                    </label>
                    {field.type === 'textarea' ? (
                      <textarea
                        name={`secretos.${field.name}`}
                        value={currentSecret.secretos[field.name] || ''}
                        onChange={handleInputChange}
                        rows="4"
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        required={field.required}
                      />
                    ) : field.type === 'checkbox' ? (
                      <input
                        type="checkbox"
                        name={`secretos.${field.name}`}
                        checked={!!currentSecret.secretos[field.name]}
                        onChange={handleInputChange}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                      />
                    ) : (
                      <input
                        type={field.type}
                        name={`secretos.${field.name}`}
                        value={currentSecret.secretos[field.name] || ''}
                        onChange={handleInputChange}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        required={field.required}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex justify-end space-x-3">
              <Button
                color="gray"
                onClick={resetForm}
              >
                Cancelar
              </Button>
              <Button
                color="indigo"
                onClick={saveSecret}
              >
                {isEditing ? 'Actualizar Secreto' : 'Crear Secreto'}
              </Button>
            </div>
          </Card>
        )}
        
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
          </div>
        ) : secrets.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <KeyIcon className="mx-auto h-16 w-16 text-gray-400" />
            <h3 className="mt-2 text-lg font-medium text-gray-900">No hay secretos configurados</h3>
            <p className="mt-1 text-sm text-gray-500">
              Comienza agregando un nuevo secreto para conectarte a servicios de almacenamiento en la nube.
            </p>
            <div className="mt-6">
              <Button
                icon={PlusCircleIcon}
                onClick={() => setShowForm(true)}
                color="indigo"
              >
                Nuevo Secreto
              </Button>
            </div>
          </div>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Nombre
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tipo
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estado
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {secrets.map((secret) => (
                    <tr key={secret.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center bg-blue-100 rounded-full">
                            <KeyIcon className="h-6 w-6 text-blue-600" />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{secret.nombre}</div>
                            <div className="text-sm text-gray-500">{secret.descripcion}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                          {providerTypes.find(t => t.value === secret.tipo)?.label || secret.tipo}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge color={secret.activo ? "green" : "red"}>
                          {secret.activo ? "Activo" : "Inactivo"}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-3">
                          {['minio', 's3', 'azure', 'gcp', 'sftp'].includes(secret.tipo) && (
                            <Link href={`/admin/cloud-secrets/${secret.id}/buckets`}>
                              <Button 
                                icon={CloudIcon}
                                variant="light"
                                color="blue"
                                size="xs"
                              >
                                Buckets
                              </Button>
                            </Link>
                          )}
                          <Button 
                            icon={CheckCircleIcon}
                            variant="light"
                            color="amber"
                            onClick={() => testSecret(secret.id)}
                            size="xs"
                            loading={testingId === secret.id}
                          >
                            Probar
                          </Button>
                          <Button 
                            icon={PencilIcon}
                            variant="light"
                            color="indigo"
                            onClick={() => editSecret(secret)}
                            size="xs"
                          >
                            Editar
                          </Button>
                          <Button 
                            icon={TrashIcon}
                            variant="light"
                            color="red"
                            onClick={() => deleteSecret(secret.id)}
                            size="xs"
                          >
                            Eliminar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {/* Modal para gestión de buckets */}
      {showBucketDialog && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                      Gestión de Buckets
                    </h3>
                    
                    <div className="mt-2 mb-4">
                      <div className="flex space-x-2">
                        <input
                          type="text"
                          className="flex-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                          placeholder="Nombre del nuevo bucket"
                          value={bucketName}
                          onChange={(e) => setBucketName(e.target.value)}
                        />
                        <Button
                          onClick={createBucket}
                          color="indigo"
                          size="sm"
                        >
                          Crear
                        </Button>
                      </div>
                    </div>
                    
                    <div className="mt-4">
                      <h4 className="text-md font-medium text-gray-700 mb-2">Buckets existentes</h4>
                      {loadingBuckets ? (
                        <div className="flex justify-center py-4">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500"></div>
                        </div>
                      ) : buckets.length === 0 ? (
                        <div className="text-sm text-gray-500 py-2">
                          No hay buckets disponibles
                        </div>
                      ) : (
                        <ul className="divide-y divide-gray-200">
                          {buckets.map((bucket, index) => (
                            <li key={index} className="py-2 flex justify-between items-center">
                              <span className="text-sm font-medium text-gray-900">{bucket}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <Button
                  color="gray"
                  onClick={() => setShowBucketDialog(false)}
                >
                  Cerrar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}