import { useState, useEffect } from 'react';
import Head from 'next/head';
import { Title, Text, Card, Button, Badge } from '@tremor/react';
import { toast } from 'react-toastify';
import { 
  TrashIcon, 
  PlusCircleIcon, 
  EnvelopeIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';

// Componente para una fila de email de administrador
function AdminEmailRow({ email, index, onDelete }) {
  return (
    <div className="flex items-center space-x-2 py-2">
      <div className="flex-grow bg-gray-50 px-3 py-2 rounded-md flex items-center">
        <EnvelopeIcon className="h-5 w-5 text-gray-500 mr-2" />
        <span>{email}</span>
      </div>
      <Button
        icon={TrashIcon}
        variant="light"
        color="red"
        tooltip="Eliminar"
        onClick={() => onDelete(index)}
      />
    </div>
  );
}

export default function SystemConfig() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [config, setConfig] = useState({
    admin_emails: [],
    notification_enabled: true,
    disk_space_monitoring_enabled: false,
    log_level: 'info',
    notify_events: ['cloud_connection_error', 'disk_space_warning'],
  });
  const [newEmail, setNewEmail] = useState('');
  
  // Cargar configuración al inicio
  useEffect(() => {
    fetchConfig();
  }, []);
  
  // Obtener configuración actual
  const fetchConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/system-config');
      if (!response.ok) throw new Error('Error al cargar la configuración');
      
      const data = await response.json();
      console.log('Configuración cargada:', data);
      
      // Asegurarnos de que admin_emails sea un array
      if (!Array.isArray(data.admin_emails)) {
        data.admin_emails = [];
      }
      
      setConfig(data);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar la configuración: ' + error.message);
    } finally {
      setLoading(false);
    }
  };
  
  // Guardar configuración
  const saveConfig = async () => {
    try {
      setSaving(true);
      const response = await fetch('/api/admin/system-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al guardar la configuración');
      }
      
      toast.success('Configuración guardada con éxito');
    } catch (error) {
      console.error('Error al guardar:', error);
      toast.error('Error al guardar la configuración: ' + error.message);
    } finally {
      setSaving(false);
    }
  };
  
  // Enviar notificación de prueba
  const sendTestNotification = async () => {
    try {
      if (config.admin_emails.length === 0) {
        toast.warn('Debe agregar al menos un email de administrador para enviar la notificación de prueba');
        return;
      }
      
      setTesting(true);
      const response = await fetch('/api/admin/system-config/test-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al enviar notificación de prueba');
      }
      
      const result = await response.json();
      toast.success(`Notificación de prueba enviada a ${result.sentTo.length} destinatarios`);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al enviar notificación: ' + error.message);
    } finally {
      setTesting(false);
    }
  };
  
  // Agregar nuevo email
  const addEmail = () => {
    if (!newEmail.trim()) {
      toast.warn('Ingrese un email válido');
      return;
    }
    
    // Validación básica del formato de email
    if (!/\S+@\S+\.\S+/.test(newEmail)) {
      toast.warn('Ingrese un email con formato válido');
      return;
    }
    
    // Verificar que no exista ya
    if (config.admin_emails.includes(newEmail)) {
      toast.warn('Este email ya está en la lista');
      return;
    }
    
    setConfig(prev => ({
      ...prev,
      admin_emails: [...prev.admin_emails, newEmail]
    }));
    
    setNewEmail('');
  };
  
  // Eliminar email
  const deleteEmail = (index) => {
    setConfig(prev => ({
      ...prev,
      admin_emails: prev.admin_emails.filter((_, i) => i !== index)
    }));
  };
  
  // Manejar cambio en campos
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setConfig(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };
  
  // Manejar cambio en eventos de notificación
  const handleEventToggle = (eventType) => {
    setConfig(prev => {
      const currentEvents = [...(prev.notify_events || [])];
      
      if (currentEvents.includes(eventType)) {
        // Remover el evento si ya está incluido
        return {
          ...prev,
          notify_events: currentEvents.filter(e => e !== eventType)
        };
      } else {
        // Agregar el evento si no está incluido
        return {
          ...prev,
          notify_events: [...currentEvents, eventType]
        };
      }
    });
  };
  
  return (
    <>
      <Head>
        <title>SAGE - Gestión Administrativa</title>
      </Head>
      <div className="space-y-6 p-6">
        <div>
          <Title>Gestión Administrativa</Title>
          <Text>Configuración de monitoreo y notificaciones del sistema</Text>
        </div>
        
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
          </div>
        ) : (
          <>
            <Card className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-3">Notificaciones de Administración</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Configura los correos electrónicos que recibirán alertas y notificaciones administrativas del sistema
                </p>
                
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Emails de Administradores</h4>
                  
                  {config.admin_emails.length > 0 ? (
                    <div className="mb-4 space-y-1">
                      {config.admin_emails.map((email, index) => (
                        <AdminEmailRow 
                          key={index} 
                          email={email} 
                          index={index} 
                          onDelete={deleteEmail} 
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500 italic mb-4 py-2">
                      No hay emails configurados. Agrega al menos uno para recibir notificaciones.
                    </div>
                  )}
                  
                  <div className="flex space-x-2">
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="Ingrese email de administrador"
                      className="block flex-grow rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    />
                    <Button
                      icon={PlusCircleIcon}
                      onClick={addEmail}
                      color="indigo"
                    >
                      Agregar
                    </Button>
                  </div>
                </div>
                
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Configuración de Notificaciones</h4>
                  
                  <div>
                    <h5 className="text-sm font-medium text-gray-700 mb-2">Eventos a notificar</h5>
                    <div className="space-y-2 pl-2">
                      <div className="flex items-center">
                        <input
                          id="event_cloud_connection_error"
                          type="checkbox"
                          checked={config.notify_events?.includes('cloud_connection_error')}
                          onChange={() => handleEventToggle('cloud_connection_error')}
                          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <label htmlFor="event_cloud_connection_error" className="ml-2 block text-sm text-gray-700">
                          Errores de conexión con proveedores cloud
                        </label>
                      </div>
                      
                      <div className="flex items-center">
                        <input
                          id="event_disk_space_warning"
                          type="checkbox"
                          checked={config.notify_events?.includes('disk_space_warning')}
                          onChange={() => handleEventToggle('disk_space_warning')}
                          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <label htmlFor="event_disk_space_warning" className="ml-2 block text-sm text-gray-700">
                          Advertencias de espacio en disco
                        </label>
                      </div>
                      
                      <div className="flex items-center">
                        <input
                          id="event_janitor_error"
                          type="checkbox"
                          checked={config.notify_events?.includes('janitor_error')}
                          onChange={() => handleEventToggle('janitor_error')}
                          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <label htmlFor="event_janitor_error" className="ml-2 block text-sm text-gray-700">
                          Errores generales del Janitor Daemon
                        </label>
                      </div>
                      
                      <div className="flex items-center">
                        <input
                          id="event_migration_completed"
                          type="checkbox"
                          checked={config.notify_events?.includes('migration_completed')}
                          onChange={() => handleEventToggle('migration_completed')}
                          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <label htmlFor="event_migration_completed" className="ml-2 block text-sm text-gray-700">
                          Migración de ejecuciones completada
                        </label>
                      </div>
                      
                      <div className="flex items-center mt-4">
                        <input
                          id="disk_space_monitoring_enabled"
                          name="disk_space_monitoring_enabled"
                          type="checkbox"
                          checked={config.disk_space_monitoring_enabled}
                          onChange={handleChange}
                          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <label htmlFor="disk_space_monitoring_enabled" className="ml-2 block text-sm text-gray-700">
                          Monitoreo de espacio en disco
                        </label>
                        <Badge color="purple" size="xs" className="ml-2">
                          Próximamente
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Nivel de Log</h4>
                  <select
                    name="log_level"
                    value={config.log_level || 'info'}
                    onChange={handleChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  >
                    <option value="debug">Debug (Detallado)</option>
                    <option value="info">Info (Normal)</option>
                    <option value="warning">Warning (Solo alertas)</option>
                    <option value="error">Error (Solo errores)</option>
                  </select>
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 border-t pt-4">
                <Button
                  color="cyan"
                  onClick={sendTestNotification}
                  disabled={testing || config.admin_emails.length === 0}
                  loading={testing}
                  icon={EnvelopeIcon}
                >
                  {testing ? 'Enviando...' : 'Enviar Notificación de Prueba'}
                </Button>
                <Button
                  color="indigo"
                  onClick={saveConfig}
                  disabled={saving}
                  loading={saving}
                  icon={CheckCircleIcon}
                >
                  {saving ? 'Guardando...' : 'Guardar Configuración'}
                </Button>
              </div>
            </Card>
          </>
        )}
      </div>
    </>
  );
}