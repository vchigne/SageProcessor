import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { 
  TrashIcon, PlusIcon, CheckIcon, XMarkIcon 
} from '@heroicons/react/24/outline';
import { Card, Title, Button, Badge } from '@tremor/react';

export default function AsignacionesPlantilla() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [asignaciones, setAsignaciones] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [plantillas, setPlantillas] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    cliente_id: '',
    plantilla_id: '',
    activo: true,
  });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Cargar datos iniciales
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Cargar asignaciones existentes
        const asignacionesRes = await fetch('/api/admin/asignaciones-plantilla');
        const asignacionesData = await asignacionesRes.json();
        setAsignaciones(asignacionesData);
        
        // Cargar lista de clientes (organizaciones)
        const clientesRes = await fetch('/api/organizaciones');
        const clientesData = await clientesRes.json();
        setClientes(clientesData);
        
        // Cargar lista de plantillas
        const plantillasRes = await fetch('/api/admin/plantillas-email');
        const plantillasData = await plantillasRes.json();
        setPlantillas(plantillasData);
        
        setLoading(false);
      } catch (err) {
        console.error('Error al cargar datos:', err);
        setError('Error al cargar datos. Intente nuevamente.');
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Manejar cambios en el formulario
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  // Mostrar formulario de nueva asignación
  const handleShowForm = () => {
    setShowForm(true);
    setFormData({
      cliente_id: '',
      plantilla_id: '',
      activo: true,
    });
    setError(null);
    setSuccess(null);
  };

  // Cancelar formulario
  const handleCancelForm = () => {
    setShowForm(false);
    setError(null);
    setSuccess(null);
  };

  // Guardar nueva asignación
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      setError(null);
      
      if (!formData.cliente_id || !formData.plantilla_id) {
        setError('Por favor complete todos los campos requeridos.');
        setLoading(false);
        return;
      }
      
      const response = await fetch('/api/admin/asignaciones-plantilla', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Error al crear asignación');
      }
      
      // Recargar la lista de asignaciones
      const asignacionesRes = await fetch('/api/admin/asignaciones-plantilla');
      const asignacionesData = await asignacionesRes.json();
      setAsignaciones(asignacionesData);
      
      setSuccess('Asignación creada exitosamente');
      setShowForm(false);
      setFormData({
        cliente_id: '',
        plantilla_id: '',
        activo: true,
      });
      
      setLoading(false);
    } catch (err) {
      console.error('Error al guardar:', err);
      setError(err.message || 'Error al guardar asignación');
      setLoading(false);
    }
  };

  // Eliminar asignación
  const handleDelete = async (id) => {
    if (!confirm('¿Está seguro de eliminar esta asignación?')) {
      return;
    }
    
    try {
      setLoading(true);
      
      const response = await fetch(`/api/admin/asignaciones-plantilla/${id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al eliminar asignación');
      }
      
      // Actualizar lista eliminando la asignación
      setAsignaciones(asignaciones.filter(a => a.id !== id));
      setSuccess('Asignación eliminada exitosamente');
      
      setLoading(false);
    } catch (err) {
      console.error('Error al eliminar:', err);
      setError(err.message || 'Error al eliminar asignación');
      setLoading(false);
    }
  };

  // Cambiar estado de asignación (activo/inactivo)
  const handleToggleActive = async (id, currentActive) => {
    try {
      setLoading(true);
      
      const response = await fetch(`/api/admin/asignaciones-plantilla/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ activo: !currentActive }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al actualizar estado');
      }
      
      // Actualizar lista cambiando el estado
      setAsignaciones(asignaciones.map(a => 
        a.id === id 
          ? { ...a, activo: !currentActive } 
          : a
      ));
      
      setLoading(false);
    } catch (err) {
      console.error('Error al cambiar estado:', err);
      setError(err.message || 'Error al cambiar estado');
      setLoading(false);
    }
  };

  // Obtener nombre de cliente por ID
  const getClienteName = (id) => {
    const cliente = clientes.find(c => c.id === id);
    return cliente ? cliente.nombre : 'Desconocido';
  };

  // Obtener detalles de plantilla por ID
  const getTemplateName = (id) => {
    const plantilla = plantillas.find(p => p.id === id);
    return plantilla ? plantilla.nombre : 'Desconocida';
  };

  return (
    <>
      <Head>
        <title>Asignaciones de Plantillas por Cliente - SAGE Admin</title>
      </Head>
      <div className="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-9xl mx-auto">
        <div className="sm:flex sm:justify-between sm:items-center mb-8">
          {/* Left: Title */}
          <div className="mb-4 sm:mb-0">
            <h1 className="text-2xl md:text-3xl text-slate-800 font-bold">
              Asignaciones de Plantillas por Cliente
            </h1>
          </div>

          {/* Right: Actions */}
          <div className="grid grid-flow-col sm:auto-cols-max justify-start sm:justify-end gap-2">
            <button
              onClick={handleShowForm}
              className="btn bg-indigo-500 hover:bg-indigo-600 text-white"
            >
              <PlusIcon className="w-4 h-4 fill-current opacity-50 shrink-0" />
              <span className="hidden xs:block ml-2">Agregar Asignación</span>
            </button>
          </div>
        </div>

        {/* Mensajes de error/éxito */}
        {error && (
          <div className="mb-4 p-4 bg-red-100 border-l-4 border-red-500 text-red-700">
            <p>{error}</p>
          </div>
        )}
        
        {success && (
          <div className="mb-4 p-4 bg-green-100 border-l-4 border-green-500 text-green-700">
            <p>{success}</p>
          </div>
        )}

        {/* Formulario de nueva asignación */}
        {showForm && (
          <Card className="mb-6">
            <Title>Nueva Asignación</Title>
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Cliente */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Cliente
                  </label>
                  <select
                    name="cliente_id"
                    value={formData.cliente_id}
                    onChange={handleInputChange}
                    required
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  >
                    <option value="">Seleccione un cliente</option>
                    {clientes.map((cliente) => (
                      <option key={cliente.id} value={cliente.id}>
                        {cliente.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Plantilla */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Plantilla
                  </label>
                  <select
                    name="plantilla_id"
                    value={formData.plantilla_id}
                    onChange={handleInputChange}
                    required
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  >
                    <option value="">Seleccione una plantilla</option>
                    {plantillas.map((plantilla) => (
                      <option key={plantilla.id} value={plantilla.id}>
                        {plantilla.nombre} ({plantilla.tipo}/{plantilla.subtipo})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Activo */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="activo"
                  id="activo"
                  checked={formData.activo}
                  onChange={handleInputChange}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="activo" className="ml-2 block text-sm text-gray-700">
                  Activo
                </label>
              </div>

              {/* Botones */}
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={handleCancelForm}
                  className="rounded-md border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  {loading ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </Card>
        )}

        {/* Tabla de asignaciones */}
        <Card>
          <Title>Plantillas personalizadas por cliente</Title>
          <p className="mt-2 text-sm text-gray-600">
            Estas asignaciones determinan qué plantillas específicas se utilizan para cada cliente, en vez de las plantillas predeterminadas.
          </p>
          
          <div className="mt-6 overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
            <table className="min-w-full divide-y divide-gray-300">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Cliente</th>
                  <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Plantilla</th>
                  <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Tipo/Subtipo</th>
                  <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Canal</th>
                  <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Estado</th>
                  <th className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {loading && (
                  <tr>
                    <td colSpan="6" className="px-3 py-4 text-center">
                      Cargando...
                    </td>
                  </tr>
                )}
                
                {!loading && asignaciones.length === 0 && (
                  <tr>
                    <td colSpan="6" className="px-3 py-4 text-center">
                      No hay asignaciones configuradas. Cree una nueva usando el botón superior.
                    </td>
                  </tr>
                )}
                
                {!loading && asignaciones.map((asignacion) => (
                  <tr key={asignacion.id}>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900">
                      {asignacion.cliente_nombre}
                    </td>
                    <td className="px-3 py-4 text-sm text-gray-900">
                      {asignacion.plantilla_nombre}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      {asignacion.tipo}/{asignacion.subtipo}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      {asignacion.canal}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm">
                      <button 
                        onClick={() => handleToggleActive(asignacion.id, asignacion.activo)} 
                        className="relative inline-flex"
                      >
                        {asignacion.activo ? (
                          <Badge color="green" className="cursor-pointer">
                            Activo
                          </Badge>
                        ) : (
                          <Badge color="red" className="cursor-pointer">
                            Inactivo
                          </Badge>
                        )}
                      </button>
                    </td>
                    <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium">
                      <button
                        onClick={() => handleDelete(asignacion.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        
        {/* Ayuda */}
        <div className="mt-8 p-4 bg-blue-50 rounded-md">
          <h3 className="text-lg font-medium text-blue-800">¿Cómo funciona?</h3>
          <ul className="mt-2 text-sm text-blue-700 list-disc list-inside space-y-1">
            <li>Cuando un cliente tiene una plantilla personalizada asignada, el sistema usará esa en vez de la predeterminada.</li>
            <li>Las asignaciones inactivas no se utilizan, pero se mantienen para poder reactivarlas fácilmente.</li>
            <li>Se pueden asignar diferentes plantillas para distintos tipos de notificaciones al mismo cliente.</li>
            <li>Si no hay plantilla personalizada o está inactiva, se usará la plantilla predeterminada del sistema.</li>
          </ul>
        </div>
      </div>
    </>
  );
}