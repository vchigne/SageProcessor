import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import { 
  DocumentTextIcon, 
  PlusIcon, 
  PencilIcon, 
  TrashIcon, 
  CheckIcon, 
  XMarkIcon 
} from '@heroicons/react/24/outline';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Componente principal
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
  
  // Mutación para guardar una plantilla
  const saveTemplateMutation = useMutation({
    mutationFn: async (templateData) => {
      const url = templateData.id 
        ? `/api/admin/plantillas-email/${templateData.id}`
        : '/api/admin/plantillas-email';
      
      const method = templateData.id ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(templateData),
      });
      
      if (!response.ok) {
        throw new Error('Error al guardar la plantilla');
      }
      
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      resetForm();
    },
    onError: (error) => {
      console.error('Error al guardar la plantilla:', error);
      alert('No se pudo guardar la plantilla. Inténtelo de nuevo.');
    }
  });
  
  // Mutación para eliminar una plantilla
  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId) => {
      const response = await fetch(`/api/admin/plantillas-email/${templateId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Error al eliminar la plantilla');
      }
      
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      setSelectedTemplate(null);
    },
    onError: (error) => {
      console.error('Error al eliminar la plantilla:', error);
      alert('No se pudo eliminar la plantilla. Inténtelo de nuevo.');
    }
  });
  
  // Manejadores de eventos
  const handleEditTemplate = (template) => {
    setSelectedTemplate(template);
    setFormData({
      ...template,
      es_predeterminada: template.es_predeterminada || false
    });
    setIsEditing(true);
    setIsCreating(false);
  };
  
  const handleCreateTemplate = () => {
    setSelectedTemplate(null);
    resetForm();
    setIsEditing(false);
    setIsCreating(true);
  };
  
  const handleCancelEdit = () => {
    setIsEditing(false);
    setIsCreating(false);
    resetForm();
  };
  
  const handleDeleteTemplate = (templateId) => {
    if (window.confirm('¿Está seguro de que desea eliminar esta plantilla?')) {
      deleteTemplateMutation.mutate(templateId);
    }
  };
  
  const handleSubmit = (e) => {
    e.preventDefault();
    saveTemplateMutation.mutate(formData);
  };
  
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };
  
  const resetForm = () => {
    setFormData({
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
    setIsEditing(false);
    setIsCreating(false);
  };
  
  // Filtrar plantillas según los criterios
  const filteredTemplates = templates?.filter(template => {
    const matchesType = filterType === 'all' || template.tipo === filterType;
    const matchesSearch = 
      template.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.descripcion.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesType && matchesSearch;
  });
  
  // Tipos de plantillas para el filtro
  const templateTypes = [
    { value: 'all', label: 'Todas las plantillas' },
    { value: 'notificacion', label: 'Notificaciones' },
    { value: 'respuesta_daemon', label: 'Respuestas del Daemon' }
  ];
  
  // Subtipos según el tipo seleccionado
  const getSubtypeOptions = (tipo) => {
    switch(tipo) {
      case 'notificacion':
        return [
          { value: 'detallado', label: 'Detallado' },
          { value: 'resumido_emisor', label: 'Resumen por Emisor' },
          { value: 'resumido_casilla', label: 'Resumen por Casilla' }
        ];
      case 'respuesta_daemon':
        return [
          { value: 'remitente_no_autorizado', label: 'Remitente No Autorizado' },
          { value: 'sin_adjunto', label: 'Falta de Adjunto' },
          { value: 'formato_invalido', label: 'Formato Inválido' }
        ];
      default:
        return [];
    }
  };
  
  // Variantes disponibles
  const variantOptions = [
    { value: 'standard', label: 'Estándar' },
    { value: 'marketing', label: 'Marketing' },
    { value: 'minimal', label: 'Minimalista' }
  ];
  
  // Canales disponibles
  const channelOptions = [
    { value: 'email', label: 'Email' },
    { value: 'whatsapp', label: 'WhatsApp (Próximamente)' },
    { value: 'telegram', label: 'Telegram (Próximamente)' }
  ];
  
  // Idiomas disponibles
  const languageOptions = [
    { value: 'es', label: 'Español' },
    { value: 'en', label: 'Inglés (Próximamente)' }
  ];
  
  return (
    <>
      <Head>
        <title>Gestión de Plantillas de Email | SAGE</title>
      </Head>
      
      <Layout>
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

          {/* Formulario de edición/creación */}
          {(isEditing || isCreating) && (
            <div className="mt-10 bg-white px-4 py-5 shadow sm:rounded-lg sm:p-6">
              <div className="md:grid md:grid-cols-3 md:gap-6">
                <div className="md:col-span-1">
                  <div className="px-4 sm:px-0">
                    <h3 className="text-lg font-medium leading-6 text-gray-900">
                      {isEditing ? 'Editar Plantilla' : 'Nueva Plantilla'}
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                      {isEditing 
                        ? 'Modifique los datos de la plantilla seleccionada.' 
                        : 'Complete los datos para crear una nueva plantilla.'}
                    </p>
                    <div className="mt-4">
                      <DocumentTextIcon className="h-12 w-12 text-gray-400" aria-hidden="true" />
                    </div>
                  </div>
                </div>
                <div className="mt-5 md:col-span-2 md:mt-0">
                  <form onSubmit={handleSubmit}>
                    <div className="grid grid-cols-6 gap-6">
                      {/* Nombre */}
                      <div className="col-span-6 sm:col-span-4">
                        <label htmlFor="nombre" className="block text-sm font-medium text-gray-700">
                          Nombre
                        </label>
                        <input
                          type="text"
                          name="nombre"
                          id="nombre"
                          value={formData.nombre}
                          onChange={handleInputChange}
                          required
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        />
                      </div>

                      {/* Descripción */}
                      <div className="col-span-6">
                        <label htmlFor="descripcion" className="block text-sm font-medium text-gray-700">
                          Descripción
                        </label>
                        <textarea
                          id="descripcion"
                          name="descripcion"
                          rows={3}
                          value={formData.descripcion}
                          onChange={handleInputChange}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        />
                      </div>

                      {/* Tipo */}
                      <div className="col-span-6 sm:col-span-3">
                        <label htmlFor="tipo" className="block text-sm font-medium text-gray-700">
                          Tipo
                        </label>
                        <select
                          id="tipo"
                          name="tipo"
                          value={formData.tipo}
                          onChange={handleInputChange}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        >
                          <option value="notificacion">Notificación</option>
                          <option value="respuesta_daemon">Respuesta Automática</option>
                        </select>
                      </div>

                      {/* Subtipo */}
                      <div className="col-span-6 sm:col-span-3">
                        <label htmlFor="subtipo" className="block text-sm font-medium text-gray-700">
                          Subtipo
                        </label>
                        <select
                          id="subtipo"
                          name="subtipo"
                          value={formData.subtipo}
                          onChange={handleInputChange}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        >
                          {getSubtypeOptions(formData.tipo).map(option => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Variante */}
                      <div className="col-span-6 sm:col-span-2">
                        <label htmlFor="variante" className="block text-sm font-medium text-gray-700">
                          Variante
                        </label>
                        <select
                          id="variante"
                          name="variante"
                          value={formData.variante}
                          onChange={handleInputChange}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        >
                          {variantOptions.map(option => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Canal */}
                      <div className="col-span-6 sm:col-span-2">
                        <label htmlFor="canal" className="block text-sm font-medium text-gray-700">
                          Canal
                        </label>
                        <select
                          id="canal"
                          name="canal"
                          value={formData.canal}
                          onChange={handleInputChange}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        >
                          {channelOptions.map(option => (
                            <option 
                              key={option.value} 
                              value={option.value}
                              disabled={option.value !== 'email'} // Solo email está habilitado por ahora
                            >
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Idioma */}
                      <div className="col-span-6 sm:col-span-2">
                        <label htmlFor="idioma" className="block text-sm font-medium text-gray-700">
                          Idioma
                        </label>
                        <select
                          id="idioma"
                          name="idioma"
                          value={formData.idioma}
                          onChange={handleInputChange}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        >
                          {languageOptions.map(option => (
                            <option 
                              key={option.value} 
                              value={option.value}
                              disabled={option.value !== 'es'} // Solo español está habilitado por ahora
                            >
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Asunto (para email) */}
                      {formData.canal === 'email' && (
                        <div className="col-span-6">
                          <label htmlFor="asunto" className="block text-sm font-medium text-gray-700">
                            Asunto del Email
                          </label>
                          <input
                            type="text"
                            name="asunto"
                            id="asunto"
                            value={formData.asunto}
                            onChange={handleInputChange}
                            required={formData.canal === 'email'}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                          />
                        </div>
                      )}

                      {/* Contenido HTML (para email) */}
                      {formData.canal === 'email' && (
                        <div className="col-span-6">
                          <label htmlFor="contenido_html" className="block text-sm font-medium text-gray-700">
                            Contenido HTML
                          </label>
                          <p className="mt-1 text-xs text-gray-500">
                            Utilice variables como {{fecha}}, {{portal_nombre}}, etc. según el tipo de plantilla.
                          </p>
                          <textarea
                            id="contenido_html"
                            name="contenido_html"
                            rows={10}
                            value={formData.contenido_html}
                            onChange={handleInputChange}
                            required={formData.canal === 'email'}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 font-mono text-xs sm:text-sm"
                          />
                        </div>
                      )}

                      {/* Contenido Texto */}
                      <div className="col-span-6">
                        <label htmlFor="contenido_texto" className="block text-sm font-medium text-gray-700">
                          Contenido Texto Plano
                        </label>
                        <p className="mt-1 text-xs text-gray-500">
                          Versión en texto plano para clientes de email que no soportan HTML.
                        </p>
                        <textarea
                          id="contenido_texto"
                          name="contenido_texto"
                          rows={6}
                          value={formData.contenido_texto}
                          onChange={handleInputChange}
                          required
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 font-mono text-xs sm:text-sm"
                        />
                      </div>

                      {/* Es Predeterminada */}
                      <div className="col-span-6">
                        <div className="flex items-start">
                          <div className="flex h-5 items-center">
                            <input
                              id="es_predeterminada"
                              name="es_predeterminada"
                              type="checkbox"
                              checked={formData.es_predeterminada}
                              onChange={handleInputChange}
                              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
                          </div>
                          <div className="ml-3 text-sm">
                            <label htmlFor="es_predeterminada" className="font-medium text-gray-700">
                              Establecer como predeterminada
                            </label>
                            <p className="text-gray-500">
                              Esta plantilla se usará como predeterminada para su tipo/subtipo.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Botones de acción */}
                    <div className="mt-6 flex justify-end space-x-3">
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        className="rounded-md border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                      >
                        Guardar
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* Ayuda sobre Variables */}
          <div className="mt-6 bg-white rounded-md shadow-sm p-4">
            <h3 className="text-lg font-medium text-gray-900">Variables Disponibles</h3>
            <p className="mt-1 text-sm text-gray-500">
              Estas variables se reemplazarán con valores reales al enviar las notificaciones.
            </p>
            
            <div className="mt-3 grid grid-cols-1 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
              <div className="text-sm">
                <span className="font-medium">{"{{fecha}}"}</span>: Fecha y hora actual
              </div>
              <div className="text-sm">
                <span className="font-medium">{"{{portal_nombre}}"}</span>: Nombre del portal
              </div>
              <div className="text-sm">
                <span className="font-medium">{"{{casilla_nombre}}"}</span>: Nombre de la casilla
              </div>
              <div className="text-sm">
                <span className="font-medium">{"{{email_remitente}}"}</span>: Email del remitente
              </div>
              <div className="text-sm">
                <span className="font-medium">{"{{email_casilla}}"}</span>: Email de la casilla
              </div>
              <div className="text-sm">
                <span className="font-medium">{"{{asunto_original}}"}</span>: Asunto original
              </div>
              <div className="text-sm">
                <span className="font-medium">{"{{evento_resumen}}"}</span>: Resumen de eventos
              </div>
              <div className="text-sm">
                <span className="font-medium">{"{{detalle_eventos}}"}</span>: Detalles HTML (para detallado)
              </div>
              <div className="text-sm">
                <span className="font-medium">{"{{resumen_emisor}}"}</span>: Resumen HTML por emisor
              </div>
            </div>
          </div>
        </div>
      </Layout>
    </>
  );
}