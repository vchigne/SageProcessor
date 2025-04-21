import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import { ArrowLeftIcon, InformationCircleIcon, FolderIcon, FolderOpenIcon, PlusCircleIcon } from '@heroicons/react/24/outline';
import { Card, Text, Title, Button, Flex } from '@tremor/react';
import { toast } from 'react-toastify';

export default function CloudSecretBuckets() {
  const router = useRouter();
  const { id } = router.query;
  
  const [loading, setLoading] = useState(true);
  const [secret, setSecret] = useState(null);
  const [buckets, setBuckets] = useState([]);
  const [error, setError] = useState(null);
  const [newBucketName, setNewBucketName] = useState('');
  
  // Cargar detalles del secreto y buckets
  useEffect(() => {
    if (!id) return;
    
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
        
        // Cargar buckets disponibles
        const bucketsRes = await fetch(`/api/cloud-secrets/${id}/buckets`);
        
        if (!bucketsRes.ok) {
          throw new Error(`Error al cargar buckets: ${bucketsRes.status}`);
        }
        
        const bucketsData = await bucketsRes.json();
        console.log('Buckets recibidos:', bucketsData);
        
        if (bucketsData.success) {
          setBuckets(bucketsData.buckets || []);
        } else {
          setError(bucketsData.message || 'Error al cargar buckets');
          setBuckets([]);
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
  }, [id]);
  
  // Manejar volver a la página de secretos
  const handleBack = () => {
    router.push('/admin/cloud-secrets');
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
  
  // Crear un nuevo bucket
  const createBucket = async (bucketName) => {
    if (!bucketName) return;
    
    // Validar el nombre del bucket (letras minúsculas, números, puntos y guiones)
    if (!/^[a-z0-9.-]+$/.test(bucketName)) {
      toast.error('Nombre de bucket inválido. Use sólo letras minúsculas, números, puntos y guiones.');
      return;
    }
    
    setLoading(true);
    try {
      toast.info(`Creando bucket "${bucketName}"...`);
      
      const response = await fetch(`/api/cloud-secrets/${id}/buckets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucketName })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        let errorMessage = errorData.error || errorData.message || 'Error al crear bucket';
        
        // Si hay detalles adicionales en la respuesta, los incluimos
        if (errorData.details) {
          console.log('Detalles del error:', errorData.details);
          if (typeof errorData.details === 'object') {
            // Formatear detalles específicos (por ejemplo, para buckets duplicados)
            if (errorData.details.error && errorData.details.error.includes('already exists')) {
              errorMessage = `El bucket "${bucketName}" ya existe. Elija otro nombre.`;
            }
          }
        }
        
        // En lugar de lanzar excepción, gestionamos el error con toast y terminamos la función
        toast.error(`Error al crear bucket: ${errorMessage}`);
        setLoading(false);
        return; // Salimos de la función sin crashear
      }
      
      const result = await response.json();
      
      toast.success(`Bucket "${bucketName}" creado exitosamente`);
      
      // Resetear el campo del nombre del bucket solo cuando es exitoso
      setNewBucketName('');
      
      // Recargar la lista de buckets
      const bucketsRes = await fetch(`/api/cloud-secrets/${id}/buckets`);
      const bucketsData = await bucketsRes.json();
      
      if (bucketsData.success) {
        setBuckets(bucketsData.buckets || []);
      }
    } catch (error) {
      console.error('Error al crear bucket:', error);
      toast.error(`Error al crear bucket: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Generar breadcrumbs
  const breadcrumbs = [
    { name: 'Inicio', href: '/' },
    { name: 'Administración', href: '/admin' },
    { name: 'Secretos Cloud', href: '/admin/cloud-secrets' },
    { name: secret?.nombre || 'Secreto', href: `/admin/cloud-secrets/${id}` },
    { name: 'Buckets', href: `/admin/cloud-secrets/${id}/buckets` },
  ];
  
  return (
    <div className="container mx-auto px-4 py-6">
      <Head>
        <title>{`Buckets para ${secret?.nombre || 'Secreto'} | SAGE`}</title>
      </Head>
      
      <div className="py-4">
        <Button
          icon={ArrowLeftIcon}
          onClick={handleBack}
          size="xs"
          color="gray"
          className="mb-4"
        >
          Volver a Secretos Cloud
        </Button>
        
        <div className="mb-6">
          <Title>Buckets disponibles</Title>
          {secret && (
            <Text>
              Secreto: <span className="font-medium">{secret.nombre}</span>
              {' - '}
              Tipo: <span className="font-medium">{secret.tipo.toUpperCase()}</span>
            </Text>
          )}
        </div>
        
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
          </div>
        ) : error ? (
          <Card className="mt-4">
            <div className="flex items-center text-red-500 mb-2">
              <InformationCircleIcon className="h-5 w-5 mr-2" />
              <Text>Error al cargar buckets</Text>
            </div>
            <Text>{error}</Text>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
              <div className="md:col-span-2">
                {buckets.length === 0 ? (
                  <Card className="h-full">
                    <Text>No se encontraron buckets disponibles.</Text>
                  </Card>
                ) : (
                  <Card className="h-full">
                    <div className="mb-2 flex justify-between items-center">
                      <h4 className="text-sm font-medium text-gray-700">Buckets disponibles</h4>
                    </div>
                    <div className="border border-gray-200 rounded-md overflow-hidden">
                      <ul className="divide-y divide-gray-200">
                        {buckets.map((bucket) => (
                          <li key={bucket.name} className="px-4 py-3 hover:bg-gray-50">
                            <div className="flex justify-between items-center">
                              <div className="flex items-center">
                                <FolderIcon className="h-5 w-5 text-yellow-500 mr-2" />
                                <span className="text-sm font-medium text-gray-900">{bucket.name}</span>
                              </div>
                              <Link 
                                href={`/admin/cloud-secrets/${id}/buckets/${bucket.name}`}
                                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center"
                              >
                                <FolderOpenIcon className="h-4 w-4 mr-1" />
                                Explorar
                              </Link>
                            </div>
                            {bucket.creationDate && (
                              <div className="ml-7 text-xs text-gray-500">
                                Creado: {formatDate(bucket.creationDate)}
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </Card>
                )}
              </div>
              
              {/* Panel lateral para crear bucket */}
              <div className="md:col-span-1">
                <Card className="h-full">
                  <div className="mb-2">
                    <h4 className="text-sm font-medium text-gray-700">Crear nuevo bucket</h4>
                  </div>
                  <Text className="text-xs text-gray-500 mb-4">
                    Puede crear un nuevo bucket en el proveedor de nube seleccionado.
                  </Text>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    if (newBucketName && newBucketName.trim()) {
                      createBucket(newBucketName.trim());
                      // No resetear el nombre del bucket aquí
                      // Solo se reseteará cuando la creación sea exitosa
                    }
                  }}>
                    <div className="mb-3">
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        placeholder="Nombre del bucket"
                        value={newBucketName}
                        onChange={(e) => setNewBucketName(e.target.value)}
                        required
                      />
                    </div>
                    <Button 
                      type="submit"
                      color="indigo"
                      size="sm"
                      className="w-full flex items-center justify-center"
                      disabled={!newBucketName.trim()}
                    >
                      <PlusCircleIcon className="h-4 w-4 mr-1" />
                      Crear bucket
                    </Button>
                  </form>
                </Card>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}