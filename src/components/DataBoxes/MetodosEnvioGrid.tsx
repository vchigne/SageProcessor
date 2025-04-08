import React, { useState, useEffect } from 'react';
import { Card, Title, Text, Button, Badge } from '@tremor/react';
import { 
  PencilSquareIcon, 
  TrashIcon, 
  PencilIcon,
  LinkIcon,
  ClipboardDocumentIcon
} from '@heroicons/react/24/outline';
import { useRouter } from 'next/router';

interface Casilla {
  id: number;
  nombre_yaml: string;
  email_casilla: string;
  organizacion: string;
  producto: string;
  pais: string;
  is_active?: boolean;
  yaml_info?: {
    nombre: string;
    descripcion: string;
  };
}

interface EmisoresCount {
  casilla_id: number;
  emisores_count: number;
}

interface MetodosEnvioGridProps {
  casillas: Casilla[];
}

export const MetodosEnvioGrid: React.FC<MetodosEnvioGridProps> = ({
  casillas,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [emisoresCounts, setEmisoresCounts] = useState<Record<number, number>>({});
  const [casillaStates, setCasillaStates] = useState<Record<number, boolean>>({});
  const [linkCopied, setLinkCopied] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<Record<number, boolean>>({});
  const router = useRouter();

  useEffect(() => {
    fetchEmisoresCounts();
    
    // Inicializar estados de casillas
    const initialStates = casillas.reduce((acc, casilla) => ({
      ...acc,
      [casilla.id]: casilla.is_active !== false // Si is_active no está definido o es true, lo consideramos activo
    }), {});
    setCasillaStates(initialStates);
  }, [casillas]);

  const fetchEmisoresCounts = async () => {
    try {
      const response = await fetch('/api/metodos-envio');
      if (response.ok) {
        const data: EmisoresCount[] = await response.json();
        const counts = data.reduce((acc, item) => ({
          ...acc,
          [item.casilla_id]: item.emisores_count || 0
        }), {});
        setEmisoresCounts(counts);
      }
    } catch (error) {
      console.error('Error fetching emisores counts:', error);
    }
  };
  
  // Función para cambiar el estado activo/inactivo de una casilla
  const toggleCasillaState = async (casillaId: number) => {
    try {
      setIsLoading(prev => ({ ...prev, [casillaId]: true }));
      
      const newState = !casillaStates[casillaId];
      
      const response = await fetch('/api/casillas-recepcion/toggle-active', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          id: casillaId, 
          is_active: newState 
        }),
      });
      
      if (response.ok) {
        setCasillaStates(prev => ({
          ...prev,
          [casillaId]: newState
        }));
        
        // Mostrar mensaje de éxito en la consola
        console.log(`Casilla ${casillaId} ${newState ? 'activada' : 'desactivada'} con éxito`);
      } else {
        console.error('Error al cambiar estado de casilla:', await response.text());
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(prev => ({ ...prev, [casillaId]: false }));
    }
  };
  
  // Función para copiar el enlace de una casilla
  const copyPortalLink = async (casillaId: number) => {
    try {
      setIsLoading(prev => ({ ...prev, [casillaId]: true }));
      
      const response = await fetch(`/api/casillas-recepcion/get-link?id=${casillaId}`);
      
      if (response.ok) {
        const data = await response.json();
        
        // Copiar al portapapeles
        await navigator.clipboard.writeText(data.portal_link);
        
        // Mostrar mensaje de éxito
        setLinkCopied(casillaId);
        
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
      setIsLoading(prev => ({ ...prev, [casillaId]: false }));
    }
  };

  const filteredCasillas = casillas.filter(casilla => {
    const termino = searchTerm.toLowerCase();
    return (
      casilla.nombre_yaml.toLowerCase().includes(termino) ||
      casilla.organizacion.toLowerCase().includes(termino) ||
      casilla.pais.toLowerCase().includes(termino) ||
      casilla.producto.toLowerCase().includes(termino) ||
      (casilla.yaml_info?.nombre && casilla.yaml_info.nombre.toLowerCase().includes(termino)) ||
      (casilla.yaml_info?.descripcion && casilla.yaml_info.descripcion.toLowerCase().includes(termino))
    );
  });

  const handleConfigureClick = (casilla: Casilla) => {
    router.push(`/admin/metodos-envio/${casilla.id}`);
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <Title>Métodos de Envío por Casilla</Title>
      </div>

      <div className="mb-6">
        <input
          type="text"
          placeholder="Buscar por YAML, organización, país o producto..."
          className="w-full p-2 border rounded-md"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCasillas.map((casilla) => (
          <Card key={casilla.id} className="p-4">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <Text className="text-lg font-semibold">
                    {casilla.yaml_info?.nombre || casilla.nombre_yaml}
                  </Text>
                  <Badge color={casillaStates[casilla.id] ? "green" : "red"}>
                    {casillaStates[casilla.id] ? "Activo" : "Inactivo"}
                  </Badge>
                </div>
                <Text className="text-sm text-gray-600">
                  {casilla.organizacion} - {casilla.pais}
                </Text>
                <Text className="text-sm text-gray-600 mt-1">
                  {casilla.producto}
                </Text>
              </div>
            </div>

            {casilla.yaml_info?.descripcion && (
              <div className="mt-3">
                <Text className="text-sm text-gray-700">
                  {casilla.yaml_info.descripcion}
                </Text>
                <Text className="text-xs text-gray-500 mt-1">
                  Archivo: {casilla.nombre_yaml}
                </Text>
              </div>
            )}
            
            {/* Mensaje de copia */}
            {linkCopied === casilla.id && (
              <div className="mt-2 mb-2">
                <div className="bg-green-100 border border-green-400 text-green-700 px-3 py-1 rounded text-xs">
                  ¡Enlace copiado al portapapeles!
                </div>
              </div>
            )}

            <div className="mt-4 flex justify-end space-x-2">
              <Button
                onClick={() => toggleCasillaState(casilla.id)}
                size="xs"
                className={`text-white rounded-lg ${
                  casillaStates[casilla.id] 
                    ? "bg-red-600 hover:bg-red-700" 
                    : "bg-green-600 hover:bg-green-700"
                }`}
                disabled={isLoading[casilla.id]}
              >
                {isLoading[casilla.id] 
                  ? "Procesando..." 
                  : casillaStates[casilla.id] 
                    ? "Desactivar" 
                    : "Activar"
                }
              </Button>
              
              <Button
                onClick={() => copyPortalLink(casilla.id)}
                icon={ClipboardDocumentIcon}
                size="xs"
                className="bg-gray-500 text-white hover:bg-gray-600 rounded-lg"
                disabled={isLoading[casilla.id]}
              >
                {isLoading[casilla.id] ? "Copiando..." : "Copiar enlace"}
              </Button>
              
              <Button
                onClick={() => handleConfigureClick(casilla)}
                icon={PencilSquareIcon}
                size="xs"
                className="bg-blue-600 text-white hover:bg-blue-700 rounded-lg"
              >
                Gestión ({emisoresCounts[casilla.id] || 0})
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};