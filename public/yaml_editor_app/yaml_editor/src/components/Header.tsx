
import { FileCode, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const Header = () => {
  const goToSageMain = () => {
    window.location.href = '/'; // Regresa a la página principal de SAGE
  };

  return (
    <header className="bg-white border-b py-4 shadow-sm">
      <div className="container mx-auto px-4 flex items-center justify-between">
        <div className="flex items-center">
          <FileCode className="h-7 w-7 text-indigo-600 mr-2" />
          <h1 className="text-xl md:text-2xl font-semibold">SAGE YAML Editor</h1>
        </div>
        <Button 
          variant="outline" 
          onClick={goToSageMain}
          className="flex items-center text-gray-700 hover:text-indigo-700"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver a SAGE
        </Button>
      </div>
    </header>
  );
};

export default Header;
