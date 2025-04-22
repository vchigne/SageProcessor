import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { ArrowLeftIcon, PlusIcon, PencilIcon, TableCellsIcon, AdjustmentsHorizontalIcon } from '@heroicons/react/24/outline';
import { Button } from '../../../../../ui/components';
import { toast } from 'react-toastify';

interface Column {
  name: string;
  type: string;
  required: boolean;
  primary: boolean;
  description: string;
  partitionKey?: boolean;
  sortKey?: boolean;
  customType?: string;
}

interface FileStructure {
  name: string;
  description: string;
  columns: Column[];
}

interface YamlStructure {
  id: number;
  name: string;
  description: string;
  files: FileStructure[];
}

interface Materialization {
  id: number;
  nombre: string;
  descripcion: string;
  casilla_id: number;
  configuracion: {
    formato: string;
    columnas: string[];
    primaryKey?: string[];
    partitionBy?: string[];
    destino: string;
    tablaDestino: string;
    estrategiaActualizacion?: string;
  };
}

export default function MaterializationsPage() {
  const router = useRouter();
  const { id } = router.query;
  const casilla_id = id ? parseInt(id as string) : null;
  
  const [materializations, setMaterializations] = useState<Materialization[]>([]);
  const [yamlStructure, setYamlStructure] = useState<YamlStructure | null>(null);
  const [loading, setLoading] = useState(true);
  const [casillaInfo, setCasillaInfo] = useState<any>(null);
  const [selectedFileIndex, setSelectedFileIndex] = useState<number>(0);
  const [editedColumns, setEditedColumns] = useState<Record<string, Column[]>>({});
  const [showColumnEditor, setShowColumnEditor] = useState<boolean>(false);
  const [selectedColumn, setSelectedColumn] = useState<Column | null>(null);
  const [selectedColumnIndex, setSelectedColumnIndex] = useState<number>(-1);

  useEffect(() => {
    if (!casilla_id || isNaN(casilla_id)) return;
    
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Obtener información de la casilla
        const casillaResponse = await fetch(`/api/admin/data-boxes/${casilla_id}`);
        
        if (casillaResponse.ok) {
          const casillaData = await casillaResponse.json();
          setCasillaInfo(casillaData);
        } else {
          console.error('Error al cargar información de la casilla:', casillaResponse.statusText);
          toast.error('Error al cargar información de la casilla');
        }
        
        // Obtener estructura YAML
        const yamlResponse = await fetch(`/api/admin/data-boxes/${casilla_id}/yaml-structure`);
        
        if (yamlResponse.ok) {
          const yamlData = await yamlResponse.json();
          setYamlStructure(yamlData);
          
          // Inicializar editedColumns con la estructura actual
          const initialEditedColumns: Record<string, Column[]> = {};
          if (yamlData.files) {
            yamlData.files.forEach((file: FileStructure) => {
              initialEditedColumns[file.name] = [...file.columns];
            });
          }
          setEditedColumns(initialEditedColumns);
        } else {
          console.error('Error al cargar estructura YAML:', yamlResponse.statusText);
          toast.error('Error al cargar estructura YAML');
        }
        
        // Obtener materializaciones
        const materializationsResponse = await fetch(`/api/admin/data-boxes/${casilla_id}/materializations`);
        
        if (materializationsResponse.ok) {
          const data = await materializationsResponse.json();
          setMaterializations(data);
        } else {
          console.error('Error al cargar materializaciones:', materializationsResponse.statusText);
          toast.error('Error al cargar materializaciones');
        }
      } catch (error) {
        console.error('Error:', error);
        toast.error('Error al cargar datos');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [casilla_id]);

  const handleNewMaterializationClick = () => {
    // Guardar primero los cambios en la estructura
    saveSemanticLayer();
    
    // Luego redirigir a la página de creación
    router.push({
      pathname: `/admin/data-boxes/${casilla_id}/materializations/create`,
      query: { fileIndex: selectedFileIndex }
    });
  };

  const handleEditMaterializationClick = (materializationId: number) => {
    router.push(`/admin/data-boxes/${casilla_id}/materializations/${materializationId}/edit`);
  };

  const handleDeleteMaterializationClick = async (materializationId: number) => {
    if (confirm('¿Está seguro que desea eliminar esta materialización? Esta acción no se puede deshacer.')) {
      try {
        const response = await fetch(`/api/admin/materializations/${materializationId}`, {
          method: 'DELETE',
        });
        
        if (response.ok) {
          toast.success('Materialización eliminada correctamente');
          // Actualizar lista
          setMaterializations(prev => prev.filter(m => m.id !== materializationId));
        } else {
          toast.error('Error al eliminar materialización');
        }
      } catch (error) {
        console.error('Error:', error);
        toast.error('Error al eliminar materialización');
      }
    }
  };

  const handleBackClick = () => {
    router.push('/admin/data-boxes');
  };

  const saveSemanticLayer = async () => {
    // Esta función guardaría los cambios realizados en la capa semántica
    // A través de un endpoint API (que tendríamos que crear)
    
    // Por ahora solo mostraremos un mensaje
    toast.info('Cambios en la capa semántica guardados');
    setShowColumnEditor(false);
  };

  const handleSelectFile = (index: number) => {
    setSelectedFileIndex(index);
  };

  const handleEditColumn = (column: Column, index: number) => {
    setSelectedColumn({...column});
    setSelectedColumnIndex(index);
    setShowColumnEditor(true);
  };

  const handleColumnChange = (field: string, value: any) => {
    if (selectedColumn) {
      setSelectedColumn({
        ...selectedColumn,
        [field]: value
      });
    }
  };

  const handleSaveColumnChanges = () => {
    if (!selectedColumn || selectedColumnIndex === -1 || !yamlStructure || !yamlStructure.files[selectedFileIndex]) return;
    
    const fileName = yamlStructure.files[selectedFileIndex].name;
    const newColumns = [...editedColumns[fileName]];
    newColumns[selectedColumnIndex] = selectedColumn;
    
    setEditedColumns({
      ...editedColumns,
      [fileName]: newColumns
    });
    
    setShowColumnEditor(false);
    setSelectedColumn(null);
    setSelectedColumnIndex(-1);
    
    toast.success('Cambios en la columna guardados');
  };

  const handleCancelColumnChanges = () => {
    setShowColumnEditor(false);
    setSelectedColumn(null);
    setSelectedColumnIndex(-1);
  };

  const getFileStructureForCurrentSelection = () => {
    if (!yamlStructure || !yamlStructure.files || yamlStructure.files.length === 0) {
      return null;
    }
    
    if (selectedFileIndex >= yamlStructure.files.length) {
      return yamlStructure.files[0];
    }
    
    return yamlStructure.files[selectedFileIndex];
  };

  const getColumnsForCurrentSelection = () => {
    const fileStructure = getFileStructureForCurrentSelection();
    if (!fileStructure) return [];
    
    return editedColumns[fileStructure.name] || fileStructure.columns;
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center mb-6">
          <Button
            onClick={handleBackClick}
            variant="outline"
            icon={<ArrowLeftIcon className="h-4 w-4 mr-2" />}
            className="mr-4"
          >
            Volver
          </Button>
          <h1 className="text-2xl font-bold">Cargando información...</h1>
        </div>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center mb-6">
        <Button
          onClick={handleBackClick}
          variant="outline"
          icon={<ArrowLeftIcon className="h-4 w-4 mr-2" />}
          className="mr-4"
        >
          Volver
        </Button>
        <h1 className="text-2xl font-bold">
          Materializaciones - {casillaInfo?.nombre || `Casilla ${casilla_id}`}
        </h1>
      </div>

      {/* Sección de Capa Semántica */}
      <div className="bg-white dark:bg-dark-card rounded-lg shadow-md p-6 mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Capa Semántica</h2>
          <Button
            onClick={saveSemanticLayer}
            variant="primary"
            size="sm"
          >
            Guardar Cambios
          </Button>
        </div>

        {yamlStructure && yamlStructure.files && yamlStructure.files.length > 0 ? (
          <>
            {/* Selector de archivos si hay más de uno */}
            {yamlStructure.files.length > 1 && (
              <div className="mb-6">
                <h3 className="text-lg font-medium mb-2">Seleccionar archivo:</h3>
                <div className="flex flex-wrap gap-2">
                  {yamlStructure.files.map((file, index) => (
                    <Button
                      key={index}
                      variant={selectedFileIndex === index ? "primary" : "outline"}
                      size="sm"
                      onClick={() => handleSelectFile(index)}
                    >
                      {file.name}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Estructura del archivo seleccionado */}
            <div className="mb-4">
              <h3 className="text-lg font-medium mb-2">
                {getFileStructureForCurrentSelection()?.name || 'Archivo'} - Columnas
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                {getFileStructureForCurrentSelection()?.description || 'Sin descripción'}
              </p>

              <div className="overflow-x-auto">
                <table className="min-w-full border border-gray-200 dark:border-gray-700">
                  <thead>
                    <tr className="bg-gray-100 dark:bg-gray-800">
                      <th className="py-2 px-4 border-b border-gray-200 dark:border-gray-700 text-left">Nombre</th>
                      <th className="py-2 px-4 border-b border-gray-200 dark:border-gray-700 text-left">Tipo</th>
                      <th className="py-2 px-4 border-b border-gray-200 dark:border-gray-700 text-left">Requerido</th>
                      <th className="py-2 px-4 border-b border-gray-200 dark:border-gray-700 text-left">Clave primaria</th>
                      <th className="py-2 px-4 border-b border-gray-200 dark:border-gray-700 text-left">Partición</th>
                      <th className="py-2 px-4 border-b border-gray-200 dark:border-gray-700 text-left">Descripción</th>
                      <th className="py-2 px-4 border-b border-gray-200 dark:border-gray-700 text-left">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getColumnsForCurrentSelection() && getColumnsForCurrentSelection().length > 0 ? (
                      getColumnsForCurrentSelection().map((column, index) => (
                        <tr key={index} className="border-b border-gray-200 dark:border-gray-700">
                          <td className="py-2 px-4">{column.name}</td>
                          <td className="py-2 px-4">{column.type}</td>
                          <td className="py-2 px-4">
                            {column.required ? (
                              <span className="text-green-600 dark:text-green-400">Sí</span>
                            ) : (
                              <span className="text-gray-400">No</span>
                            )}
                          </td>
                          <td className="py-2 px-4">
                            {column.primary ? (
                              <span className="text-green-600 dark:text-green-400">Sí</span>
                            ) : (
                              <span className="text-gray-400">No</span>
                            )}
                          </td>
                          <td className="py-2 px-4">
                            {column.partitionKey ? (
                              <span className="text-green-600 dark:text-green-400">Sí</span>
                            ) : (
                              <span className="text-gray-400">No</span>
                            )}
                          </td>
                          <td className="py-2 px-4">{column.description || '-'}</td>
                          <td className="py-2 px-4">
                            <button
                              onClick={() => handleEditColumn(column, index)}
                              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                            >
                              <PencilIcon className="h-5 w-5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="py-4 text-center text-gray-500 dark:text-gray-400">
                          No hay columnas definidas en este archivo.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-8 space-y-4">
            <p className="text-gray-500 dark:text-gray-400">No se encontró estructura YAML para esta casilla.</p>
            <p className="text-gray-500 dark:text-gray-400">
              Para continuar, es necesario definir la estructura de datos en el archivo YAML asociado a esta casilla.
            </p>
            <p className="text-gray-500 dark:text-gray-400">
              Por favor, contacte al administrador del sistema para configurar correctamente el formato de datos.
            </p>
          </div>
        )}
      </div>

      {/* Modal para editar columna */}
      {showColumnEditor && selectedColumn && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-dark-card rounded-lg p-6 max-w-lg w-full">
            <h3 className="text-lg font-medium mb-4">Editar Columna</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nombre
                </label>
                <input
                  type="text"
                  value={selectedColumn.name}
                  onChange={(e) => handleColumnChange('name', e.target.value)}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tipo de Dato
                </label>
                <select
                  value={selectedColumn.type}
                  onChange={(e) => handleColumnChange('type', e.target.value)}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md"
                >
                  <option value="string">Texto (string)</option>
                  <option value="number">Número (number)</option>
                  <option value="integer">Entero (integer)</option>
                  <option value="float">Decimal (float)</option>
                  <option value="boolean">Booleano (boolean)</option>
                  <option value="date">Fecha (date)</option>
                  <option value="datetime">Fecha y Hora (datetime)</option>
                  <option value="custom">Personalizado</option>
                </select>
              </div>
              {selectedColumn.type === 'custom' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Tipo Personalizado
                  </label>
                  <input
                    type="text"
                    value={selectedColumn.customType || ''}
                    onChange={(e) => handleColumnChange('customType', e.target.value)}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md"
                    placeholder="ej: decimal(10,2)"
                  />
                </div>
              )}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="required"
                  checked={selectedColumn.required}
                  onChange={(e) => handleColumnChange('required', e.target.checked)}
                  className="mr-2"
                />
                <label htmlFor="required" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Campo requerido
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="primary"
                  checked={selectedColumn.primary}
                  onChange={(e) => handleColumnChange('primary', e.target.checked)}
                  className="mr-2"
                />
                <label htmlFor="primary" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Clave primaria
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="partition"
                  checked={selectedColumn.partitionKey || false}
                  onChange={(e) => handleColumnChange('partitionKey', e.target.checked)}
                  className="mr-2"
                />
                <label htmlFor="partition" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Clave de partición
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Descripción
                </label>
                <textarea
                  value={selectedColumn.description}
                  onChange={(e) => handleColumnChange('description', e.target.value)}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md"
                  rows={3}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button 
                variant="outline" 
                onClick={handleCancelColumnChanges}
              >
                Cancelar
              </Button>
              <Button 
                variant="primary" 
                onClick={handleSaveColumnChanges}
              >
                Guardar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Sección de Materializaciones Existentes */}
      <div>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Materializaciones Configuradas</h2>
          <Button 
            onClick={handleNewMaterializationClick}
            icon={<PlusIcon className="h-5 w-5" />}
            variant="primary"
          >
            Nueva Materialización
          </Button>
        </div>

        {materializations.length === 0 ? (
          <div className="bg-white dark:bg-dark-card rounded-lg shadow-md p-6 text-center">
            <p className="text-gray-500 dark:text-gray-400">No hay materializaciones configuradas para esta casilla.</p>
            <p className="text-gray-500 dark:text-gray-400 mt-2">
              Crea una nueva materialización para convertir los datos procesados en formatos optimizados como Apache Iceberg o Hudi,
              o exportar a una base de datos relacional.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {materializations.map((materialization) => (
              <div 
                key={materialization.id} 
                className="bg-white dark:bg-dark-card rounded-lg shadow-md p-6"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-xl font-semibold">{materialization.nombre}</h2>
                    <p className="text-gray-600 dark:text-gray-300 mt-1">{materialization.descripcion}</p>
                  </div>
                  <div className="flex space-x-2">
                    <Button 
                      onClick={() => handleEditMaterializationClick(materialization.id)}
                      variant="outline"
                      size="sm"
                      icon={<PencilIcon className="h-4 w-4 mr-1" />}
                    >
                      Editar
                    </Button>
                    <Button 
                      onClick={() => handleDeleteMaterializationClick(materialization.id)}
                      variant="danger"
                      size="sm"
                    >
                      Eliminar
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-medium">Formato:</p>
                    <p className="text-gray-600 dark:text-gray-300">
                      {materialization.configuracion.formato}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium">Destino:</p>
                    <p className="text-gray-600 dark:text-gray-300">
                      {materialization.configuracion.destino}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium">Tabla de destino:</p>
                    <p className="text-gray-600 dark:text-gray-300">
                      {materialization.configuracion.tablaDestino}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium">Estrategia de actualización:</p>
                    <p className="text-gray-600 dark:text-gray-300">
                      {materialization.configuracion.estrategiaActualizacion || 'Reemplazar'}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium">Columnas:</p>
                    <p className="text-gray-600 dark:text-gray-300">
                      {materialization.configuracion.columnas.join(', ')}
                    </p>
                  </div>
                  {materialization.configuracion.primaryKey && (
                    <div>
                      <p className="font-medium">Clave primaria:</p>
                      <p className="text-gray-600 dark:text-gray-300">
                        {materialization.configuracion.primaryKey.join(', ')}
                      </p>
                    </div>
                  )}
                  {materialization.configuracion.partitionBy && (
                    <div>
                      <p className="font-medium">Particionado por:</p>
                      <p className="text-gray-600 dark:text-gray-300">
                        {materialization.configuracion.partitionBy.join(', ')}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}