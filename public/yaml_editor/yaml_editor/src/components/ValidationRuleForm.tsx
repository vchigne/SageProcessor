
import { ValidationRule, RowValidation, CatalogValidation, PackageValidation } from "@/types/yaml";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash } from "lucide-react";

interface ValidationRuleFormProps {
  validation: ValidationRule | RowValidation | CatalogValidation | PackageValidation;
  onChange: (updatedValidation: any) => void;
  onDelete: () => void;
  index: number;
  type: "field" | "row" | "catalog" | "package";
}

const ValidationRuleForm = ({ validation, onChange, onDelete, index, type }: ValidationRuleFormProps) => {
  const handleChange = (key: string, value: any) => {
    onChange({ ...validation, [key]: value });
  };

  const getTypeLabel = () => {
    switch (type) {
      case "field": return "Campo";
      case "row": return "Fila";
      case "catalog": return "Catálogo";
      case "package": return "Paquete";
      default: return "Validación";
    }
  };

  return (
    <div className="bg-gray-50 p-4 rounded-md mb-3">
      <div className="flex justify-between mb-2">
        <h4 className="text-md font-medium">Validación de {getTypeLabel()} {index + 1}</h4>
        <Button variant="ghost" size="sm" onClick={onDelete}>
          <Trash className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid gap-4">
        <div>
          <Label htmlFor={`validation-name-${type}-${index}`}>Nombre</Label>
          <Input
            id={`validation-name-${type}-${index}`}
            value={validation.name}
            onChange={(e) => handleChange("name", e.target.value)}
            placeholder="Nombre de la regla"
          />
        </div>
        
        <div>
          <Label htmlFor={`validation-description-${type}-${index}`}>Descripción (mensaje de error)</Label>
          <Textarea
            id={`validation-description-${type}-${index}`}
            value={validation.description}
            onChange={(e) => handleChange("description", e.target.value)}
            placeholder="Mensaje de error amigable"
          />
        </div>
        
        <div>
          <Label htmlFor={`validation-rule-${type}-${index}`}>Regla</Label>
          <Textarea
            id={`validation-rule-${type}-${index}`}
            value={validation.rule}
            onChange={(e) => handleChange("rule", e.target.value)}
            placeholder="Expresión pandas (ejemplo: df['columna'] > 0)"
          />
        </div>
        
        <div>
          <Label htmlFor={`validation-severity-${type}-${index}`}>Severidad</Label>
          <Select
            value={validation.severity}
            onValueChange={(value) => handleChange("severity", value)}
          >
            <SelectTrigger id={`validation-severity-${type}-${index}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="error">Error</SelectItem>
              <SelectItem value="warning">Advertencia</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
};

export default ValidationRuleForm;
