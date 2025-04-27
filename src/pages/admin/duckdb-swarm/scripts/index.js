import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { PencilIcon, ArrowPathIcon, FolderIcon, DocumentTextIcon, CodeBracketIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';

export default function DuckDBScriptsManagerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState({
    scripts: false,
  });
  const [scripts, setScripts] = useState({
    installScript: '',
    validateScript: '',
    duckdbServerScript: '',
    demosScript: '',
    controlPanelScript: '',
    hasFiles: false
  });
  const [activeTab, setActiveTab] = useState('install');

  // Cargar scripts al iniciar
  useEffect(() => {
    fetchScripts();
  }, []);

  // Función para cargar los scripts
  const fetchScripts = async () => {
    try {
      setLoading(prev => ({ ...prev, scripts: true }));
      
      const response = await fetch('/api/admin/duckdb-swarm/scripts');
      const data = await response.json();
      
      if (response.ok) {
        setScripts({
          installScript: data.installScript || '',
          validateScript: data.validateScript || '',
          duckdbServerScript: data.duckdbServerScript || '',
          demosScript: data.demosScript || '',
          controlPanelScript: data.controlPanelScript || '',
          hasFiles: data.hasFiles || false
        });
      } else {
        console.error('Error al cargar scripts:', data.error);
        alert(`Error al cargar scripts: ${data.error}`);
      }
    } catch (error) {
      console.error('Error al cargar scripts:', error);
      alert(`Error al cargar scripts: ${error.message}`);
    } finally {
      setLoading(prev => ({ ...prev, scripts: false }));
    }
  };

  // Función para guardar un script
  const saveScript = async (scriptType, content) => {
    try {
      setLoading(prev => ({ ...prev, scripts: true }));
      
      const response = await fetch('/api/admin/duckdb-swarm/scripts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: scriptType,
          content
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        alert(`Script "${scriptType}" guardado correctamente`);
        // Actualizar el estado local con el nuevo contenido
        setScripts(prev => ({
          ...prev,
          [getScriptStateKey(scriptType)]: content
        }));
      } else {
        console.error(`Error al guardar script "${scriptType}":`, data.error);
        alert(`Error al guardar script "${scriptType}": ${data.error}`);
      }
    } catch (error) {
      console.error(`Error al guardar script "${scriptType}":`, error);
      alert(`Error al guardar script "${scriptType}": ${error.message}`);
    } finally {
      setLoading(prev => ({ ...prev, scripts: false }));
    }
  };

  // Función para subir un archivo ZIP de demos
  const uploadDemosZip = async (event) => {
    try {
      const file = event.target.files[0];
      if (!file) return;
      
      // Verificar que es un archivo ZIP
      if (!file.name.endsWith('.zip')) {
        alert('Por favor, seleccione un archivo ZIP');
        return;
      }
      
      setLoading(prev => ({ ...prev, scripts: true }));
      
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/admin/duckdb-swarm/scripts/upload-demos', {
        method: 'POST',
        body: formData
      });
      
      const data = await response.json();
      
      if (response.ok) {
        alert('Archivo de demos subido correctamente');
        setScripts(prev => ({ ...prev, hasFiles: true }));
      } else {
        console.error('Error al subir archivo de demos:', data.error);
        alert(`Error al subir archivo de demos: ${data.error}`);
      }
    } catch (error) {
      console.error('Error al subir archivo de demos:', error);
      alert(`Error al subir archivo de demos: ${error.message}`);
    } finally {
      setLoading(prev => ({ ...prev, scripts: false }));
      // Limpiar el input de archivo
      event.target.value = '';
    }
  };

  // Función auxiliar para mapear el tipo de script a su clave en el estado
  const getScriptStateKey = (scriptType) => {
    switch (scriptType) {
      case 'install':
        return 'installScript';
      case 'validate':
        return 'validateScript';
      case 'duckdb-server':
        return 'duckdbServerScript';
      case 'demos':
        return 'demosScript';
      case 'control-panel':
        return 'controlPanelScript';
      default:
        return '';
    }
  };

  // Función para obtener el contenido actual del script según la pestaña activa
  const getActiveScriptContent = () => {
    switch (activeTab) {
      case 'install':
        return scripts.installScript;
      case 'validate':
        return scripts.validateScript;
      case 'duckdb-server':
        return scripts.duckdbServerScript;
      case 'demos':
        return scripts.demosScript;
      case 'control-panel':
        return scripts.controlPanelScript;
      default:
        return '';
    }
  };

  // Función para guardar el script activo
  const saveActiveScript = () => {
    saveScript(activeTab, getActiveScriptContent());
  };

  // Función para manejar cambios en el textarea
  const handleScriptChange = (e) => {
    const content = e.target.value;
    setScripts(prev => ({
      ...prev,
      [getScriptStateKey(activeTab)]: content
    }));
  };

  return (
    <>
      <Head>
        <title>Gestión de Scripts de Despliegue DuckDB</title>
      </Head>

      <div className="container mx-auto px-2 sm:px-4 py-6 max-w-full">
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
              Gestión de Scripts de Despliegue DuckDB
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Administre los scripts utilizados para el despliegue de servidores DuckDB remotos
            </p>
          </div>
          
          <div className="mt-4 sm:mt-0 space-x-2 flex">
            <button
              onClick={fetchScripts}
              className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center text-sm"
              disabled={loading.scripts}
            >
              <ArrowPathIcon className="w-4 h-4 mr-1" />
              Recargar
            </button>
            <button
              onClick={saveActiveScript}
              className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center text-sm"
              disabled={loading.scripts}
            >
              <PencilIcon className="w-4 h-4 mr-1" />
              Guardar
            </button>
            <Link href="/admin/duckdb-swarm/simple" legacyBehavior>
              <a className="px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 flex items-center text-sm">
                Volver
              </a>
            </Link>
          </div>
        </div>

        {/* Tabs para diferentes scripts */}
        <div className="border-b border-gray-200 dark:border-gray-700 mb-4">
          <nav className="flex space-x-2">
            <button
              onClick={() => setActiveTab('install')}
              className={`py-2 px-4 text-sm font-medium ${
                activeTab === 'install'
                  ? 'text-blue-600 border-b-2 border-blue-600 dark:text-blue-400 dark:border-blue-400'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <DocumentTextIcon className="w-4 h-4 inline mr-1" />
              Script de Instalación
            </button>
            <button
              onClick={() => setActiveTab('validate')}
              className={`py-2 px-4 text-sm font-medium ${
                activeTab === 'validate'
                  ? 'text-blue-600 border-b-2 border-blue-600 dark:text-blue-400 dark:border-blue-400'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <DocumentTextIcon className="w-4 h-4 inline mr-1" />
              Script de Validación
            </button>
            <button
              onClick={() => setActiveTab('duckdb-server')}
              className={`py-2 px-4 text-sm font-medium ${
                activeTab === 'duckdb-server'
                  ? 'text-blue-600 border-b-2 border-blue-600 dark:text-blue-400 dark:border-blue-400'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <CodeBracketIcon className="w-4 h-4 inline mr-1" />
              API de DuckDB
            </button>
            <button
              onClick={() => setActiveTab('demos')}
              className={`py-2 px-4 text-sm font-medium ${
                activeTab === 'demos'
                  ? 'text-blue-600 border-b-2 border-blue-600 dark:text-blue-400 dark:border-blue-400'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <CodeBracketIcon className="w-4 h-4 inline mr-1" />
              Script de Demos
            </button>
            <button
              onClick={() => setActiveTab('control-panel')}
              className={`py-2 px-4 text-sm font-medium ${
                activeTab === 'control-panel'
                  ? 'text-blue-600 border-b-2 border-blue-600 dark:text-blue-400 dark:border-blue-400'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <CodeBracketIcon className="w-4 h-4 inline mr-1" />
              Panel de Control
            </button>
          </nav>
        </div>

        {/* Editor de código */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
              {activeTab === 'install' && 'Script de Instalación (install_duckdb_systemd.sh)'}
              {activeTab === 'validate' && 'Script de Validación (validate_duckdb_systemd.sh)'}
              {activeTab === 'duckdb-server' && 'API DuckDB Server (duckdb_server.py)'}
              {activeTab === 'demos' && 'Script de Demos (install_demos_duckdb_server.sh)'}
              {activeTab === 'control-panel' && 'Panel de Control (control_panel.py)'}
            </h2>
            
            {/* Mostrar botón de subir archivos solo en la pestaña de demos */}
            {activeTab === 'demos' && (
              <div>
                <input
                  type="file"
                  id="demos-zip"
                  accept=".zip"
                  onChange={uploadDemosZip}
                  className="hidden"
                />
                <label
                  htmlFor="demos-zip"
                  className="px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 cursor-pointer flex items-center text-sm"
                >
                  <FolderIcon className="w-4 h-4 mr-1" />
                  Subir Archivo de Demos (.zip)
                </label>
                <div className="text-xs text-gray-500 mt-1">
                  {scripts.hasFiles ? 'Archivos de demostración disponibles' : 'No hay archivos de demostración subidos'}
                </div>
              </div>
            )}
          </div>
          
          <textarea
            value={getActiveScriptContent()}
            onChange={handleScriptChange}
            className="w-full h-96 p-4 bg-gray-800 text-gray-200 font-mono text-sm rounded-md"
            placeholder={`Ingrese el código del script ${activeTab}`}
            disabled={loading.scripts}
          />
          
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Este script se copiará al servidor remoto durante el proceso de despliegue.
          </p>
        </div>
      </div>
    </>
  );
}