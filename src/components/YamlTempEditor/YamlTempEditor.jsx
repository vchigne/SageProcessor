import React, { useState, useEffect, useRef } from 'react';

// Versión simplificada sin uso de librerías externas para validación
const YamlTempEditor = ({ initialContent, onChange, height = '300px' }) => {
  const [yamlContent, setYamlContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [prevalidationError, setPrevalidationError] = useState(null);
  const textareaRef = useRef(null);
  
  // Cuando llega el contenido inicial, lo establecemos directamente
  useEffect(() => {
    console.log('Contenido inicial recibido:', initialContent);
    if (initialContent) {
      setYamlContent(initialContent);
      // Realizar validación básica
      validateBasicYamlStructure(initialContent);
    }
  }, [initialContent]);

  // Función para realizar una validación básica del YAML sin usar js-yaml
  const validateBasicYamlStructure = (content) => {
    setPrevalidationError(null);
    
    if (!content || content.trim() === '') {
      setPrevalidationError('El contenido YAML no puede estar vacío.');
      return false;
    }
    
    // Verificar formato básico (buscar al menos las secciones principales)
    const hasSageYaml = /sage_yaml\s*:/i.test(content);
    const hasCatalogs = /catalogs\s*:/i.test(content);
    const hasPackages = /packages\s*:/i.test(content);
    
    if (!hasSageYaml || !hasCatalogs || !hasPackages) {
      setPrevalidationError('El YAML debe contener las secciones: sage_yaml, catalogs y packages.');
      return false;
    }
    
    // Verificar que no haya listas (- elementos) en el nivel superior
    // Esto detecta casos donde se han pegado varias estructuras YAML o hay un formato incorrecto
    const lines = content.split('\n');
    const topLevelListItems = lines.filter(line => 
      line.trim().startsWith('-') && 
      !line.trim().match(/^\s+-/) && // Ignorar listas anidadas
      line.trim().length > 1
    );
    
    if (topLevelListItems.length > 0) {
      setPrevalidationError(
        'El YAML tiene un formato incorrecto. No debe tener elementos de lista (líneas que comienzan con "-") ' +
        'en el nivel superior. Por favor, verifica la estructura y elimina cualquier línea que comience con "-" ' +
        'al inicio del documento.'
      );
      return false;
    }
    
    // Verificar sangría consistente (detectar problemas comunes)
    let prevIndent = 0;
    let inconsistentIndent = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim() === '' || line.trim().startsWith('#')) continue;
      
      const indent = line.search(/\S/);
      if (indent > 0) {
        if (prevIndent > 0 && indent > prevIndent && indent !== prevIndent + 2) {
          inconsistentIndent = true;
          break;
        }
        prevIndent = indent;
      }
    }
    
    if (inconsistentIndent) {
      setPrevalidationError('La sangría del YAML parece inconsistente. Verifica que uses espacios de manera uniforme.');
      return false;
    }
    
    return true;
  };

  // Actualizar el contenido y notificar el cambio
  const handleContentChange = (newContent) => {
    setYamlContent(newContent);
    
    // Validar estructura básica
    validateBasicYamlStructure(newContent);
    
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
      
      {prevalidationError && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-md mb-4">
          <h3 className="font-bold mb-1">Advertencia de formato YAML</h3>
          <p>{prevalidationError}</p>
          <p className="mt-2 text-xs">
            Este error puede causar problemas al validar el YAML. Corríjalo antes de guardar.
          </p>
        </div>
      )}
      
      {/* Usamos textarea directo sin guardar en archivos temporales */}
      <textarea
        ref={textareaRef}
        value={yamlContent}
        onChange={(e) => handleContentChange(e.target.value)}
        className={`w-full px-4 py-3 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm ${prevalidationError ? 'border-amber-300' : 'border-gray-300'}`}
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