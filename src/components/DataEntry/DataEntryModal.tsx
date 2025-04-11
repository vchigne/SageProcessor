import React, { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';
import yaml from 'yaml';

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

interface DataEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  casilla: any;
  uuid: string;
  instalacionId: number;
  instalacionInfo: any;
}

export default function DataEntryModal({
  isOpen,
  onClose,
  casilla,
  uuid,
  instalacionId,
  instalacionInfo
}: DataEntryModalProps) {
  // Estado para las definiciones de columnas (basadas en el YAML)
  const [columns, setColumns] = useState<ColumnDefinition[]>([]);
  
  // Estado para los datos del formulario (filas de datos)
  const [formData, setFormData] = useState<FormData>({});
  
  // Estado para la primera hoja o catálogo activo
  const [activeCatalog, setActiveCatalog] = useState<string>('');
  
  // Estado para mostrar si estamos cargando
  const [loading, setLoading] = useState<boolean>(true);
  
  // Estado para el número de filas a mostrar inicialmente
  const [rowCount, setRowCount] = useState<number>(5);
  
  // Analizar el YAML al montar el componente
  useEffect(() => {
    if (isOpen && casilla) {
      parseYamlStructure();
    }
  }, [isOpen, casilla]);
  
  // Función para analizar la estructura YAML y extraer definiciones de columnas
  const parseYamlStructure = () => {
    setLoading(true);
    
    try {
      // Obtener el contenido YAML de la casilla
      const yamlString = casilla.yaml_contenido || casilla.archivo_yaml_contenido;
      
      if (!yamlString) {
        toast.error('No se pudo obtener la estructura de datos para esta casilla.');
        setLoading(false);
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
        
        // Generar datos vacíos para las filas iniciales
        for (let i = 0; i < rowCount; i++) {
          initialFormData[catalogName].push({});
        }
        
        setFormData(initialFormData);
        
        // Extraer definiciones de columnas del catálogo
        if (catalog.columns) {
          const columnDefinitions: ColumnDefinition[] = [];
          
          Object.keys(catalog.columns).forEach(columnName => {
            const column = catalog.columns[columnName];
            columnDefinitions.push({
              name: columnName,
              type: column.type || 'string',
              required: column.required || false,
              description: column.description || ''
            });
          });
          
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
    } finally {
      setLoading(false);
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
    
    try {
      // Llamar a la API para procesar los datos
      const response = await fetch(`/api/casillas/${casilla.id}/datos-directos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          data: dataToSend,
          uuid: uuid,
          casilla_id: casilla.id,
          instalacion_id: instalacionId
        })
      });
      
      if (!response.ok) {
        throw new Error(`Error al enviar datos: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      // Mostrar mensaje de éxito y cerrar el modal
      toast.success('Datos enviados correctamente');
      onClose();
      
    } catch (error) {
      console.error('Error al enviar datos:', error);
      toast.error('Error al enviar los datos. Por favor, inténtelo de nuevo.');
    } finally {
      setLoading(false);
    }
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
    
    switch (column.type.toLowerCase()) {
      case 'number':
        return <input type="number" {...inputProps} />;
      case 'date':
        return <input type="date" {...inputProps} />;
      case 'boolean':
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
  
  if (!isOpen) return null;
  
  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      className="fixed inset-0 z-10 overflow-y-auto"
    >
      <div className="flex min-h-screen items-center justify-center px-4">
        <Dialog.Overlay className="fixed inset-0 bg-black opacity-30" />
        
        <div className="relative mx-auto w-full max-w-6xl rounded-xl bg-white p-6 shadow-xl">
          <div className="absolute right-4 top-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none"
            >
              <span className="sr-only">Cerrar</span>
              <XMarkIcon className="h-6 w-6" aria-hidden="true" />
            </button>
          </div>
          
          <Dialog.Title as="h3" className="text-2xl font-bold text-gray-900 mb-4">
            Introducir datos directamente
          </Dialog.Title>
          
          <div className="mb-4">
            <h4 className="text-lg font-semibold">{casilla.nombre || casilla.nombreCompleto || casilla.nombre_yaml}</h4>
            {instalacionInfo && (
              <p className="text-sm text-gray-500">
                {instalacionInfo.organizacion?.nombre} - {instalacionInfo.pais?.nombre} - {instalacionInfo.producto?.nombre}
              </p>
            )}
          </div>
          
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <>
              {columns.length > 0 ? (
                <div className="mt-4">
                  <div className="overflow-x-auto">
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
                            </th>
                          ))}
                          <th scope="col" className="relative px-3 py-3.5">
                            <span className="sr-only">Acciones</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {activeCatalog && formData[activeCatalog] && formData[activeCatalog].map((row, rowIndex) => (
                          <tr key={rowIndex}>
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
                        onClick={onClose}
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
                <div className="flex justify-center items-center h-64">
                  <p className="text-gray-500">
                    No se pudo obtener la estructura de columnas para este catálogo.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Dialog>
  );
}