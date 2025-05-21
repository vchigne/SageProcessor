
import React, { useState, useEffect } from 'react';
import { 
  ServerIcon, 
  CheckCircleIcon, 
  ExclamationCircleIcon,
  ArrowPathIcon,
  ChartBarIcon,
  CircleStackIcon
} from '@heroicons/react/24/outline';

const DuckDBDashboard = () => {
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalServers: 0,
    activeServers: 0,
    totalDatabases: 0,
    storageTotalGB: 0
  });

  useEffect(() => {
    const fetchServers = async () => {
      try {
        const response = await fetch('/api/admin/duckdb-swarm/servers');
        if (response.ok) {
          const data = await response.json();
          const serversList = data.servers || [];
          setServers(serversList);
          
          const activeServers = serversList.filter(server => server.status === 'active').length;
          const totalDatabases = serversList.reduce((acc, server) => acc + (server.databases?.length || 0), 0);
          const storageTotalGB = serversList.reduce((acc, server) => {
            return acc + (server.databases?.reduce((dbAcc, db) => dbAcc + (db.size_mb || 0), 0) || 0);
          }, 0) / 1024;
          
          setStats({
            totalServers: serversList.length,
            activeServers,
            totalDatabases,
            storageTotalGB
          });
        }
      } catch (error) {
        console.error('Error fetching servers:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchServers();
    const interval = setInterval(fetchServers, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">DuckDB Swarm Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard 
          title="Servidores Totales" 
          value={stats.totalServers} 
          icon={<ServerIcon className="h-8 w-8 text-blue-500" />} 
        />
        <StatCard 
          title="Servidores Activos" 
          value={stats.activeServers} 
          icon={<CheckCircleIcon className="h-8 w-8 text-green-500" />} 
        />
        <StatCard 
          title="Bases de Datos" 
          value={stats.totalDatabases} 
          icon={<CircleStackIcon className="h-8 w-8 text-purple-500" />} 
        />
        <StatCard 
          title="Almacenamiento Total" 
          value={`${stats.storageTotalGB.toFixed(2)} GB`} 
          icon={<ChartBarIcon className="h-8 w-8 text-yellow-500" />} 
        />
      </div>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
        <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">
            Servidores DuckDB
          </h2>
          <button 
            onClick={() => setLoading(true)} 
            className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <ArrowPathIcon className="h-4 w-4 mr-1" />
            Actualizar
          </button>
        </div>
        <div className="border-t border-gray-200 dark:border-gray-700">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Servidor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    DB Count
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Almacenamiento
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
                ) : servers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                      No hay servidores disponibles
                    </td>
                  </tr>
                ) : (
                  servers.map((server) => (
                    <tr key={server.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        <div className="flex items-center">
                          <ServerIcon className="h-5 w-5 mr-2 text-gray-400" />
                          {server.hostname}:{server.port}
                          {server.is_local && (
                            <span className="ml-2 bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full">
                              Primary
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        <div className="flex items-center">
                          {server.status === 'active' ? (
                            <>
                              <CheckCircleIcon className="h-5 w-5 text-green-500 mr-1" />
                              <span>Activo</span>
                            </>
                          ) : (
                            <>
                              <ExclamationCircleIcon className="h-5 w-5 text-red-500 mr-1" />
                              <span>Inactivo</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {server.server_type || 'Standard'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {server.databases?.length || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {server.databases?.reduce((acc, db) => acc + (db.size_mb || 0), 0) / 1024 || 0} GB
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <div className="flex items-center">
        <div className="flex-shrink-0">
          {icon}
        </div>
        <div className="ml-5 w-0 flex-1">
          <dl>
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
              {title}
            </dt>
            <dd>
              <div className="text-lg font-medium text-gray-900 dark:text-white">
                {value}
              </div>
            </dd>
          </dl>
        </div>
      </div>
    </div>
  );
};

export default DuckDBDashboard;
