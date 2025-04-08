import React, { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { BellAlertIcon } from '@heroicons/react/24/outline';
import { Title, Text, Card, Button, Badge, Divider } from '@tremor/react';
import PortalSuscripcionesForm from './PortalSuscripcionesForm';
import PortalSuscripcionesList from './PortalSuscripcionesList';

interface SuscripcionesModalProps {
  isOpen: boolean;
  onClose: () => void;
  portalId?: number;
  portalUuid: string;
  casillaId?: number;
  casillaName?: string;
  esPortalExterno?: boolean;
}

export default function SuscripcionesModal({
  isOpen,
  onClose,
  portalId,
  portalUuid,
  casillaId,
  casillaName,
  esPortalExterno = false
}: SuscripcionesModalProps) {
  const [activeTab, setActiveTab] = useState<'nueva' | 'existentes'>('nueva');
  const [emisores, setEmisores] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Función para forzar actualización de la lista después de crear una suscripción
  const triggerRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  // Obtener lista de emisores para el portal/casilla
  useEffect(() => {
    const fetchEmisores = async () => {
      if (!isOpen) return;
      
      setLoading(true);
      try {
        const url = `/api/portales/${portalUuid}/emisores${casillaId ? `?casillaId=${casillaId}` : ''}`;
        const response = await fetch(url);
        
        if (response.ok) {
          const data = await response.json();
          setEmisores(data);
        } else {
          console.error('Error al obtener emisores:', await response.text());
        }
      } catch (error) {
        console.error('Error al cargar emisores:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEmisores();
  }, [isOpen, portalUuid, casillaId]);

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      {/* Overlay de fondo */}
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      {/* Contenedor del modal */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="w-full max-w-2xl bg-white rounded-lg shadow-xl">
          {/* Encabezado */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4 rounded-t-lg">
            <div className="flex items-center">
              <BellAlertIcon className="h-6 w-6 text-white mr-2" />
              <Dialog.Title className="text-lg font-medium text-white">
                Gestión de Suscripciones
              </Dialog.Title>
            </div>
            <Text className="text-blue-100 text-sm mt-1">
              {casillaName 
                ? `Suscripciones para casilla: ${casillaName}`
                : 'Suscripciones para todas las casillas del portal'}
            </Text>
          </div>

          {/* Contenido */}
          <div className="p-6">
            {/* Tabs */}
            <div className="flex space-x-4 mb-6">
              <button
                className={`px-4 py-2 font-medium rounded-md ${
                  activeTab === 'nueva'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                onClick={() => setActiveTab('nueva')}
              >
                Nueva Suscripción
              </button>
              <button
                className={`px-4 py-2 font-medium rounded-md ${
                  activeTab === 'existentes'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                onClick={() => setActiveTab('existentes')}
              >
                Suscripciones Existentes
              </button>
            </div>

            {/* Contenido según el tab activo */}
            {activeTab === 'nueva' ? (
              <PortalSuscripcionesForm 
                portalId={portalId} 
                portalUuid={portalUuid}
                casillaId={casillaId}
                casillaName={casillaName}
                emisores={emisores}
                esPortalExterno={esPortalExterno}
                onSuccess={() => {
                  triggerRefresh();
                  setActiveTab('existentes');
                }}
                onCancel={() => setActiveTab('existentes')}
              />
            ) : (
              <PortalSuscripcionesList 
                portalId={portalId}
                portalUuid={portalUuid}
                casillaId={casillaId}
                refreshKey={refreshKey}
                esPortalExterno={esPortalExterno}
              />
            )}
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-4 py-3 sm:px-6 rounded-b-lg flex justify-end">
            <Button size="sm" variant="secondary" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}