import { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import SearchableCombobox from '../UI/SearchableCombobox';

interface Responsable {
  id: number;
  responsable_nombre: string;
  responsable_email: string;
  responsable_telefono?: string;
  frecuencia_tipo_id?: number;
  configuracion_frecuencia?: any;
  [key: string]: any;
}

interface TipoFrecuencia {
  id: number;
  nombre: string;
  descripcion?: string;
}

interface ResponsableEditorProps {
  responsable: Responsable | null;
  open: boolean;
  onClose: () => void;
  onSave: (responsable: Responsable) => void;
}

export default function ResponsableEditor({
  responsable,
  open,
  onClose,
  onSave
}: ResponsableEditorProps) {
  const [formData, setFormData] = useState<Responsable | null>(null);
  const [tiposFrecuencia, setTiposFrecuencia] = useState<TipoFrecuencia[]>([]);
  const [selectedTipoFrecuencia, setSelectedTipoFrecuencia] = useState<TipoFrecuencia | null>(null);
  const [diasSemana, setDiasSemana] = useState<number[]>([]);
  const [diasMes, setDiasMes] = useState<number[]>([]);
  const [hora, setHora] = useState('12:00');
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      // Cargar tipos de frecuencia
      fetchTiposFrecuencia();
      
      // Resetear el formulario
      if (responsable) {
        setFormData({ ...responsable });
        
        // Configurar tipo de frecuencia
        if (responsable.frecuencia_tipo_id) {
          const tipo = tiposFrecuencia.find(t => t.id === responsable.frecuencia_tipo_id) || null;
          setSelectedTipoFrecuencia(tipo);
        }
        
        // Configurar detalles de frecuencia
        if (responsable.configuracion_frecuencia) {
          try {
            const config = typeof responsable.configuracion_frecuencia === 'string'
              ? JSON.parse(responsable.configuracion_frecuencia)
              : responsable.configuracion_frecuencia;
              
            if (config.hora) setHora(config.hora);
            if (config.dias_semana) setDiasSemana(config.dias_semana);
            if (config.dias_mes) setDiasMes(config.dias_mes);
          } catch (error) {
            console.error('Error parsing frecuencia config:', error);
          }
        }
      } else {
        // Inicializar un nuevo responsable
        setFormData({
          id: 0,
          responsable_nombre: '',
          responsable_email: '',
          responsable_telefono: ''
        });
        setSelectedTipoFrecuencia(null);
        setDiasSemana([]);
        setDiasMes([]);
        setHora('12:00');
      }
    }
  }, [open, responsable, tiposFrecuencia]);

  const fetchTiposFrecuencia = async () => {
    try {
      const response = await fetch('/api/tipos-frecuencia');
      if (response.ok) {
        const data = await response.json();
        setTiposFrecuencia(data);
      } else {
        console.error('Error fetching tipos de frecuencia');
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => prev ? { ...prev, [name]: value } : null);
  };

  const handleTipoFrecuenciaChange = (option: TipoFrecuencia) => {
    setSelectedTipoFrecuencia(option);
    setFormData(prev => prev ? { ...prev, frecuencia_tipo_id: option.id } : null);
  };

  const handleDiaSemanaToggle = (dia: number) => {
    setDiasSemana(prev => 
      prev.includes(dia) 
        ? prev.filter(d => d !== dia) 
        : [...prev, dia].sort((a, b) => a - b)
    );
  };

  const handleDiaMesToggle = (dia: number) => {
    setDiasMes(prev => 
      prev.includes(dia) 
        ? prev.filter(d => d !== dia) 
        : [...prev, dia].sort((a, b) => a - b)
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    
    if (!formData || !formData.responsable_nombre || !formData.responsable_email) {
      setErrorMessage('Nombre y email son obligatorios');
      return;
    }
    
    if (selectedTipoFrecuencia) {
      const configuracionFrecuencia: any = {
        hora: hora
      };
      
      if (selectedTipoFrecuencia.nombre.toLowerCase() === 'semanal' && diasSemana.length === 0) {
        setErrorMessage('Seleccione al menos un día de la semana');
        return;
      } else if (selectedTipoFrecuencia.nombre.toLowerCase() === 'semanal') {
        configuracionFrecuencia.dias_semana = diasSemana;
      }
      
      if (selectedTipoFrecuencia.nombre.toLowerCase() === 'mensual' && diasMes.length === 0) {
        setErrorMessage('Seleccione al menos un día del mes');
        return;
      } else if (selectedTipoFrecuencia.nombre.toLowerCase() === 'mensual') {
        configuracionFrecuencia.dias_mes = diasMes;
      }
      
      formData.configuracion_frecuencia = configuracionFrecuencia;
    }
    
    setLoading(true);
    try {
      onSave(formData);
    } catch (error) {
      console.error('Error saving responsable:', error);
      setErrorMessage('Ocurrió un error al guardar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      className="relative z-50"
    >
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-2xl w-full rounded-xl bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-gray-200 p-4">
            <Dialog.Title className="text-lg font-semibold text-gray-900">
              {responsable && responsable.id ? 'Editar Responsable' : 'Nuevo Responsable'}
            </Dialog.Title>
            <button
              type="button"
              className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none"
              onClick={onClose}
            >
              <XMarkIcon className="h-6 w-6" aria-hidden="true" />
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {errorMessage && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
                {errorMessage}
              </div>
            )}
            
            <div className="space-y-4">
              <div>
                <label htmlFor="responsable_nombre" className="block text-sm font-medium text-gray-700">
                  Nombre *
                </label>
                <input
                  type="text"
                  id="responsable_nombre"
                  name="responsable_nombre"
                  value={formData?.responsable_nombre || ''}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="responsable_email" className="block text-sm font-medium text-gray-700">
                  Email *
                </label>
                <input
                  type="email"
                  id="responsable_email"
                  name="responsable_email"
                  value={formData?.responsable_email || ''}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="responsable_telefono" className="block text-sm font-medium text-gray-700">
                  Teléfono
                </label>
                <input
                  type="tel"
                  id="responsable_telefono"
                  name="responsable_telefono"
                  value={formData?.responsable_telefono || ''}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Frecuencia
                </label>
                <SearchableCombobox
                  options={tiposFrecuencia}
                  selectedOption={selectedTipoFrecuencia}
                  onChange={handleTipoFrecuenciaChange}
                  placeholder="Seleccionar tipo de frecuencia..."
                  labelKey="nombre"
                />
              </div>
              
              {selectedTipoFrecuencia && (
                <div>
                  <label htmlFor="hora" className="block text-sm font-medium text-gray-700">
                    Hora de Entrega
                  </label>
                  <input
                    type="time"
                    id="hora"
                    value={hora}
                    onChange={(e) => setHora(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                </div>
              )}
              
              {selectedTipoFrecuencia && selectedTipoFrecuencia.nombre.toLowerCase() === 'semanal' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Días de la Semana
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { id: 1, name: 'Lun' },
                      { id: 2, name: 'Mar' },
                      { id: 3, name: 'Mié' },
                      { id: 4, name: 'Jue' },
                      { id: 5, name: 'Vie' },
                      { id: 6, name: 'Sáb' },
                      { id: 7, name: 'Dom' }
                    ].map((dia) => (
                      <button
                        key={dia.id}
                        type="button"
                        onClick={() => handleDiaSemanaToggle(dia.id)}
                        className={`py-2 px-4 rounded-md text-center text-sm font-medium ${
                          diasSemana.includes(dia.id)
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {dia.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {selectedTipoFrecuencia && selectedTipoFrecuencia.nombre.toLowerCase() === 'mensual' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Días del Mes
                  </label>
                  <div className="grid grid-cols-7 gap-2">
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((dia) => (
                      <button
                        key={dia}
                        type="button"
                        onClick={() => handleDiaMesToggle(dia)}
                        className={`py-2 px-2 rounded-md text-center text-sm font-medium ${
                          diasMes.includes(dia)
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {dia}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <div className="mt-6 flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {loading ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}