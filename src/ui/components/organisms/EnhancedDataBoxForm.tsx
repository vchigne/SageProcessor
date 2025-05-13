import React, { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { XMarkIcon, DocumentArrowUpIcon, CheckCircleIcon, CodeBracketIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { Casilla, Instalacion } from '../../../types';
import { Button, Card } from '../../components';
import Prism from 'prismjs';
import 'prismjs/components/prism-yaml';
import 'prismjs/themes/prism.css';
import yaml from 'yaml';

interface EnhancedDataBoxFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<any>;
  dataBox?: Casilla | null;
  installations: Instalacion[];
}

export const EnhancedDataBoxForm: React.FC<EnhancedDataBoxFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  dataBox,
  installations,
}) => {
  const [formData, setFormData] = useState({
    instalacion_id: '',
    nombre_yaml: '',
    yaml_content: '',
    api_endpoint: '',
    email_casilla: '',
    is_active: true,
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showYamlPreview, setShowYamlPreview] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validationSuccess, setValidationSuccess] = useState(false);
  const [executionUuid, setExecutionUuid] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  // Inicializar formulario al abrir el modal
  useEffect(() => {
    console.log('Modal abierto, dataBox recibido:', dataBox);
    if (isOpen) {
      if (dataBox && dataBox.id) {
        console.log('En modo edición, ID:', dataBox.id);
        setIsEditMode(true);
        
        // Extraer instalacion_id, manejar posibles casos de nulidad
        const instalacionId = dataBox.instalacion_id || 
                              (dataBox.instalacion && dataBox.instalacion.id) || 
                              '';
        
        // Extraer el contenido YAML sin procesar
        let yamlContent = '';
        console.log('Datos de la casilla:', JSON.stringify(dataBox, null, 2));
        
        // Variable ejemplo para usar si no hay contenido
        const yamlEjemplo = `sage_yaml:
  name: "Archivo estandar de Strategio Canal Tradicional"
  description: "Configuración generada para 7 catálogos"

catalogs: []

packages: []`;
        
        // Usar directamente el contenido tal cual viene
        if (typeof dataBox.yaml_content === 'string') {
          yamlContent = dataBox.yaml_content;
        } else if (dataBox.yaml_content && typeof dataBox.yaml_content === 'object') {
          // Intentar JSON.stringify primero
          try {
            yamlContent = JSON.stringify(dataBox.yaml_content, null, 2);
            console.log('Convertido de objeto a JSON:', yamlContent);
          } catch (error) {
            console.error('Error al convertir objeto a JSON:', error);
          }
        } else if (typeof dataBox.yaml_contenido === 'string') {
          yamlContent = dataBox.yaml_contenido;
        } else if (typeof dataBox.yaml_contenido === 'object' && dataBox.yaml_contenido) {
          try {
            yamlContent = JSON.stringify(dataBox.yaml_contenido, null, 2);
            console.log('Convertido de objeto a JSON:', yamlContent);
          } catch (error) {
            console.error('Error al convertir objeto a JSON:', error);
          }
        } else if (dataBox.nombre && dataBox.descripcion) {
          // Si no hay contenido YAML pero hay nombre y descripción, crear uno simple
          yamlContent = `sage_yaml:
  name: "${dataBox.nombre}"
  description: "${dataBox.descripcion}"

catalogs: []

packages: []`;
        } else {
          // Si no hay nada, usar el ejemplo
          yamlContent = yamlEjemplo;
        }
        
        setFormData({
          instalacion_id: instalacionId.toString(),
          nombre_yaml: dataBox.nombre_yaml || '',
          yaml_content: yamlContent,
          api_endpoint: dataBox.api_endpoint || '',
          email_casilla: dataBox.email_casilla || '',
          is_active: dataBox.is_active !== undefined ? dataBox.is_active : true,
        });
      } else {
        setIsEditMode(false);
        setFormData({
          instalacion_id: '',
          nombre_yaml: '',
          yaml_content: '',
          api_endpoint: '',
          email_casilla: '',
          is_active: true,
        });
      }

      setSelectedFile(null);
      setShowYamlPreview(false);
      setIsValidating(false);
      setValidationError(null);
      setValidationSuccess(false);
      setExecutionUuid(null);
    }
  }, [isOpen, dataBox]);

  // Aplicar resaltado de sintaxis cuando se muestra el YAML
  useEffect(() => {
    if (showYamlPreview && formData.yaml_content) {
      Prism.highlightAll();
    }
  }, [showYamlPreview, formData.yaml_content]);

  // Manejar carga de archivo
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setFormData(prev => ({ ...prev, nombre_yaml: file.name }));
      const content = await file.text();
      setFormData(prev => ({ ...prev, yaml_content: content }));
      setValidationError(null);
      setValidationSuccess(false);
    }
  };

  // Enviar formulario para vista previa
  const handlePreviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validaciones básicas
    if (!formData.instalacion_id) {
      alert('Por favor selecciona una instalación');
      return;
    }
    
    if (!formData.yaml_content && !selectedFile && !isEditMode) {
      alert('Por favor selecciona un archivo YAML o ingresa contenido YAML');
      return;
    }
    
    setShowYamlPreview(true);
  };

  // Iniciar validación YAML
  const handleValidationStart = async () => {
    setIsValidating(true);
    setValidationError(null);
    setValidationSuccess(false);

    try {
      const response = await fetch('/api/validate-yaml', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ yaml_content: formData.yaml_content }),
      });

      const data = await response.json();

      if (data.error === 'YAML validation failed') {
        setValidationError(data.details || 'Error en la validación del YAML');
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || 'Error en la solicitud');
      }

      setValidationSuccess(true);
    } catch (error: any) {
      console.error('Error validating:', error);
      setValidationError(
        error.message || 'Error al procesar la solicitud'
      );
    } finally {
      setIsValidating(false);
    }
  };

  // Finalizar proceso y crear/actualizar casilla
  const handleFinish = async () => {
    if (validationSuccess || isEditMode) {
      try {
        // Aseguremos que instalacion_id sea numérico
        const instalacionId = parseInt(formData.instalacion_id);
        
        if (isNaN(instalacionId)) {
          throw new Error('ID de instalación no válido');
        }
        
        console.log('Enviando datos a onSubmit:', {
          instalacion_id: instalacionId,
          nombre_yaml: formData.nombre_yaml,
          api_endpoint: formData.api_endpoint,
          email_casilla: formData.email_casilla,
          is_active: formData.is_active,
          yaml_content: formData.yaml_content ? formData.yaml_content.substring(0, 50) + '...' : undefined,
          yaml_content_length: formData.yaml_content ? formData.yaml_content.length : 0
        });
        
        const result = await onSubmit({
          instalacion_id: instalacionId,
          nombre_yaml: formData.nombre_yaml,
          yaml_content: formData.yaml_content,
          api_endpoint: formData.api_endpoint || undefined,
          email_casilla: formData.email_casilla || undefined,
          is_active: formData.is_active,
        });
        
        if (result && result.executionUuid) {
          setExecutionUuid(result.executionUuid);
        }
        
        setShowYamlPreview(false);
        onClose();
      } catch (error: any) {
        console.error('Error submitting:', error);
        // Mostrar el error en el modal en lugar de cerrar
        setValidationSuccess(false);
        setValidationError(error.message || 'Error al procesar la casilla');
      }
    }
  };

  // Renderizar modal inicial
  const renderFirstStep = () => (
    <Dialog 
      open={isOpen && !showYamlPreview} 
      onClose={onClose}
      className="relative z-50"
    >
      <div className="fixed inset-0 bg-black/30 dark:bg-black/50" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4 overflow-y-auto">
        <Dialog.Panel className="w-full max-w-2xl rounded-lg bg-white dark:bg-dark-card p-6 max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <Dialog.Title className="text-xl font-semibold dark:text-dark-text">
              {isEditMode ? 'Editar Casilla de Datos' : 'Nueva Casilla de Datos'}
            </Dialog.Title>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 dark:text-dark-text-secondary dark:hover:text-dark-text"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <form onSubmit={handlePreviewSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-text mb-1">
                Instalación <span className="text-red-500 dark:text-dark-error">*</span>
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-dark-accent focus:border-blue-500 dark:focus:border-dark-accent dark:bg-dark-input dark:text-dark-text"
                value={formData.instalacion_id}
                onChange={(e) => setFormData({ ...formData, instalacion_id: e.target.value })}
                required
              >
                <option value="">Seleccione una instalación</option>
                {installations.map((installation) => (
                  <option key={installation.id} value={installation.id}>
                    {installation.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-text mb-1">
                  Nombre del archivo YAML <span className="text-red-500 dark:text-dark-error">*</span>
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-dark-accent focus:border-blue-500 dark:focus:border-dark-accent dark:bg-dark-input dark:text-dark-text"
                  value={formData.nombre_yaml}
                  onChange={(e) => setFormData({ ...formData, nombre_yaml: e.target.value })}
                  required
                  placeholder="configuracion.yaml"
                />
              </div>
              
              {!isEditMode && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-dark-text mb-1">
                    Archivo YAML
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      accept=".yaml,.yml"
                      onChange={handleFileChange}
                      className="hidden"
                      id="yaml-file"
                    />
                    <Button
                      variant="outline"
                      onClick={() => document.getElementById('yaml-file')?.click()}
                      type="button"
                      icon={<DocumentArrowUpIcon className="h-5 w-5" />}
                    >
                      Seleccionar archivo
                    </Button>
                    {selectedFile && (
                      <span className="text-sm text-gray-600 truncate max-w-[200px]">
                        {selectedFile.name}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-text mb-1">
                  API Endpoint (opcional)
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-dark-accent focus:border-blue-500 dark:focus:border-dark-accent dark:bg-dark-input dark:text-dark-text"
                  value={formData.api_endpoint}
                  onChange={(e) => setFormData({ ...formData, api_endpoint: e.target.value })}
                  placeholder="https://ejemplo.com/api"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-text mb-1">
                  Dirección de Email (opcional)
                </label>
                <input
                  type="email"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-dark-accent focus:border-blue-500 dark:focus:border-dark-accent dark:bg-dark-input dark:text-dark-text"
                  value={formData.email_casilla}
                  onChange={(e) => setFormData({ ...formData, email_casilla: e.target.value })}
                  placeholder="email@ejemplo.com"
                />
              </div>
            </div>

            {isEditMode && (
              <div>
                <label className="flex items-center text-sm font-medium text-gray-700 dark:text-dark-text">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 dark:border-dark-border text-blue-600 dark:text-dark-accent focus:ring-blue-500 dark:focus:ring-dark-accent mr-2"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  />
                  Casilla activa
                </label>
              </div>
            )}

            {isEditMode && (
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-dark-text">
                    Contenido YAML <span className="text-red-500 dark:text-dark-error">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (!formData.yaml_content) {
                        alert('Por favor ingresa contenido YAML para validar');
                        return;
                      }
                      setValidationError(null);
                      setValidationSuccess(false);
                      handleValidationStart();
                    }}
                    className="inline-flex items-center px-3 py-1 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <CodeBracketIcon className="h-4 w-4 mr-1" /> Validar YAML
                  </button>
                </div>
                {isValidating && (
                  <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <div className="flex items-center">
                      <svg className="animate-spin h-5 w-5 text-blue-600 mr-1.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <p className="text-sm font-medium text-blue-800">Validando YAML...</p>
                    </div>
                  </div>
                )}
                {!isValidating && validationError && (
                  <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-md">
                    <div className="flex items-center mb-1">
                      <ExclamationCircleIcon className="h-5 w-5 text-red-600 mr-1.5" />
                      <p className="text-sm font-medium text-red-800">Error de validación:</p>
                    </div>
                    <pre className="text-xs whitespace-pre-wrap font-mono text-red-700 max-h-[100px] overflow-auto p-2 bg-red-100 rounded">{validationError}</pre>
                  </div>
                )}
                {!isValidating && validationSuccess && (
                  <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-md">
                    <div className="flex items-center">
                      <CheckCircleIcon className="h-5 w-5 text-green-600 mr-1.5" />
                      <p className="text-sm font-medium text-green-800">¡YAML validado correctamente!</p>
                    </div>
                  </div>
                )}
                <textarea
                  rows={15}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-dark-border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-dark-accent focus:border-blue-500 dark:focus:border-dark-accent dark:bg-dark-input dark:text-dark-text font-mono text-sm"
                  value={formData.yaml_content}
                  onChange={(e) => {
                    setFormData({ ...formData, yaml_content: e.target.value });
                    // Resetear estados de validación al cambiar el contenido
                    setValidationError(null);
                    setValidationSuccess(false);
                  }}
                  required
                  spellCheck="false"
                  style={{ 
                    height: '300px',
                    maxHeight: '40vh',
                    lineHeight: '1.6',
                    whiteSpace: 'pre',
                    overflowWrap: 'normal',
                    overflowX: 'auto',
                    backgroundColor: '#f8fafc',
                    color: '#334155',
                    tabSize: 2,
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
                  }}
                  placeholder="sage_yaml:\n  name: 'Nombre de la configuración'\n  description: 'Descripción de la configuración'"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={onClose}
                type="button"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                isLoading={isValidating}
              >
                {isEditMode ? 'Guardar cambios' : 'Continuar'}
              </Button>
            </div>
          </form>
        </Dialog.Panel>
      </div>
    </Dialog>
  );

  // Renderizar segundo paso (validación YAML)
  const renderYamlPreview = () => (
    <Dialog
      open={showYamlPreview}
      onClose={() => {}}
      className="relative z-50"
    >
      <div className="fixed inset-0 bg-black/30 dark:bg-black/50" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4 overflow-y-auto">
        <Dialog.Panel className="w-full max-w-3xl bg-white dark:bg-dark-card rounded-lg shadow-xl max-h-[90vh] overflow-y-auto">
          <div className="p-6 space-y-4">
            <div className="flex justify-between items-center">
              <Dialog.Title className="text-xl font-semibold dark:text-dark-text">
                {isValidating ? 'Validando YAML...' : (validationSuccess ? 'YAML Validado' : 'Contenido del YAML')}
              </Dialog.Title>
              {!isValidating && (
                <button
                  onClick={() => setShowYamlPreview(false)}
                  className="text-gray-400 hover:text-gray-500 dark:text-dark-text-secondary dark:hover:text-dark-text"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              )}
            </div>

            {/* Estado de validación */}
            {isValidating && (
              <Card className="bg-blue-50 border border-blue-200">
                <div className="flex items-center space-x-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-700"></div>
                  <p className="text-blue-700">Validando YAML...</p>
                </div>
              </Card>
            )}

            {/* Error de validación */}
            {validationError && (
              <Card className="bg-red-50 border border-red-200">
                <div className="overflow-auto max-h-[200px]">
                  <pre className="text-sm whitespace-pre-wrap font-mono text-red-700">{validationError}</pre>
                </div>
              </Card>
            )}

            {/* Éxito de validación */}
            {validationSuccess && (
              <Card className="bg-green-50 border border-green-200">
                <div className="text-green-700">
                  <p className="font-medium">¡Archivo procesado exitosamente!</p>
                  {executionUuid && (
                    <div className="mt-2 text-sm">
                      Los resultados detallados están disponibles en:{' '}
                      <a 
                        href={`/api/executions/${executionUuid}/log`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 underline"
                      >
                        ./executions/{executionUuid}/log
                      </a>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* Contenido YAML */}
            <Card className="overflow-auto max-h-[500px] p-0">
              <pre className="p-4 bg-gray-50 dark:bg-dark-card-secondary rounded m-0" style={{
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                fontSize: '0.9rem',
                lineHeight: '1.6',
                tabSize: 2,
                whiteSpace: 'pre',
                overflowWrap: 'normal',
                overflowX: 'auto'
              }}>
                <code className="language-yaml dark:text-dark-text">
                  {formData.yaml_content}
                </code>
              </pre>
            </Card>

            {/* Botones de acción */}
            <div className="flex justify-end gap-2 pt-4">
              {!isValidating && (
                validationSuccess ? (
                  <Button 
                    onClick={handleFinish}
                  >
                    {isEditMode ? 'Actualizar Casilla' : 'Crear Casilla'}
                  </Button>
                ) : (
                  <>
                    <Button 
                      variant="outline" 
                      onClick={() => setShowYamlPreview(false)}
                    >
                      Volver
                    </Button>
                    <Button 
                      onClick={handleValidationStart}
                      isLoading={isValidating}
                    >
                      Validar YAML
                    </Button>
                  </>
                )
              )}
            </div>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );

  return (
    <>
      {renderFirstStep()}
      {renderYamlPreview()}
    </>
  );
};