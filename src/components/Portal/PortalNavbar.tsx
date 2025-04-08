import { useState } from 'react';
import { Title, Text } from "@tremor/react";
import { Bars3Icon, XMarkIcon, CpuChipIcon } from '@heroicons/react/24/outline';

interface PortalNavbarProps {
  organizacion?: string;
  producto?: string;
  onSectionChange: (section: string) => void;
  activeSection: string;
}

export const PortalNavbar = ({ 
  organizacion, 
  producto,
  onSectionChange,
  activeSection
}: PortalNavbarProps) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const portalNavigation = [
    { name: 'Dashboard', href: 'dashboard', icon: '📊' },
    { name: 'Homologaciones', href: 'homologaciones', icon: '🔄' }
  ];

  const handleNavigation = (href: string) => {
    onSectionChange(href);
    setIsMenuOpen(false);
  };

  return (
    <nav className="bg-gradient-to-r from-blue-600 to-blue-800 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white transition-colors duration-200"
            >
              <span className="sr-only">Abrir menú principal</span>
              {isMenuOpen ? (
                <XMarkIcon className="block h-6 w-6" />
              ) : (
                <Bars3Icon className="block h-6 w-6" />
              )}
            </button>
          </div>

          <div className="flex-1 flex justify-between px-2 lg:ml-6">
            <div className="max-w-7xl text-center lg:text-left">
              <Title className="text-white text-2xl font-bold">
                {organizacion}
              </Title>
              <Text className="text-blue-100 font-medium">
                {producto}
              </Text>
            </div>
            <div className="hidden md:flex items-center">
              <div className="flex items-center bg-white/10 backdrop-blur-sm px-4 py-2 rounded-lg">
                <CpuChipIcon className="h-7 w-7 text-white" aria-hidden="true" />
                <div className="ml-2">
                  <div className="text-white font-bold text-lg">SAGE</div>
                  <div className="text-blue-100 text-xs">by Vida Software</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Menú móvil */}
        <div 
          className={`${
            isMenuOpen ? 'translate-x-0 opacity-100 visible' : '-translate-x-full opacity-0 invisible'
          } fixed inset-0 z-50 transform transition-all duration-300 ease-in-out`}
        >
          <div className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm" onClick={() => setIsMenuOpen(false)} />
          <div className="relative bg-white w-72 min-h-screen">
            <div className="pt-5 pb-6 px-5">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center">
                  <CpuChipIcon className="h-7 w-7 text-indigo-600" aria-hidden="true" />
                  <div className="ml-2">
                    <div className="text-indigo-600 font-bold text-lg">SAGE</div>
                    <div className="text-indigo-400 text-xs">by Vida Software</div>
                  </div>
                </div>
                <button
                  onClick={() => setIsMenuOpen(false)}
                  className="rounded-md p-2 text-gray-400 hover:text-gray-500 hover:bg-gray-100"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
              <div className="mt-6">
                <nav className="grid gap-y-2">
                  {portalNavigation.map((item) => (
                    <button
                      key={item.name}
                      onClick={() => handleNavigation(item.href)}
                      className={`flex items-center px-4 py-3 rounded-lg text-base font-semibold transition-all duration-200 w-full text-left
                        ${activeSection === item.href 
                          ? 'text-blue-600 bg-blue-50' 
                          : 'text-gray-700 hover:text-blue-600 hover:bg-blue-50'}`}
                    >
                      <span className="mr-3 text-xl">{item.icon}</span>
                      {item.name}
                    </button>
                  ))}
                </nav>
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
              <Text className="text-sm text-gray-500 text-center">
                © {new Date().getFullYear()} SAGE by Vida Software
              </Text>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default PortalNavbar;