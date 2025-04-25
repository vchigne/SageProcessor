import React, { useState } from 'react';
import { 
  PlusCircleIcon, 
  PlayCircleIcon, 
  PauseCircleIcon,
  TrashIcon,
  PencilSquareIcon,
  CodeBracketIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';

const FlujosYato = () => {
  const [flujos, setFlujos] = useState([
    {
      id: 1,
      nombre: 'Transformación Ventas',
      descripcion: 'Procesa datos de ventas y genera reportes agregados',
      estado: 'active',
      ultimaEjecucion: '2025-04-23T14:30:00',
      servidor: 'duckdb-sales',
      origen: 'DuckDB: sales_raw',
      destino: 'DuckDB: sales_processed'
    },
    {
      id: 2,
      nombre: 'ETL Marketing',
      descripcion: 'Extrae datos de campañas y calcula métricas',
      estado: 'inactive',
      ultimaEjecucion: '2025-04-22T09:15:00',
      servidor: 'duckdb-marketing',
      origen: 'PostgreSQL: marketing_campaigns',
      destino: 'DuckDB: marketing_metrics'
    },
    {
      id: 3,
      nombre: 'Consolidación Financiera',
      descripcion: 'Consolida datos financieros de múltiples fuentes',
      estado: 'active',
      ultimaEjecucion: '2025-04-24T08:45:00',
      servidor: 'duckdb-finance',
      origen: 'Multiple sources',
      destino: 'DuckDB: financial_consolidated'
    }
  ]);

  const [showForm, setShowForm] = useState(false);
  const [editingFlujo, setEditingFlujo] = useState(null);
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    servidor: '',
    origen: '',
    destino: '',
    codigo: ''
  });

  const handleToggleStatus = (id) => {
    setFlujos(flujos.map(flujo => 
      flujo.id === id ? { ...flujo, estado: flujo.estado === 'active' ? 'inactive' : 'active' } : flujo
    ));
  };

  const handleDelete = (id) => {
    if (confirm('¿Está seguro de que desea eliminar este flujo?')) {
      setFlujos(flujos.filter(flujo => flujo.id !== id));
    }
  };

  const handleEdit = (flujo) => {
    setEditingFlujo(flujo.id);
    setFormData({
      nombre: flujo.nombre,
      descripcion: flujo.descripcion,
      servidor: flujo.servidor,
      origen: flujo.origen,
      destino: flujo.destino,
      codigo: '-- Ejemplo de código SQL Yato\nSELECT * FROM origen\nWHERE fecha > CURRENT_DATE - INTERVAL 7 DAY\nGROUP BY categoria\nORDER BY SUM(monto) DESC;'
    });
    setShowForm(true);
  };

  const handleNewFlujo = () => {
    setEditingFlujo(null);
    setFormData({
      nombre: '',
      descripcion: '',
      servidor: '',
      origen: '',
      destino: '',
      codigo: '-- Escriba su código SQL Yato aquí\n'
    });
    setShowForm(true);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (editingFlujo) {
      // Actualizar flujo existente
      setFlujos(flujos.map(flujo => 
        flujo.id === editingFlujo ? { 
          ...flujo, 
          nombre: formData.nombre,
          descripcion: formData.descripcion,
          servidor: formData.servidor,
          origen: formData.origen,
          destino: formData.destino
        } : flujo
      ));
    } else {
      // Crear nuevo flujo
      const newFlujo = {
        id: Math.max(0, ...flujos.map(f => f.id)) + 1,
        nombre: formData.nombre,
        descripcion: formData.descripcion,
        estado: 'inactive',
        ultimaEjecucion: null,
        servidor: formData.servidor,
        origen: formData.origen,
        destino: formData.destino
      };
      setFlujos([...flujos, newFlujo]);
    }
    
    setShowForm(false);
    setEditingFlujo(null);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Definición de Flujos Yato</h1>
        <button 
          onClick={handleNewFlujo}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <PlusCircleIcon className="h-5 w-5 mr-2" />
          Nuevo Flujo
        </button>
      </div>

      {showForm ? (
        <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">
            {editingFlujo ? 'Editar Flujo' : 'Nuevo Flujo'}
          </h2>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nombre
                </label>
                <input
                  type="text"
                  name="nombre"
                  value={formData.nombre}
                  onChange={handleFormChange}
                  className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-md"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Servidor DuckDB
                </label>
                <input
                  type="text"
                  name="servidor"
                  value={formData.servidor}
                  onChange={handleFormChange}
                  className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-md"
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Descripción
                </label>
                <input
                  type="text"
                  name="descripcion"
                  value={formData.descripcion}
                  onChange={handleFormChange}
                  className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Origen
                </label>
                <input
                  type="text"
                  name="origen"
                  value={formData.origen}
                  onChange={handleFormChange}
                  className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-md"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Destino
                </label>
                <input
                  type="text"
                  name="destino"
                  value={formData.destino}
                  onChange={handleFormChange}
                  className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-md"
                  required
                />
              </div>
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Código SQL Yato
              </label>
              <div className="relative">
                <CodeBracketIcon className="absolute top-3 left-3 h-5 w-5 text-gray-400" />
                <textarea
                  name="codigo"
                  value={formData.codigo}
                  onChange={handleFormChange}
                  rows={8}
                  className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-md pl-10 font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Guardar
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
          <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">
              Flujos Disponibles
            </h2>
            <button 
              className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <ArrowPathIcon className="h-4 w-4 mr-1" />
              Actualizar
            </button>
          </div>
          <div className="border-t border-gray-200 dark:border-gray-700">
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {flujos.length === 0 ? (
                <li className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">
                  No hay flujos definidos. Cree uno nuevo con el botón superior.
                </li>
              ) : (
                flujos.map((flujo) => (
                  <li key={flujo.id} className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${
                          flujo.estado === 'active' ? 'bg-green-100' : 'bg-gray-100'
                        }`}>
                          <CodeBracketIcon 
                            className={`h-6 w-6 ${
                              flujo.estado === 'active' ? 'text-green-600' : 'text-gray-600'
                            }`} 
                          />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {flujo.nombre}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            {flujo.descripcion}
                          </div>
                          <div className="flex mt-1 text-xs text-gray-500 dark:text-gray-400 space-x-4">
                            <span>Servidor: {flujo.servidor}</span>
                            <span>Origen: {flujo.origen}</span>
                            <span>Destino: {flujo.destino}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleToggleStatus(flujo.id)}
                          className={`inline-flex items-center p-1 border border-transparent rounded-full shadow-sm text-white ${
                            flujo.estado === 'active' 
                              ? 'bg-red-100 text-red-600 hover:bg-red-200' 
                              : 'bg-green-100 text-green-600 hover:bg-green-200'
                          } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
                        >
                          {flujo.estado === 'active' ? (
                            <PauseCircleIcon className="h-5 w-5" />
                          ) : (
                            <PlayCircleIcon className="h-5 w-5" />
                          )}
                        </button>
                        <button
                          onClick={() => handleEdit(flujo)}
                          className="inline-flex items-center p-1 border border-transparent rounded-full shadow-sm text-white bg-indigo-100 text-indigo-600 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                          <PencilSquareIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(flujo.id)}
                          className="inline-flex items-center p-1 border border-transparent rounded-full shadow-sm text-white bg-gray-100 text-gray-600 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                    {flujo.ultimaEjecucion && (
                      <div className="mt-2 text-xs text-gray-500">
                        Última ejecución: {new Date(flujo.ultimaEjecucion).toLocaleString()}
                      </div>
                    )}
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default FlujosYato;