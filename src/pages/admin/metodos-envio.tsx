import { useState, useEffect } from 'react';
import { MetodosEnvioGrid } from '@/components/DataBoxes/MetodosEnvioGrid';

export default function MetodosEnvioPage() {
  const [casillas, setCasillas] = useState([]);

  useEffect(() => {
    fetchCasillas();
  }, []);

  const fetchCasillas = async () => {
    try {
      const response = await fetch('/api/casillas-recepcion');
      if (!response.ok) {
        throw new Error('Error fetching casillas');
      }
      const data = await response.json();
      setCasillas(data);
    } catch (error) {
      console.error('Error fetching casillas:', error);
    }
  };

  return (
    <div>
      <MetodosEnvioGrid casillas={casillas} />
    </div>
  );
}