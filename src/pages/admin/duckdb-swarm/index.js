import React from 'react';
import Link from 'next/link';

const DuckDBSwarm = () => {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">DuckDB Swarm</h1>
      <p>Versión minimalista para pruebas</p>
      <div className="mt-4">
        <Link href="/admin/duckdb-swarm/simple" className="text-blue-500 hover:text-blue-700">
          Ir a versión simple
        </Link>
      </div>
    </div>
  );
};

export default DuckDBSwarm;