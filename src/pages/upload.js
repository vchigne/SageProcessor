import { useState, useEffect } from 'react';
import { Title, Card, Button, TextInput } from "@tremor/react";
import { FileUploadModal } from '@/components/FileUpload/FileUploadModal';
import { DocumentArrowUpIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import Layout from '@/components/Layout';

export default function FileUpload() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [dataBoxes, setDataBoxes] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDataBox, setSelectedDataBox] = useState(null);

  useEffect(() => {
    // Cargar casillas de recepción al montar el componente
    const fetchDataBoxes = async () => {
      try {
        const response = await fetch('/api/data-boxes');
        if (response.ok) {
          const data = await response.json();
          setDataBoxes(data);
        }
      } catch (error) {
        console.error('Error fetching data boxes:', error);
      }
    };

    fetchDataBoxes();
  }, []);

  // Filtrar casillas basado en la búsqueda
  const filteredDataBoxes = dataBoxes.filter(dataBox => {
    const searchLower = searchQuery.toLowerCase();
    return (
      dataBox.instalacion.organizacion.nombre.toLowerCase().includes(searchLower) ||
      dataBox.instalacion.pais.nombre.toLowerCase().includes(searchLower) ||
      dataBox.instalacion.producto.nombre.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="p-6">
      <div className="mb-6">
        <Title>Cargar Archivos</Title>
        <p className="mt-2 text-gray-600">
          Selecciona una casilla de recepción para cargar tus archivos
        </p>
      </div>

      <div className="mb-6">
        <TextInput
          icon={MagnifyingGlassIcon}
          placeholder="Buscar por instalación, organización, producto o país..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredDataBoxes.map((dataBox) => (
          <Card key={dataBox.id} className="relative">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              {dataBox.instalacion.organizacion.nombre} - {dataBox.instalacion.pais.nombre}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {dataBox.instalacion.producto.nombre}
            </p>
            <div className="pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-500 mb-4">
                Archivo: {dataBox.nombre_yaml}
              </p>
              <Button
                variant="secondary"
                icon={DocumentArrowUpIcon}
                onClick={() => {
                  setSelectedDataBox(dataBox);
                  setIsModalOpen(true);
                }}
                className="w-full"
              >
                Cargar Archivo
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <FileUploadModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedDataBox(null);
        }}
        dataBox={selectedDataBox}
      />
    </div>
  );
}