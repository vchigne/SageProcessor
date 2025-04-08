import React from 'react';
import { motion } from 'framer-motion';
import { ExclamationTriangleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

export interface ContentStatusProps {
  status: 'loading' | 'error' | 'empty';
  title?: string;
  message?: string;
  retry?: () => void;
  icon?: React.ReactNode;
}

export const ContentStatus: React.FC<ContentStatusProps> = ({
  status,
  title,
  message,
  retry,
  icon,
}) => {
  // Configuraciones predeterminadas basadas en el estado
  const config = {
    loading: {
      defaultTitle: 'Cargando...',
      defaultMessage: 'Por favor, espera mientras cargamos la información.',
      defaultIcon: (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
        >
          <ArrowPathIcon className="h-10 w-10 text-blue-500" />
        </motion.div>
      ),
      color: 'text-blue-500',
    },
    error: {
      defaultTitle: 'Ha ocurrido un error',
      defaultMessage: 'No pudimos cargar la información. Por favor, intenta nuevamente.',
      defaultIcon: <ExclamationTriangleIcon className="h-10 w-10 text-red-500" />,
      color: 'text-red-500',
    },
    empty: {
      defaultTitle: 'No hay datos disponibles',
      defaultMessage: 'No se encontraron datos para mostrar.',
      defaultIcon: (
        <svg className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
          />
        </svg>
      ),
      color: 'text-gray-500',
    },
  };

  // Usar los valores proporcionados o los predeterminados
  const displayTitle = title || config[status].defaultTitle;
  const displayMessage = message || config[status].defaultMessage;
  const displayIcon = icon || config[status].defaultIcon;

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {displayIcon}
      </motion.div>
      <motion.h3
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className={`mt-4 text-lg font-medium ${config[status].color}`}
      >
        {displayTitle}
      </motion.h3>
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className="mt-2 text-sm text-gray-500 max-w-sm"
      >
        {displayMessage}
      </motion.p>

      {status === 'error' && retry && (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={retry}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
        >
          Reintentar
        </motion.button>
      )}
    </div>
  );
};