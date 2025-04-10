
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { FormSectionProps } from "@/types/yaml";

const FormSection = ({
  title,
  description,
  children,
  onCollapse,
  isCollapsed: externalIsCollapsed
}: FormSectionProps) => {
  const [internalIsCollapsed, setInternalIsCollapsed] = useState(false);
  
  const isCollapsed = externalIsCollapsed !== undefined ? externalIsCollapsed : internalIsCollapsed;
  
  const handleToggle = () => {
    if (onCollapse) {
      onCollapse();
    } else {
      setInternalIsCollapsed(!internalIsCollapsed);
    }
  };

  return (
    <div className="border rounded-md mb-4">
      <div
        className="flex justify-between items-center p-4 cursor-pointer bg-gray-50 hover:bg-gray-100 rounded-t-md"
        onClick={handleToggle}
      >
        <div>
          <h3 className="text-lg font-medium">{title}</h3>
          {description && <p className="text-sm text-gray-500">{description}</p>}
        </div>
        <div>
          {isCollapsed ? <ChevronRight size={20} /> : <ChevronDown size={20} />}
        </div>
      </div>
      {!isCollapsed && <div className="p-4 border-t">{children}</div>}
    </div>
  );
};

export default FormSection;
