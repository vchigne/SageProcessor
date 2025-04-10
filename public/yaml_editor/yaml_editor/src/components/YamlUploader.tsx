
import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { YamlConfig } from "@/types/yaml";
import { parseYaml } from "@/utils/yamlConverter";

interface YamlUploaderProps {
  onYamlLoaded: (config: YamlConfig) => void;
}

const YamlUploader = ({ onYamlLoaded }: YamlUploaderProps) => {
  const { toast } = useToast();

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      // Verificar que sea un archivo YAML
      if (!file.name.endsWith(".yaml") && !file.name.endsWith(".yml")) {
        toast({
          title: "Formato incorrecto",
          description: "Por favor, sube un archivo YAML (.yaml o .yml)",
          variant: "destructive",
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const parsedYaml = parseYaml(content);
          onYamlLoaded(parsedYaml);
          toast({
            title: "YAML cargado",
            description: "El archivo YAML se ha cargado correctamente",
          });
        } catch (error) {
          console.error("Error parsing YAML:", error);
          toast({
            title: "Error al cargar",
            description: "El archivo YAML no pudo ser procesado",
            variant: "destructive",
          });
        }
      };

      reader.readAsText(file);
      
      // Reset the input value so the same file can be uploaded again
      event.target.value = '';
    },
    [onYamlLoaded, toast]
  );

  return (
    <div>
      <input
        type="file"
        id="yaml-upload"
        accept=".yaml,.yml"
        onChange={handleFileChange}
        className="hidden"
      />
      <label htmlFor="yaml-upload">
        <Button variant="outline" className="cursor-pointer" type="button" asChild>
          <span>
            <Upload className="h-4 w-4 mr-2" /> Cargar YAML
          </span>
        </Button>
      </label>
    </div>
  );
};

export default YamlUploader;
