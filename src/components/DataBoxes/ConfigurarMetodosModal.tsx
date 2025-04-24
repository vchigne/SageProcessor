import { useState, useEffect, Fragment } from 'react';
import { Dialog, Combobox, Transition } from '@headlessui/react';
import { Button, Text, TextInput } from '@tremor/react';
import { 
  EnvelopeIcon, 
  ServerIcon, 
  FolderIcon, 
  CloudIcon,
  ChevronUpDownIcon,
  CheckIcon,
  MagnifyingGlassIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

interface ConfigurarMetodosModalProps {
  isOpen: boolean;
  onClose: () => void;
  casilla: any;
  emisorId?: number | null;
}

interface MetodoEnvio {
  id: string;
  nombre: string;
  icono: React.ReactNode;
  descripcion: string;
}

interface Emisor {
  id: number;
  nombre: string;
  tipo_origen: string;
  email_corporativo?: string;
  telefono?: string;
  sftp_servidor?: string;
  sftp_puerto?: number;
  sftp_usuario?: string;
  sftp_directorio?: string;
  cloud_secret_id?: number;
  bucket_nombre?: string;
}

const METODOS_ENVIO: MetodoEnvio[] = [
  {
    id: 'email',
    nombre: 'Email',
    icono: <EnvelopeIcon className="h-6 w-6 text-blue-500" />,
    descripcion: 'Envío por correo electrónico'
  },
  {
    id: 'sftp',
    nombre: 'SFTP',
    icono: <ServerIcon className="h-6 w-6 text-green-500" />,
    descripcion: 'Transferencia segura de archivos'
  },
  {
    id: 'local',
    nombre: 'Sistema de archivos local',
    icono: <FolderIcon className="h-6 w-6 text-yellow-500" />,
    descripcion: 'Almacenamiento en sistema de archivos local'
  },
  {
    id: 'api',
    nombre: 'API',
    icono: <CloudIcon className="h-6 w-6 text-purple-500" />,
    descripcion: 'Envío a través de API REST'
  }
];



export const ConfigurarMetodosModal: React.FC<ConfigurarMetodosModalProps> = ({
  isOpen,
  onClose,
  casilla,
  emisorId
}) => {
  const [emisores, setEmisores] = useState<Emisor[]>([]);
  const [emisoresFiltrados, setEmisoresFiltrados] = useState<Emisor[]>([]);
  const [query, setQuery] = useState('');
  const [selectedEmisor, setSelectedEmisor] = useState<string>('');
  const [selectedMetodos, setSelectedMetodos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [parametros, setParametros] = useState<Record<string, any>>({});
  const [responsableNombre, setResponsableNombre] = useState<string>('');
  const [responsableEmail, setResponsableEmail] = useState<string>('');
  const [responsableTelefono, setResponsableTelefono] = useState<string>('');
  const [frecuenciaTipo, setFrecuenciaTipo] = useState<string>('');
  const [horaEnvio, setHoraEnvio] = useState<string>('09:00');
  const [diasSemana, setDiasSemana] = useState<string[]>([]);
  const [diasMes, setDiasMes] = useState<string[]>([]);
  const [diaLimite, setDiaLimite] = useState<string>('5');
  const [emisorSftpSubdirectorio, setEmisorSftpSubdirectorio] = useState<string>('');
  const [emisorBucketPrefijo, setEmisorBucketPrefijo] = useState<string>('');
  const [emisorTipoOrigen, setEmisorTipoOrigen] = useState<string>('');
  const [emisorInfo, setEmisorInfo] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      fetchEmisores();
      if (emisorId) {
        fetchMetodosExistentes();
      } else {
        // Limpiar selecciones si es un nuevo emisor
        setSelectedMetodos([]);
        setParametros({});
        setResponsableNombre('');
        setResponsableEmail('');
        setResponsableTelefono('');
        setFrecuenciaTipo('');
        setHoraEnvio('09:00');
        setDiasSemana([]);
        setDiasMes([]);
        setEmisorSftpSubdirectorio('');
        setEmisorBucketPrefijo('');
      }
    }
  }, [isOpen, emisorId]);

  const fetchEmisores = async () => {
    try {
      const response = await fetch('/api/emisores');
      if (response.ok) {
        const data = await response.json();
        setEmisores(data);
        setEmisoresFiltrados(data);

        // Si estamos editando, seleccionar el emisor actual
        if (emisorId) {
          setSelectedEmisor(emisorId.toString());
        }
      }
    } catch (error) {
      console.error('Error fetching emisores:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Filtrar emisores cuando el query cambia
  useEffect(() => {
    if (query === '') {
      setEmisoresFiltrados(emisores);
    } else {
      const filtrados = emisores.filter((emisor) =>
        emisor.nombre.toLowerCase().includes(query.toLowerCase())
      );
      setEmisoresFiltrados(filtrados);
    }
  }, [query, emisores]);
  
  // Efecto para actualizar información del emisor seleccionado
  useEffect(() => {
    if (selectedEmisor && emisores.length > 0) {
      // Buscar el emisor seleccionado y actualizar su información
      const emisorSeleccionado = emisores.find(e => e.id.toString() === selectedEmisor);
      if (emisorSeleccionado) {
        setEmisorInfo(emisorSeleccionado);
        setEmisorTipoOrigen(emisorSeleccionado.tipo_origen || '');
        console.log('Emisor seleccionado:', emisorSeleccionado);
      }
    }
  }, [selectedEmisor, emisores]);

  const fetchMetodosExistentes = async () => {
    try {
      const response = await fetch(`/api/metodos-envio?casilla_id=${casilla.id}&emisor_id=${emisorId}`);
      if (response.ok) {
        const data = await response.json();
        
        // Si hay datos, cargar los datos del responsable y frecuencia del primer método
        if (data.length > 0) {
          // Cargar datos del responsable
          if (data[0].responsable_nombre) {
            setResponsableNombre(data[0].responsable_nombre || '');
            setResponsableEmail(data[0].responsable_email || '');
            setResponsableTelefono(data[0].responsable_telefono || '');
          } else if (data[0].responsable) {
            // Compatibilidad con versión anterior
            setResponsableNombre(data[0].responsable || '');
          }
          
          // Cargar datos de subdirectorio SFTP y prefijo bucket
          setEmisorSftpSubdirectorio(data[0].emisor_sftp_subdirectorio || '');
          setEmisorBucketPrefijo(data[0].emisor_bucket_prefijo || '');
          
          // Cargar información del emisor
          if (data[0].tipo_origen) {
            setEmisorTipoOrigen(data[0].tipo_origen || '');
            console.log('Tipo de origen cargado:', data[0].tipo_origen);
          }
          
          // Cargar configuración de frecuencia
          if (data[0].configuracion_frecuencia) {
            const configFrec = data[0].configuracion_frecuencia;
            setFrecuenciaTipo(configFrec.tipo || '');
            setHoraEnvio(configFrec.hora || '09:00');
            
            if (configFrec.dias_semana) {
              setDiasSemana(configFrec.dias_semana || []);
            }
            
            if (configFrec.dias_mes) {
              setDiasMes(configFrec.dias_mes || []);
            }
            
            if (configFrec.dia_limite) {
              setDiaLimite(configFrec.dia_limite);
            }
          } else if (data[0].frecuencia) {
            // Compatibilidad con versión anterior
            setFrecuenciaTipo(data[0].frecuencia || '');
          }
        }
        
        const metodos = data.map((m: any) => ({
          metodo: m.metodo_envio,
          parametros: m.parametros
        }));
        setSelectedMetodos(metodos.map((m: any) => m.metodo));
        const params = metodos.reduce((acc: any, m: any) => ({
          ...acc,
          [m.metodo]: m.parametros
        }), {});
        setParametros(params);
      }
    } catch (error) {
      console.error('Error fetching métodos existentes:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Verificar si hay al menos un método seleccionado
    if (selectedMetodos.length === 0 && !(emisorSftpSubdirectorio || emisorBucketPrefijo)) {
      alert('Debe seleccionar al menos un método de envío o configurar un subdirectorio/prefijo');
      return;
    }
    
    try {
      // Preparar métodos con parámetros (puede ser array vacío)
      const metodosConParametros = selectedMetodos.length > 0 
        ? selectedMetodos.map(metodo => ({
            metodo,
            parametros: parametros[metodo] || {}
          }))
        : [];
      
      // Preparar datos de configuración de frecuencia
      const configuracionFrecuencia = frecuenciaTipo ? {
        tipo: frecuenciaTipo,
        hora: horaEnvio,
        dias_semana: frecuenciaTipo === 'semanal' ? diasSemana : undefined,
        dias_mes: frecuenciaTipo === 'mensual' ? diasMes : undefined,
        dia_limite: frecuenciaTipo === 'hasta_dia_n' ? diaLimite : undefined
      } : null;

      console.log('Enviando datos al servidor:', {
        casilla_id: casilla.id,
        emisor_id: selectedEmisor,
        metodos: metodosConParametros,
        emisor_sftp_subdirectorio: emisorSftpSubdirectorio,
        emisor_bucket_prefijo: emisorBucketPrefijo
      });

      const response = await fetch('/api/metodos-envio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          casilla_id: casilla.id,
          emisor_id: selectedEmisor,
          metodos: metodosConParametros,
          responsable_nombre: responsableNombre,
          responsable_email: responsableEmail,
          responsable_telefono: responsableTelefono,
          configuracion_frecuencia: configuracionFrecuencia,
          emisor_sftp_subdirectorio: emisorSftpSubdirectorio,
          emisor_bucket_prefijo: emisorBucketPrefijo
        }),
      });

      if (!response.ok) {
        throw new Error('Error al guardar los métodos de envío');
      }

      const result = await response.json();
      console.log('Respuesta del servidor:', result);

      onClose();
    } catch (error) {
      console.error('Error:', error);
      alert('Error al guardar la configuración');
    }
  };

  const renderParametrosMetodo = (metodoId: string) => {
    switch (metodoId) {
      case 'sftp':
        return (
          <div className="space-y-4">
            <TextInput
              placeholder="Servidor SFTP"
              value={parametros[metodoId]?.servidor || ''}
              onChange={(e) => setParametros({
                ...parametros,
                [metodoId]: { ...parametros[metodoId], servidor: e.target.value }
              })}
            />
            <TextInput
              placeholder="Usuario"
              value={parametros[metodoId]?.usuario || ''}
              onChange={(e) => setParametros({
                ...parametros,
                [metodoId]: { ...parametros[metodoId], usuario: e.target.value }
              })}
            />
            <TextInput
              type="password"
              placeholder="Clave"
              value={parametros[metodoId]?.clave || ''}
              onChange={(e) => setParametros({
                ...parametros,
                [metodoId]: { ...parametros[metodoId], clave: e.target.value }
              })}
            />
          </div>
        );

      case 'email':
        return (
          <div className="space-y-4">
            <div className="text-sm text-gray-500 mb-2">
              Email de la casilla: {casilla.email_casilla}
            </div>
            <TextInput
              placeholder="Email autorizado (separar múltiples con comas)"
              value={parametros[metodoId]?.emails_autorizados || ''}
              onChange={(e) => setParametros({
                ...parametros,
                [metodoId]: { emails_autorizados: e.target.value }
              })}
            />
          </div>
        );

      case 'local':
        return (
          <div className="text-sm text-gray-500">
            Directorio: inputs_{casilla.id}_{selectedEmisor}
          </div>
        );

      case 'api':
        return (
          <div className="space-y-2">
            <div className="text-sm">
              <span className="font-medium">API Endpoint: </span>
              {casilla.api_endpoint}
            </div>
            <div className="text-sm">
              <span className="font-medium">API Key: </span>
              {casilla.api_key}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      className="relative z-50"
    >
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="w-full max-w-xl bg-white rounded-lg shadow-xl max-h-[90vh] flex flex-col">
          <div className="p-6 border-b">
            <Dialog.Title className="text-lg font-medium">
              {emisorId ? 'Editar' : 'Configurar'} Métodos de Envío
            </Dialog.Title>
            <div className="text-sm text-gray-500">
              {casilla.nombre_yaml} - {casilla.organizacion}
            </div>
          </div>

          <div className="p-6 overflow-y-auto flex-1">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Emisor
                </label>
                {emisorId ? (
                  // Si estamos editando, mostrar el nombre del emisor seleccionado
                  <div className="py-2 px-3 border border-gray-300 rounded-md bg-gray-50">
                    {emisores.find(e => e.id.toString() === selectedEmisor)?.nombre || 'Cargando...'}
                  </div>
                ) : (
                  // Si estamos creando, mostrar el combobox con búsqueda
                  <div className="relative">
                    <Combobox value={selectedEmisor} onChange={setSelectedEmisor}>
                      <div className="relative">
                        <div className="relative w-full">
                          <Combobox.Input
                            className="w-full rounded-md border border-gray-300 py-2 pl-3 pr-10 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            onChange={(event) => setQuery(event.target.value)}
                            displayValue={(id: string) => 
                              emisores.find((emisor) => emisor.id.toString() === id)?.nombre || ''
                            }
                            placeholder="Buscar emisor..."
                          />
                          <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-2">
                            <ChevronUpDownIcon
                              className="h-5 w-5 text-gray-400"
                              aria-hidden="true"
                            />
                          </Combobox.Button>
                        </div>
                        
                        <Transition
                          as={Fragment}
                          leave="transition ease-in duration-100"
                          leaveFrom="opacity-100"
                          leaveTo="opacity-0"
                          afterLeave={() => setQuery('')}
                        >
                          <Combobox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black/5 focus:outline-none sm:text-sm">
                            {emisoresFiltrados.length === 0 && query !== '' ? (
                              <div className="relative cursor-default select-none px-4 py-2 text-gray-700">
                                No se encontraron resultados.
                              </div>
                            ) : (
                              emisoresFiltrados.map((emisor) => (
                                <Combobox.Option
                                  key={emisor.id}
                                  className={({ active }) =>
                                    `relative cursor-default select-none py-2 pl-10 pr-4 ${
                                      active ? 'bg-blue-600 text-white' : 'text-gray-900'
                                    }`
                                  }
                                  value={emisor.id.toString()}
                                >
                                  {({ selected, active }) => (
                                    <>
                                      <span
                                        className={`block truncate ${
                                          selected ? 'font-medium' : 'font-normal'
                                        }`}
                                      >
                                        {emisor.nombre}
                                      </span>
                                      {selected ? (
                                        <span
                                          className={`absolute inset-y-0 left-0 flex items-center pl-3 ${
                                            active ? 'text-white' : 'text-blue-600'
                                          }`}
                                        >
                                          <CheckIcon className="h-5 w-5" aria-hidden="true" />
                                        </span>
                                      ) : null}
                                    </>
                                  )}
                                </Combobox.Option>
                              ))
                            )}
                          </Combobox.Options>
                        </Transition>
                      </div>
                    </Combobox>
                  </div>
                )}
              </div>

              {/* Campos del responsable */}
              <div className="space-y-4 border p-4 rounded-md bg-gray-50">
                <h3 className="font-medium text-gray-900">Información del Responsable (opcional)</h3>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre del Responsable
                  </label>
                  <TextInput
                    placeholder="Nombre completo"
                    value={responsableNombre}
                    onChange={(e) => setResponsableNombre(e.target.value)}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Persona encargada de verificar el envío de datos por parte del emisor
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email del Responsable
                  </label>
                  <TextInput
                    type="email"
                    placeholder="correo@ejemplo.com"
                    value={responsableEmail}
                    onChange={(e) => setResponsableEmail(e.target.value)}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Teléfono del Responsable
                  </label>
                  <TextInput
                    placeholder="+123456789"
                    value={responsableTelefono}
                    onChange={(e) => setResponsableTelefono(e.target.value)}
                  />
                </div>
              </div>
              
              {/* Configuración de Directorios / Prefijos */}
              <div className="space-y-4 border p-4 rounded-md bg-gray-50">
                <h3 className="font-medium text-gray-900">Configuración de Directorios y Prefijos (opcional)</h3>
                
                {(emisorTipoOrigen && emisorTipoOrigen.includes('sftp')) ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Subdirectorio SFTP específico
                    </label>
                    <TextInput
                      placeholder="Subdirectorio en el servidor SFTP del emisor (ej: /clientes/sage)"
                      value={emisorSftpSubdirectorio}
                      onChange={(e) => setEmisorSftpSubdirectorio(e.target.value)}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Si se deja en blanco, se utilizará el directorio principal configurado en el emisor
                    </p>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 italic">
                    Este emisor no tiene configurado SFTP como origen de datos
                  </div>
                )}
                
                {(emisorTipoOrigen && emisorTipoOrigen.includes('bucket')) ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Prefijo para bucket
                    </label>
                    <TextInput
                      placeholder="Prefijo para el bucket del emisor (ej: casilla45/)"
                      value={emisorBucketPrefijo}
                      onChange={(e) => setEmisorBucketPrefijo(e.target.value)}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Si se deja en blanco, los archivos se colocarán en la raíz del bucket
                    </p>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 italic">
                    Este emisor no tiene configurado Bucket como origen de datos
                  </div>
                )}
              </div>
              
              {/* Campos de frecuencia */}
              <div className="space-y-4 border p-4 rounded-md bg-gray-50">
                <h3 className="font-medium text-gray-900">Configuración de Frecuencia (opcional)</h3>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo de Frecuencia
                  </label>
                  <select
                    className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    value={frecuenciaTipo}
                    onChange={(e) => setFrecuenciaTipo(e.target.value)}
                  >
                    <option value="">Seleccionar frecuencia</option>
                    <option value="diario">Diario</option>
                    <option value="semanal">Semanal</option>
                    <option value="quincenal">Quincenal</option>
                    <option value="mensual">Mensual</option>
                    <option value="fin_de_mes">Fin de mes</option>
                    <option value="hasta_dia_n">Hasta el día N del mes</option>
                    <option value="bajo_demanda">Bajo demanda</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Periodicidad con la que el emisor debe entregar información a la casilla
                  </p>
                </div>
                
                {/* Campo de hora de envío (siempre visible) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Hora de envío
                  </label>
                  <input
                    type="time"
                    className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    value={horaEnvio}
                    onChange={(e) => setHoraEnvio(e.target.value)}
                  />
                </div>
                
                {/* Días de la semana (visible si frecuencia es semanal) */}
                {frecuenciaTipo === 'semanal' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Días de la semana
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map((dia, index) => (
                        <label key={dia} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={diasSemana.includes(dia.toLowerCase())}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setDiasSemana([...diasSemana, dia.toLowerCase()]);
                              } else {
                                setDiasSemana(diasSemana.filter(d => d !== dia.toLowerCase()));
                              }
                            }}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm">{dia}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Días del mes (visible si frecuencia es mensual) */}
                {frecuenciaTipo === 'mensual' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Días del mes
                    </label>
                    <div className="grid grid-cols-5 gap-2">
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((dia) => (
                        <label key={dia} className="flex items-center space-x-1">
                          <input
                            type="checkbox"
                            checked={diasMes.includes(dia.toString())}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setDiasMes([...diasMes, dia.toString()]);
                              } else {
                                setDiasMes(diasMes.filter(d => d !== dia.toString()));
                              }
                            }}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm">{dia}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Selección de día límite para "hasta_dia_n" */}
                {frecuenciaTipo === 'hasta_dia_n' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Hasta el día del mes
                    </label>
                    <select
                      className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      value={diaLimite}
                      onChange={(e) => setDiaLimite(e.target.value)}
                    >
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((dia) => (
                        <option key={dia} value={dia.toString()}>
                          Día {dia}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      Todos los archivos deben ser entregados hasta este día del mes
                    </p>
                  </div>
                )}
                
                {/* Mensaje informativo para frecuencia "fin_de_mes" */}
                {frecuenciaTipo === 'fin_de_mes' && (
                  <div className="border p-3 rounded bg-blue-50 text-sm">
                    <p className="font-medium">Configuración "Fin de mes"</p>
                    <p className="text-xs text-gray-600 mt-1">
                      Los archivos deben entregarse el último día de cada mes. El sistema considerará automáticamente
                      el último día de cada mes según el calendario.
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Métodos de envío permitidos
                </label>
                <div className="space-y-4">
                  {METODOS_ENVIO.map((metodo) => (
                    <div key={metodo.id}>
                      <label className="flex items-start space-x-3">
                        <input
                          type="checkbox"
                          checked={selectedMetodos.includes(metodo.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedMetodos([...selectedMetodos, metodo.id]);
                            } else {
                              setSelectedMetodos(selectedMetodos.filter(id => id !== metodo.id));
                            }
                          }}
                          className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div>
                          <div className="flex items-center space-x-2">
                            {metodo.icono}
                            <span className="font-medium">{metodo.nombre}</span>
                          </div>
                          <p className="text-sm text-gray-500">{metodo.descripcion}</p>
                        </div>
                      </label>
                      {selectedMetodos.includes(metodo.id) && (
                        <div className="mt-4 ml-8">
                          {renderParametrosMetodo(metodo.id)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </form>
          </div>

          <div className="flex justify-end gap-2 p-6 border-t mt-auto">
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
            >
              {emisorId ? 'Guardar Cambios' : 'Guardar Configuración'}
            </Button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};