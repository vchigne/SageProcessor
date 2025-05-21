
import { useQuery } from '@tanstack/react-query';
import { Card, Text, Title, DonutChart } from '@tremor/react';
import { BarChart } from '@tremor/react';
import React from 'react';
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
        <Card className="space-y-2">
          <Title>Archivos Procesados</Title>
          <Text className="text-2xl">{statsData?.stats?.archivos_procesados || 0}</Text>
        </Card>

        <Card className="space-y-2">
          <Title>Tasa de Éxito</Title>
          <Text className="text-2xl">{statsData?.stats?.tasa_exito || 0}%</Text>
        </Card>

        <Card className="space-y-2">
          <Title>Archivos Pendientes</Title>
          <Text className="text-2xl">{statsData?.stats?.archivos_pendientes || 0}</Text>
        </Card>

        <Card className="space-y-2">
          <Title>Casillas por Vencer</Title>
          <Text className="text-2xl">{statsData?.stats?.casillas_por_vencer || 0}</Text>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <Title>Tendencia de Procesamiento</Title>
          {tendenciaData?.datos && tendenciaData?.datos.length > 0 ? (
            <div>
              <div className="mt-4 flex items-center gap-3 justify-end">
                <div className="flex items-center gap-1">
                  <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#4f46e5' }}></div>
                  <span className="text-sm text-gray-600">Procesados</span>
                </div>
                <div className="flex items-center gap-1">
                  <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#10b981' }}></div>
                  <span className="text-sm text-gray-600">Exitosos</span>
                </div>
              </div>
              <div className="mt-2 h-72" style={{ position: 'relative' }}>
                {/* Aplicamos estilos personalizados al SVG */}
                <style jsx global>{`
                  .tendencia-chart .tr-chart-grid-lines .tr-bars-0 {
                    fill: #4f46e5 !important;
                  }
                  .tendencia-chart .tr-chart-grid-lines .tr-bars-1 {
                    fill: #10b981 !important;
                  }
                `}</style>
                <BarChart
                  className="tendencia-chart"
                  data={tendenciaData.datos}
                  index="fecha"
                  categories={["procesados", "exitosos"]}
                  colors={["#4f46e5", "#10b981"]}
                />
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
            <div>
              <div className="mt-4 flex flex-wrap gap-3 justify-center">
                {ultimasEjecucionesData.datos.map((item, index) => {
                  let color = '#94a3b8'; // Color gris por defecto
                  
                  // Asignar colores según el tipo de estado
                  if (item.estado.toLowerCase().includes('éxito') || item.estado.toLowerCase().includes('exito')) {
                    color = '#10b981'; // verde para éxito
                  } else if (item.estado.toLowerCase().includes('fallo') || item.estado.toLowerCase().includes('error') || item.estado.toLowerCase().includes('fallido')) {
                    color = '#ef4444'; // rojo para fallido/error
                  } else if (item.estado.toLowerCase().includes('parcial')) {
                    color = '#f59e0b'; // ámbar para parcial
                  } else if (item.estado.toLowerCase().includes('pendiente') || item.estado.toLowerCase().includes('en_proceso')) {
                    color = '#6366f1'; // índigo para pendiente/en_proceso
                  }
                  
                  return (
                    <div key={index} className="flex items-center gap-1">
                      <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: color }}></div>
                      <span className="text-sm text-gray-600">{item.estado} ({item.cantidad})</span>
                    </div>
                  );
                })}
              </div>
              
              <div style={{ position: 'relative', height: '250px' }}>
                {/* Aplicamos estilos personalizados al SVG del gráfico circular */}
                <style jsx global>{`
                  .estado-chart .tr-donut-arc-path-0 { 
                    fill: #10b981 !important; /* verde para éxito */
                  }
                  .estado-chart .tr-donut-arc-path-1 { 
                    fill: #f59e0b !important; /* ámbar para parcial */
                  }
                  .estado-chart .tr-donut-arc-path-2 { 
                    fill: #ef4444 !important; /* rojo para fallido */
                  }
                  .estado-chart .tr-donut-arc-path-3 { 
                    fill: #6366f1 !important; /* índigo para pendiente */
                  }
                  .estado-chart .tr-donut-arc-path-4 { 
                    fill: #94a3b8 !important; /* gris por defecto */
                  }
                `}</style>
                <DonutChart
                  className="mt-2 estado-chart"
                  data={ultimasEjecucionesData.datos}
                  category="cantidad"
                  index="estado"
                  valueFormatter={(number) => number.toString()}
                  colors={["#10b981", "#f59e0b", "#ef4444", "#6366f1", "#94a3b8"]}
                />
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
