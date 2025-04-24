import React, { useState, useEffect } from 'react';

const DuckDBSwarmSimple = () => {
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch data from DuckDB Swarm API
  const fetchServers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/duckdb-swarm/servers');
      const data = await response.json();
      setServers(data.servers || []);
    } catch (error) {
      console.error('Error fetching servers:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load data on component mount
  useEffect(() => {
    fetchServers();
  }, []);

  // Get status color based on server status
  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'bg-green-500';
      case 'standby':
        return 'bg-yellow-500';
      case 'starting':
        return 'bg-blue-500';
      case 'stopped':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Gestión del Enjambre DuckDB
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          Administre servidores DuckDB, bases de datos y métricas desde una única interfaz
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Servidores DuckDB</h2>
        
        {loading ? (
          <div className="animate-pulse space-y-2">
            <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Hostname</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Puerto</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Tipo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Estado</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {servers.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                      No hay servidores registrados
                    </td>
                  </tr>
                ) : (
                  servers.map(server => (
                    <tr key={server.id}>
                      <td className="px-6 py-4 whitespace-nowrap">{server.id}</td>
                      <td className="px-6 py-4 whitespace-nowrap font-medium">{server.hostname}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{server.port}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{server.server_type}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="flex items-center">
                          <span className={`inline-block w-3 h-3 rounded-full mr-2 ${getStatusColor(server.status)}`}></span>
                          {server.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default DuckDBSwarmSimple;