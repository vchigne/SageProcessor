import React, { useState, useEffect } from 'react';
import { 
  PlayIcon, 
  PencilIcon, 
  TrashIcon,
  ArrowPathIcon,
  CalendarIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';
import Link from 'next/link';

const DuckDBPipelines = () => {
  const [pipelines, setPipelines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [executions, setExecutions] = useState([]);
  const [loadingExecutions, setLoadingExecutions] = useState(true);
  const [activeTab, setActiveTab] = useState('pipelines');

  // Fetch pipelines and executions
  useEffect(() => {
    const fetchPipelines = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/admin/duckdb-swarm/pipelines');
        const data = await response.json();
        setPipelines(data.pipelines || []);
      } catch (error) {
        console.error('Error fetching pipelines:', error);
      } finally {
        setLoading(false);
      }
    };

    const fetchExecutions = async () => {
      try {
        setLoadingExecutions(true);
        const response = await fetch('/api/admin/duckdb-swarm/executions');
        const data = await response.json();
        setExecutions(data.executions || []);
      } catch (error) {
        console.error('Error fetching executions:', error);
      } finally {
        setLoadingExecutions(false);
      }
    };

    fetchPipelines();
    fetchExecutions();

    // Refresh data every 30 seconds
    const interval = setInterval(() => {
      fetchPipelines();
      fetchExecutions();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Handle pipeline execution
  const handleExecutePipeline = async (id) => {
    if (window.confirm('¿Estás seguro de que deseas ejecutar este pipeline?')) {
      try {
        const response = await fetch('/api/admin/duckdb-swarm/executions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            pipeline_id: id,
            triggered_by: 'web_user'
          })
        });

        const data = await response.json();
        
        if (response.ok) {
          alert('Pipeline ejecutado correctamente. ID de ejecución: ' + data.execution_id);
          
          // Refresh executions list
          const execResponse = await fetch('/api/admin/duckdb-swarm/executions');
          const execData = await execResponse.json();
          setExecutions(execData.executions || []);
        } else {
          alert('Error al ejecutar pipeline: ' + (data.error || 'Error desconocido'));
        }
      } catch (error) {
        console.error('Error executing pipeline:', error);
        alert('Error al ejecutar pipeline');
      }
    }
  };

  // Handle pipeline deletion
  const handleDeletePipeline = async (id) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar este pipeline? Esta acción no se puede deshacer.')) {
      try {
        const response = await fetch(`/api/admin/duckdb-swarm/pipelines?id=${id}`, {
          method: 'DELETE'
        });

        if (response.ok) {
          setPipelines(prevPipelines => prevPipelines.filter(pipeline => pipeline.id !== id));
          alert('Pipeline eliminado correctamente');
        } else {
          const data = await response.json();
          alert('Error al eliminar pipeline: ' + (data.error || 'Error desconocido'));
        }
      } catch (error) {
        console.error('Error deleting pipeline:', error);
        alert('Error al eliminar pipeline');
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

  // Get status icon based on execution status
  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'running':
        return <ArrowPathIcon className="h-5 w-5 text-blue-500 animate-spin" />;
      case 'failed':
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <ExclamationCircleIcon className="h-5 w-5 text-yellow-500" />;
      default:
        return <ClockIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">DuckDB Pipelines</h1>
      
      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
        <button
          className={`py-2 px-4 font-medium ${activeTab === 'pipelines' 
            ? 'text-blue-600 border-b-2 border-blue-600 dark:text-blue-500 dark:border-blue-500' 
            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}`}
          onClick={() => setActiveTab('pipelines')}
        >
          Pipelines
        </button>
        <button
          className={`py-2 px-4 font-medium ${activeTab === 'executions' 
            ? 'text-blue-600 border-b-2 border-blue-600 dark:text-blue-500 dark:border-blue-500' 
            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}`}
          onClick={() => setActiveTab('executions')}
        >
          Ejecuciones
        </button>
      </div>
      
      {/* Create New Pipeline Button */}
      <div className="flex justify-end mb-4">
        <Link href="/admin/duckdb-swarm/pipelines/create" className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
          Crear Nuevo Pipeline
        </Link>
      </div>
      
      {/* Pipelines Tab */}
      {activeTab === 'pipelines' && (
        <div className="bg-white dark:bg-gray-800 shadow overflow-hidden rounded-lg">
          <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">
              Pipelines Definidos
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
                    Programación
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Última Ejecución
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center">
                      <div className="flex justify-center">
                        <ArrowPathIcon className="h-5 w-5 text-gray-400 animate-spin" />
                      </div>
                    </td>
                  </tr>
                ) : pipelines.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                      No hay pipelines definidos
                    </td>
                  </tr>
                ) : (
                  pipelines.map((pipeline) => {
                    // Find most recent execution for this pipeline
                    const recentExecution = executions.find(exec => exec.pipeline.id === pipeline.id);
                    
                    return (
                      <tr key={pipeline.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                          <Link href={`/admin/duckdb-swarm/pipelines/${pipeline.id}`} className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300">
                            {pipeline.name}
                          </Link>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                          {pipeline.description || 'Sin descripción'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          <div className="flex items-center">
                            <CalendarIcon className="h-4 w-4 mr-1 text-gray-400" />
                            {pipeline.schedule?.type === 'on_demand' 
                              ? 'Bajo Demanda' 
                              : pipeline.schedule?.cron 
                                ? `Cron: ${pipeline.schedule.cron}` 
                                : 'Sin programación'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {recentExecution ? (
                            <div className="flex items-center">
                              {getStatusIcon(recentExecution.status)}
                              <span className="ml-1">{formatDate(recentExecution.completed_at || recentExecution.started_at)}</span>
                            </div>
                          ) : (
                            <span>Sin ejecuciones</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleExecutePipeline(pipeline.id)}
                              className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                              title="Ejecutar"
                            >
                              <PlayIcon className="h-5 w-5" />
                            </button>
                            <Link 
                              href={`/admin/duckdb-swarm/pipelines/${pipeline.id}/edit`}
                              className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                              title="Editar"
                            >
                              <PencilIcon className="h-5 w-5" />
                            </Link>
                            <button
                              onClick={() => handleDeletePipeline(pipeline.id)}
                              className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                              title="Eliminar"
                            >
                              <TrashIcon className="h-5 w-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {/* Executions Tab */}
      {activeTab === 'executions' && (
        <div className="bg-white dark:bg-gray-800 shadow overflow-hidden rounded-lg">
          <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">
              Historial de Ejecuciones
            </h2>
            <button
              onClick={() => setLoadingExecutions(true)}
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
                    ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Pipeline
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Iniciada
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Completada
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Métricas
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Detalles
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {loadingExecutions ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 text-center">
                      <div className="flex justify-center">
                        <ArrowPathIcon className="h-5 w-5 text-gray-400 animate-spin" />
                      </div>
                    </td>
                  </tr>
                ) : executions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                      No hay ejecuciones registradas
                    </td>
                  </tr>
                ) : (
                  executions.map((execution) => (
                    <tr key={execution.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        <span className="font-mono">{execution.id.substring(0, 8)}...</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        <Link 
                          href={`/admin/duckdb-swarm/pipelines/${execution.pipeline.id}`}
                          className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          {execution.pipeline.name}
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        <div className="flex items-center">
                          {getStatusIcon(execution.status)}
                          <span className="ml-1 capitalize">{execution.status}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(execution.started_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {execution.completed_at ? formatDate(execution.completed_at) : 'En progreso...'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                        <div>Duración: {execution.duration_ms ? `${(execution.duration_ms / 1000).toFixed(2)}s` : 'N/A'}</div>
                        <div>Filas: {execution.rows_processed || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <Link
                          href={`/admin/duckdb-swarm/executions/${execution.id}`}
                          className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          Ver Detalles
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default DuckDBPipelines;