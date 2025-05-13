import React, { useState, useEffect } from 'react';

const YamlTempEditor = ({ initialContent, onChange, height = '300px' }) => {
  const [fileName, setFileName] = useState('');
  const [yamlContent, setYamlContent] = useState(initialContent || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Crear archivo YAML al inicializar
  useEffect(() => {
    if (initialContent) {
      createTempYamlFile(initialContent);
    }
  }, [initialContent]);

  // Crear archivo YAML temporal
  const createTempYamlFile = async (content) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/temp-yaml/write', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ yaml_content: content }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Error al crear archivo YAML temporal');
      }
      
      setFileName(data.filename);
    } catch (error) {
      console.error('Error al crear archivo YAML temporal:', error);
      setError('Error al crear archivo YAML temporal. Intente de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  // Leer archivo YAML temporal
  const readTempYamlFile = async () => {
    if (!fileName) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/temp-yaml/read?filename=${fileName}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Error al leer archivo YAML temporal');
      }
      
      // Actualizar el contenido y notificar el cambio
      setYamlContent(data.content);
      if (onChange) {
        onChange(data.content);
      }
    } catch (error) {
      console.error('Error al leer archivo YAML temporal:', error);
      setError('Error al leer archivo YAML temporal. Intente de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  // Actualizar el archivo temporal y notificar el cambio
  const handleContentChange = async (newContent) => {
    setYamlContent(newContent);
    
    // Notificar el cambio
    if (onChange) {
      onChange(newContent);
    }
    
    // Actualizar el archivo temporal
    await createTempYamlFile(newContent);
  };

  return (
    <div className="yaml-temp-editor">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4">
          {error}
        </div>
      )}
      
      <textarea
        value={yamlContent}
        onChange={(e) => handleContentChange(e.target.value)}
        className="w-full px-4 py-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
        style={{ 
          height,
          lineHeight: '1.4',
          whiteSpace: 'pre',
          tabSize: 2,
          resize: 'vertical',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
        }}
        spellCheck="false"
        disabled={loading}
      />
      
      {loading && (
        <div className="mt-2 text-sm text-gray-500 flex items-center">
          <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Procesando...
        </div>
      )}
    </div>
  );
};

export default YamlTempEditor;