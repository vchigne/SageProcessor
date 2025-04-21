import React from 'react';

/**
 * Componente de spinner de carga
 * 
 * @param {Object} props - Propiedades del componente
 * @param {string} [props.message="Cargando..."] - Mensaje a mostrar junto al spinner
 * @param {string} [props.size="medium"] - Tamaño del spinner: 'small', 'medium', 'large'
 * @param {string} [props.color="indigo"] - Color del spinner
 */
export default function LoadingSpinner({
  message = "Cargando...",
  size = "medium",
  color = "indigo"
}) {
  // Determinar dimensiones según el tamaño
  const sizeClasses = {
    small: "h-4 w-4 border-2",
    medium: "h-8 w-8 border-2",
    large: "h-12 w-12 border-3"
  };
  
  // Determinar color
  const colorClasses = {
    indigo: "border-indigo-500",
    blue: "border-blue-500",
    green: "border-green-500",
    red: "border-red-500",
    gray: "border-gray-500"
  };
  
  const spinnerClasses = `
    animate-spin rounded-full 
    ${sizeClasses[size] || sizeClasses.medium}
    ${colorClasses[color] || colorClasses.indigo} 
    border-t-transparent
  `;
  
  return (
    <div className="flex flex-col items-center justify-center p-4">
      <div className={spinnerClasses}></div>
      {message && (
        <div className="mt-3 text-sm text-gray-600">{message}</div>
      )}
    </div>
  );
}