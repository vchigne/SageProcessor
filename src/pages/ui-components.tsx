import React, { useState } from 'react';
import { 
  Button, 
  Card, 
  SearchInput, 
  ContentStatus 
} from '../ui/components';
import { HomeIcon } from '@heroicons/react/24/outline';

export default function UIComponents() {
  const [searchValue, setSearchValue] = useState('');
  const [contentStatus, setContentStatus] = useState<'loading' | 'error' | 'empty'>('loading');

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Biblioteca de Componentes UI</h1>
      <p className="text-gray-600 mb-8">
        Esta página muestra los componentes UI disponibles en la aplicación.
      </p>

      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4">Botones</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Button>Botón Primario</Button>
          <Button variant="secondary">Botón Secundario</Button>
          <Button variant="danger">Botón Peligro</Button>
          <Button variant="warning">Botón Advertencia</Button>
          <Button variant="success">Botón Éxito</Button>
          <Button variant="info">Botón Info</Button>
          <Button variant="outline">Botón Outline</Button>
          <Button isLoading>Cargando</Button>
        </div>

        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <Button size="xs">Tamaño XS</Button>
          <Button size="sm">Tamaño SM</Button>
          <Button size="md">Tamaño MD</Button>
          <Button size="lg">Tamaño LG</Button>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Button icon={<HomeIcon className="h-5 w-5" />}>Con Icono</Button>
          <Button fullWidth>Ancho Completo</Button>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4">Tarjetas</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <h3 className="font-medium text-lg mb-2">Tarjeta Básica</h3>
            <p className="text-gray-600">Este es el contenido de una tarjeta básica sin decoración.</p>
          </Card>

          <Card decoration="top" decorationColor="blue">
            <h3 className="font-medium text-lg mb-2">Decoración Superior</h3>
            <p className="text-gray-600">Tarjeta con decoración en la parte superior.</p>
          </Card>

          <Card decoration="left" decorationColor="green">
            <h3 className="font-medium text-lg mb-2">Decoración Izquierda</h3>
            <p className="text-gray-600">Tarjeta con decoración en el lado izquierdo.</p>
          </Card>

          <Card shadow="lg" isHoverable onClick={() => alert('¡Hiciste clic en la tarjeta!')}>
            <h3 className="font-medium text-lg mb-2">Tarjeta Interactiva</h3>
            <p className="text-gray-600">Esta tarjeta es interactiva y tiene una sombra grande.</p>
          </Card>

          <Card padding="lg" decoration="bottom" decorationColor="amber">
            <h3 className="font-medium text-lg mb-2">Padding Grande</h3>
            <p className="text-gray-600">Tarjeta con padding grande y decoración inferior.</p>
          </Card>

          <Card padding="sm" decoration="right" decorationColor="red">
            <h3 className="font-medium text-lg mb-2">Padding Pequeño</h3>
            <p className="text-gray-600">Tarjeta con padding pequeño y decoración derecha.</p>
          </Card>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4">Búsqueda</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <SearchInput
              value={searchValue}
              onChange={setSearchValue}
              placeholder="Buscar..."
              onSearch={(value) => console.log('Búsqueda:', value)}
            />
            <p className="mt-2 text-sm text-gray-500">Valor actual: {searchValue || '(vacío)'}</p>
          </div>

          <div>
            <SearchInput
              value={searchValue}
              onChange={setSearchValue}
              placeholder="Buscar con tamaño grande..."
              size="lg"
              className="bg-gray-50"
            />
          </div>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4">Estados de Contenido</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <ContentStatus status="loading" />
          </Card>

          <Card>
            <ContentStatus 
              status="error" 
              retry={() => setContentStatus('loading')}
            />
          </Card>

          <Card>
            <ContentStatus 
              status="empty" 
              title="Sin resultados"
              message="No se encontraron resultados para tu búsqueda."
            />
          </Card>
        </div>
      </section>
    </div>
  );
}