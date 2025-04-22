import { useState } from 'react';
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
  Switch
} from '@tremor/react';
import { ArrowLeftIcon, ServerIcon, GlobeAltIcon } from '@heroicons/react/24/outline';
import Breadcrumbs from '@/components/Breadcrumbs';
import { toast } from 'react-toastify';

export default function NewMaterializationServer() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    tipo: 'local',
    endpoint: 'http://localhost:8000/api/materialize',
    capacidad: 10,
    api_key: '',
    configuracion: '',
    activo: true
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleNumberChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSwitchChange = (name, checked) => {
    setFormData(prev => ({ ...prev, [name]: checked }));
  };

  const handleSelectChange = (name, value) => {
    let endpoint = formData.endpoint;
    
    // Ajustar endpoint según tipo de servidor
    if (name === 'tipo') {
      switch (value) {
        case 'local':
          endpoint = 'http://localhost:8000/api/materialize';
          break;
        case 'remote':
          endpoint = 'https://materialize.example.com/api';
          break;
        case 'container':
          endpoint = 'http://materialize-container:8080/api';
          break;
        default:
          endpoint = formData.endpoint;
      }
    }
    
    setFormData(prev => ({ 
      ...prev, 
      [name]: value,
      ...(name === 'tipo' ? { endpoint } : {})
    }));
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
      const dataToSend = {
        ...formData,
        configuracion: formData.configuracion ? 
          JSON.parse(formData.configuracion) : {}
      };
      
      // Si el formato JSON no es válido, usar como cadena
      if (formData.configuracion && typeof dataToSend.configuracion !== 'object') {
        dataToSend.configuracion = { raw: formData.configuracion };
      }
      
      const response = await fetch('/api/admin/materialization-servers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataToSend),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al crear el servidor');
      }
      
      const result = await response.json();
      toast.success('Servidor de materialización creado correctamente');
      router.push('/admin/materialization-servers');
      
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.message || 'Error al crear el servidor de materialización');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-9xl mx-auto">
        <Breadcrumbs items={[
          { label: 'Admin', href: '/admin' },
          { label: 'Materializaciones', href: '/admin/materializations' },
          { label: 'Servidores', href: '/admin/materialization-servers' },
          { label: 'Nuevo Servidor', current: true }
        ]} />
        
        <div className="sm:flex sm:justify-between sm:items-center mb-8">
          <Title>Crear Servidor de Materialización</Title>
          <div className="mt-4 sm:mt-0">
            <Button
              variant="light"
              icon={ArrowLeftIcon}
              onClick={() => router.push('/admin/materialization-servers')}
            >
              Volver
            </Button>
          </div>
        </div>

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
                    Los servidores locales son más rápidos pero tienen capacidad limitada
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
                      placeholder="API Key (opcional para servidores locales)"
                      value={formData.api_key}
                      onChange={handleChange}
                      type={formData.tipo === 'local' ? 'text' : 'password'}
                      className="mt-2"
                    />
                  </div>
                  
                  <div className="sm:col-span-2 lg:col-span-3">
                    <Textarea
                      name="configuracion"
                      placeholder="Configuración adicional (JSON, opcional)"
                      value={formData.configuracion}
                      onChange={handleChange}
                      rows={3}
                      className="mt-2"
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
              {loading ? 'Guardando...' : 'Guardar Servidor'}
            </Button>
          </div>
        </form>
      </div>
    </Layout>
  );
}