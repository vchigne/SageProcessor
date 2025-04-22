import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import Link from 'next/link';
import {
  Card,
  Title,
  Text,
  Badge,
  Button,
  TextInput,
  Textarea,
  Select,
  SelectItem,
  Tab,
  TabList,
  TabGroup,
  TabPanel,
  TabPanels,
  Divider,
  Grid,
  Col,
  Flex
} from '@tremor/react';
import {
  ArrowLeftIcon,
  DocumentTextIcon,
  PencilIcon,
  TrashIcon,
  SaveIcon,
  DatabaseIcon
} from '@heroicons/react/24/outline';
import Breadcrumbs from '@/components/Breadcrumbs';
import { toast } from 'react-toastify';

export default function CasillaDetailsPage() {
  const router = useRouter();
  const { id } = router.query;
  const isNew = id === 'new';
  
  const [casilla, setCasilla] = useState({
    nombre: '',
    descripcion: '',
    tipo: 'email',
    config: {},
    estado: 'Activo',
    yaml_config: ''
  });
  
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!router.isReady) return;
    
    if (isNew) {
      setLoading(false);
      return;
    }
    
    const fetchCasilla = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/admin/casillas/${id}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            toast.error('La casilla solicitada no existe.');
            router.push('/admin/casillas');
            return;
          }
          throw new Error('Error al obtener la casilla');
        }
        
        const data = await response.json();
        setCasilla(data);
      } catch (error) {
        console.error('Error:', error);
        toast.error(error.message || 'Error al cargar los datos de la casilla');
      } finally {
        setLoading(false);
      }
    };
    
    fetchCasilla();
  }, [router.isReady, id, isNew, router]);

  const handleChange = (field, value) => {
    setCasilla(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleConfigChange = (field, value) => {
    setCasilla(prev => ({
      ...prev,
      config: {
        ...prev.config,
        [field]: value
      }
    }));
  };

  const saveCasilla = async () => {
    try {
      // Validaciones básicas
      if (!casilla.nombre) {
        toast.error('El nombre de la casilla es obligatorio');
        return;
      }
      
      setSaving(true);
      
      const url = isNew 
        ? '/api/admin/casillas' 
        : `/api/admin/casillas/${id}`;
      
      const method = isNew ? 'POST' : 'PUT';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(casilla),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al guardar la casilla');
      }
      
      const result = await response.json();
      
      toast.success(`Casilla ${isNew ? 'creada' : 'actualizada'} correctamente`);
      
      if (isNew) {
        router.push(`/admin/casillas/${result.id}`);
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.message || 'Error al guardar la casilla');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-9xl mx-auto">
          <div className="text-center p-12">Cargando...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-9xl mx-auto">
        <Breadcrumbs items={[
          { label: 'Admin', href: '/admin' },
          { label: 'Casillas', href: '/admin/casillas' },
          { label: isNew ? 'Nueva Casilla' : casilla.nombre, current: true }
        ]} />
        
        <div className="sm:flex sm:justify-between sm:items-center mb-8">
          <div>
            <Title>{isNew ? 'Nueva Casilla' : `Editar: ${casilla.nombre}`}</Title>
            <Text>Configure los parámetros de la casilla</Text>
          </div>
          <Flex justifyContent="end" className="mt-4 sm:mt-0 space-x-3">
            <Link
              href="/admin/casillas"
              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              Volver
            </Link>
            {!isNew && (
              <Button
                icon={DocumentTextIcon}
                variant="secondary"
                onClick={() => router.push(`/admin/casillas/${id}/yaml`)}
              >
                Config YAML
              </Button>
            )}
            {!isNew && (
              <Button
                icon={DatabaseIcon}
                variant="secondary"
                onClick={() => router.push(`/admin/casillas/${id}/materialization`)}
              >
                Materialización
              </Button>
            )}
          </Flex>
        </div>
        
        <TabGroup>
          <TabList>
            <Tab>Información General</Tab>
            <Tab>Configuración</Tab>
          </TabList>
          <TabPanels>
            <TabPanel>
              <Card>
                <div className="space-y-6">
                  <TextInput
                    label="Nombre"
                    placeholder="Nombre de la casilla"
                    value={casilla.nombre}
                    onChange={(value) => handleChange('nombre', value)}
                    required
                  />
                  
                  <Textarea
                    label="Descripción"
                    placeholder="Descripción de la casilla"
                    value={casilla.descripcion || ''}
                    onChange={(value) => handleChange('descripcion', value)}
                  />
                  
                  <Select
                    label="Tipo"
                    value={casilla.tipo}
                    onValueChange={(value) => handleChange('tipo', value)}
                  >
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="sftp">SFTP</SelectItem>
                    <SelectItem value="api">API</SelectItem>
                    <SelectItem value="database">Base de Datos</SelectItem>
                  </Select>
                  
                  <Select
                    label="Estado"
                    value={casilla.estado || 'Activo'}
                    onValueChange={(value) => handleChange('estado', value)}
                  >
                    <SelectItem value="Activo">Activo</SelectItem>
                    <SelectItem value="Inactivo">Inactivo</SelectItem>
                    <SelectItem value="Pendiente">Pendiente</SelectItem>
                  </Select>
                </div>
              </Card>
            </TabPanel>
            <TabPanel>
              <Card>
                <div className="space-y-6">
                  {casilla.tipo === 'email' && (
                    <div>
                      <Title className="text-base">Configuración de Email</Title>
                      <Divider className="my-4" />
                      <Grid numCols={1} numColsSm={2} className="gap-6">
                        <Col>
                          <TextInput
                            label="Servidor IMAP"
                            placeholder="imap.example.com"
                            value={casilla.config?.imap_host || ''}
                            onChange={(value) => handleConfigChange('imap_host', value)}
                          />
                        </Col>
                        <Col>
                          <TextInput
                            label="Puerto IMAP"
                            placeholder="993"
                            value={casilla.config?.imap_port || ''}
                            onChange={(value) => handleConfigChange('imap_port', value)}
                          />
                        </Col>
                        <Col>
                          <TextInput
                            label="Usuario"
                            placeholder="usuario@example.com"
                            value={casilla.config?.username || ''}
                            onChange={(value) => handleConfigChange('username', value)}
                          />
                        </Col>
                        <Col>
                          <TextInput
                            label="Contraseña"
                            type="password"
                            placeholder="••••••••"
                            value={casilla.config?.password || ''}
                            onChange={(value) => handleConfigChange('password', value)}
                          />
                        </Col>
                      </Grid>
                    </div>
                  )}
                  
                  {casilla.tipo === 'sftp' && (
                    <div>
                      <Title className="text-base">Configuración de SFTP</Title>
                      <Divider className="my-4" />
                      <Grid numCols={1} numColsSm={2} className="gap-6">
                        <Col>
                          <TextInput
                            label="Servidor SFTP"
                            placeholder="sftp.example.com"
                            value={casilla.config?.sftp_host || ''}
                            onChange={(value) => handleConfigChange('sftp_host', value)}
                          />
                        </Col>
                        <Col>
                          <TextInput
                            label="Puerto SFTP"
                            placeholder="22"
                            value={casilla.config?.sftp_port || ''}
                            onChange={(value) => handleConfigChange('sftp_port', value)}
                          />
                        </Col>
                        <Col>
                          <TextInput
                            label="Usuario"
                            placeholder="usuario"
                            value={casilla.config?.sftp_username || ''}
                            onChange={(value) => handleConfigChange('sftp_username', value)}
                          />
                        </Col>
                        <Col>
                          <TextInput
                            label="Contraseña"
                            type="password"
                            placeholder="••••••••"
                            value={casilla.config?.sftp_password || ''}
                            onChange={(value) => handleConfigChange('sftp_password', value)}
                          />
                        </Col>
                        <Col numColSpan={2}>
                          <TextInput
                            label="Directorio remoto"
                            placeholder="/home/usuario/datos"
                            value={casilla.config?.sftp_path || ''}
                            onChange={(value) => handleConfigChange('sftp_path', value)}
                          />
                        </Col>
                      </Grid>
                    </div>
                  )}
                  
                  {/* Configuraciones adicionales para otros tipos de casillas */}
                  {(casilla.tipo !== 'email' && casilla.tipo !== 'sftp') && (
                    <div className="text-center py-6">
                      <Text>Configuración para casillas de tipo {casilla.tipo} no implementada</Text>
                    </div>
                  )}
                </div>
              </Card>
            </TabPanel>
          </TabPanels>
        </TabGroup>
        
        <div className="mt-6 flex justify-end">
          <Button
            variant="primary"
            disabled={saving}
            onClick={saveCasilla}
            icon={SaveIcon}
            loading={saving}
          >
            {isNew ? 'Crear Casilla' : 'Guardar Cambios'}
          </Button>
        </div>
      </div>
    </Layout>
  );
}