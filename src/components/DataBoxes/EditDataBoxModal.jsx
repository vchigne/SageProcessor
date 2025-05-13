import React, { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { Button } from '@tremor/react';
import { DocumentTextIcon, ExclamationCircleIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import Prism from 'prismjs';
import 'prismjs/components/prism-yaml';
import 'prismjs/themes/prism.css';
import styled from 'styled-components';
import YamlTempEditor from '../YamlTempEditor';

// Diseño completamente reimaginado con estilo moderno y eficiente
const DialogOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(17, 24, 39, 0.7);
  backdrop-filter: blur(2px);
  z-index: 40;
`;

const DialogContainer = styled.div`
  position: fixed;
  inset: 0;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 0.5rem;
  z-index: 50;
`;

const DialogBox = styled(Dialog.Panel)`
  width: 100%;
  max-width: 700px;
  background: white;
  border-radius: 0.75rem;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.1);
  max-height: 95vh;
  overflow: auto;
  display: flex;
  flex-direction: column;
  margin: 1rem auto;
  border: 1px solid #e5e7eb;
  
  @media (prefers-color-scheme: dark) {
    background: #1e1e1e;
    border-color: #374151;
    color: #f3f4f6;
  }
`;

const ModalHeader = styled.div`
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: #f9fafb;
  
  @media (prefers-color-scheme: dark) {
    background-color: #2d3748;
    border-color: #4a5568;
  }
`;

const ModalTitle = styled.h3`
  font-size: 1.125rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
  flex: 1;
`;

// Eliminados los componentes innecesarios que ya no se usan

const StatusToggle = styled.div`
  display: flex;
  align-items: center;
  margin-left: 1rem;
`;

// Ya no necesitamos la etiqueta de texto
// const ToggleLabel = styled.span`
//   font-size: 0.875rem;
//   font-weight: 500;
//   color: #4b5563;
//   margin-right: 0.75rem;
// `;

const ToggleSwitch = styled.div`
  position: relative;
  display: inline-block;
  width: 2.5rem;
  height: 1.25rem;
`;

const ToggleInput = styled.input`
  opacity: 0;
  width: 0;
  height: 0;
  
  &:checked + span {
    background-color: #10b981;
  }
  
  &:checked + span:before {
    transform: translateX(1.25rem);
  }
`;

const ToggleSlider = styled.span`
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #e5e7eb;
  transition: 0.4s;
  border-radius: 1rem;
  
  &:before {
    position: absolute;
    content: "";
    height: 1rem;
    width: 1rem;
    left: 0.125rem;
    bottom: 0.125rem;
    background-color: white;
    transition: 0.4s;
    border-radius: 50%;
  }
`;

const ToggleStatus = styled.span`
  font-size: 0.75rem;
  font-weight: 500;
  color: ${props => props.$active ? '#059669' : '#6b7280'};
  margin-left: 0.5rem;
`;

// Ya no necesitamos este componente
// const MainContent = styled.div`
//   display: flex;
//   flex-direction: column;
//   max-height: 85vh;
//   overflow: hidden;
// `;

const TabsArea = styled.div`
  display: flex;
  border-bottom: 1px solid #e5e7eb;
`;

const Tab = styled.button`
  flex: 1;
  text-align: center;
  padding: 1rem 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: ${props => props.$active ? '#2563eb' : '#6b7280'};
  border-bottom: 2px solid ${props => props.$active ? '#2563eb' : 'transparent'};
  background: transparent;
  border-left: none;
  border-right: none;
  border-top: none;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    color: ${props => props.$active ? '#2563eb' : '#4b5563'};
    background: ${props => props.$active ? 'rgba(37, 99, 235, 0.05)' : 'rgba(243, 244, 246, 0.5)'};
  }
`;

const YamlEditor = styled.textarea`
  width: 100%;
  height: 350px;
  max-height: 50vh;
  padding: 1rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 0.9rem;
  line-height: 1.6;
  resize: vertical;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
  background-color: #f8fafc;
  color: #334155;
  tab-size: 2;
  white-space: pre;
  overflow-wrap: normal;
  overflow-x: auto;
  margin-bottom: 1rem;
  
  &:focus {
    outline: none;
    border-color: #2563eb;
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2);
  }
  
  @media (prefers-color-scheme: dark) {
    background-color: #1a202c;
    color: #e2e8f0;
    border-color: #4a5568;
  }
`;

const ContentArea = styled.div`
  padding: 1.5rem;
  flex: 1;
  overflow-y: auto;
  background-color: #ffffff;
  
  @media (prefers-color-scheme: dark) {
    background-color: #1e1e1e;
  }
`;

const ContentSection = styled.div`
  display: ${props => props.$active ? 'block' : 'none'};
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  text-align: center;
  color: #6b7280;
`;

const EmptyIcon = styled.div`
  background: #f3f4f6;
  border-radius: 50%;
  width: 3rem;
  height: 3rem;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1rem;

  svg {
    width: 1.5rem;
    height: 1.5rem;
    color: #4b5563;
  }
`;

const EmptyText = styled.p`
  margin: 0 0 1rem 0;
  font-size: 0.9375rem;
`;

const FileInput = styled.input`
  display: none;
`;

const FormGroup = styled.div`
  margin-bottom: 1rem;
  &:last-child {
    margin-bottom: 0.5rem;
  }
`;

const FormRow = styled.div`
  display: flex;
  gap: 1rem;
  margin-bottom: 1.25rem;

  @media (max-width: 640px) {
    flex-direction: column;
    gap: 1rem;
  }
`;

const FormField = styled.div`
  flex: 1;
`;

const FieldLabel = styled.label`
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  margin-bottom: 0.375rem;
`;

const OptionalTag = styled.span`
  color: #9ca3af;
  font-size: 0.75rem;
  font-weight: normal;
  margin-left: 0.25rem;
`;

const InputWrapper = styled.div`
  position: relative;
`;

const Input = styled.input`
  width: 100%;
  padding: ${props => props.$hasIcon ? '0.625rem 0.75rem 0.625rem 2.25rem' : '0.625rem 0.75rem'};
  border-radius: 0.375rem;
  border: 1px solid #d1d5db;
  font-size: 0.875rem;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  background: white;
  transition: all 0.2s;

  &:focus {
    border-color: #2563eb;
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2);
    outline: none;
  }

  &::placeholder {
    color: #9ca3af;
  }
`;

const InputIcon = styled.div`
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  display: flex;
  align-items: center;
  padding-left: 0.75rem;
  pointer-events: none;

  svg {
    width: 1rem;
    height: 1rem;
    color: #6b7280;
  }
`;

const HelperText = styled.p`
  font-size: 0.75rem;
  color: #6b7280;
  margin: 0.375rem 0 0 0;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
`;

const StyledButton = styled(Button)`
  padding: 0.5rem 0.75rem !important;
  font-size: 0.875rem !important;
  font-weight: 500 !important;
  height: auto !important;
  display: flex !important;
  align-items: center !important;
  gap: 0.375rem !important;
  
  svg {
    width: 1rem !important;
    height: 1rem !important;
  }
`;

const YamlPreview = styled.div`
  margin-top: 1rem;
`;

const CodeViewer = styled.div`
  border-radius: 0.375rem;
  border: 1px solid #e2e8f0;
  overflow: hidden;
  background: #f8fafc;
  margin-top: 0.75rem;
  margin-bottom: 1rem;
  max-width: 100%;
  width: 100%;
`;

const CodeHeader = styled.div`
  background: #f1f5f9;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #e2e8f0;
  font-size: 0.875rem;
  font-weight: 600;
  color: #334155;
  display: flex;
  align-items: center;
  justify-content: space-between;
  
  span.text-xs {
    color: #64748b;
    font-size: 0.75rem;
    font-weight: 500;
  }
`;

const CodeContent = styled.pre`
  margin: 0;
  padding: 1rem;
  max-height: 600px;
  overflow: auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 0.875rem;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  background-color: #f8fafb;
  
  code {
    display: block;
    width: 100%;
  }
`;

const ValidationMessage = styled.div`
  margin-top: 1rem;
  margin-bottom: 1rem;
  padding: 1rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  line-height: 1.5;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);

  &.loading {
    background-color: #eff6ff;
    color: #1e40af;
    border: 1px solid #bfdbfe;
  }

  &.error {
    background-color: #fee2e2;
    color: #b91c1c;
    border: 1px solid #fca5a5;
    font-weight: 500;
  }

  &.success {
    background-color: #ecfdf5;
    color: #047857;
    border: 1px solid #a7f3d0;
    font-weight: 500;
  }
`;

const StatusIcon = styled.div`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  
  svg {
    width: 1.25rem;
    height: 1.25rem;
  }
  
  .loading & svg {
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
`;

const ValidationText = styled.div`
  flex: 1;
  line-height: 1.5;
  
  .error & {
    white-space: pre-line;
  }
  
  .success & {
    font-weight: 600;
  }
`;

const Footer = styled.div`
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 0.75rem;
  padding: 1.25rem 1.5rem;
  border-top: 1px solid #e5e7eb;
  background-color: #f9fafb;
  border-radius: 0 0 0.75rem 0.75rem;
  
  @media (max-width: 480px) {
    flex-direction: column-reverse;
    gap: 0.5rem;
  }
  
  @media (prefers-color-scheme: dark) {
    background-color: #2d3748;
    border-color: #4a5568;
  }
`;

const SaveButton = styled.button`
  background-color: #2563eb !important;
  color: white !important;
  font-weight: 500 !important;
  padding: 0.5rem 1rem !important;
  border-radius: 0.375rem !important;
  border: none !important;
  cursor: pointer !important;
  font-size: 0.875rem !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  transition: background-color 0.2s !important;
  min-width: 120px !important;
  
  &:hover {
    background-color: #1d4ed8 !important;
  }
  
  &:disabled {
    background-color: #93c5fd !important;
    cursor: not-allowed !important;
  }
`;

const CancelButton = styled.button`
  background-color: #fee2e2 !important;
  color: #dc2626 !important;
  font-weight: 500 !important;
  padding: 0.5rem 1rem !important;
  border-radius: 0.375rem !important;
  border: 1px solid #fecaca !important;
  cursor: pointer !important;
  font-size: 0.875rem !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  transition: all 0.2s !important;
  min-width: 120px !important;
  
  &:hover {
    background-color: #fecaca !important;
  }
`;

export const EditDataBoxModal = ({
  isOpen,
  onClose,
  dataBox,
  onSubmit,
}) => {
  const [formData, setFormData] = useState({
    nombre_yaml: '',
    yaml_content: '',
    api_endpoint: '',
    email_casilla: '',
    is_active: true,
  });

  const [activeTab, setActiveTab] = useState('config');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState(null);
  const [validationSuccess, setValidationSuccess] = useState(false);
  const [executionUuid, setExecutionUuid] = useState(null);
  const [nombreHumano, setNombreHumano] = useState('');
  const [descripcion, setDescripcion] = useState('');

  useEffect(() => {
    if (isOpen && dataBox) {
      setFormData({
        nombre_yaml: dataBox.nombre_yaml,
        yaml_content: '',
        api_endpoint: dataBox.api_endpoint || '',
        email_casilla: dataBox.email_casilla || '',
        is_active: dataBox.is_active,
      });
      
      // Cargar el contenido YAML
      console.log('Cargando YAML para casilla:', dataBox.id);
      fetch(`/api/data-boxes/${dataBox.id}/yaml`)
        .then(response => {
          if (!response.ok) {
            throw new Error(`Error al cargar YAML: ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          console.log('YAML cargado:', data);
          if (data && data.content) {
            setFormData(prev => ({
              ...prev,
              yaml_content: data.content
            }));
            
            setTimeout(() => Prism.highlightAll(), 100);
          } else {
            console.error('El contenido YAML está vacío o no tiene el formato esperado');
          }
        })
        .catch(error => {
          console.error('Error al cargar el contenido YAML:', error);
        });
        
      // Cargar el nombre humano del YAML
      fetch(`/api/data-boxes/${dataBox.id}/nombre-humano`)
        .then(response => response.json())
        .then(data => {
          setNombreHumano(data.nombre_humano || '');
          setDescripcion(data.descripcion || '');
        })
        .catch(error => {
          console.error('Error al obtener nombre humano:', error);
        });
    }
  }, [isOpen, dataBox]);

  useEffect(() => {
    if (formData.yaml_content) {
      setTimeout(() => Prism.highlightAll(), 100);
    }
  }, [formData.yaml_content, activeTab]);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const content = await file.text();
      setFormData(prev => ({ ...prev, yaml_content: content }));
      setValidationError(null);
      setValidationSuccess(false);
      setTimeout(() => Prism.highlightAll(), 100);
    }
  };

  const handleValidateYaml = async () => {
    setIsValidating(true);
    setValidationError(null);
    setValidationSuccess(false);

    try {
      const response = await fetch('/api/validate-yaml', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ yaml_content: formData.yaml_content }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error en la solicitud');
      }

      setValidationSuccess(true);
    } catch (error) {
      console.error('Error validating:', error);
      setValidationError(
        error.message || 'Error al validar YAML'
      );
    } finally {
      setIsValidating(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!dataBox) return;

    // No permitir guardar si no hay contenido YAML
    if (!formData.yaml_content) {
      setValidationError('El contenido YAML no puede estar vacío');
      return;
    }

    // Validar el YAML primero
    setIsValidating(true);
    setValidationError(null);
    setValidationSuccess(false);
    
    try {
      // Primero validamos el YAML
      const validateResponse = await fetch('/api/validate-yaml', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ yaml_content: formData.yaml_content }),
      });
      
      if (!validateResponse.ok) {
        const errorData = await validateResponse.json();
        throw new Error(errorData.error || 'Error al validar YAML');
      }
      
      // Si la validación es exitosa, crear un respaldo
      try {
        await fetch('/api/temp-yaml/write', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            yaml_content: formData.yaml_content,
            backup_name: `backup_${dataBox.id}_${Date.now()}.yaml`
          }),
        });
        console.log('Backup del YAML creado correctamente');
      } catch (backupError) {
        console.warn('No se pudo crear backup:', backupError);
      }
      
      // Solicitar confirmación
      const confirmar = window.confirm(
        '¿Estás seguro de guardar los cambios? Esta acción actualizará la configuración YAML de la casilla.'
      );
      
      if (!confirmar) {
        setIsValidating(false);
        return;
      }
      
      // Proceder con la actualización
      const response = await fetch(`/api/data-boxes/${dataBox.id}/update`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: dataBox.id,
          instalacion_id: dataBox.instalacion.id,
          nombre_yaml: formData.nombre_yaml,
          yaml_content: formData.yaml_content,
          api_endpoint: formData.api_endpoint || null,
          email_casilla: formData.email_casilla || null,
          is_active: formData.is_active,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || 'Error al actualizar la casilla');
      }

      const result = await response.json();
      console.log('Respuesta de actualización:', result);
      
      if (result.executionUuid) {
        setExecutionUuid(result.executionUuid);
      }
      
      setValidationSuccess(true);
      
      // Mostrar un mensaje de éxito
      alert('Datos guardados correctamente');
      onClose();
    } catch (error) {
      console.error('Error al procesar casilla:', error);
      setValidationError(error.message || 'Error al procesar la casilla');
    } finally {
      setIsValidating(false);
    }
  };

  if (!dataBox) return null;

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      className="relative z-50"
    >
      <DialogOverlay aria-hidden="true" />
      <DialogContainer>
        <DialogBox>
          <ModalHeader>
            <ModalTitle>
              {nombreHumano || `Editar casilla: ${dataBox.nombre_yaml}`}
              <div style={{ 
                fontSize: '0.8rem', 
                color: '#6b7280', 
                fontWeight: 'normal', 
                marginTop: '0.25rem',
                maxWidth: '80%'
              }}>
                {descripcion ? (
                  <span className="block mb-1" style={{ fontStyle: 'italic' }}>
                    {descripcion}
                  </span>
                ) : null}
                <span className="block">
                  {dataBox.instalacion.nombre} ({dataBox.nombre_yaml})
                </span>
              </div>
            </ModalTitle>
            
            <StatusToggle>
              <ToggleSwitch>
                <ToggleInput 
                  type="checkbox" 
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                />
                <ToggleSlider />
              </ToggleSwitch>
              <ToggleStatus $active={formData.is_active}>
                {formData.is_active ? 'Activo' : 'Inactivo'}
              </ToggleStatus>
            </StatusToggle>
          </ModalHeader>

          <TabsArea>
            <Tab 
              $active={activeTab === 'config'} 
              onClick={() => setActiveTab('config')}
            >
              Vista Previa
            </Tab>
            <Tab 
              $active={activeTab === 'editor'} 
              onClick={() => setActiveTab('editor')}
            >
              Editor YAML
            </Tab>
            <Tab 
              $active={activeTab === 'notifications'} 
              onClick={() => setActiveTab('notifications')}
            >
              API y Notificaciones
            </Tab>
          </TabsArea>

          <ContentArea>
            {/* Sección de Configuración YAML */}
            <ContentSection $active={activeTab === 'config'}>
              <FormGroup>
                <ButtonGroup>
                  <FileInput
                    type="file"
                    accept=".yaml,.yml"
                    onChange={handleFileChange}
                    id="yaml-file"
                  />
                  <StyledButton
                    color="blue"
                    variant="secondary"
                    onClick={() => document.getElementById('yaml-file')?.click()}
                    type="button"
                    size="xs"
                  >
                    <DocumentTextIcon />
                    Actualizar archivo YAML
                  </StyledButton>
                  <StyledButton
                    color="green"
                    variant="primary"
                    onClick={handleValidateYaml}
                    type="button"
                    size="sm"
                    disabled={!formData.yaml_content || isValidating}
                    style={{ 
                      marginLeft: '8px',
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Validar YAML
                  </StyledButton>
                </ButtonGroup>
              </FormGroup>

              {formData.yaml_content ? (
                <YamlPreview>
                  {isValidating && (
                    <ValidationMessage className="loading">
                      <StatusIcon>
                        <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      </StatusIcon>
                      <ValidationText>Validando configuración YAML...</ValidationText>
                    </ValidationMessage>
                  )}

                  {validationError && (
                    <ValidationMessage className="error">
                      <StatusIcon>
                        <ExclamationCircleIcon />
                      </StatusIcon>
                      <ValidationText>{validationError}</ValidationText>
                    </ValidationMessage>
                  )}

                  {validationSuccess && (
                    <ValidationMessage className="success">
                      <StatusIcon>
                        <CheckCircleIcon className="text-green-600" />
                      </StatusIcon>
                      <ValidationText>
                        <div>¡YAML validado correctamente!</div>
                        <div style={{ fontSize: '0.85rem', marginTop: '0.25rem', fontWeight: 'normal' }}>
                          La configuración YAML es válida y puede ser utilizada.
                        </div>
                        {executionUuid && (
                          <div style={{ fontSize: '0.85rem', marginTop: '0.5rem', fontWeight: 'bold' }}>
                            Resultados en:{' '}
                            <a 
                              href={`/api/executions/${executionUuid}/log`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 underline"
                            >
                              ./executions/{executionUuid}/
                            </a>
                          </div>
                        )}
                      </ValidationText>
                    </ValidationMessage>
                  )}

                  <CodeViewer>
                    <CodeHeader>
                      <span>Contenido del archivo YAML</span>
                      <span className="text-xs">{dataBox.nombre_yaml}</span>
                    </CodeHeader>
                    <CodeContent>
                      <code className="language-yaml">
                        {formData.yaml_content}
                      </code>
                    </CodeContent>
                  </CodeViewer>
                </YamlPreview>
              ) : (
                <EmptyState>
                  <EmptyIcon>
                    <DocumentTextIcon />
                  </EmptyIcon>
                  <EmptyText>
                    No se ha cargado ningún archivo YAML<br />
                    Sube un archivo para visualizar su contenido
                  </EmptyText>
                  <StyledButton
                    color="blue"
                    variant="secondary"
                    onClick={() => document.getElementById('yaml-file')?.click()}
                    type="button"
                    size="xs"
                  >
                    <DocumentTextIcon />
                    Subir archivo YAML
                  </StyledButton>
                </EmptyState>
              )}
            </ContentSection>

            {/* Sección de Editor de YAML */}
            <ContentSection $active={activeTab === 'editor'}>
              <FormGroup>
                <div style={{ marginBottom: '1rem' }}>
                  <strong>Editor YAML</strong>
                  <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
                    Edita directamente el contenido YAML. Los cambios se guardarán al hacer clic en "Guardar cambios".
                  </p>
                </div>
                
                <YamlTempEditor
                  initialContent={formData.yaml_content}
                  onChange={(newContent) => setFormData({ ...formData, yaml_content: newContent })}
                  height="300px"
                />
                
                <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.25rem', color: '#374151' }}>Consejos:</h4>
                    <ul style={{ fontSize: '0.8rem', color: '#6b7280', listStyleType: 'disc', paddingLeft: '1rem' }}>
                      <li>Incluye siempre la sección <code style={{ backgroundColor: '#f1f5f9', padding: '0.1rem 0.25rem', borderRadius: '0.25rem' }}>sage_yaml</code> con <code style={{ backgroundColor: '#f1f5f9', padding: '0.1rem 0.25rem', borderRadius: '0.25rem' }}>name</code> y <code style={{ backgroundColor: '#f1f5f9', padding: '0.1rem 0.25rem', borderRadius: '0.25rem' }}>description</code></li>
                      <li>Respeta la indentación con espacios (2 espacios por nivel)</li>
                      <li>Usa comillas para valores con caracteres especiales</li>
                    </ul>
                  </div>
                
                  <StyledButton
                    color="blue"
                    variant="primary"
                    onClick={handleValidateYaml}
                    type="button"
                    size="sm"
                    disabled={!formData.yaml_content || isValidating}
                    style={{ minWidth: '120px', height: '2.5rem' }}
                  >
                    {isValidating ? (
                      <>
                        <svg className="animate-spin h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Validando...
                      </>
                    ) : (
                      <>
                        <svg className="h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        Validar YAML
                      </>
                    )}
                  </StyledButton>
                </div>
                
                {validationError && (
                  <ValidationMessage className="error">
                    <StatusIcon>
                      <ExclamationCircleIcon />
                    </StatusIcon>
                    <ValidationText>
                      <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>Error en la validación:</div>
                      <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', fontSize: '0.8rem', backgroundColor: 'rgba(254, 226, 226, 0.5)', padding: '0.5rem', borderRadius: '0.25rem', overflowX: 'auto', maxHeight: '200px', overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
                        {validationError}
                      </div>
                    </ValidationText>
                  </ValidationMessage>
                )}
                
                {validationSuccess && (
                  <ValidationMessage className="success">
                    <StatusIcon>
                      <CheckCircleIcon />
                    </StatusIcon>
                    <ValidationText>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span style={{ fontWeight: 'bold', marginRight: '0.5rem' }}>¡YAML validado correctamente!</span>
                        <span style={{ fontSize: '0.8rem', color: '#059669' }}>El formato y estructura son válidos.</span>
                      </div>
                    </ValidationText>
                  </ValidationMessage>
                )}
              </FormGroup>
            </ContentSection>

            {/* Sección de API y Notificaciones */}
            <ContentSection $active={activeTab === 'notifications'}>
              <FormRow>
                <FormField>
                  <FieldLabel>
                    API Endpoint <OptionalTag>(opcional)</OptionalTag>
                  </FieldLabel>
                  <InputWrapper>
                    <Input
                      type="text"
                      placeholder="https://api.ejemplo.com/webhook"
                      value={formData.api_endpoint || ''}
                      onChange={(e) => setFormData({ ...formData, api_endpoint: e.target.value })}
                      $hasIcon
                    />
                    <InputIcon>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm3.293 1.293a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 01-1.414-1.414L7.586 10 5.293 7.707a1 1 0 010-1.414zM11 12a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                      </svg>
                    </InputIcon>
                  </InputWrapper>
                  <HelperText>
                    URL donde SAGE enviará notificaciones al procesar archivos
                  </HelperText>
                </FormField>
              </FormRow>

              <FormRow>
                <FormField>
                  <FieldLabel>
                    Email <OptionalTag>(opcional)</OptionalTag>
                  </FieldLabel>
                  <InputWrapper>
                    <Input
                      type="email"
                      placeholder="ejemplo@sage.vidahub.ai"
                      value={formData.email_casilla || ''}
                      onChange={(e) => setFormData({ ...formData, email_casilla: e.target.value })}
                      $hasIcon
                    />
                    <InputIcon>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                        <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                      </svg>
                    </InputIcon>
                  </InputWrapper>
                  <HelperText>
                    Dirección de correo para recibir notificaciones automáticas
                  </HelperText>
                </FormField>
              </FormRow>
            </ContentSection>
          </ContentArea>

          <Footer>
            <CancelButton
              onClick={onClose}
            >
              Cancelar
            </CancelButton>
            <SaveButton
              onClick={handleSubmit}
              disabled={isValidating}
            >
              {isValidating ? 'Guardando...' : 'Guardar Cambios'}
            </SaveButton>
          </Footer>
        </DialogBox>
      </DialogContainer>
    </Dialog>
  );
};