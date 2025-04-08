import { useState } from 'react'
import { 
  Title, 
  Grid,
  Card,
  Text,
} from "@tremor/react"
import { 
  BuildingOfficeIcon,
  GlobeAmericasIcon,
  CubeIcon,
  BuildingStorefrontIcon,
} from '@heroicons/react/24/outline'
import Link from 'next/link'
// Quitamos el Layout para usar el principal

export default function Maestros() {
  return (
      <div className="p-6 space-y-6">
        <Title>Maestros del Sistema</Title>
        
        <Grid numItems={1} numItemsMd={2} numItemsLg={2} className="gap-6">
          <Link href="/maestros/organizaciones" className="hover:no-underline">
            <Card className="space-y-4 transition-all duration-200 hover:shadow-md hover:scale-[1.01] dark:bg-dark-card">
              <div className="flex items-center space-x-4">
                <div className="bg-indigo-100 dark:bg-indigo-900 p-3 rounded-full">
                  <BuildingOfficeIcon className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <Text className="font-semibold text-lg">Organizaciones</Text>
                  <Text>Gestión de organizaciones en el sistema</Text>
                </div>
              </div>
            </Card>
          </Link>
          
          <Link href="/maestros/paises" className="hover:no-underline">
            <Card className="space-y-4 transition-all duration-200 hover:shadow-md hover:scale-[1.01] dark:bg-dark-card">
              <div className="flex items-center space-x-4">
                <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-full">
                  <GlobeAmericasIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <Text className="font-semibold text-lg">Países</Text>
                  <Text>Gestión de países en el sistema</Text>
                </div>
              </div>
            </Card>
          </Link>
          
          <Link href="/maestros/productos" className="hover:no-underline">
            <Card className="space-y-4 transition-all duration-200 hover:shadow-md hover:scale-[1.01] dark:bg-dark-card">
              <div className="flex items-center space-x-4">
                <div className="bg-green-100 dark:bg-green-900 p-3 rounded-full">
                  <CubeIcon className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <Text className="font-semibold text-lg">Productos</Text>
                  <Text>Gestión de productos en el sistema</Text>
                </div>
              </div>
            </Card>
          </Link>
          
          <Link href="/maestros/instalaciones" className="hover:no-underline">
            <Card className="space-y-4 transition-all duration-200 hover:shadow-md hover:scale-[1.01] dark:bg-dark-card">
              <div className="flex items-center space-x-4">
                <div className="bg-orange-100 dark:bg-orange-900 p-3 rounded-full">
                  <BuildingStorefrontIcon className="h-8 w-8 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <Text className="font-semibold text-lg">Instalaciones</Text>
                  <Text>Gestión de instalaciones en el sistema</Text>
                </div>
              </div>
            </Card>
          </Link>
        </Grid>
      </div>
  );
}