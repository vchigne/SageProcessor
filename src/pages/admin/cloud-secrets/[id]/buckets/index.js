import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import { ArrowLeftIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import { Card, Text, Title, Button, Flex } from '@tremor/react';
import { toast } from 'react-toastify';

// Componentes reutilizables
import LoadingSpinner from '../../../../../components/common/LoadingSpinner';
import BreadcrumbNav from '../../../../../components/nav/BreadcrumbNav';
import AdminLayout from '../../../../../components/layouts/AdminLayout';

export default function CloudSecretBuckets() {
  const router = useRouter();
  const { id } = router.query;
  
  const [loading, setLoading] = useState(true);
  const [secret, setSecret] = useState(null);
  const [buckets, setBuckets] = useState([]);
  const [error, setError] = useState(null);
  
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
  
  // Generar breadcrumbs
  const breadcrumbs = [
    { name: 'Inicio', href: '/' },
    { name: 'Administración', href: '/admin' },
    { name: 'Secretos Cloud', href: '/admin/cloud-secrets' },
    { name: secret?.nombre || 'Secreto', href: `/admin/cloud-secrets/${id}` },
    { name: 'Buckets', href: `/admin/cloud-secrets/${id}/buckets` },
  ];
  
  return (
    <AdminLayout>
      <Head>
        <title>Buckets para {secret?.nombre || 'Secreto'} | SAGE</title>
      </Head>
      
      <BreadcrumbNav items={breadcrumbs} />
      
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
          <LoadingSpinner message="Cargando buckets..." />
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
            {buckets.length === 0 ? (
              <Card className="mt-4">
                <Text>No se encontraron buckets disponibles.</Text>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                {buckets.map((bucket) => (
                  <Card key={bucket.name} className="hover:shadow-md transition-shadow">
                    <Flex alignItems="start" className="h-full">
                      <div className="flex-grow">
                        <Title className="text-lg">{bucket.name}</Title>
                        {bucket.creationDate && (
                          <Text className="text-sm text-gray-500">
                            Creado: {formatDate(bucket.creationDate)}
                          </Text>
                        )}
                        <div className="mt-4">
                          <Link 
                            href={`/admin/cloud-secrets/${id}/buckets/${bucket.name}`} 
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            Explorar bucket →
                          </Link>
                        </div>
                      </div>
                    </Flex>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}