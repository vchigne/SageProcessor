
import { Button } from "@/components/ui/button";
import { YamlConfig } from "@/types/yaml";
import { convertToYaml } from "@/utils/yamlConverter";
import { useState } from "react";
import { Copy, Download } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface YamlPreviewProps {
  config: YamlConfig;
}

const YamlPreview = ({ config }: YamlPreviewProps) => {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  
  const yamlString = convertToYaml(config);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(yamlString);
      setCopied(true);
      toast({
        title: "Copied to clipboard",
        description: "YAML content has been copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
      toast({
        title: "Copy failed",
        description: "Failed to copy YAML to clipboard",
        variant: "destructive",
      });
    }
  };

  const handleDownload = () => {
    const blob = new Blob([yamlString], { type: "text/yaml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sage-config.yaml";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({
      title: "Downloaded",
      description: "YAML file has been downloaded",
    });
  };

  return (
    <div className="bg-gray-50 border rounded-md overflow-hidden">
      <div className="flex justify-between items-center p-2 bg-gray-100 border-b">
        <h3 className="text-sm font-medium">YAML Preview</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleCopy}>
            <Copy className="h-4 w-4 mr-1" /> {copied ? "Copied" : "Copy"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-1" /> Download
          </Button>
        </div>
      </div>
      <pre className="p-4 text-xs overflow-auto whitespace-pre max-h-[500px] min-h-[200px] bg-gray-900 text-gray-100">
        {yamlString || "# No configuration yet"}
      </pre>
    </div>
  );
};

export default YamlPreview;
