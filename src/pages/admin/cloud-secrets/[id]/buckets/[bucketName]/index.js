import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { 
  ArrowLeftIcon, 
  DocumentTextIcon, 
  FolderIcon, 
  ArrowUturnLeftIcon,
  PlusCircleIcon
} from '@heroicons/react/24/outline';
import { Card, Text, Title, Button } from '@tremor/react';
import { toast } from 'react-toastify';

// Importar el mismo componente que en SAGE Clouds
function getFileExtension(filename) {
  return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2).toUpperCase();
}

export default function BucketExplorer() {
  const router = useRouter();
  const { id, bucketName } = router.query;
  
  const [loading, setLoading] = useState(true);
  const [secret, setSecret] = useState(null);
  
  // Estados para el explorador (IGUAL que en SAGE Clouds)
  const [showExplorer, setShowExplorer] = useState(true);
  const [explorerProvider, setExplorerProvider] = useState(null);
  const [explorerLoading, setExplorerLoading] = useState(true);
  const [explorerData, setExplorerData] = useState({});
  const [currentPath, setCurrentPath] = useState('');
  
  // Cargar detalles del secreto
  useEffect(() => {
    if (!id) return;
    
    async function loadSecretDetails() {
      try {
        const secretRes = await fetch(`/api/cloud-secrets/${id}`);
        
        if (!secretRes.ok) {
          throw new Error(`Error al cargar secreto: ${secretRes.status}`);
        }
        
        const secretData = await secretRes.json();
        setSecret(secretData);
        
        // Establecer el provider simulado para el explorador
        setExplorerProvider({
          id: id,
          nombre: secretData.nombre,
          tipo: secretData.tipo,
          secreto_id: id,
          bucket: bucketName
        });
      } catch (err) {
        console.error('Error al cargar datos del secreto:', err);
        toast.error(`Error: ${err.message}`);
      }
    }
    
    loadSecretDetails();
  }, [id, bucketName]);
  
  // Inspeccionar el bucketName cuando el provider esté listo
  // Este código usa EXACTAMENTE el mismo patrón que SAGE Clouds
  useEffect(() => {
    if (!explorerProvider || !bucketName) return;
    
    inspectProvider(explorerProvider, router.query.path || '');
  }, [explorerProvider, bucketName, router.query.path]);
  
  // Función de inspección IDÉNTICA a la de SAGE Clouds
  const inspectProvider = async (provider, path = '') => {
    setExplorerLoading(true);
    setShowExplorer(true);
    setCurrentPath(path);
    
    try {
      // Usar endpoint SIMILAR pero adaptado a secrets - EXACTAMENTE igual que en SAGE Clouds
      const response = await fetch(`/api/cloud-secrets/${id}/buckets/${bucketName}/inspect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path })
      });
      
      const data = await response.json();
      
      if (data.error) {
        // Es un objeto de error del adaptador
        console.error('Error al inspeccionar bucket:', data.errorMessage || data.message || "Error desconocido");
        
        // Usar exactamente el mismo formato que SAGE Clouds
        setExplorerData({
          error: true,
          errorMessage: data.errorMessage || data.message || "Error desconocido",
          bucket: bucketName,
          path: path || '/',
          folders: [],
          files: []
        });
      } else {
        // Todo bien, datos normales - exactamente como en SAGE Clouds
        setExplorerData(data);
      }
    } catch (error) {
      // Error de red u otro error no controlado
      console.error('Error al inspeccionar bucket:', error);
      
      // Igual que en SAGE Clouds
      setExplorerData({
        error: true,
        errorMessage: error.message || "Error desconocido",
        bucket: bucketName,
        path: path || '/',
        folders: [],
        files: []
      });
    } finally {
      setExplorerLoading(false);
    }
  };

  // Manejar navegación a una carpeta
  const handleNavigateToFolder = (folderPath) => {
    // Actualizar la URL sin recargar la página, respetando el patrón existente
    router.push({
      pathname: router.pathname,
      query: { ...router.query, path: folderPath }
    }, undefined, { shallow: true });
  };
  
  // Manejar volver a la página de buckets
  const handleBackToBuckets = () => {
    router.push(`/admin/cloud-secrets/${id}/buckets`);
  };
  
  return (
    <div className="container mx-auto px-4 py-6">
      <Head>
        <title>{`Explorador de Bucket ${bucketName || ''} | SAGE`}</title>
      </Head>
      
      <div className="mb-6">
        <Button
          icon={ArrowLeftIcon}
          onClick={handleBackToBuckets}
          size="xs"
          color="gray"
          className="mb-4"
        >
          Volver a Buckets
        </Button>
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
          <div>
            <Title>Explorador de Bucket</Title>
            <div className="flex items-center">
              <Text className="font-medium">{bucketName}</Text>
              {secret && (
                <Text className="ml-2 text-gray-500">
                  ({secret.tipo.toUpperCase()})
                </Text>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Contenedor principal */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {/* Panel del explorador - EXACTAMENTE IGUAL que en SAGE Clouds */}
        <div className="p-4">
          {explorerLoading ? (
            <div className="flex justify-center items-center py-10">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500"></div>
            </div>
          ) : explorerData.error ? (
            <div className="text-center py-8">
              <div className="bg-red-50 p-4 rounded mb-4">
                <h3 className="text-red-800 font-medium">Error al explorar el bucket</h3>
                <p className="text-red-600 mt-1">{explorerData.errorMessage}</p>
              </div>
              
              <div className="mt-6 bg-gray-50 p-4 rounded text-left">
                <h4 className="text-gray-700 font-medium mb-2">Posibles soluciones:</h4>
                <ul className="text-sm text-gray-600 space-y-1 list-disc pl-5">
                  {/* Errores específicos de AWS S3 */}
                  {explorerProvider && explorerProvider.tipo === 's3' && explorerData.errorMessage && explorerData.errorMessage.includes('AccessDenied') && (
                    <>
                      <li>El usuario IAM no tiene permisos suficientes para acceder al bucket</li>
                      <li>Verifica la política de permisos del IAM en la consola de AWS</li>
                    </>
                  )}
                  
                  {explorerProvider && explorerProvider.tipo === 's3' && explorerData.errorMessage && explorerData.errorMessage.includes('NoSuchBucket') && (
                    <>
                      <li>El bucket especificado no existe en la cuenta</li>
                      <li>Verifica el nombre del bucket</li>
                      <li>Asegúrate de que el bucket esté en la región configurada</li>
                    </>
                  )}
                  
                  {explorerProvider && explorerProvider.tipo === 's3' && explorerData.errorMessage && explorerData.errorMessage.includes('SignatureDoesNotMatch') && (
                    <>
                      <li>Error de autenticación - firma incorrecta</li>
                      <li>Verifica que la clave de acceso y la clave secreta sean correctas</li>
                      <li>Asegúrate de que la región configurada sea la correcta</li>
                    </>
                  )}
                  
                  {/* Errores específicos de Azure */}
                  {explorerProvider && explorerProvider.tipo === 'azure' && (
                    <>
                      <li>Verifica que la cadena de conexión sea válida</li>
                      <li>Comprueba que el bucket o container exista</li>
                      <li>Verifica los permisos en el portal de Azure</li>
                    </>
                  )}
                  
                  {/* Errores específicos de GCP */}
                  {explorerProvider && explorerProvider.tipo === 'gcp' && (
                    <>
                      <li>Verifica que el archivo de credenciales sea válido</li>
                      <li>Comprueba que el bucket exista en tu proyecto</li>
                      <li>Verifica los permisos IAM para el servicio</li>
                    </>
                  )}
                  
                  {/* Errores específicos de SFTP */}
                  {explorerProvider && explorerProvider.tipo === 'sftp' && (
                    <>
                      <li>Verifica la conexión al servidor SFTP</li>
                      <li>Comprueba que el usuario y contraseña sean correctos</li>
                      <li>Asegúrate de que la ruta exista en el servidor</li>
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
                      <li>Comprueba si el servicio está experimentando problemas</li>
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
              </div>
              
              {/* Lista de carpetas - usamos folders o directories, pero no ambos */}
              {(() => {
                // Determinar qué array usar (folders o directories)
                const foldersToShow = explorerData.folders && explorerData.folders.length > 0 
                  ? explorerData.folders 
                  : (explorerData.directories && explorerData.directories.length > 0 ? explorerData.directories : []);
                
                return foldersToShow.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Carpetas</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {foldersToShow.map((folder, idx) => (
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
                );
              })()}
              
              {/* Lista de archivos */}
              {explorerData.files && explorerData.files.length > 0 && (
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
              
              {/* Mensaje de carpeta vacía */}
              {(() => {
                const hasFolders = (explorerData.folders && explorerData.folders.length > 0) || 
                                   (explorerData.directories && explorerData.directories.length > 0);
                const hasFiles = explorerData.files && explorerData.files.length > 0;
                
                if (!hasFolders && !hasFiles) {
                  return (
                    <div className="text-center py-12 border border-dashed border-gray-300 rounded-lg">
                      <FolderIcon className="mx-auto h-12 w-12 text-gray-400" />
                      <h3 className="mt-2 text-sm font-medium text-gray-900">Carpeta vacía</h3>
                      <p className="mt-1 text-sm text-gray-500">
                        Esta ubicación no contiene archivos ni carpetas.
                      </p>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}