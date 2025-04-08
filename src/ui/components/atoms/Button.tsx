import React from 'react';
import { motion } from 'framer-motion';

export interface ButtonProps {
  children?: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'warning' | 'success' | 'info' | 'outline';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  isDisabled?: boolean;
  fullWidth?: boolean;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  isDisabled = false,
  fullWidth = false,
  type = 'button',
  className = '',
  onClick,
  icon,
  iconPosition = 'left',
}) => {
  // Mapeo de variantes a clases de Tailwind
  const variantClasses = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    secondary: 'bg-gray-600 hover:bg-gray-700 text-white',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    warning: 'bg-amber-500 hover:bg-amber-600 text-white',
    success: 'bg-green-600 hover:bg-green-700 text-white',
    info: 'bg-indigo-600 hover:bg-indigo-700 text-white',
    outline: 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300',
  };

  // Mapeo de tamaños a clases de Tailwind
  const sizeClasses = {
    xs: 'px-2 py-1 text-xs',
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isDisabled || isLoading) return;
    if (onClick) onClick(e);
  };

  // Construir las clases de Tailwind
  const buttonClasses = `
    rounded-md font-medium shadow-sm
    transition-colors duration-200
    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
    flex items-center justify-center
    ${isDisabled || isLoading ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}
    ${variantClasses[variant]}
    ${sizeClasses[size]}
    ${fullWidth ? 'w-full' : ''}
    ${className}
  `;

  // Renderizar los hijos del botón, manejando el caso de loading e iconos
  const renderChildren = () => {
    if (isLoading) {
      return (
        <>
          <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {children}
        </>
      );
    }

    if (icon) {
      return iconPosition === 'left' ? (
        <>
          <span className="mr-2">{icon}</span>
          {children}
        </>
      ) : (
        <>
          {children}
          <span className="ml-2">{icon}</span>
        </>
      );
    }

    return children;
  };

  return (
    <button
      type={type}
      className={buttonClasses}
      onClick={handleClick}
      disabled={isDisabled || isLoading}
    >
      {renderChildren()}
    </button>
  );
};