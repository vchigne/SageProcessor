import React, { useState, useEffect } from 'react';
import { Card, Title, Button, Textarea } from "@tremor/react";
import { DocumentArrowUpIcon, DocumentCheckIcon, ArrowDownTrayIcon, ChatBubbleBottomCenterTextIcon } from '@heroicons/react/24/outline';
import Prism from 'prismjs';
import 'prismjs/components/prism-yaml';
import 'prismjs/themes/prism.css';

export const YAMLStudioForm: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [instructions, setInstructions] = useState('');
  const [yamlContent, setYamlContent] = useState('');
  const [promptContent, setPromptContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validationDetails, setValidationDetails] = useState<string | null>(null);
  const [validationSuccess, setValidationSuccess] = useState(false);
  const [promptSuccess, setPromptSuccess] = useState(false);
  const [showYamlEditor, setShowYamlEditor] = useState(false);
  const [filePreview, setFilePreview] = useState<{[key: string]: any}>({});
  const [showPreview, setShowPreview] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  useEffect(() => {
    if (showYamlEditor && yamlContent) {
      Prism.highlightAll();
    }
  }, [showYamlEditor, yamlContent]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setYamlContent('');
      setPromptContent('');
      setValidationError(null);
      setValidationDetails(null);
      setValidationSuccess(false);
      setPromptSuccess(false);
      setFilePreview({});
      setShowPreview(false);
    }
  };

  const previewFile = async () => {
    if (!file) return;

    setIsLoadingPreview(true);
    setValidationError(null);
    setValidationDetails(null);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/preview-file', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al previsualizar el archivo');
      }

      setFilePreview(data);
      setShowPreview(true);
    } catch (error: any) {
      setValidationError(error.message);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const generateYAML = async () => {
    if (!file) return;

    setIsGenerating(true);
    setValidationError(null);
    setValidationDetails(null);
    setValidationSuccess(false);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('instructions', instructions);

    try {
      const response = await fetch('/api/generate-yaml', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setValidationError(data.error || 'Error generando YAML');
        setValidationDetails(data.details || null);
        return;
      }

      setYamlContent(data.yaml);
      setTimeout(() => {
        Prism.highlightAll();
      }, 100);
    } catch (error: any) {
      setValidationError(error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const validateYAML = async () => {
    if (!yamlContent) return;

    setIsValidating(true);
    setValidationError(null);
    setValidationDetails(null);
    setValidationSuccess(false);

    try {
      const response = await fetch('/api/validate-yaml', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ yaml_content: yamlContent }),
      });

      const data = await response.json();

      if (!response.ok) {
        setValidationError(data.error || 'Error validando YAML');
        setValidationDetails(data.details || null);
        return;
      }

      setValidationSuccess(true);
    } catch (error: any) {
      setValidationError(error.message);
    } finally {
      setIsValidating(false);
    }
  };

  const downloadYAML = () => {
    if (!yamlContent) return;

    const element = document.createElement('a');
    const file = new Blob([yamlContent], {type: 'text/yaml;charset=utf-8'});
    element.href = URL.createObjectURL(file);
    element.download = 'configuracion.yaml';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    URL.revokeObjectURL(element.href);
  };
  
  const generatePrompt = async () => {
    if (!file) return;

    setIsGeneratingPrompt(true);
    setValidationError(null);
    setValidationDetails(null);
    setPromptSuccess(false);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('instructions', instructions);

    try {
      const response = await fetch('/api/generate-prompt', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setValidationError(data.error || 'Error generando prompt');
        setValidationDetails(data.details || null);
        return;
      }

      setPromptContent(data.prompt);
      
      // Iniciar descarga automáticamente
      const promptText = data.prompt;
      const element = document.createElement('a');
      const promptFile = new Blob([promptText], {type: 'text/plain;charset=utf-8'});
      element.href = URL.createObjectURL(promptFile);
      element.download = 'prompt_yaml_studio.txt';
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
      URL.revokeObjectURL(element.href);
      
      // Mostrar mensaje de éxito
      setPromptSuccess(true);
      // Ocultar el mensaje después de 5 segundos
      setTimeout(() => {
        setPromptSuccess(false);
      }, 5000);
      
    } catch (error: any) {
      setValidationError(error.message);
    } finally {
      setIsGeneratingPrompt(false);
    }
  };
  
  const downloadPrompt = () => {
    if (!promptContent) return;
    
    const element = document.createElement('a');
    const promptFile = new Blob([promptContent], {type: 'text/plain;charset=utf-8'});
    element.href = URL.createObjectURL(promptFile);
    element.download = 'prompt_yaml_studio.txt';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    URL.revokeObjectURL(element.href);
  };

  const renderPreview = () => {
    if (!filePreview.type) return null;

    const PreviewHeader = () => (
      <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
        <h3 className="text-blue-700 font-medium">
          {filePreview.type === 'zip' 
            ? `Archivos en el ZIP: ${filePreview.total_files}`
            : `Registros totales: ${filePreview.total_records}`}
        </h3>
        <div className="flex flex-col gap-1 mt-1">
          {(filePreview.type === 'csv' || filePreview.type === 'excel') && (
            <p className="text-sm text-blue-600">
              Columnas: {filePreview.columns.join(', ')}
            </p>
          )}
          {filePreview.type === 'csv' && filePreview.has_bom !== undefined && (
            <p className={`text-sm ${filePreview.has_bom ? "text-blue-700 font-medium" : "text-blue-600"}`}>
              BOM UTF-8: {filePreview.has_bom ? "Detectado ✓" : "No"}
              {filePreview.has_bom && " (Se procesará correctamente)"}
            </p>
          )}
        </div>
      </div>
    );

    const renderFilePreview = (file: any) => (
      <div key={file.name} className="mb-6 last:mb-0">
        <div className="flex justify-between items-center mb-2">
          <h4 className="text-sm font-medium text-gray-700">{file.name}</h4>
          <span className="text-xs text-gray-500">
            {`${file.total_records || 0} registros`}
          </span>
        </div>
        <div className="flex flex-wrap text-xs text-gray-600 mb-2 gap-2">
          {file.columns && (
            <p>
              Columnas: {file.columns.join(', ')}
            </p>
          )}
          {file.has_bom !== undefined && (
            <p className={file.has_bom ? "text-blue-600 font-medium" : ""}>
              BOM UTF-8: {file.has_bom ? "Detectado ✓" : "No"}
            </p>
          )}
        </div>
        <div className="bg-white border border-gray-100 rounded overflow-x-auto">
          <pre className="p-4">
            <code className="text-xs">
              {file.error 
                ? file.error 
                : JSON.stringify(file.preview_records?.slice(0,10) || [], null, 2)}
            </code>
          </pre>
        </div>
      </div>
    );

    return (
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="block text-sm font-medium text-gray-700">
            Vista Previa del Archivo
          </label>
          <span className="text-xs text-gray-500">
            {filePreview.type.toUpperCase()}
          </span>
        </div>

        <PreviewHeader />

        <div className="rounded-md bg-gray-50 border border-gray-200">
          <div className="overflow-auto max-h-[400px] p-6">
            {filePreview.type === 'zip' 
              ? filePreview.files.map(renderFilePreview)
              : renderFilePreview({
                  name: 'Archivo',
                  total_records: filePreview.total_records,
                  columns: filePreview.columns,
                  preview_records: filePreview.preview_records,
                  has_bom: filePreview.has_bom
                })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card className="w-full max-w-5xl mx-auto yaml-studio">
      <div className="space-y-8">
        <div>
          <Title>Generar YAML</Title>
          <p className="text-gray-600 mt-2">
            Sube un archivo y proporciona instrucciones para generar tu configuración YAML.
          </p>
          <div className="mt-2 p-3 bg-blue-50 border border-blue-100 rounded-md">
            <p className="text-xs text-blue-700">
              <strong>✨ Nuevo:</strong> Ahora puedes descargar solo el prompt generado para usarlo en otros chats cuando OpenRouter no esté disponible.
              Simplemente haz clic en "Descargar Prompt" y pega el contenido en cualquier interfaz de chat compatible.
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Controles de archivo y botones */}
          <div className="flex flex-col gap-4">
            <div className="w-full">
              <input
                type="file"
                accept=".csv,.xlsx,.zip"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
              />
              <Button
                variant="secondary"
                onClick={() => document.getElementById('file-upload')?.click()}
                icon={DocumentArrowUpIcon}
                className="w-full"
              >
                {file ? file.name : 'Seleccionar Archivo'}
              </Button>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                onClick={generateYAML}
                loading={isGenerating}
                disabled={!file}
                className="w-full sm:w-auto"
              >
                Generar YAML
              </Button>

              <Button
                variant="secondary"
                onClick={validateYAML}
                icon={DocumentCheckIcon}
                loading={isValidating}
                disabled={!yamlContent}
                className="w-full sm:w-auto"
              >
                Validar
              </Button>

              <Button
                variant="secondary"
                onClick={downloadYAML}
                icon={ArrowDownTrayIcon}
                disabled={!yamlContent}
                className="w-full sm:w-auto"
              >
                Descargar YAML
              </Button>

              <Button
                variant="secondary"
                onClick={generatePrompt}
                icon={ChatBubbleBottomCenterTextIcon}
                loading={isGeneratingPrompt}
                disabled={!file}
                className="w-full sm:w-auto"
                title="Generar y descargar el prompt para usar en otro chat"
              >
                Descargar Prompt
              </Button>

              <Button
                variant="secondary"
                onClick={previewFile}
                loading={isLoadingPreview}
                disabled={!file}
                className="w-full sm:w-auto"
              >
                Vista Previa
              </Button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Instrucciones Específicas (prioridad sobre reglas por defecto)
            </label>
            <Textarea
              placeholder="Escribe aquí tus instrucciones específicas. Estas instrucciones tienen prioridad sobre las reglas por defecto y serán seguidas al pie de la letra."
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={4}
              className="w-full"
            />
          </div>
        </div>

        {validationError && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-700">
            <h4 className="text-red-800 font-medium text-sm mb-2">{validationError}</h4>
            {validationDetails && (
              <div className="text-xs mt-2 border-t border-red-100 pt-2 whitespace-pre-wrap leading-relaxed">
                {validationDetails}
              </div>
            )}
          </div>
        )}

        {validationSuccess && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-md text-green-700">
            <p className="text-sm">¡YAML validado correctamente! ✅</p>
            <p className="text-xs mt-1">La estructura y configuración cumplen con los requisitos de SAGE.</p>
          </div>
        )}
        
        {promptSuccess && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-md text-green-700">
            <p className="text-sm">¡Prompt generado y descargado correctamente! ✅</p>
            <p className="text-xs mt-1">El archivo prompt_yaml_studio.txt ha sido guardado en tu dispositivo.</p>
          </div>
        )}

        {showPreview && filePreview && renderPreview()}

        {yamlContent && (
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700">
                YAML Generado
              </label>
              <Button
                variant="secondary"
                onClick={() => setShowYamlEditor(!showYamlEditor)}
                size="xs"
              >
                {showYamlEditor ? 'Ver Formato' : 'Editar YAML'}
              </Button>
            </div>

            {showYamlEditor ? (
              <Textarea
                value={yamlContent}
                onChange={(e) => setYamlContent(e.target.value)}
                rows={15}
                className="w-full font-mono text-sm"
              />
            ) : (
              <div className="rounded-md bg-gray-50 border border-gray-200">
                <div className="overflow-auto max-h-[400px]">
                  <pre className="p-6 min-w-max">
                    <code className="language-yaml text-sm leading-relaxed whitespace-pre">
                      {yamlContent}
                    </code>
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};