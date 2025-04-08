import React from 'react';
import { useFormContext, Controller } from 'react-hook-form';

export interface FormFieldProps {
  name: string;
  label: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'date' | 'textarea' | 'select' | 'checkbox';
  placeholder?: string;
  helperText?: string;
  options?: { label: string; value: string | number }[];
  required?: boolean;
  disabled?: boolean;
  className?: string;
  rows?: number;
}

export const FormField: React.FC<FormFieldProps> = ({
  name,
  label,
  type = 'text',
  placeholder = '',
  helperText,
  options = [],
  required = false,
  disabled = false,
  className = '',
  rows = 3,
}) => {
  const { control, formState: { errors } } = useFormContext();
  const error = errors[name];
  const errorMessage = error ? (error.message as string) : '';

  return (
    <div className={`mb-4 ${className}`}>
      <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      <Controller
        name={name}
        control={control}
        render={({ field }) => {
          // Manejar diferentes tipos de campos
          switch (type) {
            case 'textarea':
              return (
                <textarea
                  {...field}
                  id={name}
                  placeholder={placeholder}
                  disabled={disabled}
                  rows={rows}
                  className={`w-full px-3 py-2 border rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 ${
                    error ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
              );

            case 'select':
              return (
                <select
                  {...field}
                  id={name}
                  disabled={disabled}
                  className={`w-full px-3 py-2 border rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 ${
                    error ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">{placeholder || 'Seleccionar...'}</option>
                  {options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              );

            case 'checkbox':
              return (
                <div className="flex items-center">
                  <input
                    {...field}
                    type="checkbox"
                    id={name}
                    disabled={disabled}
                    className={`h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 ${
                      error ? 'border-red-500' : ''
                    }`}
                    checked={field.value}
                  />
                  <span className="ml-2 text-sm text-gray-600">{placeholder}</span>
                </div>
              );

            default:
              return (
                <input
                  {...field}
                  type={type}
                  id={name}
                  placeholder={placeholder}
                  disabled={disabled}
                  className={`w-full px-3 py-2 border rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 ${
                    error ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
              );
          }
        }}
      />

      {/* Mensaje de error o de ayuda */}
      {error ? (
        <p className="mt-1 text-sm text-red-500">{errorMessage}</p>
      ) : helperText ? (
        <p className="mt-1 text-sm text-gray-500">{helperText}</p>
      ) : null}
    </div>
  );
};