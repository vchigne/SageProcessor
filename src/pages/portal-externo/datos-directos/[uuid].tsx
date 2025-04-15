import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { toast } from 'react-toastify';
import yaml from 'yaml';
import {
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';
import PortalLayout from '@/components/Portal/PortalLayout';

// Tipo para representar las columnas y su configuración
interface ColumnDefinition {
  name: string;
  type: string;
  required?: boolean;
  description?: string;
}

// Tipo para la estructura de datos del formulario
interface FormData {
  [key: string]: any[];
}

export default function EntradaDatosDirectosPage() {
  const router = useRouter();
  const { uuid, casillaId } = router.query;
  
  // Estado para la casilla seleccionada
  const [casilla, setCasilla] = useState<any>(null);
  
  // Estado para el nombre del portal
  const [titulo, setTitulo] = useState('');
  
  // Estado para las definiciones de columnas (basadas en el YAML)
  const [columns, setColumns] = useState<ColumnDefinition[]>([]);
  
  // Estado para los datos del formulario (filas de datos)
  const [formData, setFormData] = useState<FormData>({});
  
  // Estado para la primera hoja o catálogo activo
  const [activeCatalog, setActiveCatalog] = useState<string>('');
  
  // Estado para mostrar si estamos cargando
  const [loading, setLoading] = useState<boolean>(true);
  
  // Estado para la información de instalación
  const [instalacionInfo, setInstalacionInfo] = useState<any>(null);
  
  // Estado para el ID de la instalación
  const [instalacionId, setInstalacionId] = useState<number>(0);
  
  // Estado para mostrar el log de procesamiento
  const [showLog, setShowLog] = useState<boolean>(false);
  const [logUrl, setLogUrl] = useState<string>('');
  const [reportHtmlUrl, setReportHtmlUrl] = useState<string>('');
  const [reportJsonUrl, setReportJsonUrl] = useState<string>('');
  const [executionUuid, setExecutionUuid] = useState<string>('');
  
  // Cargar datos de la casilla al montar el componente
  useEffect(() => {
    if (uuid && casillaId) {
      fetchCasillaData();
    }
  }, [uuid, casillaId]);
  
  // Función para obtener los datos de la casilla
  const fetchCasillaData = async () => {
    try {
      setLoading(true);
      
      // Verificar acceso al portal primero
      const accessResponse = await fetch(`/api/portales/${uuid}/acceso`);
      if (!accessResponse.ok) {
        if (accessResponse.status === 404) {
          toast.error('Portal no encontrado');
          router.push('/');
          return;
        }
        const errorData = await accessResponse.json();
        toast.error(errorData.error || 'Error al verificar acceso al portal');
        router.push('/');
        return;
      }
      
      // Obtener datos de la casilla específica
      const response = await fetch(`/api/casillas/${casillaId}?uuid=${uuid}`);
      
      if (!response.ok) {
        throw new Error('No se pudo obtener información de la casilla');
      }
      
      const casillaData = await response.json();
      setCasilla(casillaData);
      
      // Establecer información de instalación
      if (casillaData.instalacion) {
        setInstalacionId(casillaData.instalacion.id);
        setInstalacionInfo({
          organizacion: casillaData.instalacion.organizacion,
          producto: casillaData.instalacion.producto,
          pais: casillaData.instalacion.pais
        });
        
        // Establecer título
        if (casillaData.instalacion.organizacion && 
            casillaData.instalacion.pais && 
            casillaData.instalacion.producto) {
          setTitulo(`${casillaData.instalacion.organizacion.nombre} - ${casillaData.instalacion.pais.nombre} - ${casillaData.instalacion.producto.nombre}`);
        }
      }
      
      // Analizar la estructura YAML
      parseYamlStructure(casillaData);
      
    } catch (error) {
      console.error('Error al cargar datos de la casilla:', error);
      toast.error('Error al cargar datos. Por favor, inténtelo de nuevo.');
    } finally {
      setLoading(false);
    }
  };
  
  // Función para analizar la estructura YAML y extraer definiciones de columnas
  const parseYamlStructure = (casillaData: any) => {
    try {
      // Obtener el contenido YAML de la casilla
      const yamlString = casillaData.yaml_contenido || casillaData.archivo_yaml_contenido;
      
      if (!yamlString) {
        toast.error('No se pudo obtener la estructura de datos para esta casilla.');
        return;
      }
      
      // Analizar el contenido YAML
      const yamlContent = yaml.parse(yamlString);
      
      // Obtener el primer catálogo disponible
      if (yamlContent.catalogs && Object.keys(yamlContent.catalogs).length > 0) {
        const catalogName = Object.keys(yamlContent.catalogs)[0];
        const catalog = yamlContent.catalogs[catalogName];
        
        setActiveCatalog(catalogName);
        
        // Inicializar objeto de datos del formulario para este catálogo
        const initialFormData: FormData = {};
        initialFormData[catalogName] = [];
        
        // Generar datos vacíos para las filas iniciales (5 filas por defecto)
        for (let i = 0; i < 5; i++) {
          initialFormData[catalogName].push({});
        }
        
        setFormData(initialFormData);
        
        // Extraer definiciones de columnas del catálogo
        if (catalog.columns || catalog.fields) {
          const columnDefinitions: ColumnDefinition[] = [];
          
          // Compatibilidad con diferentes formatos de YAML
          const columnsData = catalog.columns || catalog.fields;
          
          if (Array.isArray(columnsData)) {
            // Si es un array (formato fields)
            columnsData.forEach(field => {
              columnDefinitions.push({
                name: field.name,
                type: field.type || 'string',
                required: field.required || false,
                description: field.description || ''
              });
            });
          } else if (typeof columnsData === 'object') {
            // Si es un objeto (formato columns)
            Object.keys(columnsData).forEach(columnName => {
              const column = columnsData[columnName];
              columnDefinitions.push({
                name: columnName,
                type: column.type || 'string',
                required: column.required || false,
                description: column.description || ''
              });
            });
          }
          
          setColumns(columnDefinitions);
        } else {
          toast.warning('El catálogo no tiene definición de columnas.');
        }
      } else {
        toast.error('No se encontraron catálogos en la definición YAML.');
      }
    } catch (error) {
      console.error('Error al analizar la estructura YAML:', error);
      toast.error('Error al procesar la estructura de datos.');
    }
  };
  
  // Manejar cambios en los campos del formulario
  const handleInputChange = (rowIndex: number, columnName: string, value: any) => {
    if (!activeCatalog) return;
    
    setFormData(prevData => {
      const newData = {...prevData};
      // Asegurarse de que existe la propiedad para el catálogo actual
      if (!newData[activeCatalog]) {
        newData[activeCatalog] = [];
      }
      
      // Asegurarse de que existe la fila
      if (!newData[activeCatalog][rowIndex]) {
        newData[activeCatalog][rowIndex] = {};
      }
      
      // Actualizar el valor en la posición específica
      newData[activeCatalog][rowIndex][columnName] = value;
      
      return newData;
    });
  };
  
  // Añadir una nueva fila
  const addRow = () => {
    setFormData(prevData => {
      const newData = {...prevData};
      if (activeCatalog) {
        if (!newData[activeCatalog]) {
          newData[activeCatalog] = [];
        }
        newData[activeCatalog].push({});
      }
      return newData;
    });
  };
  
  // Eliminar una fila
  const removeRow = (rowIndex: number) => {
    setFormData(prevData => {
      const newData = {...prevData};
      if (activeCatalog && newData[activeCatalog]) {
        newData[activeCatalog] = newData[activeCatalog].filter((_, index) => index !== rowIndex);
      }
      return newData;
    });
  };
  
  // Validar datos antes de enviar
  const validateData = (): boolean => {
    if (!activeCatalog || !formData[activeCatalog]) return false;
    
    // Filtrar filas que tienen al menos un campo completado
    const filledRows = formData[activeCatalog].filter(row => 
      Object.values(row).some(value => value !== undefined && value !== '')
    );
    
    if (filledRows.length === 0) {
      toast.error('Debe completar al menos una fila de datos.');
      return false;
    }
    
    // Validar campos requeridos en las filas con datos
    let isValid = true;
    const requiredColumns = columns.filter(col => col.required).map(col => col.name);
    
    if (requiredColumns.length > 0) {
      filledRows.forEach((row, index) => {
        requiredColumns.forEach(colName => {
          if (!row[colName]) {
            toast.error(`Fila ${index + 1}: El campo "${colName}" es obligatorio.`);
            isValid = false;
          }
        });
      });
    }
    
    return isValid;
  };
  
  // Enviar datos al servidor
  const handleSubmit = async () => {
    if (!validateData()) return;
    
    // Filtrar filas vacías antes de enviar
    const dataToSend = {
      ...formData,
      [activeCatalog]: formData[activeCatalog].filter(row => 
        Object.values(row).some(value => value !== undefined && value !== '')
      )
    };
    
    setLoading(true);
    setShowLog(false); // Ocultar log antes de procesar
    
    try {
      // Llamar a la API para procesar los datos
      const response = await fetch(`/api/casillas/${casillaId}/datos-directos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          data: dataToSend,
          uuid: uuid,
          casilla_id: casillaId,
          instalacion_id: instalacionId
        })
      });
      
      if (!response.ok) {
        throw new Error(`Error al enviar datos: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      // Mostrar mensaje de éxito
      toast.success('Datos procesados correctamente');
      
      // Si hay UUID de ejecución y URL de log, mostrarlos
      if (result.execution_uuid && result.log_url) {
        setExecutionUuid(result.execution_uuid);
        setLogUrl(result.log_url);
        
        // Establecer URLs para los reportes HTML y JSON desde la respuesta
        setReportHtmlUrl(result.report_html_url || `/api/executions/${result.execution_uuid}/report-html`);
        setReportJsonUrl(result.report_json_url || `/api/executions/${result.execution_uuid}/report-json`);
        
        setShowLog(true);
      } else {
        // Si no hay log para mostrar, redirigir al portal
        router.push(`/portal-externo/${uuid}`);
      }
      
    } catch (error) {
      console.error('Error al enviar datos:', error);
      toast.error('Error al enviar los datos. Por favor, inténtelo de nuevo.');
    } finally {
      setLoading(false);
    }
  };
  
  // Regresar al portal
  const handleBack = () => {
    router.push(`/portal-externo/${uuid}`);
  };
  
  // Renderizar el input adecuado según el tipo de columna
  const renderInput = (column: ColumnDefinition, rowIndex: number, value: any) => {
    const inputProps = {
      id: `input-${column.name}-${rowIndex}`,
      name: `${column.name}-${rowIndex}`,
      className: "mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm",
      value: value || '',
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => handleInputChange(rowIndex, column.name, e.target.value),
      required: column.required
    };
    
    switch (column.type?.toLowerCase()) {
      case 'number':
      case 'numero':
        return <input type="number" {...inputProps} />;
      case 'date':
      case 'fecha':
        return <input type="date" {...inputProps} />;
      case 'boolean':
      case 'booleano':
        return (
          <select 
            {...inputProps}
            onChange={(e) => handleInputChange(rowIndex, column.name, e.target.value === 'true')}
          >
            <option value="">Seleccionar</option>
            <option value="true">Sí</option>
            <option value="false">No</option>
          </select>
        );
      default:
        return <input type="text" {...inputProps} />;
    }
  };
  
  return (
    <PortalLayout title={`${titulo} - Ingreso de datos`}>
      <div className="container mx-auto px-2 sm:px-4 py-6 max-w-full">
        {/* Botón para regresar */}
        <div className="mb-6 flex items-center">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <ArrowLeftIcon className="mr-2 h-4 w-4" />
            Volver al portal
          </button>
        </div>
        
        {/* Cabecera */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Introducir datos directamente</h1>
          {casilla && (
            <h2 className="text-lg text-gray-700">
              {casilla.nombre || casilla.nombreCompleto || casilla.nombre_yaml}
            </h2>
          )}
          {instalacionInfo && (
            <p className="text-sm text-gray-500">
              {instalacionInfo.organizacion?.nombre} - {instalacionInfo.pais?.nombre} - {instalacionInfo.producto?.nombre}
            </p>
          )}
        </div>
        
        {/* Contenido principal */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : showLog ? (
          // Mostrar el log después del procesamiento
          <div className="mt-4">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">Resultados del procesamiento</h2>
              <p className="mb-4">
                El archivo ha sido procesado. A continuación se muestra el log de validación:
              </p>
              
              {/* iframe para mostrar el log */}
              <div className="border rounded-md overflow-hidden">
                <iframe 
                  src={logUrl} 
                  className="w-full h-96 border-0" 
                  title="Log de procesamiento"
                ></iframe>
              </div>
              
              {/* Botones para ver/descargar reportes */}
              <div className="mt-4 flex flex-wrap gap-2">
                <h3 className="w-full text-lg font-semibold mb-2">Reportes disponibles:</h3>
                <a 
                  href={reportHtmlUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Ver reporte HTML
                </a>
                <a 
                  href={reportJsonUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Descargar reporte JSON
                </a>
              </div>
              
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={handleBack}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Volver al portal
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {columns.length > 0 ? (
              <div className="mt-4">
                <div className="overflow-x-auto bg-white rounded-lg shadow">
                  <table className="min-w-full divide-y divide-gray-300">
                    <thead className="bg-gray-50">
                      <tr>
                        {columns.map((column) => (
                          <th 
                            key={column.name}
                            scope="col" 
                            className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                          >
                            {column.name}
                            {column.required && <span className="text-red-500 ml-1">*</span>}
                            {column.description && (
                              <p className="text-xs font-normal text-gray-500">{column.description}</p>
                            )}
                          </th>
                        ))}
                        <th scope="col" className="relative px-3 py-3.5">
                          <span className="sr-only">Acciones</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {activeCatalog && formData[activeCatalog] && formData[activeCatalog].map((row, rowIndex) => (
                        <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          {columns.map((column) => (
                            <td key={`${rowIndex}-${column.name}`} className="whitespace-nowrap px-3 py-2 text-sm">
                              {renderInput(column, rowIndex, row[column.name])}
                            </td>
                          ))}
                          <td className="whitespace-nowrap px-3 py-2 text-sm text-right">
                            <button
                              type="button"
                              onClick={() => removeRow(rowIndex)}
                              className="text-red-600 hover:text-red-900"
                            >
                              Eliminar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                <div className="mt-4 flex justify-between">
                  <button
                    type="button"
                    onClick={addRow}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Añadir fila
                  </button>
                  
                  <div className="flex space-x-3">
                    <button
                      type="button"
                      onClick={handleBack}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmit}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    >
                      Enviar datos
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow p-6 text-center">
                <p className="text-gray-500">
                  No se pudo obtener la estructura de columnas para este catálogo.
                </p>
                <button
                  type="button"
                  onClick={handleBack}
                  className="mt-4 inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Volver al portal
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </PortalLayout>
  );
}