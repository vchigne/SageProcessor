
import { Button } from "@/components/ui/button";
import { FileText, Grid, PlusCircle } from "lucide-react";

interface SidebarProps {
  onAddCatalog: () => void;
  catalogCount: number;
}

const Sidebar = ({ onAddCatalog, catalogCount }: SidebarProps) => {
  return (
    <aside className="bg-gray-50 border-r p-4 h-full">
      <h2 className="text-lg font-semibold mb-4">Componentes</h2>
      <div className="space-y-2">
        <Button 
          variant="outline" 
          className="w-full justify-start" 
          onClick={onAddCatalog}
        >
          <Grid className="h-4 w-4 mr-2" /> 
          Catálogos ({catalogCount})
          <PlusCircle className="h-4 w-4 ml-auto" />
        </Button>
        <Button 
          variant="outline" 
          className="w-full justify-start" 
        >
          <FileText className="h-4 w-4 mr-2" /> 
          Documentación
        </Button>
      </div>
    </aside>
  );
};

export default Sidebar;
