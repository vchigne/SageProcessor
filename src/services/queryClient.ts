import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5, // 5 minutos
    },
  },
});

// Claves de caché para React Query
export const queryKeys = {
  casillas: 'casillas',
  casilla: (id: number | string) => ['casillas', id],
  instalaciones: 'instalaciones',
  instalacion: (id: number | string) => ['instalaciones', id],
  organizaciones: 'organizaciones',
  productos: 'productos',
  paises: 'paises',
  emisores: (casillaId: number | string) => ['emisores', casillaId],
  suscripciones: (casillaId: number | string) => ['suscripciones', casillaId],
  ejecuciones: 'ejecuciones',
  ultimasEjecuciones: 'ultimasEjecuciones',
  stats: 'stats',
};