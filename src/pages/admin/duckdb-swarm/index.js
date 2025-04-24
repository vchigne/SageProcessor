import React, { useState, useEffect } from 'react';
import { Card, Title, Text, Grid, Metric, Flex, ProgressBar } from '@tremor/react';
import { ServerIcon, DatabaseIcon, ChartBarIcon, PlusIcon } from '@heroicons/react/24/outline';
import DuckDBSwarmLayout from '../../../components/DuckDBSwarmLayout';

const DuckDBSwarm = () => {
  const [servers, setServers] = useState([]);
  const [databases, setDatabases] = useState([]);
  const [metrics, setMetrics] = useState([]);
  const [loading, setLoading] = useState({
    servers: true,
    databases: true,
    metrics: true
  });
  const [activeTab, setActiveTab] = useState('servers');
  const [formData, setFormData] = useState({
    hostname: '',
    port: 1294,
    serverType: 'general'
  });
  const [dbFormData, setDbFormData] = useState({
    serverId: '',
    name: '',
    path: '',
    size: 0
  });

  // Fetch data from DuckDB Swarm API
  const fetchServers = async () => {
    try {
      setLoading(prev => ({ ...prev, servers: true }));
      const response = await fetch('/api/admin/duckdb-swarm/servers');
      const data = await response.json();
      setServers(data.servers || []);
    } catch (error) {
      console.error('Error fetching servers:', error);
    } finally {
      setLoading(prev => ({ ...prev, servers: false }));
    }
  };

  const fetchDatabases = async () => {
    try {
      setLoading(prev => ({ ...prev, databases: true }));
      const response = await fetch('/api/admin/duckdb-swarm/databases');
      const data = await response.json();
      setDatabases(data.databases || []);
    } catch (error) {
      console.error('Error fetching databases:', error);
    } finally {
      setLoading(prev => ({ ...prev, databases: false }));
    }
  };

  const fetchMetrics = async () => {
    try {
      setLoading(prev => ({ ...prev, metrics: true }));
      const response = await fetch('http://localhost:5001/api/metrics');
      const data = await response.json();
      setMetrics(data.metrics || []);
    } catch (error) {
      console.error('Error fetching metrics:', error);
    } finally {
      setLoading(prev => ({ ...prev, metrics: false }));
    }
  };

  const updateMetrics = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/metrics/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });
      
      if (response.ok) {
        fetchMetrics();
      }
    } catch (error) {
      console.error('Error updating metrics:', error);
    }
  };

  // Add a new server
  const addServer = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('http://localhost:5001/api/servers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          hostname: formData.hostname,
          port: parseInt(formData.port),
          server_type: formData.serverType
        })
      });
      
      if (response.ok) {
        fetchServers();
        setFormData({
          hostname: '',
          port: 1294,
          serverType: 'general'
        });
      }
    } catch (error) {
      console.error('Error adding server:', error);
    }
  };

  // Add a new database
  const addDatabase = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('http://localhost:5001/api/databases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          server_id: parseInt(dbFormData.serverId),
          name: dbFormData.name,
          path: dbFormData.path,
          size: parseFloat(dbFormData.size)
        })
      });
      
      if (response.ok) {
        fetchDatabases();
        setDbFormData({
          serverId: '',
          name: '',
          path: '',
          size: 0
        });
      }
    } catch (error) {
      console.error('Error adding database:', error);
    }
  };

  // Delete a server
  const deleteServer = async (id) => {
    if (!confirm('¿Está seguro que desea eliminar este servidor?')) return;
    
    try {
      const response = await fetch(`http://localhost:5001/api/servers/${id}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        fetchServers();
      } else {
        const error = await response.json();
        alert(error.error || 'Error al eliminar el servidor');
      }
    } catch (error) {
      console.error('Error deleting server:', error);
    }
  };

  // Delete a database
  const deleteDatabase = async (id) => {
    if (!confirm('¿Está seguro que desea eliminar esta base de datos?')) return;
    
    try {
      const response = await fetch(`http://localhost:5001/api/databases/${id}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        fetchDatabases();
      } else {
        const error = await response.json();
        alert(error.error || 'Error al eliminar la base de datos');
      }
    } catch (error) {
      console.error('Error deleting database:', error);
    }
  };

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle database form input changes
  const handleDbInputChange = (e) => {
    const { name, value } = e.target;
    setDbFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Load data on component mount
  useEffect(() => {
    fetchServers();
    fetchDatabases();
    fetchMetrics();
    
    // Refresh metrics periodically
    const metricsInterval = setInterval(() => {
      if (activeTab === 'metrics') {
        fetchMetrics();
      }
    }, 10000);
    
    return () => clearInterval(metricsInterval);
  }, [activeTab]);

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
    <DuckDBSwarmLayout>
      <div className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <Title>Gestión del Enjambre DuckDB</Title>
          <Text>Administre servidores DuckDB, bases de datos y métricas desde una única interfaz</Text>
        </div>
        
        {/* Tabs de navegación */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex">
              <button
                onClick={() => setActiveTab('servers')}
                className={`${
                  activeTab === 'servers'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                } flex items-center whitespace-nowrap border-b-2 py-4 px-4 text-sm font-medium`}
              >
                <ServerIcon className="h-5 w-5 mr-2" />
                Servidores
              </button>
              <button
                onClick={() => setActiveTab('databases')}
                className={`${
                  activeTab === 'databases'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                } flex items-center whitespace-nowrap border-b-2 py-4 px-4 text-sm font-medium`}
              >
                <DatabaseIcon className="h-5 w-5 mr-2" />
                Bases de Datos
              </button>
              <button
                onClick={() => setActiveTab('metrics')}
                className={`${
                  activeTab === 'metrics'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                } flex items-center whitespace-nowrap border-b-2 py-4 px-4 text-sm font-medium`}
              >
                <ChartBarIcon className="h-5 w-5 mr-2" />
                Métricas
              </button>
            </nav>
          </div>
        </div>
      
        {/* Contenido de Servidores */}
        {activeTab === 'servers' && (
          <div>
            <Card className="mb-6">
              <Title>Agregar Nuevo Servidor</Title>
              <form onSubmit={addServer} className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Hostname
                  </label>
                  <input
                    type="text"
                    name="hostname"
                    value={formData.hostname}
                    onChange={handleInputChange}
                    placeholder="duckdb-server-01"
                    className="border rounded-md px-3 py-2 w-full"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Puerto
                  </label>
                  <input
                    type="number"
                    name="port"
                    value={formData.port}
                    onChange={handleInputChange}
                    placeholder="1294"
                    className="border rounded-md px-3 py-2 w-full"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo
                  </label>
                  <select
                    name="serverType"
                    value={formData.serverType}
                    onChange={handleInputChange}
                    className="border rounded-md px-3 py-2 w-full"
                    required
                  >
                    <option value="general">General</option>
                    <option value="analytics">Analytics</option>
                    <option value="reporting">Reporting</option>
                    <option value="processing">Processing</option>
                    <option value="backup">Backup</option>
                    <option value="data-lake">Data Lake</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center"
                  >
                    <PlusIcon className="h-5 w-5 mr-2" />
                    Agregar Servidor
                  </button>
                </div>
              </form>
            </Card>
            
            <Card>
              <Title>Servidores DuckDB</Title>
              <Text>Lista de servidores registrados en el enjambre</Text>
              
              {loading.servers ? (
                <div className="animate-pulse mt-4">
                  <div className="h-10 bg-gray-200 rounded mb-2"></div>
                  <div className="h-10 bg-gray-200 rounded mb-2"></div>
                  <div className="h-10 bg-gray-200 rounded"></div>
                </div>
              ) : (
                <div className="mt-4">
                  <div className="grid grid-cols-5 font-semibold text-gray-700 border-b pb-2">
                    <div>ID</div>
                    <div>Hostname</div>
                    <div>Puerto</div>
                    <div>Tipo</div>
                    <div>Estado</div>
                  </div>
                  
                  {servers.length === 0 ? (
                    <div className="py-4 text-center text-gray-500">
                      No hay servidores registrados
                    </div>
                  ) : (
                    servers.map(server => (
                      <div key={server.id} className="grid grid-cols-5 py-3 border-b items-center">
                        <div>{server.id}</div>
                        <div className="font-medium">{server.hostname}</div>
                        <div>{server.port}</div>
                        <div>{server.server_type}</div>
                        <div className="flex items-center justify-between">
                          <span className="flex items-center">
                            <span className={`inline-block w-3 h-3 rounded-full mr-2 ${getStatusColor(server.status)}`}></span>
                            {server.status}
                          </span>
                          <button
                            onClick={() => deleteServer(server.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Contenido de Bases de Datos */}
        {activeTab === 'databases' && (
          <div>
            <Card className="mb-6">
              <Title>Agregar Nueva Base de Datos</Title>
              <form onSubmit={addDatabase} className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Servidor
                  </label>
                  <select
                    name="serverId"
                    value={dbFormData.serverId}
                    onChange={handleDbInputChange}
                    className="border rounded-md px-3 py-2 w-full"
                    required
                  >
                    <option value="">Seleccionar servidor</option>
                    {servers.map(server => (
                      <option key={server.id} value={server.id}>
                        {server.hostname} ({server.server_type})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={dbFormData.name}
                    onChange={handleDbInputChange}
                    placeholder="analytics"
                    className="border rounded-md px-3 py-2 w-full"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ruta
                  </label>
                  <input
                    type="text"
                    name="path"
                    value={dbFormData.path}
                    onChange={handleDbInputChange}
                    placeholder="/data/analytics.duckdb"
                    className="border rounded-md px-3 py-2 w-full"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tamaño (MB)
                  </label>
                  <input
                    type="number"
                    name="size"
                    value={dbFormData.size}
                    onChange={handleDbInputChange}
                    placeholder="100"
                    className="border rounded-md px-3 py-2 w-full"
                    required
                  />
                </div>
                <div className="md:col-span-4">
                  <button
                    type="submit"
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center"
                  >
                    <PlusIcon className="h-5 w-5 mr-2" />
                    Agregar Base de Datos
                  </button>
                </div>
              </form>
            </Card>
            
            <Card>
              <Title>Bases de Datos</Title>
              <Text>Bases de datos registradas en los servidores</Text>
              
              {loading.databases ? (
                <div className="animate-pulse mt-4">
                  <div className="h-10 bg-gray-200 rounded mb-2"></div>
                  <div className="h-10 bg-gray-200 rounded mb-2"></div>
                  <div className="h-10 bg-gray-200 rounded"></div>
                </div>
              ) : (
                <div className="mt-4">
                  <div className="grid grid-cols-5 font-semibold text-gray-700 border-b pb-2">
                    <div>ID</div>
                    <div>Servidor</div>
                    <div>Nombre</div>
                    <div>Ruta</div>
                    <div>Tamaño (MB)</div>
                  </div>
                  
                  {databases.length === 0 ? (
                    <div className="py-4 text-center text-gray-500">
                      No hay bases de datos registradas
                    </div>
                  ) : (
                    databases.map(db => (
                      <div key={db.id} className="grid grid-cols-5 py-3 border-b items-center">
                        <div>{db.id}</div>
                        <div>{db.hostname}</div>
                        <div className="font-medium">{db.database_name}</div>
                        <div className="truncate">{db.database_path}</div>
                        <div className="flex items-center justify-between">
                          <span>{db.size_mb} MB</span>
                          <button
                            onClick={() => deleteDatabase(db.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Contenido de Métricas */}
        {activeTab === 'metrics' && (
          <div>
            <div className="flex justify-end mb-4">
              <button
                onClick={updateMetrics}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center"
              >
                <ChartBarIcon className="h-5 w-5 mr-2" />
                Actualizar Métricas
              </button>
            </div>
            
            <Grid numItems={1} numItemsSm={2} numItemsLg={3} className="gap-6">
              {loading.metrics ? (
                <>
                  <Card className="animate-pulse">
                    <div className="h-8 bg-gray-200 rounded mb-4 w-1/2"></div>
                    <div className="h-12 bg-gray-200 rounded mb-4"></div>
                    <div className="h-6 bg-gray-200 rounded"></div>
                  </Card>
                  <Card className="animate-pulse">
                    <div className="h-8 bg-gray-200 rounded mb-4 w-1/2"></div>
                    <div className="h-12 bg-gray-200 rounded mb-4"></div>
                    <div className="h-6 bg-gray-200 rounded"></div>
                  </Card>
                  <Card className="animate-pulse">
                    <div className="h-8 bg-gray-200 rounded mb-4 w-1/2"></div>
                    <div className="h-12 bg-gray-200 rounded mb-4"></div>
                    <div className="h-6 bg-gray-200 rounded"></div>
                  </Card>
                </>
              ) : (
                metrics.map(metric => (
                  <Card key={metric.id}>
                    <Title>{metric.hostname}</Title>
                    <Flex justifyContent="start" alignItems="baseline" className="space-x-2">
                      <Metric>{metric.cpu_usage.toFixed(1)}% CPU</Metric>
                      <Text>/ {metric.memory_usage.toFixed(1)}% Memoria</Text>
                    </Flex>
                    
                    <Text className="mt-4">Uso de CPU</Text>
                    <ProgressBar
                      value={metric.cpu_usage}
                      color={metric.cpu_usage > 80 ? 'red' : metric.cpu_usage > 60 ? 'yellow' : 'emerald'}
                      className="mt-2"
                    />
                    
                    <Text className="mt-4">Uso de Memoria</Text>
                    <ProgressBar
                      value={metric.memory_usage}
                      color={metric.memory_usage > 80 ? 'red' : metric.memory_usage > 60 ? 'yellow' : 'emerald'}
                      className="mt-2"
                    />
                    
                    <Text className="mt-4">Uso de Disco</Text>
                    <ProgressBar
                      value={metric.disk_usage}
                      color={metric.disk_usage > 80 ? 'red' : metric.disk_usage > 60 ? 'yellow' : 'emerald'}
                      className="mt-2"
                    />
                    
                    <Flex className="mt-4">
                      <div>
                        <Text>Consultas</Text>
                        <Metric>{metric.query_count}</Metric>
                      </div>
                      <div>
                        <Text>Conexiones</Text>
                        <Metric>{metric.active_connections}</Metric>
                      </div>
                    </Flex>
                  </Card>
                ))
              )}
            </Grid>
          </div>
        )}
      </div>
    </DuckDBSwarmLayout>
  );
};

export default DuckDBSwarm;