import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { BellIcon, ExclamationTriangleIcon, InboxIcon } from '@heroicons/react/24/outline';

interface EmailStats {
  por_estado: {
    pendiente?: number;
    activo?: number;
    error?: number;
  };
  por_proposito: {
    recepcion?: number;
    envio?: number;
    admin?: number;
    multiple?: number;
  };
  casillas_sin_configuracion: number;
  total: number;
}

export default function EmailConfigNotifier() {
  const [estadisticas, setEstadisticas] = useState<EmailStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const cargarEstadisticas = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/email/configuraciones/stats');
        if (!response.ok) {
          // En lugar de fallar, usamos una estadística vacía
          setEstadisticas({
            por_estado: { pendiente: 0, activo: 0, error: 0 },
            por_proposito: { recepcion: 0, envio: 0, admin: 0, multiple: 0 },
            casillas_sin_configuracion: 0,
            total: 0
          });
          setError('Estadísticas no disponibles');
          console.warn('Estadísticas no disponibles:', response.status);
        } else {
          const data = await response.json();
          setEstadisticas(data);
          setError(null);
        }
      } catch (err: any) {
        // En caso de error, usar estadísticas vacías
        setEstadisticas({
          por_estado: { pendiente: 0, activo: 0, error: 0 },
          por_proposito: { recepcion: 0, envio: 0, admin: 0, multiple: 0 },
          casillas_sin_configuracion: 0,
          total: 0
        });
        setError(err.message || 'Error desconocido');
        console.error('Error al cargar estadísticas:', err);
      } finally {
        setIsLoading(false);
      }
    };

    cargarEstadisticas();
    // Actualizar cada 5 minutos
    const interval = setInterval(cargarEstadisticas, 5 * 60 * 1000);
    
    return () => {
      clearInterval(interval);
    };
  }, []);

  // Calcular total de problemas
  const totalProblemas = 
    (estadisticas?.por_estado?.pendiente || 0) + 
    (estadisticas?.por_estado?.error || 0) + 
    (estadisticas?.casillas_sin_configuracion || 0);

  // Determinar color de indicador
  let indicatorClass = '';
  if (totalProblemas > 0) {
    indicatorClass = totalProblemas > 5 
      ? 'bg-red-500' 
      : 'bg-yellow-500';
  } else {
    indicatorClass = 'bg-green-500';
  }

  // Si está cargando o hay error, mostrar un indicador simple
  if (isLoading || error || !estadisticas) {
    return (
      <div className="relative">
        <button 
          className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none"
          aria-label="Estado de configuraciones de email"
        >
          <BellIcon className="h-6 w-6 text-gray-500" />
          {isLoading && <div className="absolute top-0 right-0 h-3 w-3 bg-blue-500 rounded-full"></div>}
          {error && <div className="absolute top-0 right-0 h-3 w-3 bg-red-500 rounded-full"></div>}
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Botón de notificación */}
      <button 
        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none relative"
        onClick={() => setExpanded(!expanded)}
        aria-label="Notificaciones de email"
      >
        <BellIcon className="h-6 w-6 text-gray-500" />
        {totalProblemas > 0 && (
          <div className="absolute -top-1 -right-1 flex items-center justify-center">
            <div className={`flex items-center justify-center h-5 w-5 ${indicatorClass} text-white text-xs font-semibold rounded-full`}>
              {totalProblemas}
            </div>
          </div>
        )}
      </button>

      {/* Panel desplegable */}
      {expanded && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-md shadow-lg z-10 border border-gray-200 dark:border-gray-700">
          <div className="p-4">
            <h3 className="text-lg font-semibold mb-2 text-gray-800 dark:text-white">
              Configuraciones de Email
            </h3>

            {/* Estado general */}
            <div className="space-y-3 mb-4">
              {(estadisticas.por_estado.pendiente || 0) > 0 && (
                <div className="flex items-center text-amber-500">
                  <ExclamationTriangleIcon className="h-5 w-5 mr-2" />
                  <span>
                    {estadisticas.por_estado.pendiente} configuraciones pendientes
                  </span>
                </div>
              )}

              {(estadisticas.por_estado.error || 0) > 0 && (
                <div className="flex items-center text-red-500">
                  <ExclamationTriangleIcon className="h-5 w-5 mr-2" />
                  <span>
                    {estadisticas.por_estado.error} configuraciones con error
                  </span>
                </div>
              )}

              {estadisticas.casillas_sin_configuracion > 0 && (
                <div className="flex items-center text-amber-500">
                  <InboxIcon className="h-5 w-5 mr-2" />
                  <span>
                    {estadisticas.casillas_sin_configuracion} casillas sin configuración
                  </span>
                </div>
              )}

              {totalProblemas === 0 && (
                <div className="flex items-center text-green-500">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Todas las configuraciones están activas</span>
                </div>
              )}
            </div>

            {/* Resumen de estadísticas */}
            <div className="grid grid-cols-2 gap-2 mb-4 text-sm">
              <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded">
                <div className="font-medium text-gray-700 dark:text-gray-300">Total</div>
                <div className="font-semibold text-gray-900 dark:text-white">{estadisticas.total}</div>
              </div>
              <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded">
                <div className="font-medium text-gray-700 dark:text-gray-300">Activas</div>
                <div className="font-semibold text-gray-900 dark:text-white">{estadisticas.por_estado.activo || 0}</div>
              </div>
            </div>

            {/* Enlace a la página de configuraciones */}
            <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
              <Link href="/admin/configuraciones-email" 
                    className="block w-full text-center py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition">
                Administrar configuraciones
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}