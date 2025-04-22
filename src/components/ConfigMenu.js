import { useState, useRef, useEffect } from 'react';
import { 
  EnvelopeIcon, 
  WrenchScrewdriverIcon, 
  ServerIcon,
  Cog6ToothIcon,
  CodeBracketIcon,
  DocumentTextIcon,
  CloudIcon,
  CloudArrowUpIcon,
  ShieldCheckIcon,
  DatabaseIcon,
  KeyIcon
} from '@heroicons/react/24/outline';
import Link from 'next/link';

export default function ConfigMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  // Lista de opciones de configuración
  const configOptions = [
    { 
      name: 'Configuraciones Email', 
      href: '/admin/configuraciones-email', 
      icon: EnvelopeIcon, 
      description: 'Gestionar configuración de correos y notificaciones' 
    },
    { 
      name: 'Direcciones SFTP', 
      href: '/admin/configuraciones-sftp', 
      icon: ServerIcon, 
      description: 'Configurar conexiones SFTP' 
    },
    { 
      name: 'Configuración de APIs', 
      href: '/admin/configuraciones-api', 
      icon: CodeBracketIcon, 
      description: 'Gestionar APIs externas y claves' 
    },
    { 
      name: 'Configuración de Plantillas de Email', 
      href: '/admin/plantillas-email', 
      icon: DocumentTextIcon, 
      description: 'Personalizar plantillas para diferentes tipos de notificaciones' 
    },
    { 
      name: 'Configuración YAML Studio', 
      href: '/settings', 
      icon: WrenchScrewdriverIcon, 
      description: 'Administrar configuración del YAML Studio' 
    },
    { 
      name: 'SAGE Clouds', 
      href: '/admin/clouds', 
      icon: CloudIcon, 
      description: 'Gestionar proveedores de almacenamiento en la nube' 
    },
    { 
      name: 'Secretos de Bases de Datos', 
      href: '/admin/db-secrets', 
      icon: KeyIcon, 
      description: 'Gestionar secretos y credenciales para conexiones a bases de datos' 
    },
    { 
      name: 'Conexiones a Bases de Datos', 
      href: '/admin/database-connections', 
      icon: DatabaseIcon, 
      description: 'Gestionar conexiones a bases de datos para materializaciones' 
    },
    { 
      name: 'Parámetros de ejecuciones', 
      href: '/admin/ejecuciones-config', 
      icon: CloudArrowUpIcon, 
      description: 'Configurar almacenamiento en la nube para ejecuciones' 
    },
    { 
      name: 'Gestión Administrativa', 
      href: '/admin/system-config', 
      icon: ShieldCheckIcon, 
      description: 'Administrar notificaciones y monitoreo del sistema' 
    }
  ];

  // Cerrar el menú cuando se hace clic fuera de él
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="rounded-full bg-indigo-600 p-2 text-white hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2"
      >
        <Cog6ToothIcon className="h-6 w-6" aria-hidden="true" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 z-50">
          <div className="py-1 divide-y divide-gray-100" role="menu" aria-orientation="vertical" aria-labelledby="options-menu">
            <div className="px-4 py-3">
              <p className="text-sm font-medium text-gray-900">Configuración del Sistema</p>
              <p className="text-xs text-gray-500">Opciones de configuración avanzada</p>
            </div>
            <div className="py-1">
              {configOptions.map((option) => (
                <Link
                  key={option.name}
                  href={option.href}
                  className="flex items-center gap-x-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  onClick={() => setIsOpen(false)}
                >
                  <option.icon className="h-5 w-5 text-gray-500" aria-hidden="true" />
                  <div>
                    <p className="font-medium">{option.name}</p>
                    <p className="text-xs text-gray-500">{option.description}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}