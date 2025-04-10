import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import Head from 'next/head';

// Un componente que redirige a un YAML Editor externo
const YAMLEditorPage = () => {
  const router = useRouter();
  
  // Estado para manejar si la ventana se abrió con éxito
  const [openSuccess, setOpenSuccess] = useState(false);
  const [redirectTimerId, setRedirectTimerId] = useState(null);
  
  // Al cargar, abrir el YAML Editor en una nueva ventana
  useEffect(() => {
    // URL de la aplicación YAML Editor externa alojada en un servidor completamente separado
    // Esta URL debe apuntar a la ubicación real de la aplicación YAML Editor
    const yamlEditorUrl = "https://yaml-editor.vidahub.ai";
    
    try {
      // Intentar abrir una nueva ventana
      const newWindow = window.open(yamlEditorUrl, "_blank", "noopener,noreferrer");
      
      // Verificar si la ventana se abrió correctamente (podría ser null si fue bloqueada)
      if (newWindow) {
        setOpenSuccess(true);
        
        // Redirigir al usuario de vuelta al dashboard después de un breve retraso
        const timerId = setTimeout(() => {
          router.push('/');
        }, 1500); // Darle 1.5 segundos para ver el mensaje de éxito
        
        setRedirectTimerId(timerId);
      }
    } catch (error) {
      console.error("Error al abrir YAML Editor:", error);
    }
    
    // Limpiar el temporizador si el componente se desmonta
    return () => {
      if (redirectTimerId) {
        clearTimeout(redirectTimerId);
      }
    };
  }, []);
  
  // Función para intentar abrir manualmente
  const handleManualOpen = () => {
    const yamlEditorUrl = "https://yaml-editor.vidahub.ai";
    window.open(yamlEditorUrl, "_blank", "noopener,noreferrer");
  };
  
  return (
    <>
      <Head>
        <title>YAML Editor - SAGE</title>
      </Head>
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        {openSuccess ? (
          <div className="text-gray-600 dark:text-gray-300 text-center">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-16 w-16 mx-auto mb-4 text-green-500" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M5 13l4 4L19 7" 
              />
            </svg>
            <p className="text-lg mb-2 font-semibold">YAML Editor abierto con éxito</p>
            <p className="mb-4">Serás redirigido al dashboard en un momento...</p>
          </div>
        ) : (
          <div className="text-gray-600 dark:text-gray-300 text-center">
            <p className="text-lg mb-4">Abriendo YAML Editor en una nueva ventana...</p>
            <p className="mb-6">Si no se abre automáticamente, por favor verifica que no está siendo bloqueado por tu navegador.</p>
            
            <div className="flex space-x-4 justify-center">
              <button
                onClick={handleManualOpen}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
              >
                Abrir YAML Editor manualmente
              </button>
              
              <button
                onClick={() => router.push('/')}
                className="px-4 py-2 bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Volver al Dashboard
              </button>
            </div>
            
            <div className="mt-8 text-sm text-gray-500 dark:text-gray-400">
              <p>Nota: El YAML Editor es una aplicación externa que se ejecuta en un servidor independiente.</p>
              <p className="mt-2">URL del Editor: <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">https://yaml-editor.vidahub.ai</code></p>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

YAMLEditorPage.getLayout = function getLayout(page) {
  return <Layout>{page}</Layout>;
};

export default YAMLEditorPage;