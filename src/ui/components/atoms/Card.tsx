import React from 'react';
import { motion } from 'framer-motion';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  decoration?: 'top' | 'left' | 'bottom' | 'right' | 'none';
  decorationColor?: 'blue' | 'red' | 'green' | 'yellow' | 'purple' | 'gray' | 'indigo' | 'emerald' | 'amber';
  shadow?: 'none' | 'sm' | 'md' | 'lg';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  onClick?: () => void;
  isHoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  decoration = 'none',
  decorationColor = 'blue',
  shadow = 'md',
  padding = 'md',
  onClick,
  isHoverable = false,
}) => {
  // Mapeo de colores de decoración a clases de Tailwind
  const decorationColorClasses = {
    blue: 'border-blue-500',
    red: 'border-red-500',
    green: 'border-green-500',
    yellow: 'border-yellow-500',
    purple: 'border-purple-500',
    gray: 'border-gray-500',
    indigo: 'border-indigo-500',
    emerald: 'border-emerald-500',
    amber: 'border-amber-500',
  };

  // Mapeo de tipos de decoración a clases de Tailwind
  const decorationClasses = {
    top: `border-t-4 ${decorationColorClasses[decorationColor]}`,
    left: `border-l-4 ${decorationColorClasses[decorationColor]}`,
    bottom: `border-b-4 ${decorationColorClasses[decorationColor]}`,
    right: `border-r-4 ${decorationColorClasses[decorationColor]}`,
    none: '',
  };

  // Mapeo de sombras a clases de Tailwind
  const shadowClasses = {
    none: '',
    sm: 'shadow-sm',
    md: 'shadow',
    lg: 'shadow-lg',
  };

  // Mapeo de paddings a clases de Tailwind
  const paddingClasses = {
    none: 'p-0',
    sm: 'p-3',
    md: 'p-5',
    lg: 'p-7',
  };

  // Construir las clases
  const cardClasses = `
    bg-white dark:bg-dark-card rounded-lg border border-gray-200 dark:border-dark-border
    ${decorationClasses[decoration]}
    ${shadowClasses[shadow]}
    ${paddingClasses[padding]}
    ${isHoverable ? 'transition-shadow hover:shadow-lg dark:hover:shadow-dark' : ''}
    ${onClick ? 'cursor-pointer' : ''}
    ${className}
  `;

  // Si hay un onClick, utilizamos motion para animación
  if (onClick) {
    return (
      <motion.div
        className={cardClasses}
        onClick={onClick}
        whileHover={{ scale: isHoverable ? 1.01 : 1 }}
        whileTap={{ scale: 0.99 }}
      >
        {children}
      </motion.div>
    );
  }

  // Si no hay onClick, retornamos un div normal
  return <div className={cardClasses}>{children}</div>;
};