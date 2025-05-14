import React, { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { DocumentArrowUpIcon, CheckCircleIcon, CodeBracketIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { Casilla, Instalacion } from '../../../types';
import { Button, Card } from '../../components';
import Prism from 'prismjs';
import 'prismjs/components/prism-yaml';
import 'prismjs/themes/prism.css';
import yaml from 'yaml';
import YamlTempEditor from '../../../components/YamlTempEditor';

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
        
        // Extraer is_active, manejar posibles casos de nulidad
        const isActive = dataBox.is_active !== undefined ? 
                         dataBox.is_active : 
                         true;
        
        // Actualizar estado del formulario con los datos del dataBox
        setFormData({
          instalacion_id: String(instalacionId),
          nombre_yaml: dataBox.nombre_yaml || '',
          yaml_content: '',  // Se carga desde la API
          api_endpoint: dataBox.api_endpoint || '',
          email_casilla: dataBox.email_casilla || '',
          is_active: isActive,
        });
        
        // Cargar contenido del YAML desde la API
        fetch(`/api/data-boxes/${dataBox.id}/yaml`)
          .then(response => response.json())
          .then(data => {
            console.log('Contenido YAML cargado:', data.content ? 'OK' : 'Vacío');
            if (data.content) {
              setFormData(prev => ({
                ...prev,
                yaml_content: data.content
              }));
            } else {
              console.error('El contenido YAML está vacío o no tiene el formato esperado');
              // Usar el contenido que podría venir en dataBox como respaldo
              if (dataBox.yaml_contenido) {
                setFormData(prev => ({
                  ...prev,
                  yaml_content: dataBox.yaml_contenido
                }));
              }
            }
          })
          .catch(error => {
            console.error('Error al cargar el contenido YAML:', error);
            // Usar el contenido que podría venir en dataBox como respaldo
            if (dataBox.yaml_contenido) {
              setFormData(prev => ({
                ...prev,
                yaml_content: dataBox.yaml_contenido
              }));
            }
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
      setIsValidating(false);
      setValidationError(null);
      setValidationSuccess(false);
      setExecutionUuid(null);
    }
  }, [isOpen, dataBox]);

  // Aplicar resaltado de sintaxis al formulario YAML
  useEffect(() => {
    if (formData.yaml_content) {
      Prism.highlightAll();
    }
  }, [formData.yaml_content]);

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

  // Enviar formulario directamente para validación
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
    
    // Iniciar validación directamente
    handleValidationStart();
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

      if (!response.ok || data.error) {
        let errorMessage = data.details || data.error || 'Error en la validación del YAML';
        
        // Detectar los errores específicos relacionados con formato incorrecto
        if (errorMessage.includes("'str' object has no attribute 'keys'") || 
            errorMessage.includes("'list' object has no attribute 'keys'")) {
          // Añadir un mensaje explicativo sobre el error
          errorMessage = errorMessage + "\n\n💡 NOTA IMPORTANTE: Este error indica que el YAML no tiene el formato correcto. " +
                        "Asegúrate de que el YAML es un objeto con las secciones sage_yaml, catalogs y packages, " +
                        "y no una lista, texto plano u otro formato no compatible.";
        }
        
        setValidationError(errorMessage);
        return;
      }

      setValidationSuccess(true);
      
      // Si la validación es exitosa, procedemos directamente a guardar
      if (isEditMode) {
        await handleFinish();
      } else {
        // En modo de creación, mostramos un mensaje y esperamos confirmación
        const confirmSave = confirm('¡YAML validado correctamente! ¿Desea guardar la casilla de datos?');
        if (confirmSave) {
          await handleFinish();
        }
      }
    } catch (error: any) {
      setValidationError(error.message || 'Error en la validación del YAML');
      console.error('Error validating YAML:', error);
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
        
        // Si es modo edición, solicitar confirmación y crear backup
        if (isEditMode) {
          const confirmUpdate = window.confirm(
            "¿Está seguro que desea guardar los cambios? Se creará un respaldo del YAML anterior."
          );
          
          if (!confirmUpdate) {
            return; // Cancelar la operación
          }
          
          // Crear backup del YAML actual
          try {
            console.log('Intentando crear backup para la casilla ID:', dataBox?.id);
            
            const backupResponse = await fetch(`/api/data-boxes/${dataBox?.id}/backup`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ 
                description: `Backup automático antes de actualización - ${new Date().toLocaleString()}` 
              }),
            });
            
            const backupResult = await backupResponse.json();
            
            if (!backupResponse.ok) {
              console.warn('No se pudo crear backup:', backupResult.error);
              alert('Advertencia: No se pudo crear un respaldo del YAML anterior. ¿Desea continuar de todos modos?');
            } else {
              console.log('Backup creado exitosamente:', backupResult);
            }
          } catch (backupError) {
            console.warn('Error al crear backup:', backupError);
            // No bloqueamos la actualización por un error en el backup
          }
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
        
        onClose();
      } catch (error: any) {
        console.error('Error submitting:', error);
        // Mostrar el error en el modal en lugar de cerrar
        setValidationSuccess(false);
        setValidationError(error.message || 'Error al procesar la casilla');
      }
    }
  };

  return (
    <Dialog 
      open={isOpen} 
      onClose={onClose}
      className="relative z-50"
    >
      <div className="fixed inset-0 bg-black/30 dark:bg-black/50" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4 overflow-y-auto">
        <Dialog.Panel className="w-full max-w-3xl bg-white dark:bg-dark-card rounded-lg shadow-xl max-h-[90vh] overflow-y-auto">
          <div className="p-6 space-y-4">
            <div className="flex justify-between items-center">
              <Dialog.Title className="text-xl font-semibold dark:text-dark-text">
                {isEditMode ? 'Editar Casilla de Datos' : 'Nueva Casilla de Datos'}
              </Dialog.Title>
            </div>

            {/* Mostrar errores de validación */}
            {validationError && (
              <Card className="bg-red-50 border border-red-200">
                <div className="flex items-start space-x-2">
                  <ExclamationCircleIcon className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-red-700">Error en la validación del YAML:</p>
                    <pre className="mt-1 text-sm text-red-600 whitespace-pre-wrap font-mono overflow-auto max-h-[200px]">
                      {validationError}
                    </pre>
                  </div>
                </div>
              </Card>
            )}

            {/* Mostrar éxito de validación */}
            {validationSuccess && (
              <Card className="bg-green-50 border border-green-200">
                <div className="flex items-start space-x-2">
                  <CheckCircleIcon className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-green-700">YAML validado correctamente</p>
                    {executionUuid && (
                      <p className="mt-1 text-sm text-green-600">
                        ID de ejecución: {executionUuid}
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            )}

            <form onSubmit={handlePreviewSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    <option value="">Seleccionar instalación</option>
                    {installations.map((inst) => (
                      <option key={inst.id} value={inst.id}>
                        {inst.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-dark-text mb-1">
                    Nombre del archivo <span className="text-red-500 dark:text-dark-error">*</span>
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-dark-accent focus:border-blue-500 dark:focus:border-dark-accent dark:bg-dark-input dark:text-dark-text"
                    value={formData.nombre_yaml}
                    onChange={(e) => setFormData({ ...formData, nombre_yaml: e.target.value })}
                    placeholder="nombre-del-archivo.yaml"
                    required
                  />
                </div>
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

              {/* Editor YAML */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-dark-text">
                    Contenido YAML <span className="text-red-500 dark:text-dark-error">*</span>
                  </label>
                  {formData.yaml_content && (
                    <button
                      type="button"
                      onClick={() => handleValidationStart()}
                      className="inline-flex items-center px-3 py-1 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      disabled={isValidating}
                    >
                      {isValidating ? (
                        <>
                          <svg className="animate-spin h-4 w-4 mr-1.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                          </svg>
                          Validando...
                        </>
                      ) : (
                        <>
                          <CodeBracketIcon className="h-4 w-4 mr-1" /> Validar YAML
                        </>
                      )}
                    </button>
                  )}
                </div>
                
                {/* Editor de YAML con componente YamlTempEditor */}
                <YamlTempEditor
                  initialContent={formData.yaml_content}
                  onChange={(content) => setFormData(prev => ({ ...prev, yaml_content: content }))}
                  height="300px"
                />
              </div>

              <div className="flex justify-end space-x-3">
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
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};