import React, { useState, useEffect } from 'react';
import Link from 'next/link';

const DuckDBSwarmSimple = () => {
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState({
    servers: true,
    clouds: false,
    installations: false,
    buckets: false,
    redeploy: false,
    deploying: false,
    startingUI: false
  });
  const [uiStatus, setUiStatus] = useState({
    serverId: null,
    url: null,
    error: null,
    loading: false
  });
  const [deploymentStatus, setDeploymentStatus] = useState({
    message: '',
    progress: 0,
    error: '',
    success: false,
    logs: []
  });
  const [activeTab, setActiveTab] = useState('servers');
  const [clouds, setClouds] = useState([]);
  const [cloudSecrets, setCloudSecrets] = useState([]);
  const [buckets, setBuckets] = useState([]);
  const [showNewBucket, setShowNewBucket] = useState(false);
  const [newBucketName, setNewBucketName] = useState('');
  const [installations, setInstallations] = useState([]);
  const [editMode, setEditMode] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [formData, setFormData] = useState({
    id: null,          // ID del servidor cuando estamos en modo edición
    name: '',         // Nuevo campo para nombre descriptivo
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

  // Función para monitorear el progreso del despliegue
  const checkDeploymentProgress = async (serverId) => {
    try {
      // Usar el nuevo endpoint que verifica y actualiza el estado del servidor
      const response = await fetch(`/api/admin/duckdb-swarm/server-status/${serverId}`);
      if (!response.ok) {
        throw new Error('Error al obtener estado del servidor');
      }
      
      const data = await response.json();
      const server = data.server;
      const statusInfo = data.statusInfo || {};
      
      if (server) {
        // Actualizar logs con información de la API de DuckDB si está disponible
        let newLogs = [];
        if (statusInfo.status === 'active') {
          newLogs.push('[INFO] Conexión con el servidor DuckDB establecida');
        } else if (statusInfo.status === 'error') {
          newLogs.push(`[WARN] Error en la conexión: ${statusInfo.details?.error || 'Error desconocido'}`);
        } else if (statusInfo.status === 'unreachable') {
          newLogs.push('[INFO] Servidor en proceso de inicialización...');
        }
        
        // Actualizar estado según el status del servidor
        switch(server.status) {
          case 'active':
            setDeploymentStatus(prev => ({
              ...prev,
              message: 'Servidor desplegado correctamente',
              progress: 100,
              success: true,
              logs: [...prev.logs, ...newLogs, '[SUCCESS] Despliegue completado con éxito']
            }));
            
            // Refrescar lista de servidores
            fetchServers();
            
            // Esperar 2 segundos antes de cerrar el diálogo
            setTimeout(() => {
              setLoading(prev => ({ ...prev, deploying: false }));
            }, 2000);
            return true; // Despliegue completado
            
          case 'error':
            setDeploymentStatus(prev => ({
              ...prev,
              message: 'Error en el despliegue',
              error: 'El servidor está en estado de error',
              logs: [...prev.logs, ...newLogs, '[ERROR] El servidor está en estado de error']
            }));
            return true; // No seguir consultando
            
          case 'deploying':
            // Incrementar progreso gradualmente
            setDeploymentStatus(prev => {
              // Incrementar hasta un máximo de 90% (el 100% solo cuando esté activo)
              const newProgress = Math.min(90, prev.progress + 5);
              return {
                ...prev,
                progress: newProgress,
                logs: [...prev.logs, ...newLogs, `[INFO] Instalando dependencias... (${newProgress}%)`]
              };
            });
            return false; // Seguir consultando
            
          case 'starting':
            setDeploymentStatus(prev => ({
              ...prev,
              progress: Math.min(80, prev.progress + 3),
              logs: [...prev.logs, ...newLogs, '[INFO] Iniciando servicio DuckDB...']
            }));
            return false; // Seguir consultando
            
          default:
            setDeploymentStatus(prev => ({
              ...prev,
              progress: Math.min(70, prev.progress + 2),
              logs: [...prev.logs, ...newLogs, `[INFO] Estado del servidor: ${server.status}`]
            }));
            return false; // Seguir consultando
        }
      }
      
      return false;
    } catch (error) {
      console.error('Error al verificar el progreso:', error);
      setDeploymentStatus(prev => ({
        ...prev,
        logs: [...prev.logs, `[ERROR] Error al verificar el progreso: ${error.message}`]
      }));
      return false;
    }
  };
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    // Aquí implementaremos la lógica para guardar el servidor
    console.log('Form data:', formData);
    
    try {
      // Si se va a desplegar el servidor, mostrar el diálogo de progreso
      if (formData.deploy_server) {
        setLoading(prev => ({ ...prev, deploying: true }));
        setDeploymentStatus({
          message: 'Preparando despliegue...',
          progress: 5,
          error: '',
          success: false,
          logs: ['Iniciando proceso de despliegue...']
        });
      }
      
      const response = await fetch('/api/admin/duckdb-swarm/servers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      
      const responseData = await response.json();
      
      if (response.ok) {
        if (formData.deploy_server) {
          // Obtener el ID del servidor recién creado
          const serverId = responseData.server?.id;
          
          if (serverId) {
            setDeploymentStatus(prev => ({
              ...prev,
              message: 'Servidor creado, iniciando despliegue...',
              progress: 15,
              logs: [...prev.logs, `[INFO] Servidor creado con ID: ${serverId}`]
            }));
            
            // Actualizar el formulario
            setFormData({
              name: '',
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
            
            // Iniciar monitoreo del progreso
            const monitorInterval = setInterval(async () => {
              const completed = await checkDeploymentProgress(serverId);
              if (completed) {
                clearInterval(monitorInterval);
              }
            }, 5000); // Verificar cada 5 segundos
            
            // Prevenir que el intervalo continúe indefinidamente
            setTimeout(() => {
              clearInterval(monitorInterval);
              // Si después de 3 minutos no ha terminado, mostrar mensaje
              setDeploymentStatus(prev => {
                if (!prev.success && !prev.error) {
                  return {
                    ...prev,
                    message: 'El despliegue está tomando más tiempo de lo esperado',
                    logs: [...prev.logs, '[INFO] El despliegue continúa en segundo plano. Puede verificar el estado más tarde.']
                  };
                }
                return prev;
              });
            }, 180000); // 3 minutos
          } else {
            // Si no se obtuvo el ID, mostrar éxito pero con advertencia
            setDeploymentStatus(prev => ({
              ...prev,
              message: 'Servidor registrado, pero no se pudo obtener su ID',
              progress: 100,
              success: true,
              logs: [...prev.logs, '[WARNING] Servidor registrado, pero no se pudo obtener su ID para monitorear el despliegue']
            }));
            
            // Esperar 2 segundos antes de cerrar el diálogo
            setTimeout(() => {
              setLoading(prev => ({ ...prev, deploying: false }));
              fetchServers();
            }, 2000);
          }
        } else {
          // Si no hubo despliegue, simplemente resetear
          fetchServers();
          // Reset form
          setFormData({
            name: '',
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
        }
      } else {
        // Manejar error en la respuesta
        if (formData.deploy_server) {
          setDeploymentStatus(prev => ({
            ...prev,
            message: 'Error en el despliegue',
            error: responseData.error || 'Error desconocido',
            logs: [...prev.logs, `[ERROR] ${responseData.error || 'Error desconocido'}`]
          }));
          
          // Si hay detalles del error del despliegue, mostrarlos
          if (responseData.details && responseData.details.output) {
            const logLines = responseData.details.output.split('\n');
            setDeploymentStatus(prev => ({
              ...prev,
              logs: [...prev.logs, ...logLines.map(line => `[OUTPUT] ${line}`)]
            }));
          }
          
          // No cerrar el diálogo automáticamente en caso de error
        } else {
          alert(responseData.error || 'Error al agregar el servidor');
        }
      }
    } catch (error) {
      console.error('Error adding server:', error);
      
      if (formData.deploy_server) {
        setDeploymentStatus(prev => ({
          ...prev,
          message: 'Error en el despliegue',
          error: error.message || 'Error desconocido',
          logs: [...prev.logs, `[ERROR] ${error.message || 'Error desconocido'}`]
        }));
      } else {
        alert('Error al agregar el servidor');
      }
    } finally {
      if (!formData.deploy_server) {
        // Solo resetear el loading si no hay despliegue (en caso de despliegue, se resetea después)
        setLoading(prev => ({ ...prev, deploying: false }));
      }
    }
  };

  // Estados para los modales de conexión
  const [sshModalOpen, setSshModalOpen] = useState(false);
  const [httpServerModalOpen, setHttpServerModalOpen] = useState(false);
  const [nginxModalOpen, setNginxModalOpen] = useState(false);
  const [currentServerInfo, setCurrentServerInfo] = useState(null);
  const [connectionInfo, setConnectionInfo] = useState(null);
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('password');
  const [httpPort, setHttpPort] = useState(9999);
  const [domain, setDomain] = useState('');

  // SSH Tunnel
  const startSSHTunnel = async (serverId, serverName) => {
    try {
      setUiStatus({
        serverId,
        url: null,
        error: null,
        loading: true
      });
      
      const response = await fetch(`/api/admin/duckdb-swarm/start-ssh-tunnel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ serverId })
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setUiStatus({
          serverId,
          url: data.ui_url,
          error: null,
          loading: false
        });
        
        // Mostrar el modal con la información de SSH
        setCurrentServerInfo({
          name: serverName,
          id: serverId
        });
        setConnectionInfo(data);
        setSshModalOpen(true);
      } else {
        setUiStatus({
          serverId,
          url: null,
          error: data.error || 'Error desconocido al configurar túnel SSH',
          loading: false
        });
        alert(`Error al configurar túnel SSH para ${serverName}: ${data.error || 'Error desconocido'}`);
      }
    } catch (error) {
      console.error('Error al configurar túnel SSH:', error);
      setUiStatus({
        serverId,
        url: null,
        error: error.message,
        loading: false
      });
      alert(`Error al configurar túnel SSH: ${error.message}`);
    }
  };
  
  // VNC Access
  const [vncModalOpen, setVncModalOpen] = useState(false);
  const [vncInfo, setVncInfo] = useState(null);
  const [redeploying, setRedeploying] = useState(false);
  
  // Redeployment completo del servidor (systemd) en lugar de reparación parcial
  const redeployServer = async (serverId, serverName) => {
    try {
      setRedeploying(true);
      
      // Verificar que el servidor existe y no es local
      const server = servers.find(s => s.id === serverId);
      if (!server) {
        alert(`No se encontró el servidor ${serverName}.`);
        setRedeploying(false);
        return;
      }
      
      if (server.is_local) {
        alert(`El servidor local no se puede redesplegar.`);
        setRedeploying(false);
        return;
      }
      
      // Confirmar acción con el usuario
      if (!confirm(`¿Está seguro de que desea redesplegar completamente el servidor ${serverName}?\n\nEsto reinstalará todos los servicios systemd y reiniciará el servidor DuckDB.`)) {
        setRedeploying(false);
        return;
      }
      
      // Mostrar el diálogo de progreso para el redespliegue
      setDeploymentStatus({
        message: 'Preparando redespliegue...',
        progress: 5,
        error: '',
        success: false,
        logs: ['Iniciando proceso de redespliegue...']
      });
      
      // Mostrar el modal de progreso
      setLoading(prev => ({ ...prev, deploying: true }));
      
      // Si el servidor no tiene credenciales SSH completas, pedir al usuario que proporcione las mínimas necesarias
      const ssh_host = server.ssh_host || prompt('Ingrese el host SSH (hostname o IP)', server.hostname);
      const ssh_port = server.ssh_port || parseInt(prompt('Ingrese el puerto SSH', '22'));
      const ssh_username = server.ssh_username || prompt('Ingrese el usuario SSH', 'root');
      const ssh_password = server.ssh_password || prompt('Ingrese la contraseña SSH (dejar en blanco si usa clave privada)');
      const ssh_key = server.ssh_key || ((!ssh_password) ? prompt('Ingrese la clave SSH privada completa') : '');
      
      if (!ssh_host || !ssh_username || (!ssh_password && !ssh_key)) {
        setDeploymentStatus(prev => ({
          ...prev,
          error: 'Se requieren credenciales SSH para redesplegar el servidor',
          logs: [...prev.logs, '[ERROR] Faltan credenciales SSH requeridas']
        }));
        setTimeout(() => {
          setLoading(prev => ({ ...prev, deploying: false }));
          setRedeploying(false);
        }, 1500);
        return;
      }
      
      setDeploymentStatus(prev => ({
        ...prev,
        progress: 15,
        message: 'Enviando solicitud de redespliegue...',
        logs: [...prev.logs, `[INFO] Conectando a ${ssh_host} con usuario ${ssh_username}`]
      }));
      
      // Usar el endpoint de deploy
      try {
        const response = await fetch(`/api/admin/duckdb-swarm/servers/${serverId}/deploy`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            force: true, // Forzar redespliegue aunque ya esté desplegado
            method: 'systemd', // Usar exclusivamente systemd
            ssh_host,
            ssh_port,
            ssh_username,
            ssh_password,
            ssh_key
          })
        });
        
        if (!response.ok) {
          throw new Error(`Error de servidor: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.success) {
          throw new Error(data.error || 'Error desconocido al redesplegar');
        }
        
        // Si llegamos aquí, el despliegue se inició correctamente
        setDeploymentStatus(prev => ({
          ...prev,
          progress: 25,
          message: 'Redespliegue iniciado correctamente',
          logs: [...prev.logs, `[INFO] Redespliegue iniciado para ${serverName}`, 
                             `[INFO] Instalando servicios systemd en ${ssh_host}`]
        }));
        
        // Actualizar estado cada 5 segundos para mostrar progreso
        let progress = 25;
        const progressInterval = setInterval(() => {
          progress += 5;
          if (progress >= 95) {
            clearInterval(progressInterval);
          }
          setDeploymentStatus(prev => ({
            ...prev,
            progress,
            logs: [...prev.logs, `[INFO] Progreso de instalación: ${progress}%`]
          }));
        }, 5000);
        
        // Cerrar automáticamente después de un tiempo
        setTimeout(() => {
          clearInterval(progressInterval);
          setDeploymentStatus(prev => ({
            ...prev,
            progress: 100,
            success: true,
            message: 'Redespliegue completado con éxito',
            logs: [...prev.logs, '[SUCCESS] Servidor redesplegado correctamente']
          }));
          
          // Cerrar modal y actualizar lista de servidores
          setTimeout(() => {
            setLoading(prev => ({ ...prev, deploying: false }));
            setRedeploying(false);
            fetchServers();
          }, 2000);
        }, 60000); // 1 minuto, tiempo suficiente para la mayoría de los despliegues
        
      } catch (error) {
        console.error('Error al iniciar redespliegue:', error);
        
        setDeploymentStatus(prev => ({
          ...prev,
          error: error.message,
          message: 'Error en el redespliegue',
          logs: [...prev.logs, `[ERROR] ${error.message}`]
        }));
        
        // Esperar un momento antes de cerrar el modal
        setTimeout(() => {
          setLoading(prev => ({ ...prev, deploying: false }));
          setRedeploying(false);
        }, 3000);
      }
    } catch (error) {
      console.error('Error general al redesplegar servidor:', error);
      
      setDeploymentStatus(prev => ({
        ...prev,
        error: error.message,
        message: 'Error en el redespliegue',
        logs: [...prev.logs, `[ERROR] ${error.message}`]
      }));
      
      // Esperar un momento antes de cerrar el modal
      setTimeout(() => {
        setLoading(prev => ({ ...prev, deploying: false }));
        setRedeploying(false);
      }, 3000);
    }
  };
  
  const startVNCSession = async (serverId, serverName) => {
    try {
      // Verificar que el servidor existe y no es local
      const server = servers.find(s => s.id === serverId);
      if (!server) {
        alert(`No se encontró el servidor ${serverName}.`);
        return;
      }
      
      if (server.is_local) {
        alert(`El servidor local no tiene acceso VNC.`);
        return;
      }
      
      setUiStatus({
        serverId,
        url: null,
        error: null,
        loading: true
      });
      
      // Información VNC por defecto para servidores remotos
      // Usar el usuario 'admin' y la clave del API
      const defaultVncInfo = {
        host: server.hostname,
        port: 5901,
        username: 'admin',
        password: server.server_key || 'duckdbpass',
        url: `http://${server.hostname}:6080/vnc.html?autoconnect=true&password=${server.server_key || 'duckdbpass'}`
      };
      
      // Mostrar el modal con la información de VNC
      setCurrentServerInfo({
        name: serverName,
        id: serverId,
        hostname: server.hostname
      });
      
      // Usar la información VNC del servidor si existe, o la predeterminada
      setVncInfo(server.vnc_info || defaultVncInfo);
      setVncModalOpen(true);
      
      setUiStatus({
        serverId,
        url: null,
        error: null,
        loading: false
      });
    } catch (error) {
      console.error('Error al iniciar sesión VNC:', error);
      setUiStatus({
        serverId,
        url: null,
        error: error.message,
        loading: false
      });
      alert(`Error al iniciar sesión VNC: ${error.message}`);
    }
  };
  
  // HTTP Server
  const startHTTPServer = async (serverId, serverName) => {
    try {
      // Mostrar el modal para solicitar credenciales
      setCurrentServerInfo({
        name: serverName,
        id: serverId
      });
      setHttpServerModalOpen(true);
    } catch (error) {
      console.error('Error al iniciar configuración HTTP:', error);
      alert(`Error al iniciar configuración HTTP: ${error.message}`);
    }
  };
  
  // Función que se ejecuta después de ingresar credenciales
  const confirmHttpServerSetup = async () => {
    try {
      setUiStatus({
        serverId: currentServerInfo.id,
        url: null,
        error: null,
        loading: true
      });
      
      const response = await fetch(`/api/admin/duckdb-swarm/start-httpserver`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          serverId: currentServerInfo.id,
          port: httpPort,
          username: username,
          password: password
        })
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setUiStatus({
          serverId: currentServerInfo.id,
          url: data.server_url,
          error: null,
          loading: false
        });
        
        // Actualizar la información de conexión y cerrar el modal de credenciales
        setConnectionInfo(data);
        setHttpServerModalOpen(false);
        
        // Mostrar un modal con las instrucciones
        alert(`
Configuración para servidor HTTP DuckDB generada correctamente.

Para iniciar el servidor HTTP:
1. Ejecute estos comandos SQL en DuckDB:
${data.sql_command}

2. Una vez ejecutados, acceda a:
${data.server_url}

3. Use las credenciales:
Usuario: ${username}
Contraseña: ${password}
        `);
      } else {
        setUiStatus({
          serverId: currentServerInfo.id,
          url: null,
          error: data.error || 'Error desconocido al configurar servidor HTTP',
          loading: false
        });
        alert(`Error al configurar servidor HTTP para ${currentServerInfo.name}: ${data.error || 'Error desconocido'}`);
      }
    } catch (error) {
      console.error('Error al configurar servidor HTTP:', error);
      setUiStatus({
        serverId: currentServerInfo.id,
        url: null,
        error: error.message,
        loading: false
      });
      alert(`Error al configurar servidor HTTP: ${error.message}`);
    } finally {
      setHttpServerModalOpen(false);
    }
  };
  
  // Nginx Proxy
  const startNginxProxy = async (serverId, serverName) => {
    try {
      // Mostrar el modal para solicitar nombre de dominio
      setCurrentServerInfo({
        name: serverName,
        id: serverId
      });
      setNginxModalOpen(true);
    } catch (error) {
      console.error('Error al iniciar configuración Nginx:', error);
      alert(`Error al iniciar configuración Nginx: ${error.message}`);
    }
  };
  
  // Función que se ejecuta después de ingresar el dominio
  const confirmNginxSetup = async () => {
    try {
      setUiStatus({
        serverId: currentServerInfo.id,
        url: null,
        error: null,
        loading: true
      });
      
      const response = await fetch(`/api/admin/duckdb-swarm/start-nginx-proxy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          serverId: currentServerInfo.id,
          domain: domain
        })
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setUiStatus({
          serverId: currentServerInfo.id,
          url: `http://${domain}`,
          error: null,
          loading: false
        });
        
        // Actualizar la información de conexión y cerrar el modal de dominio
        setConnectionInfo(data);
        setNginxModalOpen(false);
        
        // Mostrar la configuración en un alert por simplicidad
        alert(`
Configuración de Nginx generada correctamente.

Configuración HTTP:
${data.nginx_config}

Configuración HTTPS:
${data.nginx_ssl_config}

Para instrucciones detalladas, revise la configuración generada.
        `);
      } else {
        setUiStatus({
          serverId: currentServerInfo.id,
          url: null,
          error: data.error || 'Error desconocido al generar configuración Nginx',
          loading: false
        });
        alert(`Error al generar configuración Nginx para ${currentServerInfo.name}: ${data.error || 'Error desconocido'}`);
      }
    } catch (error) {
      console.error('Error al generar configuración Nginx:', error);
      setUiStatus({
        serverId: currentServerInfo.id,
        url: null,
        error: error.message,
        loading: false
      });
      alert(`Error al generar configuración Nginx: ${error.message}`);
    } finally {
      setNginxModalOpen(false);
    }
  };
  
  // Función para cancelar un despliegue en curso
  const cancelDeploy = async (serverId) => {
    try {
      setLoading(prev => ({ ...prev, servers: true }));
      
      const response = await fetch(`/api/admin/duckdb-swarm/servers/${serverId}/cancel-deploy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (response.ok) {
        alert(data.message || 'Despliegue cancelado exitosamente');
        fetchServers(); // Actualizar lista de servidores
      } else {
        alert(`Error al cancelar el despliegue: ${data.error || 'Error desconocido'}`);
      }
    } catch (error) {
      console.error('Error al cancelar el despliegue:', error);
      alert(`Error al cancelar el despliegue: ${error.message}`);
    } finally {
      setLoading(prev => ({ ...prev, servers: false }));
    }
  };

  // Get status color based on server status
  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'bg-green-500';
      case 'standby':
        return 'bg-yellow-500';
      case 'deploying':
        return 'bg-yellow-500';
      case 'starting':
        return 'bg-blue-500';
      case 'stopped':
        return 'bg-red-500';
      case 'error':
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
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nombre Descriptivo
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Servidor de Análisis Financiero, DuckDB Principal, etc."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                required
              />
            </div>
            
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
                          
                          // Intentar crear bucket usando el endpoint existente de emisores
                          try {
                            const response = await fetch('/api/emisores/crear-bucket', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                secreto_id: formData.cloud_secret_id,
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
                    if (formData.cloud_secret_id && formData.bucket_name) {
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
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Gestión del Enjambre DuckDB
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Administre servidores DuckDB, bases de datos y métricas desde una única interfaz
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <Link href="/admin/duckdb-swarm/scripts" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 inline-flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            Gestionar Scripts
          </Link>
        </div>
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
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Nombre</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Hostname</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Puerto</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Tipo</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Estado</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {servers.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                          No hay servidores registrados
                        </td>
                      </tr>
                    ) : (
                      servers.map(server => (
                        <tr key={server.id}>
                          <td className="px-6 py-4 whitespace-nowrap">{server.id}</td>
                          <td className="px-6 py-4 whitespace-nowrap font-medium">{server.name || "Sin nombre"}</td>
                          <td className="px-6 py-4 whitespace-nowrap">{server.hostname}</td>
                          <td className="px-6 py-4 whitespace-nowrap">{server.port}</td>
                          <td className="px-6 py-4 whitespace-nowrap">{server.server_type}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="flex items-center">
                              <span className={`inline-block w-3 h-3 rounded-full mr-2 ${getStatusColor(server.status)}`}></span>
                              <div className="flex items-center">
                                <span>{server.status}</span>
                                {server.status === 'deploying' && (
                                  <button
                                    className="ml-2 text-xs bg-red-100 hover:bg-red-200 text-red-800 py-1 px-2 rounded"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (confirm('¿Estás seguro de cancelar el despliegue? Esta acción no se puede deshacer.')) {
                                        cancelDeploy(server.id);
                                      }
                                    }}
                                  >
                                    Cancelar
                                  </button>
                                )}
                              </div>
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-4">
                            {(server.status === 'active' || server.status === 'error') && (
                              <div className="flex flex-wrap gap-2">
                                {/* VNC Access - Solo para servidores no locales */}
                                {!server.is_local && (
                                  <>
                                    <button
                                      onClick={() => startVNCSession(server.id, server.name || server.hostname)}
                                      disabled={uiStatus.loading && uiStatus.serverId === server.id}
                                      className="text-purple-600 hover:text-purple-900 dark:text-purple-400 dark:hover:text-purple-300 inline-flex items-center"
                                      title="Acceder al entorno gráfico mediante VNC"
                                    >
                                      {uiStatus.loading && uiStatus.serverId === server.id ? (
                                        <>
                                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                          </svg>
                                          Iniciando...
                                        </>
                                      ) : (
                                        <>
                                          <svg className="h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                          </svg>
                                          Acceso VNC
                                        </>
                                      )}
                                    </button>
                                    
                                    {/* Botón de Redespliegue */}
                                    <button
                                      onClick={() => redeployServer(server.id, server.name || server.hostname)}
                                      disabled={redeploying}
                                      className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 inline-flex items-center ml-2"
                                      title="Redesplegar completamente el servidor (reinstalación systemd)"
                                    >
                                      {redeploying ? (
                                        <>
                                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                          </svg>
                                          Redesplegando...
                                        </>
                                      ) : (
                                        <>
                                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                          </svg>
                                          Redesplegar
                                        </>
                                      )}
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                            
                            <button
                              onClick={() => {
                                // Cargar datos del servidor para edición, incluyendo credenciales SSH si existen
                                setFormData({
                                  id: server.id,
                                  name: server.name || '',
                                  hostname: server.hostname,
                                  port: server.port,
                                  server_key: server.server_key || '',
                                  server_type: server.server_type,
                                  is_local: server.is_local,
                                  installation_id: server.installation_id || '',
                                  cloud_secret_id: server.cloud_secret_id || '',
                                  bucket_name: server.bucket_name || '',
                                  ssh_host: server.ssh_host || '',
                                  ssh_port: server.ssh_port || 22,
                                  ssh_username: server.ssh_username || '',
                                  ssh_password: server.ssh_password || '',
                                  ssh_key: server.ssh_key || '',
                                  deploy_server: false
                                });
                                setEditMode(true);
                                setShowEditModal(true);
                              }}
                              className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                            >
                              Editar
                            </button>
                            
                            {/* Eliminado el botón duplicado de redespliegue, usamos solo el de la acción principal */}
                            {false && !server.is_local && (
                              <button
                                onClick={async () => {
                                  if (confirm(`¿Seguro que deseas redesplegar el servidor ${server.name || server.hostname}?`)) {
                                    // Mostrar diálogo de progreso
                                    setLoading(prev => ({ ...prev, deploying: true }));
                                    setDeploymentStatus({
                                      message: 'Preparando redespliegue...',
                                      progress: 5,
                                      error: '',
                                      success: false,
                                      logs: ['Iniciando proceso de redespliegue...']
                                    });
                                    
                                    try {
                                      // Inicializar con los datos SSH almacenados si existen
                                      const sshFormData = {
                                        ssh_host: server.ssh_host || '',
                                        ssh_port: server.ssh_port || 22,
                                        ssh_username: server.ssh_username || '',
                                        ssh_password: server.ssh_password || '',
                                        ssh_key: server.ssh_key || ''
                                      };
                                      
                                      // Verificar si ya tenemos datos SSH completos
                                      const hasSshCredentials = sshFormData.ssh_host && 
                                                               sshFormData.ssh_username && 
                                                               (sshFormData.ssh_password || sshFormData.ssh_key);
                                      
                                      // Solicitar información SSH solo si no está completa
                                      if (!hasSshCredentials) {
                                        // Actualizar mensaje de log
                                        setDeploymentStatus(prev => ({
                                          ...prev,
                                          message: 'Solicitando credenciales SSH...',
                                          logs: [...prev.logs, '[INFO] No se encontraron credenciales SSH almacenadas. Solicitando al usuario...']
                                        }));
                                        
                                        const userSSHInput = prompt(
                                          `Ingrese los datos SSH para el servidor ${server.name || server.hostname} en formato JSON:\n` +
                                          '{\n' +
                                          '  "ssh_host": "host.example.com",\n' +
                                          '  "ssh_port": 22,\n' +
                                          '  "ssh_username": "usuario",\n' +
                                          '  "ssh_password": "contraseña",\n' +
                                          '  "ssh_key": "opcional-clave-ssh"\n' +
                                          '}'
                                        );
                                        
                                        if (!userSSHInput) {
                                          setLoading(prev => ({ ...prev, deploying: false }));
                                          return;
                                        }
                                        
                                        try {
                                          const parsedSSH = JSON.parse(userSSHInput);
                                          Object.assign(sshFormData, parsedSSH);
                                        } catch (e) {
                                          setDeploymentStatus(prev => ({
                                            ...prev,
                                            message: 'Error de formato JSON',
                                            error: 'El formato JSON ingresado es inválido',
                                            logs: [...prev.logs, '[ERROR] El formato JSON ingresado es inválido: ' + e.message]
                                          }));
                                          
                                          // Esperar 3 segundos y cerrar el diálogo
                                          setTimeout(() => {
                                            setLoading(prev => ({ ...prev, deploying: false }));
                                          }, 3000);
                                          return;
                                        }
                                      } else {
                                        // Registrar que estamos usando credenciales almacenadas
                                        setDeploymentStatus(prev => ({
                                          ...prev,
                                          message: 'Usando credenciales SSH almacenadas...',
                                          logs: [...prev.logs, '[INFO] Usando credenciales SSH almacenadas para el servidor.']
                                        }));
                                      }
                                      
                                      // Validar datos SSH
                                      if (!sshFormData.ssh_host || !sshFormData.ssh_username || (!sshFormData.ssh_password && !sshFormData.ssh_key)) {
                                        setDeploymentStatus(prev => ({
                                          ...prev,
                                          message: 'Datos SSH incompletos',
                                          error: 'Debe proporcionar host, usuario y contraseña o clave SSH',
                                          logs: [...prev.logs, '[ERROR] Datos SSH incompletos. Se requiere host, usuario y contraseña o clave SSH.']
                                        }));
                                        
                                        // Esperar 3 segundos y cerrar el diálogo
                                        setTimeout(() => {
                                          setLoading(prev => ({ ...prev, deploying: false }));
                                        }, 3000);
                                        return;
                                      }
                                      
                                      // Esta sería la llamada para redesplegar
                                      setDeploymentStatus(prev => ({
                                        ...prev,
                                        message: 'Enviando solicitud al servidor...',
                                        progress: 15,
                                        logs: [...prev.logs, '[INFO] Enviando solicitud al servidor...']
                                      }));
                                      
                                      const response = await fetch(`/api/admin/duckdb-swarm/servers/${server.id}/redeploy`, {
                                        method: 'POST',
                                        headers: {
                                          'Content-Type': 'application/json'
                                        },
                                        body: JSON.stringify(sshFormData)
                                      });
                                      
                                      const responseData = await response.json();
                                      
                                      if (response.ok) {
                                        setDeploymentStatus(prev => ({
                                          ...prev,
                                          message: 'Solicitud de redespliegue enviada',
                                          progress: 25,
                                          logs: [...prev.logs, '[SUCCESS] Solicitud de redespliegue enviada correctamente']
                                        }));
                                        
                                        // Iniciar monitoreo del progreso
                                        const monitorInterval = setInterval(async () => {
                                          const completed = await checkDeploymentProgress(server.id);
                                          if (completed) {
                                            clearInterval(monitorInterval);
                                            fetchServers(); // Actualizar la lista de servidores
                                          }
                                        }, 5000); // Verificar cada 5 segundos
                                        
                                        // Prevenir que el intervalo continúe indefinidamente
                                        setTimeout(() => {
                                          clearInterval(monitorInterval);
                                          // Si después de 3 minutos no ha terminado, mostrar mensaje
                                          setDeploymentStatus(prev => {
                                            if (!prev.success && !prev.error) {
                                              return {
                                                ...prev,
                                                message: 'El redespliegue está tomando más tiempo de lo esperado',
                                                logs: [...prev.logs, '[INFO] El redespliegue continúa en segundo plano. Puede verificar el estado más tarde.']
                                              };
                                            }
                                            return prev;
                                          });
                                        }, 180000); // 3 minutos
                                      } else {
                                        setDeploymentStatus(prev => ({
                                          ...prev,
                                          message: 'Error en el redespliegue',
                                          error: responseData.error || 'Error desconocido',
                                          logs: [...prev.logs, `[ERROR] ${responseData.error || 'Error desconocido'}`]
                                        }));
                                        
                                        // Si hay detalles del error del despliegue, mostrarlos
                                        if (responseData.details && responseData.details.output) {
                                          const logLines = responseData.details.output.split('\n');
                                          setDeploymentStatus(prev => ({
                                            ...prev,
                                            logs: [...prev.logs, ...logLines.map(line => `[OUTPUT] ${line}`)]
                                          }));
                                          
                                          // Buscar errores específicos para mostrar mensajes más claros
                                          if (responseData.details.output.includes("No module named 'duckdb'") || 
                                              responseData.details.output.includes("No se encontró pip ni pip3")) {
                                            setDeploymentStatus(prev => ({
                                              ...prev,
                                              error: 'Faltan dependencias en el servidor remoto',
                                              message: 'Es necesario instalar manualmente las dependencias en el servidor',
                                              logs: [...prev.logs, 
                                                '[REQUISITOS] Por favor, ejecute estos comandos en el servidor remoto:',
                                                '[REQUISITOS] sudo apt-get update',
                                                '[REQUISITOS] sudo apt-get install -y python3-pip',
                                                '[REQUISITOS] pip3 install --user duckdb flask flask-cors',
                                                '[REQUISITOS] Luego, intente redesplegar el servidor.']
                                            }));
                                          }
                                        }
                                      }
                                    } catch (error) {
                                      console.error('Error redeploying server:', error);
                                      setDeploymentStatus(prev => ({
                                        ...prev,
                                        message: 'Error en el redespliegue',
                                        error: error.message || 'Error desconocido',
                                        logs: [...prev.logs, `[ERROR] ${error.message || 'Error desconocido'}`]
                                      }));
                                    }
                                  }
                                }}
                                className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                              >
                                Redesplegar
                              </button>
                            )}
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

      {/* Modal de Edición */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 dark:bg-gray-900 opacity-75"></div>
            </div>
            
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            
            <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-3xl sm:w-full">
              <div className="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                      Editar Servidor: {formData.name || formData.hostname}
                    </h3>
                    <div className="mt-4">
                      <form onSubmit={async (e) => {
                        e.preventDefault();
                        try {
                          const response = await fetch(`/api/admin/duckdb-swarm/servers/${formData.id}`, {
                            method: 'PUT',
                            headers: {
                              'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                              name: formData.name,
                              hostname: formData.hostname,
                              port: formData.port,
                              server_key: formData.server_key,
                              server_type: formData.server_type,
                              is_local: formData.is_local,
                              installation_id: formData.installation_id,
                              cloud_secret_id: formData.cloud_secret_id,
                              bucket_name: formData.bucket_name
                            })
                          });
                          
                          if (response.ok) {
                            alert('Servidor actualizado correctamente');
                            fetchServers();
                            setShowEditModal(false);
                            setEditMode(false);
                            // Resetear el formulario a su estado inicial
                            setFormData({
                              id: null,
                              name: '',
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
                          } else {
                            const error = await response.json();
                            alert(error.error || 'Error al actualizar el servidor');
                          }
                        } catch (error) {
                          console.error('Error updating server:', error);
                          alert('Error al actualizar el servidor');
                        }
                      }}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Nombre Descriptivo
                            </label>
                            <input
                              type="text"
                              name="name"
                              value={formData.name}
                              onChange={handleInputChange}
                              placeholder="Nombre descriptivo"
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Hostname / IP
                            </label>
                            <input
                              type="text"
                              name="hostname"
                              value={formData.hostname}
                              onChange={handleInputChange}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                              required
                            />
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Puerto
                            </label>
                            <input
                              type="number"
                              name="port"
                              value={formData.port}
                              onChange={handleInputChange}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                              required
                            />
                          </div>
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
                        </div>
                        
                        <div className="mt-4">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Clave del Servidor
                          </label>
                          <input
                            type="password"
                            name="server_key"
                            value={formData.server_key}
                            onChange={handleInputChange}
                            placeholder="Dejar en blanco para no cambiar"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                          />
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Deja este campo en blanco si no deseas cambiar la clave
                          </p>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Instalación SAGE
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
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Secreto Cloud
                            </label>
                            <select
                              name="cloud_secret_id"
                              value={formData.cloud_secret_id}
                              onChange={(e) => {
                                setFormData({ 
                                  ...formData, 
                                  cloud_secret_id: e.target.value,
                                  bucket_name: '' 
                                });
                              }}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                            >
                              <option value="">Ninguno</option>
                              {cloudSecrets.map(secret => (
                                <option key={secret.id} value={secret.id.toString()}>
                                  {secret.nombre} ({secret.tipo})
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        
                        {formData.cloud_secret_id && (
                          <div className="mt-4">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Bucket
                            </label>
                            <select
                              name="bucket_name"
                              value={formData.bucket_name}
                              onChange={handleInputChange}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                              required={!!formData.cloud_secret_id}
                            >
                              <option value="" disabled>Seleccionar bucket</option>
                              {buckets.map(bucket => (
                                <option key={bucket.name} value={bucket.name}>
                                  {bucket.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                        
                        <div className="flex items-center mt-4">
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
                        
                        <div className="mt-6 flex justify-end space-x-3">
                          <button
                            type="button"
                            onClick={() => {
                              setShowEditModal(false);
                              setEditMode(false);
                              // Resetear el formulario a su estado inicial
                              setFormData({
                                id: null,
                                name: '',
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
                            }}
                            className="inline-flex justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-white dark:bg-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                          >
                            Cancelar
                          </button>
                          <button
                            type="submit"
                            className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                          >
                            Guardar Cambios
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal de progreso de despliegue */}
      {loading.deploying && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white flex items-center">
              {deploymentStatus.success ? (
                <svg className="w-6 h-6 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : deploymentStatus.error ? (
                <svg className="w-6 h-6 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-blue-500 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              {deploymentStatus.message || "Desplegando servidor DuckDB..."}
            </h2>
            
            {/* Barra de progreso */}
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mb-4">
              <div 
                className="bg-blue-600 h-2.5 rounded-full" 
                style={{ width: `${deploymentStatus.progress}%` }}
              ></div>
            </div>
            
            {/* Logs de despliegue */}
            <div className="flex-1 bg-gray-100 dark:bg-gray-900 p-4 rounded-md font-mono text-sm overflow-y-auto mb-4 max-h-96">
              {deploymentStatus.logs.map((log, index) => (
                <div key={index} className="mb-1">
                  {log.includes('[INFO]') ? (
                    <span className="text-blue-600 dark:text-blue-400">{log}</span>
                  ) : log.includes('[SUCCESS]') ? (
                    <span className="text-green-600 dark:text-green-400">{log}</span>
                  ) : log.includes('[ERROR]') ? (
                    <span className="text-red-600 dark:text-red-400">{log}</span>
                  ) : log.includes('Error:') ? (
                    <span className="text-red-600 dark:text-red-400">{log}</span>
                  ) : (
                    <span>{log}</span>
                  )}
                </div>
              ))}
            </div>
            
            {/* Botones */}
            <div className="flex justify-end space-x-3">
              {(deploymentStatus.success || deploymentStatus.error) && (
                <button
                  onClick={() => setLoading(prev => ({ ...prev, deploying: false }))}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Cerrar
                </button>
              )}
              
              {!deploymentStatus.success && !deploymentStatus.error && (
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Por favor espere mientras se despliega el servidor...
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Modal para SSH Tunnel */}
      {sshModalOpen && connectionInfo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Conexión SSH a {currentServerInfo?.name || 'servidor'}
                </h2>
                <button 
                  onClick={() => setSshModalOpen(false)}
                  className="text-gray-400 hover:text-gray-500 focus:outline-none"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 dark:bg-blue-900 rounded-lg">
                  <p className="text-blue-800 dark:text-blue-200 font-medium mb-2">
                    Siga estas instrucciones para conectarse a la UI de DuckDB mediante SSH:
                  </p>
                  <ol className="list-decimal pl-5 space-y-2 text-blue-700 dark:text-blue-300">
                    {connectionInfo.instructions.map((instruction, index) => (
                      <li key={index}>{instruction}</li>
                    ))}
                  </ol>
                </div>
                
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Comando SSH para túnel
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <pre className="p-3 bg-gray-50 dark:bg-gray-900 rounded border border-gray-300 dark:border-gray-700 font-mono text-sm text-gray-800 dark:text-gray-200 overflow-x-auto">
                      {connectionInfo.tunnel_command}
                    </pre>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(connectionInfo.tunnel_command);
                        alert('Comando copiado al portapapeles');
                      }}
                      className="absolute right-2 top-2 p-2 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
                      title="Copiar al portapapeles"
                    >
                      <svg className="h-4 w-4 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-12a2 2 0 00-2-2h-2M8 5a2 2 0 002 2h4a2 2 0 002-2M8 5a2 2 0 012-2h4a2 2 0 012 2" />
                      </svg>
                    </button>
                  </div>
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    Copie y pegue este comando en su terminal para crear un túnel SSH seguro.
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    URL de acceso (después de establecer el túnel)
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <input
                      type="text"
                      readOnly
                      value={connectionInfo.ui_url}
                      className="block w-full pr-10 sm:text-sm border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-md"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(connectionInfo.ui_url);
                        alert('URL copiada al portapapeles');
                      }}
                      className="absolute inset-y-0 right-0 px-3 flex items-center bg-gray-100 dark:bg-gray-700 rounded-r-md"
                      title="Copiar al portapapeles"
                    >
                      <svg className="h-4 w-4 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-12a2 2 0 00-2-2h-2M8 5a2 2 0 002 2h4a2 2 0 002-2M8 5a2 2 0 012-2h4a2 2 0 012 2" />
                      </svg>
                    </button>
                  </div>
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    Una vez establecido el túnel SSH, abra esta URL en su navegador para acceder a la UI de DuckDB.
                  </p>
                </div>
              </div>
              
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setSshModalOpen(false)}
                  className="px-4 py-2 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal para VNC Access */}
      {vncModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Acceso VNC a {currentServerInfo.name || 'Servidor'}
                </h2>
                <button 
                  onClick={() => setVncModalOpen(false)}
                  className="text-gray-400 hover:text-gray-500 focus:outline-none"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="p-3 bg-purple-50 dark:bg-purple-900 rounded-lg">
                  <p className="text-purple-800 dark:text-purple-200 text-sm">
                    Acceda al entorno gráfico completo del servidor DuckDB a través de su navegador o con un cliente VNC.
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Opción 1: noVNC (Acceso Web) */}
                  <div className="border border-green-200 dark:border-green-800 rounded-lg p-4 bg-green-50 dark:bg-green-900/30">
                    <h3 className="text-md font-semibold text-green-700 dark:text-green-300 mb-2">Opción 1: Acceso Web (Recomendado)</h3>
                    <p className="text-sm text-green-600 dark:text-green-400 mb-3">
                      Accede directamente desde tu navegador sin necesidad de instalar software adicional.
                    </p>
                    <div className="flex justify-center">
                      <a 
                        href={`http://${currentServerInfo.hostname}:6080/vnc.html?autoconnect=true&password=${vncInfo?.password || 'duckdbpass'}`}
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors duration-200"
                      >
                        Abrir noVNC en Navegador
                      </a>
                    </div>
                  </div>
                  
                  {/* Opción 2: Cliente VNC Nativo */}
                  <div className="border border-blue-200 dark:border-blue-800 rounded-lg p-4 bg-blue-50 dark:bg-blue-900/30">
                    <h3 className="text-md font-semibold text-blue-700 dark:text-blue-300 mb-2">Opción 2: Cliente VNC Nativo</h3>
                    <p className="text-sm text-blue-600 dark:text-blue-400 mb-3">
                      Conéctate con tu cliente VNC preferido usando estos datos:
                    </p>
                    <div className="text-xs font-mono bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700">
                      <p><strong>Host:</strong> {currentServerInfo.hostname}</p>
                      <p><strong>Puerto:</strong> {vncInfo?.port || 5901}</p>
                      <p><strong>Usuario:</strong> {vncInfo?.username || 'admin'}</p>
                      <p><strong>Contraseña:</strong> {vncInfo?.password || 'duckdbpass'}</p>
                    </div>
                  </div>
                </div>
                
                <div className="p-3 bg-blue-50 dark:bg-blue-900 rounded-lg mt-4">
                  <p className="text-blue-800 dark:text-blue-200 text-sm">
                    <strong>Nota:</strong> Si experimenta problemas de conexión, pruebe primero con la opción de acceso web (noVNC).
                    Una vez dentro, ejecute <code>~/start-duckdb-ui.sh</code> para iniciar la interfaz DuckDB.
                  </p>
                </div>
              </div>
              
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setVncModalOpen(false)}
                  className="px-4 py-2 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal para HTTP Server */}
      {httpServerModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Configurar Servidor HTTP de DuckDB
                </h2>
                <button 
                  onClick={() => setHttpServerModalOpen(false)}
                  className="text-gray-400 hover:text-gray-500 focus:outline-none"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900 rounded-lg">
                  <p className="text-yellow-800 dark:text-yellow-200 text-sm">
                    Esta opción configura la extensión httpserver de DuckDB para proporcionar acceso remoto. Requiere que especifique credenciales de autenticación.
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Puerto
                  </label>
                  <input
                    type="number"
                    value={httpPort}
                    onChange={(e) => setHttpPort(parseInt(e.target.value) || 9999)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                    min="1024"
                    max="65535"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Puerto en el que se ejecutará el servidor HTTP (recomendado: 9999)
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Nombre de Usuario
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Contraseña
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>
              
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setHttpServerModalOpen(false)}
                  className="px-4 py-2 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmHttpServerSetup}
                  className="px-4 py-2 bg-green-600 text-white rounded-md shadow-sm hover:bg-green-700 focus:outline-none"
                >
                  Configurar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal para Nginx Proxy */}
      {nginxModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Configurar Proxy Nginx
                </h2>
                <button 
                  onClick={() => setNginxModalOpen(false)}
                  className="text-gray-400 hover:text-gray-500 focus:outline-none"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="p-3 bg-purple-50 dark:bg-purple-900 rounded-lg">
                  <p className="text-purple-800 dark:text-purple-200 text-sm">
                    Esta opción genera configuración para Nginx como proxy inverso para la UI de DuckDB, ideal para equipos que necesitan acceso remoto con un dominio personalizado.
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Nombre de Dominio
                  </label>
                  <input
                    type="text"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    placeholder="duckdb.midominio.com"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Dominio que apunta al servidor donde se ejecuta DuckDB
                  </p>
                </div>
              </div>
              
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setNginxModalOpen(false)}
                  className="px-4 py-2 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmNginxSetup}
                  className="px-4 py-2 bg-purple-600 text-white rounded-md shadow-sm hover:bg-purple-700 focus:outline-none"
                >
                  Generar Configuración
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DuckDBSwarmSimple;