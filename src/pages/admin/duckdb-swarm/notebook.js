import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

export default function DuckDBNotebook() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('Cargando notebook de DuckDB...');
  const [cells, setCells] = useState([
    { id: 1, type: 'markdown', content: '# DuckDB Notebook\n\nBienvenido al entorno de análisis interactivo de DuckDB. Este notebook le permite ejecutar consultas SQL y ver los resultados inmediatamente.', output: null },
    { id: 2, type: 'sql', content: '-- Consulta de ejemplo\nSELECT * FROM example_table LIMIT 5;', output: null },
    { id: 3, type: 'markdown', content: '## Análisis exploratorio\n\nVamos a explorar algunas tablas disponibles:', output: null },
    { id: 4, type: 'sql', content: 'SHOW TABLES;', output: null }
  ]);
  const [activeCell, setActiveCell] = useState(2);

  useEffect(() => {
    // Verificar si hay un serverId en la URL 
    if (!router.isReady) return;

    const loadNotebook = async () => {
      setLoading(true);
      setMessage('Inicializando el notebook de DuckDB...');

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
        // En un entorno real, cargaríamos aquí el notebook real de DuckDB
        setTimeout(() => {
          // Simulación de resultados para la segunda celda
          const updatedCells = [...cells];
          updatedCells[1] = {
            ...updatedCells[1],
            output: [
              { id: 1, nombre: 'Ejemplo 1', valor: 123.45, fecha: '2023-04-26' },
              { id: 2, nombre: 'Ejemplo 2', valor: 67.89, fecha: '2023-04-27' },
              { id: 3, nombre: 'Ejemplo 3', valor: 45.67, fecha: '2023-04-28' },
              { id: 4, nombre: 'Ejemplo 4', valor: 23.45, fecha: '2023-04-29' },
              { id: 5, nombre: 'Ejemplo 5', valor: 78.90, fecha: '2023-04-30' }
            ]
          };
          // Simulación de resultados para la cuarta celda
          updatedCells[3] = {
            ...updatedCells[3],
            output: [
              { name: 'example_table' },
              { name: 'metrics' },
              { name: 'logs' },
              { name: 'users' }
            ]
          };
          setCells(updatedCells);
          setLoading(false);
        }, 1500);
      } catch (err) {
        console.error('Error al cargar el notebook de DuckDB:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    loadNotebook();
  }, [router.isReady]);

  const executeCell = (cellId) => {
    // Simulación de ejecución de celda SQL
    // En una implementación real, enviaríamos la consulta SQL al servidor
    alert(`Ejecución de celda ${cellId} simulada. En una implementación real, esta consulta se enviaría al servidor DuckDB.`);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
        <div className="w-full max-w-4xl bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mb-4"></div>
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
            Error al cargar el notebook
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            {error}
          </p>
          <button
            onClick={() => router.push('/admin/duckdb-swarm/simple')}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
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
            DuckDB Notebook
          </h1>
          <div className="flex space-x-4">
            <button
              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Ejecutar Todo
            </button>
            <button
              onClick={() => router.push('/admin/duckdb-swarm/simple')}
              className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Volver
            </button>
          </div>
        </div>
      </header>

      <main className="flex-grow p-4">
        <div className="max-w-7xl mx-auto">
          <div className="space-y-6">
            {cells.map((cell, index) => (
              <div 
                key={cell.id} 
                className={`bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg border-l-4 ${
                  activeCell === cell.id ? 'border-blue-500' : 'border-transparent'
                }`}
              >
                <div className="p-6">
                  {cell.type === 'markdown' ? (
                    <div 
                      className="prose dark:prose-invert max-w-none"
                      dangerouslySetInnerHTML={{ __html: cell.content.replace(/\n/g, '<br>') }}
                    />
                  ) : (
                    <>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          SQL Cell {index + 1}
                        </span>
                        <button
                          onClick={() => executeCell(cell.id)}
                          className="px-2 py-1 bg-blue-600 text-xs text-white rounded hover:bg-blue-700"
                        >
                          Ejecutar
                        </button>
                      </div>
                      <div 
                        className="font-mono text-sm bg-gray-100 dark:bg-gray-900 p-4 rounded border border-gray-300 dark:border-gray-700 mb-4"
                      >
                        {cell.content}
                      </div>
                      
                      {cell.output && (
                        <div className="mt-4">
                          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Resultado:
                          </h3>
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                              <thead className="bg-gray-50 dark:bg-gray-700">
                                <tr>
                                  {cell.output.length > 0 && 
                                    Object.keys(cell.output[0]).map(key => (
                                      <th 
                                        key={key}
                                        className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                                      >
                                        {key}
                                      </th>
                                    ))
                                  }
                                </tr>
                              </thead>
                              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {cell.output.map((row, i) => (
                                  <tr key={i}>
                                    {Object.values(row).map((value, j) => (
                                      <td 
                                        key={j}
                                        className="px-3 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300"
                                      >
                                        {value?.toString()}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}

            <div className="flex justify-center mt-6">
              <button
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                + Agregar Celda
              </button>
            </div>
          </div>
        </div>
      </main>

      <footer className="bg-white dark:bg-gray-800 shadow mt-8">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-gray-500 dark:text-gray-400">
            DuckDB Notebook - Versión 1.0
          </p>
        </div>
      </footer>
    </div>
  );
}