import React, { useState, useEffect } from 'react';
import { Card, Title, Text, Button, Badge } from '@tremor/react';
import { 
  PlusIcon, 
  ListBulletIcon, 
  Squares2X2Icon,
  ClipboardDocumentIcon,
  LinkIcon
} from '@heroicons/react/24/outline';

interface Portal {
  id: number;
  uuid: string;
  nombre: string;
  instalacion: {
    id: number;
    organizacion: {
      nombre: string;
    };
    producto: {
      nombre: string;
    };
  };
  creado_en: string;
  activo: boolean;
  ultimo_acceso?: string;
}

interface PortalesGridProps {
  portales: Portal[];
  onNewClick: () => void;
}

export const PortalesGrid: React.FC<PortalesGridProps> = ({
  portales = [],
  onNewClick
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [portalStates, setPortalStates] = useState<Record<number, boolean>>({});
  const [linkCopied, setLinkCopied] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<Record<number, boolean>>({});
  
  // Inicializar los estados de los portales
  useEffect(() => {
    const initialStates = portales.reduce((acc, portal) => ({
      ...acc,
      [portal.id]: portal.activo
    }), {});
    setPortalStates(initialStates);
  }, [portales]);
  
  // Función para cambiar el estado activo/inactivo de un portal
  const togglePortalState = async (e: React.MouseEvent, portalId: number) => {
    // Prevenir que se abra el portal al hacer click en este botón
    e.stopPropagation();
    
    try {
      setIsLoading(prev => ({ ...prev, [portalId]: true }));
      
      const newState = !portalStates[portalId];
      
      const response = await fetch('/api/portales/toggle-active', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          id: portalId, 
          activo: newState 
        }),
      });
      
      if (response.ok) {
        setPortalStates(prev => ({
          ...prev,
          [portalId]: newState
        }));
        
        // Mostrar mensaje de éxito en la consola
        console.log(`Portal ${portalId} ${newState ? 'activado' : 'desactivado'} con éxito`);
      } else {
        console.error('Error al cambiar estado del portal:', await response.text());
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(prev => ({ ...prev, [portalId]: false }));
    }
  };
  
  // Función para copiar el enlace de un portal
  const copyPortalLink = async (e: React.MouseEvent, portalId: number) => {
    // Prevenir que se abra el portal al hacer click en este botón
    e.stopPropagation();
    
    try {
      setIsLoading(prev => ({ ...prev, [portalId]: true }));
      
      const response = await fetch(`/api/portales/get-link?id=${portalId}`);
      
      if (response.ok) {
        const data = await response.json();
        
        // Copiar al portapapeles
        await navigator.clipboard.writeText(data.portal_link);
        
        // Mostrar mensaje de éxito
        setLinkCopied(portalId);
        
        // Ocultar mensaje después de 3 segundos
        setTimeout(() => {
          setLinkCopied(null);
        }, 3000);
      } else {
        console.error('Error al obtener enlace:', await response.text());
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(prev => ({ ...prev, [portalId]: false }));
    }
  };

  const filteredPortales = portales.filter(portal => 
    portal.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    portal.instalacion.organizacion.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    portal.instalacion.producto.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handlePortalClick = (uuid: string) => {
    // Asegurarnos de que el UUID es válido antes de abrir la nueva ventana
    if (uuid && uuid.length >= 36) {
      window.open(`/portal-externo/${uuid}`, '_blank');
    } else {
      console.error('UUID inválido:', uuid);
    }
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <Title>Portales</Title>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            className="p-2 rounded-md hover:bg-gray-100"
          >
            {viewMode === 'grid' ? (
              <ListBulletIcon className="h-5 w-5" />
            ) : (
              <Squares2X2Icon className="h-5 w-5" />
            )}
          </button>
          <Button
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            onClick={onNewClick}
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Nuevo Portal
          </Button>
        </div>
      </div>

      <div className="mb-6">
        <input
          type="text"
          placeholder="Buscar por instalación, organización, producto..."
          className="w-full p-2 border rounded-md"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className={`grid ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'} gap-4`}>
        {filteredPortales.map((portal) => (
          <Card 
            key={portal.id} 
            decoration="top" 
            decorationColor="blue"
            className="hover:shadow-lg transition-shadow duration-200"
          >
            <div className="flex justify-between items-start">
              <div>
                <Text className="font-medium">{portal.nombre}</Text>
                <Text className="text-sm text-gray-500">
                  {portal.instalacion.organizacion.nombre} - {portal.instalacion.producto.nombre}
                </Text>
              </div>
              <Badge color={portalStates[portal.id] ? "green" : "red"}>
                {portalStates[portal.id] ? "Activo" : "Inactivo"}
              </Badge>
            </div>

            <div 
              className="mt-3 cursor-pointer" 
              onClick={() => handlePortalClick(portal.uuid)}
            >
              <Text className="text-sm text-gray-500">
                URL: {window.location.origin}/portal-externo/{portal.uuid}
              </Text>
              <Text className="text-sm text-gray-500">
                Último acceso: {portal.ultimo_acceso ? new Date(portal.ultimo_acceso).toLocaleString() : 'Nunca'}
              </Text>
            </div>
            
            {/* Mensaje de copia */}
            {linkCopied === portal.id && (
              <div className="mt-2 mb-2">
                <div className="bg-green-100 border border-green-400 text-green-700 px-3 py-1 rounded text-xs">
                  ¡Enlace copiado al portapapeles!
                </div>
              </div>
            )}
            
            <div className="mt-4 flex justify-end space-x-2">
              <Button
                onClick={(e) => togglePortalState(e, portal.id)}
                size="xs"
                className={`text-white rounded-lg ${
                  portalStates[portal.id] 
                    ? "bg-red-600 hover:bg-red-700" 
                    : "bg-green-600 hover:bg-green-700"
                }`}
                disabled={isLoading[portal.id]}
              >
                {isLoading[portal.id] 
                  ? "Procesando..." 
                  : portalStates[portal.id] 
                    ? "Desactivar" 
                    : "Activar"
                }
              </Button>
              
              <Button
                onClick={(e) => copyPortalLink(e, portal.id)}
                icon={ClipboardDocumentIcon}
                size="xs"
                className="bg-gray-500 text-white hover:bg-gray-600 rounded-lg"
                disabled={isLoading[portal.id]}
              >
                {isLoading[portal.id] ? "Copiando..." : "Copiar enlace"}
              </Button>
              
              <Button
                onClick={() => handlePortalClick(portal.uuid)}
                icon={LinkIcon}
                size="xs"
                className="bg-blue-600 text-white hover:bg-blue-700 rounded-lg"
              >
                Abrir
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};