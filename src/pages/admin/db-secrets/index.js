import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { 
  PlusCircleIcon
} from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';
import { Title, Text, Subtitle, Card, Button, Badge } from '@tremor/react';

// Estado inicial para un nuevo secreto de BD
const initialSecretState = {
  nombre: '',
  descripcion: '',
  tipo: 'postgresql',
  servidor: '',
  puerto: '',
  usuario: '',
  contrasena: '',
  basedatos: '',
  opciones_conexion: {}
};

export default function DatabaseSecrets() {
  const router = useRouter();
  const [secrets, setSecrets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [currentSecret, setCurrentSecret] = useState(initialSecretState);
  const [isEditing, setIsEditing] = useState(false);
  const [testingId, setTestingId] = useState(null);
  const [showDatabaseModal, setShowDatabaseModal] = useState(false);
  const [databases, setDatabases] = useState([]);
  const [loadingDatabases, setLoadingDatabases] = useState(false);
  const [newDatabaseName, setNewDatabaseName] = useState("");
  const [selectedSecretId, setSelectedSecretId] = useState(null);

  // Cargar secretos
  useEffect(() => {
    fetchSecrets();
  }, []);

  // Obtener todos los secretos
  const fetchSecrets = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/db-secrets');
      if (!response.ok) throw new Error('Error al cargar secretos de bases de datos');
      const data = await response.json();
      
      // Para diagnosticar problemas
      console.log('Secretos obtenidos:', data);
      
      setSecrets(data);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar secretos de bases de datos: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Gestionar entrada del formulario
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    // Convertir puerto a número
    if (name === 'puerto') {
      const numericValue = value === '' ? '' : parseInt(value, 10);
      setCurrentSecret(prev => ({ ...prev, [name]: numericValue }));
      return;
    }

    setCurrentSecret(prev => ({ ...prev, [name]: value }));
  };

  // Guardar secreto
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const method = isEditing ? 'PUT' : 'POST';
      const url = isEditing 
        ? `/api/admin/db-secrets/${currentSecret.id}` 
        : '/api/admin/db-secrets';
      
      // Validaciones básicas
      if (!currentSecret.nombre.trim()) {
        toast.error('El nombre es obligatorio');
        return;
      }
      
      if (!currentSecret.tipo) {
        toast.error('El tipo de base de datos es obligatorio');
        return;
      }
      
      if (!currentSecret.servidor.trim()) {
        toast.error('El servidor es obligatorio');
        return;
      }
      
      // Validaciones específicas para bases de datos cliente-servidor
      if (currentSecret.tipo !== 'duckdb') {
        if (!currentSecret.puerto) {
          toast.error('El puerto es obligatorio');
          return;
        }
        
        if (!currentSecret.usuario.trim()) {
          toast.error('El usuario es obligatorio');
          return;
        }
        
        if (!currentSecret.contrasena.trim() && !isEditing) {
          toast.error('La contraseña es obligatoria');
          return;
        }
      }
      
      // Si estamos editando y la contraseña está vacía, no la incluimos para no sobrescribir
      let payload = isEditing && !currentSecret.contrasena.trim()
        ? { ...currentSecret, contrasena: undefined }
        : currentSecret;
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al guardar secreto');
      }
      
      toast.success(isEditing ? 'Secreto actualizado correctamente' : 'Secreto creado correctamente');
      setShowForm(false);
      setCurrentSecret(initialSecretState);
      setIsEditing(false);
      fetchSecrets();
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.message || 'Error al guardar secreto');
    }
  };

  // Editar secreto
  const handleEditSecret = async (secretId) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/db-secrets/${secretId}`);
      if (!response.ok) throw new Error('Error al cargar secreto');
      
      const secretData = await response.json();
      
      // Asegurarse de que las opciones de conexión sean un objeto
      if (typeof secretData.opciones_conexion === 'string') {
        try {
          secretData.opciones_conexion = JSON.parse(secretData.opciones_conexion);
        } catch (e) {
          secretData.opciones_conexion = {};
        }
      } else if (!secretData.opciones_conexion) {
        secretData.opciones_conexion = {};
      }
      
      setCurrentSecret(secretData);
      setIsEditing(true);
      setShowForm(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar secreto: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Eliminar secreto
  const handleDeleteSecret = async (secretId) => {
    if (!confirm('¿Está seguro de eliminar este secreto? Esta acción no se puede deshacer.')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/admin/db-secrets/${secretId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al eliminar secreto');
      }
      
      toast.success('Secreto eliminado correctamente');
      fetchSecrets();
    } catch (error) {
      console.error('Error:', error);
      if (error.message.includes('referenciado')) {
        toast.error('No se puede eliminar el secreto porque está siendo utilizado por conexiones de bases de datos');
      } else {
        toast.error('Error al eliminar secreto: ' + error.message);
      }
    }
  };

  // Probar conexión
  const handleTestConnection = async (secretId) => {
    try {
      setTestingId(secretId);
      
      const response = await fetch(`/api/admin/db-secrets/${secretId}/test`, {
        method: 'POST',
      });
      
      const result = await response.json();
      
      if (response.ok) {
        toast.success('Conexión exitosa a la base de datos');
      } else {
        throw new Error(result.message || 'Error al probar conexión');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al probar conexión: ' + error.message);
    } finally {
      setTestingId(null);
    }
  };

  // Cancelar formulario
  const handleCancelForm = () => {
    setShowForm(false);
    setCurrentSecret(initialSecretState);
    setIsEditing(false);
  };

  // Probar todos los secretos
  const handleTestAllSecrets = async () => {
    try {
      for (const secret of secrets) {
        await handleTestConnection(secret.id);
      }
    } catch (error) {
      console.error('Error al probar todos los secretos:', error);
    }
  };

  // Obtener color del estado de un secreto
  const getStatusColor = (status) => {
    switch (status) {
      case 'activo':
        return 'green';
      case 'inactivo':
        return 'gray';
      case 'error':
        return 'red';
      default:
        return 'blue';
    }
  };

  // Obtener icono de tipo de base de datos
  const getDatabaseIcon = (type) => {
    // Solo usamos un único icono por ahora
    return <PlusCircleIcon className="h-5 w-5 text-indigo-500" />;
  };
  
  // Listar bases de datos disponibles en un secreto
  const handleListDatabases = async (secretId) => {
    try {
      setLoadingDatabases(true);
      setSelectedSecretId(secretId);
      
      const response = await fetch(`/api/admin/db-secrets/${secretId}/databases`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al listar bases de datos');
      }
      
      const data = await response.json();
      setDatabases(data.databases || []);
      setShowDatabaseModal(true);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al listar bases de datos: ' + error.message);
    } finally {
      setLoadingDatabases(false);
    }
  };
  
  // Crear nueva base de datos
  const handleCreateDatabase = async () => {
    if (!newDatabaseName || !newDatabaseName.trim()) {
      toast.error('Debe indicar un nombre para la base de datos');
      return;
    }
    
    // Validar formato del nombre de base de datos
    if (!/^[a-zA-Z0-9_]+$/.test(newDatabaseName)) {
      toast.error('Nombre de base de datos inválido. Use solo letras, números y guiones bajos.');
      return;
    }
    
    try {
      setLoadingDatabases(true);
      
      const response = await fetch(`/api/admin/db-secrets/${selectedSecretId}/databases`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ databaseName: newDatabaseName })
      });
      
      // Siempre intentamos obtener los datos JSON, incluso si hay error
      const responseData = await response.json().catch(e => ({ 
        message: 'Error de formato en respuesta del servidor' 
      }));
      
      if (!response.ok) {
        // Construir un mensaje de error más detallado
        let errorMessage = responseData.message || 'Error al crear base de datos';
        
        // Si hay detalles adicionales del error, mostrarlos
        if (responseData.details && responseData.details.sqlMessage) {
          errorMessage += `: ${responseData.details.sqlMessage}`;
        }
        
        if (responseData.error) {
          console.error('Error detallado:', responseData.error);
        }
        
        throw new Error(errorMessage);
      }
      
      toast.success(responseData.message || `Base de datos ${newDatabaseName} creada correctamente`);
      setNewDatabaseName('');
      
      // Actualizar la lista de bases de datos después de un breve retraso
      // para dar tiempo a la base de datos para actualizarse
      setTimeout(() => {
        handleListDatabases(selectedSecretId);
      }, 1000);
    } catch (error) {
      console.error('Error al crear base de datos:', error);
      toast.error('Error al crear base de datos: ' + error.message);
    } finally {
      setLoadingDatabases(false);
    }
  };

  return (
    <>
      <Head>
        <title>SAGE - Gestión de Secretos de Base de Datos</title>
      </Head>
      
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <Title>Gestión de Secretos de Base de Datos</Title>
            <Text>Administra las credenciales para conexiones a bases de datos</Text>
          </div>
          <div className="flex space-x-3">
            <Button 
              icon={PlusCircleIcon} 
              onClick={() => router.push('/admin/database-connections')}
              color="cyan"
            >
              Volver a Conexiones
            </Button>
            <Button 
              icon={PlusCircleIcon} 
              onClick={handleTestAllSecrets}
              color="amber"
              disabled={loading || secrets.length === 0}
            >
              Test Conectividad
            </Button>
            <Button 
              icon={PlusCircleIcon} 
              onClick={() => setShowForm(!showForm)}
              color="indigo"
            >
              {showForm ? 'Cancelar' : 'Nuevo Secreto'}
            </Button>
          </div>
        </div>
        
        <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900 rounded-md border border-amber-200 dark:border-amber-800">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <PlusCircleIcon className="h-5 w-5 text-amber-500 dark:text-amber-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Gestión de Secretos
              </h3>
              <div className="mt-2 text-sm text-amber-700 dark:text-amber-300">
                <p>
                  Los secretos de base de datos almacenan credenciales de conexión de forma segura y pueden ser 
                  referenciados desde múltiples conexiones.
                </p>
                <p className="mt-1">
                  Después de crear un secreto, regrese a la página de <a href="/admin/database-connections" className="text-blue-600 dark:text-blue-400 underline">Conexiones a Bases de Datos</a> para crear conexiones específicas a bases de datos.
                </p>
              </div>
            </div>
          </div>
        </div>
        
        {showForm && (
          <Card className="mb-6">
            <Subtitle className="mb-4">
              {isEditing ? 'Editar Secreto' : 'Nuevo Secreto de Base de Datos'}
            </Subtitle>
            
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Nombre del Secreto*
                  </label>
                  <input
                    type="text"
                    name="nombre"
                    value={currentSecret.nombre}
                    onChange={handleInputChange}
                    className="w-full p-2 border rounded-md"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Tipo de Base de Datos*
                  </label>
                  <select
                    name="tipo"
                    value={currentSecret.tipo}
                    onChange={handleInputChange}
                    className="w-full p-2 border rounded-md"
                    required
                  >
                    <option value="postgresql">PostgreSQL</option>
                    <option value="mysql">MySQL</option>
                    <option value="mssql">SQL Server</option>
                    <option value="duckdb">DuckDB</option>
                  </select>
                </div>
                
                {currentSecret.tipo !== 'duckdb' ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Servidor (Host / IP)*
                      </label>
                      <input
                        type="text"
                        name="servidor"
                        value={currentSecret.servidor}
                        onChange={handleInputChange}
                        className="w-full p-2 border rounded-md"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Puerto*
                      </label>
                      <input
                        type="number"
                        name="puerto"
                        value={currentSecret.puerto}
                        onChange={handleInputChange}
                        className="w-full p-2 border rounded-md"
                        required
                        min="1"
                        max="65535"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Usuario*
                      </label>
                      <input
                        type="text"
                        name="usuario"
                        value={currentSecret.usuario}
                        onChange={handleInputChange}
                        className="w-full p-2 border rounded-md"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Contraseña{isEditing ? "" : "*"}
                      </label>
                      <input
                        type="password"
                        name="contrasena"
                        value={currentSecret.contrasena}
                        onChange={handleInputChange}
                        className="w-full p-2 border rounded-md"
                        required={!isEditing}
                        placeholder={isEditing ? "Dejar en blanco para mantener la actual" : ""}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Base de Datos (predeterminada)
                      </label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          name="basedatos"
                          value={currentSecret.basedatos}
                          onChange={handleInputChange}
                          className="w-full p-2 border rounded-md"
                        />
                        {isEditing && (
                          <button
                            type="button"
                            onClick={() => handleListDatabases(currentSecret.id)}
                            className="px-2 py-2 bg-blue-100 text-blue-600 rounded hover:bg-blue-200 flex items-center"
                            disabled={testingId !== null}
                          >
                            <PlusCircleIcon className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Ruta al archivo DuckDB*
                      </label>
                      <input
                        type="text"
                        name="servidor"
                        value={currentSecret.servidor}
                        onChange={handleInputChange}
                        className="w-full p-2 border rounded-md"
                        placeholder="/ruta/al/archivo.duckdb o :memory:"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Puede ser una ruta a un archivo .duckdb o ":memory:" para una base de datos en memoria
                      </p>
                    </div>
                    
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Opciones adicionales
                      </label>
                      <input
                        type="text"
                        name="basedatos"
                        value={currentSecret.basedatos}
                        onChange={handleInputChange}
                        className="w-full p-2 border rounded-md"
                        placeholder="Opciones adicionales separadas por ;"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Por ejemplo: "access_mode=READ_ONLY;threads=4"
                      </p>
                    </div>
                    
                    <div className="col-span-2">
                      <p className="text-sm text-gray-600 dark:text-gray-400 p-3 bg-gray-100 dark:bg-gray-800 rounded mb-2">
                        <strong>Nota:</strong> DuckDB es una base de datos embebida y no utiliza un modelo 
                        cliente-servidor tradicional. Los campos de usuario, contraseña y puerto se rellenarán automáticamente 
                        con valores predeterminados por compatibilidad, pero no son utilizados en la conexión.
                      </p>
                    </div>
                    
                    <input 
                      type="hidden" 
                      name="puerto" 
                      value="0" 
                      onChange={() => {}} 
                    />
                    <input 
                      type="hidden" 
                      name="usuario" 
                      value="duckdb_user" 
                      onChange={() => {}} 
                    />
                    <input 
                      type="hidden" 
                      name="contrasena" 
                      value="duckdb_pass" 
                      onChange={() => {}} 
                    />
                  </>
                )}
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Descripción
                </label>
                <textarea
                  name="descripcion"
                  value={currentSecret.descripcion}
                  onChange={handleInputChange}
                  className="w-full p-2 border rounded-md"
                  rows="2"
                ></textarea>
              </div>
              
              <div className="flex justify-end space-x-3">
                <Button type="button" onClick={handleCancelForm} color="gray">
                  Cancelar
                </Button>
                <Button type="submit" color="indigo">
                  {isEditing ? 'Actualizar' : 'Guardar'}
                </Button>
              </div>
            </form>
          </Card>
        )}
        
        {loading ? (
          <div className="flex justify-center items-center py-10">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
          </div>
        ) : secrets.length === 0 ? (
          <Card className="py-8">
            <div className="text-center">
              <PlusCircleIcon className="h-12 w-12 mx-auto text-gray-400" />
              <h3 className="mt-2 text-lg font-medium text-gray-900 dark:text-gray-100">
                No hay secretos de bases de datos configurados
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Comience creando un nuevo secreto para conectarse a bases de datos.
              </p>
              <div className="mt-6">
                <Button onClick={() => setShowForm(true)} color="indigo">
                  Agregar Nuevo Secreto
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {secrets.map((secret) => (
              <Card key={secret.id} className="relative">
                <div className="flex items-start justify-between">
                  <div className="flex items-center">
                    {getDatabaseIcon(secret.tipo)}
                    <div className="ml-2">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                        {secret.nombre}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {secret.tipo} {secret.database_count ? `(${secret.database_count} conexiones)` : ''}
                      </p>
                    </div>
                  </div>
                  <Badge color={getStatusColor(secret.estado || 'pendiente')}>
                    {secret.estado || 'Pendiente'}
                  </Badge>
                </div>
                
                <div className="mt-3">
                  <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                    {secret.descripcion || 'Sin descripción'}
                  </p>
                </div>
                
                <div className="mt-4 grid grid-cols-2 gap-2 text-sm text-gray-500 dark:text-gray-400">
                  {secret.tipo === 'duckdb' ? (
                    <>
                      <div className="col-span-2">
                        <span className="font-medium">Archivo:</span> {secret.servidor}
                      </div>
                      {secret.basedatos && (
                        <div className="col-span-2">
                          <span className="font-medium">Opciones:</span> {secret.basedatos}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="col-span-1">
                        <span className="font-medium">Servidor:</span> {secret.servidor}
                      </div>
                      <div className="col-span-1">
                        <span className="font-medium">Puerto:</span> {secret.puerto}
                      </div>
                      <div className="col-span-2">
                        <span className="font-medium">Usuario:</span> {secret.usuario}
                      </div>
                      {secret.basedatos && (
                        <div className="col-span-2">
                          <span className="font-medium">Base de datos:</span> {secret.basedatos}
                        </div>
                      )}
                    </>
                  )}
                </div>
                
                <div className="mt-4 flex justify-end space-x-2">
                  <Button
                    size="xs"
                    color="amber"
                    onClick={() => handleTestConnection(secret.id)}
                    loading={testingId === secret.id}
                    disabled={testingId === secret.id}
                  >
                    Test
                  </Button>
                  <Button
                    size="xs"
                    onClick={() => handleEditSecret(secret.id)}
                    color="indigo"
                  >
                    Editar
                  </Button>
                  <Button
                    size="xs"
                    onClick={() => handleDeleteSecret(secret.id)}
                    color="red"
                  >
                    Eliminar
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
      
      {/* Modal para listar y crear bases de datos */}
      {showDatabaseModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-full max-w-2xl overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="text-lg font-medium">Bases de Datos Disponibles</h3>
              <button 
                type="button" 
                onClick={() => setShowDatabaseModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <PlusCircleIcon className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-4">
              {loadingDatabases ? (
                <div className="flex justify-center items-center py-10">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
                </div>
              ) : (
                <>
                  <div className="mb-6">
                    <h4 className="text-sm font-medium mb-2">Crear Nueva Base de Datos</h4>
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        placeholder="Nombre de la base de datos"
                        value={newDatabaseName}
                        onChange={(e) => setNewDatabaseName(e.target.value)}
                        className="flex-1 p-2 border rounded-md"
                      />
                      <Button 
                        color="indigo"
                        onClick={handleCreateDatabase}
                        disabled={loadingDatabases || !newDatabaseName.trim()}
                      >
                        Crear
                      </Button>
                    </div>
                  </div>
                  
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-medium mb-2">Bases de Datos Existentes</h4>
                    
                    {databases.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400 py-2">
                        No se encontraron bases de datos para este secreto.
                      </p>
                    ) : (
                      <div className="grid gap-2">
                        {databases.map((db, index) => (
                          <div key={index} className="p-3 rounded-md border hover:bg-gray-50 dark:hover:bg-gray-750">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center">
                                <PlusCircleIcon className="h-4 w-4 text-indigo-500 mr-2" />
                                <div>
                                  <p className="font-medium">{db.name}</p>
                                  <p className="text-xs text-gray-500">{db.description}</p>
                                </div>
                              </div>
                              <div className="flex space-x-2">
                                <Button 
                                  size="xs"
                                  color="indigo"
                                  onClick={() => {
                                    // Establecer la base de datos seleccionada en el input
                                    setCurrentSecret(prev => ({
                                      ...prev,
                                      basedatos: db.name
                                    }));
                                    setShowDatabaseModal(false);
                                  }}
                                >
                                  Seleccionar
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
            
            <div className="p-4 border-t flex justify-end">
              <Button onClick={() => setShowDatabaseModal(false)} color="gray">
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}