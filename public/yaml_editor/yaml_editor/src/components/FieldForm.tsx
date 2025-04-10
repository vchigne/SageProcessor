
import { Field, ValidationRule, DATA_TYPES } from "@/types/yaml";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Trash, PlusCircle } from "lucide-react";
import { useState } from "react";
import ValidationRuleForm from "./ValidationRuleForm";
import FormSection from "./FormSection";

interface FieldFormProps {
  field: Field;
  onChange: (updatedField: Field) => void;
  onDelete: () => void;
  index: number;
}

const FieldForm = ({ field, onChange, onDelete, index }: FieldFormProps) => {
  const [showOptions, setShowOptions] = useState(field.type === "select");
  const [newOption, setNewOption] = useState("");
  const [isValidationCollapsed, setIsValidationCollapsed] = useState(true);
  
  const handleChange = (key: keyof Field, value: any) => {
    onChange({ ...field, [key]: value });
    
    if (key === "type" && value === "select") {
      setShowOptions(true);
    } else if (key === "type" && value !== "select") {
      setShowOptions(false);
    }
  };

  const handleAddOption = () => {
    if (!newOption.trim()) return;
    const updatedOptions = [...(field.options || []), newOption];
    onChange({ ...field, options: updatedOptions });
    setNewOption("");
  };

  const handleRemoveOption = (index: number) => {
    const updatedOptions = [...(field.options || [])];
    updatedOptions.splice(index, 1);
    onChange({ ...field, options: updatedOptions });
  };
  
  const handleAddValidation = () => {
    const newValidation: ValidationRule = {
      name: "",
      description: "",
      rule: "",
      severity: "error"
    };
    
    const validationRules = field.validation_rules || [];
    onChange({ ...field, validation_rules: [...validationRules, newValidation] });
    setIsValidationCollapsed(false);
  };

  const handleValidationChange = (index: number, updatedValidation: ValidationRule) => {
    const validationRules = [...(field.validation_rules || [])];
    validationRules[index] = updatedValidation;
    onChange({ ...field, validation_rules: validationRules });
  };

  const handleValidationDelete = (index: number) => {
    const validationRules = [...(field.validation_rules || [])];
    validationRules.splice(index, 1);
    onChange({ ...field, validation_rules: validationRules });
  };

  return (
    <div className="bg-gray-50 p-4 rounded-md mb-3">
      <div className="flex justify-between mb-2">
        <h4 className="text-md font-medium">Campo {index + 1}</h4>
        <Button variant="ghost" size="sm" onClick={onDelete}>
          <Trash className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor={`field-name-${index}`}>Nombre</Label>
            <Input
              id={`field-name-${index}`}
              value={field.name}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder="Nombre del campo"
            />
          </div>
          <div>
            <Label htmlFor={`field-type-${index}`}>Tipo</Label>
            <Select
              value={field.type}
              onValueChange={(value) => handleChange("type", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona tipo" />
              </SelectTrigger>
              <SelectContent>
                {DATA_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div>
          <Label htmlFor={`field-description-${index}`}>Descripción</Label>
          <Input
            id={`field-description-${index}`}
            value={field.description || ""}
            onChange={(e) => handleChange("description", e.target.value)}
            placeholder="Descripción del campo"
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center space-x-2">
            <Switch
              id={`field-required-${index}`}
              checked={!!field.required}
              onCheckedChange={(checked) => handleChange("required", checked)}
            />
            <Label htmlFor={`field-required-${index}`}>Requerido</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id={`field-unique-${index}`}
              checked={!!field.unique}
              onCheckedChange={(checked) => handleChange("unique", checked)}
            />
            <Label htmlFor={`field-unique-${index}`}>Único</Label>
          </div>
        </div>
        
        <div>
          <Label htmlFor={`field-default-${index}`}>Valor por Defecto</Label>
          <Input
            id={`field-default-${index}`}
            value={field.defaultValue || ""}
            onChange={(e) => handleChange("defaultValue", e.target.value)}
            placeholder="Valor por defecto"
          />
        </div>
        
        {showOptions && (
          <div className="border p-4 rounded-md">
            <Label>Opciones</Label>
            <div className="flex gap-2 mb-2">
              <Input
                value={newOption}
                onChange={(e) => setNewOption(e.target.value)}
                placeholder="Agregar opción"
              />
              <Button type="button" onClick={handleAddOption}>Agregar</Button>
            </div>
            <div className="space-y-2 mt-2">
              {field.options?.map((option, idx) => (
                <div key={idx} className="flex justify-between items-center rounded p-2 bg-white">
                  <span>{option}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveOption(idx)}
                  >
                    <Trash className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
        
        <FormSection
          title="Reglas de Validación"
          description={`${field.validation_rules?.length || 0} reglas definidas`}
          onCollapse={() => setIsValidationCollapsed(!isValidationCollapsed)}
          isCollapsed={isValidationCollapsed}
        >
          <div className="space-y-2">
            {field.validation_rules?.map((rule, idx) => (
              <ValidationRuleForm
                key={idx}
                validation={rule}
                onChange={(updated) => handleValidationChange(idx, updated)}
                onDelete={() => handleValidationDelete(idx)}
                index={idx}
                type="field"
              />
            ))}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleAddValidation}
            >
              <PlusCircle className="mr-2 h-4 w-4" /> Agregar Regla de Validación
            </Button>
          </div>
        </FormSection>
      </div>
    </div>
  );
};

export default FieldForm;
