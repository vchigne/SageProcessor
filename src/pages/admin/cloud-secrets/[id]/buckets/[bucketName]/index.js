import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { 
  Card, Title, Text, Button, 
  Divider, Table, TableHead, TableHeaderCell, TableBody, TableRow, TableCell,
  Flex
} from '@tremor/react';
import { 
  ArrowLeftIcon, 
  ArrowUturnLeftIcon,
  FolderIcon, 
  DocumentIcon,
  ExclamationCircleIcon 
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import { toast } from 'react-toastify';

/**
 * Página para examinar el contenido de un bucket específico asociado a un cloud secret
 */
export default function ExplorarBucketCloudSecret() {
  const router = useRouter();
  const { id, bucketName } = router.query;
  
  const [secreto, setSecreto] = useState(null);
  const [explorerData, setExplorerData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentPath, setCurrentPath] = useState('');
  const [error, setError] = useState(null);
  
  // Cargar detalles del secreto cuando cambia el ID
  useEffect(() => {
    if (id) {
      loadSecretDetails();
    }
  }, [id]);
  
  // Cargar contenido del bucket cuando cambia el bucket o la ruta
  useEffect(() => {
    if (id && bucketName) {
      inspectBucket(currentPath);
    }
  }, [id, bucketName, currentPath]);
  
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
  
  // Examinar el contenido del bucket
  const inspectBucket = async (path) => {
    setLoading(true);
    
    try {
      const response = await fetch(`/api/cloud-secrets/${id}/buckets/${encodeURIComponent(bucketName)}/inspect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        setError(data.message || 'Error al cargar el contenido del bucket');
        setExplorerData({
          error: true,
          errorMessage: data.message || 'Error desconocido',
          bucket: bucketName,
          path: path || '/',
          folders: [],
          files: []
        });
        return;
      }
      
      setExplorerData(data);
      setError(null);
    } catch (error) {
      console.error('Error al examinar bucket:', error);
      setError('Error de conexión al examinar el bucket');
      setExplorerData({
        error: true,
        errorMessage: error.message,
        bucket: bucketName,
        path: path || '/',
        folders: [],
        files: []
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Formatear tamaño de archivos
  const formatSize = (sizeInBytes) => {
    if (sizeInBytes === undefined || sizeInBytes === null) return 'N/A';
    
    if (sizeInBytes < 1024) return sizeInBytes + ' B';
    if (sizeInBytes < 1024 * 1024) return (sizeInBytes / 1024).toFixed(2) + ' KB';
    if (sizeInBytes < 1024 * 1024 * 1024) return (sizeInBytes / (1024 * 1024)).toFixed(2) + ' MB';
    return (sizeInBytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  };
  
  // Formatear fecha
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    return date.toLocaleString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
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
  
  return (
    <Card className="mt-4">
      <div className="flex justify-between items-center mb-4">
        <Link href={`/admin/cloud-secrets/${id}/buckets`} className="flex items-center text-blue-600 hover:text-blue-800">
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          <span>Volver a la lista de buckets</span>
        </Link>
      </div>
      
      <Title>Explorar Bucket: {bucketName}</Title>
      {secreto && (
        <Text className="mt-2 mb-4">
          Secreto: <span className="font-semibold">{secreto.nombre}</span>
          {secreto.tipo && (
            <span className="ml-2 text-sm text-gray-500">
              ({formatProviderType(secreto.tipo)})
            </span>
          )}
        </Text>
      )}
      
      <Divider />
      
      {/* Barra de navegación */}
      <div className="flex items-center space-x-2 bg-gray-50 p-2 rounded mb-4">
        <button 
          className="p-1 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!explorerData || !currentPath}
          onClick={() => {
            if (currentPath) {
              // Obtener el path del directorio padre
              const pathParts = currentPath.split('/').filter(part => part !== '');
              pathParts.pop(); // Eliminar la última parte para ir al directorio padre
              setCurrentPath(pathParts.join('/'));
            }
          }}
        >
          <ArrowUturnLeftIcon className="h-5 w-5 text-gray-600" />
        </button>
        <div className="flex-1 text-sm text-gray-700 truncate">
          {bucketName}/{currentPath || '/'}
        </div>
      </div>
      
      {/* Contenido del bucket */}
      {loading ? (
        <div className="py-8 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <p className="mt-2 text-gray-600">Cargando contenido...</p>
        </div>
      ) : error && (!explorerData || !explorerData.folders) ? (
        <div className="py-8 text-center text-red-500 flex flex-col items-center">
          <ExclamationCircleIcon className="h-12 w-12 mb-2" />
          <p>{error}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Carpetas */}
          {explorerData && explorerData.folders && explorerData.folders.length > 0 && (
            <div>
              <h3 className="text-lg font-medium mb-2">Carpetas</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {explorerData.folders.map((folder, idx) => (
                  <div
                    key={idx}
                    className="flex items-center p-2 rounded border border-gray-200 hover:bg-gray-50 hover:border-blue-300 cursor-pointer"
                    onClick={() => setCurrentPath(folder.path)}
                  >
                    <FolderIcon className="h-6 w-6 text-yellow-500 mr-2" />
                    <span className="text-sm truncate">{folder.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Archivos */}
          {explorerData && explorerData.files && (
            <div>
              <h3 className="text-lg font-medium mb-2">Archivos</h3>
              {explorerData.files.length === 0 ? (
                <div className="py-4 text-center text-gray-500">
                  No hay archivos en esta ubicación
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableHeaderCell>Nombre</TableHeaderCell>
                        <TableHeaderCell>Tamaño</TableHeaderCell>
                        <TableHeaderCell>Modificado</TableHeaderCell>
                        <TableHeaderCell>Tipo</TableHeaderCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {explorerData.files.map((file, idx) => (
                        <TableRow key={idx}>
                          <TableCell>
                            <Flex alignItems="center">
                              <DocumentIcon className="h-5 w-5 text-blue-500 mr-2" />
                              {file.name}
                            </Flex>
                          </TableCell>
                          <TableCell>{formatSize(file.size)}</TableCell>
                          <TableCell>{formatDate(file.lastModified)}</TableCell>
                          <TableCell>
                            {file.extension ? file.extension.toUpperCase() : 'N/A'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
          
          {/* Sin contenido */}
          {explorerData && 
           explorerData.folders && 
           explorerData.folders.length === 0 && 
           explorerData.files && 
           explorerData.files.length === 0 && (
            <div className="py-8 text-center text-gray-500">
              <p>No hay contenido en esta ubicación</p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}