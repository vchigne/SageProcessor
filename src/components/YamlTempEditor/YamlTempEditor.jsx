import React, { useState, useEffect, useRef } from 'react';

// Versión simplificada sin uso de archivos temporales
const YamlTempEditor = ({ initialContent, onChange, height = '300px' }) => {
  const [yamlContent, setYamlContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const textareaRef = useRef(null);
  
  // Cuando llega el contenido inicial, lo establecemos directamente
  useEffect(() => {
    console.log('Contenido inicial recibido:', initialContent);
    if (initialContent) {
      setYamlContent(initialContent);
    }
  }, [initialContent]);

  // Actualizar el contenido y notificar el cambio
  const handleContentChange = (newContent) => {
    setYamlContent(newContent);
    
    // Notificar el cambio
    if (onChange) {
      onChange(newContent);
    }
  };

  return (
    <div className="yaml-temp-editor">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4">
          {error}
        </div>
      )}
      
      {/* Usamos textarea directo sin guardar en archivos temporales */}
      <textarea
        ref={textareaRef}
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
        placeholder="sage_yaml:&#10;  name: 'Nombre de la configuración'&#10;  description: 'Descripción de la configuración'"
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