import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { toast } from 'react-toastify';
import { 
  EnvelopeIcon, 
  CheckCircleIcon, 
  WrenchScrewdriverIcon, 
  CloudIcon,
  ServerIcon
} from '@heroicons/react/24/outline';
import { 
  Title, 
  Text, 
  Subtitle, 
  Button, 
  Card 
} from '@tremor/react';

const initialConfig = {
  admin_emails: [],
  check_interval_hours: 12,
  monitor_cloud_providers: true,
  monitor_disk_space: true,
  disk_space_warning_threshold: 80,  // Porcentaje
  notification_enabled: true
};

function AdminEmailRow({ email, index, onDelete }) {
  return (
    <div className="flex items-center space-x-2 mb-2">
      <div className="flex-1 p-2 border border-gray-200 rounded-md flex items-center">
        <EnvelopeIcon className="h-4 w-4 text-gray-500 mr-2" />
        <span className="text-sm">{email}</span>
      </div>
      <button
        type="button"
        onClick={() => onDelete(index)}
        className="text-red-500 hover:text-red-700"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export default function SystemConfig() {
  const router = useRouter();
  const [config, setConfig] = useState(initialConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  
  // Cargar configuración actual
  useEffect(() => {
    fetchConfig();
  }, []);
  
  const fetchConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/system-config');
      if (!response.ok) {
        throw new Error('Error al cargar la configuración del sistema');
      }
      
      const data = await response.json();
      
      // Si hay datos, actualizar estado. Si no, dejar el initialConfig
      if (data && Object.keys(data).length > 0) {
        setConfig(data);
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar la configuración del sistema: ' + error.message);
    } finally {
      setLoading(false);
    }
  };
  
  const saveConfig = async () => {
    try {
      setSaving(true);
      
      const response = await fetch('/api/admin/system-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al guardar la configuración');
      }
      
      toast.success('Configuración guardada correctamente');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al guardar la configuración: ' + error.message);
    } finally {
      setSaving(false);
    }
  };
  
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    setConfig(prevState => ({
      ...prevState,
      [name]: type === 'checkbox' ? checked : 
              type === 'number' ? Number(value) : 
              value
    }));
  };
  
  const handleAddEmail = () => {
    if (!newEmail) return;
    
    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      toast.error('Por favor, introduce una dirección de correo electrónico válida');
      return;
    }
    
    // Verificar si ya existe
    if (config.admin_emails.includes(newEmail)) {
      toast.warning('Esta dirección de correo ya está en la lista');
      return;
    }
    
    // Añadir nuevo email
    setConfig(prevState => ({
      ...prevState,
      admin_emails: [...prevState.admin_emails, newEmail]
    }));
    
    // Limpiar campo
    setNewEmail('');
  };
  
  const handleDeleteEmail = (index) => {
    setConfig(prevState => ({
      ...prevState,
      admin_emails: prevState.admin_emails.filter((_, i) => i !== index)
    }));
  };
  
  const handleTestNotification = async () => {
    try {
      if (config.admin_emails.length === 0) {
        toast.warning('No hay direcciones de correo configuradas para enviar la prueba');
        return;
      }
      
      toast.info('Enviando correo de prueba...');
      
      const response = await fetch('/api/admin/system-config/test-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ emails: config.admin_emails }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al enviar notificación de prueba');
      }
      
      toast.success('Notificación de prueba enviada correctamente');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al enviar notificación de prueba: ' + error.message);
    }
  };
  
  return (
    <>
      <Head>
        <title>SAGE - Gestión Administrativa</title>
      </Head>
      
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <Title>Gestión Administrativa</Title>
            <Text>Configuración y monitoreo del sistema SAGE</Text>
          </div>
        </div>
        
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
          </div>
        ) : (
          <div className="space-y-6">
            <Card className="p-6">
              <Subtitle className="mb-4 flex items-center">
                <EnvelopeIcon className="h-5 w-5 mr-2" /> 
                Notificaciones del Sistema
              </Subtitle>
              
              <div className="space-y-4">
                <div className="flex items-center mb-4">
                  <input
                    type="checkbox"
                    id="notification_enabled"
                    name="notification_enabled"
                    checked={config.notification_enabled}
                    onChange={handleInputChange}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 mr-2"
                  />
                  <label htmlFor="notification_enabled" className="text-sm font-medium text-gray-700">
                    Habilitar notificaciones por correo electrónico
                  </label>
                </div>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Correos electrónicos de administradores
                  </label>
                  <div className="mb-3">
                    {config.admin_emails.length === 0 ? (
                      <p className="text-sm text-gray-500 italic">No hay direcciones de correo configuradas</p>
                    ) : (
                      config.admin_emails.map((email, index) => (
                        <AdminEmailRow 
                          key={index} 
                          email={email} 
                          index={index} 
                          onDelete={handleDeleteEmail} 
                        />
                      ))
                    )}
                  </div>
                  <div className="flex space-x-2">
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      placeholder="nombre@ejemplo.com"
                    />
                    <Button
                      size="xs"
                      color="indigo"
                      onClick={handleAddEmail}
                    >
                      Añadir
                    </Button>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Intervalo de verificación (horas)
                  </label>
                  <input
                    type="number"
                    name="check_interval_hours"
                    value={config.check_interval_hours}
                    onChange={handleInputChange}
                    min="1"
                    max="48"
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
                
                <div className="flex justify-end">
                  <Button
                    size="xs"
                    color="amber"
                    onClick={handleTestNotification}
                    disabled={config.admin_emails.length === 0}
                  >
                    Enviar notificación de prueba
                  </Button>
                </div>
              </div>
            </Card>
            
            <Card className="p-6">
              <Subtitle className="mb-4 flex items-center">
                <CloudIcon className="h-5 w-5 mr-2" /> 
                Monitoreo de Proveedores de Nube
              </Subtitle>
              
              <div className="space-y-4">
                <div className="flex items-center mb-4">
                  <input
                    type="checkbox"
                    id="monitor_cloud_providers"
                    name="monitor_cloud_providers"
                    checked={config.monitor_cloud_providers}
                    onChange={handleInputChange}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 mr-2"
                  />
                  <label htmlFor="monitor_cloud_providers" className="text-sm font-medium text-gray-700">
                    Monitorear conectividad de proveedores de nube
                  </label>
                </div>
                
                <div className="p-4 bg-blue-50 rounded-md text-sm text-blue-800">
                  <p>El sistema realizará comprobaciones periódicas de conectividad con todos los proveedores de nube configurados y enviará notificaciones si detecta problemas.</p>
                </div>
              </div>
            </Card>
            
            <Card className="p-6">
              <Subtitle className="mb-4 flex items-center">
                <ServerIcon className="h-5 w-5 mr-2" /> 
                Monitoreo de Recursos del Sistema
              </Subtitle>
              
              <div className="space-y-4">
                <div className="flex items-center mb-4">
                  <input
                    type="checkbox"
                    id="monitor_disk_space"
                    name="monitor_disk_space"
                    checked={config.monitor_disk_space}
                    onChange={handleInputChange}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 mr-2"
                  />
                  <label htmlFor="monitor_disk_space" className="text-sm font-medium text-gray-700">
                    Monitorear espacio en disco
                  </label>
                </div>
                
                {config.monitor_disk_space && (
                  <div className="ml-6">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Umbral de advertencia (%)
                    </label>
                    <input
                      type="number"
                      name="disk_space_warning_threshold"
                      value={config.disk_space_warning_threshold}
                      onChange={handleInputChange}
                      min="50"
                      max="95"
                      className="block w-40 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    />
                    <p className="mt-1 text-sm text-gray-500">
                      Se enviará una notificación cuando el uso de disco supere este porcentaje.
                    </p>
                  </div>
                )}
                
                <div className="p-4 bg-amber-50 rounded-md text-sm text-amber-800">
                  <p>El monitoreo de recursos del sistema ayuda a prevenir problemas relacionados con el rendimiento. Estas verificaciones se ejecutan junto con el resto de tareas de mantenimiento del sistema.</p>
                </div>
              </div>
            </Card>
            
            <div className="flex justify-end space-x-3">
              <Button
                color="gray"
                onClick={() => router.back()}
              >
                Cancelar
              </Button>
              <Button
                color="indigo"
                onClick={saveConfig}
                loading={saving}
              >
                Guardar Configuración
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}