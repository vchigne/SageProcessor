import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { toast } from 'react-toastify';
import AdminLayout from '../../../components/layouts/AdminLayout';
import { 
  CloudIcon, 
  PlusCircleIcon, 
  TrashIcon, 
  PencilIcon, 
  CheckCircleIcon, 
  XCircleIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { Metric, Text, Title, Subtitle, Badge, Button, Card, Table } from '@tremor/react';

// Estado inicial para un nuevo proveedor
const initialProviderState = {
  nombre: '',
  descripcion: '',
  tipo: 's3',
  credenciales: {},
  configuracion: {},
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
    { name: 'region', label: 'Región', type: 'text', required: false, default: 'us-east-1' },
    { name: 'bucket', label: 'Bucket', type: 'text', required: true }
  ],
  'azure': [
    { name: 'connection_string', label: 'Connection String', type: 'password', required: true },
    { name: 'container_name', label: 'Nombre del Container', type: 'text', required: true }
  ],
  'gcp': [
    { name: 'key_file', label: 'Archivo de Clave JSON', type: 'textarea', required: true },
    { name: 'bucket_name', label: 'Nombre del Bucket', type: 'text', required: true }
  ],
  'sftp': [
    { name: 'host', label: 'Hostname', type: 'text', required: true },
    { name: 'port', label: 'Puerto', type: 'number', required: false, default: '22' },
    { name: 'user', label: 'Usuario', type: 'text', required: true },
    { name: 'password', label: 'Contraseña', type: 'password', required: false },
    { name: 'key_path', label: 'Ruta a Clave SSH', type: 'text', required: false },
    { name: 'path', label: 'Directorio Remoto', type: 'text', required: false, default: '/' }
  ],
  'minio': [
    { name: 'endpoint', label: 'Endpoint', type: 'text', required: true },
    { name: 'access_key', label: 'Access Key', type: 'text', required: true },
    { name: 'secret_key', label: 'Secret Key', type: 'password', required: true },
    { name: 'secure', label: 'Usar SSL', type: 'checkbox', required: false, default: true },
    { name: 'bucket', label: 'Bucket', type: 'text', required: true }
  ]
};

// Esquemas de configuración para cada tipo de proveedor
const configSchemas = {
  's3': [
    { name: 'prefix', label: 'Prefijo de Ruta', type: 'text', required: false, default: 'executions/' },
    { name: 'use_presigned_urls', label: 'Usar URLs pre-firmadas', type: 'checkbox', required: false, default: true },
    { name: 'presigned_url_expiry', label: 'Expiración de URLs (segundos)', type: 'number', required: false, default: '3600' }
  ],
  'azure': [
    { name: 'prefix', label: 'Prefijo de Ruta', type: 'text', required: false, default: 'executions/' },
    { name: 'use_sas', label: 'Usar URLs con SAS Token', type: 'checkbox', required: false, default: true },
    { name: 'sas_expiry', label: 'Expiración de SAS (segundos)', type: 'number', required: false, default: '3600' }
  ],
  'gcp': [
    { name: 'prefix', label: 'Prefijo de Ruta', type: 'text', required: false, default: 'executions/' },
    { name: 'use_signed_urls', label: 'Usar URLs firmadas', type: 'checkbox', required: false, default: true },
    { name: 'signed_url_expiry', label: 'Expiración de URLs (segundos)', type: 'number', required: false, default: '3600' }
  ],
  'sftp': [
    { name: 'prefix', label: 'Prefijo de Ruta', type: 'text', required: false, default: 'executions/' },
    { name: 'connection_timeout', label: 'Timeout de Conexión (segundos)', type: 'number', required: false, default: '30' },
    { name: 'retry_attempts', label: 'Intentos de Reconexión', type: 'number', required: false, default: '3' }
  ],
  'minio': [
    { name: 'prefix', label: 'Prefijo de Ruta', type: 'text', required: false, default: 'executions/' },
    { name: 'use_presigned_urls', label: 'Usar URLs pre-firmadas', type: 'checkbox', required: false, default: true },
    { name: 'presigned_url_expiry', label: 'Expiración de URLs (segundos)', type: 'number', required: false, default: '3600' }
  ]
};

// Estado de los proveedores
function CloudProviders() {
  const router = useRouter();
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  document.title = "SAGE Clouds | SAGE Admin";
  const [showForm, setShowForm] = useState(false);
  const [currentProvider, setCurrentProvider] = useState(initialProviderState);
  const [isEditing, setIsEditing] = useState(false);
  const [testingId, setTestingId] = useState(null);

  // Cargar proveedores
  useEffect(() => {
    fetchProviders();
  }, []);

  // Obtener todos los proveedores
  const fetchProviders = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/clouds');
      if (!response.ok) throw new Error('Error al cargar proveedores de nube');
      const data = await response.json();
      setProviders(data);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar proveedores de nube: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Función para validar el formulario
  const validateForm = () => {
    if (!currentProvider.nombre.trim()) {
      toast.error('El nombre del proveedor es obligatorio');
      return false;
    }

    if (!currentProvider.tipo) {
      toast.error('El tipo de proveedor es obligatorio');
      return false;
    }

    // Validar credenciales obligatorias
    const requiredCredentials = credentialSchemas[currentProvider.tipo]
      .filter(cred => cred.required)
      .map(cred => cred.name);

    for (const credential of requiredCredentials) {
      if (!currentProvider.credenciales[credential]) {
        toast.error(`La credencial ${credential} es obligatoria`);
        return false;
      }
    }

    return true;
  };

  // Guardar un proveedor (crear o actualizar)
  const saveProvider = async () => {
    if (!validateForm()) return;

    try {
      const url = isEditing 
        ? `/api/clouds/${currentProvider.id}` 
        : '/api/clouds';
      
      const method = isEditing ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentProvider)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al guardar el proveedor');
      }

      toast.success(`Proveedor ${isEditing ? 'actualizado' : 'creado'} correctamente`);
      resetForm();
      fetchProviders();
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.message);
    }
  };

  // Eliminar un proveedor
  const deleteProvider = async (id) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este proveedor?')) {
      return;
    }

    try {
      const response = await fetch(`/api/clouds/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al eliminar el proveedor');
      }

      toast.success('Proveedor eliminado correctamente');
      fetchProviders();
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.message);
    }
  };

  // Probar conexión
  const testConnection = async (id) => {
    setTestingId(id);
    try {
      const response = await fetch(`/api/clouds/${id}/test`, {
        method: 'POST'
      });

      const result = await response.json();
      
      if (result.success) {
        toast.success(`Conexión exitosa: ${result.message}`);
      } else {
        toast.error(`Error de conexión: ${result.message}`);
      }
      
      // Actualizar estado de proveedor en la lista
      fetchProviders();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al probar la conexión: ' + error.message);
    } finally {
      setTestingId(null);
    }
  };

  // Editar un proveedor
  const editProvider = async (id) => {
    try {
      const response = await fetch(`/api/clouds/${id}`);
      if (!response.ok) throw new Error('Error al cargar datos del proveedor');
      
      const data = await response.json();
      
      // Asegurarse de que las credenciales y configuración sean objetos
      data.credenciales = typeof data.credenciales === 'string' 
        ? JSON.parse(data.credenciales) 
        : data.credenciales;
        
      data.configuracion = typeof data.configuracion === 'string' 
        ? JSON.parse(data.configuracion) 
        : data.configuracion;
      
      setCurrentProvider(data);
      setIsEditing(true);
      setShowForm(true);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar datos del proveedor: ' + error.message);
    }
  };

  // Resetear formulario
  const resetForm = () => {
    setCurrentProvider(initialProviderState);
    setIsEditing(false);
    setShowForm(false);
  };

  // Manejar cambios en el formulario
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    const val = type === 'checkbox' ? checked : value;
    
    if (name.includes('.')) {
      const [section, field] = name.split('.');
      setCurrentProvider(prev => ({
        ...prev,
        [section]: {
          ...prev[section],
          [field]: val
        }
      }));
    } else {
      setCurrentProvider(prev => ({
        ...prev,
        [name]: val
      }));
    }
  };

  // Cuando cambia el tipo de proveedor, reiniciar credenciales y configuración
  const handleProviderTypeChange = (e) => {
    const newType = e.target.value;
    
    // Inicializar credenciales con valores por defecto
    const defaultCredentials = {};
    credentialSchemas[newType].forEach(cred => {
      if (cred.default !== undefined) {
        defaultCredentials[cred.name] = cred.default;
      }
    });
    
    // Inicializar configuración con valores por defecto
    const defaultConfig = {};
    configSchemas[newType].forEach(conf => {
      if (conf.default !== undefined) {
        defaultConfig[conf.name] = conf.default;
      }
    });
    
    setCurrentProvider(prev => ({
      ...prev,
      tipo: newType,
      credenciales: defaultCredentials,
      configuracion: defaultConfig
    }));
  };

  return (
    <AdminLayout>
      <Head>
        <title>SAGE Cloud - Gestión de Proveedores</title>
      </Head>
      
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <Title>Gestión de Proveedores de Nube</Title>
            <Text>Administra las conexiones a proveedores de almacenamiento en la nube</Text>
          </div>
          <div className="flex space-x-3">
            <Button 
              icon={ArrowPathIcon} 
              onClick={() => router.push('/admin/clouds/migrations')}
              color="cyan"
            >
              Migraciones
            </Button>
            <Button 
              icon={PlusCircleIcon} 
              onClick={() => setShowForm(!showForm)}
              color="indigo"
            >
              {showForm ? 'Cancelar' : 'Nuevo Proveedor'}
            </Button>
          </div>
        </div>
        
        {showForm && (
          <Card className="mb-6">
            <Subtitle className="mb-4">
              {isEditing ? 'Editar Proveedor' : 'Nuevo Proveedor de Nube'}
            </Subtitle>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre del Proveedor*
                </label>
                <input
                  type="text"
                  name="nombre"
                  value={currentProvider.nombre}
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
                  value={currentProvider.tipo}
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
                  value={currentProvider.descripcion || ''}
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
                {credentialSchemas[currentProvider.tipo].map((field) => (
                  <div key={field.name}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {field.label} {field.required && '*'}
                    </label>
                    {field.type === 'textarea' ? (
                      <textarea
                        name={`credenciales.${field.name}`}
                        value={currentProvider.credenciales[field.name] || ''}
                        onChange={handleInputChange}
                        rows="4"
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        required={field.required}
                      />
                    ) : field.type === 'checkbox' ? (
                      <input
                        type="checkbox"
                        name={`credenciales.${field.name}`}
                        checked={!!currentProvider.credenciales[field.name]}
                        onChange={handleInputChange}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                      />
                    ) : (
                      <input
                        type={field.type}
                        name={`credenciales.${field.name}`}
                        value={currentProvider.credenciales[field.name] || ''}
                        onChange={handleInputChange}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        required={field.required}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
            
            <div className="mb-6">
              <Subtitle className="mb-3">Configuración</Subtitle>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {configSchemas[currentProvider.tipo].map((field) => (
                  <div key={field.name}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {field.label} {field.required && '*'}
                    </label>
                    {field.type === 'textarea' ? (
                      <textarea
                        name={`configuracion.${field.name}`}
                        value={currentProvider.configuracion[field.name] || ''}
                        onChange={handleInputChange}
                        rows="3"
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        required={field.required}
                      />
                    ) : field.type === 'checkbox' ? (
                      <input
                        type="checkbox"
                        name={`configuracion.${field.name}`}
                        checked={!!currentProvider.configuracion[field.name]}
                        onChange={handleInputChange}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                      />
                    ) : (
                      <input
                        type={field.type}
                        name={`configuracion.${field.name}`}
                        value={currentProvider.configuracion[field.name] || ''}
                        onChange={handleInputChange}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        required={field.required}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex justify-between items-center">
              <div>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="activo"
                    checked={currentProvider.activo}
                    onChange={handleInputChange}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                  />
                  <span className="text-sm text-gray-700">Proveedor activo</span>
                </label>
              </div>
              
              <div className="flex gap-2">
                <Button
                  onClick={resetForm}
                  color="gray"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={saveProvider}
                  color="indigo"
                >
                  {isEditing ? 'Actualizar' : 'Crear'} Proveedor
                </Button>
              </div>
            </div>
          </Card>
        )}
        
        <Card>
          {loading ? (
            <div className="text-center py-4">Cargando...</div>
          ) : providers.length === 0 ? (
            <div className="text-center py-8">
              <CloudIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No hay proveedores</h3>
              <p className="mt-1 text-sm text-gray-500">
                Comienza agregando un nuevo proveedor de almacenamiento en la nube.
              </p>
              <div className="mt-6">
                <Button
                  color="indigo"
                  icon={PlusCircleIcon}
                  onClick={() => setShowForm(true)}
                >
                  Nuevo Proveedor
                </Button>
              </div>
            </div>
          ) : (
            <Table>
              <Table.Head>
                <Table.HeadCell>Nombre</Table.HeadCell>
                <Table.HeadCell>Tipo</Table.HeadCell>
                <Table.HeadCell>Estado</Table.HeadCell>
                <Table.HeadCell>Último Chequeo</Table.HeadCell>
                <Table.HeadCell>Activo</Table.HeadCell>
                <Table.HeadCell>Acciones</Table.HeadCell>
              </Table.Head>
              <Table.Body>
                {providers.map((provider) => (
                  <Table.Row key={provider.id}>
                    <Table.Cell>
                      <div className="font-medium">{provider.nombre}</div>
                      {provider.descripcion && (
                        <div className="text-xs text-gray-500">{provider.descripcion}</div>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      {providerTypes.find(t => t.value === provider.tipo)?.label || provider.tipo}
                    </Table.Cell>
                    <Table.Cell>
                      {provider.estado === 'conectado' ? (
                        <Badge color="green" icon={CheckCircleIcon}>
                          Conectado
                        </Badge>
                      ) : provider.estado === 'error' ? (
                        <Badge color="red" icon={XCircleIcon}>
                          Error
                        </Badge>
                      ) : (
                        <Badge color="amber">
                          Pendiente
                        </Badge>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      {provider.ultimo_chequeo ? 
                        new Date(provider.ultimo_chequeo).toLocaleString() : 
                        'Nunca'}
                    </Table.Cell>
                    <Table.Cell>
                      {provider.activo ? (
                        <Badge color="green">Activo</Badge>
                      ) : (
                        <Badge color="gray">Inactivo</Badge>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex space-x-2">
                        <Button
                          size="xs"
                          variant="light"
                          color="indigo"
                          onClick={() => testConnection(provider.id)}
                          loading={testingId === provider.id}
                        >
                          Probar
                        </Button>
                        <Button
                          size="xs"
                          variant="light"
                          color="amber"
                          icon={PencilIcon}
                          onClick={() => editProvider(provider.id)}
                        >
                          Editar
                        </Button>
                        <Button
                          size="xs"
                          variant="light"
                          color="red"
                          icon={TrashIcon}
                          onClick={() => deleteProvider(provider.id)}
                        >
                          Eliminar
                        </Button>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          )}
        </Card>
      </div>
    </AdminLayout>
  );
}

export default CloudProviders;