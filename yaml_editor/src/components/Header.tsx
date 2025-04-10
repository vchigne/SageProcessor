
import { FileCode } from "lucide-react";

const Header = () => {
  return (
    <header className="bg-white border-b py-4">
      <div className="container mx-auto px-4 flex items-center">
        <FileCode className="h-6 w-6 text-blue-600 mr-2" />
        <h1 className="text-xl font-semibold">Sage YAML Wizard</h1>
      </div>
    </header>
  );
};

export default Header;
