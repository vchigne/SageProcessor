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
  
  // Definición de la interfaz para el mapeo de columnas
  interface ColumnMapping {
    originName: string;
    targetName: string;
  }

  // Formulario de materialización
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    formato: 'parquet',
    destino: 'archivo',
    tablaDestino: '',
    estrategiaActualizacion: 'reemplazar',
    columnas: [] as string[],
    columnMappings: [] as ColumnMapping[],
    primaryKey: [] as string[],
    partitionBy: [] as string[],
    activo: true
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
          
          // El nombre y tabla destino se actualizarán después, cuando cargue la estructura YAML
          setFormData(prev => ({
            ...prev
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
            
            // Extraer el nombre real sin el prefijo "Catálogo de" o similar
            let tableName = fileToUse.name;
            const catalogMatch = fileToUse.name.match(/Catálogo de (.*)/);
            if (catalogMatch) {
              tableName = catalogMatch[1].trim();
            }
            
            // Usar el nombre del archivo como nombre predeterminado para la materialización y tabla destino
            setFormData(prev => ({
              ...prev,
              nombre: `Materialización ${fileToUse.name}`,
              tablaDestino: tableName // Usar el nombre limpio sin "Catálogo de"
            }));
          }
        } else {
          console.error('Error al cargar estructura YAML:', yamlResponse.statusText);
          toast.error('Error al cargar estructura YAML');
        }
        
        // Obtener destinos disponibles (nubes y bases de datos)
        const destinationsResponse = await fetch('/api/admin/materializations/destinations');
        
        if (destinationsResponse.ok) {
          const destinationsData = await destinationsResponse.json();
          setProveedoresDestino(destinationsData);
          
          // Seleccionar primer proveedor de nube por defecto si hay alguno disponible
          if (destinationsData.clouds && destinationsData.clouds.length > 0) {
            setProveedorSeleccionado(destinationsData.clouds[0].id);
          }
        } else {
          console.error('Error al cargar destinos:', destinationsResponse.statusText);
          toast.error('Error al cargar destinos disponibles');
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
    if (!yamlStructure || !yamlStructure.files || selectedFileIndex === null) {
      const selectedColumns = Object.keys(columns).filter(name => columns[name]);
      const selectedPrimaryKeys = Object.keys(primaryKeys).filter(name => primaryKeys[name]);
      const selectedPartitions = Object.keys(partitions).filter(name => partitions[name]);
      
      setFormData(prev => ({
        ...prev,
        columnas: selectedColumns,
        primaryKey: selectedPrimaryKeys,
        partitionBy: selectedPartitions
      }));
      return;
    }
    
    const fileToUse = yamlStructure.files[selectedFileIndex];
    const columnsData = fileToUse.columns;
    
    // Filtrar columnas seleccionadas
    const selectedColumnKeys = Object.keys(columns).filter(key => columns[key]);
    
    // Crear mapeo de columnas origen-destino
    const columnMappings = selectedColumnKeys.map(key => {
      const columnData = columnsData.find(col => col.name === key);
      return {
        originName: key,
        targetName: columnData?.targetName || key
      };
    });
    
    const selectedPrimaryKeys = Object.keys(primaryKeys).filter(name => primaryKeys[name]);
    const selectedPartitions = Object.keys(partitions).filter(name => partitions[name]);
    
    setFormData(prev => ({
      ...prev,
      columnas: selectedColumnKeys,
      columnMappings: columnMappings,
      primaryKey: selectedPrimaryKeys,
      partitionBy: selectedPartitions
    }));
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // Si cambia el tipo de destino, resetear el proveedor seleccionado
    if (name === 'destino') {
      if (value === 'archivo' && proveedoresDestino.clouds.length > 0) {
        // Al cambiar a 'archivo', seleccionar el primer proveedor de nube
        setProveedorSeleccionado(proveedoresDestino.clouds[0].id);
      } else if (value === 'base_datos' && proveedoresDestino.databases.length > 0) {
        // Al cambiar a 'base_datos', seleccionar la primera base de datos
        setProveedorSeleccionado(proveedoresDestino.databases[0].id);
      } else {
        setProveedorSeleccionado(null);
      }
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleActivoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      activo: e.target.checked
    }));
  };
  
  const handleProveedorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const proveedorId = parseInt(e.target.value);
    setProveedorSeleccionado(proveedorId);
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
  
  // Función para resetear todas las selecciones a los valores predeterminados
  const handleResetAllSelections = () => {
    if (!yamlStructure || !yamlStructure.files) return;
    
    const fileToUse = yamlStructure.files[selectedFileIndex] || yamlStructure.files[0];
    
    // Reinicializar la selección de columnas con valores predeterminados del archivo seleccionado
    const initialColumnSelection: {[key: string]: boolean} = {};
    const initialPrimaryKeySelection: {[key: string]: boolean} = {};
    const initialPartitionSelection: {[key: string]: boolean} = {};
    
    fileToUse.columns.forEach(column => {
      initialColumnSelection[column.name] = true;
      initialPrimaryKeySelection[column.name] = column.primary || false;
      initialPartitionSelection[column.name] = column.partitionKey || false;
    });
    
    setColumnSelection(initialColumnSelection);
    setPrimaryKeySelection(initialPrimaryKeySelection);
    setPartitionSelection(initialPartitionSelection);
    
    // Actualizar las columnas seleccionadas en el formulario
    updateSelectedColumnsInForm(initialColumnSelection, initialPrimaryKeySelection, initialPartitionSelection);
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
    
    if (!proveedorSeleccionado) {
      toast.error('Debe seleccionar un proveedor de destino');
      return;
    }
    
    try {
      setFormSubmitting(true);
      
      // Identificar el tipo de proveedor seleccionado (cloud o database)
      const tipoProveedor = formData.destino === 'archivo' ? 'cloud' : 'database';
      
      // Obtener información del catálogo seleccionado
      const selectedFile = yamlStructure?.files[selectedFileIndex];
      const catalogMatch = selectedFile?.name.match(/Catálogo de (.*)/);
      const catalogId = catalogMatch ? catalogMatch[1].toLowerCase() : selectedFile?.name.toLowerCase();
      
      console.log(`Usando catálogo: ${catalogId} para la nueva materialización`);

      const materializacionData = {
        nombre: formData.nombre,
        descripcion: formData.descripcion,
        casilla_id: casilla_id,
        activo: formData.activo,
        configuracion: {
          formato: formData.formato,
          columnas: formData.columnas,
          columnMappings: formData.columnMappings,
          primaryKey: formData.primaryKey.length > 0 ? formData.primaryKey : undefined,
          partitionBy: formData.partitionBy.length > 0 ? formData.partitionBy : undefined,
          destino: formData.destino,
          tipoProveedor: tipoProveedor,
          proveedorId: proveedorSeleccionado,
          tablaDestino: formData.tablaDestino,
          estrategiaActualizacion: formData.estrategiaActualizacion,
          catalogo: catalogId // Añadimos el campo catalogo para vincular explícitamente
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
  
  const handleSelectFile = (index: number) => {
    setSelectedFileIndex(index);
    
    // Actualizar los nombres basados en el archivo seleccionado
    if (yamlStructure && yamlStructure.files && yamlStructure.files.length > index) {
      const fileToUse = yamlStructure.files[index];
      
      // Extraer el nombre real sin el prefijo "Catálogo de" o similar
      let tableName = fileToUse.name;
      const catalogMatch = fileToUse.name.match(/Catálogo de (.*)/);
      if (catalogMatch) {
        tableName = catalogMatch[1].trim();
      }
      
      // Actualizar el nombre de la materialización y la tabla destino
      setFormData(prev => ({
        ...prev,
        nombre: `Materialización ${fileToUse.name}`,
        tablaDestino: tableName // Usar el nombre limpio sin "Catálogo de"
      }));
      
      // Reinicializar la selección de columnas con las del archivo seleccionado
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
          
          <div className="flex items-center">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.activo}
                onChange={handleActivoChange}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
              <span className="ml-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                {formData.activo ? 'Activada' : 'Desactivada'}
              </span>
            </label>
            <div className="ml-4 text-sm text-gray-500 dark:text-gray-400">
              {formData.activo ? 
                'La materialización se ejecutará según la programación establecida' : 
                'La materialización estará disponible pero no se ejecutará automáticamente'}
            </div>
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
                {tiposDestino.map(tipo => (
                  <option key={tipo.id} value={tipo.id}>
                    {tipo.nombre}
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
                <option value="full_uuid">FULL con UUID (Crear tabla con prefijo _UUID.)</option>
                <option value="upsert">Upsert (Actualizar existentes, insertar nuevos)</option>
                <option value="append">Append (Solo agregar registros nuevos)</option>
                <option value="merge">Merge (Control detallado con condiciones)</option>
              </select>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-dark-card rounded-lg shadow-md p-6 mb-6">
          {yamlStructure && yamlStructure.files && yamlStructure.files.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-medium mb-2">Archivo de Datos (Catálogo) Seleccionado:</h3>
              <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700">
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