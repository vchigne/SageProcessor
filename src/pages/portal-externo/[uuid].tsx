import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { toast } from 'react-toastify';
import {
  Card,
  Title,
  Text,
  Button,
  ProgressCircle,
  Badge,
  Tab,
  TabList,
  TabGroup,
  Grid,
  Col,
  Metric,
  Flex,
  Table,
  TableHead,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
  Accordion,
  AccordionHeader,
  AccordionBody,
  Divider
} from "@tremor/react";
import { 
  ArrowUpTrayIcon, 
  CalendarIcon,
  Squares2X2Icon, 
  ListBulletIcon, 
  ChevronDownIcon, 
  ChevronUpIcon, 
  ExclamationCircleIcon,
  InformationCircleIcon,
  CheckCircleIcon,
  ClockIcon,
  UsersIcon,
  BellAlertIcon,
  DocumentIcon,
  PencilSquareIcon
} from '@heroicons/react/24/outline';
import * as yaml from 'yaml';
import PortalLayout from '@/components/Portal/PortalLayout';
import { FileUploadModal } from '@/components/FileUpload/FileUploadModal';
import SuscripcionesButton from '../../components/Suscripciones/SuscripcionesButton';

interface Responsable {
  id: number;
  nombre: string;
  email: string;
  telefono?: string;
  frecuencia?: string;
  frecuencia_tipo?: string;
  frecuencia_hora?: string;
  frecuencia_dias_semana?: string | null;
  frecuencia_dias_mes?: string | null;
  configuracion_frecuencia_completa?: any;
  estado_retraso?: boolean;
  tiempo_retraso?: number;
  ultimo_envio?: string;
}

interface Emisor {
  id: number;
  nombre: string;
  metodos_envio: string[];
  responsables?: Responsable[];
  historial_envios?: any[];
}

interface DataBox {
  id: number;
  instalacion: {
    id: number;
    organizacion: {
      nombre: string;
    };
    producto: {
      nombre: string;
    };
    pais: {
      nombre: string;
    };
  };
  nombre_yaml: string;
  archivo_yaml_nombre?: string;
  archivo_yaml_contenido?: string;
  archivo_yaml_descripcion?: string;
  emisores: Emisor[];
  nombre?: string;
  descripcion?: string;
  nombreCompleto?: string;
}

// Función para formatear fechas de manera amigable
const formatearFechaAmigable = (fecha: string): string => {
  const fechaObj = new Date(fecha);
  const ahora = new Date();
  
  // Verificar que la fecha es válida
  if (isNaN(fechaObj.getTime())) {
    return "Fecha inválida";
  }
  
  // Convertir a fecha sin tiempo para comparar días
  const fechaSinTiempo = new Date(fechaObj.getFullYear(), fechaObj.getMonth(), fechaObj.getDate());
  const ahoraSinTiempo = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  
  // Calcular diferencia en días
  const diferenciaTiempo = ahoraSinTiempo.getTime() - fechaSinTiempo.getTime();
  const diferenciaDias = Math.floor(diferenciaTiempo / (1000 * 3600 * 24));
  
  // Formato de hora
  const hora = fechaObj.getHours().toString().padStart(2, '0');
  const minutos = fechaObj.getMinutes().toString().padStart(2, '0');
  const horaFormateada = `${hora}:${minutos}`;
  
  // Determinar el formato según la diferencia de días
  if (diferenciaDias === 0) {
    return `Hoy, ${horaFormateada}`;
  } else if (diferenciaDias === 1) {
    return `Ayer, ${horaFormateada}`;
  } else if (diferenciaDias < 7) {
    return `Hace ${diferenciaDias} días, ${horaFormateada}`;
  } else if (diferenciaDias < 30) {
    const semanas = Math.floor(diferenciaDias / 7);
    return `Hace ${semanas} ${semanas === 1 ? 'semana' : 'semanas'}`;
  } else if (diferenciaDias < 365) {
    const meses = Math.floor(diferenciaDias / 30);
    return `Hace ${meses} ${meses === 1 ? 'mes' : 'meses'}`;
  } else {
    const años = Math.floor(diferenciaDias / 365);
    return `Hace ${años} ${años === 1 ? 'año' : 'años'}`;
  }
};

// Función para formatear el tiempo de retraso de manera amigable
const formatearTiempoRetraso = (horasRetraso: number): string => {
  if (!horasRetraso || horasRetraso <= 0) {
    return "";
  }
  
  // Convertir horas a días si es más de 24 horas
  if (horasRetraso >= 24) {
    const dias = Math.floor(horasRetraso / 24);
    // Si es más de 30 días, mostrar en meses
    if (dias >= 30) {
      const meses = Math.floor(dias / 30);
      return `${meses} ${meses === 1 ? 'mes' : 'meses'}`;
    }
    // Si es más de 7 días, mostrar en semanas
    if (dias >= 7) {
      const semanas = Math.floor(dias / 7);
      return `${semanas} ${semanas === 1 ? 'semana' : 'semanas'}`;
    }
    return `${dias} ${dias === 1 ? 'día' : 'días'}`;
  }
  
  // Menos de 24 horas, mostrar en horas
  return `${Math.floor(horasRetraso)} ${Math.floor(horasRetraso) === 1 ? 'hora' : 'horas'}`;
};

export default function PortalExternoPage() {
  const router = useRouter();
  const { uuid } = router.query;
  const [loading, setLoading] = useState(true);
  const [casillas, setCasillas] = useState<DataBox[]>([]);
  const [selectedCasilla, setSelectedCasilla] = useState<DataBox | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [viewType, setViewType] = useState<'card' | 'list'>('card');
  const [activeSection, setActiveSection] = useState('dashboard');
  const [expandedCasillas, setExpandedCasillas] = useState<{[key: string]: boolean}>({});
  const [instalacionId, setInstalacionId] = useState<number>(0);
  const [instalacionInfo, setInstalacionInfo] = useState<any>(null);
  const [portalInactivo, setPortalInactivo] = useState(false);
  const [portalNoEncontrado, setPortalNoEncontrado] = useState(false);

  useEffect(() => {
    if (uuid && typeof uuid === 'string') {
      verificarEstadoPortal();
    }
  }, [uuid]);
  
  // Verifica si el portal está activo antes de cargar los datos
  const verificarEstadoPortal = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/portales/${uuid}/acceso`);
      
      if (response.status === 404) {
        setPortalNoEncontrado(true);
        setLoading(false);
        return;
      }
      
      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.error === 'Portal inactivo') {
          setPortalInactivo(true);
        } else {
          console.error('Error al verificar portal:', errorData.error);
        }
        setLoading(false);
        return;
      }
      
      // Si llegamos aquí, el portal está activo
      // Ya registramos el acceso (porque la API ya lo hace)
      const portalData = await response.json();
      console.log("Datos del portal:", portalData);
      
      // Continuar cargando los datos del portal
      fetchPortalData();
    } catch (error) {
      console.error('Error verificando estado del portal:', error);
      setLoading(false);
    }
  };

  const fetchPortalData = async () => {
    try {
      const response = await fetch(`/api/portales/${uuid}/casillas`);
      if (response.ok) {
        const casillasData = await response.json();
        console.log("Datos recibidos:", casillasData);
        
        // Debug: Inspeccionar estructura de responsables y emisores
        if (casillasData && casillasData.length > 0) {
          console.log("DEBUG - ESTRUCTURA DE DATOS:");
          
          // Mostrar estructura de una casilla completa
          console.log("Casilla (ejemplo):", JSON.stringify(casillasData[0], null, 2));
          
          // Buscar casillas que tengan emisores con responsables
          const casillaConResponsables = casillasData.find(c => 
            c.emisores && c.emisores.length > 0 && 
            c.emisores.some(e => e.responsables && e.responsables.length > 0)
          );
          
          if (casillaConResponsables) {
            console.log("Casilla con responsables encontrada:", casillaConResponsables.nombre_yaml);
            
            // Mostrar un emisor con responsables
            const emisorConResponsables = casillaConResponsables.emisores.find(e => 
              e.responsables && e.responsables.length > 0
            );
            
            if (emisorConResponsables) {
              console.log("Emisor con responsables:", JSON.stringify(emisorConResponsables, null, 2));
              console.log("Responsable (ejemplo):", JSON.stringify(emisorConResponsables.responsables[0], null, 2));
            }
          } else {
            console.log("No se encontraron casillas con emisores que tengan responsables");
          }
          
          // Buscar casillas que tengan emisores con historial
          const casillaConHistorial = casillasData.find(c => 
            c.emisores && c.emisores.length > 0 && 
            c.emisores.some(e => e.historial_envios && e.historial_envios.length > 0)
          );
          
          if (casillaConHistorial) {
            console.log("Casilla con historial encontrada:", casillaConHistorial.nombre_yaml);
            
            // Mostrar un emisor con historial
            const emisorConHistorial = casillaConHistorial.emisores.find(e => 
              e.historial_envios && e.historial_envios.length > 0
            );
            
            if (emisorConHistorial) {
              console.log("Emisor con historial:", emisorConHistorial.id || 'sin ID');
              console.log("Historial (ejemplo):", JSON.stringify(emisorConHistorial.historial_envios[0], null, 2));
            }
          } else {
            console.log("No se encontraron casillas con emisores que tengan historial");
          }
        }
        
        setCasillas(casillasData || []);
        
        // Actualizar el título de la página con la información de la instalación
        if (casillasData && casillasData.length > 0) {
          const firstCasilla = casillasData[0];
          console.log("Primera casilla:", firstCasilla);
          
          // La estructura correcta es firstCasilla.instalacion.organizacion.nombre
          if (firstCasilla.instalacion && 
              firstCasilla.instalacion.organizacion && 
              firstCasilla.instalacion.organizacion.nombre &&
              firstCasilla.instalacion.pais && 
              firstCasilla.instalacion.pais.nombre &&
              firstCasilla.instalacion.producto && 
              firstCasilla.instalacion.producto.nombre) {
            
            const tituloPortal = `${firstCasilla.instalacion.organizacion.nombre} - ${firstCasilla.instalacion.pais.nombre} - ${firstCasilla.instalacion.producto.nombre}`;
            console.log("Estableciendo título:", tituloPortal);
            setTitulo(tituloPortal);
            
            // Guardar información de instalación para su uso en el modal de carga
            setInstalacionId(firstCasilla.instalacion.id);
            setInstalacionInfo({
              organizacion: firstCasilla.instalacion.organizacion,
              producto: firstCasilla.instalacion.producto,
              pais: firstCasilla.instalacion.pais
            });
          } else {
            console.log("Faltan datos de instalación en la primera casilla");
          }
        } else {
          console.log("No se recibieron casillas en la respuesta");
        }
      } else {
        console.error('Error fetching casillas:', await response.text());
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleHistorialClick = (casilla: DataBox) => {
    router.push(`/portal-externo/historial/${uuid}?casillaId=${casilla.id}`);
  };

  const handleUploadClick = (casilla: DataBox) => {
    setSelectedCasilla(casilla);
    setIsUploadModalOpen(true);
  };
  
  // Función para manejar el clic en "Introducir datos directamente"
  const handleIntroducirDatosClick = (casilla: DataBox) => {
    // Analizar el formato de la casilla
    const formatoInfo = analizarFormatoCasilla(casilla);
    
    // Verificar si el formato permite ingreso directo
    if (formatoInfo.tieneFormatoValido) {
      // No es necesario verificar si es multi-catálogo porque ya hemos ocultado el botón para ZIP
      // El formato permite ingreso directo, proceder con la funcionalidad
      console.log('Casilla seleccionada para entrada directa:', casilla.id, casilla.nombre || casilla.nombreCompleto);
      
      // Redirigir a la página de introducción de datos
      router.push(`/portal-externo/datos-directos/${uuid}?casillaId=${casilla.id}`);
    } else {
      // Formato no compatible, mostrar mensaje informativo
      toast.warning('El formato de esta casilla no permite el ingreso directo de datos. Se admiten únicamente formatos CSV y Excel.');
    }
  };

  const toggleExpandCasilla = (casillaNombre: string) => {
    setExpandedCasillas({
      ...expandedCasillas,
      [casillaNombre]: !expandedCasillas[casillaNombre]
    });
  };
  
  const handleDescargarPlantilla = async (casilla: DataBox | any) => {
    // Mostrar algún indicador de carga al usuario
    toast.info('Generando plantilla para descarga...');
    
    try {
      // Obtener la estructura del YAML para determinar qué tipo de plantilla generar
      const response = await fetch(`/api/casillas/${casilla.id}/plantilla`);
      
      if (!response.ok) {
        throw new Error(`Error al generar la plantilla: ${response.statusText}`);
      }
      
      // Obtener el blob de la respuesta 
      const blob = await response.blob();
      
      // Obtener el nombre del archivo del encabezado Content-Disposition, si está disponible
      let nombreArchivo = '';
      const contentDisposition = response.headers.get('Content-Disposition');
      
      if (contentDisposition) {
        const filenameMatch = /filename="(.+)"/.exec(contentDisposition);
        if (filenameMatch && filenameMatch[1]) {
          nombreArchivo = filenameMatch[1];
        }
      }
      
      // Si no se pudo obtener el nombre del archivo del encabezado, generarlo
      if (!nombreArchivo) {
        const nombreBase = casilla.nombre_yaml ? casilla.nombre_yaml.toLowerCase().replace(/[^a-z0-9]/g, '_') : 
                          (casilla.nombre ? casilla.nombre.toLowerCase().replace(/[^a-z0-9]/g, '_') : `casilla_${casilla.id}`);
        nombreArchivo = `plantilla_${nombreBase}.zip`;
      }
      
      // Crear un objeto URL y un enlace para la descarga
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nombreArchivo;
      document.body.appendChild(a);
      a.click();
      
      // Liberar el objeto URL y eliminar el enlace
      setTimeout(() => {
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 0);
      
      toast.success('Plantilla generada correctamente');
    } catch (error) {
      console.error('Error al descargar plantilla:', error);
      toast.error('No se pudo generar la plantilla. Por favor, inténtelo de nuevo.');
    }
  };

  // Determinar el tipo de casilla según su configuración
  const determinarTipoCasilla = (casilla: any): 'sin_emisores' | 'un_emisor' | 'multiples_emisores' => {
    // Caso 1: No tiene emisores configurados - solo para subida directa
    if (!casilla.emisores || casilla.emisores.length === 0) {
      return 'sin_emisores';
    }
    
    // Caso 2: Tiene exactamente un emisor
    if (casilla.emisores.length === 1) {
      return 'un_emisor';
    }
    
    // Caso 3: Tiene múltiples emisores
    return 'multiples_emisores';
  };
  
  // Determinar si una casilla permite ingreso directo de datos
  // y obtener información sobre el formato
  const analizarFormatoCasilla = (casilla: any): { 
    permitirIngreso: boolean, 
    tieneFormatoValido: boolean, 
    esMultiCatalogo: boolean, 
    mensaje: string 
  } => {
    const resultado = {
      permitirIngreso: false,
      tieneFormatoValido: false,
      esMultiCatalogo: false,
      mensaje: 'No se puede determinar el formato del archivo'
    };
    
    // Intentar obtener el contenido YAML de varias propiedades posibles
    const yamlString = casilla.yaml_contenido || casilla.archivo_yaml_contenido;
    
    // Si no hay contenido YAML, no podemos determinar el formato
    if (!yamlString) {
      console.log(`DEBUG - No se encontró contenido YAML para casilla ${casilla.id}`);
      return resultado;
    }
    
    try {
      // Analizar el contenido YAML
      const yamlContent = yaml.parse(yamlString);
      
      // Verificar si es un paquete multi-catálogo, pero solo nos interesa si tiene tipo ZIP
      let formatoPackage = '';
      if (yamlContent.packages && Object.keys(yamlContent.packages).length > 0) {
        // Comprobar si algún paquete tiene formato ZIP
        for (const packageName of Object.keys(yamlContent.packages)) {
          const pkg = yamlContent.packages[packageName];
          if (pkg.file_format && pkg.file_format.type) {
            formatoPackage = pkg.file_format.type.toLowerCase();
            // Si encontramos formato ZIP, marcamos multi-catálogo
            if (formatoPackage === 'zip') {
              resultado.esMultiCatalogo = true;
              break;
            }
          }
        }
      }
      
      // Verificar si tiene formato válido (CSV o Excel) en catálogos
      let tieneCSVoExcel = false;
      
      // Verificar formato de catálogos individuales
      if (yamlContent.catalogs && Object.keys(yamlContent.catalogs).length > 0) {
        // Verificar el formato de cada catálogo
        for (const catalogName of Object.keys(yamlContent.catalogs)) {
          const catalog = yamlContent.catalogs[catalogName];
          if (catalog.file_format && catalog.file_format.type) {
            const formatoArchivo = catalog.file_format.type.toLowerCase();
            // Verificar si es CSV o Excel
            if (formatoArchivo === 'csv' || formatoArchivo === 'excel') {
              tieneCSVoExcel = true;
              break;
            }
          }
        }
      }
      
      resultado.tieneFormatoValido = tieneCSVoExcel;
      
      // Determinar si permite ingreso directo (solo debe tener formato CSV o Excel)
      if (tieneCSVoExcel) {
        if (!resultado.esMultiCatalogo) {
          // Si tiene formato válido y no es ZIP, permitir ingreso directo
          resultado.permitirIngreso = true;
          resultado.mensaje = 'Formato válido para ingreso directo de datos';
        } else {
          // Si es ZIP, no permitir ingreso directo
          resultado.mensaje = 'Los archivos ZIP no permiten el ingreso directo de datos';
        }
      } else {
        resultado.mensaje = 'El formato de archivo no es compatible con el ingreso directo de datos';
      }
      
      return resultado;
    } catch (error) {
      console.error('Error al analizar el contenido YAML:', error);
      return resultado;
    }
  };
  
  // Función simplificada para compatibilidad con código existente
  const permitirIngresoDirecto = (casilla: any): boolean => {
    return analizarFormatoCasilla(casilla).permitirIngreso;
  };

  // Obtener información de estado para una casilla completa
  const obtenerEstadoCasilla = (casilla: any) => {
    console.log("DEBUG - Calculando estado para casilla:", casilla.nombre || casilla.nombreCompleto || 'sin nombre');
    
    let tieneRetraso = false;
    let maxTiempoRetraso = 0;
    let ultimoEnvio = null;
    let ultimoEstado = null;
    let tieneResponsables = false;
    
    // Variables para seguimiento de estados de error
    let hayErrorOParcial = false;
    
    // Información para última actualización
    let ultimoEmisor = null;
    let ultimoResponsable = null;
    
    // VERIFICACIÓN DEL HISTORIAL DIRECTO - Si la casilla no tiene emisores, verificar su historial directo
    if (!casilla.emisores || casilla.emisores.length === 0) {
      console.log(`DEBUG - Casilla ${casilla.id} sin emisores - DEBE USAR HISTORIAL DIRECTO`);
      console.log(`DEBUG - Casilla ${casilla.id} - Revisando campos disponibles:`, Object.keys(casilla));
      console.log(`DEBUG - Casilla ${casilla.id} - ¿Tiene historial_envios?`, !!casilla.historial_envios);
      
      const tieneCasillaHistorial = casilla.historial_envios && casilla.historial_envios.length > 0;
      
      if (tieneCasillaHistorial) {
        console.log(`DEBUG - Casilla ${casilla.id} - historial directo encontrado:`, casilla.historial_envios.length, 'registros');
        console.log(`DEBUG - Historial:`, JSON.stringify(casilla.historial_envios));
        const ultimaEjecucionCasilla = casilla.historial_envios[0];
        
        // Si hay estado de ERROR o PARCIAL en la casilla
        if (ultimaEjecucionCasilla.estado === 'ERROR' || ultimaEjecucionCasilla.estado === 'Fallido' || 
            ultimaEjecucionCasilla.estado === 'PARCIAL' || ultimaEjecucionCasilla.estado === 'Parcial') {
          hayErrorOParcial = true;
          console.log(`DEBUG - Casilla ${casilla.id} tiene estado ${ultimaEjecucionCasilla.estado}`);
        }
        
        // CRÍTICO: Usar esta ejecución como referencia principal
        ultimoEnvio = ultimaEjecucionCasilla.fecha_ejecucion;
        ultimoEstado = ultimaEjecucionCasilla.estado;
        console.log(`DEBUG - Estado obtenido del historial directo: ${ultimoEstado}`);
        console.log(`DEBUG - Fecha obtenida del historial directo: ${ultimoEnvio}`);
      } else {
        console.log(`DEBUG - Casilla ${casilla.id} sin emisores y sin historial directo`);
      }
    }
    
    // Contar emisores con problemas
    let emisoresConRetraso = 0;
    let totalEmisores = 0;
    
    // Revisar todos los emisores para determinar el estado general
    casilla.emisores?.forEach((emisor: Emisor, index: number) => {
      console.log(`DEBUG - Emisor #${index + 1}:`, emisor.id || 'sin ID');
      totalEmisores++;
      
      // Si no tenemos un emisor para última actualización y este es el primer emisor, 
      // guardarlo como respaldo
      if (!ultimoEmisor && emisor.id) {
        ultimoEmisor = emisor;
        ultimoEstado = 'PENDIENTE';
      }
      
      // Variable para seguimiento de retraso en este emisor
      let retrasoEnEsteEmisor = false;
      
      // Verificar si el emisor tiene responsables asignados
      if (emisor.responsables && emisor.responsables.length > 0) {
        console.log(`DEBUG - Emisor #${index + 1} tiene ${emisor.responsables.length} responsables`);
        tieneResponsables = true;
        
        // Si no tenemos un responsable para última actualización y este es el primer responsable, 
        // guardarlo como respaldo
        if (!ultimoResponsable && emisor.responsables[0]) {
          ultimoResponsable = emisor.responsables[0];
        }
        
        // Verificar si algún responsable tiene retraso
        const responsablesConRetraso = emisor.responsables.filter(resp => resp.estado_retraso);
        const retrasoEmEmisor = responsablesConRetraso.length > 0;
        
        console.log(`DEBUG - Responsables con retraso:`, responsablesConRetraso.length);
        
        if (retrasoEmEmisor) {
          tieneRetraso = true;
          retrasoEnEsteEmisor = true;
          
          // Calcular el máximo tiempo de retraso entre todos los responsables
          emisor.responsables.forEach(resp => {
            if (resp.tiempo_retraso && resp.tiempo_retraso > maxTiempoRetraso) {
              maxTiempoRetraso = resp.tiempo_retraso;
              console.log(`DEBUG - Tiempo retraso encontrado:`, resp.tiempo_retraso);
            }
          });
        }
        
        // Buscar envíos en responsables
        emisor.responsables.forEach(responsable => {
          if (responsable.ultimo_envio) {
            const fechaEnvio = new Date(responsable.ultimo_envio);
            if (!ultimoEnvio || fechaEnvio > new Date(ultimoEnvio)) {
              ultimoEnvio = responsable.ultimo_envio;
              ultimoEmisor = emisor;
              ultimoResponsable = responsable;
              ultimoEstado = "COMPLETADO"; // Asumir completado para responsables con último envío
            }
          }
        });
      }
      
      // Verificar historial de envíos del emisor
      if (emisor.historial_envios && emisor.historial_envios.length > 0) {
        console.log(`DEBUG - Emisor #${index + 1} tiene ${emisor.historial_envios.length} registros en historial`);
        const ultimaEjecucion = emisor.historial_envios[0]; // Asumir que están ordenados por fecha desc
        
        // Si hay un envío y es más reciente que lo que ya tenemos
        if (ultimaEjecucion.fecha_ejecucion) {
          const fechaEjecucion = new Date(ultimaEjecucion.fecha_ejecucion);
          if (!ultimoEnvio || fechaEjecucion > new Date(ultimoEnvio)) {
            ultimoEnvio = ultimaEjecucion.fecha_ejecucion;
            ultimoEmisor = emisor;
            ultimoEstado = ultimaEjecucion.estado || "COMPLETADO";
            
            // Si hay error o parcial en la última ejecución
            if (ultimaEjecucion.estado === 'ERROR' || ultimaEjecucion.estado === 'Fallido' || 
                ultimaEjecucion.estado === 'PARCIAL' || ultimaEjecucion.estado === 'Parcial') {
              hayErrorOParcial = true;
            }
          }
        }
      }
      
      // Si este emisor tiene retraso, incrementar el contador
      if (retrasoEnEsteEmisor) {
        emisoresConRetraso++;
      }
    });
    
    console.log(`DEBUG - Estado final calculado:`, {
      tieneRetraso,
      maxTiempoRetraso,
      ultimoEnvio,
      ultimoEstado,
      tieneResponsables,
      hayErrorOParcial,
      emisoresConRetraso,
      totalEmisores
    });
    
    return {
      tieneRetraso,
      maxTiempoRetraso,
      ultimoEnvio,
      ultimoEstado,
      ultimoEmisor,
      ultimoResponsable,
      tieneResponsables,
      hayErrorOParcial,
      emisoresConRetraso,
      totalEmisores
    };
  };

  // Cambiar la sección activa
  const handleSectionChange = (section: string) => {
    setActiveSection(section);
  };

  const renderDashboard = () => {
    console.log("DEBUG - PREPARANDO DATOS PARA RENDERIZAR:");
    console.log("Total de casillas originales:", casillas.length);
    
    // Agrupar emisores por casilla y quitar extensión .yaml
    const casillasProcesadas = casillas.reduce((acc: any, casilla, index) => {
      console.log(`DEBUG - Procesando casilla original #${index + 1}:`, casilla.id, casilla.nombre_yaml);
      
      // Inspeccionar la casilla original por completo
      console.log(`DEBUG - Casilla original #${index + 1} - Campos disponibles:`, Object.keys(casilla));
      console.log(`DEBUG - Casilla original #${index + 1} - ¿Tiene historial_envios?`, !!casilla.historial_envios);
      
      if (casilla.historial_envios) {
        console.log(`DEBUG - Casilla original #${index + 1} - Cantidad de registros en historial:`, casilla.historial_envios.length);
      }
      
      const nombreBase = casilla.nombre_yaml.replace(/\.yaml$/, '');
      if (!acc[nombreBase]) {
        // Crear una nueva entrada en el acumulador
        const casillaFormateada = {
          id: casilla.id, // Asegurar que preservamos el ID original
          nombre: nombreBase,
          descripcion: casilla.descripcion || 'Sin descripción',
          nombreCompleto: casilla.nombreCompleto || casilla.nombre_yaml,
          emisores: casilla.emisores || [],
          // ASEGURARNOS que el historial de la casilla se preserve correctamente 
          historial_envios: casilla.historial_envios || [],
          // Preservar el contenido YAML para analizarlo después
          yaml_contenido: casilla.yaml_contenido || casilla.archivo_yaml_contenido
        };
        
        console.log(`DEBUG - Creada casilla procesada "${nombreBase}" con ${casillaFormateada.emisores.length} emisores`);
        
        // Comprobar que se preservan correctamente los emisores y responsables
        if (casillaFormateada.emisores.length > 0) {
          console.log(`DEBUG - Primer emisor de la casilla procesada:`, 
            casillaFormateada.emisores[0].id || 'sin ID');
          
          // Verificar responsables
          if (casillaFormateada.emisores[0].responsables && 
              casillaFormateada.emisores[0].responsables.length > 0) {
            console.log(`DEBUG - Primer responsable del emisor:`, 
              casillaFormateada.emisores[0].responsables[0].id || 'sin ID',
              casillaFormateada.emisores[0].responsables[0].nombre || 'sin nombre');
          }
          
          // Verificar historial
          if (casillaFormateada.emisores[0].historial_envios && 
              casillaFormateada.emisores[0].historial_envios.length > 0) {
            console.log(`DEBUG - Historial del emisor:`, 
              casillaFormateada.emisores[0].historial_envios[0].estado || 'sin estado');
          }
        }
        
        acc[nombreBase] = casillaFormateada;
      }
      return acc;
    }, {});
    
    console.log("DEBUG - Total de casillas procesadas:", Object.keys(casillasProcesadas).length);

    return (
      <>
        <div className="text-xl sm:text-2xl font-bold text-gray-800 mb-1 break-words">
          {titulo || 'Portal de Recepción SAGE'}
        </div>
        <div className="text-sm text-gray-600 mb-6">Portal de recepción de archivos</div>

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto lg:overflow-visible max-w-full">
            <table className="w-full table-auto divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Casilla
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Detalle
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Última Actualización
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {Object.entries(casillasProcesadas).map(([nombre, casilla]: [string, any]) => {
                // Determinamos el tipo de casilla
                const tipoCasilla = determinarTipoCasilla(casilla);
                // Información del estado general de la casilla
                const estadoCasilla = obtenerEstadoCasilla(casilla);
                // Verificar si está expandida
                const isExpanded = expandedCasillas[nombre] || false;
                
                // Determinar estado para mostrar la etiqueta correcta
                let estadoTag;
                
                // Prioridad 1: Si hay algún error o ejecución parcial, mostrar ese estado
                if (estadoCasilla.hayErrorOParcial) {
                  if (estadoCasilla.ultimoEstado === 'ERROR' || estadoCasilla.ultimoEstado === 'Fallido') {
                    estadoTag = (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                        Error
                      </span>
                    );
                  } else if (estadoCasilla.ultimoEstado === 'PARCIAL' || estadoCasilla.ultimoEstado === 'Parcial') {
                    estadoTag = (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-orange-100 text-orange-800">
                        Parcial
                      </span>
                    );
                  }
                }
                // Prioridad 2: Si hay responsables, se aplica lógica de retraso/pendiente/completado
                else if (estadoCasilla.tieneResponsables) {
                  if (estadoCasilla.tieneRetraso) {
                    const tiempoRetrasoFormateado = formatearTiempoRetraso(estadoCasilla.maxTiempoRetraso);
                    estadoTag = (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                        Retraso: {tiempoRetrasoFormateado}
                      </span>
                    );
                  } else if (estadoCasilla.ultimoEnvio) {
                    estadoTag = (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        OK
                      </span>
                    );
                  } else {
                    estadoTag = (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                        Pendiente
                      </span>
                    );
                  }
                } 
                // Prioridad 3: Sin responsables, mostrar el estado del último envío
                else {
                  if (!estadoCasilla.ultimoEnvio) {
                    estadoTag = (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                        Sin estado
                      </span>
                    );
                  } else if (estadoCasilla.ultimoEstado === 'ERROR' || estadoCasilla.ultimoEstado === 'Fallido') {
                    estadoTag = (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                        Error
                      </span>
                    );
                  } else if (estadoCasilla.ultimoEstado === 'PARCIAL' || estadoCasilla.ultimoEstado === 'Parcial') {
                    estadoTag = (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-orange-100 text-orange-800">
                        Parcial
                      </span>
                    );
                  } else {
                    estadoTag = (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        Válido
                      </span>
                    );
                  }
                }

                // Mapear el posible estado de los emisores
                const estadoEmisores = {
                  COMPLETADO: {
                    bgColor: 'bg-green-100',
                    textColor: 'text-green-800',
                    texto: 'OK'
                  },
                  PENDIENTE: {
                    bgColor: 'bg-blue-100',
                    textColor: 'text-blue-800',
                    texto: 'Pendiente'
                  },
                  ERROR: {
                    bgColor: 'bg-red-100',
                    textColor: 'text-red-800',
                    texto: 'Error'
                  },
                  PARCIAL: {
                    bgColor: 'bg-orange-100',
                    textColor: 'text-orange-800',
                    texto: 'Parcial'
                  },
                  RETRASO: {
                    bgColor: 'bg-red-100',
                    textColor: 'text-red-800',
                    // El texto se asignará dinámicamente con el tiempo de retraso
                    texto: '' 
                  },
                  ATENCION: {
                    bgColor: 'bg-yellow-100',
                    textColor: 'text-yellow-800',
                    texto: 'Atención'
                  },
                  INACTIVO: {
                    bgColor: 'bg-gray-100',
                    textColor: 'text-gray-800',
                    texto: 'Inactivo'
                  },
                };
                
                return (
                  <React.Fragment key={`casilla-${casilla.id || nombre}`}>
                    <tr className={`hover:bg-gray-50 ${isExpanded ? 'bg-gray-50' : ''}`}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {tipoCasilla === 'multiples_emisores' && (
                          <button
                            onClick={() => toggleExpandCasilla(nombre)}
                            className="text-gray-500 mr-2 focus:outline-none"
                          >
                            {isExpanded ? (
                              <ChevronUpIcon className="h-5 w-5" />
                            ) : (
                              <ChevronDownIcon className="h-5 w-5" />
                            )}
                          </button>
                        )}
                        <div>
                          <span className="font-medium">
                            {casilla.nombreCompleto || nombre}
                          </span>
                          {casilla.descripcion && (
                            <div className="text-xs text-gray-500 mt-1">
                              {casilla.descripcion}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {estadoTag}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {tipoCasilla === 'sin_emisores' ? (
                          <span className="text-gray-500">Sin emisores asignados</span>
                        ) : tipoCasilla === 'un_emisor' ? (
                          <></>
                        ) : (
                          // Para casillas con múltiples emisores, mostrar resumen
                          <div className="flex items-center space-x-1">
                            {estadoCasilla.emisoresConRetraso > 0 && (
                              <span className="h-2 w-2 rounded-full bg-red-500"></span>
                            )}
                            {estadoCasilla.emisoresConRetraso < estadoCasilla.totalEmisores && (
                              <span className="h-2 w-2 rounded-full bg-yellow-500"></span>
                            )}
                            {estadoCasilla.emisoresConRetraso === 0 && estadoCasilla.totalEmisores > 0 && (
                              <span className="h-2 w-2 rounded-full bg-green-500"></span>
                            )}
                            <span className="text-gray-600 ml-1">
                              {estadoCasilla.emisoresConRetraso > 0 ? (
                                <>{estadoCasilla.emisoresConRetraso} con problemas, {estadoCasilla.totalEmisores - estadoCasilla.emisoresConRetraso} OK</>
                              ) : (
                                <>{estadoCasilla.totalEmisores} emisores OK</>
                              )}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                        {estadoCasilla.ultimoEnvio ? (
                          <div className="space-y-1">
                            <div className="flex items-center">
                              <ClockIcon className="h-4 w-4 mr-1 text-gray-400" />
                              <span className="font-medium" title={new Date(estadoCasilla.ultimoEnvio).toLocaleString('es-ES', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}>
                                {formatearFechaAmigable(estadoCasilla.ultimoEnvio)}
                              </span>
                            </div>
                            
                            {/* Mostrar emisor solo si hay un emisor asociado */}
                            {estadoCasilla.ultimoEmisor && (
                              <div className="text-xs">
                                <span className="text-gray-600 font-medium">Emisor:</span>{' '}
                                {estadoCasilla.ultimoEmisor.nombre || `ID: ${estadoCasilla.ultimoEmisor.id}`}
                              </div>
                            )}
                            
                            {/* Si no hay emisor pero hay último envío, indicar que es envío directo a casilla */}
                            {!estadoCasilla.ultimoEmisor && estadoCasilla.ultimoEnvio && (
                              <div className="text-xs">
                                <span className="text-gray-600 font-medium">Método:</span>{' '}
                                <span>Portal</span>
                              </div>
                            )}
                            
                            {estadoCasilla.ultimoEstado && (
                              <div className="text-xs">
                                <span className="text-gray-600 font-medium">Estado:</span>{' '}
                                {estadoCasilla.ultimoEstado === 'Fallido' || 
                                 estadoCasilla.ultimoEstado === 'ERROR' || 
                                 estadoCasilla.ultimoEstado === 'Error' ? (
                                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                                    Error
                                  </span>
                                ) : estadoCasilla.ultimoEstado === 'Parcial' || 
                                     estadoCasilla.ultimoEstado === 'PARCIAL' ? (
                                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-orange-100 text-orange-800">
                                    Parcial
                                  </span>
                                ) : (
                                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                    {estadoCasilla.ultimoEstado === 'Éxito' || 
                                     estadoCasilla.ultimoEstado === 'COMPLETADO' || 
                                     estadoCasilla.ultimoEstado === 'Completado' ? 'Éxito' : 
                                     estadoCasilla.ultimoEstado}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div>
                            <div className="text-gray-800 font-medium">Sin envíos registrados</div>
                            {estadoCasilla.ultimoEmisor && (
                              <div className="text-xs mt-1">
                                <span className="text-gray-600 font-medium">Emisor disponible:</span>{' '}
                                {estadoCasilla.ultimoEmisor.nombre || `ID: ${estadoCasilla.ultimoEmisor.id}`}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex flex-col space-y-2">
                          {/* Primera fila de botones */}
                          <div className="flex space-x-2 justify-end">
                            {tipoCasilla !== 'multiples_emisores' && (
                              <button
                                className="inline-flex items-center px-3 py-1.5 border border-teal-600 text-xs font-medium rounded text-white bg-teal-600 hover:bg-teal-700"
                                onClick={() => handleUploadClick(casilla)}
                              >
                                <ArrowUpTrayIcon className="h-4 w-4 mr-1" />
                                Subir
                              </button>
                            )}
                            <button
                              className="inline-flex items-center px-3 py-1.5 border border-teal-600 text-xs font-medium rounded text-teal-600 bg-white hover:bg-teal-50"
                              onClick={() => handleHistorialClick(casilla)}
                            >
                              <ClockIcon className="h-4 w-4 mr-1" />
                              Historial
                            </button>
                          </div>
                          
                          {/* Segunda fila de botones */}
                          <div className="flex space-x-2 justify-end">
                            <button
                              className="inline-flex items-center px-3 py-1.5 border border-blue-600 text-xs font-medium rounded text-blue-600 bg-white hover:bg-blue-50"
                              onClick={() => {
                                router.push(`/portal-externo/suscripciones/${uuid}?casillaId=${casilla.id}`);
                              }}
                            >
                              <BellAlertIcon className="h-4 w-4 mr-1" />
                              Suscripciones
                            </button>
                            <button
                              className="inline-flex items-center px-3 py-1.5 border border-purple-600 text-xs font-medium rounded text-white bg-purple-600 hover:bg-purple-700"
                              onClick={() => handleDescargarPlantilla(casilla)}
                            >
                              <DocumentIcon className="h-4 w-4 mr-1" />
                              Descargar Plantilla
                            </button>
                            {/* Botón para introducir datos directamente (siempre visible, con manejo inteligente de formatos) */}
                            {!analizarFormatoCasilla(casilla).esMultiCatalogo && (
                              <button
                                className="inline-flex items-center px-3 py-1.5 border border-green-600 text-xs font-medium rounded text-white bg-green-600 hover:bg-green-700"
                                onClick={() => handleIntroducirDatosClick(casilla)}
                              >
                                <PencilSquareIcon className="h-4 w-4 mr-1" />
                                Introducir datos directamente
                              </button>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                    
                    {/* Fila expandible para múltiples emisores */}
                    {isExpanded && tipoCasilla === 'multiples_emisores' && (
                      <tr>
                        <td colSpan={5} className="p-0 border-b border-gray-200">
                          <div className="bg-gray-50 overflow-x-auto lg:overflow-visible max-w-full">
                            <table className="min-w-full table-auto divide-y divide-gray-200">
                              <tbody>
                                {casilla.emisores.map((emisor: any) => {
                                  // Determinar el estado del emisor
                                  let estadoEmisor = 'COMPLETADO';
                                  let tiempoRetrasoEmisor = 0;
                                  
                                  if (emisor.responsables && emisor.responsables.length > 0) {
                                    // Verificar si algún responsable tiene retraso
                                    const responsablesConRetraso = emisor.responsables.filter((resp: any) => resp.estado_retraso);
                                    
                                    if (responsablesConRetraso.length > 0) {
                                      estadoEmisor = 'RETRASO';
                                      
                                      // Obtener el máximo tiempo de retraso
                                      tiempoRetrasoEmisor = Math.max(...responsablesConRetraso.map((r: any) => r.tiempo_retraso || 0));
                                    } else if (emisor.responsables.some((r: any) => r.ultimo_envio)) {
                                      estadoEmisor = 'COMPLETADO';
                                    } else {
                                      estadoEmisor = 'PENDIENTE';
                                    }
                                  } else if (emisor.historial_envios && emisor.historial_envios.length > 0) {
                                    // Si tiene historial, usar el último estado
                                    const ultimoEstado = emisor.historial_envios[0].estado;
                                    if (ultimoEstado === 'ERROR' || ultimoEstado === 'Fallido') {
                                      estadoEmisor = 'ERROR';
                                    } else if (ultimoEstado === 'PARCIAL' || ultimoEstado === 'Parcial') {
                                      estadoEmisor = 'PARCIAL';
                                    } else {
                                      estadoEmisor = 'COMPLETADO';
                                    }
                                  } else {
                                    estadoEmisor = 'PENDIENTE';
                                  }
                                  
                                  // Formatear el tiempo de retraso si está en estado RETRASO
                                  const tiempoRetrasoFormateado = estadoEmisor === 'RETRASO' 
                                    ? formatearTiempoRetraso(tiempoRetrasoEmisor)
                                    : '';
                                  
                                  // Texto para mostrar en el estado
                                  const textoEstado = estadoEmisor === 'RETRASO'
                                    ? `Retraso: ${tiempoRetrasoFormateado}`
                                    : estadoEmisores[estadoEmisor]?.texto || 'Desconocido';
                                  
                                  return (
                                    <tr key={emisor.id} className="hover:bg-gray-100">
                                      <td className="pl-12 pr-6 py-3 whitespace-nowrap">
                                        <span className="font-medium">{emisor.nombre}</span>
                                      </td>
                                      <td className="px-6 py-3 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${estadoEmisores[estadoEmisor]?.bgColor} ${estadoEmisores[estadoEmisor]?.textColor}`}>
                                          {textoEstado}
                                        </span>
                                      </td>
                                      <td className="px-6 py-3 whitespace-nowrap">
                                        <span className="text-xs text-gray-500">
                                          {emisor.metodos_envio.join(', ')}
                                        </span>
                                      </td>
                                      <td className="px-6 py-3 whitespace-nowrap">
                                        {emisor.responsables && emisor.responsables.length > 0 ? (
                                          <div className="text-xs">
                                            <span className="text-gray-600">
                                              {emisor.responsables.length} {emisor.responsables.length === 1 ? 'responsable' : 'responsables'}
                                            </span>
                                            
                                            {/* Mostrar el último envío si hay alguno */}
                                            {emisor.responsables.some((r: any) => r.ultimo_envio) && (
                                              <div className="mt-1">
                                                <span className="text-gray-600 font-medium">Último envío:</span>{' '}
                                                {formatearFechaAmigable(
                                                  emisor.responsables
                                                    .filter((r: any) => r.ultimo_envio)
                                                    .sort((a: any, b: any) => new Date(b.ultimo_envio).getTime() - new Date(a.ultimo_envio).getTime())[0].ultimo_envio
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        ) : emisor.historial_envios && emisor.historial_envios.length > 0 ? (
                                          <div className="text-xs">
                                            <span className="text-gray-600 font-medium">Último envío:</span>{' '}
                                            {formatearFechaAmigable(emisor.historial_envios[0].fecha_ejecucion)}
                                          </div>
                                        ) : (
                                          <span className="text-xs text-gray-500">
                                            Sin envíos registrados
                                          </span>
                                        )}
                                      </td>
                                      <td className="px-6 py-3 whitespace-nowrap text-right">
                                        <button
                                          className="inline-flex items-center px-3 py-1.5 border border-teal-600 text-xs font-medium rounded text-white bg-teal-600 hover:bg-teal-700"
                                          onClick={() => {
                                            // Para subir archivo específico para este emisor
                                            handleUploadClick({
                                              ...casilla,
                                              emisorId: emisor.id,
                                              emisorNombre: emisor.nombre
                                            });
                                          }}
                                        >
                                          <ArrowUpTrayIcon className="h-4 w-4 mr-1" />
                                          Subir
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
    );
  };

  // Renderizar una vista de detalle para la casilla seleccionada
  const renderDetailView = (casilla: any) => {
    return (
      <Card className="mt-6">
        <div className="mb-4 flex justify-between items-center">
          <Title>Emisores para {casilla.nombre}</Title>
          <div className="flex space-x-2">
            <button
              onClick={() => handleUploadClick(casilla)}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <ArrowUpTrayIcon className="h-4 w-4 mr-1" />
              Subir Archivo
            </button>
            <button
              onClick={() => handleHistorialClick(casilla)}
              className="inline-flex items-center px-3 py-2 border border-blue-600 text-sm leading-4 font-medium rounded-md text-blue-600 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <ClockIcon className="h-4 w-4 mr-1" />
              Ver Historial
            </button>
          </div>
        </div>

        <Divider />

        <div className="mt-4">
          {casilla.emisores && casilla.emisores.length > 0 ? (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Nombre</TableHeaderCell>
                  <TableHeaderCell>Estado</TableHeaderCell>
                  <TableHeaderCell>Métodos</TableHeaderCell>
                  <TableHeaderCell>Responsables</TableHeaderCell>
                  <TableHeaderCell>Acciones</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {casilla.emisores.map((emisor: any) => (
                  <TableRow key={emisor.id}>
                    <TableCell>{emisor.nombre}</TableCell>
                    <TableCell>
                      <Badge color="emerald">Activo</Badge>
                    </TableCell>
                    <TableCell>{emisor.metodos_envio.join(', ')}</TableCell>
                    <TableCell>
                      {emisor.responsables ? emisor.responsables.length : 0} responsables
                    </TableCell>
                    <TableCell>
                      <Button
                        size="xs"
                        color="blue"
                        onClick={() => {
                          // Subir para emisor específico
                          handleUploadClick({
                            ...casilla,
                            emisorId: emisor.id,
                            emisorNombre: emisor.nombre
                          });
                        }}
                      >
                        Subir
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-6 text-gray-500">
              No hay emisores configurados para esta casilla.
            </div>
          )}
        </div>
      </Card>
    );
  };

  const renderContent = () => {
    // Portal no encontrado
    if (portalNoEncontrado) {
      return (
        <div className="flex flex-col items-center justify-center h-[80vh]">
          <div className="bg-red-50 border border-red-300 rounded-lg p-8 text-center max-w-lg">
            <h2 className="text-2xl font-bold text-red-700 mb-4">Portal no encontrado</h2>
            <p className="text-red-600 mb-4">
              El portal que estás intentando acceder no existe o ha sido eliminado.
            </p>
            <p className="text-gray-600 text-sm">
              Por favor, verifica la URL e intenta nuevamente o contacta al administrador.
            </p>
          </div>
        </div>
      );
    }
    
    // Portal inactivo
    if (portalInactivo) {
      return (
        <div className="flex flex-col items-center justify-center h-[80vh]">
          <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-8 text-center max-w-lg">
            <h2 className="text-2xl font-bold text-yellow-700 mb-4">Portal temporalmente inactivo</h2>
            <p className="text-yellow-600 mb-4">
              Este portal ha sido desactivado temporalmente por el administrador.
            </p>
            <p className="text-gray-600 text-sm">
              Por favor, contacta al administrador para obtener más información.
            </p>
          </div>
        </div>
      );
    }
    
    switch (activeSection) {
      case 'dashboard':
        return renderDashboard();
      case 'archivos':
        return (
          <>
            <div className="mb-6">
              <TabGroup>
                <TabList className="flex justify-end">
                  <Tab
                    icon={Squares2X2Icon}
                    onClick={() => setViewType('card')}
                    className={viewType === 'card' ? 'bg-blue-50' : ''}
                  >
                    Cards
                  </Tab>
                  <Tab
                    icon={ListBulletIcon}
                    onClick={() => setViewType('list')}
                    className={viewType === 'list' ? 'bg-blue-50' : ''}
                  >
                    Lista
                  </Tab>
                </TabList>
              </TabGroup>
            </div>
            
            <div>
              {viewType === 'card' ? (
                <Grid numItems={1} numItemsSm={2} numItemsLg={3} className="gap-6">
                  {casillas.map((casilla: DataBox) => (
                    <Col key={casilla.id}>
                      <Card className="hover:shadow-lg transition-all duration-200">
                        <div className="flex justify-between items-start mb-3">
                          <Title className="text-gray-800 break-words">{casilla.nombre_yaml}</Title>
                        </div>
                        
                        {casilla.descripcion && (
                          <Text className="mb-2 text-gray-600 break-words">{casilla.descripcion}</Text>
                        )}
                        
                        <div className="flex justify-between items-center mt-4">
                          <Button
                            color="blue"
                            size="sm"
                            onClick={() => handleUploadClick(casilla)}
                          >
                            <ArrowUpTrayIcon className="h-4 w-4 mr-1" />
                            Subir archivo
                          </Button>
                          
                          <button
                            onClick={() => handleHistorialClick(casilla)}
                            className="text-blue-600 hover:text-blue-800 flex items-center"
                          >
                            <ClockIcon className="h-4 w-4 mr-1" />
                            <span className="text-sm">Historial</span>
                          </button>
                        </div>
                      </Card>
                    </Col>
                  ))}
                </Grid>
              ) : (
                <div className="w-full overflow-x-auto lg:overflow-visible max-w-full" style={{ scrollbarWidth: 'thin' }}>
                  <Table className="min-w-full table-auto w-full">
                    <TableHead>
                      <TableRow>
                        <TableHeaderCell className="whitespace-nowrap">Nombre</TableHeaderCell>
                        <TableHeaderCell className="whitespace-nowrap">Descripción</TableHeaderCell>
                        <TableHeaderCell className="whitespace-nowrap">Acciones</TableHeaderCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {casillas.map((casilla: DataBox) => (
                        <TableRow key={casilla.id}>
                          <TableCell className="max-w-xs truncate">{casilla.nombre_yaml}</TableCell>
                          <TableCell className="max-w-md truncate">{casilla.descripcion || '-'}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            <div className="flex space-x-2">
                              <Button
                                color="blue"
                                size="xs"
                                onClick={() => handleUploadClick(casilla)}
                              >
                                <ArrowUpTrayIcon className="h-4 w-4 mr-1" />
                                Subir
                              </Button>
                              
                              <Button
                                color="gray"
                                size="xs"
                                onClick={() => handleHistorialClick(casilla)}
                              >
                                <ClockIcon className="h-4 w-4 mr-1" />
                                Historial
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </>
        );
      default:
        return renderDashboard();
    }
  };

  return (
    <PortalLayout title={titulo || "Portal Externo"}>
      {loading ? (
        <div className="flex justify-center items-center min-h-screen">
          <ProgressCircle className="h-12 w-12" />
        </div>
      ) : (
        <div className="w-full px-2 sm:px-4 py-6">
          {renderContent()}
          
          {isUploadModalOpen && selectedCasilla && (
            <FileUploadModal
              isOpen={isUploadModalOpen}
              onClose={() => setIsUploadModalOpen(false)}
              casilla={selectedCasilla}
              uuid={uuid as string}
              instalacionId={instalacionId}
              instalacionInfo={instalacionInfo}
            />
          )}
        </div>
      )}
    </PortalLayout>
  );
}