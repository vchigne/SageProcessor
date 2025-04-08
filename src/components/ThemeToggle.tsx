import React, { useEffect, useState } from 'react';
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline';
import { useRouter } from 'next/router';

const ThemeToggle: React.FC = () => {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const router = useRouter();
  
  // Verificar si estamos en portal-externo (siempre usa tema claro)
  const isPortalExterno = router.pathname.startsWith('/portal-externo');
  
  // Inicializar el tema desde localStorage (si existe) o usar el tema oscuro por defecto
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedTheme = localStorage.getItem('theme');
      const prefersDark = storedTheme === 'dark' || (storedTheme === null);
      setIsDarkMode(prefersDark);
      
      // Aplicar tema inicial
      if (!isPortalExterno) {
        document.documentElement.classList.toggle('dark', prefersDark);
      }
    }
  }, [isPortalExterno]);

  // Cambiar entre temas
  const toggleTheme = () => {
    // No permitir cambiar el tema en portal-externo
    if (isPortalExterno) return;
    
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);
    
    // Guardar preferencia en localStorage
    localStorage.setItem('theme', newDarkMode ? 'dark' : 'light');
    
    // Aplicar tema
    document.documentElement.classList.toggle('dark', newDarkMode);
  };

  // No mostrar el botón en portal-externo
  if (isPortalExterno) return null;

  return (
    <button 
      onClick={toggleTheme}
      className="p-2 rounded-full bg-gray-100 dark:bg-blue-900 text-gray-700 dark:text-yellow-300 hover:bg-gray-200 dark:hover:bg-blue-800 transition-all shadow-md hover:shadow-lg transform hover:scale-105"
      title={isDarkMode ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
      aria-label="Alternar tema"
    >
      {isDarkMode ? (
        <SunIcon className="h-5 w-5 md:h-6 md:w-6" />
      ) : (
        <MoonIcon className="h-5 w-5 md:h-6 md:w-6" />
      )}
    </button>
  );
};

export default ThemeToggle;