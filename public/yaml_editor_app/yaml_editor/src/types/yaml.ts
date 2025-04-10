
export interface Field {
  name: string;
  type: string;
  description?: string;
  required?: boolean;
  unique?: boolean;
  defaultValue?: string;
  options?: string[];
  validation_rules?: ValidationRule[];
}

export interface ValidationRule {
  name: string;
  description: string;
  rule: string;
  severity: "error" | "warning";
}

export interface RowValidation {
  name: string;
  description: string;
  rule: string;
  severity: "error" | "warning";
}

export interface CatalogValidation {
  name: string;
  description: string;
  rule: string;
  severity: "error" | "warning";
}

export interface FileFormat {
  type: "CSV" | "EXCEL" | "ZIP";
  delimiter?: string;
  header?: boolean;
}

export interface Catalog {
  name: string;
  description?: string;
  filename?: string;
  file_format?: FileFormat;
  fields: Field[];
  row_validation?: RowValidation[];
  catalog_validation?: CatalogValidation[];
}

export interface PackageValidation {
  name: string;
  description: string;
  rule: string;
  severity: "error" | "warning";
}

export interface Package {
  name: string;
  description?: string;
  file_format?: FileFormat;
  catalogs: string[];
  version?: string;
  package_validation?: PackageValidation[];
}

export interface SageYaml {
  name: string;
  description: string;
  version: string;
  author: string;
  comments?: string;
}

export interface YamlConfig {
  sage_yaml?: SageYaml;
  catalogs: Catalog[];
  package: Package; // Cambiado de packages: Package[] a package: Package
}

export interface FormSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  onCollapse?: () => void;
  isCollapsed?: boolean;
}

export const DATA_TYPES = [
  "texto",
  "decimal",
  "entero",
  "fecha",
  "booleano",
  "select"
];
