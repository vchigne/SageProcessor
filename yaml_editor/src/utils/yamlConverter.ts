
import { YamlConfig, Catalog, Package, Field, ValidationRule } from "@/types/yaml";
import jsYaml from 'js-yaml';

export const convertToYaml = (config: YamlConfig): string => {
  let yaml = "";
  
  // Add sage_yaml section
  if (config.sage_yaml) {
    yaml += "sage_yaml:\n";
    yaml += `  name: "${config.sage_yaml.name}"\n`;
    yaml += `  description: "${config.sage_yaml.description}"\n`;
    yaml += `  version: "${config.sage_yaml.version}"\n`;
    yaml += `  author: "${config.sage_yaml.author}"\n`;
    if (config.sage_yaml.comments) yaml += `  comments: "${config.sage_yaml.comments}"\n`;
    yaml += "\n";
  }
  
  // Add catalogs
  if (config.catalogs.length > 0) {
    yaml += "catalogs:\n";
    config.catalogs.forEach(catalog => {
      yaml += `  ${catalog.name.toLowerCase().replace(/\s+/g, '_')}:\n`;
      yaml += `    name: "${catalog.name}"\n`;
      if (catalog.description) yaml += `    description: "${catalog.description}"\n`;
      if (catalog.filename) yaml += `    filename: "${catalog.filename}"\n`;
      
      // Add file_format
      if (catalog.file_format) {
        yaml += "    file_format:\n";
        yaml += `      type: "${catalog.file_format.type}"\n`;
        if (catalog.file_format.delimiter) yaml += `      delimiter: "${catalog.file_format.delimiter}"\n`;
        if (catalog.file_format.header !== undefined) yaml += `      header: ${catalog.file_format.header}\n`;
      }
      
      // Add fields
      if (catalog.fields.length > 0) {
        yaml += "    fields:\n";
        catalog.fields.forEach(field => {
          yaml += `      - name: "${field.name}"\n`;
          yaml += `        type: "${field.type}"\n`;
          if (field.description) yaml += `        description: "${field.description}"\n`;
          if (field.required !== undefined) yaml += `        required: ${field.required}\n`;
          if (field.unique !== undefined) yaml += `        unique: ${field.unique}\n`;
          if (field.defaultValue) yaml += `        default: ${field.defaultValue}\n`;
          
          // Add validation_rules
          if (field.validation_rules && field.validation_rules.length > 0) {
            yaml += "        validation_rules:\n";
            field.validation_rules.forEach(rule => {
              yaml += `          - name: "${rule.name}"\n`;
              yaml += `            description: "${rule.description}"\n`;
              yaml += `            rule: "${rule.rule}"\n`;
              yaml += `            severity: "${rule.severity}"\n`;
            });
          }
        });
      }
      
      // Add row_validation
      if (catalog.row_validation && catalog.row_validation.length > 0) {
        yaml += "    row_validation:\n";
        catalog.row_validation.forEach(validation => {
          yaml += `      - name: "${validation.name}"\n`;
          yaml += `        description: "${validation.description}"\n`;
          yaml += `        rule: "${validation.rule}"\n`;
          yaml += `        severity: "${validation.severity}"\n`;
        });
      }
      
      // Add catalog_validation
      if (catalog.catalog_validation && catalog.catalog_validation.length > 0) {
        yaml += "    catalog_validation:\n";
        catalog.catalog_validation.forEach(validation => {
          yaml += `      - name: "${validation.name}"\n`;
          yaml += `        description: "${validation.description}"\n`;
          yaml += `        rule: "${validation.rule}"\n`;
          yaml += `        severity: "${validation.severity}"\n`;
        });
      }
    });
    yaml += "\n";
  }
  
  // Add package (un solo paquete)
  if (config.package) {
    const pkg = config.package;
    yaml += "packages:\n";
    yaml += `  ${pkg.name.toLowerCase().replace(/\s+/g, '_')}:\n`;
    yaml += `    name: "${pkg.name}"\n`;
    if (pkg.description) yaml += `    description: "${pkg.description}"\n`;
    if (pkg.version) yaml += `    version: "${pkg.version}"\n`;
    
    // Add file_format
    if (pkg.file_format) {
      yaml += "    file_format:\n";
      yaml += `      type: "${pkg.file_format.type}"\n`;
      if (pkg.file_format.delimiter) yaml += `      delimiter: "${pkg.file_format.delimiter}"\n`;
      if (pkg.file_format.header !== undefined) yaml += `      header: ${pkg.file_format.header}\n`;
    }
    
    // Add catalogs
    if (pkg.catalogs.length > 0) {
      yaml += "    catalogs:\n";
      pkg.catalogs.forEach(catalog => {
        yaml += `      - ${catalog}\n`;
      });
    }
    
    // Add package_validation
    if (pkg.package_validation && pkg.package_validation.length > 0) {
      yaml += "    package_validation:\n";
      pkg.package_validation.forEach(validation => {
        yaml += `      - name: "${validation.name}"\n`;
        yaml += `        description: "${validation.description}"\n`;
        yaml += `        rule: "${validation.rule}"\n`;
        yaml += `        severity: "${validation.severity}"\n`;
      });
    }
  }
  
  return yaml;
};

export const parseYaml = (yamlString: string): YamlConfig => {
  try {
    const parsed = jsYaml.load(yamlString) as any;
    
    // Inicializar la estructura básica
    const config: YamlConfig = {
      catalogs: [],
      package: {
        name: "Paquete por defecto",
        catalogs: [],
        file_format: { type: "ZIP" }
      }
    };
    
    // Procesar sage_yaml
    if (parsed?.sage_yaml) {
      config.sage_yaml = {
        name: parsed.sage_yaml.name || "",
        description: parsed.sage_yaml.description || "",
        version: parsed.sage_yaml.version || "",
        author: parsed.sage_yaml.author || "",
        comments: parsed.sage_yaml.comments
      };
    }
    
    // Procesar catalogs
    if (parsed?.catalogs) {
      const catalogEntries = Object.entries(parsed.catalogs);
      config.catalogs = catalogEntries.map(([key, value]: [string, any]) => {
        const catalog: Catalog = {
          name: value.name || key,
          description: value.description,
          filename: value.filename,
          file_format: value.file_format,
          fields: []
        };
        
        // Procesar fields
        if (value.fields && Array.isArray(value.fields)) {
          catalog.fields = value.fields.map((field: any) => ({
            name: field.name || "",
            type: field.type || "texto",
            description: field.description,
            required: field.required,
            unique: field.unique,
            defaultValue: field.default,
            validation_rules: field.validation_rules
          }));
        }
        
        // Procesar row_validation
        if (value.row_validation && Array.isArray(value.row_validation)) {
          catalog.row_validation = value.row_validation;
        }
        
        // Procesar catalog_validation
        if (value.catalog_validation && Array.isArray(value.catalog_validation)) {
          catalog.catalog_validation = value.catalog_validation;
        }
        
        return catalog;
      });
    }
    
    // Procesar package
    if (parsed?.packages) {
      const packageEntries = Object.entries(parsed.packages);
      if (packageEntries.length > 0) {
        const [key, value] = packageEntries[0] as [string, any]; // Tomamos solo el primer paquete
        config.package = {
          name: value.name || key,
          description: value.description,
          version: value.version,
          file_format: value.file_format,
          catalogs: Array.isArray(value.catalogs) ? value.catalogs : [],
          package_validation: value.package_validation
        };
      }
    }
    
    return config;
  } catch (error) {
    console.error("Failed to parse YAML:", error);
    return {
      catalogs: [],
      package: {
        name: "Paquete por defecto",
        catalogs: [],
        file_format: { type: "ZIP" }
      }
    };
  }
};
