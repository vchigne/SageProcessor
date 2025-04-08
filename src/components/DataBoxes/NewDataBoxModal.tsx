import React, { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { Button } from '@tremor/react';
import { DocumentArrowUpIcon } from '@heroicons/react/24/outline';
import Prism from 'prismjs';
import 'prismjs/components/prism-yaml';
import 'prismjs/themes/prism.css';

interface Installation {
  id: number;
  nombre: string;
  organizacion: {
    nombre: string;
  };
  producto: {
    nombre: string;
  };
  pais: {
    nombre: string;
  };
}

interface DataBox {
  id: number;
  instalacion: {
    id: number;
    nombre: string;
    organizacion: {
      nombre: string;
    };
    producto: {
      nombre: string;
    };
    pais: {
      nombre: string;
    };
  };
  nombre_yaml: string;
  yaml_content?: {
    name: string;
    description: string;
  };
  api_endpoint?: string;
  email_casilla?: string;
  is_active: boolean;
}

interface NewDataBoxModalProps {
  isOpen: boolean;
  onClose: () => void;
  installations: Installation[];
  onSubmit: (data: any) => Promise<{ executionUuid?: string }>;
  dataBox?: DataBox | null;
}

export const NewDataBoxModal: React.FC<NewDataBoxModalProps> = ({
  isOpen,
  onClose,
  installations,
  onSubmit,
  dataBox,
}) => {
  const [formData, setFormData] = useState({
    instalacion_id: '',
    nombre_yaml: '',
    yaml_content: '',
    api_endpoint: '',
    email_casilla: '',
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showYamlPreview, setShowYamlPreview] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validationSuccess, setValidationSuccess] = useState(false);
  const [executionUuid, setExecutionUuid] = useState<string | null>(null); // Added state for execution UUID

  useEffect(() => {
    if (!isOpen) {
      setFormData({
        instalacion_id: '',
        nombre_yaml: '',
        yaml_content: '',
        api_endpoint: '',
        email_casilla: '',
      });
      setSelectedFile(null);
      setShowYamlPreview(false);
      setIsValidating(false);
      setValidationError(null);
      setValidationSuccess(false);
      setExecutionUuid(null); // Reset UUID on close
    }
  }, [isOpen]);

  useEffect(() => {
    if (showYamlPreview && formData.yaml_content) {
      Prism.highlightAll();
    }
  }, [showYamlPreview, formData.yaml_content]);

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

  const handlePreviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      return;
    }
    setShowYamlPreview(true);
  };

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

  const handleFinish = async () => {
    if (validationSuccess) {
      try {
        const response = await onSubmit({
          instalacion_id: parseInt(formData.instalacion_id),
          nombre_yaml: formData.nombre_yaml,
          yaml_content: formData.yaml_content,
          api_endpoint: formData.api_endpoint || undefined,
          email_casilla: formData.email_casilla || undefined,
        });
        // Usando el valor ejecutionUuid devuelto
        if (response.executionUuid) {
          setExecutionUuid(response.executionUuid);
        }
        setShowYamlPreview(false);
        onClose();
      } catch (error: any) {
        console.error('Error submitting:', error);
        setValidationError(error.message || 'Error al crear la casilla');
      }
    }
  };

  return (
    <>
      {/* Initial Form Modal */}
      <Dialog 
        open={isOpen && !showYamlPreview} 
        onClose={onClose}
        className="relative z-50"
      >
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="w-full max-w-lg rounded-lg bg-white p-6">
            <Dialog.Title className="text-lg font-medium mb-4">
              Nueva Casilla de Datos
            </Dialog.Title>

            <form onSubmit={handlePreviewSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Instalación
                </label>
                <select
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  value={formData.instalacion_id}
                  onChange={(e) => setFormData({ ...formData, instalacion_id: e.target.value })}
                  required
                >
                  <option value="">Seleccione una instalación</option>
                  {installations.map((installation) => (
                    <option key={installation.id} value={installation.id}>
                      {installation.producto.nombre} - {installation.organizacion.nombre} ({installation.pais.nombre})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Archivo YAML
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="file"
                    accept=".yaml,.yml"
                    onChange={handleFileChange}
                    className="hidden"
                    id="yaml-file"
                    required
                  />
                  <Button
                    variant="secondary"
                    onClick={() => document.getElementById('yaml-file')?.click()}
                    type="button"
                  >
                    <DocumentArrowUpIcon className="h-5 w-5 mr-2" />
                    Seleccionar archivo
                  </Button>
                  {selectedFile && (
                    <span className="text-sm text-gray-600">
                      {selectedFile.name}
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  API Endpoint (opcional)
                </label>
                <input
                  type="text"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  value={formData.api_endpoint}
                  onChange={(e) => setFormData({ ...formData, api_endpoint: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Dirección de Email (opcional)
                </label>
                <input
                  type="email"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  value={formData.email_casilla}
                  onChange={(e) => setFormData({ ...formData, email_casilla: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={onClose}>
                  Cancelar
                </Button>
                <Button type="submit" variant="primary">
                  Continuar
                </Button>
              </div>
            </form>
          </Dialog.Panel>
        </div>
      </Dialog>

      {/* YAML Preview and Validation Modal */}
      <Dialog
        open={showYamlPreview}
        onClose={() => {}}
        className="relative z-50"
      >
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="w-full max-w-3xl bg-white rounded-lg shadow-xl">
            <div className="p-6 space-y-4">
              <Dialog.Title className="text-lg font-medium">
                {isValidating ? 'Validando YAML...' : (validationSuccess ? 'YAML Validado' : 'Contenido del YAML')}
              </Dialog.Title>

              {/* Estado de validación */}
              {isValidating && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-md text-blue-700">
                  <p className="text-sm">Validando YAML...</p>
                </div>
              )}

              {/* Error de validación */}
              {validationError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-700 overflow-auto max-h-[200px]">
                  <pre className="text-sm whitespace-pre-wrap font-mono">{validationError}</pre>
                </div>
              )}

              {/* Éxito de validación */}
              {validationSuccess && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-md text-green-700">
                  <p className="text-sm">¡Archivo procesado exitosamente!</p>
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
              )}

              {/* Contenido YAML */}
              <div className="rounded-md bg-gray-50 overflow-auto max-h-[400px]">
                <pre className="p-4">
                  <code className="language-yaml">
                    {formData.yaml_content}
                  </code>
                </pre>
              </div>

              {/* Botones de acción */}
              <div className="flex justify-end gap-2 pt-4">
                {!isValidating && (
                  validationSuccess ? (
                    <Button variant="primary" onClick={handleFinish}>
                      Crear Casilla
                    </Button>
                  ) : (
                    <>
                      <Button variant="secondary" onClick={() => setShowYamlPreview(false)}>
                        Volver
                      </Button>
                      <Button 
                        variant="primary" 
                        onClick={handleValidationStart}
                        disabled={isValidating}
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
    </>
  );
};