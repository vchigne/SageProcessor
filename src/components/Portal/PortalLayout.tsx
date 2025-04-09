import { ReactNode } from 'react';
import Head from 'next/head';
import PortalNavbar from './PortalNavbar';

interface PortalLayoutProps {
  children: ReactNode;
  organizacion?: string;
  producto?: string;
  onSectionChange?: (section: string) => void;
  activeSection?: string;
  title?: string;
}

const PortalLayout = ({ 
  children, 
  organizacion, 
  producto,
  onSectionChange,
  activeSection,
  title
}: PortalLayoutProps) => {
  return (
    <div className="min-h-screen bg-gray-50" data-portal-externo>
      <Head>
        <title>{title || "Portal de Recepción SAGE"}</title>
        <meta name="description" content="Portal de recepción de archivos SAGE" />
      </Head>
      
      <PortalNavbar 
        organizacion={organizacion} 
        producto={producto}
        onSectionChange={onSectionChange}
        activeSection={activeSection}
      />

      {/* Contenido principal */}
      <main className="w-full px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
};

export default PortalLayout;