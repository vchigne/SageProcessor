import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import Breadcrumbs from '@/components/Breadcrumbs';
import { 
  Card, 
  Title, 
  Text, 
  TextInput, 
  Select, 
  SelectItem, 
  NumberInput,
  Button, 
  Flex,
  Divider,
  Grid,
  Col,
  Switch
} from '@tremor/react';
import { toast } from 'react-toastify';
import Link from 'next/link';
import { ArrowLeftIcon, ServerIcon, KeyIcon, LockClosedIcon } from '@heroicons/react/24/outline';

// Tipos de servidores soportados
const SERVER_TYPES = [
  { id: 'postgresql', name: 'PostgreSQL' },
  { id: 'mysql', name: 'MySQL' },
  { id: 'sqlserver', name: 'SQL Server' },
  { id: 'duckdb', name: 'DuckDB' }
];

// Función para obtener los campos específicos por tipo de servidor
const getServerSpecificFields = (serverType) => {
  const commonFields = [
    { id: 'host', name: 'Host/Servidor', type: 'text', required: true },
    { id: 'port', name: 'Puerto', type: 'number', required: true },
    { id: 'username', name: 'Usuario', type: 'text', required: true },
    { id: 'password', name: 'Contraseña', type: 'password', required: true }
  ];

  switch (serverType) {
    case 'postgresql':
      return [
        ...commonFields,
        { id: 'database', name: 'Base de datos por defecto', type: 'text', required: true },
        { id: 'ssl', name: 'Usar SSL', type: 'boolean', required: false },
        { id: 'schema', name: 'Schema', type: 'text', required: false, defaultValue: 'public' }
      ];
    case 'mysql':
      return [
        ...commonFields,
        { id: 'database', name: 'Base de datos por defecto', type: 'text', required: true },
        { id: 'ssl', name: 'Usar SSL', type: 'boolean', required: false }
      ];
    case 'sqlserver':
      return [
        ...commonFields,
        { id: 'database', name: 'Base de datos por defecto', type: 'text', required: true },
        { id: 'encrypt', name: 'Encriptación', type: 'boolean', required: false },
        { id: 'trustServerCertificate', name: 'Confiar en certificado del servidor', type: 'boolean', required: false }
      ];
    case 'duckdb':
      return [
        { id: 'path', name: 'Ruta del archivo', type: 'text', required: true },
        { id: 'readOnly', name: 'Solo lectura', type: 'boolean', required: false },
        { id: 'memoryMapSize', name: 'Tamaño de mapeo en memoria (MB)', type: 'number', required: false }
      ];
    default:
      return commonFields;
  }
};

// Valores por defecto para cada tipo de servidor
const getDefaultValues = (serverType) => {
  const defaults = {
    postgresql: { port: 5432, ssl: false, schema: 'public' },
    mysql: { port: 3306, ssl: false },
    sqlserver: { port: 1433, encrypt: true, trustServerCertificate: false },
    duckdb: { readOnly: false }
  };

  return defaults[serverType] || {};
};

// Componente principal
export default function DBSecretForm() {
  const router = useRouter();
  const { id } = router.query;
  const isNew = id === 'new';
  
  const [secret, setSecret] = useState({
    nombre: '',
    descripcion: '',
    tipo_servidor: 'postgresql',
    activo: true,
    configuracion: {}
  });
  
  const [loading, setLoading] = useState(!isNew);
  const [isSaving, setIsSaving] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [serverFields, setServerFields] = useState([]);

  // Cargar datos si es edición
  useEffect(() => {
    if (!router.isReady) return;
    
    // Si es nuevo, establecer campos para el tipo de servidor por defecto
    if (isNew) {
      const fields = getServerSpecificFields('postgresql');
      setServerFields(fields);
      
      // Establecer valores por defecto
      const defaultValues = getDefaultValues('postgresql');
      setSecret(prev => ({
        ...prev,
        configuracion: defaultValues
      }));
      
      setLoading(false);
      return;
    }
    
    // Si es edición, cargar datos
    const fetchSecret = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/admin/db-secrets/${id}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            toast.error('El secreto solicitado no existe.');
            router.push('/admin/db-secrets');
            return;
          }
          throw new Error('Error al obtener el secreto');
        }
        
        const data = await response.json();
        
        // Establecer campos específicos para el tipo de servidor
        const fields = getServerSpecificFields(data.tipo_servidor);
        setServerFields(fields);
        
        setSecret(data);
      } catch (error) {
        console.error('Error:', error);
        toast.error(error.message || 'Error al cargar los datos del secreto');
      } finally {
        setLoading(false);
      }
    };
    
    fetchSecret();
  }, [router.isReady, id, isNew, router]);

  // Actualizar campos cuando cambia el tipo de servidor
  useEffect(() => {
    const fields = getServerSpecificFields(secret.tipo_servidor);
    setServerFields(fields);
    
    // Actualizar valores por defecto al cambiar tipo de servidor
    const defaultValues = getDefaultValues(secret.tipo_servidor);
    setSecret(prev => ({
      ...prev,
      configuracion: {
        ...defaultValues,
        ...(prev.configuracion || {})
      }
    }));
  }, [secret.tipo_servidor]);

  // Manejar cambios en el formulario principal
  const handleChange = (field, value) => {
    setSecret(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Manejar cambios en la configuración específica del servidor
  const handleConfigChange = (field, value) => {
    setSecret(prev => ({
      ...prev,
      configuracion: {
        ...prev.configuracion,
        [field]: value
      }
    }));
  };

  // Probar la conexión
  const testConnection = async () => {
    try {
      setTestingConnection(true);
      const response = await fetch('/api/admin/db-secrets/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tipo_servidor: secret.tipo_servidor,
          configuracion: secret.configuracion
        }),
      });
      
      const result = await response.json();
      
      if (response.ok) {
        toast.success('Conexión exitosa. La base de datos está disponible.');
      } else {
        toast.error(`Error: ${result.message || 'No se pudo conectar a la base de datos.'}`);
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al probar la conexión.');
    } finally {
      setTestingConnection(false);
    }
  };

  // Guardar el secreto
  const saveSecret = async () => {
    try {
      // Validar campos requeridos
      if (!secret.nombre) {
        toast.error('El nombre es obligatorio');
        return;
      }
      
      // Validar configuración según tipo de servidor
      const requiredFields = serverFields.filter(field => field.required);
      for (const field of requiredFields) {
        if (secret.configuracion[field.id] === undefined || secret.configuracion[field.id] === '') {
          toast.error(`El campo ${field.name} es obligatorio`);
          return;
        }
      }
      
      setIsSaving(true);
      
      const url = isNew 
        ? '/api/admin/db-secrets' 
        : `/api/admin/db-secrets/${id}`;
      
      const method = isNew ? 'POST' : 'PUT';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(secret),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al guardar el secreto');
      }
      
      toast.success(`Secreto ${isNew ? 'creado' : 'actualizado'} correctamente`);
      router.push('/admin/db-secrets');
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.message || 'Error al guardar el secreto');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-9xl mx-auto">
          <div className="text-center p-12">Cargando...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-9xl mx-auto">
        <Breadcrumbs items={[
          { label: 'Admin', href: '/admin' },
          { label: 'Materializaciones', href: '/admin/materializations' },
          { label: 'Secretos de BD', href: '/admin/db-secrets' },
          { label: isNew ? 'Nuevo Secreto' : secret.nombre, current: true }
        ]} />
        
        <div className="sm:flex sm:justify-between sm:items-center mb-8">
          <div>
            <Title>{isNew ? 'Nuevo Secreto de Base de Datos' : `Editar: ${secret.nombre}`}</Title>
            <Text>Configure las credenciales para conectarse a bases de datos externas.</Text>
          </div>
          <Link
            href="/admin/db-secrets"
            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Volver
          </Link>
        </div>
        
        <Grid numCols={1} numColsMd={2} className="gap-6">
          <Col>
            <Card>
              <div className="space-y-4">
                <Title className="text-base">Información General</Title>
                
                <TextInput
                  label="Nombre"
                  placeholder="Nombre del secreto"
                  value={secret.nombre}
                  onChange={(value) => handleChange('nombre', value)}
                  required
                />
                
                <TextInput
                  label="Descripción"
                  placeholder="Descripción opcional"
                  value={secret.descripcion}
                  onChange={(value) => handleChange('descripcion', value)}
                />
                
                <Select
                  label="Tipo de Servidor"
                  value={secret.tipo_servidor}
                  onValueChange={(value) => handleChange('tipo_servidor', value)}
                >
                  {SERVER_TYPES.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </Select>
                
                <div className="pt-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Estado
                  </label>
                  <Switch
                    id="active"
                    name="active"
                    checked={secret.activo}
                    onChange={() => handleChange('activo', !secret.activo)}
                  />
                  <span className="text-gray-500 text-xs ml-2">
                    {secret.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
              </div>
            </Card>
          </Col>
          
          <Col>
            <Card>
              <div className="space-y-4">
                <Title className="text-base">Configuración de Conexión</Title>
                <Text className="text-sm text-gray-500">
                  Configure los parámetros de conexión para {
                    SERVER_TYPES.find(t => t.id === secret.tipo_servidor)?.name || secret.tipo_servidor
                  }
                </Text>
                
                <Divider />
                
                {/* Renderizar campos dinámicos según tipo de servidor */}
                {serverFields.map((field) => (
                  <div key={field.id}>
                    {field.type === 'text' || field.type === 'password' ? (
                      <TextInput
                        label={field.name}
                        placeholder={`Ingrese ${field.name.toLowerCase()}`}
                        value={secret.configuracion[field.id] || ''}
                        onChange={(value) => handleConfigChange(field.id, value)}
                        type={field.type}
                        required={field.required}
                      />
                    ) : field.type === 'number' ? (
                      <NumberInput
                        label={field.name}
                        placeholder={`Ingrese ${field.name.toLowerCase()}`}
                        value={secret.configuracion[field.id] || 0}
                        onValueChange={(value) => handleConfigChange(field.id, value)}
                        required={field.required}
                      />
                    ) : field.type === 'boolean' ? (
                      <div className="pt-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {field.name}
                        </label>
                        <Switch
                          id={field.id}
                          name={field.id}
                          checked={!!secret.configuracion[field.id]}
                          onChange={() => handleConfigChange(field.id, !secret.configuracion[field.id])}
                        />
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </Card>
          </Col>
        </Grid>
        
        <div className="mt-6 flex justify-end gap-3">
          <Button
            variant="secondary"
            disabled={isSaving || testingConnection}
            onClick={testConnection}
            icon={ServerIcon}
            loading={testingConnection}
          >
            Probar Conexión
          </Button>
          
          <Button
            variant="primary"
            disabled={isSaving}
            onClick={saveSecret}
            icon={KeyIcon}
            loading={isSaving}
          >
            {isNew ? 'Crear Secreto' : 'Guardar Cambios'}
          </Button>
        </div>
      </div>
    </Layout>
  );
}