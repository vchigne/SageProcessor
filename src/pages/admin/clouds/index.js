
import { useState, useEffect } from 'react'
import {
  Title,
  Text,
  Card,
  Grid,
} from "@tremor/react"
import { CloudIcon } from '@heroicons/react/24/outline'
import Layout from '@/components/Layout'

const CloudProviders = () => {
  const [clouds, setClouds] = useState([])
  const [loading, setLoading] = useState(true)

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

  return (
    <Layout>
      <div className="p-6">
        <div className="mb-8">
          <Title>Proveedores Cloud</Title>
          <Text>Gestión de conexiones cloud</Text>
        </div>

        {loading ? (
          <div className="text-center py-4">Cargando...</div>
        ) : clouds.length === 0 ? (
          <div className="text-center py-8">
            <CloudIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No hay proveedores</h3>
            <p className="mt-1 text-sm text-gray-500">
              Comienza agregando un nuevo proveedor de almacenamiento en la nube.
            </p>
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
    </Layout>
  )
}

export default CloudProviders
