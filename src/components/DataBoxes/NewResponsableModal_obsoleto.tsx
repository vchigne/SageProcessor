import React, { useState, useEffect, Fragment } from 'react';
import { Dialog, Combobox, Transition } from '@headlessui/react';
import { Button, TextInput, Select, SelectItem } from '@tremor/react';
import { ChevronUpDownIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/solid';
import { ConfiguracionFrecuencia, ConfiguracionFrecuenciaBase, ConfiguracionFrecuenciaSemanal, ConfiguracionFrecuenciaMensual, FrecuenciaTipo } from '../../types/frecuencia';

interface NewResponsableModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  responsableData?: {
    id?: number;
    responsable_nombre?: string;
    responsable_email?: string;
    responsable_telefono?: string;
    emisor_id?: number;
    casilla_id?: number;
    configuracion_frecuencia?: ConfiguracionFrecuencia;
    activo?: boolean;
  };
}

export const NewResponsableModal: React.FC<NewResponsableModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  responsableData
}) => {
  const isEditing = !!responsableData?.id;

  // Definimos un tipo para nuestro formulario que incluye todos los campos necesarios
  // Definimos un tipo personalizado para el formulario que incluye propiedades extendidas
  interface FormConfiguracionFrecuencia extends ConfiguracionFrecuenciaBase {
    dias_semana?: number[];
    dias_mes?: number[];
  }
  
  interface FormDataType {
    id?: number;
    responsable_nombre: string;
    responsable_email: string;
    responsable_telefono: string;
    emisor_id: string;
    casilla_id: string;
    frecuencia: string;
    configuracion_frecuencia: FormConfiguracionFrecuencia;
    activo: boolean;
  }
  
  const [formData, setFormData] = useState<FormDataType>({
    id: undefined,
    responsable_nombre: '',
    responsable_email: '',
    responsable_telefono: '',
    emisor_id: '',
    casilla_id: '',
    frecuencia: 'Diaria',
    configuracion_frecuencia: {
      tipo: 'Diaria',
      hora: '09:00',
      dias_semana: [],
      dias_mes: []
    },
    activo: true,
  });

  const [emisores, setEmisores] = useState([]);
  const [casillas, setCasillas] = useState([]);
  const [emisoresFiltrados, setEmisoresFiltrados] = useState([]);
  const [casillasFiltradas, setCasillasFiltradas] = useState([]);
  const [queryEmisor, setQueryEmisor] = useState('');
  const [queryCasilla, setQueryCasilla] = useState('');
  
  // Opciones de frecuencia
  const frecuenciaOpciones = [
    { id: 'Diaria', nombre: 'Diaria' },
    { id: 'Semanal', nombre: 'Semanal' },
    { id: 'Mensual', nombre: 'Mensual' }
  ];
  
  // Efecto para filtrar emisores cuando cambia la consulta
  useEffect(() => {
    if (!queryEmisor.trim()) {
      setEmisoresFiltrados(emisores);
    } else {
      const filtered = emisores.filter((emisor: any) => 
        emisor.nombre.toLowerCase().includes(queryEmisor.toLowerCase())
      );
      setEmisoresFiltrados(filtered);
    }
  }, [emisores, queryEmisor]);
  
  // Efecto para filtrar casillas cuando cambia la consulta
  useEffect(() => {
    if (!queryCasilla.trim()) {
      setCasillasFiltradas(casillas);
    } else {
      const searchTerm = queryCasilla.toLowerCase();
      const filtered = casillas.filter((casilla: any) => {
        const organizacion = (casilla.organizacion || '').toLowerCase();
        const producto = (casilla.producto || '').toLowerCase();
        const nombreYaml = (casilla.nombre_yaml || '').toLowerCase();
        
        return organizacion.includes(searchTerm) || 
               producto.includes(searchTerm) || 
               nombreYaml.includes(searchTerm);
      });
      setCasillasFiltradas(filtered);
    }
  }, [casillas, queryCasilla]);
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);

  const diasSemana = [
    { id: 1, nombre: 'Lunes' },
    { id: 2, nombre: 'Martes' },
    { id: 3, nombre: 'Miércoles' },
    { id: 4, nombre: 'Jueves' },
    { id: 5, nombre: 'Viernes' },
    { id: 6, nombre: 'Sábado' },
    { id: 7, nombre: 'Domingo' }
  ];

  const diasMes = Array.from({ length: 31 }, (_, i) => ({ 
    id: i + 1, 
    nombre: `Día ${i + 1}` 
  }));

  useEffect(() => {
    if (isOpen) {
      fetchEmisoresYCasillas();
      
      // Inicializar el formulario con datos existentes si estamos editando
      if (responsableData?.id) {
        setFormData({
          id: responsableData.id,
          responsable_nombre: responsableData.responsable_nombre || '',
          responsable_email: responsableData.responsable_email || '',
          responsable_telefono: responsableData.responsable_telefono || '',
          emisor_id: responsableData.emisor_id?.toString() || '',
          casilla_id: responsableData.casilla_id?.toString() || '',
          frecuencia: responsableData.configuracion_frecuencia?.tipo || 'Diaria',
          configuracion_frecuencia: {
            tipo: responsableData.configuracion_frecuencia?.tipo || 'Diaria',
            hora: responsableData.configuracion_frecuencia?.hora || '09:00',
            ...(responsableData.configuracion_frecuencia?.tipo === 'Semanal' ? {
              dias_semana: (responsableData.configuracion_frecuencia as ConfiguracionFrecuenciaSemanal)?.dias_semana || []
            } : {}),
            ...(responsableData.configuracion_frecuencia?.tipo === 'Mensual' ? {
              dias_mes: (responsableData.configuracion_frecuencia as ConfiguracionFrecuenciaMensual)?.dias_mes || []
            } : {})
          },
          activo: responsableData.activo !== undefined ? responsableData.activo : true,
        });
      } else {
        // Resetear el formulario si estamos creando uno nuevo
        setFormData({
          id: undefined,
          responsable_nombre: '',
          responsable_email: '',
          responsable_telefono: '',
          emisor_id: '',
          casilla_id: '',
          frecuencia: 'Diaria',
          configuracion_frecuencia: {
            tipo: 'Diaria',
            hora: '09:00',
            dias_semana: [],
            dias_mes: []
          },
          activo: true,
        });
      }
    }
  }, [isOpen, responsableData]);

  const fetchEmisoresYCasillas = async () => {
    try {
      setLoading(true);
      const [emisoresRes, casillasRes] = await Promise.all([
        fetch('/api/emisores'),
        fetch('/api/casillas-recepcion')
      ]);

      if (emisoresRes.ok) {
        const emisoresData = await emisoresRes.json();
        console.log('Emisores cargados:', emisoresData);
        setEmisores(emisoresData);
        setEmisoresFiltrados(emisoresData);
      } else {
        console.error('Error al cargar emisores:', emisoresRes.status, emisoresRes.statusText);
      }

      if (casillasRes.ok) {
        const casillasData = await casillasRes.json();
        console.log('Casillas cargadas:', casillasData);
        setCasillas(casillasData);
        setCasillasFiltradas(casillasData);
      } else {
        console.error('Error al cargar casillas:', casillasRes.status, casillasRes.statusText);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Función para mapear el tipo de frecuencia a su ID correspondiente
  const getFrecuenciaTipoId = (tipoFrecuencia: string): number => {
    switch (tipoFrecuencia.toLowerCase()) {
      case 'diaria':
        return 1;
      case 'semanal':
        return 2;
      case 'mensual':
        return 3;
      default:
        return 1; // Valor por defecto: Diaria
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (enviando) return;

    try {
      setEnviando(true);

      if (!formData.emisor_id || !formData.casilla_id) {
        alert('Por favor seleccione un emisor y una casilla');
        return;
      }

      // Preparar la configuración de frecuencia según el tipo
      let configuracionFrecuencia: ConfiguracionFrecuencia = {
        tipo: formData.frecuencia,
        hora: formData.configuracion_frecuencia.hora
      };

      if (formData.frecuencia === 'Semanal') {
        configuracionFrecuencia = {
          ...configuracionFrecuencia,
          dias_semana: formData.configuracion_frecuencia.dias_semana || []
        } as ConfiguracionFrecuenciaSemanal;
      } else if (formData.frecuencia === 'Mensual') {
        configuracionFrecuencia = {
          ...configuracionFrecuencia,
          dias_mes: formData.configuracion_frecuencia.dias_mes || []
        } as ConfiguracionFrecuenciaMensual;
      }

      // Incluir el ID solo si estamos editando
      const dataToSubmit = {
        ...(formData.id && { id: formData.id }), // Añadir el ID si existe (edición)
        responsable_nombre: formData.responsable_nombre,
        responsable_email: formData.responsable_email,
        responsable_telefono: formData.responsable_telefono,
        emisor_id: parseInt(formData.emisor_id),
        casilla_id: parseInt(formData.casilla_id),
        configuracion_frecuencia: configuracionFrecuencia,
        frecuencia_tipo_id: getFrecuenciaTipoId(formData.frecuencia), // Mapear a la ID correcta
        activo: formData.activo
      };

      await onSubmit(dataToSubmit);

      // Reset form and close modal
      setFormData({
        id: undefined,
        responsable_nombre: '',
        responsable_email: '',
        responsable_telefono: '',
        emisor_id: '',
        casilla_id: '',
        frecuencia: 'Diaria',
        configuracion_frecuencia: {
          tipo: 'Diaria',
          hora: '09:00',
          dias_semana: [],
          dias_mes: []
        },
        activo: true,
      });
      onClose();
    } catch (error: any) {
      console.error(`Error ${isEditing ? 'editando' : 'creando'} responsable:`, error);
      alert(error.message || `Error al ${isEditing ? 'editar' : 'crear'} el responsable. Por favor verifique los datos e intente nuevamente.`);
    } finally {
      setEnviando(false);
    }
  };

  const handleFrecuenciaChange = (value: string) => {
    setFormData({
      ...formData,
      frecuencia: value,
      configuracion_frecuencia: {
        ...formData.configuracion_frecuencia,
        tipo: value,
        dias_semana: value === 'Semanal' ? [] : formData.configuracion_frecuencia.dias_semana,
        dias_mes: value === 'Mensual' ? [] : formData.configuracion_frecuencia.dias_mes
      }
    });
  };

  const toggleDiaSemana = (diaId: number) => {
    const dias = formData.configuracion_frecuencia.dias_semana || [];
    const newDias = dias.includes(diaId)
      ? dias.filter(id => id !== diaId)
      : [...dias, diaId];

    setFormData({
      ...formData,
      configuracion_frecuencia: {
        ...formData.configuracion_frecuencia,
        dias_semana: newDias
      }
    });
  };

  const toggleDiaMes = (diaId: number) => {
    const dias = formData.configuracion_frecuencia.dias_mes || [];
    const newDias = dias.includes(diaId)
      ? dias.filter(id => id !== diaId)
      : [...dias, diaId];

    setFormData({
      ...formData,
      configuracion_frecuencia: {
        ...formData.configuracion_frecuencia,
        dias_mes: newDias
      }
    });
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
              {isEditing ? 'Editar Responsable' : 'Nuevo Responsable'}
            </Dialog.Title>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Nombre del Responsable
                </label>
                <TextInput
                  className="mt-1"
                  value={formData.responsable_nombre}
                  onChange={(e) => setFormData({ ...formData, responsable_nombre: e.target.value })}
                  placeholder="Nombre del responsable"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Email del Responsable
                </label>
                <TextInput
                  type="email"
                  className="mt-1"
                  value={formData.responsable_email}
                  onChange={(e) => setFormData({ ...formData, responsable_email: e.target.value })}
                  placeholder="Email del responsable"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Teléfono del Responsable
                </label>
                <TextInput
                  type="tel"
                  className="mt-1"
                  value={formData.responsable_telefono}
                  onChange={(e) => setFormData({ ...formData, responsable_telefono: e.target.value })}
                  placeholder="Teléfono del responsable"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Emisor
                </label>
                <div>
                  <pre className="text-xs text-gray-500">Debug info: {JSON.stringify({emisores: emisores.length, value: formData.emisor_id, loading})}</pre>
                </div>
                
                {/* Componente Combobox de Headless UI */}
                <div className="mt-1">
                  <Combobox
                    value={emisores.find((e: any) => e.id.toString() === formData.emisor_id) || null}
                    onChange={(emisor: any) => {
                      if (emisor) {
                        console.log('Emisor seleccionado:', emisor.id);
                        setFormData({ ...formData, emisor_id: emisor.id.toString() });
                      }
                    }}
                    disabled={loading}
                  >
                    <div className="relative">
                      <div className="relative w-full cursor-default overflow-hidden rounded-lg bg-white text-left border border-gray-300 shadow-sm">
                        <Combobox.Input
                          className="w-full border-none py-2 pl-3 pr-10 text-sm leading-5 text-gray-900 focus:ring-0"
                          displayValue={(emisor: any) => emisor?.nombre || ''}
                          onChange={(event) => {
                            // Este evento maneja la entrada del usuario para filtrar
                            console.log('Búsqueda:', event.target.value);
                            setQueryEmisor(event.target.value);
                          }}
                          placeholder="Seleccionar emisor..."
                        />
                        {queryEmisor ? (
                          <button
                            type="button"
                            className="absolute inset-y-0 right-9 flex items-center pr-2"
                            onClick={() => setQueryEmisor('')}
                          >
                            <XMarkIcon className="h-5 w-5 text-gray-400 hover:text-gray-700" aria-hidden="true" />
                          </button>
                        ) : null}
                        <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-2">
                          <ChevronUpDownIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                        </Combobox.Button>
                      </div>
                      <Transition
                        as={Fragment}
                        leave="transition ease-in duration-100"
                        leaveFrom="opacity-100"
                        leaveTo="opacity-0"
                        afterLeave={() => {}}
                      >
                        <Combobox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                          {emisoresFiltrados.length === 0 ? (
                            <div className="relative cursor-default select-none py-2 px-4 text-gray-700">
                              {queryEmisor.trim() ? `No hay emisores que coincidan con "${queryEmisor}"` : 'No hay emisores disponibles.'}
                            </div>
                          ) : (
                            emisoresFiltrados.map((emisor: any) => (
                              <Combobox.Option
                                key={emisor.id}
                                className={({ active }) =>
                                  `relative cursor-default select-none py-2 pl-10 pr-4 ${
                                    active ? 'bg-blue-600 text-white' : 'text-gray-900'
                                  }`
                                }
                                value={emisor}
                              >
                                {({ selected, active }) => (
                                  <>
                                    <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
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
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Casilla
                </label>
                <div>
                  <pre className="text-xs text-gray-500">Debug info: {JSON.stringify({casillas: casillas.length, value: formData.casilla_id, loading})}</pre>
                </div>
                
                {/* Componente Combobox de Headless UI para Casillas */}
                <div className="mt-1">
                  <Combobox
                    value={casillas.find((c: any) => c.id.toString() === formData.casilla_id) || null}
                    onChange={(casilla: any) => {
                      if (casilla) {
                        console.log('Casilla seleccionada:', casilla.id);
                        setFormData({ ...formData, casilla_id: casilla.id.toString() });
                      }
                    }}
                    disabled={loading}
                  >
                    <div className="relative">
                      <div className="relative w-full cursor-default overflow-hidden rounded-lg bg-white text-left border border-gray-300 shadow-sm">
                        <Combobox.Input
                          className="w-full border-none py-2 pl-3 pr-10 text-sm leading-5 text-gray-900 focus:ring-0"
                          displayValue={(casilla: any) => {
                            if (!casilla) return '';
                            return `${casilla.organizacion || 'Sin organización'} - ${casilla.producto || 'Sin producto'} (${casilla.nombre_yaml})`;
                          }}
                          onChange={(event) => {
                            console.log('Búsqueda casilla:', event.target.value);
                            setQueryCasilla(event.target.value);
                          }}
                          placeholder="Seleccionar casilla..."
                        />
                        {queryCasilla ? (
                          <button
                            type="button"
                            className="absolute inset-y-0 right-9 flex items-center pr-2"
                            onClick={() => setQueryCasilla('')}
                          >
                            <XMarkIcon className="h-5 w-5 text-gray-400 hover:text-gray-700" aria-hidden="true" />
                          </button>
                        ) : null}
                        <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-2">
                          <ChevronUpDownIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                        </Combobox.Button>
                      </div>
                      <Transition
                        as={Fragment}
                        leave="transition ease-in duration-100"
                        leaveFrom="opacity-100"
                        leaveTo="opacity-0"
                        afterLeave={() => {}}
                      >
                        <Combobox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                          {casillasFiltradas.length === 0 ? (
                            <div className="relative cursor-default select-none py-2 px-4 text-gray-700">
                              {queryCasilla.trim() ? `No hay casillas que coincidan con "${queryCasilla}"` : 'No hay casillas disponibles.'}
                            </div>
                          ) : (
                            casillasFiltradas.map((casilla: any) => (
                              <Combobox.Option
                                key={casilla.id}
                                className={({ active }) =>
                                  `relative cursor-default select-none py-2 pl-10 pr-4 ${
                                    active ? 'bg-blue-600 text-white' : 'text-gray-900'
                                  }`
                                }
                                value={casilla}
                              >
                                {({ selected, active }) => (
                                  <>
                                    <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                                      {`${casilla.organizacion || 'Sin organización'} - ${casilla.producto || 'Sin producto'} (${casilla.nombre_yaml})`}
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
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Frecuencia
                </label>
                
                {/* Componente Combobox de Headless UI para Frecuencia */}
                <div className="mt-1">
                  <Combobox
                    value={frecuenciaOpciones.find(f => f.id === formData.frecuencia) || null}
                    onChange={(frecuencia: any) => {
                      if (frecuencia) {
                        console.log('Frecuencia seleccionada:', frecuencia.id);
                        handleFrecuenciaChange(frecuencia.id);
                      }
                    }}
                  >
                    <div className="relative">
                      <div className="relative w-full cursor-default overflow-hidden rounded-lg bg-white text-left border border-gray-300 shadow-sm">
                        <Combobox.Input
                          className="w-full border-none py-2 pl-3 pr-10 text-sm leading-5 text-gray-900 focus:ring-0"
                          displayValue={(frecuencia: any) => frecuencia?.nombre || ''}
                          onChange={(event) => {
                            // No es necesario filtrar aquí ya que son sólo 3 opciones
                          }}
                          placeholder="Seleccionar frecuencia..."
                        />
                        <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-2">
                          <ChevronUpDownIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                        </Combobox.Button>
                      </div>
                      <Transition
                        as={Fragment}
                        leave="transition ease-in duration-100"
                        leaveFrom="opacity-100"
                        leaveTo="opacity-0"
                        afterLeave={() => {}}
                      >
                        <Combobox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                          {frecuenciaOpciones.map((frecuencia) => (
                            <Combobox.Option
                              key={frecuencia.id}
                              className={({ active }) =>
                                `relative cursor-default select-none py-2 pl-10 pr-4 ${
                                  active ? 'bg-blue-600 text-white' : 'text-gray-900'
                                }`
                              }
                              value={frecuencia}
                            >
                              {({ selected, active }) => (
                                <>
                                  <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                                    {frecuencia.nombre}
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
                          ))}
                        </Combobox.Options>
                      </Transition>
                    </div>
                  </Combobox>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Hora de envío
                </label>
                <input
                  type="time"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  value={formData.configuracion_frecuencia.hora}
                  onChange={(e) => setFormData({
                    ...formData,
                    configuracion_frecuencia: {
                      ...formData.configuracion_frecuencia,
                      hora: e.target.value
                    }
                  })}
                />
              </div>

              {formData.frecuencia === 'Semanal' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Días de la semana
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {diasSemana.map(dia => (
                      <label key={dia.id} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={formData.configuracion_frecuencia.dias_semana?.includes(dia.id)}
                          onChange={() => toggleDiaSemana(dia.id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span>{dia.nombre}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {formData.frecuencia === 'Mensual' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Días del mes
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {diasMes.map(dia => (
                      <label key={dia.id} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={formData.configuracion_frecuencia.dias_mes?.includes(dia.id)}
                          onChange={() => toggleDiaMes(dia.id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span>{dia.id}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.activo}
                    onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Responsable activo
                  </span>
                </label>
              </div>
            </form>
          </div>

          <div className="flex justify-end gap-2 p-6 border-t">
            <Button variant="secondary" onClick={onClose} type="button">
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={enviando}
            >
              {enviando 
                ? (isEditing ? 'Guardando...' : 'Creando...') 
                : (isEditing ? 'Guardar Cambios' : 'Crear Responsable')
              }
            </Button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};