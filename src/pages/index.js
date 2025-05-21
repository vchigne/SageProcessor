
import { useQuery } from '@tanstack/react-query';
import { Card, Text, Title, BarChart, DonutChart } from '@tremor/react';
import { useState, useEffect } from 'react';
import LoadingSpinner from '../components/common/LoadingSpinner';

export default function Dashboard() {
  const [chartWidth, setChartWidth] = useState(0);

  useEffect(() => {
    function updateWidth() {
      setChartWidth(window.innerWidth > 1024 ? window.innerWidth * 0.4 : window.innerWidth * 0.8);
    }
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const { data: statsData, isLoading: loadingStats } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: async () => {
      const res = await fetch('/api/dashboard/stats');
      if (!res.ok) throw new Error('Error al cargar estadísticas');
      return res.json();
    }
  });

  const { data: tendenciaData, isLoading: loadingTendencia } = useQuery({
    queryKey: ['dashboardTendencia'],
    queryFn: async () => {
      const res = await fetch('/api/dashboard/tendencia');
      if (!res.ok) throw new Error('Error al cargar tendencia');
      return res.json();
    }
  });

  const { data: ultimasEjecucionesData, isLoading: loadingEjecuciones } = useQuery({
    queryKey: ['dashboardUltimasEjecuciones'], 
    queryFn: async () => {
      const res = await fetch('/api/dashboard/ultimas-ejecuciones');
      if (!res.ok) throw new Error('Error al cargar últimas ejecuciones');
      return res.json();
    }
  });

  if (loadingStats || loadingTendencia || loadingEjecuciones) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <Title>Dashboard SAGE</Title>

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
          <BarChart
            className="mt-4 h-72"
            data={tendenciaData?.datos || []}
            index="fecha"
            categories={["procesados", "exitosos"]}
            colors={["blue", "green"]}
          />
        </Card>

        <Card>
          <Title>Estado de Últimas Ejecuciones</Title>
          <DonutChart
            className="mt-4 h-72"
            data={ultimasEjecucionesData?.datos || []}
            category="cantidad"
            index="estado"
            valueFormatter={(number) => number.toString()}
            colors={["green", "red", "yellow"]}
          />
        </Card>
      </div>
    </div>
  );
}
