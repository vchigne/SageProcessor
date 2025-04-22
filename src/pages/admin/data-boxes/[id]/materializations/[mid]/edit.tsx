import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { Button } from '../../../../../../ui/components';
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

export default function EditMaterializationPage() {
  const router = useRouter();
  const { id, mid } = router.query;
  const casilla_id = id ? parseInt(id as string) : null;
  const materializationId = mid ? parseInt(mid as string) : null;
  
  const [yamlStructure, setYamlStructure] = useState<YamlStructure | null>(null);
  const [materialization, setMaterialization] = useState<Materialization | null>(null);
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
    if (!casilla_id || isNaN(casilla_id) || !materializationId || isNaN(materializationId)) return;
    
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
        } else {
          console.error('Error al cargar estructura YAML:', yamlResponse.statusText);
          toast.error('Error al cargar estructura YAML');
        }
        
        // Obtener datos de la materialización
        const materializationResponse = await fetch(`/api/admin/materializations/${materializationId}`);
        
        if (materializationResponse.ok) {
          const materializationData = await materializationResponse.json();
          setMaterialization(materializationData);
          
          // Preparar datos del formulario
          const config = materializationData.configuracion || {};
          setFormData({
            nombre: materializationData.nombre || '',
            descripcion: materializationData.descripcion || '',
            formato: config.formato || 'parquet',
            destino: config.destino || 'archivo',
            tablaDestino: config.tablaDestino || '',
            estrategiaActualizacion: config.estrategiaActualizacion || 'reemplazar',
            columnas: config.columnas || [],
            primaryKey: config.primaryKey || [],
            partitionBy: config.partitionBy || []
          });
        } else {
          console.error('Error al cargar materialización:', materializationResponse.statusText);
          toast.error('Error al cargar materialización');
        }
      } catch (error) {
        console.error('Error al cargar datos:', error);
        toast.error('Error al cargar datos');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [casilla_id, materializationId]);
  
  useEffect(() => {
    if (!yamlStructure || !formData.columnas) return;
    
    // Inicializar selección de columnas basado en los datos cargados
    const initialColumnSelection: {[key: string]: boolean} = {};
    const initialPrimaryKeySelection: {[key: string]: boolean} = {};
    const initialPartitionSelection: {[key: string]: boolean} = {};
    
    if (yamlStructure.files && yamlStructure.files.length > 0) {
      const allColumns = yamlStructure.files.flatMap(file => file.columns.map(col => col.name));
      
      allColumns.forEach(columnName => {
        initialColumnSelection[columnName] = formData.columnas.includes(columnName);
        initialPrimaryKeySelection[columnName] = formData.primaryKey?.includes(columnName) || false;
        initialPartitionSelection[columnName] = formData.partitionBy?.includes(columnName) || false;
      });
      
      setColumnSelection(initialColumnSelection);
      setPrimaryKeySelection(initialPrimaryKeySelection);
      setPartitionSelection(initialPartitionSelection);
    }
  }, [yamlStructure, formData.columnas, formData.primaryKey, formData.partitionBy]);
  
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
    
    const allColumns: {[key: string]: boolean} = {};
    yamlStructure.files.forEach(file => {
      file.columns.forEach(column => {
        allColumns[column.name] = true;
      });
    });
    
    setColumnSelection(allColumns);
    updateSelectedColumnsInForm(allColumns, primaryKeySelection, partitionSelection);
  };
  
  const handleDeselectAllColumns = () => {
    if (!yamlStructure || !yamlStructure.files) return;
    
    const noColumns: {[key: string]: boolean} = {};
    yamlStructure.files.forEach(file => {
      file.columns.forEach(column => {
        noColumns[column.name] = false;
      });
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
      
      const response = await fetch(`/api/admin/materializations/${materializationId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(materializacionData),
      });
      
      if (response.ok) {
        toast.success('Materialización actualizada correctamente');
        router.push(`/admin/data-boxes/${casilla_id}/materializations`);
      } else {
        const error = await response.json();
        toast.error(`Error al actualizar materialización: ${error.message || 'Error desconocido'}`);
      }
    } catch (error) {
      console.error('Error al actualizar materialización:', error);
      toast.error('Error al actualizar materialización');
    } finally {
      setFormSubmitting(false);
    }
  };
  
  const handleCancel = () => {
    router.push(`/admin/data-boxes/${casilla_id}/materializations`);
  };
  
  const getAllColumns = (): Column[] => {
    if (!yamlStructure || !yamlStructure.files) return [];
    
    return yamlStructure.files.flatMap(file => file.columns);
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
          Editar Materialización - {formData.nombre}
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
                Casilla de Origen
              </label>
              <input
                type="text"
                value={casillaInfo?.nombre || `Casilla ${casilla_id}`}
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
                Nombre de Tabla/Archivo Destino *
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
          
          <div className="overflow-x-auto">
            <table className="min-w-full border border-gray-200 dark:border-gray-700">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-800">
                  <th className="py-2 px-4 border-b border-gray-200 dark:border-gray-700 text-left">Incluir</th>
                  <th className="py-2 px-4 border-b border-gray-200 dark:border-gray-700 text-left">Columna</th>
                  <th className="py-2 px-4 border-b border-gray-200 dark:border-gray-700 text-left">Tipo</th>
                  <th className="py-2 px-4 border-b border-gray-200 dark:border-gray-700 text-left">Clave Primaria</th>
                  <th className="py-2 px-4 border-b border-gray-200 dark:border-gray-700 text-left">Partición</th>
                </tr>
              </thead>
              <tbody>
                {getAllColumns().map((column, index) => (
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
            {formSubmitting ? 'Guardando...' : 'Actualizar Materialización'}
          </Button>
        </div>
      </form>
    </div>
  );
}