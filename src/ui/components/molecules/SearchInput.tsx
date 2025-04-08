import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';

export interface SearchInputProps {
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  onSearch?: (value: string) => void;
  className?: string;
  delay?: number;
  size?: 'sm' | 'md' | 'lg';
}

export const SearchInput: React.FC<SearchInputProps> = ({
  placeholder = 'Buscar...',
  value,
  onChange,
  onSearch,
  className = '',
  delay = 300,
  size = 'md',
}) => {
  const [localValue, setLocalValue] = useState(value);
  const [isFocused, setIsFocused] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sincronizar valor local cuando cambia el valor de prop
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Handle local input changes with debounce
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);

    // Clear any existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // Set a new timer
    timerRef.current = setTimeout(() => {
      onChange(newValue);
      
      // Trigger search if provided
      if (onSearch) {
        onSearch(newValue);
      }
    }, delay);
  };

  // Clear search input
  const handleClear = () => {
    setLocalValue('');
    onChange('');
    if (inputRef.current) {
      inputRef.current.focus();
    }

    // Trigger search if provided
    if (onSearch) {
      onSearch('');
    }
  };

  // Handle key press
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && onSearch) {
      e.preventDefault();
      onSearch(localValue);
    }
  };

  // Size classes
  const sizeClasses = {
    sm: 'h-8 text-sm',
    md: 'h-10 text-base',
    lg: 'h-12 text-lg',
  };

  return (
    <div className={`relative w-full ${className}`}>
      <div
        className={`
          flex items-center w-full rounded-lg border
          ${isFocused ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-gray-300'}
          ${sizeClasses[size]}
          bg-white overflow-hidden transition-colors duration-200
        `}
      >
        <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 ml-3 shrink-0" />
        
        <input
          ref={inputRef}
          type="text"
          value={localValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 focus:outline-none bg-transparent"
        />

        <AnimatePresence>
          {localValue && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              type="button"
              onClick={handleClear}
              className="mr-2 p-1 rounded-full hover:bg-gray-100 transition-colors duration-200"
            >
              <XMarkIcon className="w-4 h-4 text-gray-500" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};