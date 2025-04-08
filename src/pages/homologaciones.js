import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Homologaciones() {
  const router = useRouter();

  useEffect(() => {
    // Redireccionar a la página de upload
    router.replace('/upload');
  }, [router]);

  return (
    <div className="p-6">
      <p>Redireccionando a Subir Archivos...</p>
    </div>
  );
}