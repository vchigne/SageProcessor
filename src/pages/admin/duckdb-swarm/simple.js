import React, { useState, useEffect } from 'react';

const DuckDBSwarmSimple = () => {
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState({
    servers: true,
    clouds: false,
    installations: false,
    buckets: false
  });
  const [activeTab, setActiveTab] = useState('servers');
  const [clouds, setClouds] = useState([]);
  const [cloudSecrets, setCloudSecrets] = useState([]);
  const [buckets, setBuckets] = useState([]);
  const [showNewBucket, setShowNewBucket] = useState(false);
  const [newBucketName, setNewBucketName] = useState('');
  const [installations, setInstallations] = useState([]);
  const [formData, setFormData] = useState({
    hostname: '',
    port: 1294,
    server_key: '',
    server_type: 'general',
    is_local: false,
    installation_id: '',
    cloud_secret_id: '',
    bucket_name: '',
    ssh_host: '',
    ssh_port: 22,
    ssh_username: '',
    ssh_password: '',
    ssh_key: '',
    deploy_server: false
  });
  const [formStep, setFormStep] = useState('basic'); // basic, cloud, deploy

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

  // Fetch clouds
  const fetchClouds = async () => {
    try {
      setLoading(prev => ({ ...prev, clouds: true }));
      const response = await fetch('/api/admin/duckdb-swarm/cloud-providers');
      const data = await response.json();
      setClouds(data.providers || []);
    } catch (error) {
      console.error('Error fetching clouds:', error);
    } finally {
      setLoading(prev => ({ ...prev, clouds: false }));
    }
  };
  
  // Fetch cloud secrets (para usar en la selección de almacenamiento)
  const fetchCloudSecrets = async () => {
    try {
      setLoading(prev => ({ ...prev, clouds: true }));
      const response = await fetch('/api/admin/duckdb-swarm/cloud-secrets');
      const data = await response.json();
      if (data.success && Array.isArray(data.secrets)) {
        setCloudSecrets(data.secrets);
      } else {
        console.error('Formato inesperado en cloud-secrets:', data);
        setCloudSecrets([]);
      }
    } catch (error) {
      console.error('Error fetching cloud secrets:', error);
      setCloudSecrets([]);
    } finally {
      setLoading(prev => ({ ...prev, clouds: false }));
    }
  };
  
  // Cargar buckets basado en el secreto cloud seleccionado
  const fetchBuckets = async (secretId) => {
    if (!secretId) {
      setBuckets([]);
      return;
    }
    
    setLoading(prev => ({ ...prev, buckets: true }));
    try {
      const response = await fetch(`/api/emisores/buckets-secreto?secreto_id=${secretId}`);
      if (!response.ok) {
        throw new Error('Error fetching buckets');
      }
      const data = await response.json();
      if (data.success && data.buckets) {
        setBuckets(data.buckets);
      } else {
        setBuckets([]);
      }
    } catch (error) {
      console.error('Error fetching buckets:', error);
      setBuckets([]);
    } finally {
      setLoading(prev => ({ ...prev, buckets: false }));
    }
  };

  // Fetch SAGE installations
  const fetchInstallations = async () => {
    try {
      setLoading(prev => ({ ...prev, installations: true }));
      const response = await fetch('/api/admin/duckdb-swarm/installations');
      const data = await response.json();
      setInstallations(data.installations || []);
    } catch (error) {
      console.error('Error fetching installations:', error);
    } finally {
      setLoading(prev => ({ ...prev, installations: false }));
    }
  };

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Load data on component mount
  useEffect(() => {
    fetchServers();
    fetchClouds();
    fetchCloudSecrets();
    fetchInstallations();
  }, []);
  
  // Cuando se cambia el secreto de nube, cargar sus buckets
  useEffect(() => {
    if (formData.cloud_secret_id) {
      fetchBuckets(formData.cloud_secret_id);
    } else {
      setBuckets([]);
    }
  }, [formData.cloud_secret_id]);

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    // Aquí implementaremos la lógica para guardar el servidor
    console.log('Form data:', formData);
    
    try {
      const response = await fetch('/api/admin/duckdb-swarm/servers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      
      if (response.ok) {
        alert('Servidor agregado correctamente');
        fetchServers();
        // Reset form
        setFormData({
          hostname: '',
          port: 1294,
          server_key: '',
          server_type: 'general',
          is_local: false,
          installation_id: '',
          cloud_secret_id: '',
          bucket_name: '',
          ssh_host: '',
          ssh_port: 22,
          ssh_username: '',
          ssh_password: '',
          ssh_key: '',
          deploy_server: false
        });
        setFormStep('basic');
      } else {
        const error = await response.json();
        alert(error.error || 'Error al agregar el servidor');
      }
    } catch (error) {
      console.error('Error adding server:', error);
      alert('Error al agregar el servidor');
    }
  };

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

  // Render form step based on current step
  const renderFormStep = () => {
    switch (formStep) {
      case 'basic':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Hostname / IP
                </label>
                <input
                  type="text"
                  name="hostname"
                  value={formData.hostname}
                  onChange={handleInputChange}
                  placeholder="duckdb-server-01 o 192.168.1.100"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Puerto
                </label>
                <input
                  type="number"
                  name="port"
                  value={formData.port}
                  onChange={handleInputChange}
                  placeholder="1294"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                  required
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Clave del Servidor
              </label>
              <input
                type="password"
                name="server_key"
                value={formData.server_key}
                onChange={handleInputChange}
                placeholder="Clave para autenticación con el servidor DuckDB"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tipo de Servidor
                </label>
                <select
                  name="server_type"
                  value={formData.server_type}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
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
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Instalación SAGE (opcional)
                </label>
                <select
                  name="installation_id"
                  value={formData.installation_id}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="">Ninguna</option>
                  {installations.map(installation => (
                    <option key={installation.id} value={installation.id}>
                      {installation.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                name="is_local"
                checked={formData.is_local}
                onChange={handleInputChange}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <label className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                Marcar como servidor local
              </label>
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                name="deploy_server"
                checked={formData.deploy_server}
                onChange={handleInputChange}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <label className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                Desplegar nuevo servidor (requiere SSH)
              </label>
            </div>
          </div>
        );
      
      case 'cloud':
        return (
          <div className="space-y-4">
            {/* Configuración Bucket */}
            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-md">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
                Configuración Bucket
              </h3>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Secreto Cloud
                </label>
                <select
                  name="cloud_secret_id"
                  value={formData.cloud_secret_id}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFormData({ ...formData, cloud_secret_id: value, bucket_name: '' });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                  required
                >
                  <option value="" disabled>Seleccionar secreto cloud</option>
                  {cloudSecrets.map((secret) => (
                    <option key={secret.id} value={secret.id.toString()}>
                      {secret.nombre} ({secret.tipo})
                    </option>
                  ))}
                </select>
              </div>
              
              {formData.cloud_secret_id && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Bucket
                  </label>
                  <select
                    name="bucket_name"
                    value={formData.bucket_name}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                    required
                  >
                    <option value="" disabled>Seleccionar bucket</option>
                    {buckets.map((bucket) => (
                      <option key={bucket.name} value={bucket.name}>
                        {bucket.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              {formData.cloud_secret_id && (
                <div>
                  <div className="flex items-center mb-2 cursor-pointer" onClick={() => setShowNewBucket(!showNewBucket)}>
                    <div className="h-5 w-5 text-indigo-600 mr-2">
                      {showNewBucket ? (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <span className="text-sm font-medium text-indigo-600">Crear nuevo bucket</span>
                  </div>
                  
                  {showNewBucket && (
                    <div className="flex space-x-2 mt-2">
                      <input
                        type="text"
                        value={newBucketName}
                        onChange={(e) => setNewBucketName(e.target.value)}
                        placeholder="Nombre del bucket"
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white text-sm"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          if (!newBucketName || !formData.cloud_secret_id) return;
                          
                          // Intentar crear bucket
                          try {
                            const response = await fetch('/api/cloud-secrets/bucket/create', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                secretId: formData.cloud_secret_id,
                                bucketName: newBucketName
                              })
                            });
                            
                            const data = await response.json();
                            
                            if (data.success) {
                              // Actualizar lista de buckets
                              fetchBuckets(formData.cloud_secret_id);
                              setFormData({ ...formData, bucket_name: newBucketName });
                              setNewBucketName('');
                              setShowNewBucket(false);
                              alert('Bucket creado correctamente');
                            } else {
                              alert(`Error al crear el bucket: ${data.message}`);
                            }
                          } catch (error) {
                            console.error('Error creating bucket:', error);
                            alert('Error al crear el bucket');
                          }
                        }}
                        className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        Crear
                      </button>
                    </div>
                  )}
                </div>
              )}
              
              <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                El proveedor de nube se utilizará para almacenar bases de datos y respaldos. 
                Seleccione un secreto cloud y un bucket existente, o cree uno nuevo.
              </p>
            </div>
          </div>
        );
        
      case 'deploy':
        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Proporcione credenciales SSH para desplegar el servidor DuckDB en una máquina remota.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Host SSH
                </label>
                <input
                  type="text"
                  name="ssh_host"
                  value={formData.ssh_host}
                  onChange={handleInputChange}
                  placeholder="hostname o IP"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                  required={formData.deploy_server}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Puerto SSH
                </label>
                <input
                  type="number"
                  name="ssh_port"
                  value={formData.ssh_port}
                  onChange={handleInputChange}
                  placeholder="22"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                  required={formData.deploy_server}
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Usuario SSH
              </label>
              <input
                type="text"
                name="ssh_username"
                value={formData.ssh_username}
                onChange={handleInputChange}
                placeholder="usuario"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                required={formData.deploy_server}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Contraseña SSH (opcional)
                </label>
                <input
                  type="password"
                  name="ssh_password"
                  value={formData.ssh_password}
                  onChange={handleInputChange}
                  placeholder="contraseña (si no usa clave SSH)"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Clave Privada SSH (opcional)
                </label>
                <textarea
                  name="ssh_key"
                  value={formData.ssh_key}
                  onChange={handleInputChange}
                  placeholder="-----BEGIN RSA PRIVATE KEY-----..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                  rows={3}
                />
              </div>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  // Navigation buttons for form steps
  const renderStepButtons = () => {
    return (
      <div className="flex justify-between mt-6">
        {formStep !== 'basic' && (
          <button
            type="button"
            onClick={() => {
              if (formStep === 'cloud') setFormStep('basic');
              if (formStep === 'deploy') setFormStep('cloud');
            }}
            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Anterior
          </button>
        )}
        
        <div className="flex space-x-2">
          {formStep === 'deploy' ? (
            <button
              type="submit"
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Guardar Servidor
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (formStep === 'basic') {
                  if (formData.deploy_server) {
                    setFormStep('cloud');
                  } else {
                    // Skip deploy step if not deploying a new server
                    if (formData.cloud_provider_id) {
                      setFormStep('deploy');
                    } else {
                      setFormStep('cloud');
                    }
                  }
                } else if (formStep === 'cloud') {
                  setFormStep('deploy');
                }
              }}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Siguiente
            </button>
          )}
        </div>
      </div>
    );
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

      {/* Tabs */}
      <div className="mb-6">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex space-x-4">
            <button
              onClick={() => setActiveTab('servers')}
              className={`${
                activeTab === 'servers'
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
              } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm`}
            >
              Servidores
            </button>
            <button
              onClick={() => setActiveTab('add_server')}
              className={`${
                activeTab === 'add_server'
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
              } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm`}
            >
              Agregar Servidor
            </button>
          </nav>
        </div>
      </div>

      {/* Server List Tab */}
      {activeTab === 'servers' && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Servidores DuckDB</h2>
          
          {loading.servers ? (
            <div className="animate-pulse space-y-2">
              <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="overflow-y-auto max-h-[400px]">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
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
            </div>
          )}
        </div>
      )}

      {/* Add Server Tab */}
      {activeTab === 'add_server' && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Agregar Nuevo Servidor DuckDB</h2>
          
          {/* Steps Progress */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className={`flex items-center justify-center h-8 w-8 rounded-full ${formStep === 'basic' ? 'bg-indigo-600' : 'bg-indigo-200 dark:bg-indigo-800'} text-white font-semibold`}>
                  1
                </div>
                <div className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">Básico</div>
              </div>
              <div className={`flex-1 h-1 mx-4 ${formStep !== 'basic' ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'}`}></div>
              <div className="flex items-center">
                <div className={`flex items-center justify-center h-8 w-8 rounded-full ${formStep === 'cloud' ? 'bg-indigo-600' : formStep === 'deploy' ? 'bg-indigo-200 dark:bg-indigo-800' : 'bg-gray-200 dark:bg-gray-700'} text-white font-semibold`}>
                  2
                </div>
                <div className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">Nube</div>
              </div>
              <div className={`flex-1 h-1 mx-4 ${formStep === 'deploy' ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'}`}></div>
              <div className="flex items-center">
                <div className={`flex items-center justify-center h-8 w-8 rounded-full ${formStep === 'deploy' ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'} text-white font-semibold`}>
                  3
                </div>
                <div className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">Despliegue</div>
              </div>
            </div>
          </div>
          
          <form onSubmit={handleSubmit}>
            {renderFormStep()}
            {renderStepButtons()}
          </form>
        </div>
      )}
    </div>
  );
};

export default DuckDBSwarmSimple;