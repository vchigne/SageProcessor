import React, { useState, useEffect } from 'react';
import { Table, TableHead, TableRow, TableHeaderCell, TableBody, TableCell, Text, Badge, Button, Flex, Card } from '@tremor/react';
import { TrashIcon, PencilIcon, PlusIcon } from '@heroicons/react/24/outline';

interface Suscripcion {
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
}

interface Emisor {
  id: number;
  nombre: string;
  activo: boolean;
}

interface PortalSuscripcionesListProps {
  suscripciones?: Suscripcion[];
  emisores?: Emisor[];
  onDelete?: (id: number) => void;
  onEdit?: (suscripcion: Suscripcion) => void;
  // Props para la versión conectada
  portalUuid?: string;
  portalId?: number;
  casillaId?: number | null;
  refreshKey?: number;
  esPortalExterno?: boolean;
  onCreateNew?: () => void;
}

const PortalSuscripcionesList: React.FC<PortalSuscripcionesListProps> = ({
  suscripciones: propsSuscripciones,
  emisores: propsEmisores,
  onDelete: propsOnDelete,
  onEdit,
  portalUuid,
  portalId,
  casillaId,
  refreshKey = 0,
  esPortalExterno = false,
  onCreateNew
}) => {
  // Estado para la versión conectada
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [suscripciones, setSuscripciones] = useState<Suscripcion[]>(propsSuscripciones || []);
  const [emisores, setEmisores] = useState<Emisor[]>(propsEmisores || []);

  // Efecto para cargar datos si estamos en modo conectado
  useEffect(() => {
    // Si recibimos suscripciones por props, no las cargamos
    if (propsSuscripciones) {
      return;
    }

    const fetchSuscripciones = async () => {
      // Necesitamos al menos un identificador: portalUuid, portalId o casillaId
      if (!portalUuid && !portalId && !casillaId) return;
      
      setLoading(true);
      setError(null);
      
      try {
        // Construir URL de consulta
        let url = `/api/suscripciones?`;
        
        // Priorizar el casilla_id si está disponible
        if (casillaId) {
          url += `casilla_id=${casillaId}`;
        } else if (portalId) {
          url += `portalId=${portalId}`;
        } else if (portalUuid) {
          url += `portalUuid=${portalUuid}`;
        }
        
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error('Error al cargar suscripciones');
        }
        
        const data = await response.json();
        setSuscripciones(data);
        
        // Cargar emisores si no los recibimos por props
        if (!propsEmisores && portalUuid) {
          const emisoresUrl = `/api/portales/${portalUuid}/emisores${casillaId ? `?casillaId=${casillaId}` : ''}`;
          const emisoresRes = await fetch(emisoresUrl);
          
          if (emisoresRes.ok) {
            const emisoresData = await emisoresRes.json();
            setEmisores(emisoresData);
          }
        }
      } catch (error) {
        console.error('Error al cargar datos:', error);
        setError('No se pudieron cargar las suscripciones');
      } finally {
        setLoading(false);
      }
    };

    fetchSuscripciones();
  }, [portalUuid, portalId, casillaId, refreshKey, propsSuscripciones, propsEmisores]);

  // Función para eliminar suscripción (versión conectada)
  const handleDelete = async (id: number) => {
    if (propsOnDelete) {
      propsOnDelete(id);
      return;
    }
    
    // Implementación conectada de eliminación
    try {
      const response = await fetch(`/api/suscripciones/${id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Error al eliminar la suscripción');
      }
      
      // Actualizar lista local eliminando la suscripción
      setSuscripciones(prev => prev.filter(s => s.id !== id));
      
    } catch (error) {
      console.error('Error al eliminar suscripción:', error);
      alert('Error al eliminar la suscripción. Por favor, inténtalo de nuevo.');
    }
  };
  
  const onDelete = propsOnDelete || handleDelete;
  const formatFrecuencia = (suscripcion: Suscripcion) => {
    switch (suscripcion.frecuencia) {
      case 'inmediata':
        return 'Inmediata';
      case 'diaria':
        return `Diaria ${suscripcion.hora_envio || ''}`;
      case 'semanal':
        return `Semanal ${getDiaSemana(suscripcion.dia_envio)} ${suscripcion.hora_envio || ''}`;
      case 'mensual':
        return `Mensual día ${suscripcion.dia_envio} ${suscripcion.hora_envio || ''}`;
      default:
        return suscripcion.frecuencia;
    }
  };

  const getDiaSemana = (dia?: number) => {
    const dias = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    return dia && dia > 0 && dia < 8 ? dias[dia] : '';
  };

  const formatNivelDetalle = (nivel: string) => {
    switch (nivel) {
      case 'detallado':
        return 'Detallado';
      case 'resumido_emisor':
        return 'Resumen por Emisor';
      case 'resumido_casilla':
        return 'Resumen por Casilla';
      default:
        return nivel;
    }
  };

  const getEmisoresNames = (emisoresIds: number[]) => {
    if (!emisoresIds || emisoresIds.length === 0) {
      return 'Todos los emisores';
    }
    
    const nombres = emisoresIds.map(id => {
      const emisor = emisores.find(e => e.id === id);
      return emisor ? emisor.nombre : `ID: ${id}`;
    });
    
    return nombres.join(', ');
  };

  const getMetodoEnvioLabel = (metodo: string) => {
    switch (metodo) {
      case 'email':
        return 'Email';
      case 'whatsapp':
        return 'WhatsApp';
      case 'telegram':
        return 'Telegram';
      default:
        return metodo;
    }
  };

  // Mostrar estado de carga
  if (loading) {
    return (
      <div className="bg-gray-50 p-6 rounded-lg text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <Text>Cargando suscripciones...</Text>
      </div>
    );
  }

  // Mostrar error si existe
  if (error) {
    return (
      <div className="bg-red-50 p-6 rounded-lg text-center">
        <Text className="text-red-600">{error}</Text>
      </div>
    );
  }

  // Estado cuando no hay suscripciones
  if (suscripciones.length === 0) {
    return (
      <div className="bg-gray-50 p-6 rounded-lg text-center">
        <Text className="mb-4">No hay suscripciones registradas.</Text>
        {onCreateNew && (
          <Button 
            icon={PlusIcon}
            color="blue"
            onClick={onCreateNew}
            className="mx-auto"
          >
            Crear nueva suscripción
          </Button>
        )}
      </div>
    );
  }

  return (
    <Table className="mt-4">
      <TableHead>
        <TableRow>
          <TableHeaderCell>Suscriptor</TableHeaderCell>
          <TableHeaderCell>Tipo</TableHeaderCell>
          <TableHeaderCell>Método</TableHeaderCell>
          <TableHeaderCell>Frecuencia</TableHeaderCell>
          <TableHeaderCell>Eventos</TableHeaderCell>
          <TableHeaderCell>Emisores</TableHeaderCell>
          <TableHeaderCell>Acciones</TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {suscripciones.map((suscripcion) => (
          <TableRow key={suscripcion.id}>
            <TableCell>
              <div>
                <Text className="font-medium">{suscripcion.nombre}</Text>
                {suscripcion.es_tecnico ? (
                  <Text className="text-xs text-gray-500">
                    {suscripcion.webhook_url}
                  </Text>
                ) : (
                  <Text className="text-xs text-gray-500">
                    {suscripcion.email}
                  </Text>
                )}
              </div>
            </TableCell>
            <TableCell>
              <Badge color={suscripcion.es_tecnico ? 'indigo' : 'green'}>
                {suscripcion.es_tecnico ? 'Técnico' : 'Usuario'}
              </Badge>
              <Text className="text-xs">
                {formatNivelDetalle(suscripcion.nivel_detalle)}
              </Text>
            </TableCell>
            <TableCell>
              <Badge color="blue">
                {getMetodoEnvioLabel(suscripcion.metodo_envio)}
              </Badge>
            </TableCell>
            <TableCell>
              {formatFrecuencia(suscripcion)}
            </TableCell>
            <TableCell>
              <div className="flex flex-wrap gap-1">
                {suscripcion.tipos_evento && Array.isArray(suscripcion.tipos_evento) ? suscripcion.tipos_evento.map(tipo => (
                  <Badge key={tipo} color={
                    tipo === 'error' ? 'red' : 
                    tipo === 'warning' ? 'amber' : 
                    tipo === 'mensaje' ? 'blue' : 
                    tipo === 'exito' ? 'green' : 
                    tipo === 'demora' ? 'orange' : 
                    'gray'
                  } className="text-xs">
                    {tipo === 'error' ? 'Error' : 
                     tipo === 'warning' ? 'Adv.' : 
                     tipo === 'mensaje' ? 'Msj.' : 
                     tipo === 'exito' ? 'Éxito' : 
                     tipo === 'demora' ? 'Demora' : 
                     tipo}
                  </Badge>
                )) : <span className="text-xs text-gray-400">Sin tipos</span>}
              </div>
            </TableCell>
            <TableCell>
              <Text className="text-xs">
                {getEmisoresNames(suscripcion.emisores)}
              </Text>
            </TableCell>
            <TableCell>
              <div className="flex space-x-2">
                {(onEdit || esPortalExterno) && (
                  <Button
                    icon={PencilIcon}
                    variant="light"
                    color="blue"
                    onClick={() => {
                      if (onEdit) {
                        onEdit(suscripcion);
                      }
                    }}
                    tooltip="Editar suscripción"
                  />
                )}
                <Button
                  icon={TrashIcon}
                  variant="light"
                  color="red"
                  onClick={() => onDelete(suscripcion.id)}
                  tooltip="Eliminar suscripción"
                />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

export default PortalSuscripcionesList;