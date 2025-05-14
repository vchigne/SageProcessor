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
  const { id, mid, fileIndex } = router.query;
  const casilla_id = id ? parseInt(id as string) : null;
  const materializationId = mid ? parseInt(mid as string) : null;
  const preselectedFileIndex = fileIndex ? parseInt(fileIndex as string) : 0;
  
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
    partitionBy: [] as string[],
    activo: true,
    columnMappings: [] as {originName: string, targetName: string}[]
  });
  
  // Tipos de destinos disponibles
  const [tiposDestino, setTiposDestino] = useState([
    { id: 'archivo', nombre: 'Archivo (Nube)' },
    { id: 'base_datos', nombre: 'Base de Datos' }
  ]);
  
  // Proveedores de destino físico (nubes y bases de datos)
  const [proveedoresDestino, setProveedoresDestino] = useState<{
    clouds: Array<{id: number, nombre: string, tipo: string, activo: boolean}>,
    databases: Array<{id: number, nombre: string, base_datos: string, activo: boolean}>
  }>({
    clouds: [],
    databases: []
  });
  
  // ID del proveedor seleccionado (nube o base de datos)
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState<number | null>(null);
  
  // Lista de destinos disponibles (se mantiene por compatibilidad)
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
  
  // Selección de archivo
  const [selectedFileIndex, setSelectedFileIndex] = useState<number>(preselectedFileIndex);
  
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
        
        // Obtener destinos disponibles (nubes y bases de datos)
        const destinationsResponse = await fetch('/api/admin/materializations/destinations');
        
        if (destinationsResponse.ok) {
          const destinationsData = await destinationsResponse.json();
          setProveedoresDestino(destinationsData);
        } else {
          console.error('Error al cargar destinos:', destinationsResponse.statusText);
          toast.error('Error al cargar destinos disponibles');
        }
        
        // Obtener datos de la materialización
        const materializationResponse = await fetch(`/api/admin/materializations/${materializationId}`);
        
        if (materializationResponse.ok) {
          const materializationData = await materializationResponse.json();
          setMaterialization(materializationData);
          
          // Preparar datos del formulario
          const config = materializationData.configuracion || {};
          
          // Detectar el proveedor seleccionado de la configuración actual
          let provId = null;
          if (config.proveedorId) {
            provId = config.proveedorId;
            setProveedorSeleccionado(config.proveedorId);
          } else if (config.tipoProveedor === 'cloud' && config.destino_id) {
            provId = config.destino_id;
            setProveedorSeleccionado(config.destino_id);
          } else if (config.destination_id) {
            provId = config.destination_id;
            setProveedorSeleccionado(config.destination_id);
          }
          
          setFormData({
            nombre: materializationData.nombre || '',
            descripcion: materializationData.descripcion || '',
            formato: config.formato || 'parquet',
            destino: config.destino || 'archivo',
            tablaDestino: config.tablaDestino || '',
            estrategiaActualizacion: config.estrategiaActualizacion || 'reemplazar',
            columnas: config.columnas || [],
            primaryKey: config.primaryKey || [],
            partitionBy: config.partitionBy || [],
            activo: materializationData.activo !== false,
            columnMappings: config.columnMappings || []
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
  
  // Actualizar sugerencia de nombre de tabla cuando cambia el archivo seleccionado
  useEffect(() => {
    const selectedFile = getSelectedFile();
    
    // Siempre actualizar el nombre de tabla al cambiar el archivo seleccionado
    if (selectedFile) {
      setFormData(prev => ({
        ...prev,
        tablaDestino: selectedFile.name,
        nombre: `Materialización ${selectedFile.name}`
      }));
    }
  }, [selectedFileIndex, yamlStructure]);
  
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
    
    if (name === 'destino') {
      // Reiniciar proveedorSeleccionado cuando cambia el tipo de destino
      setProveedorSeleccionado(null);
      
      // Si es archivo (nube), seleccionar el primer proveedor cloud disponible
      if (value === 'archivo' && proveedoresDestino.clouds.length > 0) {
        setProveedorSeleccionado(proveedoresDestino.clouds[0].id);
      } 
      // Si es base de datos, seleccionar la primera base de datos disponible
      else if (value === 'base_datos' && proveedoresDestino.databases.length > 0) {
        setProveedorSeleccionado(proveedoresDestino.databases[0].id);
      }
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleProveedorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = parseInt(e.target.value);
    setProveedorSeleccionado(id);
  };
  
  const handleSwitchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: checked
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
    
    // Mantener selecciones actuales
    const allColumns: {[key: string]: boolean} = {...columnSelection};
    
    // Seleccionar solo columnas del archivo actual
    const selectedColumns = getAllColumns();
    selectedColumns.forEach(column => {
      allColumns[column.name] = true;
    });
    
    setColumnSelection(allColumns);
    updateSelectedColumnsInForm(allColumns, primaryKeySelection, partitionSelection);
  };
  
  const handleDeselectAllColumns = () => {
    if (!yamlStructure || !yamlStructure.files) return;
    
    // Mantener selecciones actuales
    const allColumns: {[key: string]: boolean} = {...columnSelection};
    
    // Deseleccionar solo columnas del archivo actual
    const selectedColumns = getAllColumns();
    selectedColumns.forEach(column => {
      allColumns[column.name] = false;
    });
    
    setColumnSelection(allColumns);
    updateSelectedColumnsInForm(allColumns, primaryKeySelection, partitionSelection);
  };
  
  // Función para limpiar todas las selecciones del formulario
  const handleResetAllSelections = () => {
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
      
      // Validar que se haya seleccionado un proveedor
      if (!proveedorSeleccionado) {
        toast.error('Debe seleccionar un proveedor específico');
        return;
      }
      
      // Determinar tipo de proveedor (cloud o database)
      const tipoProveedor = formData.destino === 'archivo' ? 'cloud' : 'database';
      
      // Obtener información del catálogo seleccionado
      const selectedFile = yamlStructure?.files[selectedFileIndex];
      const catalogMatch = selectedFile?.name.match(/Catálogo de (.*)/);
      const catalogId = catalogMatch ? catalogMatch[1].toLowerCase() : selectedFile?.name.toLowerCase();
      
      console.log(`Usando catálogo: ${catalogId} para la materialización en modo edición`);

      // Conservar el campo catalogo si ya existe, o añadirlo si no existe
      const existingCatalog = materialData?.configuracion?.catalogo;
      
      const materializacionData = {
        nombre: formData.nombre,
        descripcion: formData.descripcion,
        activo: formData.activo,
        configuracion: {
          formato: formData.formato,
          columnas: formData.columnas,
          primaryKey: formData.primaryKey.length > 0 ? formData.primaryKey : undefined,
          partitionBy: formData.partitionBy.length > 0 ? formData.partitionBy : undefined,
          destino: formData.destino,
          tablaDestino: formData.tablaDestino,
          estrategiaActualizacion: formData.estrategiaActualizacion,
          tipoProveedor: tipoProveedor,
          proveedorId: proveedorSeleccionado,
          columnMappings: formData.columnMappings.length > 0 ? formData.columnMappings : undefined,
          // Usar el catalogo existente si está presente, o el nuevo catalogId si no existe
          catalogo: existingCatalog || catalogId
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
  
  const getSelectedFile = (): FileStructure | null => {
    if (!yamlStructure || !yamlStructure.files || yamlStructure.files.length === 0) {
      return null;
    }
    
    if (selectedFileIndex >= yamlStructure.files.length) {
      return yamlStructure.files[0];
    }
    
    return yamlStructure.files[selectedFileIndex];
  };
  
  const getAllColumns = (): Column[] => {
    if (!yamlStructure || !yamlStructure.files) return [];
    
    // Si hay un archivo seleccionado, usar solo sus columnas
    const selectedFile = getSelectedFile();
    if (selectedFile) {
      return selectedFile.columns;
    }
    
    // Como fallback, retornar todas las columnas
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

  // Renderizado final del componente  
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
                {tiposDestino.map(destino => (
                  <option key={destino.id} value={destino.id}>
                    {destino.nombre}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Proveedor Específico *
              </label>
              <select
                name="proveedorId"
                value={proveedorSeleccionado || ''}
                onChange={handleProveedorChange}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md"
                required
              >
                {formData.destino === 'archivo' ? (
                  proveedoresDestino.clouds.length > 0 ? (
                    proveedoresDestino.clouds.map(cloud => (
                      <option key={cloud.id} value={cloud.id}>
                        {cloud.nombre} ({cloud.tipo})
                      </option>
                    ))
                  ) : (
                    <option value="" disabled>No hay proveedores de nube disponibles</option>
                  )
                ) : (
                  proveedoresDestino.databases.length > 0 ? (
                    proveedoresDestino.databases.map(db => (
                      <option key={db.id} value={db.id}>
                        {db.nombre} ({db.base_datos})
                      </option>
                    ))
                  ) : (
                    <option value="" disabled>No hay bases de datos disponibles</option>
                  )
                )}
              </select>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
            {formData.destino === 'archivo' && (
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
            )}
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
                <option value="full_uuid">FULL con UUID (Crear tabla con prefijo _UUID.)</option>
                <option value="upsert">Upsert (Actualizar existentes, insertar nuevos)</option>
                <option value="append">Append (Solo agregar registros nuevos)</option>
                <option value="merge">Merge (Control detallado con condiciones)</option>
              </select>
            </div>
          </div>
          
          <div className="flex items-center mt-4">
            <input
              type="checkbox"
              id="activoSwitch"
              name="activo"
              checked={formData.activo}
              onChange={handleSwitchChange}
              className="form-checkbox h-5 w-5 text-indigo-600"
            />
            <label htmlFor="activoSwitch" className="ml-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Materialización activa
            </label>
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
              <Button 
                type="button"
                onClick={handleResetAllSelections}
                variant="outline"
                size="sm"
              >
                Resetear Todas
              </Button>
            </div>
          </div>
          
          {yamlStructure && yamlStructure.files && yamlStructure.files.length > 0 && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Archivo de Datos (Catálogo) Seleccionado:
              </label>
              <div className="w-full p-3 bg-gray-100 dark:bg-gray-800 rounded-md mb-4 border border-gray-200 dark:border-gray-700">
                <div className="font-medium">{yamlStructure.files[selectedFileIndex].name}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {yamlStructure.files[selectedFileIndex].description || 'Sin descripción'}
                </div>
                <div className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                  Cada materialización está vinculada a un único catálogo específico
                </div>
              </div>
            </div>
          )}
          
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