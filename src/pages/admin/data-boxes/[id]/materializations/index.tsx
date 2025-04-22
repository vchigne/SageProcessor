import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { ArrowLeftIcon, PlusIcon } from '@heroicons/react/24/outline';
import { Button } from '../../../../../ui/components';
import { toast } from 'react-toastify';

interface Materialization {
  id: number;
  nombre: string;
  descripcion: string;
  casilla_id: number;
  configuracion: {
    formato: string;
    columnas: string[];
    primaryKey?: string[];
    partitionBy?: string[];
    destino: string;
    tablaDestino: string;
  };
}

export default function MaterializationsPage() {
  const router = useRouter();
  const { id } = router.query;
  const casilla_id = id ? parseInt(id as string) : null;
  
  const [materializations, setMaterializations] = useState<Materialization[]>([]);
  const [loading, setLoading] = useState(true);
  const [casillaInfo, setCasillaInfo] = useState<any>(null);

  useEffect(() => {
    if (!casilla_id || isNaN(casilla_id)) return;
    
    const fetchMaterializations = async () => {
      try {
        setLoading(true);
        // Obtener información de la casilla
        const casillaResponse = await fetch(`/api/admin/data-boxes/${casilla_id}`);
        
        if (casillaResponse.ok) {
          const casillaData = await casillaResponse.json();
          setCasillaInfo(casillaData);
        }
        
        // Obtener materializaciones
        const materializationsResponse = await fetch(`/api/admin/data-boxes/${casilla_id}/materializations`);
        
        if (materializationsResponse.ok) {
          const data = await materializationsResponse.json();
          setMaterializations(data);
        } else {
          console.error('Error al cargar materializaciones:', materializationsResponse.statusText);
          toast.error('Error al cargar materializaciones');
        }
      } catch (error) {
        console.error('Error:', error);
        toast.error('Error al cargar datos');
      } finally {
        setLoading(false);
      }
    };

    fetchMaterializations();
  }, [casilla_id]);

  const handleNewClick = () => {
    router.push(`/admin/data-boxes/${casilla_id}/materializations/create`);
  };

  const handleEditClick = (materializationId: number) => {
    router.push(`/admin/data-boxes/${casilla_id}/materializations/${materializationId}/edit`);
  };

  const handleDeleteClick = async (materializationId: number) => {
    if (confirm('¿Está seguro que desea eliminar esta materialización? Esta acción no se puede deshacer.')) {
      try {
        const response = await fetch(`/api/admin/materializations/${materializationId}`, {
          method: 'DELETE',
        });
        
        if (response.ok) {
          toast.success('Materialización eliminada correctamente');
          // Actualizar lista
          setMaterializations(prev => prev.filter(m => m.id !== materializationId));
        } else {
          toast.error('Error al eliminar materialización');
        }
      } catch (error) {
        console.error('Error:', error);
        toast.error('Error al eliminar materialización');
      }
    }
  };

  const handleBackClick = () => {
    router.push('/admin/data-boxes');
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center mb-6">
          <Button
            onClick={handleBackClick}
            variant="outline"
            icon={<ArrowLeftIcon className="h-4 w-4 mr-2" />}
            className="mr-4"
          >
            Volver
          </Button>
          <h1 className="text-2xl font-bold">Cargando materializaciones...</h1>
        </div>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center mb-6">
        <Button
          onClick={handleBackClick}
          variant="outline"
          icon={<ArrowLeftIcon className="h-4 w-4 mr-2" />}
          className="mr-4"
        >
          Volver
        </Button>
        <h1 className="text-2xl font-bold">
          Materializaciones - {casillaInfo?.nombre || `Casilla ${casilla_id}`}
        </h1>
      </div>

      <div className="mb-6 flex justify-end">
        <Button 
          onClick={handleNewClick}
          icon={<PlusIcon className="h-5 w-5" />}
          variant="primary"
        >
          Nueva Materialización
        </Button>
      </div>

      {materializations.length === 0 ? (
        <div className="bg-white dark:bg-dark-card rounded-lg shadow-md p-6 text-center">
          <p className="text-gray-500 dark:text-gray-400">No hay materializaciones configuradas para esta casilla.</p>
          <p className="text-gray-500 dark:text-gray-400 mt-2">Crea una nueva materialización para convertir los datos procesados en formatos optimizados como Apache Iceberg o Hudi.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {materializations.map((materialization) => (
            <div 
              key={materialization.id} 
              className="bg-white dark:bg-dark-card rounded-lg shadow-md p-6"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-xl font-semibold">{materialization.nombre}</h2>
                  <p className="text-gray-600 dark:text-gray-300 mt-1">{materialization.descripcion}</p>
                </div>
                <div className="flex space-x-2">
                  <Button 
                    onClick={() => handleEditClick(materialization.id)}
                    variant="outline"
                    size="sm"
                  >
                    Editar
                  </Button>
                  <Button 
                    onClick={() => handleDeleteClick(materialization.id)}
                    variant="danger"
                    size="sm"
                  >
                    Eliminar
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-medium">Formato:</p>
                  <p className="text-gray-600 dark:text-gray-300">
                    {materialization.configuracion.formato}
                  </p>
                </div>
                <div>
                  <p className="font-medium">Destino:</p>
                  <p className="text-gray-600 dark:text-gray-300">
                    {materialization.configuracion.destino}
                  </p>
                </div>
                <div>
                  <p className="font-medium">Tabla de destino:</p>
                  <p className="text-gray-600 dark:text-gray-300">
                    {materialization.configuracion.tablaDestino}
                  </p>
                </div>
                <div>
                  <p className="font-medium">Columnas:</p>
                  <p className="text-gray-600 dark:text-gray-300">
                    {materialization.configuracion.columnas.join(', ')}
                  </p>
                </div>
                {materialization.configuracion.primaryKey && (
                  <div>
                    <p className="font-medium">Clave primaria:</p>
                    <p className="text-gray-600 dark:text-gray-300">
                      {materialization.configuracion.primaryKey.join(', ')}
                    </p>
                  </div>
                )}
                {materialization.configuracion.partitionBy && (
                  <div>
                    <p className="font-medium">Particionado por:</p>
                    <p className="text-gray-600 dark:text-gray-300">
                      {materialization.configuracion.partitionBy.join(', ')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}