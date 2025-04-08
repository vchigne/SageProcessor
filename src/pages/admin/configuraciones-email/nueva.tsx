import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { toast } from 'react-toastify';
import { Card, Text, Title, Button, TextInput, Select, SelectItem, Switch, NumberInput } from '@tremor/react';
import { ArrowLeftIcon, CheckIcon, LockClosedIcon, LockOpenIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import styles from '@/components/EmailConfigForm.module.css';

interface Casilla {
  id: number;
  nombre_yaml: string;
  email_casilla: string | null;
  is_active: boolean;
}

export default function NuevaConfiguracion() {
  const router = useRouter();
  
  const [config, setConfig] = useState({
    nombre: '',
    direccion: '',
    proposito: 'recepcion',
    servidor_entrada: '',
    puerto_entrada: 993,
    protocolo_entrada: 'imap',
    usar_ssl_entrada: true,
    servidor_salida: '',
    puerto_salida: 587,
    usar_tls_salida: true,
    usuario: '',
    password: '',
    casilla_id: null as number | null,
    estado: 'pendiente'
  });
  
  const [casillas, setCasillas] = useState<Casilla[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Cargar datos iniciales
  useEffect(() => {
    const fetchData = async () => {
      // Cargar lista de casillas disponibles
      try {
        const casillasResponse = await fetch('/api/casillas');
        if (casillasResponse.ok) {
          const casillasData = await casillasResponse.json();
          setCasillas(casillasData);
        }
      } catch (error) {
        console.error('Error al cargar casillas:', error);
      }
      
      // Si hay un casilla_id en la query
      if (router.query.casilla_id) {
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
  }, [router.isReady, router.query.casilla_id]);
  
  // Manejar cambios en el formulario
  const handleChange = (name: string, value: any) => {
    setConfig(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Validar la conexión SMTP antes de guardar
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    success?: boolean;
    message?: string;
  } | null>(null);
  
  const validateConnection = async () => {
    if (!config.servidor_salida || !config.puerto_salida || !config.usuario || !config.password) {
      toast.error('Complete los datos del servidor y credenciales para validar la conexión');
      return;
    }
    
    try {
      setIsValidating(true);
      setValidationResult(null);
      
      // Creamos un objeto de configuración temporal para validar
      const tempConfig = {
        ...config,
        id: 0, // ID temporal
      };
      
      const response = await fetch('/api/email/configuraciones/validar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(tempConfig)
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setValidationResult({
          success: true,
          message: data.mensaje || 'Conexión validada correctamente'
        });
        toast.success('La configuración es válida');
      } else {
        setValidationResult({
          success: false,
          message: data.mensaje || data.error || 'Error al validar la conexión'
        });
        toast.error(`Error: ${data.mensaje || data.error || 'No se pudo validar la conexión'}`);
      }
    } catch (error: any) {
      console.error('Error al validar:', error);
      setValidationResult({
        success: false,
        message: error.message || 'Error inesperado al validar la conexión'
      });
      toast.error('Error de conexión al validar configuración');
    } finally {
      setIsValidating(false);
    }
  };
  
  // Guardar los datos
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validaciones
    if (!config.nombre || !config.direccion || !config.usuario || !config.password) {
      toast.error('Por favor complete los campos obligatorios');
      return;
    }
    
    if (config.proposito === 'recepcion' || config.proposito === 'multiple') {
      if (!config.servidor_entrada || !config.puerto_entrada) {
        toast.error('Configure los datos del servidor de entrada');
        return;
      }
    }
    
    if (config.proposito === 'envio' || config.proposito === 'multiple' || config.proposito === 'admin') {
      if (!config.servidor_salida || !config.puerto_salida) {
        toast.error('Configure los datos del servidor de salida');
        return;
      }
    }
    
    try {
      setIsSaving(true);
      
      const response = await fetch('/api/email/configuraciones', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config)
      });
      
      if (response.ok) {
        toast.success('Configuración creada correctamente');
        router.push('/admin/configuraciones-email');
      } else {
        const data = await response.json();
        toast.error(`Error: ${data.error || 'No se pudo crear la configuración'}`);
      }
    } catch (error) {
      console.error('Error al guardar:', error);
      toast.error('Error de conexión al crear configuración');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Head>
        <title>Nueva Configuración de Email | SAGE</title>
      </Head>

      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center mb-6">
          <Link href="/admin/configuraciones-email" className="mr-4">
            <ArrowLeftIcon className="h-5 w-5 text-gray-500" />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Nueva Configuración de Email
          </h1>
        </div>

        <Card className="max-w-4xl mx-auto">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Información general */}
            <div className="space-y-4">
              <Title>Información general</Title>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Text>Nombre de la configuración *</Text>
                  <TextInput
                    placeholder="Ej: Email Administración"
                    value={config.nombre}
                    onChange={(e) => handleChange('nombre', e.target.value)}
                    required
                  />
                </div>
                
                <div>
                  <Text>Dirección de correo *</Text>
                  <TextInput
                    placeholder="Ej: admin@ejemplo.com"
                    value={config.direccion}
                    onChange={(e) => handleChange('direccion', e.target.value)}
                    required
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Text>Propósito *</Text>
                  <Select
                    value={config.proposito}
                    onValueChange={(value) => handleChange('proposito', value)}
                  >
                    <SelectItem value="recepcion">Recepción (solo recibir)</SelectItem>
                    <SelectItem value="envio">Envío (solo enviar)</SelectItem>
                    <SelectItem value="admin">Administración (para notificaciones)</SelectItem>
                    <SelectItem value="multiple">Múltiple (recibir y enviar)</SelectItem>
                  </Select>
                </div>
                
                <div>
                  <Text>Asociado a casilla (opcional)</Text>
                  <Select
                    value={config.casilla_id?.toString() || ''}
                    onValueChange={(value) => handleChange('casilla_id', value ? Number(value) : null)}
                    placeholder="Seleccione una casilla..."
                  >
                    <SelectItem value="">-- Sin asociar --</SelectItem>
                    {casillas.map(casilla => (
                      <SelectItem
                        key={casilla.id}
                        value={casilla.id.toString()}
                      >
                        {`${casilla.nombre_yaml} ${casilla.email_casilla ? `<${casilla.email_casilla}>` : ''}`}
                      </SelectItem>
                    ))}
                  </Select>
                </div>
              </div>
            </div>
            
            {/* Configuración de servidor de entrada */}
            {(config.proposito === 'recepcion' || config.proposito === 'multiple' || config.proposito === 'admin') && (
              <div className="space-y-4 border-t pt-6">
                <Title>Servidor de entrada</Title>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Text>Protocolo</Text>
                    <Select
                      value={config.protocolo_entrada}
                      onValueChange={(value) => handleChange('protocolo_entrada', value)}
                    >
                      <SelectItem value="imap">IMAP</SelectItem>
                      <SelectItem value="pop3">POP3</SelectItem>
                    </Select>
                  </div>
                  
                  <div>
                    <Text>Servidor de entrada *</Text>
                    <TextInput
                      placeholder="Ej: imap.gmail.com"
                      value={config.servidor_entrada}
                      onChange={(e) => handleChange('servidor_entrada', e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Text>Puerto de entrada *</Text>
                    <NumberInput
                      placeholder="Ej: 993"
                      value={config.puerto_entrada}
                      min={1}
                      max={65535}
                      onChange={(value) => handleChange('puerto_entrada', value)}
                    />
                  </div>
                  
                  <div className="flex flex-col h-full pt-4">
                    <div className="flex items-center">
                      <Switch
                        id="usar_ssl_entrada"
                        name="usar_ssl_entrada"
                        checked={config.usar_ssl_entrada}
                        onChange={() => handleChange('usar_ssl_entrada', !config.usar_ssl_entrada)}
                      />
                      <Text className="ml-2">Usar SSL/TLS</Text>
                    </div>
                    <div className="mt-2">
                      {config.usar_ssl_entrada ? (
                        <div className={styles.sslTlsActive}>
                          <LockClosedIcon className={styles.sslTlsIcon} />
                          <span>Conexión segura activada</span>
                        </div>
                      ) : (
                        <div className={styles.sslTlsInactive}>
                          <LockOpenIcon className={styles.sslTlsIcon} />
                          <span>Conexión no segura</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Configuración de servidor de salida */}
            {(config.proposito === 'envio' || config.proposito === 'multiple' || config.proposito === 'admin') && (
              <div className="space-y-4 border-t pt-6">
                <Title>Servidor de salida</Title>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Text>Servidor SMTP *</Text>
                    <TextInput
                      placeholder="Ej: smtp.gmail.com"
                      value={config.servidor_salida}
                      onChange={(e) => handleChange('servidor_salida', e.target.value)}
                    />
                  </div>
                  
                  <div>
                    <Text>Puerto SMTP *</Text>
                    <NumberInput
                      placeholder="Ej: 587"
                      value={config.puerto_salida}
                      min={1}
                      max={65535}
                      onChange={(value) => handleChange('puerto_salida', value)}
                    />
                  </div>
                </div>
                
                <div className="flex flex-col h-full">
                  <div className="flex items-center">
                    <Switch
                      id="usar_tls_salida"
                      name="usar_tls_salida"
                      checked={config.usar_tls_salida}
                      onChange={() => handleChange('usar_tls_salida', !config.usar_tls_salida)}
                    />
                    <Text className="ml-2">Usar SSL/TLS (recomendado)</Text>
                  </div>
                  <div className="mt-2">
                    {config.usar_tls_salida ? (
                      <div className={styles.sslTlsActive}>
                        <LockClosedIcon className={styles.sslTlsIcon} />
                        <span>Conexión segura activada</span>
                      </div>
                    ) : (
                      <div className={styles.sslTlsInactive}>
                        <LockOpenIcon className={styles.sslTlsIcon} />
                        <span>Conexión no segura</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {/* Configuración de autenticación */}
            <div className="space-y-4 border-t pt-6">
              <Title>Autenticación</Title>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Text>Usuario *</Text>
                  <TextInput
                    placeholder="Ej: usuario@dominio.com"
                    value={config.usuario}
                    onChange={(e) => handleChange('usuario', e.target.value)}
                    required
                  />
                </div>
                
                <div>
                  <Text>Contraseña *</Text>
                  <div className="relative">
                    <TextInput
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Contraseña"
                      value={config.password}
                      onChange={(e) => handleChange('password', e.target.value)}
                      required
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
                <Text className="text-xs text-gray-500">
                  Nota: Las credenciales se almacenan de forma segura y solo se utilizan 
                  para la verificación y operación del sistema de correo.
                </Text>
                
                <button
                  type="button"
                  onClick={validateConnection}
                  disabled={isValidating || !config.usuario || !config.password}
                  className={styles.validationButton}
                >
                  {isValidating ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Validando conexión...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center">
                      <CheckCircleIcon className={styles.validationButtonIcon} />
                      Validar conexión
                    </span>
                  )}
                </button>
                
                {validationResult && (
                  <div className={`mt-2 p-2 rounded text-sm ${validationResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {validationResult.message}
                  </div>
                )}
              </div>
            </div>
            
            {/* Botones de acción */}
            <div className="flex justify-end space-x-4 pt-4 border-t">
              <Link href="/admin/configuraciones-email">
                <Button variant="secondary" color="gray">
                  Cancelar
                </Button>
              </Link>
              
              <Button 
                type="submit" 
                color="blue" 
                disabled={isSaving}
                icon={isSaving ? undefined : CheckIcon}
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
                  'Guardar'
                )}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}