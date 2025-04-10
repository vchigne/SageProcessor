
import { useState } from "react";
import { Catalog, Package, YamlConfig, SageYaml } from "@/types/yaml";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CatalogForm from "@/components/CatalogForm";
import PackageForm from "@/components/PackageForm";
import YamlPreview from "@/components/YamlPreview";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import { PlusCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import FormSection from "@/components/FormSection";
import YamlUploader from "@/components/YamlUploader";

const Index = () => {
  const [config, setConfig] = useState<YamlConfig>({
    sage_yaml: {
      name: "Configuración SAGE para Proyecto",
      description: "Especificación YAML para validación de datos",
      version: "1.0.0",
      author: "SAGE",
      comments: "Generado por SAGE YAML Editor"
    },
    catalogs: [],
    package: {
      name: "Paquete Principal",
      description: "Configuración de validación para archivos de datos",
      catalogs: [],
      file_format: { type: "ZIP" }
    }
  });
  const [activeTab, setActiveTab] = useState("editor");

  const handleSageYamlChange = (key: keyof SageYaml, value: string) => {
    const updatedSageYaml = { ...config.sage_yaml!, [key]: value };
    setConfig({
      ...config,
      sage_yaml: updatedSageYaml
    });
  };

  const handleAddCatalog = () => {
    const newCatalog: Catalog = {
      name: `Catálogo${config.catalogs.length + 1}`,
      fields: [],
      file_format: { type: "CSV", delimiter: ",", header: true }
    };
    setConfig({
      ...config,
      catalogs: [...config.catalogs, newCatalog]
    });
  };

  const handleUpdateCatalog = (index: number, updatedCatalog: Catalog) => {
    const updatedCatalogs = [...config.catalogs];
    updatedCatalogs[index] = updatedCatalog;
    setConfig({
      ...config,
      catalogs: updatedCatalogs
    });
  };

  const handleDeleteCatalog = (index: number) => {
    const catalogName = config.catalogs[index].name;
    const updatedCatalogs = [...config.catalogs];
    updatedCatalogs.splice(index, 1);
    
    // Also update packages that use this catalog
    const updatedPackage = {
      ...config.package,
      catalogs: config.package.catalogs.filter(cat => cat !== catalogName)
    };
    
    setConfig({
      ...config,
      catalogs: updatedCatalogs,
      package: updatedPackage
    });
  };

  const handleUpdatePackage = (updatedPackage: Package) => {
    setConfig({
      ...config,
      package: updatedPackage
    });
  };

  const handleYamlLoaded = (loadedConfig: YamlConfig) => {
    setConfig(loadedConfig);
    setActiveTab("editor");
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1 flex">
        <div className="hidden md:block w-64">
          <Sidebar 
            onAddCatalog={handleAddCatalog}
            catalogCount={config.catalogs.length}
          />
        </div>
        
        <div className="flex-1 p-6">
          <div className="md:hidden mb-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Sage YAML Wizard</h2>
            </div>
            <div className="flex space-x-2">
              <Button variant="outline" className="flex-1" onClick={handleAddCatalog}>
                <PlusCircle className="h-4 w-4 mr-2" /> Agregar Catálogo
              </Button>
            </div>
          </div>
          
          <Tabs defaultValue="editor" value={activeTab} onValueChange={setActiveTab}>
            <div className="flex justify-between items-center mb-4">
              <TabsList>
                <TabsTrigger value="editor">Editor</TabsTrigger>
                <TabsTrigger value="preview">Vista Previa</TabsTrigger>
              </TabsList>
              <YamlUploader onYamlLoaded={handleYamlLoaded} />
            </div>
            
            <TabsContent value="editor" className="space-y-4">
              <div className="space-y-4">
                <FormSection title="Información General">
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <Label htmlFor="sage-name">Nombre del YAML</Label>
                      <Input
                        id="sage-name"
                        value={config.sage_yaml?.name || ""}
                        onChange={(e) => handleSageYamlChange("name", e.target.value)}
                        placeholder="Nombre descriptivo del YAML"
                      />
                    </div>
                    <div>
                      <Label htmlFor="sage-description">Descripción</Label>
                      <Textarea
                        id="sage-description"
                        value={config.sage_yaml?.description || ""}
                        onChange={(e) => handleSageYamlChange("description", e.target.value)}
                        placeholder="Descripción del propósito de este YAML"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="sage-version">Versión</Label>
                        <Input
                          id="sage-version"
                          value={config.sage_yaml?.version || ""}
                          onChange={(e) => handleSageYamlChange("version", e.target.value)}
                          placeholder="Ejemplo: 1.0.0"
                        />
                      </div>
                      <div>
                        <Label htmlFor="sage-author">Autor</Label>
                        <Input
                          id="sage-author"
                          value={config.sage_yaml?.author || ""}
                          onChange={(e) => handleSageYamlChange("author", e.target.value)}
                          placeholder="Nombre del autor"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="sage-comments">Comentarios</Label>
                      <Textarea
                        id="sage-comments"
                        value={config.sage_yaml?.comments || ""}
                        onChange={(e) => handleSageYamlChange("comments", e.target.value)}
                        placeholder="Notas adicionales (opcional)"
                      />
                    </div>
                  </div>
                </FormSection>

                <div>
                  <h2 className="text-lg font-semibold mb-2">Catálogos</h2>
                  {config.catalogs.length === 0 ? (
                    <div className="text-center p-6 bg-gray-50 border border-dashed rounded-md">
                      <p className="text-gray-500 mb-4">No hay catálogos definidos</p>
                      <Button onClick={handleAddCatalog}>
                        <PlusCircle className="h-4 w-4 mr-2" /> Agregar Catálogo
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {config.catalogs.map((catalog, index) => (
                        <CatalogForm
                          key={index}
                          catalog={catalog}
                          onChange={(updatedCatalog) => handleUpdateCatalog(index, updatedCatalog)}
                          onDelete={() => handleDeleteCatalog(index)}
                        />
                      ))}
                      <Button variant="outline" onClick={handleAddCatalog}>
                        <PlusCircle className="h-4 w-4 mr-2" /> Agregar Otro Catálogo
                      </Button>
                    </div>
                  )}
                </div>
                
                <div>
                  <h2 className="text-lg font-semibold mb-2">Paquete</h2>
                  <PackageForm
                    package={config.package}
                    catalogs={config.catalogs}
                    onChange={handleUpdatePackage}
                    onDelete={() => {
                      // No se puede eliminar el paquete, solo reiniciarlo
                      const resetPackage: Package = {
                        name: "Paquete Principal",
                        catalogs: [],
                        file_format: { type: "ZIP" }
                      };
                      handleUpdatePackage(resetPackage);
                    }}
                  />
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="preview">
              <YamlPreview config={config} />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default Index;
