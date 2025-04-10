import { useEffect } from 'react'
import { Title } from '@tremor/react'
import Head from 'next/head'

// Componente que redirige al usuario al YAML Editor independiente
export default function YAMLEditorRedirect() {
  useEffect(() => {
    // Construir la URL base 
    const baseUrl = window.location.origin;
    
    // Abrir en una nueva pestaña la aplicación YAML Editor
    window.open(`${baseUrl}/yaml_editor/`, '_blank');
    
    // Opcional: redirigir a la página principal después de abrir
    setTimeout(() => {
      window.location.href = '/';
    }, 500);
  }, []);

  return (
    <>
      <Head>
        <title>Abriendo YAML Editor - SAGE</title>
      </Head>
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
          <Title className="mb-4">Abriendo YAML Editor</Title>
          <p className="text-gray-600 mb-4">
            Estamos abriendo la aplicación YAML Editor en una nueva pestaña...
          </p>
          <p className="text-gray-500 text-sm">
            Si la aplicación no se abre automáticamente, 
            <a 
              href="/yaml_editor/" 
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 hover:text-indigo-800 ml-1"
            >
              haga clic aquí
            </a>.
          </p>
        </div>
      </div>
    </>
  )
}