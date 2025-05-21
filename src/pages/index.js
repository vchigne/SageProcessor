
import { useQuery } from '@tanstack/react-query';
import { Card, Text, Title, DonutChart, BarChart, Color } from '@tremor/react';
import React, { createElement } from 'react';
import { useState, useEffect } from 'react';
import LoadingSpinner from '../components/common/LoadingSpinner';
import DateRangePicker from '../components/dashboard/DateRangePicker';

export default function Dashboard() {
  const [chartWidth, setChartWidth] = useState(0);
  const [dateRange, setDateRange] = useState({
    startDate: null,
    endDate: null,
    days: 30
  });

  useEffect(() => {
    function updateWidth() {
      setChartWidth(window.innerWidth > 1024 ? window.innerWidth * 0.4 : window.innerWidth * 0.8);
    }
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // Función para construir la URL con los parámetros de fecha
  const buildUrlWithDateParams = (baseUrl) => {
    const url = new URL(baseUrl, window.location.origin);
    
    if (dateRange.startDate && dateRange.endDate) {
      url.searchParams.append('fechaInicio', dateRange.startDate);
      url.searchParams.append('fechaFin', dateRange.endDate);
    } else if (dateRange.days) {
      url.searchParams.append('dias', dateRange.days);
    }
    
    return url.toString();
  };

  const { data: statsData, isLoading: loadingStats, refetch: refetchStats } = useQuery({
    queryKey: ['dashboardStats', dateRange],
    queryFn: async () => {
      const res = await fetch(buildUrlWithDateParams('/api/dashboard/stats'));
      if (!res.ok) throw new Error('Error al cargar estadísticas');
      return res.json();
    }
  });

  const { data: tendenciaData, isLoading: loadingTendencia, refetch: refetchTendencia } = useQuery({
    queryKey: ['dashboardTendencia', dateRange],
    queryFn: async () => {
      const res = await fetch(buildUrlWithDateParams('/api/dashboard/tendencia'));
      if (!res.ok) throw new Error('Error al cargar tendencia');
      return res.json();
    }
  });

  const { data: ultimasEjecucionesData, isLoading: loadingEjecuciones, refetch: refetchEjecuciones } = useQuery({
    queryKey: ['dashboardUltimasEjecuciones', dateRange], 
    queryFn: async () => {
      const res = await fetch(buildUrlWithDateParams('/api/dashboard/ultimas-ejecuciones'));
      if (!res.ok) throw new Error('Error al cargar últimas ejecuciones');
      return res.json();
    }
  });

  // Manejador para el cambio de rango de fechas
  const handleDateRangeChange = (newDateRange) => {
    setDateRange(newDateRange);
    // No necesitamos llamar a refetch manualmente porque useQuery se encargará de ello 
    // cuando cambie la clave de consulta (queryKey), pero mostramos indicador de carga
    document.getElementById('loading-overlay')?.classList.remove('hidden');
    // Ocultamos el overlay después de un tiempo para asegurar que los datos se hayan cargado
    setTimeout(() => {
      document.getElementById('loading-overlay')?.classList.add('hidden');
    }, 300);
  };

  if (loadingStats || loadingTendencia || loadingEjecuciones) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      {/* Overlay de carga */}
      <div id="loading-overlay" className="hidden fixed inset-0 bg-white bg-opacity-70 z-50 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <span className="mt-2 text-indigo-600">Actualizando dashboard...</span>
        </div>
      </div>
      
      <div className="flex justify-between items-center">
        <Title>Dashboard SAGE</Title>
        <div className="text-sm text-gray-500">
          {dateRange.startDate && dateRange.endDate ? 
            `Datos desde ${dateRange.startDate} hasta ${dateRange.endDate}` : 
            `Últimos ${dateRange.days} días`}
        </div>
      </div>
      
      <DateRangePicker 
        onChange={handleDateRangeChange} 
        defaultDays={dateRange.days}
      />

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white rounded-lg shadow p-4 flex items-center">
          <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div className="ml-4">
            <h2 className="text-gray-500 text-sm font-medium">Archivos Procesados</h2>
            <p className="text-2xl font-semibold text-gray-800">{ultimasEjecucionesData?.datos?.reduce((sum, item) => sum + item.cantidad, 0) || 0}</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 flex items-center">
          <div className="flex-shrink-0 w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="ml-4">
            <h2 className="text-gray-500 text-sm font-medium">Archivos Exitosos</h2>
            <p className="text-2xl font-semibold text-green-600">{ultimasEjecucionesData?.datos?.find(item => item.estado === 'Éxito')?.cantidad || 0}</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 flex items-center">
          <div className="flex-shrink-0 w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="ml-4">
            <h2 className="text-gray-500 text-sm font-medium">Archivos Parciales</h2>
            <p className="text-2xl font-semibold text-amber-600">{ultimasEjecucionesData?.datos?.find(item => item.estado === 'Parcial')?.cantidad || 0}</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 flex items-center">
          <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="ml-4">
            <h2 className="text-gray-500 text-sm font-medium">Archivos Fallidos</h2>
            <p className="text-2xl font-semibold text-red-600">{ultimasEjecucionesData?.datos?.find(item => item.estado === 'Fallido')?.cantidad || 0}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <Title>Tendencia de Procesamiento</Title>
          {tendenciaData?.datos && tendenciaData?.datos.length > 0 ? (
            <div className="mt-4">

              
              <div className="overflow-x-auto h-72">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Fecha
                      </th>
                      <th scope="col" className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        % Efect.
                      </th>
                      <th scope="col" className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Proc.
                      </th>
                      <th scope="col" className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Exit.
                      </th>
                      <th scope="col" className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Parc.
                      </th>
                      <th scope="col" className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Fall.
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {tendenciaData.datos.map((item, index) => {
                      return (
                        <tr key={index}>
                          <td className="px-2 py-1 whitespace-nowrap text-xs font-medium text-gray-900">
                            {item.fecha}
                          </td>
                          <td className="px-2 py-1 whitespace-nowrap text-xs text-gray-900">
                            <span className={`font-medium ${item.procesados > 0 ? (
                              Math.round((item.exitosos / item.procesados) * 100) >= 80 ? 'text-green-600' : 
                              Math.round((item.exitosos / item.procesados) * 100) >= 50 ? 'text-amber-500' : 'text-red-600'
                            ) : 'text-gray-500'}`}>
                              {item.procesados > 0 ? `${Math.round((item.exitosos / item.procesados) * 100)}%` : 'N/A'}
                            </span>
                          </td>
                          <td className="px-2 py-1 whitespace-nowrap text-xs text-center text-gray-900">
                            <span className="text-blue-600 font-medium">{item.procesados}</span>
                          </td>
                          <td className="px-2 py-1 whitespace-nowrap text-xs text-center text-gray-900">
                            <span className="text-green-600 font-medium">{item.exitosos}</span>
                          </td>
                          <td className="px-2 py-1 whitespace-nowrap text-xs text-center text-gray-900">
                            <span className="text-amber-500 font-medium">{item.parciales || 0}</span>
                          </td>
                          <td className="px-2 py-1 whitespace-nowrap text-xs text-center text-gray-900">
                            <span className="text-red-600 font-medium">{item.fallidos || 0}</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="flex justify-center items-center h-72 text-gray-500">
              No hay datos para el período seleccionado
            </div>
          )}
        </Card>

        <Card>
          <Title>Estado de Últimas Ejecuciones</Title>
          {ultimasEjecucionesData?.datos && ultimasEjecucionesData?.datos.some(item => item.cantidad > 0) ? (
            <div className="mt-4">
              <div className="grid grid-cols-1 gap-4 mb-4">
                {ultimasEjecucionesData.datos.map((item, index) => {
                  // Determinar color según el estado
                  let bgColor = 'bg-gray-500';
                  let textColor = 'text-gray-800';
                  
                  const estado = item.estado.toLowerCase();
                  if (estado.includes('éxito') || estado.includes('exito')) {
                    bgColor = 'bg-green-500';
                    textColor = 'text-green-800';
                  } else if (estado.includes('fallo') || estado.includes('error') || estado.includes('fallido')) {
                    bgColor = 'bg-red-500';
                    textColor = 'text-red-800';
                  } else if (estado.includes('parcial')) {
                    bgColor = 'bg-amber-500';
                    textColor = 'text-amber-800';
                  } else if (estado.includes('pendiente') || estado.includes('en_proceso')) {
                    bgColor = 'bg-indigo-500';
                    textColor = 'text-indigo-800';
                  }
                  
                  // Calcular porcentaje
                  const total = ultimasEjecucionesData.datos.reduce((sum, item) => sum + item.cantidad, 0);
                  const porcentaje = Math.round((item.cantidad / total) * 100);
                  
                  return (
                    <div key={index} className="bg-white rounded-lg p-4 shadow-sm">
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center">
                          <div className={`w-4 h-4 ${bgColor} rounded-full mr-2`}></div>
                          <span className="font-medium">{item.estado}</span>
                        </div>
                        <span className={`font-bold ${textColor}`}>{item.cantidad}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`${bgColor} h-2 rounded-full`} 
                          style={{ width: `${porcentaje}%` }}
                        ></div>
                      </div>
                      <div className="text-right text-xs text-gray-500 mt-1">
                        {porcentaje}% del total
                      </div>
                    </div>
                  );
                })}
              </div>
              
              <div className="mt-4 text-sm text-center text-gray-600">
                Total de ejecuciones: {ultimasEjecucionesData.datos.reduce((sum, item) => sum + item.cantidad, 0)}
              </div>
            </div>
          ) : (
            <div className="flex justify-center items-center h-72 text-gray-500">
              No hay datos para el período seleccionado
            </div>
          )}
        </Card>
      </div>
      
      {/* Sección de diagnóstico (solo visible si no hay datos) */}
      {(!tendenciaData?.datos || tendenciaData.datos.length === 0) && (
        <Card className="p-4 bg-yellow-50 border border-yellow-200">
          <Title className="text-yellow-800">Información de diagnóstico</Title>
          <div className="mt-2">
            <p className="text-sm">No se encontraron datos en el período seleccionado. Intente ampliar el rango de fechas o revisar la tabla <code>ejecuciones_yaml</code>.</p>
            <div className="mt-2">
              <button 
                onClick={() => {
                  const url = new URL('/api/dashboard/ultimas-ejecuciones', window.location.origin);
                  url.searchParams.append('diagnostico', 'true');
                  window.open(url.toString(), '_blank');
                }}
                className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-md text-sm hover:bg-yellow-200"
              >
                Ver diagnóstico completo
              </button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
