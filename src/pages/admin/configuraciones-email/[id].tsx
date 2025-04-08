import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { toast } from 'react-toastify';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

interface EmailConfiguracion {
  id: number;
  nombre: string;
  direccion: string;
  proposito: string;
  servidor_entrada?: string;
  puerto_entrada?: number;
  protocolo_entrada?: string;
  usar_ssl_entrada?: boolean;
  servidor_salida?: string;
  puerto_salida?: number;
  usar_tls_salida?: boolean;
  usuario: string;
  password?: string;
  casilla_id?: number;
  casilla_nombre?: string;
  estado: string;
  ultimo_chequeo?: string;
  mensaje_error?: string;
  fecha_creacion: string;
  fecha_modificacion: string;
}

interface Casilla {
  id: number;
  nombre: string;
  nombre_yaml: string;
  nombre_instalacion?: string;
  nombre_organizacion?: string;
  email_casilla?: string;
  is_active?: boolean;
  nombre_humano?: string;
}

export default function EditarConfiguracion() {
  const router = useRouter();
  const { id } = router.query;
  const isNew = id === 'nueva';
  const configId = isNew ? null : Number(id);
  
  const [config, setConfig] = useState<Partial<EmailConfiguracion>>({
    nombre: '',
    direccion: '',
    proposito: 'multiple', // Cambiado a 'multiple' para siempre permitir envío y recepción
    servidor_entrada: '',
    puerto_entrada: 993,
    protocolo_entrada: 'imap',
    usar_ssl_entrada: true,
    servidor_salida: '',
    puerto_salida: 587,
    usar_tls_salida: true,
    usuario: '',
    password: '',
    casilla_id: undefined,
    estado: 'pendiente'
  });
  
  const [casillas, setCasillas] = useState<Casilla[]>([]);
  const [casillasFiltradas, setCasillasFiltradas] = useState<Casilla[]>([]);
  const [busquedaCasilla, setBusquedaCasilla] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(!isNew);
  const [showPassword, setShowPassword] = useState(false);
  
  // Cargar datos iniciales
  useEffect(() => {
    const fetchData = async () => {
      // Cargar lista de casillas disponibles
      try {
        const casillasResponse = await fetch('/api/casillas');
        if (casillasResponse.ok) {
          const casillasData = await casillasResponse.json();
          
          // Procesar casillas para extraer nombres humanos del YAML si están disponibles
          const casillasProcesadas = casillasData.map(casilla => {
            let nombreHumano = '';
            if (casilla.yaml_contenido) {
              try {
                // Intenta extraer la propiedad "nombre" del YAML contenido
                const contenidoYaml = casilla.yaml_contenido;
                const matchNombre = contenidoYaml.match(/nombre:\s*["']?([^"'\n]+)["']?/i);
                
                if (matchNombre && matchNombre[1]) {
                  nombreHumano = matchNombre[1].trim();
                }
              } catch (error) {
                console.error('Error al procesar YAML para', casilla.nombre_yaml, error);
              }
            }
            
            return {
              ...casilla,
              nombre_humano: nombreHumano || casilla.nombre_yaml
            };
          });
          
          setCasillas(casillasProcesadas);
          setCasillasFiltradas(casillasProcesadas);
        }
      } catch (error) {
        console.error('Error al cargar casillas:', error);
      }
      
      // Si es edición, cargar la configuración
      if (!isNew && configId) {
        try {
          setIsLoading(true);
          const configResponse = await fetch(`/api/email/configuraciones/${configId}`);
          if (configResponse.ok) {
            const configData = await configResponse.json();
            // No incluimos la contraseña en la carga inicial
            setConfig({
              ...configData,
              password: '' // La contraseña no se envía desde el servidor
            });
          } else if (configResponse.status === 404) {
            toast.error('Configuración no encontrada');
            router.push('/admin/configuraciones-email');
          }
        } catch (error) {
          console.error('Error al cargar configuración:', error);
          toast.error('Error al cargar los datos de la configuración');
        } finally {
          setIsLoading(false);
        }
      }
      
      // Si hay un casilla_id en la query y es una nueva configuración
      if (isNew && router.query.casilla_id) {
        const casillaId = Number(router.query.casilla_id);
        setConfig(prev => ({
          ...prev,
          casilla_id: casillaId
        }));
      }
    };
    
    if (router.isReady) {
      fetchData();
    }
  }, [router.isReady, isNew, configId, router.query.casilla_id]);
  
  // Manejar cambio en la búsqueda de casillas directamente 
  const handleCasillaBusquedaChange = (e) => {
    const valor = e.target.value;
    setBusquedaCasilla(valor);
    
    if (!valor.trim()) {
      setCasillasFiltradas(casillas);
      return;
    }
    
    const termino = valor.toLowerCase().trim();
    const filtradas = casillas.filter(casilla => {
      const yaml = casilla.nombre_yaml?.toLowerCase() || '';
      const email = casilla.email_casilla?.toLowerCase() || '';
      const nombreHumano = casilla.nombre_humano?.toLowerCase() || '';
      
      return yaml.includes(termino) || 
             email.includes(termino) ||
             nombreHumano.includes(termino);
    });
    
    setCasillasFiltradas(filtradas);
  };
  
  // Manejar cambios en el formulario
  const handleChange = (name: string, value: any) => {
    setConfig(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Guardar los datos
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validaciones
    if (!config.nombre || !config.direccion || !config.usuario) {
      toast.error('Por favor complete los campos obligatorios');
      return;
    }
    
    // Si tenemos configuración múltiple o de recepción, aseguramos que el servidor de entrada esté configurado
    if ((config.proposito === 'recepcion' || config.proposito === 'multiple') && 
        (!config.servidor_entrada || !config.puerto_entrada || config.servidor_entrada.trim() === '')) {
      console.log('Servidor de entrada:', config.servidor_entrada, 'Puerto:', config.puerto_entrada);
      toast.error('Por favor configure los datos del servidor de entrada correctamente');
      return;
    }
    
    // Si tenemos configuración múltiple, de envío o admin, aseguramos que el servidor de salida esté configurado
    if ((config.proposito === 'envio' || config.proposito === 'multiple' || config.proposito === 'admin') && 
        (!config.servidor_salida || !config.puerto_salida || config.servidor_salida.trim() === '')) {
      toast.error('Por favor configure los datos del servidor de salida correctamente');
      return;
    }
    
    try {
      setIsSaving(true);
      
      const url = isNew 
        ? '/api/email/configuraciones'
        : `/api/email/configuraciones/${configId}`;
      
      const method = isNew ? 'POST' : 'PUT';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config)
      });
      
      if (response.ok) {
        toast.success(isNew ? 'Configuración creada correctamente' : 'Configuración actualizada correctamente');
        router.push('/admin/configuraciones-email');
      } else {
        const data = await response.json();
        toast.error(`Error: ${data.error || 'No se pudo guardar la configuración'}`);
      }
    } catch (error) {
      console.error('Error al guardar:', error);
      toast.error('Error de conexión al guardar configuración');
    } finally {
      setIsSaving(false);
    }
  };
  
  // Si está cargando, mostrar un indicador
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>
          {isNew ? 'Nueva Configuración de Email' : 'Editar Configuración de Email'} | SAGE
        </title>
      </Head>

      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center mb-6">
          <Link href="/admin/configuraciones-email" className="mr-4">
            <ArrowLeftIcon className="h-5 w-5 text-gray-500" />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isNew ? 'Nueva Configuración de Email' : 'Editar Configuración de Email'}
          </h1>
        </div>

        <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Información general */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Información general</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre de la configuración *
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    placeholder="Ej: Email Administración"
                    value={config.nombre || ''}
                    onChange={(e) => handleChange('nombre', e.target.value)}
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dirección de correo *
                  </label>
                  <input
                    type="email"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    placeholder="Ej: admin@ejemplo.com"
                    value={config.direccion || ''}
                    onChange={(e) => handleChange('direccion', e.target.value)}
                    required
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Propósito *
                  </label>
                  <select
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    value={config.proposito || 'multiple'}
                    onChange={(e) => handleChange('proposito', e.target.value)}
                  >
                    <option value="multiple">Recibir y enviar (recomendado para casillas)</option>
                    <option value="admin">Administración (para notificaciones)</option>
                    <option value="recepcion">Solo recepción (no recomendado)</option>
                    <option value="envio">Solo envío (no recomendado)</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Asociado a casilla (opcional)
                  </label>
                  <div className="space-y-2">
                    <input
                      type="text"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      placeholder="Buscar casilla por nombre o YAML..."
                      value={busquedaCasilla}
                      onChange={handleCasillaBusquedaChange}
                    />
                    <select
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      value={config.casilla_id?.toString() || ''}
                      onChange={(e) => handleChange('casilla_id', e.target.value ? Number(e.target.value) : null)}
                    >
                      <option value="">-- Sin asociar --</option>
                      {(busquedaCasilla ? casillasFiltradas : casillas).map(casilla => (
                        <option
                          key={casilla.id}
                          value={casilla.id.toString()}
                        >
                          {casilla.nombre_humano || casilla.nombre_yaml}
                        </option>
                      ))}
                      {busquedaCasilla && casillasFiltradas.length === 0 && (
                        <option value="" disabled>
                          No se encontraron casillas
                        </option>
                      )}
                    </select>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Configuración de servidor de entrada */}
            {(config.proposito === 'recepcion' || config.proposito === 'multiple' || config.proposito === 'admin') && (
              <div className="space-y-4 border-t pt-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-3">Servidor de entrada</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Protocolo
                    </label>
                    <select
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      value={config.protocolo_entrada || 'imap'}
                      onChange={(e) => handleChange('protocolo_entrada', e.target.value)}
                    >
                      <option value="imap">IMAP</option>
                      <option value="pop3">POP3</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Servidor de entrada *
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      placeholder="Ej: imap.gmail.com"
                      value={config.servidor_entrada || ''}
                      onChange={(e) => handleChange('servidor_entrada', e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Puerto de entrada *
                    </label>
                    <input
                      type="number"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      placeholder="Ej: 993"
                      value={config.puerto_entrada || 993}
                      min={1}
                      max={65535}
                      onChange={(e) => handleChange('puerto_entrada', parseInt(e.target.value) || 993)}
                    />
                  </div>
                  
                  <div className="flex items-center h-full pt-4">
                    <label className="inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        id="usar_ssl_entrada"
                        name="usar_ssl_entrada"
                        checked={config.usar_ssl_entrada !== false}
                        onChange={() => handleChange('usar_ssl_entrada', !config.usar_ssl_entrada)}
                      />
                      <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                      <span className="ml-3 text-sm font-medium text-gray-900 dark:text-gray-300">Usar SSL/TLS (seguridad activada)</span>
                    </label>
                  </div>
                </div>
              </div>
            )}
            
            {/* Configuración de servidor de salida */}
            {(config.proposito === 'envio' || config.proposito === 'multiple' || config.proposito === 'admin') && (
              <div className="space-y-4 border-t pt-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-3">Servidor de salida</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Servidor SMTP *
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      placeholder="Ej: smtp.gmail.com"
                      value={config.servidor_salida || ''}
                      onChange={(e) => handleChange('servidor_salida', e.target.value)}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Puerto SMTP *
                    </label>
                    <input
                      type="number"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      placeholder="Ej: 587"
                      value={config.puerto_salida || 587}
                      min={1}
                      max={65535}
                      onChange={(e) => handleChange('puerto_salida', parseInt(e.target.value) || 587)}
                    />
                  </div>
                </div>
                
                <div className="flex items-center h-full">
                  <label className="inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      id="usar_tls_salida"
                      name="usar_tls_salida"
                      checked={config.usar_tls_salida !== false}
                      onChange={() => handleChange('usar_tls_salida', !config.usar_tls_salida)}
                    />
                    <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    <span className="ml-3 text-sm font-medium text-gray-900 dark:text-gray-300">Usar SSL/TLS (seguridad activada)</span>
                  </label>
                </div>
              </div>
            )}
            
            {/* Configuración de autenticación */}
            <div className="space-y-4 border-t pt-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Autenticación</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Usuario *
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    placeholder="Ej: usuario@dominio.com"
                    value={config.usuario || ''}
                    onChange={(e) => handleChange('usuario', e.target.value)}
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contraseña {isNew ? '*' : '(dejar vacío para no cambiar)'}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      placeholder={isNew ? 'Contraseña' : 'Dejar vacío para no cambiar'}
                      value={config.password || ''}
                      onChange={(e) => handleChange('password', e.target.value)}
                      required={isNew}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500"
                    >
                      {showPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="pt-4">
                <p className="text-xs text-gray-500">
                  Nota: Las credenciales se almacenan de forma segura y solo se utilizan 
                  para la verificación y operación del sistema de correo.
                </p>
              </div>
            </div>
            
            {/* Botones de acción */}
            <div className="flex justify-end space-x-4 pt-4 border-t">
              <Link href="/admin/configuraciones-email">
                <button 
                  type="button"
                  className="py-2 px-4 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-opacity-50"
                  onClick={(e) => {
                    e.preventDefault();
                    router.push('/admin/configuraciones-email');
                  }}
                >
                  Cancelar
                </button>
              </Link>
              
              {/* Usando un div con un onClick en vez de un button para evitar que se envíe el formulario con Enter */}
              <div 
                role="button"
                tabIndex={0}
                className={`py-2 px-4 rounded-md bg-blue-500 text-white ${!isSaving ? 'hover:bg-blue-600' : 'opacity-80 cursor-not-allowed'} 
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 flex items-center`}
                onClick={(e) => {
                  if (!isSaving) {
                    handleSubmit(e as any);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isSaving) {
                    handleSubmit(e as any);
                  }
                }}
              >
                {isSaving ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Guardando...
                  </span>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Guardar
                  </>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}