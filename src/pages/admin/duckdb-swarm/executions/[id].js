import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { 
  ArrowLeftIcon, 
  CheckCircleIcon, 
  XCircleIcon,
  ClockIcon,
  ExclamationCircleIcon,
  ArrowPathIcon,
  DocumentTextIcon,
  CodeBracketIcon
} from '@heroicons/react/24/outline';

const ExecutionDetails = () => {
  const router = useRouter();
  const { id } = router.query;
  const [execution, setExecution] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('details');
  
  useEffect(() => {
    const fetchExecutionDetails = async () => {
      if (!id) return;
      
      try {
        setLoading(true);
        const response = await fetch(`/api/admin/duckdb-swarm/executions?id=${id}`);
        
        if (response.ok) {
          const data = await response.json();
          setExecution(data);
        } else {
          console.error('Error fetching execution:', response.statusText);
        }
      } catch (error) {
        console.error('Error fetching execution details:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchExecutionDetails();
    
    // Auto-refresh for running executions
    let interval;
    if (execution && execution.status === 'running') {
      interval = setInterval(fetchExecutionDetails, 5000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [id, execution?.status]);
  
  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('es', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
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
  
  // Get log level badge color
  const getLogLevelBadge = (level) => {
    switch (level.toUpperCase()) {
      case 'ERROR':
        return <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">ERROR</span>;
      case 'WARNING':
        return <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">WARNING</span>;
      case 'INFO':
        return <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">INFO</span>;
      case 'DEBUG':
        return <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">DEBUG</span>;
      default:
        return <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">{level}</span>;
    }
  };
  
  // Back to pipelines list
  const handleBack = () => {
    router.push('/admin/duckdb-swarm/pipelines');
  };
  
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center h-64">
          <ArrowPathIcon className="h-8 w-8 text-blue-500 animate-spin" />
          <span className="ml-2 text-gray-600 dark:text-gray-300">Cargando detalles de la ejecución...</span>
        </div>
      </div>
    );
  }
  
  if (!execution) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <div className="flex items-center justify-center space-x-2">
            <XCircleIcon className="h-6 w-6 text-red-500" />
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">
              Ejecución no encontrada
            </h2>
          </div>
          <p className="mt-4 text-center text-gray-600 dark:text-gray-300">
            No se encontraron detalles para la ejecución con ID: {id}
          </p>
          <div className="mt-6 flex justify-center">
            <button
              onClick={handleBack}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              Volver a Pipelines
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header with back button */}
      <div className="flex items-center mb-6">
        <button
          onClick={handleBack}
          className="mr-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Detalles de Ejecución
        </h1>
      </div>
      
      {/* Execution summary card */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">
              Pipeline: <Link href={`/admin/duckdb-swarm/pipelines/${execution.pipeline.id}`} className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300">
                {execution.pipeline.name}
              </Link>
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              ID: <span className="font-mono">{execution.id}</span>
            </p>
          </div>
          <div className="flex items-center px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-700">
            {getStatusIcon(execution.status)}
            <span className="ml-1 text-sm font-medium capitalize">
              {execution.status}
            </span>
          </div>
        </div>
        
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border-r border-gray-200 dark:border-gray-700 pr-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">Iniciado</div>
            <div className="text-sm font-medium text-gray-900 dark:text-white">{formatDate(execution.started_at)}</div>
          </div>
          <div className="border-r border-gray-200 dark:border-gray-700 pr-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">Completado</div>
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              {execution.completed_at ? formatDate(execution.completed_at) : 'En progreso...'}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Iniciado por</div>
            <div className="text-sm font-medium text-gray-900 dark:text-white">{execution.triggered_by || 'Sistema'}</div>
          </div>
        </div>
        
        {/* Metrics */}
        {execution.metrics && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Métricas</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Duración</div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  {execution.metrics.duration_ms ? `${(execution.metrics.duration_ms / 1000).toFixed(2)} segundos` : 'N/A'}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Filas Procesadas</div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  {execution.metrics.rows_processed || 'N/A'}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Memoria Utilizada</div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  {execution.metrics.memory_used_mb ? `${execution.metrics.memory_used_mb.toFixed(2)} MB` : 'N/A'}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-4">
        <button
          className={`py-2 px-4 font-medium ${activeTab === 'details' 
            ? 'text-blue-600 border-b-2 border-blue-600 dark:text-blue-500 dark:border-blue-500' 
            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}`}
          onClick={() => setActiveTab('details')}
        >
          Detalles
        </button>
        <button
          className={`py-2 px-4 font-medium ${activeTab === 'logs' 
            ? 'text-blue-600 border-b-2 border-blue-600 dark:text-blue-500 dark:border-blue-500' 
            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}`}
          onClick={() => setActiveTab('logs')}
        >
          Logs
        </button>
      </div>
      
      {/* Details Tab */}
      {activeTab === 'details' && (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Parámetros de Ejecución
            </h3>
          </div>
          <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-5 sm:px-6">
            {Object.keys(execution.parameters || {}).length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No se utilizaron parámetros en esta ejecución
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Parámetro
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Valor
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {Object.entries(execution.parameters || {}).map(([key, value]) => (
                      <tr key={key}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                          {key}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                          {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Logs Tab */}
      {activeTab === 'logs' && (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
          <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Logs de Ejecución
            </h3>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {execution.logs?.length || 0} entradas
            </div>
          </div>
          <div className="border-t border-gray-200 dark:border-gray-700">
            {!execution.logs || execution.logs.length === 0 ? (
              <div className="px-4 py-5 sm:px-6 text-center">
                <DocumentTextIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No hay logs disponibles para esta ejecución
                </p>
              </div>
            ) : (
              <div className="overflow-y-auto max-h-96">
                <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                  {execution.logs.map((log) => (
                    <li key={log.id} className="px-4 py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          {getLogLevelBadge(log.level)}
                          {log.step_id && (
                            <span className="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                              Step
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {formatDate(log.timestamp)}
                        </div>
                      </div>
                      <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                        {log.message}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ExecutionDetails;