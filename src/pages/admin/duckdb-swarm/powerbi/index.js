import React, { useState, useEffect } from 'react';
import { 
  PlusIcon, 
  PencilIcon, 
  TrashIcon,
  ArrowPathIcon,
  ArrowUpOnSquareIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationCircleIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import Link from 'next/link';

const PowerBIDatasets = () => {
  const [datasets, setDatasets] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch datasets
  useEffect(() => {
    const fetchDatasets = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/admin/duckdb-swarm/powerbi');
        const data = await response.json();
        setDatasets(data.datasets || []);
      } catch (error) {
        console.error('Error fetching datasets:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDatasets();

    // Refresh data every 30 seconds
    const interval = setInterval(fetchDatasets, 30000);
    return () => clearInterval(interval);
  }, []);

  // Handle dataset deletion
  const handleDeleteDataset = async (id) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar este dataset? Esta acción no se puede deshacer.')) {
      try {
        const response = await fetch(`/api/admin/duckdb-swarm/powerbi?id=${id}`, {
          method: 'DELETE'
        });

        if (response.ok) {
          setDatasets(prevDatasets => prevDatasets.filter(dataset => dataset.id !== id));
          alert('Dataset eliminado correctamente');
        } else {
          const data = await response.json();
          alert('Error al eliminar dataset: ' + (data.error || 'Error desconocido'));
        }
      } catch (error) {
        console.error('Error deleting dataset:', error);
        alert('Error al eliminar dataset');
      }
    }
  };

  // Handle dataset refresh
  const handleRefreshDataset = async (id, name) => {
    if (window.confirm(`¿Estás seguro de que deseas refrescar el dataset "${name}"?`)) {
      try {
        const response = await fetch(`/api/admin/duckdb-swarm/powerbi?id=${id}&action=refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({})
        });

        if (response.ok) {
          const data = await response.json();
          alert(`Dataset refrescado correctamente. Duración: ${data.duration_ms}ms`);
          
          // Refrescar la lista de datasets
          const datasetsResponse = await fetch('/api/admin/duckdb-swarm/powerbi');
          const datasetsData = await datasetsResponse.json();
          setDatasets(datasetsData.datasets || []);
        } else {
          const data = await response.json();
          alert('Error al refrescar dataset: ' + (data.error || 'Error desconocido'));
        }
      } catch (error) {
        console.error('Error refreshing dataset:', error);
        alert('Error al refrescar dataset');
      }
    }
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('es', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  // Get status badge based on dataset status
  const getStatusBadge = (status) => {
    switch (status) {
      case 'active':
        return <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200">Activo</span>;
      case 'inactive':
        return <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-200">Inactivo</span>;
      case 'error':
        return <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900 dark:text-red-200">Error</span>;
      case 'refreshing':
        return <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200">Refrescando</span>;
      default:
        return <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-200">{status || 'Desconocido'}</span>;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Datasets PowerBI</h1>
        <Link href="/admin/duckdb-swarm/powerbi/create" className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
          <PlusIcon className="h-5 w-5 mr-2" />
          Nuevo Dataset
        </Link>
      </div>
      
      <div className="bg-white dark:bg-gray-800 shadow overflow-hidden rounded-lg">
        <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">
            Datasets PowerBI
          </h2>
          <button
            onClick={() => setLoading(true)}
            className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <ArrowPathIcon className="h-4 w-4 mr-1" />
            Actualizar
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Nombre
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Descripción
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Último Refresco
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Programación
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center">
                    <div className="flex justify-center">
                      <ArrowPathIcon className="h-5 w-5 text-gray-400 animate-spin" />
                    </div>
                  </td>
                </tr>
              ) : datasets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                    No hay datasets definidos
                  </td>
                </tr>
              ) : (
                datasets.map((dataset) => (
                  <tr key={dataset.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      <Link href={`/admin/duckdb-swarm/powerbi/${dataset.id}`} className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300">
                        {dataset.name}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {dataset.description || 'Sin descripción'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {getStatusBadge(dataset.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(dataset.last_refresh)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {dataset.refresh_schedule || 'Manual'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleRefreshDataset(dataset.id, dataset.name)}
                          className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                          title="Refrescar Dataset"
                        >
                          <ArrowUpOnSquareIcon className="h-5 w-5" />
                        </button>
                        <Link 
                          href={`/admin/duckdb-swarm/powerbi/${dataset.id}/edit`}
                          className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                          title="Editar"
                        >
                          <PencilIcon className="h-5 w-5" />
                        </Link>
                        <button
                          onClick={() => handleDeleteDataset(dataset.id)}
                          className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                          title="Eliminar"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="mt-8 p-6 bg-white dark:bg-gray-800 shadow overflow-hidden rounded-lg">
        <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Integración con PowerBI
        </h2>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          Esta integración permite crear datasets para PowerBI a partir de consultas DuckDB, facilitando el 
          análisis avanzado y la visualización interactiva de datos.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 dark:text-white mb-2">Creación de Datasets</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Define tablas de datos para PowerBI usando consultas SQL en DuckDB.
            </p>
          </div>
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 dark:text-white mb-2">Refresco Programado</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Configura refrescos automáticos para mantener tus datos actualizados.
            </p>
          </div>
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 dark:text-white mb-2">Carga Incremental</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Optimiza el rendimiento con cargas incrementales para grandes volúmenes de datos.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PowerBIDatasets;