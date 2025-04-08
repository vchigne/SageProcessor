import React, { useState, useEffect } from 'react';
import { Title, Text, Grid, Col, Button, Select, SelectItem } from '@tremor/react';
import TagsSelector from './TagsSelector';

interface Emisor {
  id: number;
  nombre: string;
  activo: boolean;
}

interface PortalSuscripcionesFormProps {
  emisores: Emisor[];
  onSubmit?: (data: any) => void;
  onSuccess?: () => void;
  onCancel: () => void;
  permitirSuscripcionesTecnicas?: boolean;
  portalUuid?: string;
  portalId?: number;
  casillaId?: number | null;
  suscripcionParaEditar?: {
    id: number;
    casilla_id: number;
    nombre: string;
    email: string;
    telefono?: string;
    frecuencia: string;
    nivel_detalle: string;
    tipos_evento: string[];
    hora_envio: number | string;
    dia_envio?: number;
    metodo_envio: string;
    emisores: number[] | any[];
    es_tecnico: boolean;
    webhook_url?: string;
    api_key?: string;
  };
  esEdicion?: boolean;
}

const PortalSuscripcionesForm: React.FC<PortalSuscripcionesFormProps> = ({ 
  emisores, 
  onSubmit, 
  onSuccess,
  onCancel,
  permitirSuscripcionesTecnicas = false,
  portalUuid,
  portalId,
  casillaId,
  suscripcionParaEditar,
  esEdicion = false
}) => {

  // Depuración para verificar valores recibidos
  useEffect(() => {
    console.log('PortalSuscripcionesForm - Valores recibidos:');
    console.log('portalUuid:', portalUuid);
    console.log('portalId:', portalId);
    console.log('casillaId:', casillaId);
    console.log('onSuccess es función:', typeof onSuccess === 'function');
    console.log('onSubmit es función:', typeof onSubmit === 'function');
  }, [portalUuid, portalId, casillaId, onSuccess, onSubmit]);
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    telefono: '', // Campo adicional para teléfono opcional
    frecuencia: 'inmediata',
    nivel_detalle: 'detallado',
    tipos_evento: ['error', 'warning', 'mensaje', 'exito', 'demora'],
    hora_envio: '08:00',
    dia_envio: 1, // Lunes
    dia_mes: 1, // Deprecated - Usamos solo dia_envio ahora
    metodo_envio: 'email',
    emisores: [] as number[],
    es_tecnico: false,
    webhook_url: '',
    api_key: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showEmailOrWebhook, setShowEmailOrWebhook] = useState(true);
  const [selectedEmisoresNames, setSelectedEmisoresNames] = useState<string[]>([]);

  // Cargar datos para edición si se proporciona una suscripción existente
  useEffect(() => {
    if (suscripcionParaEditar) {
      // Preparar la hora de envío en formato string para el input type="time"
      let horaEnvio = suscripcionParaEditar.hora_envio;
      if (typeof horaEnvio === 'number') {
        // Convertir número a formato "HH:MM"
        const horas = Math.floor(horaEnvio / 100);
        const minutos = horaEnvio % 100;
        horaEnvio = `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}`;
      }
      
      // Actualizar el estado con los datos de la suscripción existente
      setFormData({
        ...(formData as any), // Para evitar errores de tipo
        ...suscripcionParaEditar,
        hora_envio: horaEnvio,
        // Asegurarse de que todos los campos necesarios tengan valores adecuados
        dia_mes: suscripcionParaEditar.dia_envio || 1,
        dia_envio: suscripcionParaEditar.dia_envio || 1,
        telefono: suscripcionParaEditar.telefono || '',
        api_key: suscripcionParaEditar.api_key || '',
        webhook_url: suscripcionParaEditar.webhook_url || '',
      });
      
      // Configurar visibilidad de campos según el tipo de suscripción
      setShowEmailOrWebhook(!suscripcionParaEditar.es_tecnico);
    }
  }, [suscripcionParaEditar]);

  useEffect(() => {
    // Mapear IDs a nombres para la visualización inicial
    const nombres = formData.emisores.map(id => {
      const emisor = emisores.find(e => e.id === id);
      return emisor ? emisor.nombre : '';
    }).filter(Boolean);
    
    setSelectedEmisoresNames(nombres);
  }, [formData.emisores, emisores]);

  const diasSemana = [
    { id: 1, nombre: 'Lunes' },
    { id: 2, nombre: 'Martes' },
    { id: 3, nombre: 'Miércoles' },
    { id: 4, nombre: 'Jueves' },
    { id: 5, nombre: 'Viernes' },
    { id: 6, nombre: 'Sábado' },
    { id: 7, nombre: 'Domingo' },
  ];

  const diasMes = Array.from({ length: 31 }, (_, i) => ({
    id: i + 1,
    nombre: `${i + 1}`
  }));

  const tiposEventos = [
    { id: 'error', nombre: 'Errores' },
    { id: 'warning', nombre: 'Advertencias' },
    { id: 'mensaje', nombre: 'Mensajes' },
    { id: 'exito', nombre: 'Ejecuciones Exitosas' },
    { id: 'demora', nombre: 'Demoras en Envíos' },
    { id: 'otro', nombre: 'Otros' },
  ];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Limpiar error al cambiar el valor
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Resetear campos y mostrar/ocultar según el tipo de suscripción
    if (name === 'es_tecnico') {
      const esTecnico = value === 'true';
      setShowEmailOrWebhook(!esTecnico);
      
      // Limpiar los campos que no corresponden al tipo de suscripción seleccionado
      if (esTecnico) {
        // Si cambia a suscripción técnica, resetear campos de suscripción humana
        setFormData(prev => ({
          ...prev,
          es_tecnico: true,
          email: '',
          telefono: '',
          metodo_envio: 'email',
          // Mantener otros campos
        }));
        // Limpiar errores relacionados
        setErrors(prev => ({
          ...prev,
          email: '',
          telefono: '',
          metodo_envio: ''
        }));
      } else {
        // Si cambia a suscripción humana, resetear campos de suscripción técnica
        setFormData(prev => ({
          ...prev,
          es_tecnico: false,
          webhook_url: '',
          api_key: '',
          // Mantener otros campos
        }));
        // Limpiar errores relacionados
        setErrors(prev => ({
          ...prev,
          webhook_url: '',
          api_key: ''
        }));
      }
    } else {
      // Para otros campos, simplemente actualizar el valor
      // Limpiar error al cambiar el valor
      if (errors[name]) {
        setErrors(prev => ({ ...prev, [name]: '' }));
      }
    }
  };

  const handleTiposEventosChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value, checked } = e.target;
    setFormData(prev => {
      if (checked) {
        return { ...prev, tipos_evento: [...prev.tipos_evento, value] };
      } else {
        return { ...prev, tipos_evento: prev.tipos_evento.filter(tipo => tipo !== value) };
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validación
    const newErrors: Record<string, string> = {};
    
    if (!formData.nombre.trim()) {
      newErrors.nombre = 'El nombre es obligatorio';
    }
    
    if (!formData.es_tecnico && !formData.email.trim()) {
      newErrors.email = 'El email es obligatorio para suscripciones no técnicas';
    }
    
    // Validar que haya un teléfono cuando se selecciona WhatsApp o Telegram
    if (!formData.es_tecnico && 
        (formData.metodo_envio === 'whatsapp' || formData.metodo_envio === 'telegram') && 
        !formData.telefono.trim()) {
      newErrors.telefono = `El teléfono es obligatorio para notificaciones por ${formData.metodo_envio === 'whatsapp' ? 'WhatsApp' : 'Telegram'}`;
    }
    
    if (formData.es_tecnico && !formData.webhook_url.trim()) {
      newErrors.webhook_url = 'La URL del webhook es obligatoria para suscripciones técnicas';
    }
    
    if (formData.tipos_evento.length === 0) {
      newErrors.tipos_evento = 'Debe seleccionar al menos un tipo de evento';
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    // Convertir valores según su tipo
    const dataToSubmit = {
      ...formData,
      dia_envio: formData.frecuencia === 'semanal' ? Number(formData.dia_envio) : 
                 formData.frecuencia === 'mensual' ? Number(formData.dia_mes) : undefined,
      es_tecnico: Boolean(formData.es_tecnico)
    };
    
    // Depuración: mostrar datos enviados
    console.log('Intentando enviar:', { portalUuid, portalId, casillaId });
    
    // Si tenemos portalUuid y casillaId, estamos en el escenario del portal externo
    if (portalUuid && casillaId !== undefined && casillaId !== null) {
      try {
        // Agregar información de la casilla a los datos
        const submitData = {
          ...dataToSubmit,
          casilla_id: casillaId,
          portalUuid: portalUuid
        };
        
        // Para edición, necesitamos asegurarnos que el ID existe
        let url = '/api/suscripciones';
        let method = 'POST';
        
        // Si es edición y tenemos un ID, usamos PUT
        if (esEdicion && suscripcionParaEditar && 'id' in suscripcionParaEditar) {
          url = `/api/suscripciones/${suscripcionParaEditar.id}`;
          method = 'PUT';
        }
        
        const response = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(submitData),
        });
        
        if (!response.ok) {
          throw new Error(`Error al ${esEdicion ? 'actualizar' : 'crear'} la suscripción: ${response.status}`);
        }
        
        // Si todo fue exitoso, llamar a onSuccess
        if (typeof onSuccess === 'function') {
          onSuccess();
        }
      } catch (error) {
        console.error('Error en la operación de suscripción:', error);
        // Mostrar error al usuario
        setErrors({
          form: `Error al procesar la solicitud: ${error instanceof Error ? error.message : 'Error desconocido'}`
        });
      }
    } else if (typeof onSubmit === 'function') {
      // Si estamos en el escenario normal con onSubmit (admin, por ejemplo)
      onSubmit(dataToSubmit);
    } else {
      console.error('No se pudo procesar el formulario: No hay función onSubmit ni datos de portal/casilla');
      setErrors({
        form: 'Error: No se pueden procesar los datos del formulario'
      });
    }
  };

  const handleEmisoresChange = (selectedEmisores: string[]) => {
    // Actualizar nombres seleccionados para visualización
    setSelectedEmisoresNames(selectedEmisores);
    
    // Convertir nombres a IDs para el envío
    const selectedIds = emisores
      .filter(emisor => selectedEmisores.includes(emisor.nombre))
      .map(emisor => emisor.id);
      
    setFormData(prev => ({ ...prev, emisores: selectedIds }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Title className="mb-4">{esEdicion ? 'Editar Suscripción' : 'Nueva Suscripción'}</Title>
      
      <Grid numItems={1} numItemsMd={2} className="gap-4 mb-4">
        <Col>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre del Suscriptor
            </label>
            <input
              type="text"
              name="nombre"
              value={formData.nombre}
              onChange={handleChange}
              className={`block w-full p-2 border rounded-md ${errors.nombre ? 'border-red-500' : 'border-gray-300'}`}
              placeholder="Nombre completo"
            />
            {errors.nombre && <Text className="text-red-500 text-xs mt-1">{errors.nombre}</Text>}
          </div>
          
          {permitirSuscripcionesTecnicas && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo de Suscripción
              </label>
              <Select
                value={String(formData.es_tecnico)}
                onValueChange={(value) => handleSelectChange('es_tecnico', value)}
              >
                <SelectItem value="false">Humano (Email)</SelectItem>
                <SelectItem value="true">Técnica (Webhook)</SelectItem>
              </Select>
            </div>
          )}
          
          {(!formData.es_tecnico || !permitirSuscripcionesTecnicas) && (
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={`block w-full p-2 border rounded-md ${errors.email ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="correo@ejemplo.com"
                />
                {errors.email && <Text className="text-red-500 text-xs mt-1">{errors.email}</Text>}
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Teléfono (Opcional)
                </label>
                <input
                  type="tel"
                  name="telefono"
                  value={formData.telefono}
                  onChange={handleChange}
                  className={`block w-full p-2 border rounded-md ${errors.telefono ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="+56 9 1234 5678"
                />
                {errors.telefono ? (
                  <Text className="text-red-500 text-xs mt-1">{errors.telefono}</Text>
                ) : (
                  <Text className="text-xs text-gray-500 mt-1">
                    Necesario para recibir notificaciones por WhatsApp o Telegram.
                  </Text>
                )}
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Método de Envío
                </label>
                <Select
                  value={formData.metodo_envio}
                  onValueChange={(value) => handleSelectChange('metodo_envio', value)}
                >
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp (Plan Premium)</SelectItem>
                  <SelectItem value="telegram">Telegram (Plan Premium)</SelectItem>
                </Select>
                {(formData.metodo_envio === 'whatsapp' || formData.metodo_envio === 'telegram') && (
                  <Text className="text-amber-600 text-xs mt-1">
                    Esta opción requiere un plan de suscripción Premium. Contacte a su administrador.
                  </Text>
                )}
              </div>
            </>
          )}
          
          {formData.es_tecnico && permitirSuscripcionesTecnicas && (
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  URL del Webhook
                </label>
                <input
                  type="url"
                  name="webhook_url"
                  value={formData.webhook_url}
                  onChange={handleChange}
                  className={`block w-full p-2 border rounded-md ${errors.webhook_url ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="https://ejemplo.com/webhook"
                />
                {errors.webhook_url && <Text className="text-red-500 text-xs mt-1">{errors.webhook_url}</Text>}
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  API Key (Opcional)
                </label>
                <input
                  type="text"
                  name="api_key"
                  value={formData.api_key}
                  onChange={handleChange}
                  className="block w-full p-2 border border-gray-300 rounded-md"
                  placeholder="Clave API para autenticación (opcional)"
                />
              </div>
            </>
          )}
        </Col>
        
        <Col>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Frecuencia de Notificaciones
            </label>
            <Select
              value={formData.frecuencia}
              onValueChange={(value) => handleSelectChange('frecuencia', value)}
            >
              <SelectItem value="inmediata">Inmediata</SelectItem>
              <SelectItem value="diaria">Diaria</SelectItem>
              <SelectItem value="semanal">Semanal</SelectItem>
              <SelectItem value="mensual">Mensual</SelectItem>
            </Select>
          </div>
          
          {formData.frecuencia !== 'inmediata' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hora de Envío
              </label>
              <input
                type="time"
                name="hora_envio"
                value={formData.hora_envio}
                onChange={handleChange}
                className="block w-full p-2 border border-gray-300 rounded-md"
              />
            </div>
          )}
          
          {formData.frecuencia === 'semanal' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Día de la Semana
              </label>
              <Select
                value={String(formData.dia_envio)}
                onValueChange={(value) => handleSelectChange('dia_envio', value)}
              >
                {diasSemana.map(dia => (
                  <SelectItem key={dia.id} value={String(dia.id)}>
                    {dia.nombre}
                  </SelectItem>
                ))}
              </Select>
            </div>
          )}
          
          {formData.frecuencia === 'mensual' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Día del Mes
              </label>
              <Select
                value={String(formData.dia_mes)}
                onValueChange={(value) => handleSelectChange('dia_mes', value)}
              >
                {diasMes.map(dia => (
                  <SelectItem key={dia.id} value={String(dia.id)}>
                    {dia.nombre}
                  </SelectItem>
                ))}
              </Select>
            </div>
          )}
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nivel de Detalle
            </label>
            <Select
              value={formData.nivel_detalle}
              onValueChange={(value) => handleSelectChange('nivel_detalle', value)}
            >
              <SelectItem value="detallado">Detallado (cada evento)</SelectItem>
              <SelectItem value="resumido_emisor">Resumen por Emisor</SelectItem>
              <SelectItem value="resumido_casilla">Resumen por Casilla</SelectItem>
            </Select>
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipos de Eventos
            </label>
            <div className="space-y-2">
              {tiposEventos.map(tipo => (
                <div key={tipo.id} className="flex items-center">
                  <input
                    type="checkbox"
                    id={`tipo-${tipo.id}`}
                    value={tipo.id}
                    checked={formData.tipos_evento.includes(tipo.id)}
                    onChange={handleTiposEventosChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor={`tipo-${tipo.id}`} className="ml-2 block text-sm text-gray-700">
                    {tipo.nombre}
                  </label>
                </div>
              ))}
            </div>
            {errors.tipos_evento && <Text className="text-red-500 text-xs mt-1">{errors.tipos_evento}</Text>}
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Emisores (Opcional)
            </label>
            <TagsSelector
              availableTags={emisores.map(e => e.nombre)}
              selectedTags={selectedEmisoresNames}
              onTagsChange={handleEmisoresChange}
              placeholder="Buscar emisores..."
            />
            <Text className="text-xs text-gray-500 mt-1">
              Si no selecciona ningún emisor, recibirá notificaciones de todos los emisores.
            </Text>
          </div>
        </Col>
      </Grid>
      
      {errors.form && (
        <div className="bg-red-50 border border-red-300 rounded-lg p-4 mb-4">
          <Text className="text-red-600">{errors.form}</Text>
        </div>
      )}

      <div className="flex justify-end space-x-4">
        <Button
          onClick={onCancel}
          className="!bg-red-600 text-white rounded-md"
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          className="!bg-blue-600 text-white rounded-md"
        >
          {esEdicion ? 'Guardar Cambios' : 'Crear Suscripción'}
        </Button>
      </div>
    </form>
  );
};

export default PortalSuscripcionesForm;