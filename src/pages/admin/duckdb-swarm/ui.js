import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

export default function DuckDBUI() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('Cargando interfaz de DuckDB...');

  useEffect(() => {
    // Verificar si hay un serverId en la URL 
    if (!router.isReady) return;

    const loadUI = async () => {
      setLoading(true);
      setMessage('Inicializando la interfaz de DuckDB...');

      try {
        // Si no tenemos el serverId, podemos usar el primer servidor disponible
        const response = await fetch('/api/admin/duckdb-swarm/servers');
        if (!response.ok) {
          throw new Error(`Error al obtener servidores: ${response.statusText}`);
        }

        const serversData = await response.json();
        if (!serversData.servers || serversData.servers.length === 0) {
          throw new Error('No hay servidores DuckDB disponibles');
        }

        // Tomar el primer servidor activo o el primero si no hay activos
        const activeServer = serversData.servers.find(s => s.status === 'active') || serversData.servers[0];
        
        setMessage(`Conectando al servidor ${activeServer.name || activeServer.hostname}...`);

        // Esta interfaz es una simulación simple
        // En un entorno real, cargaríamos aquí la UI real de DuckDB
        setTimeout(() => {
          setLoading(false);
        }, 1500);
      } catch (err) {
        console.error('Error al cargar la UI de DuckDB:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    loadUI();
  }, [router.isReady]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
        <div className="w-full max-w-4xl bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-500 mb-4"></div>
            <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-200 mb-2">
              {message}
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-center">
              Esto puede tomar unos momentos...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
        <div className="w-full max-w-4xl bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 border-l-4 border-red-500">
          <h2 className="text-2xl font-semibold text-red-600 dark:text-red-400 mb-4">
            Error al cargar la interfaz
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            {error}
          </p>
          <button
            onClick={() => router.push('/admin/duckdb-swarm/simple')}
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition"
          >
            Volver al panel de control
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-100 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            DuckDB UI
          </h1>
          <button
            onClick={() => router.push('/admin/duckdb-swarm/simple')}
            className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            Volver
          </button>
        </div>
      </header>

      <main className="flex-grow p-4">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
            <div className="p-6">
              {/* Área de SQL Editor */}
              <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Editor SQL
              </h2>
              <textarea
                className="w-full h-40 p-4 border border-gray-300 dark:border-gray-700 rounded-md dark:bg-gray-900 dark:text-white font-mono focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="-- Escriba su consulta SQL aquí
SELECT * FROM example_table LIMIT 10;"
              ></textarea>
              
              <div className="mt-4 flex justify-end">
                <button
                  className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition"
                >
                  Ejecutar consulta
                </button>
              </div>
              
              {/* Área de resultados */}
              <div className="mt-8">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  Resultados
                </h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          ID
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Nombre
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Valor
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Fecha
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          1
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                          Ejemplo 1
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                          123.45
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                          2023-04-26
                        </td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          2
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                          Ejemplo 2
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                          67.89
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                          2023-04-27
                        </td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          3
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                          Ejemplo 3
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                          45.67
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                          2023-04-28
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-gray-500 dark:text-gray-400">
            DuckDB Swarm UI - Versión 1.0
          </p>
        </div>
      </footer>
    </div>
  );
}