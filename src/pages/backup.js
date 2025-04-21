import Head from 'next/head';
import { useState, useEffect } from 'react';

export default function BackupPage() {
  const [fileExists, setFileExists] = useState(false);
  
  useEffect(() => {
    // Verificar si el archivo existe
    async function checkFileExists() {
      try {
        const response = await fetch('/api/backup/download', { method: 'HEAD' });
        setFileExists(response.ok);
      } catch (error) {
        console.error('Error al verificar archivo:', error);
        setFileExists(false);
      }
    }
    
    checkFileExists();
  }, []);
  
  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <Head>
        <title>SAGE Cloud Backup</title>
      </Head>
      
      <div className="max-w-3xl mx-auto">
        <div className="bg-white shadow-lg rounded-lg overflow-hidden">
          <div className="px-6 py-8">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Backup de SAGE Cloud</h1>
              <p className="text-gray-600 mb-6">
                Descarga de backup de componentes de cloud y Janitor Daemon
              </p>
              
              {fileExists ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-8">
                  <h2 className="text-xl font-semibold text-green-700 mb-2">Archivo de backup disponible</h2>
                  <p className="text-green-600 mb-4">
                    El archivo ZIP contiene todos los componentes actualizados de SAGE Cloud y el Janitor Daemon.
                  </p>
                  
                  <a 
                    href="/api/backup/download"
                    download
                    className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                  >
                    Descargar Backup (149 KB)
                  </a>
                </div>
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-8">
                  <h2 className="text-xl font-semibold text-yellow-700 mb-2">Archivo no encontrado</h2>
                  <p className="text-yellow-600">
                    No se ha podido encontrar el archivo de backup. Por favor contacta al administrador.
                  </p>
                </div>
              )}
              
              <div className="mt-8 space-y-6">
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                  <h2 className="text-xl font-semibold text-gray-800 mb-4">Contenido del backup</h2>
                  
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-medium text-gray-800">Adaptadores de nube</h3>
                      <ul className="mt-2 text-gray-600 list-disc pl-5 space-y-1">
                        <li>MinIO Adapter (con correcciones para listar archivos)</li>
                        <li>S3 Adapter</li>
                        <li>Azure Adapter</li>
                        <li>GCP Adapter</li>
                        <li>SFTP Adapter</li>
                      </ul>
                    </div>
                    
                    <div>
                      <h3 className="font-medium text-gray-800">APIs</h3>
                      <ul className="mt-2 text-gray-600 list-disc pl-5 space-y-1">
                        <li>Cloud APIs</li>
                        <li>Cloud Files APIs</li>
                        <li>Cloud Secrets APIs</li>
                      </ul>
                    </div>
                    
                    <div>
                      <h3 className="font-medium text-gray-800">Daemons</h3>
                      <ul className="mt-2 text-gray-600 list-disc pl-5 space-y-1">
                        <li>Janitor Daemon</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}