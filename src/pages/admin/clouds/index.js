
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { toast } from 'react-toastify';
import { 
  CloudIcon, 
  PlusCircleIcon, 
  TrashIcon, 
  PencilIcon, 
  CheckCircleIcon, 
  XCircleIcon,
  ExclamationCircleIcon,
  ArrowPathIcon,
  FolderIcon,
  DocumentTextIcon,
  FolderArrowDownIcon,
  ArrowUturnLeftIcon,
  MagnifyingGlassIcon,
  KeyIcon
} from '@heroicons/react/24/outline';
import { Metric, Text, Title, Subtitle, Badge, Button, Card, Table } from '@tremor/react';

// Estado inicial para un nuevo proveedor
const initialProviderState = {
  nombre: '',
  descripcion: '',
  tipo: 's3',
  credenciales: {},
  configuracion: {},
  secreto_id: null,
  usando_secreto: false,
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
// Función auxiliar para obtener la extensión de un archivo a partir de su nombre
function getFileExtension(filename) {
  if (!filename) return '-';
  const parts = filename.split('.');
  if (parts.length === 1 || parts[0] === '' && parts.length === 2) {
    return '-';
  }
  return parts.pop().toUpperCase();
}

function CloudProviders() {
  const router = useRouter();
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [currentProvider, setCurrentProvider] = useState(initialProviderState);
  const [isEditing, setIsEditing] = useState(false);
  const [testingId, setTestingId] = useState(null);
  const [testingAll, setTestingAll] = useState(false);
  const [cloudSecrets, setCloudSecrets] = useState([]);
  const [loadingSecrets, setLoadingSecrets] = useState(false);
  const [filteredSecrets, setFilteredSecrets] = useState([]);
  const [availableBuckets, setAvailableBuckets] = useState([]);
  const [loadingBuckets, setLoadingBuckets] = useState(false);
  const [useCustomBucketName, setUseCustomBucketName] = useState(false);
  
  // Estados para el explorador de archivos
  const [showExplorer, setShowExplorer] = useState(false);
  const [explorerLoading, setExplorerLoading] = useState(false);
  const [explorerData, setExplorerData] = useState(null);
  const [explorerProvider, setExplorerProvider] = useState(null);
  const [currentPath, setCurrentPath] = useState('');

  // Cargar proveedores y secretos
  useEffect(() => {
    fetchProviders();
    fetchCloudSecrets();
  }, []);

  // Obtener todos los proveedores
  const fetchProviders = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/clouds');
      if (!response.ok) throw new Error('Error al cargar proveedores de nube');
      const data = await response.json();
      
      // Verificamos los datos recibidos
      console.log("Datos de proveedores recibidos:", data);
      
      // Aplicamos una transformación para formatear la fecha de última verificación
      const processedData = data.map(provider => ({
        ...provider,
        // Transformamos la fecha a un formato adecuado si existe
        ultimo_chequeo: provider.ultimo_chequeo 
          ? new Date(provider.ultimo_chequeo).toISOString() 
          : null
      }));
      
      console.log("Datos procesados:", processedData);
      
      setProviders(processedData);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar proveedores de nube: ' + error.message);
    } finally {
      setLoading(false);
    }
  };
  
  // Probar todas las conexiones de nube
  const testAllClouds = async () => {
    try {
      // Establecer estado de prueba
      setTestingAll(true);
      
      // Mostrar toast de inicio
      toast.info("Iniciando pruebas de conexión para todos los proveedores de nube...");
      
      // Crear un array de promesas para probar cada proveedor
      const testPromises = providers.map(async (provider) => {
        try {
          const response = await fetch(`/api/clouds/${provider.id}/test`, {
            method: 'POST'
          });
          
          const result = await response.json();
          return {
            id: provider.id,
            nombre: provider.nombre,
            tipo: provider.tipo,
            success: result.success,
            message: result.message || (result.success ? 'Conexión exitosa' : 'Error de conexión')
          };
        } catch (error) {
          return {
            id: provider.id,
            nombre: provider.nombre,
            tipo: provider.tipo,
            success: false,
            message: `Error: ${error.message}`
          };
        }
      });
      
      // Esperar a que todas las pruebas terminen
      const results = await Promise.all(testPromises);
      
      // Contar éxitos y fallos
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;
      
      // Mostrar resultados generales
      if (failureCount === 0) {
        toast.success(`¡Todas las conexiones (${successCount}) funcionan correctamente!`, { autoClose: 5000 });
      } else {
        toast.warning(`Pruebas completadas: ${successCount} exitosas, ${failureCount} con errores.`, { autoClose: 5000 });
        
        // Mostrar errores específicos
        results.filter(r => !r.success).forEach(result => {
          toast.error(`${result.nombre} (${result.tipo}): ${result.message}`, { autoClose: 8000 });
        });
      }
      
      // Actualizar la lista para reflejar los nuevos estados
      fetchProviders();
    } catch (error) {
      console.error('Error al probar todas las nubes:', error);
      toast.error(`Error al probar las conexiones: ${error.message}`);
    } finally {
      setTestingAll(false);
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

    // Si estamos usando un secreto en lugar de credenciales directas
    if (currentProvider.usando_secreto) {
      if (!currentProvider.secreto_id) {
        toast.error('Debe seleccionar un secreto de nube');
        return false;
      }
      return true; // Si hay un secreto seleccionado, no necesitamos validar credenciales
    }

    // Validar credenciales obligatorias si no se usa un secreto
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
  
  // Inspeccionar contenido del proveedor
  // Listar buckets de un proveedor
  const listBuckets = async (provider) => {
    setExplorerProvider(provider);
    setExplorerLoading(true);
    setShowExplorer(true);
    setCurrentPath('');
    
    try {
      const response = await fetch(`/api/clouds/${provider.id}/buckets`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || error.message || 'Error al listar buckets');
      }
      
      const data = await response.json();
      
      // Mostrar los buckets en el explorador
      setExplorerData({
        path: '/',
        bucket: 'Buckets',
        folders: data.buckets?.map(bucket => ({
          name: bucket.name || bucket,
          path: bucket.name || bucket
        })) || [],
        files: [],
        isBucketList: true // Indicador para mostrar el botón de crear bucket
      });
    } catch (error) {
      console.error('Error al listar buckets:', error);
      toast.error(`Error al listar buckets: ${error.message}`);
      
      setExplorerData({
        error: true,
        errorMessage: error.message,
        path: '/',
        bucket: 'Buckets',
        folders: [],
        files: [],
        isBucketList: true
      });
    } finally {
      setExplorerLoading(false);
    }
  };
  
  // Crear un nuevo bucket
  const createNewBucket = async () => {
    // Verificar que tenemos un proveedor activo
    if (!explorerProvider) {
      toast.error('No hay un proveedor seleccionado');
      return;
    }
    
    // Mostrar prompt para el nombre del bucket
    const bucketName = prompt('Ingrese el nombre del nuevo bucket:');
    
    if (!bucketName) return; // Cancelado por el usuario
    
    // Validar el nombre del bucket (solo letras minúsculas, números, puntos y guiones)
    if (!/^[a-z0-9.-]+$/.test(bucketName)) {
      toast.error('Nombre de bucket inválido. Use solo letras minúsculas, números, puntos y guiones.');
      return;
    }
    
    try {
      toast.info(`Creando bucket "${bucketName}"...`);
      
      const response = await fetch(`/api/clouds/${explorerProvider.id}/buckets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucketName })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || error.message || 'Error al crear bucket');
      }
      
      const result = await response.json();
      
      toast.success(`Bucket "${bucketName}" creado exitosamente`);
      
      // Refrescar la lista de buckets
      await listBuckets(explorerProvider);
    } catch (error) {
      console.error('Error al crear bucket:', error);
      toast.error(`Error al crear bucket: ${error.message}`);
    }
  };
  
  const inspectProvider = async (provider, path = '') => {
    setExplorerProvider(provider);
    setExplorerLoading(true);
    setShowExplorer(true);
    setCurrentPath(path);
    
    try {
      const response = await fetch(`/api/clouds/${provider.id}/inspect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path })
      });
      
      // Obtenemos los datos incluso si hay errores, ya que el adaptador ahora devuelve
      // un objeto con error: true en lugar de lanzar excepciones
      const data = await response.json();
      
      if (data.error) {
        // Es un objeto de error del adaptador
        console.error('Error al inspeccionar proveedor:', data.errorMessage || data.message || data.error);
        
        // Mensaje más amigable para errores comunes
        let errorMessage = data.errorMessage || data.message || (typeof data.error === 'string' ? data.error : 'Error desconocido');
        
        // Para errores de firma AWS
        if (errorMessage && errorMessage.includes && errorMessage.includes('SignatureDoesNotMatch')) {
          toast.error(
            'Error de autenticación con AWS: La firma generada no coincide. Verifica que la clave de acceso y la clave secreta sean correctas, así como la región configurada.',
            { autoClose: 8000 } // Más tiempo para leer el mensaje
          );
        } 
        // Para errores de bucket inexistente
        else if (errorMessage && errorMessage.includes && errorMessage.includes('NoSuchBucket')) {
          toast.error(
            'El bucket especificado no existe o no es accesible con las credenciales proporcionadas. Verifica el nombre del bucket y la región.',
            { autoClose: 8000 }
          );
        } 
        // Para errores de acceso denegado
        else if (errorMessage && errorMessage.includes && errorMessage.includes('AccessDenied')) {
          toast.error(
            'Acceso denegado. Las credenciales no tienen permisos suficientes para acceder al bucket. Verifica los permisos del usuario IAM.',
            { autoClose: 8000 }
          );
        } 
        // Para errores de clave de acceso inválida
        else if (errorMessage && errorMessage.includes && errorMessage.includes('InvalidAccessKeyId')) {
          toast.error(
            'La clave de acceso AWS proporcionada no existe. Verifica que la clave de acceso sea correcta y esté activa en tu cuenta AWS.',
            { autoClose: 8000 }
          );
        }
        // Para errores específicos de Azure
        else if (errorMessage && errorMessage.includes && 
                errorMessage.includes('AccountName=') && errorMessage.includes('AccountKey=')) {
          // Error de connection string de Azure
          toast.error(
            'Error en la cadena de conexión de Azure. Asegúrate de usar el formato correcto que incluya AccountName y AccountKey. ' +
            'Ejemplo: DefaultEndpointsProtocol=https;AccountName=micuenta;AccountKey=miClave;EndpointSuffix=core.windows.net',
            { autoClose: 10000 }
          );
        }
        else if (errorMessage && errorMessage.includes && 
                (errorMessage.includes('connection string') || errorMessage.includes('Azure'))) {
          toast.error(`Error de Azure: ${errorMessage}`, { autoClose: 8000 });
        }
        // Para otros errores AWS
        else if (errorMessage && errorMessage.includes && errorMessage.includes('AWS S3')) {
          toast.error(errorMessage, { autoClose: 8000 });
        } 
        // Mensaje genérico para otros errores
        else {
          toast.error(`Error al inspeccionar proveedor: ${errorMessage}`);
        }
        
        // Mantenemos el modal abierto pero mostramos un estado de error
        setExplorerData({
          error: true,
          errorMessage: errorMessage,
          path: path || '/',
          bucket: data.bucket,
          folders: [],
          files: []
        });
      } else if (!response.ok) {
        // Error HTTP pero no es del adaptador
        const errorData = await response.json();
        const errorMessage = errorData.message || errorData.error || 'Error desconocido';
        toast.error(`Error al inspeccionar proveedor: ${errorMessage}`);
        setShowExplorer(false);
      } else {
        // Todo bien, datos normales
        // Asegurar que las propiedades folders y files siempre existan
        setExplorerData({
          ...data,
          folders: data.folders || data.directories || [],
          files: data.files || []
        });
      }
    } catch (error) {
      // Error de red u otro error no controlado
      console.error('Error al inspeccionar proveedor:', error);
      toast.error(`Error al inspeccionar proveedor: ${error.message}`);
      setShowExplorer(false);
    } finally {
      setExplorerLoading(false);
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
        // Mensaje más amigable para errores comunes
        let errorMessage = result.message || 'Error desconocido';
        
        // Para errores de firma AWS
        if (errorMessage && errorMessage.includes && errorMessage.includes('SignatureDoesNotMatch')) {
          toast.error(
            'Error de autenticación con AWS: La firma generada no coincide. Verifica que la clave de acceso y la clave secreta sean correctas, así como la región configurada.',
            { autoClose: 8000 } // Más tiempo para leer el mensaje
          );
        } 
        // Para errores de bucket inexistente
        else if (errorMessage && errorMessage.includes && errorMessage.includes('NoSuchBucket')) {
          toast.error(
            'El bucket especificado no existe o no es accesible con las credenciales proporcionadas. Verifica el nombre del bucket y la región.',
            { autoClose: 8000 }
          );
        } 
        // Para errores de acceso denegado
        else if (errorMessage && errorMessage.includes && errorMessage.includes('AccessDenied')) {
          toast.error(
            'Acceso denegado. Las credenciales no tienen permisos suficientes para acceder al bucket. Verifica los permisos del usuario IAM.',
            { autoClose: 8000 }
          );
        } 
        // Para errores específicos de Azure
        else if (errorMessage && errorMessage.includes && 
                 errorMessage.includes('AccountName=') && errorMessage.includes('AccountKey=')) {
          // Error de connection string de Azure
          toast.error(
            'Error en la cadena de conexión de Azure. Asegúrate de usar el formato correcto que incluya AccountName y AccountKey. ' +
            'Ejemplo: DefaultEndpointsProtocol=https;AccountName=micuenta;AccountKey=miClave;EndpointSuffix=core.windows.net',
            { autoClose: 10000 }
          );
        }
        else if (errorMessage && errorMessage.includes && 
                (errorMessage.includes('connection string') || errorMessage.includes('Azure'))) {
          toast.error(`Error de Azure: ${errorMessage}`, { autoClose: 8000 });
        }
        // Para errores específicos de SFTP
        else if (errorMessage && errorMessage.includes && 
                (errorMessage.includes('SFTP') || errorMessage.includes('sftp') || 
                 errorMessage.includes('conexión SSH') || errorMessage.includes('Authentication failed'))) {
          toast.error(`Error de conexión SFTP: ${errorMessage}`, { autoClose: 8000 });
        }
        // Para errores de Google Cloud
        else if (errorMessage && errorMessage.includes && 
                (errorMessage.includes('GCP') || errorMessage.includes('Google Cloud'))) {
          toast.error(`Error de Google Cloud: ${errorMessage}`, { autoClose: 8000 });
        }
        // Para otros errores AWS
        else if (errorMessage && errorMessage.includes && errorMessage.includes('AWS S3')) {
          toast.error(errorMessage, { autoClose: 8000 });
        } 
        else {
          // Mensajes genéricos con detección del tipo de proveedor
          const providerType = document.querySelector('[name="tipo"]:checked')?.value;
          if (providerType === 'sftp') {
            toast.error(`Error de conexión SFTP: ${errorMessage}. Verifica las credenciales y que el servidor sea accesible.`, { autoClose: 8000 });
          } else if (providerType === 'azure') {
            toast.error(`Error de conexión Azure: ${errorMessage}. Verifica la cadena de conexión o las credenciales.`, { autoClose: 8000 });
          } else if (providerType === 'gcp') {
            toast.error(`Error de conexión Google Cloud: ${errorMessage}. Verifica el archivo de clave JSON y los permisos.`, { autoClose: 8000 });
          } else if (providerType === 'minio') {
            toast.error(`Error de conexión MinIO: ${errorMessage}. Verifica la configuración del endpoint y credenciales.`, { autoClose: 8000 });
          } else {
            toast.error(`Error de conexión: ${errorMessage}`);
          }
        }
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
      
      // Verificar si el proveedor usa un secreto
      const usandoSecreto = !!data.secreto_id;
      
      // Si el proveedor usa un secreto, cargar la lista de secretos disponibles si aún no están cargados
      if (usandoSecreto && cloudSecrets.length === 0) {
        await fetchCloudSecrets();
      }
      
      // Actualizar el proveedor con la información de si usa secreto
      setCurrentProvider({
        ...data,
        credenciales: data.credenciales || {},
        configuracion: data.configuracion || {},
        usando_secreto: usandoSecreto
      });
      
      setIsEditing(true);
      setShowForm(true);
      
      // Filtrar los secretos por tipo
      const filtered = cloudSecrets.filter(secret => secret.tipo === data.tipo);
      setFilteredSecrets(filtered);
      
      // Si usa secreto, cargar los buckets disponibles
      if (usandoSecreto && data.secreto_id) {
        // Determinar si se debe usar nombre personalizado o lista de buckets
        if (data.configuracion && data.configuracion.bucket) {
          // Verificar si el bucket existe en la lista o si debe ser personalizado
          loadBucketsForSecret(data.secreto_id).then(() => {
            // Usar un timeout para asegurar que la carga de buckets haya tenido tiempo de completarse
            setTimeout(() => {
              // Esta comprobación se hará después de cargar los buckets
              const bucketExists = availableBuckets.some(b => b === data.configuracion.bucket);
              setUseCustomBucketName(!bucketExists);
            }, 500);
          });
        } else {
          // No hay bucket configurado, cargar buckets y mostrar la lista
          setUseCustomBucketName(false);
          loadBucketsForSecret(data.secreto_id);
        }
      } else {
        // No usa secreto, usar modo de entrada manual
        setUseCustomBucketName(true);
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar datos del proveedor: ' + error.message);
    }
  };

  // Resetear formulario
  // Función para cargar buckets disponibles para un secreto
  const loadBucketsForSecret = async (secretId) => {
    if (!secretId) return;
    
    try {
      setLoadingBuckets(true);
      const response = await fetch(`/api/cloud-secrets/${secretId}/buckets`);
      
      if (!response.ok) {
        const error = await response.json();
        console.warn('Error al cargar buckets:', error);
        setAvailableBuckets([]);
        return;
      }
      
      const data = await response.json();
      
      if (data.success && data.buckets && Array.isArray(data.buckets)) {
        // Extraer nombres de buckets (puede ser un array de strings o de objetos)
        const bucketList = data.buckets.map(bucket => 
          typeof bucket === 'string' ? bucket : bucket.name || bucket
        );
        setAvailableBuckets(bucketList);
      } else {
        setAvailableBuckets([]);
      }
    } catch (error) {
      console.error('Error al cargar buckets:', error);
      setAvailableBuckets([]);
    } finally {
      setLoadingBuckets(false);
    }
  };
  
  // Función para obtener los secretos de nube
  const fetchCloudSecrets = async () => {
    try {
      setLoadingSecrets(true);
      const response = await fetch('/api/cloud-secrets');
      if (!response.ok) throw new Error('Error al cargar secretos de nube');
      const data = await response.json();
      
      console.log("Secretos de nube recibidos:", data);
      setCloudSecrets(data);
      
      // Si tenemos un tipo de proveedor seleccionado, filtrar los secretos por ese tipo
      if (currentProvider.tipo) {
        const filtered = data.filter(secret => secret.tipo === currentProvider.tipo);
        setFilteredSecrets(filtered);
      } else {
        setFilteredSecrets(data);
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar secretos de nube: ' + error.message);
    } finally {
      setLoadingSecrets(false);
    }
  };

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
      
      // Si se cambia el secreto de nube, cargar los buckets disponibles
      if (name === 'secreto_id' && val) {
        loadBucketsForSecret(val);
      }
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
      configuracion: defaultConfig,
      secreto_id: null // Limpiar el secreto seleccionado cuando cambia el tipo
    }));
    
    // Filtrar secretos por el nuevo tipo
    const filtered = cloudSecrets.filter(secret => secret.tipo === newType);
    setFilteredSecrets(filtered);
    
    // Limpiar buckets y restablecer modo de entrada
    setAvailableBuckets([]);
    setUseCustomBucketName(false);
  };

  return (
    <>
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
              icon={KeyIcon} 
              onClick={() => router.push('/admin/cloud-secrets')}
              color="blue"
            >
              Gestión de Secretos
            </Button>
            <Button 
              icon={CheckCircleIcon} 
              onClick={testAllClouds}
              color="amber"
              disabled={testingAll}
              loading={testingAll}
            >
              {testingAll ? 'Probando conexiones...' : 'Test Clouds'}
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
              
              <div className="mb-4 border-b pb-4">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer"
                    checked={currentProvider.usando_secreto}
                    onChange={(e) => setCurrentProvider({
                      ...currentProvider,
                      usando_secreto: e.target.checked,
                      // Si se activa el uso de secretos y no hay credenciales, limpiar el objeto
                      credenciales: e.target.checked ? {} : currentProvider.credenciales
                    })}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  <span className="ml-3 text-sm font-medium text-gray-900">Usar secreto de nube</span>
                </label>
                <p className="mt-1 text-sm text-gray-500">
                  Al activar esta opción, podrás seleccionar un secreto de nube previamente configurado en lugar de ingresar credenciales directamente.
                </p>
              </div>
              
              {currentProvider.usando_secreto ? (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Seleccionar Secreto de Nube*
                  </label>
                  <select
                    name="secreto_id"
                    value={currentProvider.secreto_id || ''}
                    onChange={handleInputChange}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    required
                  >
                    <option value="">Selecciona un secreto...</option>
                    {filteredSecrets.map((secreto) => (
                      <option key={secreto.id} value={secreto.id}>
                        {secreto.nombre} ({secreto.tipo})
                      </option>
                    ))}
                  </select>
                  {loadingSecrets && (
                    <div className="mt-2 text-sm text-gray-500 flex items-center">
                      <div className="animate-spin mr-2 h-4 w-4 border-b-2 border-indigo-500"></div>
                      Cargando secretos...
                    </div>
                  )}
                  {!loadingSecrets && cloudSecrets.length === 0 && (
                    <div className="mt-2 text-sm text-amber-600">
                      No hay secretos de nube disponibles. <a href="/admin/cloud-secrets" className="text-blue-600 hover:underline">Crear un nuevo secreto</a>
                    </div>
                  )}
                </div>
              ) : (
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
              )}
            </div>
            
            <div className="mb-6">
              <Subtitle className="mb-3">Configuración Adicional</Subtitle>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Primero la selección de bucket (si estamos usando un secreto) */}
                {currentProvider.usando_secreto && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Bucket*
                    </label>
                    <div className="space-y-2">
                      <div className="flex items-center">
                        <label className="relative inline-flex items-center cursor-pointer mr-3">
                          <input 
                            type="checkbox" 
                            className="sr-only peer"
                            checked={useCustomBucketName}
                            onChange={(e) => setUseCustomBucketName(e.target.checked)}
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                          <span className="ml-1 text-sm font-medium text-gray-700">Usar nombre personalizado</span>
                        </label>
                      </div>
                      
                      {useCustomBucketName ? (
                        <input
                          type="text"
                          name="configuracion.bucket"
                          value={currentProvider.configuracion.bucket || ''}
                          onChange={handleInputChange}
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                          placeholder="Ingrese nombre del bucket"
                          required
                        />
                      ) : (
                        <div>
                          <select
                            name="configuracion.bucket"
                            value={currentProvider.configuracion.bucket || ''}
                            onChange={handleInputChange}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                            required
                            disabled={loadingBuckets || !currentProvider.secreto_id}
                          >
                            <option value="">Seleccione un bucket...</option>
                            {availableBuckets.map((bucket) => (
                              <option key={bucket} value={bucket}>
                                {bucket}
                              </option>
                            ))}
                          </select>
                          {loadingBuckets && (
                            <div className="mt-2 text-sm text-gray-500 flex items-center">
                              <div className="animate-spin mr-2 h-4 w-4 border-b-2 border-indigo-500"></div>
                              Cargando buckets...
                            </div>
                          )}
                          {!loadingBuckets && availableBuckets.length === 0 && currentProvider.secreto_id && (
                            <div className="mt-2 text-sm text-amber-600">
                              No se encontraron buckets. Active "Usar nombre personalizado" para crear uno nuevo.
                            </div>
                          )}
                          {!currentProvider.secreto_id && (
                            <div className="mt-2 text-sm text-gray-500">
                              Seleccione un secreto para cargar buckets disponibles.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Resto de campos de configuración */}
                {configSchemas[currentProvider.tipo].map((field) => (
                  // Si estamos usando secreto y el campo es "bucket", no mostrarlo de nuevo
                  (!(currentProvider.usando_secreto && field.name === 'bucket')) && (
                    <div key={field.name}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {field.label} {field.required && '*'}
                      </label>
                      {field.type === 'textarea' ? (
                        <textarea
                          name={`configuracion.${field.name}`}
                          value={currentProvider.configuracion[field.name] || ''}
                          onChange={handleInputChange}
                          rows="4"
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
                  )
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
                onClick={saveProvider}
              >
                {isEditing ? 'Actualizar Proveedor' : 'Crear Proveedor'}
              </Button>
            </div>
          </Card>
        )}
        
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
          </div>
        ) : providers.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <CloudIcon className="mx-auto h-16 w-16 text-gray-400" />
            <h3 className="mt-2 text-lg font-medium text-gray-900">No hay proveedores</h3>
            <p className="mt-1 text-sm text-gray-500">
              Comienza agregando un nuevo proveedor de almacenamiento en la nube.
            </p>
            <div className="mt-6">
              <Button
                icon={PlusCircleIcon}
                onClick={() => setShowForm(true)}
                color="indigo"
              >
                Nuevo Proveedor
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
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Última verificación
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {providers.map((provider) => (
                    <tr key={provider.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center bg-indigo-100 rounded-full">
                            <CloudIcon className="h-6 w-6 text-indigo-600" />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{provider.nombre}</div>
                            <div className="text-sm text-gray-500">{provider.descripcion}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                          {providerTypes.find(t => t.value === provider.tipo)?.label || provider.tipo}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge color={provider.estado === 'conectado' ? "green" : provider.estado === 'error' ? "red" : "yellow"}>
                          {provider.estado === 'conectado' ? "Conectado" : provider.estado === 'error' ? "Error" : "Pendiente"}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {provider.ultimo_chequeo ? new Date(provider.ultimo_chequeo).toLocaleString() : 'Nunca'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                        <Button
                          size="xs"
                          variant="secondary"
                          color="indigo"
                          onClick={() => testConnection(provider.id)}
                          disabled={testingId === provider.id}
                          icon={ArrowPathIcon}
                        >
                          {testingId === provider.id ? 'Probando...' : 'Probar'}
                        </Button>

                        <Button
                          size="xs"
                          variant="secondary"
                          color="cyan"
                          onClick={() => inspectProvider(provider)}
                          icon={MagnifyingGlassIcon}
                        >
                          Inspeccionar
                        </Button>
                        <Button
                          size="xs"
                          variant="secondary"
                          color="gray"
                          onClick={() => editProvider(provider.id)}
                          icon={PencilIcon}
                        >
                          Editar
                        </Button>
                        <Button
                          size="xs"
                          variant="secondary"
                          color="red"
                          onClick={() => deleteProvider(provider.id)}
                          icon={TrashIcon}
                        >
                          Eliminar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
        
        {/* Modal Explorador */}
        {showExplorer && (
          <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-5xl max-h-[90vh] flex flex-col">
              {/* Cabecera */}
              <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    Explorador: {explorerProvider?.nombre}
                  </h3>
                  <p className="text-sm text-gray-500">
                    Tipo: {providerTypes.find(t => t.value === explorerProvider?.tipo)?.label}
                  </p>
                </div>
                <button
                  className="p-1 rounded-full hover:bg-gray-200"
                  onClick={() => setShowExplorer(false)}
                >
                  <XCircleIcon className="h-6 w-6 text-gray-500" />
                </button>
              </div>
              
              {/* Contenido */}
              <div className="p-4 flex-1 overflow-auto">
                {explorerLoading ? (
                  <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
                  </div>
                ) : !explorerData ? (
                  <div className="text-center py-12">
                    <CloudIcon className="mx-auto h-16 w-16 text-gray-400" />
                    <p className="mt-2 text-gray-500">No se pudo cargar el contenido</p>
                  </div>
                ) : explorerData.error ? (
                  <div className="text-center py-12 space-y-4">
                    <ExclamationCircleIcon className="mx-auto h-16 w-16 text-red-400" />
                    <div>
                      <h3 className="text-lg font-medium text-red-800">Error de conexión</h3>
                      <p className="mt-2 text-sm text-gray-600 max-w-2xl mx-auto">
                        {explorerData.errorMessage || "Error desconocido al acceder al almacenamiento"}
                      </p>
                    </div>
                    <div className="mt-4 px-4 py-3 bg-red-50 border border-red-100 rounded-md text-left">
                      <h4 className="text-sm font-medium text-red-800 mb-1">Sugerencias:</h4>
                      <ul className="text-xs text-gray-700 space-y-1 list-disc pl-5">
                        {explorerData.errorMessage && typeof explorerData.errorMessage === 'string' && explorerData.errorMessage.includes('SignatureDoesNotMatch') && (
                          <>
                            <li>Verifica que la <b>clave de acceso</b> y <b>clave secreta</b> sean correctas</li>
                            <li>Comprueba que la <b>región</b> configurada sea la correcta</li>
                            <li>Asegúrate de que las credenciales sigan activas en AWS</li>
                          </>
                        )}
                        {explorerData.errorMessage && typeof explorerData.errorMessage === 'string' && explorerData.errorMessage.includes('NoSuchBucket') && (
                          <>
                            <li>Verifica que el nombre del <b>bucket '{explorerData.bucket}'</b> sea correcto</li>
                            <li>Comprueba que el bucket exista en la región <b>{explorerData.region}</b></li>
                            <li>Asegúrate de tener permisos para acceder a este bucket</li>
                          </>
                        )}
                        {explorerData.errorMessage && typeof explorerData.errorMessage === 'string' && explorerData.errorMessage.includes('AccessDenied') && (
                          <>
                            <li>Las credenciales no tienen <b>permisos suficientes</b> para acceder al bucket</li>
                            <li>Verifica la política de permisos en la consola de AWS IAM</li>
                            <li>El usuario debe tener al menos permisos <b>s3:ListBucket</b></li>
                          </>
                        )}
                        {explorerData.errorMessage && typeof explorerData.errorMessage === 'string' && explorerData.errorMessage.includes('InvalidAccessKeyId') && (
                          <>
                            <li>La <b>clave de acceso</b> proporcionada no existe en AWS</li>
                            <li>Verifica que la clave no haya sido eliminada o desactivada</li>
                            <li>Comprueba si hay errores de tipeo en el ID de clave de acceso</li>
                          </>
                        )}
                        {/* Errores específicos de SFTP */}
                        {explorerProvider && explorerProvider.tipo === 'sftp' && (
                          <>
                            <li>Verifica la conexión a internet</li>
                            <li>Asegúrate que el servidor SFTP esté activo y accesible</li>
                            <li>Comprueba el nombre de usuario y contraseña para SFTP</li>
                            <li>Verifica que tengas permisos para acceder a esta ruta</li>
                          </>
                        )}
                        
                        {/* Errores específicos de Azure Storage */}
                        {explorerProvider && explorerProvider.tipo === 'azure' && (
                          <>
                            <li>Verifica la conexión a internet</li>
                            <li>Comprueba si Azure Storage está accesible</li>
                            <li>Revisa la cadena de conexión o las credenciales de Azure</li>
                          </>
                        )}
                        
                        {/* Errores específicos de Google Cloud Storage */}
                        {explorerProvider && explorerProvider.tipo === 'gcp' && (
                          <>
                            <li>Verifica la conexión a internet</li>
                            <li>Comprueba si Google Cloud Storage está accesible</li>
                            <li>Revisa el archivo de clave JSON y permisos</li>
                          </>
                        )}
                        
                        {/* Errores específicos de MinIO */}
                        {explorerProvider && explorerProvider.tipo === 'minio' && (
                          <>
                            <li>Verifica la conexión a internet</li>
                            <li>Comprueba si el servidor MinIO está funcionando</li>
                            <li>Revisa la configuración del endpoint y credenciales</li>
                          </>
                        )}
                        
                        {/* Errores generales de AWS o errores por defecto */}
                        {(!explorerProvider || 
                          (explorerProvider.tipo === 's3' && 
                          explorerData.errorMessage && typeof explorerData.errorMessage === 'string' &&
                          !explorerData.errorMessage.includes('SignatureDoesNotMatch') && 
                          !explorerData.errorMessage.includes('NoSuchBucket') && 
                          !explorerData.errorMessage.includes('AccessDenied') &&
                          !explorerData.errorMessage.includes('InvalidAccessKeyId'))) && (
                          <>
                            <li>Verifica la conexión a internet</li>
                            <li>Comprueba si el servicio AWS S3 está experimentando problemas</li>
                            <li>Revisa las credenciales y configuración del proveedor</li>
                          </>
                        )}
                      </ul>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Ruta de navegación */}
                    <div className="flex items-center space-x-2 bg-gray-50 p-2 rounded">
                      <button 
                        className="p-1 rounded hover:bg-gray-200"
                        disabled={!explorerData.parentPath && currentPath === ''}
                        onClick={() => {
                          if (explorerData.parentPath || currentPath !== '') {
                            inspectProvider(explorerProvider, explorerData.parentPath);
                          }
                        }}
                      >
                        <ArrowUturnLeftIcon className="h-5 w-5 text-gray-600" />
                      </button>
                      <div className="flex-1 text-sm text-gray-700 truncate">
                        {explorerData.bucket}/{currentPath || '/'}
                      </div>
                      
                      {/* Botón para crear bucket si estamos en la vista de buckets */}
                      {explorerData.isBucketList && (
                        <button
                          className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs rounded flex items-center"
                          onClick={createNewBucket}
                        >
                          <PlusCircleIcon className="h-4 w-4 mr-1" />
                          Crear Bucket
                        </button>
                      )}
                    </div>
                    
                    {/* Lista de carpetas */}
                    {explorerData.folders.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Carpetas</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {explorerData.folders.map((folder, idx) => (
                            <div
                              key={idx}
                              className="flex items-center p-2 rounded border border-gray-200 hover:bg-gray-50 hover:border-blue-300 cursor-pointer"
                              onClick={() => inspectProvider(explorerProvider, folder.path)}
                            >
                              <FolderIcon className="h-6 w-6 text-yellow-500 mr-2" />
                              <span className="text-sm truncate">{folder.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Lista de archivos */}
                    {explorerData.files.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Archivos</h4>
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tamaño</th>
                                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Última modificación</th>
                                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {explorerData.files.map((file, idx) => (
                                <tr key={idx} className="hover:bg-gray-50">
                                  <td className="px-3 py-2 whitespace-nowrap">
                                    <div className="flex items-center">
                                      <DocumentTextIcon className="h-5 w-5 text-blue-500 mr-2" />
                                      <span className="text-sm font-medium text-gray-900">{file.name}</span>
                                    </div>
                                  </td>
                                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                                    {(file.size / 1024).toFixed(2)} KB
                                  </td>
                                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                                    {new Date(file.lastModified).toLocaleString()}
                                  </td>
                                  <td className="px-3 py-2 whitespace-nowrap">
                                    <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                                      {getFileExtension(file.name)}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                    
                    {explorerData.folders.length === 0 && explorerData.files.length === 0 && (
                      <div className="text-center py-12 border border-dashed border-gray-300 rounded-lg">
                        <FolderIcon className="mx-auto h-12 w-12 text-gray-400" />
                        <h3 className="mt-2 text-sm font-medium text-gray-900">Carpeta vacía</h3>
                        <p className="mt-1 text-sm text-gray-500">
                          Esta ubicación no contiene archivos ni carpetas.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {/* Pie de modal */}
              <div className="p-4 border-t border-gray-200 flex justify-end">
                <Button 
                  color="gray"
                  onClick={() => setShowExplorer(false)}
                >
                  Cerrar
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default CloudProviders;
