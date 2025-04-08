import { useState, useEffect } from 'react'
import { 
  Title, 
  TabGroup, 
  TabList, 
  Tab, 
  TabPanels, 
  TabPanel,
  Card,
  Text,
  Button,
  Grid,
} from "@tremor/react"
import { 
  BuildingOfficeIcon,
  GlobeAmericasIcon,
  CubeIcon,
  PlusIcon,
  BuildingStorefrontIcon,
  EnvelopeIcon,
} from '@heroicons/react/24/outline'
import { NewOrganizacionModal } from '@/components/Settings/NewOrganizacionModal'
import { NewPaisModal } from '@/components/Settings/NewPaisModal'
import { NewProductoModal } from '@/components/Settings/NewProductoModal'
import { NewInstalacionModal } from '@/components/Settings/NewInstalacionModal'
import { EditOrganizacionModal } from '@/components/Settings/EditOrganizacionModal'
import { EditPaisModal } from '@/components/Settings/EditPaisModal'
import { EditProductoModal } from '@/components/Settings/EditProductoModal'
import { EditInstalacionModal } from '@/components/Settings/EditInstalacionModal'

const OrganizacionesPanel = () => {
  const [organizaciones, setOrganizaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedOrganizacion, setSelectedOrganizacion] = useState(null);

  useEffect(() => {
    fetchOrganizaciones();
  }, []);

  const fetchOrganizaciones = async () => {
    try {
      const response = await fetch('/api/organizaciones');
      if (response.ok) {
        const data = await response.json();
        setOrganizaciones(data);
      }
    } catch (error) {
      console.error('Error fetching organizaciones:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (data) => {
    try {
      const response = await fetch('/api/organizaciones', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Error al crear la organización');
      }

      fetchOrganizaciones();
    } catch (error) {
      throw error;
    }
  };

  const handleEdit = async (data) => {
    try {
      const response = await fetch(`/api/organizaciones/${data.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Error al actualizar la organización');
      }

      fetchOrganizaciones();
    } catch (error) {
      throw error;
    }
  };

  if (loading) return <div>Cargando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Text>Gestión de Organizaciones</Text>
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
          <span>Nueva Organización</span>
        </button>
      </div>

      <Grid numItems={1} numItemsMd={2} numItemsLg={3} className="gap-6">
        {organizaciones.map((org) => (
          <Card key={org.id} className="space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <Text className="font-medium">{org.nombre}</Text>
                <Text className="text-sm text-gray-500">
                  Creado: {new Date(org.creado_en).toLocaleDateString()}
                </Text>
              </div>
              <button
                onClick={() => {
                  setSelectedOrganizacion(org);
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

      <NewOrganizacionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmit}
      />

      {selectedOrganizacion && (
        <EditOrganizacionModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedOrganizacion(null);
          }}
          onSubmit={handleEdit}
          organizacion={selectedOrganizacion}
        />
      )}
    </div>
  );
};

const PaisesPanel = () => {
  const [paises, setPaises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedPais, setSelectedPais] = useState(null);

  useEffect(() => {
    fetchPaises();
  }, []);

  const fetchPaises = async () => {
    try {
      const response = await fetch('/api/paises');
      if (response.ok) {
        const data = await response.json();
        setPaises(data);
      }
    } catch (error) {
      console.error('Error fetching paises:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (data) => {
    try {
      const response = await fetch('/api/paises', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Error al crear el país');
      }

      fetchPaises();
    } catch (error) {
      throw error;
    }
  };

  const handleEdit = async (data) => {
    try {
      const response = await fetch(`/api/paises/${data.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Error al actualizar el país');
      }

      fetchPaises();
    } catch (error) {
      throw error;
    }
  };

  if (loading) return <div>Cargando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Text>Gestión de Países</Text>
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
          <span>Nuevo País</span>
        </button>
      </div>

      <Card>
        <div className="space-y-4">
          {paises.map((pais) => (
            <div key={pais.id} className="flex justify-between items-center p-2 hover:bg-gray-50 rounded-lg">
              <div>
                <Text>{pais.nombre}</Text>
                <Text className="text-sm text-gray-500">Código ISO: {pais.codigo_iso}</Text>
              </div>
              <button
                onClick={() => {
                  setSelectedPais(pais);
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
          ))}
        </div>
      </Card>

      <NewPaisModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmit}
      />

      {selectedPais && (
        <EditPaisModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedPais(null);
          }}
          onSubmit={handleEdit}
          pais={selectedPais}
        />
      )}
    </div>
  );
};

const ProductosPanel = () => {
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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Text>Gestión de Productos</Text>
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
          <Card key={prod.id} className="space-y-4">
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
};

const InstalacionesPanel = () => {
  const [instalaciones, setInstalaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedInstalacion, setSelectedInstalacion] = useState(null);

  useEffect(() => {
    fetchInstalaciones();
  }, []);

  const fetchInstalaciones = async () => {
    try {
      const response = await fetch('/api/instalaciones');
      if (response.ok) {
        const data = await response.json();
        setInstalaciones(data);
      }
    } catch (error) {
      console.error('Error fetching instalaciones:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (data) => {
    try {
      const response = await fetch('/api/instalaciones', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Error al crear la instalación');
      }

      fetchInstalaciones();
    } catch (error) {
      throw error;
    }
  };

  const handleEdit = async (data) => {
    try {
      const response = await fetch(`/api/instalaciones/${data.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Error al actualizar la instalación');
      }

      fetchInstalaciones();
    } catch (error) {
      throw error;
    }
  };

  if (loading) return <div>Cargando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Text>Gestión de Instalaciones</Text>
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
          <span>Nueva Instalación</span>
        </button>
      </div>

      <Grid numItems={1} numItemsMd={2} numItemsLg={3} className="gap-6">
        {instalaciones.map((inst) => (
          <Card key={inst.id} className="space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <Text className="font-medium">{inst.producto}</Text>
                <Text className="text-sm text-gray-500">{inst.organizacion}</Text>
                <Text className="text-sm text-gray-500">{inst.pais}</Text>
              </div>
              <button
                onClick={() => {
                  setSelectedInstalacion(inst);
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

      <NewInstalacionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmit}
      />

      {selectedInstalacion && (
        <EditInstalacionModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedInstalacion(null);
          }}
          onSubmit={handleEdit}
          instalacion={selectedInstalacion}
        />
      )}
    </div>
  );
};

export default function Settings() {
  const [selectedTab, setSelectedTab] = useState(0);

  return (
    <div className="p-6 space-y-6">
      <Title>Configuración Básica</Title>

      <TabGroup index={selectedTab} onIndexChange={setSelectedTab}>
        <TabList className="mt-8">
          <Tab icon={BuildingOfficeIcon}>Organizaciones</Tab>
          <Tab icon={GlobeAmericasIcon}>Países</Tab>
          <Tab icon={CubeIcon}>Productos</Tab>
          <Tab icon={BuildingStorefrontIcon}>Instalaciones</Tab>
        </TabList>

        <TabPanels>
          <TabPanel>
            <OrganizacionesPanel />
          </TabPanel>
          <TabPanel>
            <PaisesPanel />
          </TabPanel>
          <TabPanel>
            <ProductosPanel />
          </TabPanel>
          <TabPanel>
            <InstalacionesPanel />
          </TabPanel>
        </TabPanels>
      </TabGroup>
    </div>
  );
}