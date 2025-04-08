"""YAML validation functionality for SAGE"""
import yaml
from typing import Dict, List, Any
from sage.models import SageConfig, Catalog, Package, Field, ValidationRule, FileFormat, Severity
from sage.exceptions import YAMLValidationError
from sage.file_processor import FileProcessor  # Importamos para usar las constantes

class YAMLValidator:
    REQUIRED_ROOT_KEYS = {"sage_yaml", "catalogs", "packages"}
    REQUIRED_SAGE_KEYS = {"name", "description", "version", "author"}
    ALLOWED_FILE_TYPES = FileProcessor.ALLOWED_FILE_TYPES

    def _create_file_format(self, file_format_data: Dict[str, Any], context: str, yaml_content: Dict[str, Any] = None) -> FileFormat:
        """Create a FileFormat object with proper defaults based on context"""
        if not isinstance(file_format_data, dict):
            raise YAMLValidationError(
                f"¡Ops! 😅 El formato de archivo en {context} no tiene la estructura correcta.\n"
                "Necesitamos que sea un diccionario con las propiedades del formato.\n"
                "Por ejemplo:\n"
                "file_format:\n"
                "  type: 'CSV'\n"
                "  delimiter: ','"
            )

        file_type = file_format_data.get("type")
        if not file_type:
            raise YAMLValidationError(
                f"¡Hey! 🤔 No encontramos el tipo de archivo en {context}.\n"
                "Es importante que especifiques qué tipo de archivo vamos a procesar.\n"
                f"Los tipos permitidos son: CSV y EXCEL (para catálogos), y ZIP (para paquetes)"
            )

        if file_type not in self.ALLOWED_FILE_TYPES:
            raise YAMLValidationError(
                f"¡Vaya! 😮 El tipo de archivo '{file_type}' en {context} no es uno de los que podemos procesar.\n"
                f"Los tipos permitidos son: CSV y EXCEL (para catálogos), y ZIP (para paquetes)"
            )

        # For package-level formats, we need to check if it's a multiple catalog package
        if context.startswith("package"):
            # Get the package name from the context
            package_name = context.split(" ")[1]
            catalog_list = yaml_content.get("packages", {}).get(package_name, {}).get("catalogs", [])

            # If the package has multiple catalogs, it must be ZIP
            if len(catalog_list) > 1 and file_type != "ZIP":
                raise YAMLValidationError(
                    f"¡Ups! 😅 Los paquetes con múltiples catálogos solo pueden ser de tipo ZIP, pero en {context} "
                    f"se especificó '{file_type}'"
                )

            # For single catalog packages, allow CSV or EXCEL to match catalog type
            if len(catalog_list) == 1 and file_type in ["CSV", "EXCEL", "ZIP"]:
                return FileFormat(type=file_type)

            # For packages with zero catalogs (invalid, but handled elsewhere)
            return FileFormat(type=file_type)

        # For catalogs, we need delimiter for CSV files
        if file_type == "CSV":
            delimiter = file_format_data.get("delimiter")
            if not delimiter:
                raise YAMLValidationError(
                    f"¡Casi lo tenemos! 👀 Para archivos CSV en {context}, necesitamos saber qué carácter separa las columnas.\n"
                    "Agrega la propiedad 'delimiter' con el separador que uses (por ejemplo: ',' o ';')"
                )

            header = file_format_data.get("header", False)
            return FileFormat(type=file_type, delimiter=delimiter, header=header)

        # For Excel files in catalogs
        if file_type == "EXCEL":
            header = file_format_data.get("header", False)
            return FileFormat(type=file_type, header=header)

        # For non-CSV files in catalogs
        return FileFormat(type=file_type)

    def validate_yaml_structure(self, yaml_content: Dict[str, Any]) -> None:
        """Validate the basic structure of the YAML file"""
        # Check root keys
        missing_keys = self.REQUIRED_ROOT_KEYS - set(yaml_content.keys())
        if missing_keys:
            raise YAMLValidationError(
                "¡Parece que faltan algunas secciones importantes en tu YAML! 📝\n\n"
                f"No encontramos: {', '.join(missing_keys)}\n\n"
                "Tu YAML debe tener estas tres secciones principales:\n"
                "• sage_yaml: Para la información general de la configuración\n"
                "• catalogs: Para definir la estructura de tus archivos\n"
                "• packages: Para agrupar los catálogos relacionados"
            )

        # Validate sage_yaml section
        sage_section = yaml_content.get("sage_yaml", {})
        missing_sage_keys = self.REQUIRED_SAGE_KEYS - set(sage_section.keys())
        if missing_sage_keys:
            raise YAMLValidationError(
                "¡Hey! 👋 La sección 'sage_yaml' necesita más información:\n\n"
                f"Faltan estos campos: {', '.join(missing_sage_keys)}\n\n"
                "Esta sección nos ayuda a identificar y entender tu configuración:\n"
                "• name: Un nombre descriptivo para tu configuración\n"
                "• description: Una breve explicación de lo que hace\n"
                "• version: La versión de tu configuración\n"
                "• author: ¡Tu nombre o el de tu equipo!"
            )

    def validate_catalog(self, name: str, catalog_data: Dict[str, Any]) -> None:
        """Validate a single catalog configuration"""
        required_keys = {"name", "description", "filename", "file_format", "fields"}
        missing_keys = required_keys - set(catalog_data.keys())
        if missing_keys:
            raise YAMLValidationError(
                f"¡El catálogo '{name}' necesita algunos ajustes! 🔧\n\n"
                f"Faltan estos campos importantes: {', '.join(missing_keys)}\n\n"
                "Cada catálogo necesita:\n"
                "• name: Un nombre descriptivo\n"
                "• description: Una explicación de su contenido\n"
                "• filename: El nombre del archivo a procesar\n"
                "• file_format: El formato del archivo\n"
                "• fields: Los campos que contiene"
            )

    def validate_package(self, name: str, package_data: Dict[str, Any]) -> None:
        """Validate a single package configuration"""
        required_keys = {"name", "description", "file_format", "catalogs"}
        missing_keys = required_keys - set(package_data.keys())
        if missing_keys:
            raise YAMLValidationError(
                f"¡El paquete '{name}' necesita algunos detalles más! 📦\n\n"
                f"No encontramos: {', '.join(missing_keys)}\n\n"
                "Cada paquete debe tener:\n"
                "• name: Un nombre que lo identifique\n"
                "• description: Una descripción de su propósito\n"
                "• file_format: El formato del archivo del paquete\n"
                "• catalogs: La lista de catálogos que incluye"
            )

    def parse_validation_rules(self, rules_data: List[Dict[str, Any]]) -> List[ValidationRule]:
        """Parse validation rules from YAML data"""
        rules = []
        for rule_data in rules_data:
            try:
                # Usar el nuevo método from_string que maneja cualquier capitalización
                severity_str = rule_data.get("severity", "error")
                try:
                    severity = Severity.from_string(severity_str)
                except ValueError as e:
                    raise ValueError(f"'{severity_str}' is not a valid Severity. Must be 'error', 'warning', or 'message' (case insensitive)")
                
                rule = ValidationRule(
                    name=rule_data["name"],
                    description=rule_data["description"],
                    rule=rule_data["rule"],
                    severity=severity
                )
                rules.append(rule)
            except (KeyError, ValueError) as e:
                raise YAMLValidationError(f"Invalid validation rule: {str(e)}")
        return rules

    def validate_yaml(self, yaml_content: Dict[str, Any]) -> SageConfig:
        """Validate YAML content and return a SageConfig object"""
        # Validamos la estructura básica
        self.validate_yaml_structure(yaml_content)
        
        # Parseamos el contenido para crear un objeto SageConfig
        return self._parse_yaml_content(yaml_content)
        
    def load_and_validate(self, yaml_path: str) -> SageConfig:
        """Load and validate a YAML file, returning a SageConfig object"""
        try:
            with open(yaml_path, 'r', encoding='utf-8') as f:
                yaml_content = yaml.safe_load(f)
        except Exception as e:
            raise YAMLValidationError(f"Failed to load YAML file: {str(e)}")

        return self.validate_yaml(yaml_content)
        
    def _parse_yaml_content(self, yaml_content: Dict[str, Any]) -> SageConfig:
        """
        Método interno para parsear el contenido YAML y crear un objeto SageConfig
        
        Este método asume que la estructura ya fue validada
        """

        # Parse catalogs
        catalogs = {}
        for catalog_name, catalog_data in yaml_content.get("catalogs", {}).items():
            self.validate_catalog(catalog_name, catalog_data)

            fields = []
            for field_data in catalog_data["fields"]:
                validation_rules = self.parse_validation_rules(field_data.get("validation_rules", []))
                fields.append(Field(
                    name=field_data["name"],
                    type=field_data["type"],
                    required=field_data.get("required", False),
                    unique=field_data.get("unique", False),
                    validation_rules=validation_rules
                ))

            file_format = self._create_file_format(catalog_data["file_format"], f"catalog {catalog_name}", yaml_content)

            catalogs[catalog_name] = Catalog(
                name=catalog_data["name"],
                description=catalog_data["description"],
                filename=catalog_data["filename"],
                path="",  # Valor predeterminado vacío para mantener compatibilidad
                file_format=file_format,
                fields=fields,
                row_validation=self.parse_validation_rules(catalog_data.get("row_validation", [])),
                catalog_validation=self.parse_validation_rules(catalog_data.get("catalog_validation", []))
            )

        # Parse packages
        packages = {}
        for package_name, package_data in yaml_content.get("packages", {}).items():
            self.validate_package(package_name, package_data)
            file_format = self._create_file_format(package_data["file_format"], f"package {package_name}", yaml_content)

            packages[package_name] = Package(
                name=package_data["name"],
                description=package_data["description"],
                file_format=file_format,
                catalogs=package_data["catalogs"],
                package_validation=self.parse_validation_rules(package_data.get("package_validation", []))
            )

        # Create and return SageConfig
        sage_yaml = yaml_content["sage_yaml"]
        return SageConfig(
            name=sage_yaml["name"],
            description=sage_yaml["description"],
            version=sage_yaml["version"],
            author=sage_yaml["author"],
            comments=sage_yaml.get("comments", ""),
            catalogs=catalogs,
            packages=packages
        )