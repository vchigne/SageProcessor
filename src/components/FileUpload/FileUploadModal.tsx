import React, { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { Button } from '@tremor/react';
import { DocumentArrowUpIcon } from '@heroicons/react/24/outline';
import { Casilla } from '../../types';

interface FileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  dataBox?: Casilla | null;
  casilla?: any; // Acepta la prop casilla del portal externo
  uuid?: string;
  instalacionId?: number;
  instalacionInfo?: any;
}

interface ProcessingResult {
  execution_uuid: string;
  errors: number;
  warnings: number;
  log_url?: string;
  report_html_url?: string;
  report_json_url?: string;
}

const getResultStatusColors = (result: ProcessingResult) => {
  if (result.errors > 0) {
    return {
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-800',
      textSecondary: 'text-red-700'
    };
  }
  if (result.warnings > 0) {
    return {
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      text: 'text-yellow-800',
      textSecondary: 'text-yellow-700'
    };
  }
  return {
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-800',
    textSecondary: 'text-green-700'
  };
};

// Componente LogViewerModal mejorado con diseño moderno y acceso a reportes
const LogViewerModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  executionUuid: string;
}> = ({ isOpen, onClose, executionUuid }) => {
  // URLs para los diferentes formatos de reportes
  const logUrl = `/api/executions/${executionUuid}/log`;
  const reportHtmlUrl = `/api/executions/${executionUuid}/report-html`;
  const reportJsonUrl = `/api/executions/${executionUuid}/report-json`;
  
  // Estado para controlar qué reporte se está visualizando
  const [activeTab, setActiveTab] = useState<'log' | 'html'>('log');

  // Estado para controlar si la iframe está cargando
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // Cada vez que cambia la pestaña, marcar como cargando
    setLoading(true);
  }, [activeTab]);

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleIframeLoad = () => {
    setLoading(false);
  };

  // Función para abrir en nueva pestaña
  const openInNewTab = (event: React.MouseEvent, url: string) => {
    // Detener la propagación del evento para evitar que cierre el modal
    event.stopPropagation();
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Dialog
      open={isOpen}
      onClose={() => {}} // Deshabilitar cierre por click fuera
      className="relative z-[60]"
    >
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="w-[95vw] max-w-6xl bg-white rounded-xl shadow-2xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <Dialog.Title className="text-xl font-semibold text-gray-900">
              Resultados del Procesamiento
            </Dialog.Title>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-100"
              aria-label="Cerrar"
              type="button"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Menú de navegación entre tipos de reportes */}
          <div className="flex border-b border-gray-200" onClick={e => e.stopPropagation()}>
            <button
              type="button"
              className={`px-4 py-2 font-medium text-sm ${activeTab === 'log' 
                ? 'text-blue-600 border-b-2 border-blue-600' 
                : 'text-gray-500 hover:text-gray-700 hover:border-b-2 hover:border-gray-300'}`}
              onClick={() => setActiveTab('log')}
            >
              Log de Procesamiento
            </button>
            <button
              type="button"
              className={`px-4 py-2 font-medium text-sm ${activeTab === 'html' 
                ? 'text-blue-600 border-b-2 border-blue-600' 
                : 'text-gray-500 hover:text-gray-700 hover:border-b-2 hover:border-gray-300'}`}
              onClick={() => setActiveTab('html')}
            >
              Reporte HTML
            </button>
          </div>

          <div className="p-6">
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-10">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            )}
            <div className="relative rounded-lg border border-gray-200 bg-gray-50 overflow-hidden">
              <iframe
                src={activeTab === 'log' ? logUrl : reportHtmlUrl}
                className="w-full h-[75vh]"
                title={activeTab === 'log' ? "Log de Procesamiento" : "Reporte HTML"}
                sandbox="allow-same-origin allow-scripts"
                loading="eager"
                onLoad={handleIframeLoad}
              />
            </div>
          </div>

          <div className="flex justify-between px-6 py-4 border-t border-gray-200" onClick={e => e.stopPropagation()}>
            {/* Botones de acciones de reporte */}
            <div className="flex space-x-2">
              <button 
                type="button"
                onClick={() => window.open(reportHtmlUrl, '_blank', 'noopener,noreferrer')}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Ver reporte HTML
              </button>
              <button 
                type="button"
                onClick={() => window.open(reportJsonUrl, '_blank', 'noopener,noreferrer')}
                className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Descargar reporte JSON
              </button>
            </div>
            
            {/* Botón de cerrar */}
            <Button
              variant="secondary"
              onClick={onClose}
              className="px-4 py-2"
            >
              Cerrar
            </Button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

export const FileUploadModal: React.FC<FileUploadModalProps> = ({
  isOpen,
  onClose,
  dataBox,
  casilla,
  uuid,
  instalacionId,
  instalacionInfo,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [processingStatus, setProcessingStatus] = useState<{
    isProcessing: boolean;
    success?: boolean;
    error?: string;
    result?: ProcessingResult;
  }>({
    isProcessing: false
  });
  const [showResults, setShowResults] = useState(false);

  // Determinar qué objeto usar (dataBox o casilla)
  const casillaData = dataBox || casilla;

  useEffect(() => {
    if (!isOpen) {
      setFile(null);
      setProcessingStatus({ isProcessing: false });
      setShowResults(false);
    }
  }, [isOpen]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setProcessingStatus({ isProcessing: false });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !casillaData) return;

    setProcessingStatus({ isProcessing: true });

    const formData = new FormData();
    formData.append('file', file);
    
    // Agregar ID de casilla
    if (casillaData.id) {
      formData.append('casilla_id', casillaData.id.toString());
    }
    
    // Agregar ID de instalación (de diferentes fuentes posibles)
    const instId = 
      instalacionId || 
      casillaData.instalacion_id || 
      casillaData.instalacion?.id;
    
    if (instId) {
      formData.append('instalacion_id', instId.toString());
    }
    
    // Agregar nombre YAML (de diferentes fuentes posibles)
    const yamlName = 
      casillaData.nombre_yaml || 
      casillaData.yaml_content?.name || 
      casillaData.archivo_yaml_nombre;
    
    if (yamlName) {
      formData.append('yaml_nombre', yamlName);
    }
    
    // Agregar UUID del portal si está disponible
    if (uuid) {
      formData.append('portal_uuid', uuid);
    }
    
    // Agregar emisor_id si está disponible en casilla
    if (casillaData.emisorId) {
      formData.append('emisor_id', casillaData.emisorId.toString());
    }

    try {
      const response = await fetch('/api/process-files', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error procesando el archivo');
      }

      const data = await response.json();
      setProcessingStatus({
        isProcessing: false,
        success: true,
        result: data
      });
    } catch (error: any) {
      console.error('Error processing file:', error);
      setProcessingStatus({
        isProcessing: false,
        success: false,
        error: error.message || 'Error al procesar el archivo'
      });
    }
  };

  if (!casillaData) return null;

  return (
    <>
      <Dialog 
        open={isOpen}
        onClose={() => {}} // Prevent closing with escape key
        className="relative z-50"
      >
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" aria-hidden="true" onClick={() => {
          if (!processingStatus.isProcessing) {
            onClose();
          }
        }} />
        <div className="fixed inset-0 flex items-center justify-center p-4" onClick={e => e.stopPropagation()}>
          <Dialog.Panel className="w-full max-w-lg rounded-lg bg-white dark:bg-dark-card p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <Dialog.Title className="text-lg font-medium mb-4 dark:text-gray-100">
              Cargar Archivo
            </Dialog.Title>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="bg-gray-50 dark:bg-dark-cardHover p-4 rounded-lg mb-4">
                <div className="mb-2">
                  <h3 className="font-medium text-gray-900 dark:text-gray-100">Instalación:</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {casillaData?.instalacion?.nombre || 
                     (casillaData?.instalacion?.producto?.nombre && 
                      `${casillaData?.instalacion?.producto?.nombre}${casillaData?.instalacion?.organizacion?.nombre ? ` - ${casillaData?.instalacion?.organizacion?.nombre}` : ''}`
                     ) || 
                     (instalacionInfo ? instalacionInfo.nombre || `${instalacionInfo.producto?.nombre || ''} - ${instalacionInfo.organizacion?.nombre || ''}` : '-')}
                  </p>
                </div>

                <div>
                  <h3 className="font-medium text-gray-900 dark:text-gray-100">Configuración YAML:</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {casillaData?.nombre_yaml || 
                     casillaData?.yaml_content?.name || 
                     casillaData?.archivo_yaml_nombre || '-'}
                  </p>
                  {(casillaData?.descripcion || 
                    casillaData?.yaml_content?.description || 
                    casillaData?.archivo_yaml_descripcion) && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {casillaData?.descripcion || 
                       casillaData?.yaml_content?.description || 
                       casillaData?.archivo_yaml_descripcion}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Archivo (ZIP, CSV o Excel)
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="file"
                    accept=".zip,.csv,.xlsx,.xls"
                    onChange={handleFileChange}
                    className="hidden"
                    id="upload-file"
                    required
                  />
                  <Button
                    variant="secondary"
                    onClick={() => document.getElementById('upload-file')?.click()}
                    type="button"
                    disabled={processingStatus.isProcessing}
                  >
                    <DocumentArrowUpIcon className="h-5 w-5 mr-2" />
                    Seleccionar archivo
                  </Button>
                  {file && (
                    <span className="text-sm text-gray-600">
                      {file.name}
                    </span>
                  )}
                </div>
              </div>

              {processingStatus.isProcessing && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                      <div className="h-8 w-8 relative">
                        <div className="absolute inset-0 border-t-2 border-r-2 border-blue-600 rounded-full animate-spin"></div>
                        <div className="absolute inset-2 bg-blue-600 rounded-full animate-pulse"></div>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-blue-700 font-medium">Procesando archivo...</p>
                      <p className="text-xs text-blue-600 mt-1">Por favor espere mientras validamos y procesamos su archivo</p>
                    </div>
                  </div>
                </div>
              )}

              {processingStatus.error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm font-medium text-red-700">Error al procesar el archivo</p>
                  <p className="text-sm mt-1 text-red-600">{processingStatus.error}</p>
                </div>
              )}

              {processingStatus.success && processingStatus.result && (
                <div className={`p-4 ${getResultStatusColors(processingStatus.result).bg} border ${getResultStatusColors(processingStatus.result).border} rounded-md`}>
                  <h4 className={`text-sm font-medium ${getResultStatusColors(processingStatus.result).text} mb-2`}>
                    {processingStatus.result.errors > 0 
                      ? '¡Archivo procesado con errores!'
                      : processingStatus.result.warnings > 0 
                        ? '¡Archivo procesado con advertencias!'
                        : '¡Archivo procesado exitosamente!'}
                  </h4>
                  <div className={`space-y-2 text-sm ${getResultStatusColors(processingStatus.result).textSecondary}`}>
                    <p>UUID de ejecución: {processingStatus.result.execution_uuid}</p>
                    <div className="flex space-x-4">
                      <div>
                        <span className="font-medium">Errores:</span> {processingStatus.result.errors}
                      </div>
                      <div>
                        <span className="font-medium">Advertencias:</span> {processingStatus.result.warnings}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowResults(true);
                      }}
                      className="text-blue-600 hover:text-blue-800 underline text-sm mt-2"
                    >
                      Ver resultados detallados
                    </button>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button 
                  variant="secondary" 
                  onClick={onClose} 
                  disabled={processingStatus.isProcessing}
                >
                  {processingStatus.success ? 'Cerrar' : 'Cancelar'}
                </Button>
                {!processingStatus.success && (
                  <Button 
                    type="submit" 
                    variant="primary"
                    disabled={processingStatus.isProcessing || !file}
                  >
                    Procesar Archivo
                  </Button>
                )}
              </div>
            </form>
          </Dialog.Panel>
        </div>
      </Dialog>

      {/* Modal de resultados mejorado */}
      {processingStatus.success && processingStatus.result && (
        <LogViewerModal
          isOpen={showResults}
          onClose={() => setShowResults(false)}
          executionUuid={processingStatus.result.execution_uuid}
        />
      )}
    </>
  );
};

export default FileUploadModal;