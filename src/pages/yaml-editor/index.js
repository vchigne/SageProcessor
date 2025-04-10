import { useState, useRef } from 'react'
import { Card, Title, Tab, TabList, TabGroup, TabPanel, TabPanels, Divider, TextInput, Textarea, Button } from "@tremor/react"
import Head from 'next/head'
import Link from 'next/link'
import { toast } from 'react-toastify'

// Componentes básicos para el editor YAML
const YAMLEditor = () => {
  const [yaml, setYaml] = useState(`# Configuración YAML para SAGE
sage_yaml:
  name: "Configuración SAGE para Proyecto"
  description: "Especificación YAML para validación de datos"
  version: "1.0.0"
  author: "SAGE"
  comments: "Generado por SAGE YAML Editor"

# Catálogos (definiciones de archivos y campos)
catalogs:
  - name: "Catálogo1"
    file_format:
      type: "CSV"
      delimiter: "|"
      header: true
    fields:
      - name: "campo1"
        type: "string"
        required: true
      - name: "campo2"
        type: "numeric"
        required: false

# Paquete principal (define estructura de archivos)
package:
  name: "Paquete Principal"
  description: "Configuración de validación para archivos de datos"
  file_format:
    type: "ZIP"
  catalogs:
    - "Catálogo1"
`)
  const [name, setName] = useState("Configuración SAGE para Proyecto")
  const [description, setDescription] = useState("Especificación YAML para validación de datos")
  const [activeTab, setActiveTab] = useState('editor')
  const fileInputRef = useRef(null)

  const handleImportYaml = () => {
    fileInputRef.current.click()
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (!file.name.endsWith('.yaml') && !file.name.endsWith('.yml')) {
      toast.error('Por favor selecciona un archivo YAML (.yaml o .yml)')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const content = event.target.result
        setYaml(content)
        toast.success('YAML importado correctamente')
      } catch (error) {
        toast.error('Error al importar el YAML: ' + error.message)
      }
    }
    reader.readAsText(file)
  }

  const handleExportYaml = () => {
    const blob = new Blob([yaml], { type: 'text/yaml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${name.replace(/\s+/g, '_').toLowerCase()}.yaml`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('YAML exportado correctamente')
  }

  return (
    <>
      <Head>
        <title>YAML Editor - SAGE</title>
      </Head>
      
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b py-4 shadow-sm">
          <div className="container mx-auto px-4 flex items-center justify-between">
            <div className="flex items-center">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-7 w-7 text-indigo-600 mr-2" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
              <h1 className="text-xl font-semibold">SAGE YAML Editor</h1>
            </div>
            <Link 
              href="/"
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 hover:text-indigo-600 focus:outline-none"
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-4 w-4 mr-2" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <path d="M19 12H5"></path>
                <path d="M12 19l-7-7 7-7"></path>
              </svg>
              Volver a SAGE
            </Link>
          </div>
        </header>

        <main className="container mx-auto px-4 py-6">
          <Card className="p-0">
            <div className="p-4 flex justify-between items-center border-b">
              <Title>Editor de YAML</Title>
              <div className="flex space-x-2">
                <input
                  type="file"
                  accept=".yaml,.yml"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                />
                <Button 
                  size="xs" 
                  variant="secondary"
                  onClick={handleImportYaml}
                >
                  Importar YAML
                </Button>
                <Button 
                  size="xs" 
                  variant="primary"
                  onClick={handleExportYaml}
                >
                  Exportar YAML
                </Button>
              </div>
            </div>
            
            <TabGroup 
              defaultValue="editor"
              onValueChange={setActiveTab}
              className="p-4"
            >
              <TabList>
                <Tab value="editor">Editor</Tab>
                <Tab value="metadata">Metadatos</Tab>
              </TabList>
              
              <TabPanels>
                <TabPanel>
                  <div className="mt-4">
                    <Textarea
                      className="font-mono text-sm h-[70vh]"
                      value={yaml}
                      onChange={(e) => setYaml(e.target.value)}
                    />
                  </div>
                </TabPanel>
                
                <TabPanel>
                  <div className="mt-4 space-y-4">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                        Nombre
                      </label>
                      <TextInput
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Nombre del YAML"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                        Descripción
                      </label>
                      <Textarea
                        id="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Descripción del YAML"
                      />
                    </div>
                    
                    <Divider />
                    
                    <div className="bg-gray-50 p-4 rounded-md">
                      <h3 className="text-sm font-medium text-gray-700 mb-2">Guía de uso</h3>
                      <p className="text-sm text-gray-500">
                        El editor YAML permite crear y modificar configuraciones para SAGE.
                        Puedes editar directamente el código YAML o utilizar la sección de metadatos
                        para modificar los campos principales.
                      </p>
                    </div>
                  </div>
                </TabPanel>
              </TabPanels>
            </TabGroup>
          </Card>
        </main>
      </div>
    </>
  )
}

export default YAMLEditor