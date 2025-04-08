import { useState, useEffect } from 'react'
import { 
  Title, 
  Card,
  Text,
  Button,
  Grid,
} from "@tremor/react"
import { 
  CubeIcon,
  PlusIcon,
} from '@heroicons/react/24/outline'
import { NewProductoModal } from '@/components/Settings/NewProductoModal'
import { EditProductoModal } from '@/components/Settings/EditProductoModal'
// Quitamos el Layout para usar el principal

export default function ProductosMaestro() {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedProducto, setSelectedProducto] = useState(null);

  useEffect(() => {
    fetchProductos();
  }, []);

  const fetchProductos = async () => {
    try {
      const response = await fetch('/api/productos');
      if (response.ok) {
        const data = await response.json();
        setProductos(data);
      }
    } catch (error) {
      console.error('Error fetching productos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (data) => {
    try {
      const response = await fetch('/api/productos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Error al crear el producto');
      }

      fetchProductos();
    } catch (error) {
      throw error;
    }
  };

  const handleEdit = async (data) => {
    try {
      const response = await fetch(`/api/productos/${data.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Error al actualizar el producto');
      }

      fetchProductos();
    } catch (error) {
      throw error;
    }
  };

  if (loading) return <div>Cargando...</div>;

  return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <Title className="flex items-center">
            <CubeIcon className="h-6 w-6 mr-2" />
            Productos
          </Title>
          <button 
            onClick={() => setIsModalOpen(true)}
            style={{
              backgroundColor: '#2563eb',
              color: 'white',
              borderRadius: '9999px',
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              fontWeight: '500',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem'
            }}
            className="hover:bg-blue-700"
          >
            <PlusIcon className="h-4 w-4" />
            <span>Nuevo Producto</span>
          </button>
        </div>

        <Grid numItems={1} numItemsMd={2} numItemsLg={3} className="gap-6">
          {productos.map((prod) => (
            <Card key={prod.id} className="space-y-4 dark:bg-dark-card">
              <div className="flex justify-between items-start">
                <div>
                  <Text className="font-medium">{prod.nombre}</Text>
                </div>
                <button
                  onClick={() => {
                    setSelectedProducto(prod);
                    setIsEditModalOpen(true);
                  }}
                  style={{
                    backgroundColor: '#ef4444',
                    color: 'white',
                    borderRadius: '9999px',
                    padding: '0.25rem 0.75rem',
                    fontSize: '0.75rem',
                    fontWeight: '500',
                    border: 'none'
                  }}
                  className="hover:bg-red-600"
                >
                  Editar
                </button>
              </div>
            </Card>
          ))}
        </Grid>

        <NewProductoModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleSubmit}
        />

        {selectedProducto && (
          <EditProductoModal
            isOpen={isEditModalOpen}
            onClose={() => {
              setIsEditModalOpen(false);
              setSelectedProducto(null);
            }}
            onSubmit={handleEdit}
            producto={selectedProducto}
          />
        )}
      </div>
  );
}