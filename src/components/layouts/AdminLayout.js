import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { 
  HomeIcon, 
  CloudIcon, 
  QueueListIcon, 
  KeyIcon,
  Cog6ToothIcon,
  EnvelopeIcon,
  ServerIcon,
  CircleStackIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';

/**
 * Layout para las páginas de administración
 * 
 * Proporciona navegación lateral y estructura común para todas las páginas del área administrativa
 */
export default function AdminLayout({ children }) {
  const router = useRouter();
  
  // Enlaces principales de navegación
  const navLinks = [
    { 
      href: "/", 
      icon: HomeIcon, 
      title: "Inicio",
      description: "Volver al dashboard"
    },
    { 
      href: "/admin/ejecuciones", 
      icon: QueueListIcon, 
      title: "Ejecuciones",
      description: "Gestionar ejecuciones"
    },
    { 
      href: "/admin/clouds", 
      icon: CloudIcon, 
      title: "Proveedores Nube",
      description: "Configurar proveedores de nube"
    },
    { 
      href: "/admin/cloud-secrets", 
      icon: KeyIcon, 
      title: "Secretos de Nube",
      description: "Gestionar credenciales de nube"
    },
    { 
      href: "/admin/email", 
      icon: EnvelopeIcon, 
      title: "Configuración Email",
      description: "Configurar casillas de email"
    },
    { 
      href: "/admin/plantillas/email", 
      icon: DocumentTextIcon, 
      title: "Plantillas Email",
      description: "Gestionar plantillas de email"
    },
    { 
      href: "/admin/configuracion", 
      icon: Cog6ToothIcon, 
      title: "Configuración",
      description: "Configuración general"
    },
    { 
      href: "/admin/db", 
      icon: CircleStackIcon, 
      title: "Base de Datos",
      description: "Administración de la BD"
    },
    { 
      href: "/admin/servidores", 
      icon: ServerIcon, 
      title: "Servidores",
      description: "Gestión de servidores"
    }
  ];

  // Detectar enlace activo
  const isActiveLink = (href) => {
    if (href === '/') return router.pathname === '/';
    return router.pathname.startsWith(href);
  };
  
  return (
    <div className="min-h-screen bg-gray-100">
      <Head>
        <title>SAGE Cloud - Administración</title>
      </Head>
      
      <div className="flex flex-col md:flex-row">
        {/* Barra lateral de navegación */}
        <div className="bg-white shadow md:w-64 md:fixed md:inset-y-0 z-10">
          <div className="flex flex-col h-full">
            {/* Logo y título */}
            <div className="px-4 py-6 flex items-center justify-center border-b border-gray-200">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-xl text-gray-900">SAGE</span>
                <span className="text-blue-600 font-semibold">Admin</span>
              </div>
            </div>
            
            {/* Enlaces de navegación */}
            <nav className="mt-5 px-2 space-y-1 flex-grow overflow-y-auto pb-4">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md 
                    ${isActiveLink(link.href) 
                      ? 'bg-gray-100 text-blue-600' 
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
                >
                  <link.icon 
                    className={`mr-3 flex-shrink-0 h-6 w-6 
                      ${isActiveLink(link.href) 
                        ? 'text-blue-600' 
                        : 'text-gray-400 group-hover:text-gray-500'}`}
                  />
                  <span className="truncate">{link.title}</span>
                </Link>
              ))}
            </nav>
            
            {/* Pie de la barra lateral */}
            <div className="px-4 py-4 border-t border-gray-200">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <p className="text-xs text-gray-500">SAGE Cloud v1.0.0</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Contenido principal */}
        <div className="flex-1 md:ml-64">
          <main className="py-6">
            <div className="mx-auto px-4 sm:px-6 md:px-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}