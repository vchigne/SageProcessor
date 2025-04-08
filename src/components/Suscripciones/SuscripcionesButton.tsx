import React, { useState } from 'react';
import { Button } from '@tremor/react';
import { BellAlertIcon } from '@heroicons/react/24/outline';
import SuscripcionesModal from './SuscripcionesModal';

interface SuscripcionesButtonProps {
  portalId?: number;
  portalUuid: string;
  casillaId?: number;
  casillaName?: string;
  buttonSize?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'primary' | 'secondary' | 'light';
  fullWidth?: boolean;
  label?: string;

  esPortalExterno?: boolean;
}

export default function SuscripcionesButton({
  portalId,
  portalUuid,
  casillaId,
  casillaName,
  buttonSize = 'sm',
  variant = 'secondary',
  fullWidth = false,
  label = 'Gestionar Suscripciones',

  esPortalExterno = false
}: SuscripcionesButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  return (
    <>
      <Button
        size={buttonSize}
        variant={variant}
        icon={BellAlertIcon}
        onClick={openModal}
        className={fullWidth ? 'w-full' : ''}
      >
        {label}
      </Button>

      <SuscripcionesModal
        isOpen={isModalOpen}
        onClose={closeModal}
        portalId={portalId}
        portalUuid={portalUuid}
        casillaId={casillaId}
        casillaName={casillaName}
        esPortalExterno={esPortalExterno}
      />
    </>
  );
}