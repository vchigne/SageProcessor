import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Title, Text, Card, Button, TextInput } from '@tremor/react';
import { PlusIcon, ArrowLeftIcon, MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { ConfigurarMetodosModal } from '@/components/DataBoxes/ConfigurarMetodosModal';

interface MetodoEnvio {
  id: number;
  emisor_id: number;
  emisor_nombre: string;
  metodo_envio: string;
  parametros: Record<string, any>;
}

export default function CasillaMetodosEnvio() {
  const router = useRouter();
  const { casilla_id } = router.query;
  const [casilla, setCasilla] = useState<any>(null);
  const [metodosEnvio, setMetodosEnvio] = useState<MetodoEnvio[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEmisor, setSelectedEmisor] = useState<number | null>(null);
  const [filtroEmisor, setFiltroEmisor] = useState('');
  const [emisoresFiltrados, setEmisoresFiltrados] = useState<Record<number, { nombre: string; metodos: MetodoEnvio[] }>>({});

  useEffect(() => {
    if (casilla_id) {
      fetchData();
    }
  }, [casilla_id]);
  
  // Filtrar emisores cuando cambia el filtro
  useEffect(() => {
    if (metodosEnvio.length === 0) return;
    
    // Agrupar métodos por emisor
    const todosEmisores = metodosEnvio.reduce((acc, metodo) => {
      if (!acc[metodo.emisor_id]) {
        acc[metodo.emisor_id] = {
          nombre: metodo.emisor_nombre,
          metodos: []
        };
      }
      acc[metodo.emisor_id].metodos.push(metodo);
      return acc;
    }, {} as Record<number, { nombre: string; metodos: MetodoEnvio[] }>);
    
    if (filtroEmisor === '') {
      // Si no hay filtro, mostrar todos los emisores
      setEmisoresFiltrados(todosEmisores);
    } else {
      // Filtrar emisores según el texto ingresado
      const filtrados = Object.entries(todosEmisores).reduce((acc, [id, data]) => {
        if (data.nombre.toLowerCase().includes(filtroEmisor.toLowerCase())) {
          acc[Number(id)] = data;
        }
        return acc;
      }, {} as Record<number, { nombre: string; metodos: MetodoEnvio[] }>);
      
      setEmisoresFiltrados(filtrados);
    }
  }, [metodosEnvio, filtroEmisor]);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Obtener información de la casilla y sus métodos de envío en paralelo
      const [casillaRes, metodosRes] = await Promise.all([
        fetch(`/api/casillas-recepcion/${casilla_id}`),
        fetch(`/api/metodos-envio?casilla_id=${casilla_id}`)
      ]);

      if (casillaRes.ok) {
        const casillaData = await casillaRes.json();
        setCasilla(casillaData);
      }

      if (metodosRes.ok) {
        const metodosData = await metodosRes.json();
        setMetodosEnvio(metodosData);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Cargando...</div>;
  }

  if (!casilla) {
    return <div>Casilla no encontrada</div>;
  }

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedEmisor(null);
    fetchData(); // Refrescar los datos después de cerrar el modal
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <div className="flex items-center gap-4 mb-2">
            <Button
              icon={ArrowLeftIcon}
              variant="secondary"
              onClick={() => router.push('/admin/data-boxes')}
            >
              Regresar
            </Button>
            <Title>Métodos de Envío - {casilla.nombre_yaml}</Title>
          </div>
          <Text className="text-gray-500">
            {casilla.organizacion} - {casilla.producto} ({casilla.pais})
          </Text>
          {casilla.email_casilla && (
            <Text className="text-gray-500">
              Email: {casilla.email_casilla}
            </Text>
          )}
        </div>
        <Button
          icon={PlusIcon}
          onClick={() => {
            setSelectedEmisor(null);
            setIsModalOpen(true);
          }}
        >
          Agregar Emisor
        </Button>
      </div>
      
      {/* Barra de búsqueda */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <Text className="text-sm text-gray-500">
            {Object.keys(emisoresFiltrados).length} emisores
            {filtroEmisor && ` encontrados con "${filtroEmisor}"`}
          </Text>
        </div>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
          </div>
          <TextInput
            placeholder="Buscar emisor..."
            value={filtroEmisor}
            onChange={(e) => setFiltroEmisor(e.target.value)}
            className="pl-10"
          />
          {filtroEmisor && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              <button 
                onClick={() => setFiltroEmisor('')} 
                className="text-gray-400 hover:text-gray-500"
              >
                <XMarkIcon className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {Object.keys(emisoresFiltrados).length === 0 && filtroEmisor ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <Text className="text-gray-500">No se encontraron emisores con el filtro "{filtroEmisor}"</Text>
          </div>
        ) : (
          Object.entries(emisoresFiltrados).map(([emisorId, { nombre, metodos }]) => (
            <Card key={emisorId} className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <Text className="font-medium">{nombre}</Text>
                  {/* Información de responsable */}
                  {metodos.length > 0 && (metodos[0].responsable_nombre || metodos[0].responsable) && (
                    <div className="text-sm mb-3 pb-2 border-b">
                      <div className="mb-1">
                        <span className="font-medium">Responsable:</span> {metodos[0].responsable_nombre || metodos[0].responsable}
                      </div>
                      {metodos[0].responsable_email && (
                        <div className="text-xs text-gray-600">
                          <span className="font-medium">Email:</span> {metodos[0].responsable_email}
                        </div>
                      )}
                      {metodos[0].responsable_telefono && (
                        <div className="text-xs text-gray-600">
                          <span className="font-medium">Teléfono:</span> {metodos[0].responsable_telefono}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Información de frecuencia */}
                  {metodos.length > 0 && (metodos[0].configuracion_frecuencia || metodos[0].frecuencia) && (
                    <div className="text-sm mb-3 pb-2 border-b">
                      {metodos[0].configuracion_frecuencia ? (
                        <>
                          <div className="mb-1">
                            <span className="font-medium">Frecuencia:</span> {
                              (() => {
                                const tipo = metodos[0].configuracion_frecuencia.tipo;
                                switch(tipo) {
                                  case 'diario': return 'Diario';
                                  case 'semanal': return 'Semanal';
                                  case 'quincenal': return 'Quincenal';
                                  case 'mensual': return 'Mensual';
                                  case 'fin_de_mes': return 'Fin de mes';
                                  case 'hasta_dia_n': return 'Hasta el día N del mes';
                                  case 'bajo_demanda': return 'Bajo demanda';
                                  default: return tipo;
                                }
                              })()
                            }
                          </div>
                          <div className="text-xs text-gray-600">
                            <span className="font-medium">Hora:</span> {metodos[0].configuracion_frecuencia.hora || '09:00'}
                          </div>
                          
                          {/* Mostrar días de la semana si es frecuencia semanal */}
                          {metodos[0].configuracion_frecuencia.dias_semana && metodos[0].configuracion_frecuencia.dias_semana.length > 0 && (
                            <div className="text-xs text-gray-600">
                              <span className="font-medium">Días:</span> {metodos[0].configuracion_frecuencia.dias_semana.join(', ')}
                            </div>
                          )}
                          
                          {/* Mostrar días del mes si es frecuencia mensual */}
                          {metodos[0].configuracion_frecuencia.dias_mes && metodos[0].configuracion_frecuencia.dias_mes.length > 0 && (
                            <div className="text-xs text-gray-600">
                              <span className="font-medium">Días del mes:</span> {metodos[0].configuracion_frecuencia.dias_mes.join(', ')}
                            </div>
                          )}
                          
                          {/* Mostrar día límite si es frecuencia hasta_dia_n */}
                          {metodos[0].configuracion_frecuencia.tipo === 'hasta_dia_n' && metodos[0].configuracion_frecuencia.dia_limite && (
                            <div className="text-xs text-gray-600">
                              <span className="font-medium">Día límite:</span> {metodos[0].configuracion_frecuencia.dia_limite}
                            </div>
                          )}
                        </>
                      ) : (
                        <div>
                          <span className="font-medium">Frecuencia:</span> {metodos[0].frecuencia}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="mt-2 space-y-2">
                    {/* Agrupar métodos por tipo para evitar duplicaciones */}
                    {(() => {
                      // Crear un objeto para agrupar métodos por tipo
                      const metodosPorTipo = metodos.reduce((acc, metodo) => {
                        if (!acc[metodo.metodo_envio]) {
                          acc[metodo.metodo_envio] = [];
                        }
                        acc[metodo.metodo_envio].push(metodo);
                        return acc;
                      }, {});
                      
                      // Renderizar cada tipo de método una sola vez
                      return Object.entries(metodosPorTipo).map(([tipo, metodosList]) => {
                        // Obtener primer método de este tipo (para configuración general)
                        const metodo = metodosList[0];
                        
                        return (
                          <div key={tipo} className="text-sm">
                            {/* Renderizar tipos con información específica */}
                            {tipo === 'SFTP tipo 2' ? (
                              <div>
                                <span className="font-medium">SFTP propio:</span>
                                <div className="ml-4 text-gray-500">
                                  <div>Subdirectorio: {metodo.emisor_sftp_subdirectorio || '/'}</div>
                                </div>
                              </div>
                            ) : tipo === 'cloud' ? (
                              <div>
                                <span className="font-medium">Bucket en nube:</span>
                                <div className="ml-4 text-gray-500">
                                  <div>Prefijo: {metodo.emisor_bucket_prefijo || '/'}</div>
                                </div>
                              </div>
                            ) : tipo === 'local' ? (
                              <div>
                                <span className="font-medium">Local:</span>
                                <div className="ml-4 text-gray-500">
                                  <div>Directorio: inputs_{casilla.id}_{emisorId}</div>
                                  {metodo.emisor_sftp_subdirectorio && (
                                    <div>Subdirectorio SFTP: {metodo.emisor_sftp_subdirectorio}</div>
                                  )}
                                  {metodo.emisor_bucket_prefijo && (
                                    <div>Prefijo bucket: {metodo.emisor_bucket_prefijo}</div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div>
                                <span className="font-medium">{tipo}:</span>
                                <div className="ml-4 text-gray-500">
                                  {Object.entries(metodo.parametros || {}).map(([key, value]) => (
                                    <div key={key}>
                                      {key}: {value}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSelectedEmisor(Number(emisorId));
                    setIsModalOpen(true);
                  }}
                >
                  Editar Métodos
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>

      <ConfigurarMetodosModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        casilla={casilla}
        emisorId={selectedEmisor}
      />
    </div>
  );
}