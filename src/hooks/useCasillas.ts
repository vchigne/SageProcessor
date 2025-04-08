import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../services/queryClient';
import { ApiResponse, Casilla, CasillasFilter } from '../types';

// Funciones auxiliares para peticiones a la API
const fetchCasillas = async (filter?: CasillasFilter): Promise<Casilla[]> => {
  // Construir parametros de consulta
  const params = new URLSearchParams();
  if (filter?.search) params.append('busqueda', filter.search);
  if (filter?.isActive !== undefined) params.append('is_active', filter.isActive.toString());
  if (filter?.instalacionId) params.append('instalacion_id', filter.instalacionId.toString());
  if (filter?.organizacionId) params.append('organizacion_id', filter.organizacionId.toString());
  if (filter?.productoId) params.append('producto_id', filter.productoId.toString());
  if (filter?.paisId) params.append('pais_id', filter.paisId.toString());

  const queryString = params.toString();
  const url = `/api/data-boxes${queryString ? `?${queryString}` : ''}`;
  
  const response = await fetch(url);
  if (!response.ok) throw new Error('Error al cargar casillas');
  
  return await response.json();
};

const fetchCasillaById = async (id: number): Promise<Casilla> => {
  const response = await fetch(`/api/data-boxes/${id}`);
  if (!response.ok) throw new Error('Error al cargar la casilla');
  
  return await response.json();
};

const createCasilla = async (casilla: Partial<Casilla>): Promise<Casilla> => {
  // Incluir tanto yaml_content como yaml_contenido para compatibilidad
  const { yaml_content, ...restCasilla } = casilla;
  const payload = {
    ...restCasilla,
    yaml_content, // Mantener ambos campos para compatibilidad
    yaml_contenido: yaml_content
  };

  console.log('Enviando datos para crear casilla:', payload);

  const response = await fetch('/api/data-boxes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  
  const responseData = await response.json();
  
  if (!response.ok) {
    console.error('Error respuesta API:', responseData);
    throw new Error(responseData.error || responseData.details || 'Error al crear la casilla');
  }
  
  return responseData;
};

const updateCasilla = async ({ id, yaml_content, ...casilla }: Partial<Casilla> & { id: number, yaml_content?: string }): Promise<Casilla> => {
  // Incluir tanto yaml_content como yaml_contenido para compatibilidad
  const payload = {
    id,
    ...casilla,
    yaml_content, // Mantener ambos campos para compatibilidad
    yaml_contenido: yaml_content
  };

  const response = await fetch('/api/data-boxes', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  
  if (!response.ok) throw new Error('Error al actualizar la casilla');
  
  return await response.json();
};

const deleteCasilla = async (id: number): Promise<void> => {
  const response = await fetch('/api/data-boxes', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  });
  
  if (!response.ok) throw new Error('Error al eliminar la casilla');
  
  return await response.json();
};

// Hook para obtener todas las casillas
export function useCasillas(filter?: CasillasFilter) {
  return useQuery({
    queryKey: [queryKeys.casillas, filter],
    queryFn: () => fetchCasillas(filter),
  });
}

// Hook para obtener una casilla por ID
export function useCasillaById(id: number) {
  return useQuery({
    queryKey: queryKeys.casilla(id),
    queryFn: () => fetchCasillaById(id),
    enabled: !!id,
  });
}

// Hook para crear una nueva casilla
export function useCreateCasilla() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createCasilla,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKeys.casillas] });
    },
  });
}

// Hook para actualizar una casilla
export function useUpdateCasilla() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: updateCasilla,
    onSuccess: (updatedCasilla) => {
      queryClient.invalidateQueries({ queryKey: [queryKeys.casillas] });
      queryClient.invalidateQueries({ queryKey: queryKeys.casilla(updatedCasilla.id) });
    },
  });
}

// Hook para eliminar una casilla
export function useDeleteCasilla() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: deleteCasilla,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [queryKeys.casillas] });
      queryClient.removeQueries({ queryKey: queryKeys.casilla(variables) });
    },
  });
}