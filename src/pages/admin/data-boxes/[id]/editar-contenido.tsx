import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Button } from '@tremor/react';
import Head from 'next/head';

// Página para editar directamente el contenido YAML
export default function EditarContenidoYAML() {
  const router = useRouter();
  const { id } = router.query;
  
  const [yamlContent, setYamlContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [casillaInfo, setCasillaInfo] = useState({
    nombre_yaml: '',
    instalacion_nombre: ''
  });

  // Cargar el contenido YAML
  useEffect(() => {
    if (!id) return;
    
    setIsLoading(true);
    
    fetch(`/api/data-boxes/${id}/yaml`)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Error ${response.status}: No se pudo cargar el contenido YAML`);
        }
        return response.json();
      })
      .then(data => {
        console.log('Datos obtenidos:', data);
        if (data && data.content) {
          setYamlContent(data.content);
          setCasillaInfo(prev => ({
            ...prev,
            nombre_yaml: data.nombre || ''
          }));
        } else {
          throw new Error('El contenido YAML está vacío o no tiene el formato esperado');
        }
      })
      .catch(err => {
        console.error('Error al cargar el YAML:', err);
        setError(`Error al cargar el contenido YAML: ${err.message}`);
      })
      .finally(() => {
        setIsLoading(false);
      });
      
    // Cargar información adicional de la casilla
    fetch(`/api/data-boxes/${id}`)
      .then(response => {
        if (!response.ok) {
          console.warn('No se pudo cargar la información de la casilla');
          return null;
        }
        return response.json();
      })
      .then(data => {
        if (data) {
          setCasillaInfo({
            nombre_yaml: data.nombre_yaml || '',
            instalacion_nombre: data.instalacion?.nombre || ''
          });
        }
      })
      .catch(err => {
        console.warn('Error al cargar información de la casilla:', err);
      });
  }, [id]);

  // Guardar el contenido YAML
  const handleSave = async () => {
    if (!id) return;
    
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const response = await fetch(`/api/data-boxes/${id}/update-yaml-content`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          yaml_content: yamlContent
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al guardar el contenido YAML');
      }
      
      setSuccess('Contenido YAML guardado correctamente');
      
      // Redirigir a la página de casillas después de un breve retraso
      setTimeout(() => {
        router.push('/admin/data-boxes');
      }, 1500);
    } catch (err) {
      console.error('Error al guardar:', err);
      setError(`Error al guardar: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <Head>
        <title>Editar Contenido YAML</title>
      </Head>
      
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">
          Editar Contenido YAML
        </h1>
        <p className="text-gray-600">
          {casillaInfo.nombre_yaml} - {casillaInfo.instalacion_nombre}
        </p>
      </div>
      
      {isLoading && !yamlContent && (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      )}
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4">
          {error}
        </div>
      )}
      
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md mb-4">
          {success}
        </div>
      )}
      
      <div className="mb-6">
        <textarea
          value={yamlContent}
          onChange={(e) => setYamlContent(e.target.value)}
          className="w-full h-[600px] px-4 py-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
          style={{ 
            lineHeight: '1.4',
            whiteSpace: 'pre',
            tabSize: 2,
            resize: 'vertical',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
          }}
          spellCheck="false"
          disabled={isLoading}
        />
      </div>
      
      <div className="flex justify-end space-x-4">
        <Button
          onClick={() => router.push('/admin/data-boxes')}
          color="gray"
          disabled={isLoading}
        >
          Cancelar
        </Button>
        
        <Button
          onClick={handleSave}
          color="blue"
          disabled={isLoading}
        >
          {isLoading ? 'Guardando...' : 'Guardar cambios'}
        </Button>
      </div>
    </div>
  );
}