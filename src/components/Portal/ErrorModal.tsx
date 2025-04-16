import React from 'react';
import { XCircleIcon, XMarkIcon, InformationCircleIcon } from '@heroicons/react/24/outline';

type ErrorModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  details?: string;
  technicalDetails?: string;
  errorType?: string;
  showTechnicalDetails?: boolean;
};

const ErrorModal: React.FC<ErrorModalProps> = ({
  isOpen,
  onClose,
  title,
  message,
  details,
  technicalDetails,
  errorType,
  showTechnicalDetails = false
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
          <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>
        
        <span className="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true">&#8203;</span>
        
        <div 
          className="inline-block transform overflow-hidden rounded-lg bg-white text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:align-middle"
        >
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                <XCircleIcon className="h-6 w-6 text-red-600" aria-hidden="true" />
              </div>
              <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                <h3 className="text-lg font-medium leading-6 text-gray-900">{title}</h3>
                <div className="mt-2">
                  <p className="text-sm text-gray-500">{message}</p>
                  {details && (
                    <p className="mt-2 text-sm text-gray-500">{details}</p>
                  )}
                  
                  {errorType && (
                    <div className="mt-2 rounded-md bg-gray-50 p-2">
                      <p className="text-xs text-gray-500">
                        <span className="font-medium">Tipo de error:</span> {errorType}
                      </p>
                    </div>
                  )}
                  
                  {technicalDetails && (
                    <div className="mt-3">
                      <div className="flex items-center">
                        <InformationCircleIcon className="h-4 w-4 text-gray-400 mr-1" />
                        <p className="text-xs font-medium text-gray-500">Detalles técnicos:</p>
                      </div>
                      <div className="mt-1 rounded-md bg-gray-50 p-2 overflow-auto max-h-32">
                        <p className="text-xs text-gray-600 font-mono whitespace-pre-wrap">{technicalDetails}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
            <button
              type="button"
              className="inline-flex w-full justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm"
              onClick={onClose}
            >
              Cerrar
            </button>
            {technicalDetails && !showTechnicalDetails && (
              <button
                type="button"
                className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:mt-0 sm:w-auto sm:text-sm"
                onClick={() => window.location.reload()}
              >
                Reintentar
              </button>
            )}
          </div>
          <button
            type="button"
            className="absolute top-3 right-3 text-gray-400 hover:text-gray-500"
            onClick={onClose}
          >
            <span className="sr-only">Cerrar</span>
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ErrorModal;