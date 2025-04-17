import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import PortalLayout from '@/components/Portal/PortalLayout';
import ErrorModal from '@/components/Portal/ErrorModal';
import { 
  CalendarIcon, 
  DocumentTextIcon, 
  DocumentIcon, 
  ArchiveBoxIcon, 
  ChevronLeftIcon, 
  ChevronRightIcon,
  FunnelIcon,
  AdjustmentsHorizontalIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// Tipos para el historial de ejecuciones
type Ejecucion = {
  id: number;
  uuid: string;
  nombre_yaml: string;
  archivo_datos: string;
  fecha_ejecucion: string;
  estado: 'Éxito' | 'Fallido' | 'Parcial';
  errores_detectados: number;
  warnings_detectados: number;
  casilla_id: number;
  emisor_id: number | null;
  casilla_nombre: string;
  emisor_nombre: string | null;
  tieneLog: boolean;
  tieneYaml: boolean;
  tieneDatos: boolean;
  // Información sobre almacenamiento
  migrado_a_nube: boolean;
  ruta_nube: string | null;
  nube_primaria_id: number | null;
  nube_primaria_nombre: string | null;
};

// Tipo para la información del YAML
type InfoCasilla = {
  casilla_nombre: string;
  emisor_nombre: string | null;
  yaml_nombre: string;
  yaml_descripcion: string | null;
};

type Paginacion = {
  pagina: number;
  items_por_pagina: number;
  total_registros: number;
  total_paginas: number;
};

type Estadisticas = {
  total: number;
  exitosos: number;
  fallidos: number;
  parciales: number;
  porEstado: {
    Éxito: number;
    Fallido: number;
    Parcial: number;
  };
};

type DatosPortal = {
  titulo: string;
  uuid: string;
  casilla_id: number;
  emisor_id: number | null;
};

export default function HistorialPage() {
  const router = useRouter();
  const { uuid } = router.query;
  
  const [ejecuciones, setEjecuciones] = useState<Ejecucion[]>([]);
  const [paginacion, setPaginacion] = useState<Paginacion>({
    pagina: 1,
    items_por_pagina: 10,
    total_registros: 0,
    total_paginas: 0
  });
  const [estadisticas, setEstadisticas] = useState<Estadisticas>({
    total: 0,
    exitosos: 0,
    fallidos: 0,
    parciales: 0,
    porEstado: {
      Éxito: 0,
      Fallido: 0,
      Parcial: 0
    }
  });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState<string>('ultimos90');
  const [itemsPorPagina, setItemsPorPagina] = useState<number>(10);
  
  // Estados para el modal de error
  const [errorModal, setErrorModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    details: '',
    technicalDetails: '',
    errorType: '',
  });
  const [datosPortal, setDatosPortal] = useState<DatosPortal>({
    titulo: 'Historial de ejecuciones',
    uuid: '',
    casilla_id: 0,
    emisor_id: null
  });
  
  const [infoCasilla, setInfoCasilla] = useState<InfoCasilla>({
    casilla_nombre: '',
    emisor_nombre: null,
    yaml_nombre: '',
    yaml_descripcion: null
  });

  // Obtener parámetros de la URL
  useEffect(() => {
    if (!router.isReady) return;
    
    const { uuid, casillaId, casilla_id, emisor_id } = router.query;
    
    // Usamos casillaId (de la URL) o casilla_id (como fallback)
    const idCasilla = casillaId || casilla_id;
    
    console.log('Params en historial:', { uuid, casillaId, casilla_id, emisor_id, idCasilla });
    
    // Validar que tengamos un id de casilla válido
    if (!idCasilla || idCasilla === 'undefined') {
      console.error('ID de casilla no válido en la URL:', idCasilla);
      return;
    }
    
    // Extraer datos del localStorage para obtener el título
    try {
      const datosLocalStorage = localStorage.getItem(`portal_${uuid}`);
      if (datosLocalStorage) {
        const datos = JSON.parse(datosLocalStorage);
        setDatosPortal({
          titulo: datos.titulo || 'Historial de ejecuciones',
          uuid: uuid as string,
          casilla_id: Number(idCasilla),
          emisor_id: emisor_id && emisor_id !== 'undefined' ? Number(emisor_id) : null
        });
      } else {
        // Si no hay datos en localStorage, usar los de la URL
        setDatosPortal({
          titulo: 'Historial de ejecuciones',
          uuid: uuid as string,
          casilla_id: Number(idCasilla),
          emisor_id: emisor_id && emisor_id !== 'undefined' ? Number(emisor_id) : null
        });
      }
    } catch (error) {
      console.error('Error al obtener datos del portal:', error);
      // En caso de error, usar los datos de la URL
      setDatosPortal({
        titulo: 'Historial de ejecuciones',
        uuid: uuid as string,
        casilla_id: Number(idCasilla),
        emisor_id: emisor_id && emisor_id !== 'undefined' ? Number(emisor_id) : null
      });
    }
  }, [router.isReady, router.query]);
  
  // Cargar historial cuando los datos del portal estén disponibles
  useEffect(() => {
    if (datosPortal.casilla_id) {
      cargarHistorial(1);
      cargarInfoCasilla();
    }
  }, [datosPortal.casilla_id]);
  
  // Función para cargar la información de la casilla y el YAML
  const cargarInfoCasilla = async () => {
    if (!datosPortal.casilla_id) return;
    
    try {
      let url = `/api/portales/info-casilla?casilla_id=${datosPortal.casilla_id}`;
      
      if (datosPortal.emisor_id) {
        url += `&emisor_id=${datosPortal.emisor_id}`;
      }
      
      const response = await fetch(url);
      
      if (!response.ok) {
        console.error('Error al cargar información de la casilla:', response.status);
        return;
      }
      
      const data = await response.json();
      setInfoCasilla(data);
    } catch (error) {
      console.error('Error al obtener información de la casilla:', error);
    }
  };

  // Función para aplicar un período predefinido
  const aplicarPeriodoPredefinido = (periodo: string) => {
    const hoy = new Date();
    let desde = new Date();
    let hasta = new Date();
    
    // Configuramos la fecha "hasta" para que termine al final del día
    hasta.setHours(23, 59, 59, 999);
    
    switch (periodo) {
      case 'hoy':
        // Solo el día de hoy (desde el inicio del día actual)
        desde = new Date(hoy);
        desde.setHours(0, 0, 0, 0);
        break;
      case 'ayer':
        // Solo el día de ayer
        desde = new Date(hoy);
        desde.setDate(desde.getDate() - 1);
        desde.setHours(0, 0, 0, 0);
        
        hasta = new Date(hoy);
        hasta.setDate(hasta.getDate() - 1);
        hasta.setHours(23, 59, 59, 999);
        break;
      case 'ultimaSemana':
        // Últimos 7 días
        desde.setDate(desde.getDate() - 7);
        break;
      case 'ultimoMes':
        // Últimos 30 días
        desde.setDate(desde.getDate() - 30);
        break;
      case 'ultimos90':
      default:
        // Últimos 90 días (predeterminado)
        desde.setDate(desde.getDate() - 90);
        break;
    }
    
    setFechaDesde(desde.toISOString().split('T')[0]);
    setFechaHasta(hasta.toISOString().split('T')[0]);
    setPeriodoSeleccionado(periodo);
    
    // Aplicar los filtros automáticamente
    cargarHistorial(1);
  };

  // Función para cargar el historial
  const cargarHistorial = async (pagina: number) => {
    if (!router.isReady) return;
    
    // Usar los datos de datosPortal en lugar de router.query
    // para asegurar que estamos usando valores numéricos y no strings
    if (!datosPortal.casilla_id) {
      console.error('No hay casilla_id en datosPortal');
      return;
    }
    
    setCargando(true);
    setError('');
    
    try {
      console.log('Cargando historial con parámetros:', {
        casilla_id: datosPortal.casilla_id,
        emisor_id: datosPortal.emisor_id,
        pagina: pagina,
        fechaDesde: fechaDesde,
        fechaHasta: fechaHasta,
        itemsPorPagina: itemsPorPagina
      });
      
      // Construir URL con parámetros
      let url = `/api/portales/historial-ejecuciones?casilla_id=${datosPortal.casilla_id}&pagina=${pagina}&items_por_pagina=${itemsPorPagina}`;
      
      // Añadir emisor_id si está presente
      if (datosPortal.emisor_id) {
        url += `&emisor_id=${datosPortal.emisor_id}`;
      }
      
      // Añadir filtros de fecha si están presentes
      if (fechaDesde) {
        url += `&fecha_desde=${fechaDesde}`;
      }
      
      if (fechaHasta) {
        url += `&fecha_hasta=${fechaHasta}`;
      }
      
      console.log('Consultando historial con URL:', url);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Datos del historial recibidos:', {
        total: data.ejecuciones.length,
        paginacion: data.paginacion,
        estadisticas: data.estadisticas
      });
      
      setEjecuciones(data.ejecuciones);
      setPaginacion(data.paginacion);
      setEstadisticas(data.estadisticas);
    } catch (error) {
      console.error('Error al cargar historial:', error);
      setError('No se pudo cargar el historial de ejecuciones. Intente nuevamente más tarde.');
    } finally {
      setCargando(false);
    }
  };
  

  
  // Manejador de errores para archivos y ZIP
  const manejarErrorArchivo = async (response: Response) => {
    try {
      // Verificar el tipo de contenido antes de intentar parsearlo
      const contentType = response.headers.get('content-type') || '';
      
      // Si la respuesta no es JSON, simplemente mostrar un error genérico
      if (!contentType.includes('application/json')) {
        console.log('Contenido no JSON recibido:', contentType);
        setErrorModal({
          isOpen: true,
          title: 'Error al acceder al archivo',
          message: 'No se pudo acceder al archivo solicitado.',
          details: 'La respuesta del servidor no tiene el formato esperado.',
          technicalDetails: `Tipo de contenido: ${contentType}`,
          errorType: 'error_formato_respuesta',
        });
        return false;
      }
      
      // Solo parsear como JSON si el tipo de contenido es application/json
      const data = await response.json();
      
      // Construir detalles técnicos detallados
      let technicalDetails = '';
      
      // Agregar ruta del archivo y directorio
      if (data.rutaArchivo) {
        technicalDetails += `Ruta del archivo: ${data.rutaArchivo}\n`;
      }
      
      if (data.rutaDirectorio) {
        technicalDetails += `Directorio: ${data.rutaDirectorio}\n`;
      }
      
      // Agregar información del proveedor de nube
      if (data.proveedorNube) {
        technicalDetails += `Proveedor de nube: ${data.proveedorNube}\n`;
      }
      
      if (data.rutaNube) {
        technicalDetails += `Ruta en la nube: ${data.rutaNube}\n`;
      }
      
      // Agregar detalles del error técnico
      if (data.errorTecnico) {
        technicalDetails += `Error técnico: ${data.errorTecnico}\n`;
      }
      
      // Agregar detalles de conexión si están disponibles
      if (data.detallesConexion) {
        technicalDetails += `Detalles de conexión: ${JSON.stringify(data.detallesConexion, null, 2)}\n`;
      }
      
      setErrorModal({
        isOpen: true,
        title: 'Error al acceder al archivo',
        message: data.error || 'No se pudo acceder al archivo solicitado.',
        details: data.details || 'El archivo pudo haber sido eliminado o movido a otro almacenamiento.',
        technicalDetails: technicalDetails || data.errorTecnico || data.rutaArchivo || data.rutaDirectorio || '',
        errorType: data.tipo || 'error_desconocido',
      });
      return false;
    } catch (error) {
      console.error('Error al procesar respuesta de error:', error);
      setErrorModal({
        isOpen: true,
        title: 'Error inesperado',
        message: 'Ocurrió un error al procesar la respuesta del servidor.',
        details: 'Por favor intente nuevamente más tarde.',
        technicalDetails: error instanceof Error ? error.message : 'Error desconocido',
        errorType: 'error_interno',
      });
      return false;
    }
  };

  // Función para descargar ZIP con manejo de errores
  const descargarZIP = async (uuid: string) => {
    try {
      // Forzar descarga directa del archivo sin intentar abrirlo en el navegador
      // Eliminamos la verificación con HEAD y simplemente descargamos el archivo directamente
      const url = `/api/portales/historial-ejecuciones/${uuid}/zip`;
      
      // Crear un elemento <a> invisible para forzar la descarga
      const link = document.createElement('a');
      link.href = url;
      link.download = `ejecucion_${uuid}.zip`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      return true;
    } catch (error) {
      console.error('Error al verificar ZIP:', error);
      
      // Construir detalles técnicos detallados
      let technicalDetails = '';
      
      if (error instanceof Error) {
        technicalDetails += `Error: ${error.message}\n`;
        if (error.stack) {
          technicalDetails += `Stack: ${error.stack}\n`;
        }
      }
      
      // Si hay información adicional en el error, intentar extraerla
      if (error.config) {
        technicalDetails += `URL: ${error.config.url}\n`;
        technicalDetails += `Método: ${error.config.method}\n`;
      }
      
      setErrorModal({
        isOpen: true,
        title: 'Error al descargar archivo ZIP',
        message: 'No se pudo descargar el archivo ZIP de la ejecución.',
        details: 'Ocurrió un error de comunicación con el servidor.',
        technicalDetails: technicalDetails || (error instanceof Error ? error.message : 'Error desconocido'),
        errorType: 'error_comunicacion',
      });
      return false;
    }
  };

  // Función para abrir archivo en nueva pestaña con manejo de errores
  const abrirArchivo = async (uuid: string, tipo: 'log' | 'yaml' | 'datos') => {
    try {
      // Forzar descarga directa del archivo sin intentar abrirlo en el navegador
      // Eliminamos la verificación con HEAD y simplemente descargamos el archivo directamente
      const url = `/api/portales/historial-ejecuciones/${uuid}/archivo/${tipo}`;
      
      // Crear un elemento <a> invisible para forzar la descarga
      const link = document.createElement('a');
      link.href = url;
      link.download = tipo === 'log' ? 'output.log' : tipo === 'yaml' ? 'configuracion.yaml' : 'datos.txt';
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      return true;
    } catch (error) {
      console.error(`Error al verificar archivo ${tipo}:`, error);
      
      // Construir detalles técnicos detallados
      let technicalDetails = '';
      
      if (error instanceof Error) {
        technicalDetails += `Error: ${error.message}\n`;
        if (error.stack) {
          technicalDetails += `Stack: ${error.stack}\n`;
        }
      }
      
      // Si hay información adicional en el error, intentar extraerla
      if (error.config) {
        technicalDetails += `URL: ${error.config.url}\n`;
        technicalDetails += `Método: ${error.config.method}\n`;
      }
      
      technicalDetails += `Tipo de archivo solicitado: ${tipo}\n`;
      technicalDetails += `UUID de ejecución: ${uuid}\n`;
      
      setErrorModal({
        isOpen: true,
        title: `Error al abrir archivo ${tipo}`,
        message: `No se pudo abrir el archivo ${tipo} de la ejecución.`,
        details: 'Ocurrió un error de comunicación con el servidor.',
        technicalDetails: technicalDetails || (error instanceof Error ? error.message : 'Error desconocido'),
        errorType: 'error_comunicacion',
      });
      return false;
    }
  };

  // Función para formatear fecha
  const formatearFecha = (fechaStr: string) => {
    try {
      const fecha = new Date(fechaStr);
      return format(fecha, 'dd/MM/yyyy HH:mm:ss', { locale: es });
    } catch (error) {
      return fechaStr;
    }
  };

  // Función para obtener clase de estado
  const obtenerClaseEstado = (estado: string) => {
    switch (estado) {
      case 'Éxito':
        return 'bg-green-100 text-green-800';
      case 'Fallido':
        return 'bg-red-100 text-red-800';
      case 'Parcial':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Cambiar de página
  const cambiarPagina = (nuevaPagina: number) => {
    if (nuevaPagina < 1 || nuevaPagina > paginacion.total_paginas) return;
    cargarHistorial(nuevaPagina);
  };

  return (
    <PortalLayout title={datosPortal.titulo}>
      <div className="p-4 sm:p-6 w-full h-full">
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center text-blue-600 hover:text-blue-800"
          >
            <ChevronLeftIcon className="h-5 w-5 mr-1" />
            Volver al portal
          </button>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            Historial de ejecuciones
            {datosPortal.emisor_id && <span className="text-lg font-normal ml-2 text-gray-600">(Emisor específico)</span>}
          </h1>
          
          {/* Información de la casilla y YAML */}
          <div className="mt-2 flex flex-col space-y-1">
            <p className="text-md text-gray-700">
              <span className="font-medium">Casilla:</span> {infoCasilla.casilla_nombre || (ejecuciones.length > 0 ? ejecuciones[0].casilla_nombre : 'No disponible')}
            </p>
            {infoCasilla.emisor_nombre && (
              <p className="text-md text-gray-700">
                <span className="font-medium">Emisor:</span> {infoCasilla.emisor_nombre}
              </p>
            )}
            {infoCasilla.yaml_nombre && (
              <p className="text-md text-gray-700">
                <span className="font-medium">YAML:</span> {infoCasilla.yaml_nombre}
              </p>
            )}
            {infoCasilla.yaml_descripcion && (
              <p className="text-md text-gray-700">
                <span className="font-medium">Descripción:</span> {infoCasilla.yaml_descripcion}
              </p>
            )}
          </div>
          
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg bg-white shadow p-4">
              <p className="text-sm font-medium text-gray-500">Total ejecuciones</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900">{estadisticas.total}</p>
            </div>
            <div className="rounded-lg bg-white shadow p-4">
              <p className="text-sm font-medium text-gray-500">Exitosas</p>
              <p className="mt-1 text-2xl font-semibold text-green-600">{estadisticas.exitosos}</p>
            </div>
            <div className="rounded-lg bg-white shadow p-4">
              <p className="text-sm font-medium text-gray-500">Fallidas</p>
              <p className="mt-1 text-2xl font-semibold text-red-600">{estadisticas.fallidos}</p>
            </div>
            <div className="rounded-lg bg-white shadow p-4">
              <p className="text-sm font-medium text-gray-500">Parciales</p>
              <p className="mt-1 text-2xl font-semibold text-yellow-600">{estadisticas.parciales}</p>
            </div>
          </div>
          
          {/* Botón para mostrar/ocultar filtros */}
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => setMostrarFiltros(!mostrarFiltros)}
              className="flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <FunnelIcon className="h-4 w-4 mr-1" />
              {mostrarFiltros ? 'Ocultar filtros' : 'Mostrar filtros'}
            </button>
          </div>
          
          {/* Panel de filtros */}
          {mostrarFiltros && (
            <div className="mt-3 p-4 bg-gray-50 rounded-md border border-gray-200">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* Períodos predefinidos */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-3">Períodos rápidos</h3>
                  <div className="relative">
                    <select
                      value={periodoSeleccionado}
                      onChange={(e) => aplicarPeriodoPredefinido(e.target.value)}
                      className="block w-full bg-white border border-gray-300 rounded-md py-2 pl-3 pr-10 text-base focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    >
                      <option value="">Seleccionar período...</option>
                      <option value="hoy">Hoy</option>
                      <option value="ayer">Ayer</option>
                      <option value="ultimaSemana">Última semana</option>
                      <option value="ultimoMes">Último mes</option>
                      <option value="ultimos90">Últimos 90 días</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                </div>
                
                {/* Selector personalizado de fechas */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-3">Rango personalizado</h3>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="fecha-desde" className="block text-sm font-medium text-gray-700 mb-1">
                        Desde
                      </label>
                      <input
                        type="date"
                        id="fecha-desde"
                        value={fechaDesde}
                        onChange={(e) => {
                          setFechaDesde(e.target.value);
                          // Quitar selección de períodos predefinidos
                          setPeriodoSeleccionado('');
                          // Aplicar el filtro automáticamente, pero con un pequeño retardo
                          setTimeout(() => cargarHistorial(1), 100);
                        }}
                        className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label htmlFor="fecha-hasta" className="block text-sm font-medium text-gray-700 mb-1">
                        Hasta
                      </label>
                      <input
                        type="date"
                        id="fecha-hasta"
                        value={fechaHasta}
                        onChange={(e) => {
                          setFechaHasta(e.target.value);
                          // Quitar selección de períodos predefinidos
                          setPeriodoSeleccionado('');
                          // Aplicar el filtro automáticamente, pero con un pequeño retardo
                          setTimeout(() => cargarHistorial(1), 100);
                        }}
                        className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                      />
                    </div>
                  </div>
                </div>
                
                {/* Resultados por página */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-3">Resultados por página</h3>
                  <div className="relative">
                    <select
                      value={itemsPorPagina}
                      onChange={(e) => {
                        setItemsPorPagina(Number(e.target.value));
                        // Aplicar inmediatamente el cambio
                        setTimeout(() => cargarHistorial(1), 0);
                      }}
                      className="block w-full bg-white border border-gray-300 rounded-md py-2 pl-3 pr-10 text-base focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    >
                      <option value="10">10 resultados</option>
                      <option value="20">20 resultados</option>
                      <option value="50">50 resultados</option>
                      <option value="100">100 resultados</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {cargando ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        ) : ejecuciones.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 text-gray-700 px-4 py-10 rounded text-center">
            No se encontraron ejecuciones para esta casilla en los últimos 90 días.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto lg:overflow-visible max-w-full rounded-lg shadow" style={{ scrollbarWidth: 'thin' }}>
              <table className="min-w-full table-auto divide-y divide-gray-200 bg-white">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Fecha
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Estado
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Errores
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Advertencias
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Almacenamiento
                    </th>
                    <th scope="col" className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {ejecuciones.map((ejecucion) => (
                    <tr key={ejecucion.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center">
                          <CalendarIcon className="h-4 w-4 text-gray-400 mr-2" />
                          {formatearFecha(ejecucion.fecha_ejecucion)}
                        </div>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${obtenerClaseEstado(ejecucion.estado)}`}>
                          {ejecucion.estado}
                        </span>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-red-600 font-medium">
                        {ejecucion.errores_detectados || 0}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-yellow-600 font-medium">
                        {ejecucion.warnings_detectados || 0}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm">
                        {ejecucion.migrado_a_nube ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-blue-50 text-blue-800">
                            {ejecucion.nube_primaria_nombre || 'Nube'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-gray-50 text-gray-800">
                            Local
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 text-center">
                        <div className="flex justify-center space-x-2">
                          {ejecucion.tieneLog && (
                            <button 
                              className="text-blue-600 hover:text-blue-900" 
                              title="Ver log"
                              onClick={async () => await abrirArchivo(ejecucion.uuid, 'log')}
                            >
                              <DocumentTextIcon className="h-5 w-5" />
                            </button>
                          )}
                          {ejecucion.tieneYaml && (
                            <button 
                              className="text-green-600 hover:text-green-900" 
                              title="Ver YAML"
                              onClick={async () => await abrirArchivo(ejecucion.uuid, 'yaml')}
                            >
                              <DocumentIcon className="h-5 w-5" />
                            </button>
                          )}
                          {ejecucion.tieneDatos && (
                            <button 
                              className="text-purple-600 hover:text-purple-900" 
                              title="Ver archivo de datos"
                              onClick={async () => await abrirArchivo(ejecucion.uuid, 'datos')}
                            >
                              <ArchiveBoxIcon className="h-5 w-5" />
                            </button>
                          )}
                          <button 
                            className="text-gray-600 hover:text-gray-900" 
                            title="Descargar todos los archivos (ZIP)"
                            onClick={async () => await descargarZIP(ejecucion.uuid)}
                          >
                            <ArrowDownTrayIcon className="h-5 w-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-gray-500">
                Mostrando <span className="font-medium">{(paginacion.pagina - 1) * paginacion.items_por_pagina + 1}</span> a <span className="font-medium">{Math.min(paginacion.pagina * paginacion.items_por_pagina, paginacion.total_registros)}</span> de <span className="font-medium">{paginacion.total_registros}</span> resultados
              </div>
              <div className="flex space-x-1">
                <button
                  onClick={() => cambiarPagina(paginacion.pagina - 1)}
                  disabled={paginacion.pagina === 1}
                  className={`relative inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md ${
                    paginacion.pagina === 1
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <ChevronLeftIcon className="h-4 w-4" />
                </button>
                {[...Array(Math.min(paginacion.total_paginas, 5))].map((_, i) => {
                  // Lógica para mostrar los números de página cercanos a la página actual
                  let pageNum;
                  if (paginacion.total_paginas <= 5) {
                    pageNum = i + 1;
                  } else if (paginacion.pagina <= 3) {
                    pageNum = i + 1;
                  } else if (paginacion.pagina >= paginacion.total_paginas - 2) {
                    pageNum = paginacion.total_paginas - 4 + i;
                  } else {
                    pageNum = paginacion.pagina - 2 + i;
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => cambiarPagina(pageNum)}
                      className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium rounded-md ${
                        paginacion.pagina === pageNum
                          ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                          : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  onClick={() => cambiarPagina(paginacion.pagina + 1)}
                  disabled={paginacion.pagina === paginacion.total_paginas}
                  className={`relative inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md ${
                    paginacion.pagina === paginacion.total_paginas
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <ChevronRightIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
      
      {/* Modal de error */}
      <ErrorModal
        isOpen={errorModal.isOpen}
        onClose={() => setErrorModal({...errorModal, isOpen: false})}
        title={errorModal.title}
        message={errorModal.message}
        details={errorModal.details}
        technicalDetails={errorModal.technicalDetails}
        errorType={errorModal.errorType}
        showTechnicalDetails={false}
      />
    </PortalLayout>
  );
}