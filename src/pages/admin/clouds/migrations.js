import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { toast } from 'react-toastify';
import AdminLayout from '../../../components/layouts/AdminLayout';
import { 
  CloudArrowUpIcon, 
  PlusCircleIcon, 
  ArrowPathIcon,
  CheckCircleIcon, 
  XCircleIcon,
  ClockIcon,
  PlayIcon
} from '@heroicons/react/24/outline';
import { 
  Metric, 
  Text, 
  Title, 
  Subtitle, 
  Badge, 
  Button, 
  Card, 
  Table,
  ProgressBar 
} from '@tremor/react';

// Estado inicial para una nueva migración
const initialMigrationState = {
  provider_id: '',
  source_path: '',
  target_path: '',
  description: '',
  options: {
    batch_size: 10,
    delete_after_migration: false,
    update_database_references: true
  }
};

// Estados de migración
const MigrationStatus = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

// Colores para los estados
const statusColors = {
  [MigrationStatus.PENDING]: 'amber',
  [MigrationStatus.IN_PROGRESS]: 'blue',
  [MigrationStatus.COMPLETED]: 'green',
  [MigrationStatus.FAILED]: 'red'
};

// Nombres descriptivos para los estados
const statusNames = {
  [MigrationStatus.PENDING]: 'Pendiente',
  [MigrationStatus.IN_PROGRESS]: 'En progreso',
  [MigrationStatus.COMPLETED]: 'Completada',
  [MigrationStatus.FAILED]: 'Fallida'
};

// Iconos para los estados
const StatusIcons = {
  [MigrationStatus.PENDING]: ClockIcon,
  [MigrationStatus.IN_PROGRESS]: ArrowPathIcon,
  [MigrationStatus.COMPLETED]: CheckCircleIcon,
  [MigrationStatus.FAILED]: XCircleIcon
};

// Componente para formatear tamaños de archivos
function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

// Estado de las migraciones
function CloudMigrations() {
  const router = useRouter();
  const [migrations, setMigrations] = useState([]);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [currentMigration, setCurrentMigration] = useState(initialMigrationState);
  const [executingId, setExecutingId] = useState(null);

  // Cargar migraciones y proveedores
  useEffect(() => {
    fetchMigrations();
    fetchProviders();
  }, []);

  // Obtener todas las migraciones
  const fetchMigrations = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/migrations');
      
      if (!response.ok) {
        if (response.status === 404) {
          // La API aún no está implementada
          setMigrations([]);
          toast.info('El API de migraciones aún no está implementada. Se mostrarán datos de ejemplo.');
          
          // Generar algunos datos de ejemplo
          const exampleMigrations = [
            {
              id: 1,
              provider_id: 1,
              provider_name: 'Amazon S3 - Producción',
              provider_type: 's3',
              source_path: '/path/to/executions',
              target_path: 's3://bucket/executions',
              description: 'Migración de archivos de ejecución a S3',
              status: 'completed',
              progress: 1,
              files_total: 243,
              files_processed: 243,
              bytes_total: 1073741824,
              bytes_processed: 1073741824,
              started_at: new Date(Date.now() - 3600000).toISOString(),
              completed_at: new Date().toISOString(),
              created_at: new Date(Date.now() - 7200000).toISOString()
            },
            {
              id: 2,
              provider_id: 2,
              provider_name: 'Azure Blob Storage',
              provider_type: 'azure',
              source_path: '/path/to/reports',
              target_path: 'azure://container/reports',
              description: 'Migración de reportes a Azure',
              status: 'in_progress',
              progress: 0.35,
              files_total: 125,
              files_processed: 44,
              bytes_total: 536870912,
              bytes_processed: 188743680,
              started_at: new Date(Date.now() - 1800000).toISOString(),
              created_at: new Date(Date.now() - 1800000).toISOString()
            },
            {
              id: 3,
              provider_id: 3,
              provider_name: 'SFTP Corporativo',
              provider_type: 'sftp',
              source_path: '/path/to/archives',
              target_path: 'sftp://server/archives',
              description: 'Archivos históricos a SFTP',
              status: 'pending',
              progress: 0,
              created_at: new Date(Date.now() - 900000).toISOString()
            }
          ];
          
          setMigrations(exampleMigrations);
          return;
        }
        
        throw new Error('Error al cargar migraciones');
      }
      
      const data = await response.json();
      setMigrations(data);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar migraciones: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Obtener todos los proveedores activos
  const fetchProviders = async () => {
    try {
      const response = await fetch('/api/clouds');
      
      if (!response.ok) {
        throw new Error('Error al cargar proveedores');
      }
      
      // Filtrar solo los proveedores activos
      const data = await response.json();
      const activeProviders = data.filter(provider => provider.activo);
      setProviders(activeProviders);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar proveedores: ' + error.message);
    }
  };

  // Validar el formulario
  const validateForm = () => {
    if (!currentMigration.provider_id) {
      toast.error('Debe seleccionar un proveedor de nube');
      return false;
    }

    if (!currentMigration.source_path) {
      toast.error('Debe especificar una ruta de origen');
      return false;
    }

    if (!currentMigration.target_path) {
      toast.error('Debe especificar una ruta de destino');
      return false;
    }

    return true;
  };

  // Crear una nueva tarea de migración
  const createMigration = async () => {
    if (!validateForm()) return;

    try {
      const response = await fetch('/api/migrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentMigration)
      });

      if (!response.ok) {
        if (response.status === 404) {
          // La API aún no está implementada
          toast.info('El API de migraciones aún no está implementada. Se simulará la creación.');
          
          const newMigration = {
            ...currentMigration,
            id: migrations.length + 1,
            status: 'pending',
            progress: 0,
            provider_name: providers.find(p => p.id == currentMigration.provider_id)?.nombre || 'Proveedor',
            provider_type: providers.find(p => p.id == currentMigration.provider_id)?.tipo || 'unknown',
            created_at: new Date().toISOString()
          };
          
          setMigrations([newMigration, ...migrations]);
          resetForm();
          return;
        }
        
        const error = await response.json();
        throw new Error(error.error || 'Error al crear la migración');
      }

      const data = await response.json();
      toast.success('Migración creada correctamente');
      resetForm();
      fetchMigrations();
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.message);
    }
  };

  // Ejecutar una migración
  const executeMigration = async (id) => {
    try {
      setExecutingId(id);
      
      const response = await fetch(`/api/migrations/${id}/execute`, {
        method: 'POST'
      });

      if (!response.ok) {
        if (response.status === 404) {
          // La API aún no está implementada
          toast.info('El API de ejecución aún no está implementada. Se simulará la ejecución.');
          
          // Simular inicio de ejecución
          setMigrations(migrations.map(m => {
            if (m.id === id) {
              return {
                ...m,
                status: 'in_progress',
                progress: 0.1,
                started_at: new Date().toISOString()
              };
            }
            return m;
          }));
          
          // Simular progreso
          let progress = 0.1;
          const interval = setInterval(() => {
            progress += 0.1;
            
            setMigrations(prev => prev.map(m => {
              if (m.id === id) {
                // Actualizar progreso
                const updatedMigration = {
                  ...m,
                  progress: progress,
                  files_processed: m.files_total ? Math.floor(m.files_total * progress) : Math.floor(100 * progress),
                  bytes_processed: m.bytes_total ? Math.floor(m.bytes_total * progress) : Math.floor(100000000 * progress)
                };
                
                // Si llegamos al 100%, marcar como completada
                if (progress >= 1) {
                  clearInterval(interval);
                  return {
                    ...updatedMigration,
                    status: 'completed',
                    progress: 1,
                    files_processed: updatedMigration.files_total || 100,
                    bytes_processed: updatedMigration.bytes_total || 100000000,
                    completed_at: new Date().toISOString()
                  };
                }
                
                return updatedMigration;
              }
              return m;
            }));
            
            if (progress >= 1) {
              clearInterval(interval);
            }
          }, 1000);
          
          setTimeout(() => setExecutingId(null), 1000);
          return;
        }
        
        const error = await response.json();
        throw new Error(error.error || 'Error al ejecutar la migración');
      }

      const data = await response.json();
      toast.success(`Migración ${id} iniciada correctamente`);
      fetchMigrations();
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.message);
    } finally {
      setExecutingId(null);
    }
  };

  // Refrescar estado de una migración
  const refreshMigration = async (id) => {
    try {
      setExecutingId(id);
      
      const response = await fetch(`/api/migrations/${id}`);

      if (!response.ok) {
        if (response.status === 404) {
          // La API aún no está implementada
          toast.info('El API de migraciones aún no está implementada. Se simulará la actualización.');
          setTimeout(() => setExecutingId(null), 1000);
          return;
        }
        
        const error = await response.json();
        throw new Error(error.error || 'Error al refrescar la migración');
      }

      const data = await response.json();
      
      // Actualizar solo la migración específica
      setMigrations(migrations.map(m => m.id === id ? data : m));
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.message);
    } finally {
      setExecutingId(null);
    }
  };

  // Resetear formulario
  const resetForm = () => {
    setCurrentMigration(initialMigrationState);
    setShowForm(false);
  };

  // Manejar cambios en el formulario
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    const val = type === 'checkbox' ? checked : value;
    
    if (name.includes('.')) {
      const [section, field] = name.split('.');
      setCurrentMigration(prev => ({
        ...prev,
        [section]: {
          ...prev[section],
          [field]: val
        }
      }));
    } else {
      setCurrentMigration(prev => ({
        ...prev,
        [name]: val
      }));
    }
  };

  // Sugerir la ruta de destino basada en el proveedor y origen
  const suggestTargetPath = () => {
    if (!currentMigration.provider_id || !currentMigration.source_path) {
      return;
    }
    
    // Obtener el proveedor seleccionado
    const provider = providers.find(p => p.id == currentMigration.provider_id);
    if (!provider) return;
    
    // Extraer el último segmento de la ruta de origen
    const lastSegment = currentMigration.source_path.split('/').filter(Boolean).pop();
    if (!lastSegment) return;
    
    // Construir la ruta de destino según el tipo de proveedor
    let targetPath;
    
    switch (provider.tipo) {
      case 's3':
        const bucket = provider.credenciales?.bucket || 'bucket';
        targetPath = `s3://${bucket}/${lastSegment}`;
        break;
      case 'azure':
        const container = provider.credenciales?.container_name || 'container';
        targetPath = `azure://${container}/${lastSegment}`;
        break;
      case 'gcp':
        const gcpBucket = provider.credenciales?.bucket_name || 'bucket';
        targetPath = `gs://${gcpBucket}/${lastSegment}`;
        break;
      case 'sftp':
        const host = provider.credenciales?.host || 'server';
        targetPath = `sftp://${host}/${lastSegment}`;
        break;
      case 'minio':
        const minioBucket = provider.credenciales?.bucket || 'bucket';
        targetPath = `minio://${minioBucket}/${lastSegment}`;
        break;
      default:
        targetPath = `${provider.tipo}://storage/${lastSegment}`;
    }
    
    setCurrentMigration(prev => ({
      ...prev,
      target_path: targetPath
    }));
  };

  return (
    <AdminLayout>
      <Head>
        <title>Migraciones a la Nube - SAGE</title>
      </Head>
      
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <Title>Migraciones de Archivos a la Nube</Title>
            <Text>Gestiona la migración de archivos desde el almacenamiento local a proveedores en la nube</Text>
          </div>
          <Button 
            icon={PlusCircleIcon} 
            onClick={() => setShowForm(!showForm)}
            color="indigo"
          >
            {showForm ? 'Cancelar' : 'Nueva Migración'}
          </Button>
        </div>
        
        {showForm && (
          <Card className="mb-6">
            <Subtitle className="mb-4">Nueva Tarea de Migración</Subtitle>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Proveedor de Nube*
                </label>
                <select
                  name="provider_id"
                  value={currentMigration.provider_id}
                  onChange={handleInputChange}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  required
                >
                  <option value="">Seleccione un proveedor</option>
                  {providers.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.nombre} ({provider.tipo})
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción
                </label>
                <textarea
                  name="description"
                  value={currentMigration.description}
                  onChange={handleInputChange}
                  rows="2"
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  placeholder="Descripción opcional"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ruta de Origen*
                </label>
                <input
                  type="text"
                  name="source_path"
                  value={currentMigration.source_path}
                  onChange={handleInputChange}
                  onBlur={suggestTargetPath}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  placeholder="Ej: /path/to/executions"
                  required
                />
                <p className="mt-1 text-xs text-gray-500">
                  Ruta local donde se encuentran los archivos a migrar
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ruta de Destino*
                </label>
                <input
                  type="text"
                  name="target_path"
                  value={currentMigration.target_path}
                  onChange={handleInputChange}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  placeholder="Ej: s3://bucket/executions"
                  required
                />
                <p className="mt-1 text-xs text-gray-500">
                  Ruta en el proveedor de nube donde se almacenarán los archivos
                </p>
              </div>
            </div>
            
            <div className="mb-6">
              <Subtitle className="mb-3">Opciones Avanzadas</Subtitle>
              <div className="space-y-3">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    name="options.update_database_references"
                    checked={currentMigration.options.update_database_references}
                    onChange={handleInputChange}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                  />
                  <label className="ml-2 text-sm text-gray-700">
                    Actualizar referencias en la base de datos
                  </label>
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    name="options.delete_after_migration"
                    checked={currentMigration.options.delete_after_migration}
                    onChange={handleInputChange}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                  />
                  <label className="ml-2 text-sm text-gray-700">
                    Eliminar archivos locales después de la migración
                  </label>
                </div>
                
                <div>
                  <label className="block text-sm text-gray-700 mb-1">
                    Tamaño de lote (archivos por lote)
                  </label>
                  <input
                    type="number"
                    name="options.batch_size"
                    value={currentMigration.options.batch_size}
                    onChange={handleInputChange}
                    className="block w-40 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    min="1"
                    max="100"
                  />
                </div>
              </div>
            </div>
            
            <div className="flex justify-end">
              <Button
                onClick={resetForm}
                color="gray"
                className="mr-2"
              >
                Cancelar
              </Button>
              <Button
                onClick={createMigration}
                color="indigo"
              >
                Crear Tarea de Migración
              </Button>
            </div>
          </Card>
        )}
        
        <Card>
          {loading ? (
            <div className="text-center py-4">Cargando...</div>
          ) : migrations.length === 0 ? (
            <div className="text-center py-8">
              <CloudArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No hay tareas de migración</h3>
              <p className="mt-1 text-sm text-gray-500">
                Comienza creando una nueva tarea para migrar archivos a la nube.
              </p>
              <div className="mt-6">
                <Button
                  color="indigo"
                  icon={PlusCircleIcon}
                  onClick={() => setShowForm(true)}
                >
                  Nueva Tarea de Migración
                </Button>
              </div>
            </div>
          ) : (
            <Table>
              <Table.Head>
                <Table.HeadCell>Detalles</Table.HeadCell>
                <Table.HeadCell>Origen y Destino</Table.HeadCell>
                <Table.HeadCell>Estado</Table.HeadCell>
                <Table.HeadCell>Progreso</Table.HeadCell>
                <Table.HeadCell>Acciones</Table.HeadCell>
              </Table.Head>
              <Table.Body>
                {migrations.map((migration) => (
                  <Table.Row key={migration.id}>
                    <Table.Cell>
                      <div className="font-medium">{migration.description || `Migración #${migration.id}`}</div>
                      <div className="text-xs text-gray-500">{migration.provider_name}</div>
                      <div className="text-xs text-gray-500">
                        Creada: {new Date(migration.created_at).toLocaleString()}
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="text-sm">
                        <span className="font-medium">Origen:</span> {migration.source_path}
                      </div>
                      <div className="text-sm">
                        <span className="font-medium">Destino:</span> {migration.target_path}
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge 
                        color={statusColors[migration.status] || 'gray'} 
                        icon={StatusIcons[migration.status]}
                      >
                        {statusNames[migration.status] || migration.status}
                      </Badge>
                      {migration.files_total && (
                        <div className="text-xs mt-1">
                          {migration.files_processed || 0}/{migration.files_total} archivos
                        </div>
                      )}
                      {migration.bytes_total > 0 && (
                        <div className="text-xs">
                          {formatSize(migration.bytes_processed || 0)}/{formatSize(migration.bytes_total)}
                        </div>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      <ProgressBar 
                        value={migration.progress * 100 || 0} 
                        color={statusColors[migration.status] || 'gray'}
                        className="mt-2"
                      />
                      {migration.status === MigrationStatus.IN_PROGRESS && (
                        <div className="text-xs mt-1 text-right">
                          {Math.round(migration.progress * 100)}%
                        </div>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex space-x-2">
                        {migration.status === MigrationStatus.PENDING && (
                          <Button
                            size="xs"
                            variant="light"
                            color="indigo"
                            icon={PlayIcon}
                            loading={executingId === migration.id}
                            onClick={() => executeMigration(migration.id)}
                          >
                            Ejecutar
                          </Button>
                        )}
                        {migration.status === MigrationStatus.IN_PROGRESS && (
                          <Button
                            size="xs"
                            variant="light"
                            color="indigo"
                            icon={ArrowPathIcon}
                            loading={executingId === migration.id}
                            onClick={() => refreshMigration(migration.id)}
                          >
                            Actualizar
                          </Button>
                        )}
                      </div>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          )}
        </Card>
      </div>
    </AdminLayout>
  );
}

export default CloudMigrations;