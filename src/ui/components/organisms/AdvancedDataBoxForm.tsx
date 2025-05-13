import React, { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { 
  DocumentTextIcon, 
  DocumentArrowUpIcon, 
  ExclamationCircleIcon, 
  CheckCircleIcon, 
  XMarkIcon 
} from '@heroicons/react/24/outline';
import { Casilla, Instalacion } from '../../../types';
import { Button } from '../../components';
import Prism from 'prismjs';
import 'prismjs/components/prism-yaml';
import 'prismjs/themes/prism.css';
import styled from 'styled-components';

// Definir propiedades para elementos con estado activo
interface ActiveProps {
  $active: boolean;
}

// Componentes estilizados
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
  overflow: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  z-index: 50;
`;

const DialogBox = styled(Dialog.Panel)`
  width: 100%;
  max-width: 700px;
  background: white;
  border-radius: 0.5rem;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.1);
  max-height: 85vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const ModalHeader = styled.div`
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const ModalTitle = styled.h3`
  font-size: 1.125rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
  flex: 1;
`;

const StatusToggle = styled.div`
  display: flex;
  align-items: center;
  margin-left: 1rem;
`;

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

const ToggleStatus = styled.span<ActiveProps>`
  font-size: 0.75rem;
  font-weight: 500;
  color: ${props => props.$active ? '#059669' : '#6b7280'};
  margin-left: 0.5rem;
`;

const TabsArea = styled.div`
  display: flex;
  border-bottom: 1px solid #e5e7eb;
`;

const Tab = styled.button<ActiveProps>`
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

const ContentArea = styled.div`
  padding: 1.25rem;
  flex: 1;
  overflow-y: auto;
  max-height: 70vh; /* Altura máxima para asegurar que quepa en la pantalla */
`;

const ContentSection = styled.div<ActiveProps>`
  display: ${props => props.$active ? 'block' : 'none'};
`;

const FormGroup = styled.div`
  margin-bottom: 1.25rem;
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

const Input = styled.input`
  width: 100%;
  padding: 0.625rem 0.75rem;
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

const FileInput = styled.input`
  display: none;
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
`;

const CodeHeader = styled.div`
  background: #f1f5f9;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid #e2e8f0;
  font-size: 0.75rem;
  font-weight: 500;
  color: #64748b;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const CodeContent = styled.pre`
  margin: 0;
  padding: 1rem;
  max-height: 400px; /* Aumentamos la altura máxima para ver más contenido */
  overflow: auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 0.875rem;
  line-height: 1.4;
  white-space: pre-wrap; /* Permite que se ajuste el texto largo */
`;

const TextArea = styled.textarea`
  width: 100%;
  min-height: 150px;
  padding: 0.625rem 0.75rem;
  border-radius: 0.375rem;
  border: 1px solid #d1d5db;
  font-size: 0.875rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  line-height: 1.4;
  resize: vertical;
  transition: all 0.2s;
  max-height: none; /* Eliminar límite máximo */

  &:focus {
    border-color: #2563eb;
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2);
    outline: none;
  }

  &.yaml-content {
    min-height: 400px; /* Altura mayor para el contenido YAML */
    height: auto; /* Permitir que se ajuste al contenido */
    overflow-y: auto; /* Asegurar scroll vertical */
    white-space: pre; /* Mantener formato de indentación */
  }
`;

const ValidationMessage = styled.div`
  margin-top: 0.75rem;
  padding: 0.75rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;

  &.loading {
    background-color: #eff6ff;
    color: #1e40af;
    border: 1px solid #dbeafe;
  }

  &.error {
    background-color: #fee2e2;
    color: #b91c1c;
    border: 1px solid #fecaca;
  }

  &.success {
    background-color: #ecfdf5;
    color: #047857;
    border: 1px solid #d1fae5;
  }
`;

const ValidationText = styled.div`
  flex: 1;
`;

const Footer = styled.div`
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  border-top: 1px solid #e5e7eb;
  background-color: #f9fafb;
  
  @media (max-width: 480px) {
    flex-direction: column-reverse;
    gap: 0.5rem;
  }
`;

interface AdvancedDataBoxFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<any>;
  dataBox?: Casilla | null;
  installations: Instalacion[];
}

export const AdvancedDataBoxForm: React.FC<AdvancedDataBoxFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  dataBox,
  installations,
}) => {
  const [formData, setFormData] = useState({
    instalacion_id: '',
    nombre: '',
    descripcion: '',
    yaml_content: '',
    api_endpoint: '',
    email_casilla: '',
    is_active: true,
  });

  const [activeTab, setActiveTab] = useState('config');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validationSuccess, setValidationSuccess] = useState(false);
  const [executionUuid, setExecutionUuid] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  // Inicializar formulario al abrir el modal
  useEffect(() => {
    if (isOpen) {
      if (dataBox && dataBox.id) {
        setIsEditMode(true);
        
        // Extraer instalacion_id, manejar posibles casos de nulidad
        const instalacionId = dataBox.instalacion_id || 
                            (dataBox.instalacion && dataBox.instalacion.id) || 
                            '';
        
        setFormData({
          instalacion_id: instalacionId.toString(),
          nombre: dataBox.nombre || '',
          descripcion: dataBox.descripcion || '',
          yaml_content: '',  // Se cargará mediante la API
          api_endpoint: dataBox.api_endpoint || '',
          email_casilla: dataBox.email_casilla || '',
          is_active: dataBox.is_active !== undefined ? dataBox.is_active : true,
        });
        
        // Cargar el contenido YAML
        fetch(`/api/data-boxes/${dataBox.id}/yaml`)
          .then(response => response.json())
          .then(data => {
            setFormData(prev => ({
              ...prev,
              yaml_content: data.content || ''
            }));
            
            setTimeout(() => Prism.highlightAll(), 100);
          })
          .catch(error => {
            console.error('Error al obtener contenido YAML:', error);
          });
      } else {
        setIsEditMode(false);
        setFormData({
          instalacion_id: '',
          nombre: '',
          descripcion: '',
          yaml_content: '',
          api_endpoint: '',
          email_casilla: '',
          is_active: true,
        });
      }

      setSelectedFile(null);
      setActiveTab('config');
      setIsValidating(false);
      setValidationError(null);
      setValidationSuccess(false);
      setExecutionUuid(null);
    }
  }, [isOpen, dataBox]);

  // Aplicar resaltado de sintaxis cuando se muestra el YAML
  useEffect(() => {
    if (formData.yaml_content && activeTab === 'config') {
      setTimeout(() => Prism.highlightAll(), 100);
    }
  }, [formData.yaml_content, activeTab]);

  // Manejar carga de archivo
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      // Establecer nombre por defecto basado en el nombre del archivo
      const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
      setFormData(prev => ({ 
        ...prev, 
        nombre: fileNameWithoutExt // Usamos el nombre sin extensión como nombre por defecto
      }));
      const content = await file.text();
      setFormData(prev => ({ ...prev, yaml_content: content }));
      setValidationError(null);
      setValidationSuccess(false);
      setTimeout(() => Prism.highlightAll(), 100);
    }
  };

  // Iniciar validación YAML
  const handleValidateYaml = async () => {
    if (!formData.yaml_content) {
      setValidationError('No hay contenido YAML para validar');
      return;
    }

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

      if (data.error === 'YAML validation failed') {
        setValidationError(data.details || 'Error en la validación del YAML');
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || 'Error en la solicitud');
      }

      setValidationSuccess(true);
    } catch (error: any) {
      console.error('Error validating:', error);
      setValidationError(
        error.message || 'Error al procesar la solicitud'
      );
    } finally {
      setIsValidating(false);
    }
  };

  // Finalizar proceso y crear/actualizar casilla
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validar datos
    if (!formData.instalacion_id) {
      alert('Por favor selecciona una instalación');
      return;
    }
    
    if (!formData.nombre) {
      alert('Por favor ingresa un nombre para la casilla');
      return;
    }
    
    if (!formData.yaml_content && !isEditMode) {
      alert('Por favor ingresa contenido YAML');
      return;
    }
    
    if (activeTab === 'config' && !validationSuccess && !isEditMode) {
      alert('Por favor valida el YAML antes de guardar');
      return;
    }
    
    try {
      // Preparar el nombre del archivo YAML si es necesario
      // (para compatibilidad con el código legacy que aún usa nombre_yaml)
      const yamlFilename = formData.nombre.endsWith('.yaml') 
        ? formData.nombre 
        : `${formData.nombre}.yaml`;
        
      const result = await onSubmit({
        instalacion_id: parseInt(formData.instalacion_id),
        nombre: formData.nombre,
        descripcion: formData.descripcion,
        nombre_yaml: yamlFilename, // Para compatibilidad con código legacy
        yaml_contenido: formData.yaml_content,
        api_endpoint: formData.api_endpoint || undefined,
        email_casilla: formData.email_casilla || undefined,
        is_active: formData.is_active,
      });
      
      if (result && result.executionUuid) {
        setExecutionUuid(result.executionUuid);
      }
      
      // Mostrar un mensaje de éxito y esperar confirmación del usuario
      alert(isEditMode ? 'Casilla actualizada correctamente' : 'Casilla creada correctamente');
      onClose();
    } catch (error: any) {
      console.error('Error submitting:', error);
      alert(error.message || 'Error al procesar la casilla');
    }
  };

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
              {isEditMode 
                ? (formData.nombre || `Editar casilla`) 
                : 'Nueva Casilla de Datos'}
              {isEditMode && (
                <div style={{ 
                  fontSize: '0.8rem', 
                  color: '#6b7280', 
                  fontWeight: 'normal', 
                  marginTop: '0.25rem',
                  maxWidth: '80%'
                }}>
                  {formData.descripcion ? (
                    <span className="block mb-1" style={{ fontStyle: 'italic' }}>
                      {formData.descripcion}
                    </span>
                  ) : null}
                  {dataBox?.instalacion && (
                    <span className="block">
                      {dataBox.instalacion.nombre}
                    </span>
                  )}
                </div>
              )}
            </ModalTitle>
            
            <div className="flex items-center">
              {isEditMode && (
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
              )}
              <button
                onClick={onClose}
                className="ml-2 text-gray-400 hover:text-gray-500"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
          </ModalHeader>

          <TabsArea>
            <Tab 
              $active={activeTab === 'config'} 
              onClick={() => setActiveTab('config')}
            >
              Configuración YAML
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
              {!isEditMode && (
                <FormGroup>
                  <FormRow>
                    <FormField>
                      <FieldLabel>Instalación <span className="text-red-500">*</span></FieldLabel>
                      <select
                        className="w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        value={formData.instalacion_id}
                        onChange={(e) => setFormData({ ...formData, instalacion_id: e.target.value })}
                        required
                      >
                        <option value="">Seleccione una instalación</option>
                        {installations.map((installation) => (
                          <option key={installation.id} value={installation.id}>
                            {installation.nombre}
                          </option>
                        ))}
                      </select>
                    </FormField>
                  </FormRow>
                </FormGroup>
              )}

              <FormGroup>
                <FieldLabel>Nombre de la casilla <span className="text-red-500">*</span></FieldLabel>
                <Input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  placeholder="Nombre de la casilla"
                  required
                />
              </FormGroup>
              
              <FormGroup>
                <FieldLabel>Descripción <OptionalTag>(opcional)</OptionalTag></FieldLabel>
                <TextArea
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  placeholder="Breve descripción de la casilla"
                  style={{ height: '80px' }}
                />
              </FormGroup>

              <FormGroup>
                <ButtonGroup>
                  <FileInput
                    type="file"
                    accept=".yaml,.yml"
                    onChange={handleFileChange}
                    id="yaml-file"
                  />
                  <Button
                    variant="outline"
                    onClick={() => document.getElementById('yaml-file')?.click()}
                    type="button"
                    icon={<DocumentArrowUpIcon className="h-5 w-5" />}
                  >
                    {selectedFile ? 'Cambiar archivo' : 'Seleccionar archivo'}
                  </Button>

                  {(formData.yaml_content || isEditMode) && (
                    <Button
                      variant="outline"
                      onClick={handleValidateYaml}
                      type="button"
                      isLoading={isValidating}
                      icon={<DocumentTextIcon className="h-5 w-5" />}
                    >
                      Validar YAML
                    </Button>
                  )}
                </ButtonGroup>
                
                {selectedFile && (
                  <HelperText>
                    Archivo seleccionado: {selectedFile.name}
                  </HelperText>
                )}
              </FormGroup>

              {/* Editor y visualización YAML */}
              {(isEditMode || formData.yaml_content) && (
                <FormGroup>
                  <FieldLabel>Contenido YAML <span className="text-red-500">*</span></FieldLabel>
                  <TextArea
                    className="yaml-content"
                    value={formData.yaml_content}
                    onChange={(e) => setFormData({ ...formData, yaml_content: e.target.value })}
                    placeholder="Ingresa o pega el contenido YAML aquí..."
                    required
                  />
                </FormGroup>
              )}

              {/* Previsualización YAML */}
              {formData.yaml_content && (
                <YamlPreview>
                  <CodeViewer>
                    <CodeHeader>
                      <span>Previsualización YAML</span>
                    </CodeHeader>
                    <CodeContent>
                      <code className="language-yaml">
                        {formData.yaml_content}
                      </code>
                    </CodeContent>
                  </CodeViewer>
                </YamlPreview>
              )}

              {/* Mensajes de validación */}
              {isValidating && (
                <ValidationMessage className="loading">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-700"></div>
                  <ValidationText>Validando YAML...</ValidationText>
                </ValidationMessage>
              )}

              {validationError && (
                <ValidationMessage className="error">
                  <ExclamationCircleIcon className="h-5 w-5" />
                  <ValidationText>{validationError}</ValidationText>
                </ValidationMessage>
              )}

              {validationSuccess && (
                <ValidationMessage className="success">
                  <CheckCircleIcon className="h-5 w-5" />
                  <ValidationText>
                    ¡YAML validado correctamente!
                    {executionUuid && (
                      <div className="mt-1 text-xs">
                        Log disponible en: <a href={`/api/executions/${executionUuid}/log`} target="_blank" rel="noopener noreferrer" className="underline">
                          ./executions/{executionUuid}/log
                        </a>
                      </div>
                    )}
                  </ValidationText>
                </ValidationMessage>
              )}
            </ContentSection>

            {/* Sección de API y Notificaciones */}
            <ContentSection $active={activeTab === 'notifications'}>
              <FormGroup>
                <FieldLabel>API Endpoint <OptionalTag>(opcional)</OptionalTag></FieldLabel>
                <Input
                  type="text"
                  value={formData.api_endpoint}
                  onChange={(e) => setFormData({ ...formData, api_endpoint: e.target.value })}
                  placeholder="https://api.ejemplo.com/webhook"
                />
                <HelperText>
                  URL a la que se enviarán notificaciones cuando se procese un archivo.
                </HelperText>
              </FormGroup>

              <FormGroup>
                <FieldLabel>Email de notificación <OptionalTag>(opcional)</OptionalTag></FieldLabel>
                <Input
                  type="email"
                  value={formData.email_casilla}
                  onChange={(e) => setFormData({ ...formData, email_casilla: e.target.value })}
                  placeholder="notifications@ejemplo.com"
                />
                <HelperText>
                  Dirección de correo electrónico a la que se enviarán informes de procesamiento.
                </HelperText>
              </FormGroup>
            </ContentSection>
          </ContentArea>

          <Footer>
            <Button
              variant="outline"
              onClick={onClose}
              type="button"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              isLoading={isValidating}
            >
              {isEditMode ? 'Guardar cambios' : 'Crear casilla'}
            </Button>
          </Footer>
        </DialogBox>
      </DialogContainer>
    </Dialog>
  );
};