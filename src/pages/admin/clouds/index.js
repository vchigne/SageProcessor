
import { useState, useEffect } from 'react'
import {
  Title,
  Text,
  Card,
  Grid,
  Button,
  TextInput,
  Select,
  SelectItem,
} from "@tremor/react"
import { CloudIcon, PlusIcon } from '@heroicons/react/24/outline'
import { Dialog } from '@headlessui/react'

const CloudProviders = () => {
  const [clouds, setClouds] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [newProvider, setNewProvider] = useState({
    nombre: '',
    descripcion: '',
    tipo: '',
    credenciales: {},
    configuracion: {}
  })

  useEffect(() => {
    fetchClouds()
  }, [])

  const fetchClouds = async () => {
    try {
      const response = await fetch('/api/clouds')
      if (response.ok) {
        const data = await response.json()
        setClouds(data)
      }
    } catch (error) {
      console.error('Error fetching clouds:', error)
    } finally {
      setLoading(false)
    }
  }

  const createProvider = async () => {
    try {
      const response = await fetch('/api/clouds', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newProvider)
      })

      if (response.ok) {
        await fetchClouds()
        setShowModal(false)
        setNewProvider({
          nombre: '',
          descripcion: '',
          tipo: '',
          credenciales: {},
          configuracion: {}
        })
      }
    } catch (error) {
      console.error('Error creating provider:', error)
    }
  }

  return (
    <div className="p-6">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <Title>Proveedores Cloud</Title>
          <Text>Gestión de conexiones cloud</Text>
        </div>
        <Button 
          variant="primary"
          color="blue"
          icon={PlusIcon}
          onClick={() => setShowModal(true)}
        >
          Agregar Proveedor
        </Button>
      </div>

      {/* Modal para nuevo proveedor */}
      <Dialog
        open={showModal}
        onClose={() => setShowModal(false)}
        className="fixed inset-0 z-10 overflow-y-auto"
      >
        <div className="flex items-center justify-center min-h-screen">
          <Dialog.Overlay className="fixed inset-0 bg-black opacity-30" />
          
          <div className="relative bg-white rounded-lg p-8 max-w-md w-full mx-4">
            <Dialog.Title className="text-lg font-medium mb-4">
              Nuevo Proveedor Cloud
            </Dialog.Title>

            <div className="space-y-4">
              <TextInput
                placeholder="Nombre"
                value={newProvider.nombre}
                onChange={(e) => setNewProvider({...newProvider, nombre: e.target.value})}
              />
              
              <TextInput
                placeholder="Descripción"
                value={newProvider.descripcion}
                onChange={(e) => setNewProvider({...newProvider, descripcion: e.target.value})}
              />

              <Select 
                value={newProvider.tipo}
                onValueChange={(value) => setNewProvider({...newProvider, tipo: value})}
              >
                <SelectItem value="s3">Amazon S3</SelectItem>
                <SelectItem value="azure">Azure Storage</SelectItem>
                <SelectItem value="gcp">Google Cloud Storage</SelectItem>
              </Select>

              <div className="flex justify-end gap-2 mt-6">
                <Button variant="secondary" onClick={() => setShowModal(false)}>
                  Cancelar
                </Button>
                <Button variant="primary" onClick={createProvider}>
                  Crear Proveedor
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Dialog>

      {loading ? (
        <div className="text-center py-4">Cargando...</div>
      ) : clouds.length === 0 ? (
        <div className="text-center py-8">
          <CloudIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No hay proveedores</h3>
          <p className="mt-1 text-sm text-gray-500">
            Comienza agregando un nuevo proveedor de almacenamiento en la nube.
          </p>
          <div className="mt-6">
            <Button
              variant="primary"
              color="blue"
              icon={PlusIcon}
              onClick={() => setShowModal(true)}
            >
              Agregar Proveedor
            </Button>
          </div>
        </div>
      ) : (
        <Grid numItems={1} numItemsSm={2} numItemsLg={3} className="gap-6">
          {clouds.map((cloud) => (
            <Card key={cloud.id}>
              <div className="flex items-center space-x-4">
                <CloudIcon className="h-6 w-6 text-gray-600" />
                <div>
                  <h3 className="text-base font-medium">{cloud.nombre}</h3>
                  <p className="text-sm text-gray-500">{cloud.tipo}</p>
                </div>
              </div>
            </Card>
          ))}
        </Grid>
      )}
    </div>
  )
}

export default CloudProviders
