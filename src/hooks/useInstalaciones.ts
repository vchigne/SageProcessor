import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../services/queryClient';
import { ApiResponse, Instalacion } from '../types';

// Funciones auxiliares para peticiones a la API
const fetchInstalaciones = async (): Promise<Instalacion[]> => {
  const response = await fetch('/api/installations');
  if (!response.ok) throw new Error('Error al cargar instalaciones');
  
  return await response.json();
};

const fetchInstalacionById = async (id: number): Promise<Instalacion> => {
  const response = await fetch(`/api/instalaciones/${id}`);
  if (!response.ok) throw new Error('Error al cargar la instalación');
  
  const result: ApiResponse<Instalacion> = await response.json();
  if (!result.success) throw new Error(result.error || 'Error al cargar la instalación');
  
  return result.data!;
};

const createInstalacion = async (instalacion: Partial<Instalacion>): Promise<Instalacion> => {
  const response = await fetch('/api/instalaciones', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(instalacion),
  });
  
  if (!response.ok) throw new Error('Error al crear la instalación');
  
  const result: ApiResponse<Instalacion> = await response.json();
  if (!result.success) throw new Error(result.error || 'Error al crear la instalación');
  
  return result.data!;
};

const updateInstalacion = async ({ id, ...instalacion }: Partial<Instalacion> & { id: number }): Promise<Instalacion> => {
  const response = await fetch(`/api/instalaciones/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(instalacion),
  });
  
  if (!response.ok) throw new Error('Error al actualizar la instalación');
  
  const result: ApiResponse<Instalacion> = await response.json();
  if (!result.success) throw new Error(result.error || 'Error al actualizar la instalación');
  
  return result.data!;
};

const deleteInstalacion = async (id: number): Promise<void> => {
  const response = await fetch(`/api/instalaciones/${id}`, {
    method: 'DELETE',
  });
  
  if (!response.ok) throw new Error('Error al eliminar la instalación');
  
  const result: ApiResponse<void> = await response.json();
  if (!result.success) throw new Error(result.error || 'Error al eliminar la instalación');
};

// Hook para obtener todas las instalaciones
export function useInstalaciones() {
  return useQuery({
    queryKey: [queryKeys.instalaciones],
    queryFn: fetchInstalaciones,
  });
}

// Hook para obtener una instalación por ID
export function useInstalacionById(id: number) {
  return useQuery({
    queryKey: queryKeys.instalacion(id),
    queryFn: () => fetchInstalacionById(id),
    enabled: !!id,
  });
}

// Hook para crear una nueva instalación
export function useCreateInstalacion() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createInstalacion,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKeys.instalaciones] });
    },
  });
}

// Hook para actualizar una instalación
export function useUpdateInstalacion() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: updateInstalacion,
    onSuccess: (updatedInstalacion) => {
      queryClient.invalidateQueries({ queryKey: [queryKeys.instalaciones] });
      queryClient.invalidateQueries({ queryKey: queryKeys.instalacion(updatedInstalacion.id) });
    },
  });
}

// Hook para eliminar una instalación
export function useDeleteInstalacion() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: deleteInstalacion,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [queryKeys.instalaciones] });
      queryClient.removeQueries({ queryKey: queryKeys.instalacion(variables) });
    },
  });
}