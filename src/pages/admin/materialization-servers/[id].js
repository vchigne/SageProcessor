import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import { 
  Card, 
  Title, 
  Text, 
  Button, 
  Grid,
  Col,
  TextInput,
  Select,
  SelectItem,
  NumberInput,
  Textarea,
  Switch,
  Flex,
  Badge
} from '@tremor/react';
import { 
  ArrowLeftIcon, 
  ServerIcon, 
  GlobeAltIcon, 
  ChartBarIcon, 
  ClockIcon, 
  ArrowPathIcon 
} from '@heroicons/react/24/outline';
import Breadcrumbs from '@/components/Breadcrumbs';
import { toast } from 'react-toastify';
import { format } from 'date-fns';

export default function EditMaterializationServer() {
  const router = useRouter();
  const { id } = router.query;
  const [loading, setLoading] = useState(false);
  const [testingServer, setTestingServer] = useState(false);
  const [server, setServer] = useState(null);
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    tipo: 'local',
    endpoint: '',
    capacidad: 10,
    api_key: '',
    configuracion: '',
    estado: '',
    activo: true
  });

  useEffect(() => {
    if (id) {
      fetchServerData();
    }
  }, [id]);

  const fetchServerData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/materialization-servers/${id}`);
      
      if (!response.ok) {
        throw new Error('Error al cargar datos del servidor');
      }
      
      const data = await response.json();
      setServer(data);
      
      setFormData({
        nombre: data.nombre || '',
        descripcion: data.descripcion || '',
        tipo: data.tipo || 'local',
        endpoint: data.endpoint || '',
        capacidad: data.capacidad || 10,
        api_key: '',  // No cargamos el API key por seguridad
        configuracion: data.configuracion ? 
          (typeof data.configuracion === 'object' ? 
            JSON.stringify(data.configuracion, null, 2) : 
            data.configuracion) : 
          '',
        estado: data.estado || 'pendiente',
        activo: data.estado !== 'inactivo'
      });
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar datos del servidor');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleNumberChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSwitchChange = (name, checked) => {
    setFormData(prev => ({ 
      ...prev, 
      [name]: checked,
      // Si se desactiva el servidor, cambiamos su estado a inactivo
      ...(name === 'activo' && !checked ? { estado: 'inactivo' } : {})
    }));
  };

  const handleSelectChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const testServer = async () => {
    setTestingServer(true);
    
    try {
      const response = await fetch(`/api/admin/materialization-servers/${id}/test`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al probar el servidor');
      }
      
      const result = await response.json();
      
      // Actualizar el estado en el formulario
      setFormData(prev => ({
        ...prev,
        estado: result.estado,
        activo: result.estado !== 'inactivo'
      }));
      
      // También actualizar el objeto server completo
      setServer(prev => ({
        ...prev,
        estado: result.estado,
        ultimo_test: result.ultimo_test
      }));
      
      toast.success(`Prueba completada: ${result.mensaje}`);
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.message || 'Error al probar el servidor');
    } finally {
      setTestingServer(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validación básica
    if (!formData.nombre || !formData.endpoint) {
      toast.error('Por favor complete todos los campos obligatorios');
      return;
    }
    
    try {
      setLoading(true);
      
      // Preparar datos para enviar
      let dataToSend = {
        ...formData,
        estado: formData.activo ? (formData.estado === 'inactivo' ? 'pendiente' : formData.estado) : 'inactivo'
      };
      
      // Procesar el JSON de configuración
      if (formData.configuracion) {
        try {
          dataToSend.configuracion = JSON.parse(formData.configuracion);
        } catch (error) {
          toast.error('La configuración JSON no es válida');
          return;
        }
      } else {
        dataToSend.configuracion = {};
      }
      
      const response = await fetch(`/api/admin/materialization-servers/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataToSend),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al actualizar el servidor');
      }
      
      await response.json();
      toast.success('Servidor de materialización actualizado correctamente');
      
      // Recargar los datos del servidor
      fetchServerData();
      
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.message || 'Error al actualizar el servidor de materialización');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'activo':
        return <Badge color="green">Activo</Badge>;
      case 'error':
        return <Badge color="red">Error</Badge>;
      case 'inactivo':
        return <Badge color="gray">Inactivo</Badge>;
      case 'pendiente':
      default:
        return <Badge color="amber">Pendiente</Badge>;
    }
  };

  if (!server && !loading) {
    return (
      <Layout>
        <div className="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-9xl mx-auto">
          <div className="text-center p-8">
            <Text>Cargando datos del servidor...</Text>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-9xl mx-auto">
        <Breadcrumbs items={[
          { label: 'Admin', href: '/admin' },
          { label: 'Materializaciones', href: '/admin/materializations' },
          { label: 'Servidores', href: '/admin/materialization-servers' },
          { label: server?.nombre || 'Editar Servidor', current: true }
        ]} />
        
        <div className="sm:flex sm:justify-between sm:items-center mb-8">
          <div>
            <Title>{server?.nombre || 'Editar Servidor'}</Title>
            {server?.descripcion && (
              <Text className="mt-1">{server.descripcion}</Text>
            )}
          </div>
          <div className="mt-4 sm:mt-0 flex space-x-2">
            <Button
              variant="light"
              icon={ArrowLeftIcon}
              onClick={() => router.push('/admin/materialization-servers')}
            >
              Volver
            </Button>
            
            <Button
              variant="secondary"
              icon={ArrowPathIcon}
              onClick={testServer}
              loading={testingServer}
              disabled={testingServer || loading}
            >
              Probar Conexión
            </Button>
          </div>
        </div>

        {server && (
          <Grid numCols={1} numColsSm={2} numColsLg={3} className="gap-6 mb-6">
            <Card decoration="top" decorationColor="blue">
              <Flex justifyContent="start" className="space-x-4">
                <ServerIcon className="w-8 h-8 text-blue-500" />
                <div>
                  <Text>Estado</Text>
                  <div className="mt-1">
                    {getStatusBadge(server.estado)}
                  </div>
                </div>
              </Flex>
            </Card>
            
            <Card decoration="top" decorationColor="amber">
              <Flex justifyContent="start" className="space-x-4">
                <ChartBarIcon className="w-8 h-8 text-amber-500" />
                <div>
                  <Text>Capacidad</Text>
                  <Title className="mt-1">{server.capacidad} op/min</Title>
                </div>
              </Flex>
            </Card>
            
            <Card decoration="top" decorationColor="indigo">
              <Flex justifyContent="start" className="space-x-4">
                <ClockIcon className="w-8 h-8 text-indigo-500" />
                <div>
                  <Text>Último Test</Text>
                  <Text className="mt-1">
                    {server.ultimo_test ? 
                      format(new Date(server.ultimo_test), 'dd/MM/yyyy HH:mm:ss') : 
                      'Nunca'}
                  </Text>
                </div>
              </Flex>
            </Card>
          </Grid>
        )}

        <form onSubmit={handleSubmit}>
          <Grid numCols={1} numColsSm={2} numColsLg={3} className="gap-6">
            <Col numColSpan={1} numColSpanLg={2}>
              <Card>
                <h3 className="text-tremor-default font-medium text-tremor-content-strong dark:text-dark-tremor-content-strong">
                  Información General
                </h3>
                <div className="mt-4 space-y-4">
                  <TextInput
                    name="nombre"
                    placeholder="Nombre del servidor"
                    value={formData.nombre}
                    onChange={handleChange}
                    required
                    icon={ServerIcon}
                    error={!formData.nombre ? 'Este campo es obligatorio' : ''}
                    errorMessage="Este campo es obligatorio"
                    className="mt-2"
                  />
                  
                  <Textarea
                    name="descripcion"
                    placeholder="Descripción (opcional)"
                    value={formData.descripcion}
                    onChange={handleChange}
                    rows={3}
                    className="mt-2"
                  />
                  
                  <div className="flex items-center space-x-4">
                    <Switch
                      id="activo"
                      name="activo"
                      checked={formData.activo}
                      onChange={(checked) => handleSwitchChange('activo', checked)}
                    />
                    <label htmlFor="activo" className="text-tremor-default text-tremor-content cursor-pointer">
                      Servidor activo
                    </label>
                  </div>
                </div>
              </Card>
            </Col>
            
            <Col>
              <Card>
                <h3 className="text-tremor-default font-medium text-tremor-content-strong dark:text-dark-tremor-content-strong">
                  Tipo de Servidor
                </h3>
                <div className="mt-4">
                  <Select
                    name="tipo"
                    value={formData.tipo}
                    onValueChange={(value) => handleSelectChange('tipo', value)}
                    required
                  >
                    <SelectItem value="local" icon={ServerIcon}>
                      Local (integrado)
                    </SelectItem>
                    <SelectItem value="remote" icon={GlobeAltIcon}>
                      Remoto (instancia externa)
                    </SelectItem>
                    <SelectItem value="container" icon={ServerIcon}>
                      Contenedor
                    </SelectItem>
                  </Select>
                  <Text className="text-xs text-gray-500 mt-1">
                    {formData.tipo === 'local' ? 
                      'Los servidores locales son más rápidos pero tienen capacidad limitada' : 
                      formData.tipo === 'remote' ? 
                      'Los servidores remotos ofrecen mayor capacidad y escalabilidad' :
                      'Los contenedores ofrecen aislamiento y portabilidad'}
                  </Text>
                </div>
              </Card>
            </Col>
            
            <Col numColSpan={1} numColSpanSm={2} numColSpanLg={3}>
              <Card>
                <h3 className="text-tremor-default font-medium text-tremor-content-strong dark:text-dark-tremor-content-strong">
                  Detalles de Conexión
                </h3>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <TextInput
                      name="endpoint"
                      placeholder="URL del endpoint (e.j. http://localhost:8000/api)"
                      value={formData.endpoint}
                      onChange={handleChange}
                      required
                      icon={GlobeAltIcon}
                      error={!formData.endpoint ? 'Este campo es obligatorio' : ''}
                      className="mt-2"
                    />
                  </div>
                  
                  <NumberInput
                    name="capacidad"
                    placeholder="Capacidad (op/min)"
                    value={formData.capacidad}
                    onValueChange={(value) => handleNumberChange('capacidad', value)}
                    required
                    min={1}
                    max={1000}
                    step={1}
                    className="mt-2"
                  />
                  
                  <div className="sm:col-span-2">
                    <TextInput
                      name="api_key"
                      placeholder="API Key (dejar vacío para mantener actual)"
                      value={formData.api_key}
                      onChange={handleChange}
                      type="password"
                      className="mt-2"
                    />
                    <Text className="text-xs text-gray-500 mt-1">
                      {formData.tipo === 'local' ? 
                        'Opcional para servidores locales' : 
                        'Requerido para autenticación en servidores remotos. Dejar en blanco para mantener la clave actual.'}
                    </Text>
                  </div>
                  
                  <div className="sm:col-span-2 lg:col-span-3">
                    <Textarea
                      name="configuracion"
                      placeholder="Configuración adicional (JSON, opcional)"
                      value={formData.configuracion}
                      onChange={handleChange}
                      rows={5}
                      className="mt-2 font-mono text-sm"
                    />
                    <Text className="text-xs text-gray-500 mt-1">
                      Ejemplo: {`{"timeoutSeconds":30,"maxRetries":3}`}
                    </Text>
                  </div>
                </div>
              </Card>
            </Col>
          </Grid>
          
          <div className="mt-6 flex justify-end space-x-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push('/admin/materialization-servers')}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              loading={loading}
              disabled={loading}
            >
              {loading ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </div>
        </form>
      </div>
    </Layout>
  );
}