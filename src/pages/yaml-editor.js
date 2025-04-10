import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import Head from 'next/head';

// Un componente que redirige a un YAML Editor externo
const YAMLEditorPage = () => {
  const router = useRouter();
  
  // Al cargar, abrir el YAML Editor en una nueva ventana
  useEffect(() => {
    // URL de la aplicación YAML Editor externa que se alojará en un servidor separado
    // Por ahora, usamos una ruta en el mismo dominio que apunta a la carpeta public/yaml_editor
    const yamlEditorUrl = window.location.origin + "/yaml_editor/";
    
    // Abrir en una nueva ventana/pestaña
    window.open(yamlEditorUrl, "_blank", "noopener,noreferrer");
    
    // Redirigir al usuario de vuelta al dashboard después de abrir la aplicación
    // para que no se quede en una página en blanco
    router.push('/');
  }, []);
  
  return (
    <>
      <Head>
        <title>Redirigiendo a YAML Editor - SAGE</title>
      </Head>
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <div className="animate-pulse text-gray-500 dark:text-gray-400 text-center">
          <p className="text-lg mb-4">Abriendo YAML Editor en una nueva ventana...</p>
          <p>Si no se abre automáticamente, por favor verifica que no está siendo bloqueado por tu navegador.</p>
        </div>
      </div>
    </>
  );
};

YAMLEditorPage.getLayout = function getLayout(page) {
  return <Layout>{page}</Layout>;
};

export default YAMLEditorPage;