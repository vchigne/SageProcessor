import { useState } from 'react';
import Layout from '@/components/Layout';
import Link from 'next/link';
import {
  Card,
  Title,
  Text,
  Grid,
  Col,
  Flex,
  Icon
} from '@tremor/react';
import {
  UsersIcon,
  DocumentTextIcon,
  ServerIcon,
  CogIcon,
  InboxIcon,
  DatabaseIcon,
  CloudArrowUpIcon,
  KeyIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import Breadcrumbs from '@/components/Breadcrumbs';

export default function AdminPage() {
  const adminModules = [
    {
      title: 'Casillas',
      description: 'Gestionar casillas SAGE',
      href: '/admin/casillas',
      icon: InboxIcon,
      color: 'blue'
    },
    {
      title: 'Usuarios',
      description: 'Gestionar usuarios y permisos',
      href: '/admin/users',
      icon: UsersIcon,
      color: 'green'
    },
    {
      title: 'Plantillas de Email',
      description: 'Configurar plantillas de correo',
      href: '/admin/plantillas/email',
      icon: DocumentTextIcon,
      color: 'amber'
    },
    {
      title: 'Proveedores de Nube',
      description: 'Configurar proveedores cloud',
      href: '/admin/cloud-providers',
      icon: CloudArrowUpIcon,
      color: 'purple'
    },
    {
      title: 'Secretos de Nube',
      description: 'Gestionar credenciales cloud',
      href: '/admin/cloud-secrets',
      icon: KeyIcon,
      color: 'indigo'
    },
    {
      title: 'Materializaciones',
      description: 'Gestionar materializaciones',
      href: '/admin/materializations',
      icon: DatabaseIcon,
      color: 'rose'
    },
    {
      title: 'Conexiones a BD',
      description: 'Administrar conexiones de datos',
      href: '/admin/database-connections',
      icon: ServerIcon,
      color: 'orange'
    },
    {
      title: 'Secretos de BD',
      description: 'Gestionar credenciales de BD',
      href: '/admin/db-secrets',
      icon: KeyIcon,
      color: 'yellow'
    },
    {
      title: 'Configuración',
      description: 'Configuración del sistema',
      href: '/admin/settings',
      icon: CogIcon,
      color: 'gray'
    },
    {
      title: 'Servidores Materialización',
      description: 'Gestionar servidores de materialización',
      href: '/admin/materialization-servers',
      icon: ArrowPathIcon,
      color: 'teal'
    }
  ];

  return (
    <Layout>
      <div className="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-9xl mx-auto">
        <Breadcrumbs items={[
          { label: 'Admin', current: true }
        ]} />
        
        <div className="mb-8">
          <Title>Administración del Sistema</Title>
          <Text>Gestión y configuración de SAGE</Text>
        </div>

        <Grid numCols={1} numColsSm={2} numColsLg={3} className="gap-6">
          {adminModules.map((module) => (
            <Col key={module.title}>
              <Link href={module.href} className="block">
                <Card 
                  decoration="top" 
                  decorationColor={module.color} 
                  className="hover:bg-gray-50 transition-colors"
                >
                  <Flex justifyContent="start" alignItems="center" className="space-x-4">
                    <div className={`p-3 rounded-full bg-${module.color}-100`}>
                      <Icon 
                        icon={module.icon} 
                        size="md"
                        color={module.color}
                      />
                    </div>
                    <div>
                      <Title className="text-lg">{module.title}</Title>
                      <Text>{module.description}</Text>
                    </div>
                  </Flex>
                </Card>
              </Link>
            </Col>
          ))}
        </Grid>
      </div>
    </Layout>
  );
}