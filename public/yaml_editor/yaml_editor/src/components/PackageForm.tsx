
import { Package, Catalog, PackageValidation, FileFormat } from "@/types/yaml";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import FormSection from "./FormSection";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";
import { PlusCircle } from "lucide-react";
import ValidationRuleForm from "./ValidationRuleForm";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface PackageFormProps {
  package: Package;
  catalogs: Catalog[];
  onChange: (updatedPackage: Package) => void;
  onDelete: () => void;
}

const PackageForm = ({ package: pkg, catalogs, onChange, onDelete }: PackageFormProps) => {
  const [isCatalogsCollapsed, setIsCatalogsCollapsed] = useState(false);
  const [isValidationCollapsed, setIsValidationCollapsed] = useState(true);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...pkg, name: e.target.value });
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange({ ...pkg, description: e.target.value });
  };

  const handleVersionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...pkg, version: e.target.value });
  };

  const handleFileFormatChange = (key: keyof FileFormat, value: any) => {
    const fileFormat = pkg.file_format || { type: "ZIP" };
    onChange({ ...pkg, file_format: { ...fileFormat, [key]: value } });
  };

  const handleCatalogToggle = (catalogName: string, isChecked: boolean) => {
    let updatedCatalogs = [...pkg.catalogs];
    
    if (isChecked && !updatedCatalogs.includes(catalogName)) {
      updatedCatalogs.push(catalogName);
    } else if (!isChecked && updatedCatalogs.includes(catalogName)) {
      updatedCatalogs = updatedCatalogs.filter(name => name !== catalogName);
    }
    
    onChange({ ...pkg, catalogs: updatedCatalogs });
  };

  const handleAddValidation = () => {
    const newValidation: PackageValidation = {
      name: "",
      description: "",
      rule: "",
      severity: "error"
    };
    
    const packageValidations = pkg.package_validation || [];
    onChange({ ...pkg, package_validation: [...packageValidations, newValidation] });
    setIsValidationCollapsed(false);
  };

  const handleValidationChange = (index: number, updatedValidation: PackageValidation) => {
    const packageValidations = [...(pkg.package_validation || [])];
    packageValidations[index] = updatedValidation;
    onChange({ ...pkg, package_validation: packageValidations });
  };

  const handleValidationDelete = (index: number) => {
    const packageValidations = [...(pkg.package_validation || [])];
    packageValidations.splice(index, 1);
    onChange({ ...pkg, package_validation: packageValidations });
  };

  return (
    <FormSection title={pkg.name || "Nuevo Paquete"}>
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4">
          <div>
            <Label htmlFor="package-name">Nombre del Paquete</Label>
            <Input
              id="package-name"
              value={pkg.name}
              onChange={handleNameChange}
              placeholder="Ingresa el nombre del paquete"
            />
          </div>
          <div>
            <Label htmlFor="package-description">Descripción</Label>
            <Textarea
              id="package-description"
              value={pkg.description || ""}
              onChange={handleDescriptionChange}
              placeholder="Ingresa la descripción del paquete"
            />
          </div>
          <div>
            <Label htmlFor="package-version">Versión</Label>
            <Input
              id="package-version"
              value={pkg.version || ""}
              onChange={handleVersionChange}
              placeholder="Ejemplo: 1.0.0"
            />
          </div>
        </div>

        <FormSection title="Formato del Archivo">
          <div className="space-y-4">
            <div>
              <Label htmlFor="pkg-file-format-type">Tipo de Archivo</Label>
              <Select
                value={pkg.file_format?.type || "ZIP"}
                onValueChange={(value) => handleFileFormatChange("type", value)}
              >
                <SelectTrigger id="pkg-file-format-type">
                  <SelectValue placeholder="Selecciona el formato" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ZIP">ZIP</SelectItem>
                  <SelectItem value="CSV">CSV</SelectItem>
                  <SelectItem value="EXCEL">EXCEL</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {pkg.file_format?.type === "CSV" && (
              <div>
                <Label htmlFor="pkg-file-format-delimiter">Delimitador</Label>
                <Input
                  id="pkg-file-format-delimiter"
                  value={pkg.file_format.delimiter || ","}
                  onChange={(e) => handleFileFormatChange("delimiter", e.target.value)}
                  placeholder=","
                />
              </div>
            )}

            <div className="flex items-center space-x-2">
              <Label htmlFor="pkg-file-format-header">¿Tiene encabezados?</Label>
              <Select
                value={pkg.file_format?.header !== undefined ? String(pkg.file_format.header) : "true"}
                onValueChange={(value) => handleFileFormatChange("header", value === "true")}
              >
                <SelectTrigger id="pkg-file-format-header" className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Sí</SelectItem>
                  <SelectItem value="false">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </FormSection>

        <FormSection
          title="Catálogos Incluidos"
          description={`${pkg.catalogs.length} catálogos incluidos`}
          onCollapse={() => setIsCatalogsCollapsed(!isCatalogsCollapsed)}
          isCollapsed={isCatalogsCollapsed}
        >
          <div className="space-y-2">
            {catalogs.length === 0 ? (
              <p className="text-sm text-gray-500">No hay catálogos creados. Crea catálogos primero.</p>
            ) : (
              catalogs.map((catalog, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <Checkbox
                    id={`catalog-${index}`}
                    checked={pkg.catalogs.includes(catalog.name)}
                    onCheckedChange={(checked) => 
                      handleCatalogToggle(catalog.name, checked === true)
                    }
                  />
                  <Label htmlFor={`catalog-${index}`}>{catalog.name}</Label>
                </div>
              ))
            )}
          </div>
        </FormSection>

        <FormSection
          title="Validaciones de Paquete"
          description={`${pkg.package_validation?.length || 0} validaciones definidas`}
          onCollapse={() => setIsValidationCollapsed(!isValidationCollapsed)}
          isCollapsed={isValidationCollapsed}
        >
          <div className="space-y-2">
            {pkg.package_validation?.map((validation, index) => (
              <ValidationRuleForm
                key={index}
                validation={validation}
                onChange={(updated) => handleValidationChange(index, updated)}
                onDelete={() => handleValidationDelete(index)}
                index={index}
                type="package"
              />
            ))}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleAddValidation}
            >
              <PlusCircle className="mr-2 h-4 w-4" /> Agregar Validación de Paquete
            </Button>
          </div>
        </FormSection>

        <div className="flex justify-end">
          <Button variant="destructive" onClick={onDelete}>
            Eliminar Paquete
          </Button>
        </div>
      </div>
    </FormSection>
  );
};

export default PackageForm;
