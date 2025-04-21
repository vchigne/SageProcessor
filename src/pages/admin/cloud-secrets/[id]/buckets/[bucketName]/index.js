import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { ArrowLeftIcon, FolderIcon, DocumentIcon } from '@heroicons/react/24/outline';
import { Card, Text, Title, Button, Flex } from '@tremor/react';
import { toast } from 'react-toastify';

// Componentes reutilizables
import LoadingSpinner from '../../../../../../components/common/LoadingSpinner';
import BreadcrumbNav from '../../../../../../components/nav/BreadcrumbNav';
import AdminLayout from '../../../../../../components/layouts/AdminLayout';

export default function BucketExplorer() {
  const router = useRouter();
  const { id, bucketName, path } = router.query;
  
  const currentPath = path || '';
  
  const [loading, setLoading] = useState(true);
  const [secret, setSecret] = useState(null);
  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [error, setError] = useState(null);
  
  // Cargar detalles del secreto y contenido del bucket
  useEffect(() => {
    if (!id || !bucketName) return;
    
    async function loadData() {
      setLoading(true);
      setError(null);
      
      try {
        // Cargar información del secreto
        const secretRes = await fetch(`/api/cloud-secrets/${id}`);
        
        if (!secretRes.ok) {
          throw new Error(`Error al cargar secreto: ${secretRes.status}`);
        }
        
        const secretData = await secretRes.json();
        setSecret(secretData);
        
        // Construir URL con parámetros de consulta para la ruta actual
        let inspectUrl = `/api/cloud-secrets/${id}/buckets/${bucketName}/inspect`;
        if (currentPath) {
          inspectUrl += `?path=${encodeURIComponent(currentPath)}`;
        }
        
        // Inspeccionar contenido del bucket
        const contentRes = await fetch(inspectUrl);
        
        if (!contentRes.ok) {
          throw new Error(`Error al inspeccionar bucket: ${contentRes.status}`);
        }
        
        const contentData = await contentRes.json();
        console.log('Contenido del bucket:', contentData);
        
        if (contentData.error) {
          setError(contentData.errorMessage || 'Error al inspeccionar bucket');
          setFiles([]);
          setFolders([]);
        } else {
          setFiles(contentData.files || []);
          setFolders(contentData.folders || []);
        }
      } catch (err) {
        console.error('Error al cargar datos:', err);
        setError(err.message);
        toast.error(`Error: ${err.message}`);
      } finally {
        setLoading(false);
      }
    }
    
    loadData();
  }, [id, bucketName, currentPath]);
  
  // Manejar navegación a un subdirectorio
  const handleFolderClick = (folderPath) => {
    // Construir la nueva URL con el parámetro de ruta
    router.push({
      pathname: router.pathname,
      query: { 
        ...router.query,
        path: folderPath
      }
    });
  };
  
  // Manejar retroceso a directorio anterior
  const handleGoBack = () => {
    if (!currentPath) {
      // Si estamos en la raíz, volver a la lista de buckets
      router.push(`/admin/cloud-secrets/${id}/buckets`);
      return;
    }
    
    // Navegar al directorio padre
    const pathParts = currentPath.split('/');
    pathParts.pop(); // Eliminar el último segmento
    const parentPath = pathParts.join('/');
    
    router.push({
      pathname: router.pathname,
      query: { 
        ...router.query,
        path: parentPath || null // Si queda vacío, eliminamos el parámetro
      }
    });
  };
  
  // Formatear tamaño en bytes a una representación legible
  const formatSize = (bytes) => {
    if (bytes === undefined || bytes === null) return 'N/A';
    
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };
  
  // Formatear fecha ISO
  const formatDate = (isoDate) => {
    if (!isoDate) return 'N/A';
    try {
      return new Date(isoDate).toLocaleString();
    } catch (e) {
      return isoDate;
    }
  };
  
  // Generar breadcrumbs
  const generateBreadcrumbs = () => {
    const items = [
      { name: 'Inicio', href: '/' },
      { name: 'Administración', href: '/admin' },
      { name: 'Secretos Cloud', href: '/admin/cloud-secrets' },
      { name: secret?.nombre || 'Secreto', href: `/admin/cloud-secrets/${id}` },
      { name: 'Buckets', href: `/admin/cloud-secrets/${id}/buckets` },
      { name: bucketName, href: `/admin/cloud-secrets/${id}/buckets/${bucketName}` },
    ];
    
    // Agregar segmentos de ruta si hay una ruta actual
    if (currentPath) {
      const pathSegments = currentPath.split('/');
      let accumulatedPath = '';
      
      pathSegments.forEach((segment, index) => {
        if (!segment) return; // Saltar segmentos vacíos
        
        accumulatedPath += (accumulatedPath ? '/' : '') + segment;
        items.push({
          name: segment,
          href: `/admin/cloud-secrets/${id}/buckets/${bucketName}?path=${encodeURIComponent(accumulatedPath)}`
        });
      });
    }
    
    return items;
  };
  
  return (
    <AdminLayout>
      <Head>
        <title>Explorador: {bucketName} | SAGE</title>
      </Head>
      
      <BreadcrumbNav items={generateBreadcrumbs()} />
      
      <div className="py-4">
        <Button
          icon={ArrowLeftIcon}
          onClick={handleGoBack}
          size="xs"
          color="gray"
          className="mb-4"
        >
          {currentPath ? 'Subir un nivel' : 'Volver a Buckets'}
        </Button>
        
        <div className="mb-6">
          <Title>Explorador de Bucket: {bucketName}</Title>
          {secret && (
            <Text>
              Secreto: <span className="font-medium">{secret.nombre}</span>
              {' - '}
              Tipo: <span className="font-medium">{secret.tipo.toUpperCase()}</span>
            </Text>
          )}
          {currentPath && (
            <Text className="mt-1 text-gray-500">
              Ruta actual: <span className="font-mono bg-gray-100 px-1 rounded">{currentPath || '/'}</span>
            </Text>
          )}
        </div>
        
        {loading ? (
          <LoadingSpinner message="Cargando contenido..." />
        ) : error ? (
          <Card className="mt-4">
            <div className="flex items-center text-red-500 mb-2">
              <Text>Error al cargar contenido del bucket</Text>
            </div>
            <Text>{error}</Text>
          </Card>
        ) : (
          <>
            {folders.length === 0 && files.length === 0 ? (
              <Card className="mt-4">
                <Text>Este directorio está vacío.</Text>
              </Card>
            ) : (
              <div className="space-y-4 mt-4">
                {folders.length > 0 && (
                  <div>
                    <Title className="text-md mb-2">Carpetas</Title>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {folders.map((folder) => (
                        <Card 
                          key={folder.path} 
                          className="cursor-pointer hover:bg-gray-50 hover:shadow-md transition-all"
                          onClick={() => handleFolderClick(folder.path)}
                        >
                          <Flex alignItems="center">
                            <FolderIcon className="h-5 w-5 text-yellow-500 mr-2" />
                            <div>
                              <Text>{folder.name}</Text>
                            </div>
                          </Flex>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
                
                {files.length > 0 && (
                  <div>
                    <Title className="text-md mb-2">Archivos</Title>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left text-gray-700">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                          <tr>
                            <th className="px-4 py-2">Nombre</th>
                            <th className="px-4 py-2">Tamaño</th>
                            <th className="px-4 py-2">Tipo</th>
                            <th className="px-4 py-2">Última modificación</th>
                          </tr>
                        </thead>
                        <tbody>
                          {files.map((file) => (
                            <tr key={file.path} className="bg-white border-b hover:bg-gray-50">
                              <td className="px-4 py-2 flex items-center">
                                <DocumentIcon className="h-4 w-4 text-blue-500 mr-2" />
                                {file.name}
                              </td>
                              <td className="px-4 py-2">{formatSize(file.size)}</td>
                              <td className="px-4 py-2">{file.contentType || 'N/A'}</td>
                              <td className="px-4 py-2">{formatDate(file.lastModified)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}