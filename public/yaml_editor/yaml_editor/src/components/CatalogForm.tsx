
import { Catalog, Field, FileFormat, RowValidation, CatalogValidation } from "@/types/yaml";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import FormSection from "./FormSection";
import FieldForm from "./FieldForm";
import { useState } from "react";
import { PlusCircle, FileText } from "lucide-react";
import ValidationRuleForm from "./ValidationRuleForm";

interface CatalogFormProps {
  catalog: Catalog;
  onChange: (updatedCatalog: Catalog) => void;
  onDelete: () => void;
}

const CatalogForm = ({ catalog, onChange, onDelete }: CatalogFormProps) => {
  const [isFieldsCollapsed, setIsFieldsCollapsed] = useState(false);
  const [isRowValidationCollapsed, setIsRowValidationCollapsed] = useState(true);
  const [isCatalogValidationCollapsed, setIsCatalogValidationCollapsed] = useState(true);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...catalog, name: e.target.value });
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange({ ...catalog, description: e.target.value });
  };

  const handleFilenameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...catalog, filename: e.target.value });
  };

  const handleFileFormatChange = (key: keyof FileFormat, value: any) => {
    const fileFormat = catalog.file_format || { type: "CSV" };
    onChange({ ...catalog, file_format: { ...fileFormat, [key]: value } });
  };

  const handleAddField = () => {
    const newField: Field = {
      name: "",
      type: "texto",
    };
    onChange({ ...catalog, fields: [...catalog.fields, newField] });
    setIsFieldsCollapsed(false);
  };

  const handleFieldChange = (index: number, updatedField: Field) => {
    const updatedFields = [...catalog.fields];
    updatedFields[index] = updatedField;
    onChange({ ...catalog, fields: updatedFields });
  };

  const handleFieldDelete = (index: number) => {
    const updatedFields = [...catalog.fields];
    updatedFields.splice(index, 1);
    onChange({ ...catalog, fields: updatedFields });
  };

  const handleAddRowValidation = () => {
    const newValidation: RowValidation = {
      name: "",
      description: "",
      rule: "",
      severity: "error"
    };
    
    const rowValidations = catalog.row_validation || [];
    onChange({ ...catalog, row_validation: [...rowValidations, newValidation] });
    setIsRowValidationCollapsed(false);
  };

  const handleRowValidationChange = (index: number, updatedValidation: RowValidation) => {
    const rowValidations = [...(catalog.row_validation || [])];
    rowValidations[index] = updatedValidation;
    onChange({ ...catalog, row_validation: rowValidations });
  };

  const handleRowValidationDelete = (index: number) => {
    const rowValidations = [...(catalog.row_validation || [])];
    rowValidations.splice(index, 1);
    onChange({ ...catalog, row_validation: rowValidations });
  };

  const handleAddCatalogValidation = () => {
    const newValidation: CatalogValidation = {
      name: "",
      description: "",
      rule: "",
      severity: "error"
    };
    
    const catalogValidations = catalog.catalog_validation || [];
    onChange({ ...catalog, catalog_validation: [...catalogValidations, newValidation] });
    setIsCatalogValidationCollapsed(false);
  };

  const handleCatalogValidationChange = (index: number, updatedValidation: CatalogValidation) => {
    const catalogValidations = [...(catalog.catalog_validation || [])];
    catalogValidations[index] = updatedValidation;
    onChange({ ...catalog, catalog_validation: catalogValidations });
  };

  const handleCatalogValidationDelete = (index: number) => {
    const catalogValidations = [...(catalog.catalog_validation || [])];
    catalogValidations.splice(index, 1);
    onChange({ ...catalog, catalog_validation: catalogValidations });
  };

  return (
    <FormSection title={catalog.name || "Nuevo Catálogo"}>
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4">
          <div>
            <Label htmlFor="catalog-name">Nombre del Catálogo</Label>
            <Input
              id="catalog-name"
              value={catalog.name}
              onChange={handleNameChange}
              placeholder="Ingresa el nombre del catálogo"
            />
          </div>
          <div>
            <Label htmlFor="catalog-description">Descripción</Label>
            <Textarea
              id="catalog-description"
              value={catalog.description || ""}
              onChange={handleDescriptionChange}
              placeholder="Ingresa la descripción del catálogo"
            />
          </div>
        </div>

        <FormSection title="Configuración del Archivo">
          <div className="space-y-4">
            <div>
              <Label htmlFor="catalog-filename">Nombre del Archivo</Label>
              <Input
                id="catalog-filename"
                value={catalog.filename || ""}
                onChange={handleFilenameChange}
                placeholder="Ejemplo: datos.csv"
              />
            </div>

            <div>
              <Label htmlFor="file-format-type">Tipo de Archivo</Label>
              <Select
                value={catalog.file_format?.type || "CSV"}
                onValueChange={(value) => handleFileFormatChange("type", value)}
              >
                <SelectTrigger id="file-format-type">
                  <SelectValue placeholder="Selecciona el formato" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CSV">CSV</SelectItem>
                  <SelectItem value="EXCEL">EXCEL</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {catalog.file_format?.type === "CSV" && (
              <div>
                <Label htmlFor="file-format-delimiter">Delimitador</Label>
                <Input
                  id="file-format-delimiter"
                  value={catalog.file_format.delimiter || ","}
                  onChange={(e) => handleFileFormatChange("delimiter", e.target.value)}
                  placeholder=","
                />
              </div>
            )}

            <div className="flex items-center space-x-2">
              <Label htmlFor="file-format-header">¿Tiene encabezados?</Label>
              <Select
                value={catalog.file_format?.header !== undefined ? String(catalog.file_format.header) : "true"}
                onValueChange={(value) => handleFileFormatChange("header", value === "true")}
              >
                <SelectTrigger id="file-format-header" className="w-24">
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
          title="Campos"
          description={`${catalog.fields.length} campos definidos`}
          onCollapse={() => setIsFieldsCollapsed(!isFieldsCollapsed)}
          isCollapsed={isFieldsCollapsed}
        >
          <div className="space-y-2">
            {catalog.fields.map((field, index) => (
              <FieldForm
                key={index}
                field={field}
                index={index}
                onChange={(updatedField) => handleFieldChange(index, updatedField)}
                onDelete={() => handleFieldDelete(index)}
              />
            ))}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleAddField}
            >
              <PlusCircle className="mr-2 h-4 w-4" /> Agregar Campo
            </Button>
          </div>
        </FormSection>

        <FormSection
          title="Validaciones de Fila"
          description={`${catalog.row_validation?.length || 0} validaciones definidas`}
          onCollapse={() => setIsRowValidationCollapsed(!isRowValidationCollapsed)}
          isCollapsed={isRowValidationCollapsed}
        >
          <div className="space-y-2">
            {catalog.row_validation?.map((validation, index) => (
              <ValidationRuleForm
                key={index}
                validation={validation}
                onChange={(updated) => handleRowValidationChange(index, updated)}
                onDelete={() => handleRowValidationDelete(index)}
                index={index}
                type="row"
              />
            ))}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleAddRowValidation}
            >
              <PlusCircle className="mr-2 h-4 w-4" /> Agregar Validación de Fila
            </Button>
          </div>
        </FormSection>

        <FormSection
          title="Validaciones de Catálogo"
          description={`${catalog.catalog_validation?.length || 0} validaciones definidas`}
          onCollapse={() => setIsCatalogValidationCollapsed(!isCatalogValidationCollapsed)}
          isCollapsed={isCatalogValidationCollapsed}
        >
          <div className="space-y-2">
            {catalog.catalog_validation?.map((validation, index) => (
              <ValidationRuleForm
                key={index}
                validation={validation}
                onChange={(updated) => handleCatalogValidationChange(index, updated)}
                onDelete={() => handleCatalogValidationDelete(index)}
                index={index}
                type="catalog"
              />
            ))}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleAddCatalogValidation}
            >
              <PlusCircle className="mr-2 h-4 w-4" /> Agregar Validación de Catálogo
            </Button>
          </div>
        </FormSection>

        <div className="flex justify-end">
          <Button variant="destructive" onClick={onDelete}>
            Eliminar Catálogo
          </Button>
        </div>
      </div>
    </FormSection>
  );
};

export default CatalogForm;
