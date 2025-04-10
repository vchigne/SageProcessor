import { useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import Head from 'next/head';

// Un componente de YAML Editor que muestra un mensaje de "en construcción"
const YAMLEditorPage = () => {
  const router = useRouter();
  
  // Función para manejar el botón de "Abrir cuando esté disponible"
  const handleFutureOpen = () => {
    alert("El YAML Editor estará disponible próximamente como una aplicación externa.");
  };
  
  return (
    <>
      <Head>
        <title>YAML Editor - SAGE</title>
      </Head>
      <div className="flex flex-col items-center justify-center min-h-[70vh]">
        <div className="max-w-3xl w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
          <div className="mb-8">
            <svg 
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              className="w-20 h-20 mx-auto text-indigo-600 dark:text-indigo-400 mb-4"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
              <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
              <path d="M2 2l7.586 7.586"></path>
              <circle cx="11" cy="11" r="2"></circle>
            </svg>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-4">
              YAML Editor
            </h1>
            <div className="h-1 w-20 bg-indigo-600 mx-auto mb-6"></div>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
              El YAML Editor está en construcción y estará disponible próximamente como una aplicación independiente.
            </p>
            
            <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg mb-8">
              <h3 className="text-lg font-semibold mb-2 text-gray-700 dark:text-gray-300">
                Características próximamente disponibles:
              </h3>
              <ul className="text-left text-gray-600 dark:text-gray-400 space-y-2 ml-6 list-disc">
                <li>Editor visual de configuraciones YAML</li>
                <li>Validación en tiempo real</li>
                <li>Compatibilidad con todos los formatos soportados por SAGE</li>
                <li>Integración con sistemas de BI</li>
                <li>Exportación e importación de configuraciones</li>
              </ul>
            </div>
            
            <div className="flex space-x-4 justify-center">
              <button
                onClick={handleFutureOpen}
                className="px-6 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
              >
                Abrir cuando esté disponible
              </button>
              
              <button
                onClick={() => router.push('/')}
                className="px-6 py-3 bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Volver al Dashboard
              </button>
            </div>
            
            <div className="mt-8 text-sm text-gray-500 dark:text-gray-400">
              <p>Para más información, contacte con el equipo de desarrollo de SAGE.</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

YAMLEditorPage.getLayout = function getLayout(page) {
  return <Layout>{page}</Layout>;
};

export default YAMLEditorPage;