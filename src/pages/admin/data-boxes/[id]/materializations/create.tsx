import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
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

export default function CreateMaterializationPage() {
  const router = useRouter();
  const { id, fileIndex } = router.query;
  const casilla_id = id ? parseInt(id as string) : null;
  const selectedFileIndex = fileIndex ? parseInt(fileIndex as string) : 0;
  
  const [yamlStructure, setYamlStructure] = useState<YamlStructure | null>(null);
  const [casillaInfo, setCasillaInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [formSubmitting, setFormSubmitting] = useState(false);
  
  // Formulario de materialización
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    formato: 'parquet',
    destino: 'archivo',
    tablaDestino: '',
    estrategiaActualizacion: 'reemplazar',
    columnas: [] as string[],
    primaryKey: [] as string[],
    partitionBy: [] as string[]
  });
  
  // Lista de destinos disponibles
  const [destinosDisponibles, setDestinosDisponibles] = useState([
    { id: 'archivo', nombre: 'Archivo (S3, Azure, GCP, SFTP)' },
    { id: 'postgres', nombre: 'PostgreSQL' },
    { id: 'mysql', nombre: 'MySQL/MariaDB' },
    { id: 'sqlserver', nombre: 'SQL Server' },
    { id: 'oracle', nombre: 'Oracle Database' },
    { id: 'snowflake', nombre: 'Snowflake' },
    { id: 'bigquery', nombre: 'Google BigQuery' },
    { id: 'redshift', nombre: 'Amazon Redshift' }
  ]);
  
  // Lista de formatos disponibles según el destino
  const formatosPorDestino = {
    archivo: [
      { id: 'parquet', nombre: 'Apache Parquet' },
      { id: 'iceberg', nombre: 'Apache Iceberg' },
      { id: 'hudi', nombre: 'Apache Hudi' },
      { id: 'csv', nombre: 'CSV' },
      { id: 'json', nombre: 'JSON' },
      { id: 'avro', nombre: 'Apache Avro' }
    ],
    base_datos: [
      { id: 'tabla', nombre: 'Tabla' }
    ]
  };
  
  // Selección de columnas
  const [columnSelection, setColumnSelection] = useState<{[key: string]: boolean}>({});
  const [primaryKeySelection, setPrimaryKeySelection] = useState<{[key: string]: boolean}>({});
  const [partitionSelection, setPartitionSelection] = useState<{[key: string]: boolean}>({});
  
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
          
          // Usar el nombre de la casilla como nombre predeterminado para la materialización
          setFormData(prev => ({
            ...prev,
            nombre: `Materialización ${casillaData.nombre || casilla_id}`,
            tablaDestino: casillaData.nombre?.toLowerCase().replace(/\s+/g, '_') || `tabla_${casilla_id}`
          }));
        } else {
          console.error('Error al cargar información de la casilla:', casillaResponse.statusText);
          toast.error('Error al cargar información de la casilla');
        }
        
        // Obtener estructura YAML
        const yamlResponse = await fetch(`/api/admin/data-boxes/${casilla_id}/yaml-structure`);
        
        if (yamlResponse.ok) {
          const yamlData = await yamlResponse.json();
          setYamlStructure(yamlData);
          
          // Inicializar selección de columnas si hay estructura YAML
          if (yamlData.files && yamlData.files.length > 0) {
            const fileToUse = yamlData.files[selectedFileIndex] || yamlData.files[0];
            
            // Inicializar todas las columnas como seleccionadas
            const initialColumnSelection: {[key: string]: boolean} = {};
            const initialPrimaryKeySelection: {[key: string]: boolean} = {};
            const initialPartitionSelection: {[key: string]: boolean} = {};
            
            fileToUse.columns.forEach((column: Column) => {
              initialColumnSelection[column.name] = true;
              initialPrimaryKeySelection[column.name] = column.primary || false;
              initialPartitionSelection[column.name] = column.partitionKey || false;
            });
            
            setColumnSelection(initialColumnSelection);
            setPrimaryKeySelection(initialPrimaryKeySelection);
            setPartitionSelection(initialPartitionSelection);
            
            // Actualizar las columnas seleccionadas en el formulario
            updateSelectedColumnsInForm(initialColumnSelection, initialPrimaryKeySelection, initialPartitionSelection);
          }
        } else {
          console.error('Error al cargar estructura YAML:', yamlResponse.statusText);
          toast.error('Error al cargar estructura YAML');
        }
      } catch (error) {
        console.error('Error al cargar datos:', error);
        toast.error('Error al cargar datos');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [casilla_id, selectedFileIndex]);
  
  const updateSelectedColumnsInForm = (
    columns: {[key: string]: boolean}, 
    primaryKeys: {[key: string]: boolean}, 
    partitions: {[key: string]: boolean}
  ) => {
    const selectedColumns = Object.keys(columns).filter(name => columns[name]);
    const selectedPrimaryKeys = Object.keys(primaryKeys).filter(name => primaryKeys[name]);
    const selectedPartitions = Object.keys(partitions).filter(name => partitions[name]);
    
    setFormData(prev => ({
      ...prev,
      columnas: selectedColumns,
      primaryKey: selectedPrimaryKeys,
      partitionBy: selectedPartitions
    }));
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleColumnSelectionChange = (columnName: string, checked: boolean) => {
    const newColumnSelection = { ...columnSelection, [columnName]: checked };
    setColumnSelection(newColumnSelection);
    
    // Si se deselecciona una columna, también quitar de claves primarias y particiones
    if (!checked) {
      const newPrimaryKeySelection = { ...primaryKeySelection, [columnName]: false };
      const newPartitionSelection = { ...partitionSelection, [columnName]: false };
      setPrimaryKeySelection(newPrimaryKeySelection);
      setPartitionSelection(newPartitionSelection);
      
      updateSelectedColumnsInForm(newColumnSelection, newPrimaryKeySelection, newPartitionSelection);
    } else {
      updateSelectedColumnsInForm(newColumnSelection, primaryKeySelection, partitionSelection);
    }
  };
  
  const handlePrimaryKeyChange = (columnName: string, checked: boolean) => {
    const newPrimaryKeySelection = { ...primaryKeySelection, [columnName]: checked };
    setPrimaryKeySelection(newPrimaryKeySelection);
    
    // Si se marca como clave primaria, asegurarse de que la columna esté seleccionada
    if (checked && !columnSelection[columnName]) {
      const newColumnSelection = { ...columnSelection, [columnName]: true };
      setColumnSelection(newColumnSelection);
      updateSelectedColumnsInForm(newColumnSelection, newPrimaryKeySelection, partitionSelection);
    } else {
      updateSelectedColumnsInForm(columnSelection, newPrimaryKeySelection, partitionSelection);
    }
  };
  
  const handlePartitionChange = (columnName: string, checked: boolean) => {
    const newPartitionSelection = { ...partitionSelection, [columnName]: checked };
    setPartitionSelection(newPartitionSelection);
    
    // Si se marca como partición, asegurarse de que la columna esté seleccionada
    if (checked && !columnSelection[columnName]) {
      const newColumnSelection = { ...columnSelection, [columnName]: true };
      setColumnSelection(newColumnSelection);
      updateSelectedColumnsInForm(newColumnSelection, primaryKeySelection, newPartitionSelection);
    } else {
      updateSelectedColumnsInForm(columnSelection, primaryKeySelection, newPartitionSelection);
    }
  };
  
  const handleSelectAllColumns = () => {
    if (!yamlStructure || !yamlStructure.files) return;
    
    const fileToUse = yamlStructure.files[selectedFileIndex] || yamlStructure.files[0];
    const allColumns: {[key: string]: boolean} = {};
    fileToUse.columns.forEach(column => {
      allColumns[column.name] = true;
    });
    
    setColumnSelection(allColumns);
    updateSelectedColumnsInForm(allColumns, primaryKeySelection, partitionSelection);
  };
  
  const handleDeselectAllColumns = () => {
    if (!yamlStructure || !yamlStructure.files) return;
    
    const fileToUse = yamlStructure.files[selectedFileIndex] || yamlStructure.files[0];
    const noColumns: {[key: string]: boolean} = {};
    fileToUse.columns.forEach(column => {
      noColumns[column.name] = false;
    });
    
    setColumnSelection(noColumns);
    setPrimaryKeySelection(noColumns);
    setPartitionSelection(noColumns);
    
    updateSelectedColumnsInForm(noColumns, noColumns, noColumns);
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.columnas.length === 0) {
      toast.error('Debe seleccionar al menos una columna');
      return;
    }
    
    if (formData.nombre.trim() === '') {
      toast.error('El nombre de la materialización es requerido');
      return;
    }
    
    if (formData.tablaDestino.trim() === '') {
      toast.error('El nombre de la tabla o archivo de destino es requerido');
      return;
    }
    
    try {
      setFormSubmitting(true);
      
      const materializacionData = {
        nombre: formData.nombre,
        descripcion: formData.descripcion,
        casilla_id: casilla_id,
        configuracion: {
          formato: formData.formato,
          columnas: formData.columnas,
          primaryKey: formData.primaryKey.length > 0 ? formData.primaryKey : undefined,
          partitionBy: formData.partitionBy.length > 0 ? formData.partitionBy : undefined,
          destino: formData.destino,
          tablaDestino: formData.tablaDestino,
          estrategiaActualizacion: formData.estrategiaActualizacion
        }
      };
      
      const response = await fetch('/api/admin/materializations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(materializacionData),
      });
      
      if (response.ok) {
        toast.success('Materialización creada correctamente');
        router.push(`/admin/data-boxes/${casilla_id}/materializations`);
      } else {
        const error = await response.json();
        toast.error(`Error al crear materialización: ${error.message || 'Error desconocido'}`);
      }
    } catch (error) {
      console.error('Error al crear materialización:', error);
      toast.error('Error al crear materialización');
    } finally {
      setFormSubmitting(false);
    }
  };
  
  const handleCancel = () => {
    router.push(`/admin/data-boxes/${casilla_id}/materializations`);
  };
  
  const getColumnTypeLabel = (type: string): string => {
    const typeMap: {[key: string]: string} = {
      'string': 'Texto',
      'number': 'Número',
      'integer': 'Entero',
      'float': 'Decimal',
      'boolean': 'Booleano',
      'date': 'Fecha',
      'datetime': 'Fecha y hora',
      'timestamp': 'Marca de tiempo',
      'array': 'Arreglo',
      'object': 'Objeto'
    };
    
    return typeMap[type] || type;
  };
  
  const getSelectedFile = (): FileStructure | null => {
    if (!yamlStructure || !yamlStructure.files || yamlStructure.files.length === 0) {
      return null;
    }
    
    if (selectedFileIndex >= yamlStructure.files.length) {
      return yamlStructure.files[0];
    }
    
    return yamlStructure.files[selectedFileIndex];
  };
  
  const getFormatosDisponibles = () => {
    const esBaseDatos = formData.destino !== 'archivo';
    return esBaseDatos ? formatosPorDestino.base_datos : formatosPorDestino.archivo;
  };
  
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center mb-6">
          <Button
            onClick={handleCancel}
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
  
  const selectedFile = getSelectedFile();
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center mb-6">
        <Button
          onClick={handleCancel}
          variant="outline"
          icon={<ArrowLeftIcon className="h-4 w-4 mr-2" />}
          className="mr-4"
        >
          Volver
        </Button>
        <h1 className="text-2xl font-bold">
          Nueva Materialización - {casillaInfo?.nombre || `Casilla ${casilla_id}`}
        </h1>
      </div>
      
      <form onSubmit={handleSubmit}>
        <div className="bg-white dark:bg-dark-card rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Información General</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nombre de la Materialización *
              </label>
              <input
                type="text"
                name="nombre"
                value={formData.nombre}
                onChange={handleInputChange}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Origen de Datos
              </label>
              <input
                type="text"
                value={selectedFile?.name || 'Sin archivo seleccionado'}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-100 dark:bg-gray-700"
                disabled
              />
            </div>
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Descripción
            </label>
            <textarea
              name="descripcion"
              value={formData.descripcion}
              onChange={handleInputChange}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md"
              rows={2}
            />
          </div>
        </div>
        
        <div className="bg-white dark:bg-dark-card rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Configuración de Destino</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tipo de Destino *
              </label>
              <select
                name="destino"
                value={formData.destino}
                onChange={handleInputChange}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md"
                required
              >
                {destinosDisponibles.map(destino => (
                  <option key={destino.id} value={destino.id}>
                    {destino.nombre}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Formato *
              </label>
              <select
                name="formato"
                value={formData.formato}
                onChange={handleInputChange}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md"
                required
              >
                {getFormatosDisponibles().map(formato => (
                  <option key={formato.id} value={formato.id}>
                    {formato.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nombre de Tabla/Archivo en Origen
              </label>
              <input
                type="text"
                value={selectedFile?.name || 'Sin origen seleccionado'}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-100 dark:bg-gray-700"
                disabled
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nombre de Tabla/Archivo en Destino *
              </label>
              <input
                type="text"
                name="tablaDestino"
                value={formData.tablaDestino}
                onChange={handleInputChange}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Estrategia de Actualización
              </label>
              <select
                name="estrategiaActualizacion"
                value={formData.estrategiaActualizacion}
                onChange={handleInputChange}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md"
              >
                <option value="reemplazar">Reemplazar (Truncate + Insert)</option>
                <option value="upsert">Upsert (Actualizar existentes, insertar nuevos)</option>
                <option value="append">Append (Solo agregar registros nuevos)</option>
                <option value="merge">Merge (Control detallado con condiciones)</option>
              </select>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-dark-card rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Selección de Columnas</h2>
            <div className="flex space-x-2">
              <Button 
                type="button"
                onClick={handleSelectAllColumns}
                variant="outline"
                size="sm"
              >
                Seleccionar Todo
              </Button>
              <Button 
                type="button"
                onClick={handleDeselectAllColumns}
                variant="outline"
                size="sm"
              >
                Deseleccionar Todo
              </Button>
            </div>
          </div>
          
          {selectedFile ? (
            <div className="overflow-x-auto">
              <table className="min-w-full border border-gray-200 dark:border-gray-700">
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-800">
                    <th className="py-2 px-4 border-b border-gray-200 dark:border-gray-700 text-left">Incluir</th>
                    <th className="py-2 px-4 border-b border-gray-200 dark:border-gray-700 text-left">Columna Origen</th>
                    <th className="py-2 px-4 border-b border-gray-200 dark:border-gray-700 text-left">Columna Destino</th>
                    <th className="py-2 px-4 border-b border-gray-200 dark:border-gray-700 text-left">Tipo</th>
                    <th className="py-2 px-4 border-b border-gray-200 dark:border-gray-700 text-left">Clave Primaria</th>
                    <th className="py-2 px-4 border-b border-gray-200 dark:border-gray-700 text-left">Partición</th>
                    <th className="py-2 px-4 border-b border-gray-200 dark:border-gray-700 text-left">Descripción</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedFile.columns.map((column, index) => (
                    <tr key={index} className="border-b border-gray-200 dark:border-gray-700">
                      <td className="py-2 px-4">
                        <input
                          type="checkbox"
                          checked={!!columnSelection[column.name]}
                          onChange={(e) => handleColumnSelectionChange(column.name, e.target.checked)}
                          className="form-checkbox h-5 w-5 text-indigo-600"
                        />
                      </td>
                      <td className="py-2 px-4 font-medium">{column.name}</td>
                      <td className="py-2 px-4">
                        <input
                          type="text"
                          placeholder={column.name}
                          value={column.targetName || ''}
                          onChange={(e) => {
                            // Crear una copia modificada de la columna
                            const updatedColumn = { ...column, targetName: e.target.value };
                            // Actualizar la columna en el archivo seleccionado
                            const updatedColumns = selectedFile.columns.map((c, i) => 
                              i === index ? updatedColumn : c
                            );
                            // Actualizar el archivo seleccionado con las columnas actualizadas
                            setYamlStructure(prev => {
                              const updatedFiles = prev.files.map((file, i) => 
                                i === selectedFileIndex ? { ...file, columns: updatedColumns } : file
                              );
                              return { ...prev, files: updatedFiles };
                            });
                          }}
                          disabled={!columnSelection[column.name]}
                          className="w-full p-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm"
                        />
                      </td>
                      <td className="py-2 px-4">{getColumnTypeLabel(column.type)}</td>
                      <td className="py-2 px-4">
                        <input
                          type="checkbox"
                          checked={!!primaryKeySelection[column.name]}
                          onChange={(e) => handlePrimaryKeyChange(column.name, e.target.checked)}
                          disabled={!columnSelection[column.name]}
                          className="form-checkbox h-5 w-5 text-indigo-600"
                        />
                      </td>
                      <td className="py-2 px-4">
                        <input
                          type="checkbox"
                          checked={!!partitionSelection[column.name]}
                          onChange={(e) => handlePartitionChange(column.name, e.target.checked)}
                          disabled={!columnSelection[column.name]}
                          className="form-checkbox h-5 w-5 text-indigo-600"
                        />
                      </td>
                      <td className="py-2 px-4 text-gray-600 dark:text-gray-300">
                        {column.description || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400">No hay columnas disponibles para seleccionar.</p>
            </div>
          )}
        </div>
        
        <div className="flex justify-end space-x-4">
          <Button
            type="button"
            onClick={handleCancel}
            variant="outline"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={formSubmitting}
          >
            {formSubmitting ? 'Guardando...' : 'Guardar Materialización'}
          </Button>
        </div>
      </form>
    </div>
  );
}