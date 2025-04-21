import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import { ArrowLeftIcon, FolderIcon, DocumentIcon, ArrowUpIcon, ArrowDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { Card, Text, Title, Button, Flex, Metric } from '@tremor/react';
import { toast } from 'react-toastify';
import { formatBytes } from '../../../../../../utils/formatters';

export default function BucketExplorer() {
  const router = useRouter();
  const { id, bucketName } = router.query;
  
  const [loading, setLoading] = useState(true);
  const [secret, setSecret] = useState(null);
  const [currentPath, setCurrentPath] = useState('');
  const [contents, setContents] = useState(null);
  const [error, setError] = useState(null);
  
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
      } catch (err) {
        console.error('Error al cargar datos del secreto:', err);
        toast.error(`Error: ${err.message}`);
      }
    }
    
    loadSecretDetails();
  }, [id]);
  
  // Cargar contenidos del bucket
  useEffect(() => {
    if (!id || !bucketName) return;
    
    const path = router.query.path || '';
    setCurrentPath(path);
    
    async function loadBucketContents() {
      setLoading(true);
      setError(null);
      
      try {
        // Construir la URL con parámetros de consulta
        const queryParams = new URLSearchParams({ path });
        const inspectUrl = `/api/cloud-secrets/${id}/buckets/${encodeURIComponent(bucketName)}/inspect?${queryParams}`;
        
        console.log('Consultando contenido en:', inspectUrl);
        const contentsRes = await fetch(inspectUrl);
        
        if (!contentsRes.ok) {
          throw new Error(`Error al cargar contenido: ${contentsRes.status}`);
        }
        
        const contentsData = await contentsRes.json();
        console.log('Respuesta de API:', contentsData);
        
        if (contentsData.success) {
          setContents(contentsData);
        } else {
          setError(contentsData.message || 'Error al cargar contenido del bucket');
          setContents(null);
        }
      } catch (err) {
        console.error('Error al cargar contenido del bucket:', err);
        setError(err.message);
        toast.error(`Error: ${err.message}`);
      } finally {
        setLoading(false);
      }
    }
    
    loadBucketContents();
  }, [id, bucketName, router.query.path]);
  
  // Manejar navegación a una carpeta
  const handleNavigateToFolder = (folderPath) => {
    // Actualizar la URL sin recargar la página
    router.push({
      pathname: router.pathname,
      query: { ...router.query, path: folderPath }
    }, undefined, { shallow: true });
  };
  
  // Manejar volver a la página de buckets
  const handleBackToBuckets = () => {
    router.push(`/admin/cloud-secrets/${id}/buckets`);
  };
  
  // Manejar navegación a la carpeta superior
  const handleNavigateUp = () => {
    if (!currentPath) return; // Ya estamos en la raíz
    
    const parts = currentPath.split('/');
    // Eliminar la última parte y reconstruir la ruta
    parts.pop();
    const newPath = parts.join('/');
    
    // Actualizar la URL
    router.push({
      pathname: router.pathname,
      query: { ...router.query, path: newPath }
    }, undefined, { shallow: true });
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
  
  // Formatear ruta para navegación por migajas
  const formatBreadcrumbs = () => {
    if (!currentPath) {
      return [{ name: '/', path: '' }];
    }
    
    const parts = currentPath.split('/').filter(Boolean);
    const breadcrumbs = [{ name: '/', path: '' }];
    
    let currentBuildPath = '';
    for (const part of parts) {
      currentBuildPath += (currentBuildPath ? '/' : '') + part;
      breadcrumbs.push({
        name: part,
        path: currentBuildPath
      });
    }
    
    return breadcrumbs;
  };
  
  // Generar breadcrumbs
  const pageBreadcrumbs = [
    { name: 'Inicio', href: '/' },
    { name: 'Administración', href: '/admin' },
    { name: 'Secretos Cloud', href: '/admin/cloud-secrets' },
    { name: secret?.nombre || 'Secreto', href: `/admin/cloud-secrets/${id}` },
    { name: 'Buckets', href: `/admin/cloud-secrets/${id}/buckets` },
    { name: bucketName || 'Bucket', href: `/admin/cloud-secrets/${id}/buckets/${bucketName}` },
  ];
  
  // Icono basado en el tipo de archivo
  const getFileIcon = (item) => {
    if (item.isDirectory) {
      return <FolderIcon className="h-5 w-5 text-yellow-500" />;
    }
    
    return <DocumentIcon className="h-5 w-5 text-blue-500" />;
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
          
          {/* Navegación por migajas de pan */}
          <div className="mt-2 md:mt-0 flex items-center overflow-x-auto whitespace-nowrap">
            {formatBreadcrumbs().map((crumb, index, arr) => (
              <div key={crumb.path} className="flex items-center">
                <Button
                  size="xs"
                  variant={index === arr.length - 1 ? "light" : "light"}
                  color={index === arr.length - 1 ? "indigo" : "gray"}
                  onClick={() => handleNavigateToFolder(crumb.path)}
                  className="px-2 py-1"
                >
                  {crumb.name || '/'}
                </Button>
                {index < arr.length - 1 && (
                  <ChevronRightIcon className="h-3 w-3 text-gray-400 mx-1" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
        </div>
      ) : error ? (
        <Card className="mt-4">
          <div className="flex items-center text-red-500 mb-2">
            <div className="h-5 w-5 mr-2"></div>
            <Text>Error al cargar contenido</Text>
          </div>
          <Text>{error}</Text>
        </Card>
      ) : contents ? (
        <Card className="overflow-hidden">
          {currentPath && (
            <div className="p-4 border-b border-gray-200">
              <Button
                icon={ArrowUpIcon}
                size="xs"
                color="gray"
                onClick={handleNavigateUp}
              >
                Subir un nivel
              </Button>
            </div>
          )}
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nombre
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tamaño
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Última modificación
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {contents.contents && contents.contents.folders && contents.contents.folders.map((dir) => (
                  <tr key={`dir-${dir.name}`} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <FolderIcon className="h-5 w-5 text-yellow-500 mr-2" />
                        <button 
                          onClick={() => handleNavigateToFolder(dir.path)} 
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          {dir.name}/
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      -
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {dir.lastModified ? formatDate(dir.lastModified) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button 
                        onClick={() => handleNavigateToFolder(dir.path)}
                        className="text-indigo-600 hover:text-indigo-900 mr-3"
                      >
                        Explorar
                      </button>
                    </td>
                  </tr>
                ))}
                
                {contents.contents && contents.contents.files && contents.contents.files.map((file) => (
                  <tr key={`file-${file.name}`} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <DocumentIcon className="h-5 w-5 text-blue-500 mr-2" />
                        <span className="text-gray-900">{file.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {typeof file.size === 'number' ? formatBytes(file.size) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {file.lastModified ? formatDate(file.lastModified) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {file.url && (
                        <a 
                          href={file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          Ver
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
                
                {(!contents.contents?.folders?.length && !contents.contents?.files?.length) && (
                  <tr>
                    <td colSpan="4" className="px-6 py-4 text-center text-sm text-gray-500">
                      No hay contenido en esta ubicación
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card>
          <Text>No se pudo cargar el contenido del bucket.</Text>
        </Card>
      )}
    </div>
  );
}