import { useState, useEffect } from 'react';
import { 
  Card, 
  Text, 
  Button, 
  Textarea,
  Grid,
  Metric,
  Title,
  Divider
} from "@tremor/react";
import { 
  CodeBracketIcon, 
  DocumentTextIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline';
import Prism from 'prismjs';
import 'prismjs/components/prism-yaml';
import 'prismjs/themes/prism.css';

export const YAMLStudioConfigPanel = () => {
  const [aiPrompt, setAiPrompt] = useState('');
  const [yamlSpec, setYamlSpec] = useState('');
  const [loadingPrompt, setLoadingPrompt] = useState(true);
  const [loadingSpec, setLoadingSpec] = useState(true);
  const [updatingPrompt, setUpdatingPrompt] = useState(false);
  const [updatingSpec, setUpdatingSpec] = useState(false);
  const [successPrompt, setSuccessPrompt] = useState(false);
  const [successSpec, setSuccessSpec] = useState(false);
  const [errorPrompt, setErrorPrompt] = useState(null);
  const [errorSpec, setErrorSpec] = useState(null);

  useEffect(() => {
    // Cargar el prompt maestro
    fetchAiPrompt();
    // Cargar la documentación YAML
    fetchYamlSpec();
  }, []);

  // Aplicar resaltado de sintaxis cuando el contenido cambie
  useEffect(() => {
    Prism.highlightAll();
  }, [aiPrompt, yamlSpec]);

  const fetchAiPrompt = async () => {
    setLoadingPrompt(true);
    try {
      const response = await fetch('/api/yaml-studio/prompt');
      if (response.ok) {
        const data = await response.json();
        setAiPrompt(data.content);
      } else {
        throw new Error('Error al cargar el prompt maestro');
      }
    } catch (error) {
      console.error('Error fetching AI prompt:', error);
      setErrorPrompt(error.message);
    } finally {
      setLoadingPrompt(false);
    }
  };

  const fetchYamlSpec = async () => {
    setLoadingSpec(true);
    try {
      const response = await fetch('/api/yaml-studio/spec');
      if (response.ok) {
        const data = await response.json();
        setYamlSpec(data.content);
      } else {
        throw new Error('Error al cargar la especificación YAML');
      }
    } catch (error) {
      console.error('Error fetching YAML spec:', error);
      setErrorSpec(error.message);
    } finally {
      setLoadingSpec(false);
    }
  };

  const updateAiPrompt = async () => {
    setUpdatingPrompt(true);
    setSuccessPrompt(false);
    setErrorPrompt(null);
    
    try {
      const response = await fetch('/api/yaml-studio/prompt', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: aiPrompt }),
      });

      if (!response.ok) {
        throw new Error('Error al actualizar el prompt maestro');
      }

      setSuccessPrompt(true);
      setTimeout(() => setSuccessPrompt(false), 3000);
    } catch (error) {
      console.error('Error updating AI prompt:', error);
      setErrorPrompt(error.message);
    } finally {
      setUpdatingPrompt(false);
    }
  };

  const updateYamlSpec = async () => {
    setUpdatingSpec(true);
    setSuccessSpec(false);
    setErrorSpec(null);
    
    try {
      const response = await fetch('/api/yaml-studio/spec', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: yamlSpec }),
      });

      if (!response.ok) {
        throw new Error('Error al actualizar la especificación YAML');
      }

      setSuccessSpec(true);
      setTimeout(() => setSuccessSpec(false), 3000);
    } catch (error) {
      console.error('Error updating YAML spec:', error);
      setErrorSpec(error.message);
    } finally {
      setUpdatingSpec(false);
    }
  };

  return (
    <div className="space-y-6">
      <Text>Configuración de YAML Studio</Text>
      
      <Grid numItems={1} className="gap-6">
        {/* Prompt Maestro */}
        <Card className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <CodeBracketIcon className="h-5 w-5 text-blue-500" />
              <Text className="font-medium">Prompt Maestro YAML Studio</Text>
            </div>
            <div className="flex items-center gap-2">
              {loadingPrompt ? (
                <ArrowPathIcon className="h-5 w-5 text-gray-400 animate-spin" />
              ) : (
                <Button 
                  size="xs"
                  onClick={updateAiPrompt}
                  loading={updatingPrompt}
                  icon={successPrompt ? CheckCircleIcon : undefined}
                  color={successPrompt ? "green" : "blue"}
                >
                  {successPrompt ? "Guardado" : "Guardar cambios"}
                </Button>
              )}
            </div>
          </div>
          
          <Text className="text-sm text-gray-500">
            Este prompt controla cómo se generan los YAMLs en YAML Studio. Los cambios afectarán a todas las generaciones futuras.
          </Text>
          
          {errorPrompt && (
            <div className="p-2 bg-red-50 border border-red-200 rounded-md">
              <Text className="text-sm text-red-600">{errorPrompt}</Text>
            </div>
          )}
          
          {loadingPrompt ? (
            <div className="h-60 flex items-center justify-center">
              <ArrowPathIcon className="h-8 w-8 text-gray-400 animate-spin" />
            </div>
          ) : (
            <Textarea
              className="font-mono text-sm h-60"
              placeholder="Cargando prompt maestro..."
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
            />
          )}
        </Card>
        
        {/* Documentación YAML */}
        <Card className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <DocumentTextIcon className="h-5 w-5 text-blue-500" />
              <Text className="font-medium">Especificación del formato YAML</Text>
            </div>
            <div className="flex items-center gap-2">
              {loadingSpec ? (
                <ArrowPathIcon className="h-5 w-5 text-gray-400 animate-spin" />
              ) : (
                <Button 
                  size="xs"
                  onClick={updateYamlSpec}
                  loading={updatingSpec}
                  icon={successSpec ? CheckCircleIcon : undefined}
                  color={successSpec ? "green" : "blue"}
                >
                  {successSpec ? "Guardado" : "Guardar cambios"}
                </Button>
              )}
            </div>
          </div>
          
          <Text className="text-sm text-gray-500">
            Esta documentación define las reglas y estructura que deben seguir los archivos YAML en el sistema.
          </Text>
          
          {errorSpec && (
            <div className="p-2 bg-red-50 border border-red-200 rounded-md">
              <Text className="text-sm text-red-600">{errorSpec}</Text>
            </div>
          )}
          
          {loadingSpec ? (
            <div className="h-60 flex items-center justify-center">
              <ArrowPathIcon className="h-8 w-8 text-gray-400 animate-spin" />
            </div>
          ) : (
            <Textarea
              className="font-mono text-sm h-60"
              placeholder="Cargando especificación YAML..."
              value={yamlSpec}
              onChange={(e) => setYamlSpec(e.target.value)}
            />
          )}
        </Card>
      </Grid>
    </div>
  );
};