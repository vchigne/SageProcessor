import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { HomeIcon, CogIcon, ChartBarIcon, DocumentChartBarIcon } from '@heroicons/react/24/outline';

const NAVIGATION_ITEMS = [
  { 
    name: 'Dashboard', 
    href: '/', 
    icon: HomeIcon,
    description: 'Vista general del sistema'
  },
  { 
    name: 'Gestión de Datos', 
    href: '/datos', 
    icon: DocumentChartBarIcon,
    description: 'Administración de datos y archivos'
  },
  { 
    name: 'Gestión YAML', 
    href: '/yaml', 
    icon: ChartBarIcon,
    description: 'Configuración YAML y flujos de trabajo'
  },
  { 
    name: 'Administración', 
    href: '/admin', 
    icon: CogIcon,
    description: 'Configuración del sistema',
    children: [
      { 
        name: 'Configuraciones Email', 
        href: '/admin/configuraciones-email',
        description: 'Gestión de correos electrónicos'
      },
      {
        name: 'Configuraciones SFTP',
        href: '/admin/configuraciones-sftp',
        description: 'Gestión de conexiones SFTP'
      },
      {
        name: 'Configuraciones API',
        href: '/admin/configuraciones-api',
        description: 'Gestión de APIs externas'
      },
      {
        name: 'Plantillas Email',
        href: '/admin/plantillas-email',
        description: 'Gestión de plantillas de correo'
      },
      {
        name: 'SAGE Clouds',
        href: '/admin/clouds',
        description: 'Gestión de almacenamiento en la nube'
      }
    ]
  }
];

export default function AdminLayout({ children }) {
  const router = useRouter();
  
  // Determinar si un elemento de navegación está activo
  const isActive = (path) => {
    if (path === '/') {
      return router.pathname === '/';
    }
    return router.pathname.startsWith(path);
  };
  
  // Determinar si un elemento secundario está activo
  const isChildActive = (path) => router.pathname === path;
  
  // Obtener título de página basado en la ruta actual
  const getPageTitle = () => {
    let title = 'SAGE Admin';
    
    for (const item of NAVIGATION_ITEMS) {
      if (item.children) {
        for (const child of item.children) {
          if (isChildActive(child.href)) {
            return `${child.name} | SAGE Admin`;
          }
        }
      }
      
      if (isActive(item.href) && item.href !== '/') {
        return `${item.name} | SAGE Admin`;
      }
    }
    
    return title;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        {/* Sidebar */}
        <div className="w-64 hidden md:block bg-indigo-700 text-white min-h-screen p-4">
          <div className="mb-8">
            <h1 className="text-xl font-bold tracking-tight">SAGE Admin</h1>
            <p className="text-xs text-indigo-200">Sistema de Administración</p>
          </div>
          
          <nav className="space-y-1">
            {NAVIGATION_ITEMS.map((item) => (
              <div key={item.name} className="mb-4">
                <Link
                  href={item.href}
                  className={`flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                    isActive(item.href) && !item.children
                      ? 'bg-indigo-800 text-white'
                      : 'text-indigo-100 hover:bg-indigo-600'
                  }`}
                >
                  <item.icon className="mr-3 h-5 w-5" aria-hidden="true" />
                  <span>{item.name}</span>
                </Link>
                
                {item.children && (
                  <div className="mt-1 ml-8 space-y-1">
                    {item.children.map((child) => (
                      <Link
                        key={child.name}
                        href={child.href}
                        className={`block px-3 py-2 text-sm rounded-md ${
                          isChildActive(child.href)
                            ? 'bg-indigo-800 text-white'
                            : 'text-indigo-100 hover:bg-indigo-600'
                        }`}
                      >
                        {child.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1">
          <header className="bg-white shadow-sm">
            <div className="p-4">
              <h1 className="text-xl font-semibold text-gray-900">{getPageTitle()}</h1>
            </div>
          </header>
          <main className="flex-1">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}