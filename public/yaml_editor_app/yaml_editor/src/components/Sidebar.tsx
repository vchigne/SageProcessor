
import { Button } from "@/components/ui/button";
import { FileText, Grid, PlusCircle, Download, Upload, HelpCircle, CpuChip } from "lucide-react";

interface SidebarProps {
  onAddCatalog: () => void;
  catalogCount: number;
}

const Sidebar = ({ onAddCatalog, catalogCount }: SidebarProps) => {
  return (
    <aside className="bg-white border-r p-4 h-full">
      <div className="flex items-center mb-6">
        <CpuChip className="h-7 w-7 text-indigo-600 mr-2" />
        <h2 className="text-xl font-semibold text-gray-800">SAGE</h2>
      </div>
      
      <h3 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-3 pl-2">Editor YAML</h3>
      <div className="space-y-2 mb-6">
        <Button 
          variant="ghost" 
          className="w-full justify-start hover:bg-gray-100 hover:text-indigo-600" 
          onClick={onAddCatalog}
        >
          <Grid className="h-4 w-4 mr-2" /> 
          Catálogos ({catalogCount})
          <PlusCircle className="h-4 w-4 ml-auto" />
        </Button>
        
        <Button 
          variant="ghost" 
          className="w-full justify-start hover:bg-gray-100 hover:text-indigo-600"
        >
          <Upload className="h-4 w-4 mr-2" /> 
          Importar YAML
        </Button>
        
        <Button 
          variant="ghost" 
          className="w-full justify-start hover:bg-gray-100 hover:text-indigo-600"
        >
          <Download className="h-4 w-4 mr-2" /> 
          Exportar YAML
        </Button>
      </div>
      
      <h3 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-3 pl-2">Recursos</h3>
      <div className="space-y-2">
        <Button 
          variant="ghost" 
          className="w-full justify-start hover:bg-gray-100 hover:text-indigo-600" 
        >
          <FileText className="h-4 w-4 mr-2" /> 
          Documentación
        </Button>
        
        <Button 
          variant="ghost" 
          className="w-full justify-start hover:bg-gray-100 hover:text-indigo-600" 
        >
          <HelpCircle className="h-4 w-4 mr-2" /> 
          Ayuda
        </Button>
      </div>
    </aside>
  );
};

export default Sidebar;
