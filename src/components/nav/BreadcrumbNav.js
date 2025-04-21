import React from 'react';
import Link from 'next/link';
import { ChevronRightIcon, HomeIcon } from '@heroicons/react/24/outline';

/**
 * Componente de navegación de migas de pan (breadcrumbs)
 * 
 * @param {Object} props - Propiedades del componente
 * @param {Array} props.items - Elementos de la navegación
 * @param {string} props.items[].name - Nombre a mostrar
 * @param {string} props.items[].href - URL de destino
 */
export default function BreadcrumbNav({ items = [] }) {
  return (
    <nav className="flex mb-4" aria-label="Breadcrumb">
      <ol className="inline-flex items-center space-x-1 md:space-x-3">
        {items.map((item, index) => (
          <li key={index} className="inline-flex items-center">
            {index === 0 ? (
              <Link 
                href={item.href}
                className="inline-flex items-center text-sm font-medium text-gray-700 hover:text-blue-600"
              >
                <HomeIcon className="w-4 h-4 mr-2" />
                {item.name}
              </Link>
            ) : (
              <>
                <ChevronRightIcon className="w-5 h-5 text-gray-400" />
                {index === items.length - 1 ? (
                  <span className="ml-1 text-sm font-medium text-gray-500 md:ml-2">
                    {item.name}
                  </span>
                ) : (
                  <Link
                    href={item.href}
                    className="ml-1 text-sm font-medium text-gray-700 hover:text-blue-600 md:ml-2"
                  >
                    {item.name}
                  </Link>
                )}
              </>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}