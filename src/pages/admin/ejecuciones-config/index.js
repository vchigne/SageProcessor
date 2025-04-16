import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { 
  Card, 
  Title, 
  Text, 
  Button, 
  Select, 
  SelectItem, 
  NumberInput,
  Flex,
  Metric,
  Subtitle,
  Badge
} from '@tremor/react';
import { CloudArrowUpIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';

export default function EjecucionesConfigPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [config, setConfig] = useState({
    nube_primaria_id: null,
    nubes_alternativas: [],
    tiempo_retencion_local: 5,
    prefijo_ruta_nube: '',
    migrar_automaticamente: true
  });

  // Cargar proveedores de nube
  const { data: proveedores, isLoading: cargandoProveedores } = useQuery({
    queryKey: ['cloudProviders'],
    queryFn: async () => {
      const { data } = await axios.get('/api/clouds');
      return data;
    }
  });

  // Cargar configuración actual
  const { data: configActual, isLoading: cargandoConfig } = useQuery({
    queryKey: ['ejecucionesConfig'],
    queryFn: async () => {
      try {
        const { data } = await axios.get('/api/ejecuciones-config');
        return data;
      } catch (error) {
        if (error.response?.status === 404) {
          return null; // No hay configuración todavía
        }
        throw error;
      }
    }
  });

  // Guardar configuración
  const guardarConfigMutation = useMutation({
    mutationFn: async (configData) => {
      return await axios.post('/api/ejecuciones-config', configData);
    },
    onSuccess: () => {
      toast.success('Configuración guardada correctamente');
      queryClient.invalidateQueries(['ejecucionesConfig']);
    },
    onError: (error) => {
      toast.error(`Error al guardar la configuración: ${error.message}`);
    }
  });

  // Actualizar estado local cuando se carga la configuración
  useEffect(() => {
    if (configActual) {
      setConfig(configActual);
    }
  }, [configActual]);

  const handleChange = (field, value) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    guardarConfigMutation.mutate(config);
  };

  // Obtener el nombre del proveedor primario
  const getNombreProveedorPrimario = () => {
    if (!config.nube_primaria_id || !proveedores) return 'No configurado';
    const proveedor = proveedores.find(p => p.id === config.nube_primaria_id);
    return proveedor ? proveedor.nombre : 'No encontrado';
  };

  // Obtener nombres de proveedores alternativos
  const getNombresProveedoresAlternativos = () => {
    if (!config.nubes_alternativas || !config.nubes_alternativas.length || !proveedores) return [];
    return config.nubes_alternativas.map(id => {
      const proveedor = proveedores.find(p => p.id === id);
      return proveedor ? proveedor.nombre : `ID: ${id}`;
    });
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-9xl mx-auto">
      <div className="mb-8 flex justify-between items-center">
        <h1 className="text-2xl md:text-3xl text-slate-800 font-bold">Parámetros de ejecuciones</h1>
      </div>

      <div className="bg-white shadow-lg rounded-lg mb-8">
        <Card>
          <div className="flex items-center mb-6">
            <CloudArrowUpIcon className="h-6 w-6 text-blue-500 mr-2" />
            <Title>Configuración de almacenamiento en la nube</Title>
          </div>

          <Text className="mb-6">
            Configure dónde se almacenarán los archivos de ejecuciones después del período de retención local.
          </Text>

          {(cargandoProveedores || cargandoConfig) ? (
            <div className="text-center py-6">
              <ArrowPathIcon className="h-8 w-8 mx-auto animate-spin text-blue-500" />
              <p className="mt-2">Cargando configuración...</p>
            </div>
          ) : configActual ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <Card decoration="top" decorationColor="blue">
                <Title>Configuración actual</Title>
                <Flex justifyContent="start" alignItems="center" className="mt-4">
                  <div className="space-y-3">
                    <div>
                      <Text>Proveedor primario</Text>
                      <Metric className="text-blue-600">{getNombreProveedorPrimario()}</Metric>
                    </div>
                    
                    <div>
                      <Text>Proveedores alternativos</Text>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {getNombresProveedoresAlternativos().length > 0 ? (
                          getNombresProveedoresAlternativos().map((nombre, i) => (
                            <Badge key={i} color="blue">{nombre}</Badge>
                          ))
                        ) : (
                          <Text>Ninguno configurado</Text>
                        )}
                      </div>
                    </div>
                    
                    <div>
                      <Text>Tiempo de retención local</Text>
                      <Subtitle className="text-gray-700">{config.tiempo_retencion_local} horas</Subtitle>
                    </div>
                    
                    <div>
                      <Text>Prefijo en la nube</Text>
                      <Subtitle className="text-gray-700">{config.prefijo_ruta_nube || 'No configurado'}</Subtitle>
                    </div>
                    
                    <div>
                      <Text>Migración automática</Text>
                      <Badge color={config.migrar_automaticamente ? 'green' : 'red'}>
                        {config.migrar_automaticamente ? 'Habilitada' : 'Deshabilitada'}
                      </Badge>
                    </div>
                  </div>
                </Flex>
              </Card>
            </div>
          ) : null}

          <form onSubmit={handleSubmit}>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Proveedor de nube primario
                </label>
                <Select
                  value={config.nube_primaria_id}
                  onValueChange={(value) => handleChange('nube_primaria_id', value)}
                  placeholder="Seleccione un proveedor primario"
                  className="w-full"
                >
                  {proveedores?.map((proveedor) => (
                    <SelectItem key={proveedor.id} value={proveedor.id}>
                      {proveedor.nombre} ({proveedor.tipo})
                    </SelectItem>
                  ))}
                </Select>
                <p className="mt-1 text-xs text-gray-500">
                  Este será el proveedor principal donde se almacenarán las ejecuciones
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Proveedores de nube alternativos
                </label>
                <Select
                  value={config.nubes_alternativas}
                  onValueChange={(value) => handleChange('nubes_alternativas', 
                    Array.isArray(value) ? value : [value])}
                  placeholder="Seleccione proveedores alternativos (opcional)"
                  enableClear={true}
                  multiple={true}
                  className="w-full"
                >
                  {proveedores?.filter(p => p.id !== config.nube_primaria_id).map((proveedor) => (
                    <SelectItem key={proveedor.id} value={proveedor.id}>
                      {proveedor.nombre} ({proveedor.tipo})
                    </SelectItem>
                  ))}
                </Select>
                <p className="mt-1 text-xs text-gray-500">
                  Respaldos adicionales para las ejecuciones (opcional)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tiempo de retención local (horas)
                </label>
                <NumberInput
                  value={config.tiempo_retencion_local}
                  onValueChange={(value) => handleChange('tiempo_retencion_local', value)}
                  min={1}
                  max={72}
                  className="w-full"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Las ejecuciones serán migradas a la nube después de este tiempo
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Prefijo para las rutas en la nube
                </label>
                <input
                  type="text"
                  value={config.prefijo_ruta_nube || ''}
                  onChange={(e) => handleChange('prefijo_ruta_nube', e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Ejemplo: sage-executions/"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Prefijo opcional para organizar los archivos en el proveedor de nube
                </p>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="migrar_automaticamente"
                  checked={config.migrar_automaticamente}
                  onChange={(e) => handleChange('migrar_automaticamente', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="migrar_automaticamente" className="ml-2 block text-sm text-gray-900">
                  Migrar automáticamente a la nube
                </label>
              </div>

              <div className="flex justify-end mt-6">
                <Button
                  type="submit"
                  loading={guardarConfigMutation.isLoading}
                  size="md"
                  color="blue"
                  className="px-4 py-2"
                >
                  Guardar configuración
                </Button>
              </div>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}