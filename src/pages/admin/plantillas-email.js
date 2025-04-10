import { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { 
  DocumentTextIcon, 
  PlusIcon, 
  PencilIcon, 
  TrashIcon, 
  CheckIcon, 
  XMarkIcon 
} from '@heroicons/react/24/outline';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export default function PlantillasEmail() {
  const router = useRouter();
  const queryClient = useQueryClient();
  
  // Estados
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Estado del formulario
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    tipo: 'notificacion',
    subtipo: 'detallado',
    variante: 'standard',
    canal: 'email',
    idioma: 'es',
    asunto: '',
    contenido_html: '',
    contenido_texto: '',
    es_predeterminada: false
  });

  // Consulta para obtener todas las plantillas
  const { data: templates, isLoading, error } = useQuery({
    queryKey: ['email-templates'],
    queryFn: fetchTemplates,
    refetchOnWindowFocus: false
  });
  
  // Función para obtener plantillas del backend
  async function fetchTemplates() {
    try {
      const response = await fetch('/api/admin/plantillas-email');
      if (!response.ok) throw new Error('Error al cargar plantillas');
      return await response.json();
    } catch (error) {
      console.error('Error al cargar las plantillas:', error);
      throw new Error('No se pudieron cargar las plantillas de email');
    }
  }

  // Filtrar plantillas para la visualización
  const filteredTemplates = templates?.filter(template => {
    // Primero filtrar por tipo si es diferente de 'all'
    if (filterType !== 'all' && template.tipo !== filterType) {
      return false;
    }
    
    // Luego filtrar por término de búsqueda si está presente
    if (searchTerm) {
      const searchTermLower = searchTerm.toLowerCase();
      return (
        template.nombre?.toLowerCase().includes(searchTermLower) ||
        template.descripcion?.toLowerCase().includes(searchTermLower) ||
        template.subtipo?.toLowerCase().includes(searchTermLower)
      );
    }
    
    return true;
  });
  
  // Opciones para el formulario
  const templateTypes = [
    { value: 'all', label: 'Todas las plantillas' },
    { value: 'notificacion', label: 'Notificaciones' },
    { value: 'respuesta_daemon', label: 'Respuestas Automáticas' }
  ];

  const handleCreateTemplate = () => {
    alert('Nueva plantilla (funcionalidad en desarrollo)');
  };

  const handleEditTemplate = (template) => {
    alert('Editar plantilla (funcionalidad en desarrollo)');
  };

  const handleDeleteTemplate = (id) => {
    alert('Eliminar plantilla (funcionalidad en desarrollo)');
  };

  return (
    <>
      <Head>
        <title>Gestión de Plantillas de Email | SAGE</title>
      </Head>
      
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        <div className="sm:flex sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Plantillas de Email</h1>
            <p className="mt-2 text-sm text-gray-500">
              Gestiona las plantillas para diferentes tipos de notificaciones y respuestas automáticas.
            </p>
          </div>
          <div className="mt-4 sm:mt-0">
            <button
              type="button"
              onClick={handleCreateTemplate}
              className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              <PlusIcon className="-ml-0.5 mr-1.5 h-5 w-5" aria-hidden="true" />
              Nueva Plantilla
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="mt-6 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-6">
          <div className="sm:col-span-3">
            <label htmlFor="filter-type" className="block text-sm font-medium leading-6 text-gray-900">
              Tipo de Plantilla
            </label>
            <select
              id="filter-type"
              name="filter-type"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="mt-2 block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6"
            >
              {templateTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
          
          <div className="sm:col-span-3">
            <label htmlFor="search" className="block text-sm font-medium leading-6 text-gray-900">
              Buscar Plantillas
            </label>
            <div className="mt-2">
              <input
                type="text"
                name="search"
                id="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Nombre o descripción..."
                className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
              />
            </div>
          </div>
        </div>

        {/* Lista de plantillas */}
        <div className="mt-8 overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
          {isLoading ? (
            <div className="py-6 px-4 text-center text-gray-500">
              Cargando plantillas...
            </div>
          ) : error ? (
            <div className="py-6 px-4 text-center text-red-500">
              Error al cargar las plantillas. Por favor, inténtelo de nuevo.
            </div>
          ) : filteredTemplates?.length === 0 ? (
            <div className="py-6 px-4 text-center text-gray-500">
              No se encontraron plantillas con los criterios seleccionados.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                      Nombre
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Tipo
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Subtipo
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Predeterminada
                    </th>
                    <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {filteredTemplates?.map((template) => (
                    <tr key={template.id} className="hover:bg-gray-50">
                      <td className="py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                        {template.nombre}
                      </td>
                      <td className="px-3 py-4 text-sm text-gray-500">
                        {template.tipo === 'notificacion' ? 'Notificación' : 
                          template.tipo === 'respuesta_daemon' ? 'Respuesta Automática' : 
                          template.tipo}
                      </td>
                      <td className="px-3 py-4 text-sm text-gray-500">
                        {template.subtipo}
                      </td>
                      <td className="px-3 py-4 text-sm text-gray-500">
                        {template.es_predeterminada ? (
                          <CheckIcon className="h-5 w-5 text-green-500" aria-hidden="true" />
                        ) : (
                          <XMarkIcon className="h-5 w-5 text-gray-300" aria-hidden="true" />
                        )}
                      </td>
                      <td className="relative py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                        <button
                          type="button"
                          onClick={() => handleEditTemplate(template)}
                          className="text-indigo-600 hover:text-indigo-900 mr-4"
                        >
                          <PencilIcon className="h-5 w-5" aria-hidden="true" />
                          <span className="sr-only">Editar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTemplate(template.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <TrashIcon className="h-5 w-5" aria-hidden="true" />
                          <span className="sr-only">Eliminar</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
