"""Data models for SAGE"""
from dataclasses import dataclass
from typing import List, Dict, Any, Optional
from enum import Enum

class Severity(Enum):
    ERROR = "error"
    WARNING = "warning"
    MESSAGE = "message"
    
    @classmethod
    def from_string(cls, severity_str: str) -> 'Severity':
        """
        Convierte un string a un valor de Severity, ignorando capitalización.
        Ejemplos: 'ERROR', 'error', 'Error' -> Severity.ERROR
        
        Args:
            severity_str: String que representa la severidad
            
        Returns:
            Severity: El valor de enumeración correspondiente
            
        Raises:
            ValueError: Si el string no corresponde a un valor válido
        """
        if not isinstance(severity_str, str):
            raise ValueError(f"Expected string, got {type(severity_str).__name__}")
            
        severity_upper = severity_str.upper()
        
        if severity_upper == "ERROR":
            return cls.ERROR
        elif severity_upper == "WARNING":
            return cls.WARNING
        elif severity_upper == "MESSAGE":
            return cls.MESSAGE
        else:
            raise ValueError(f"'{severity_str}' is not a valid Severity")

@dataclass
class ValidationRule:
    name: str
    description: str
    rule: str
    severity: Severity
    
    def __repr__(self) -> str:
        """Representación más limpia para logs"""
        return f"ValidationRule(name='{self.name}', severity={self.severity.name})"

@dataclass
class Field:
    name: str
    type: str
    required: bool
    unique: bool
    validation_rules: List[ValidationRule]
    
    def __repr__(self) -> str:
        """Representación más limpia para logs"""
        return f"Field(name='{self.name}', type='{self.type}')"

@dataclass
class FileFormat:
    type: str
    delimiter: Optional[str] = None
    header: bool = False
    
    def __repr__(self) -> str:
        """Representación más limpia para logs"""
        if self.delimiter:
            return f"FileFormat(type='{self.type}', delimiter='{self.delimiter}', header={self.header})"
        return f"FileFormat(type='{self.type}', header={self.header})"

@dataclass
class Catalog:
    name: str
    description: str
    filename: str
    path: str
    file_format: FileFormat
    fields: List[Field]
    row_validation: List[ValidationRule]
    catalog_validation: List[ValidationRule]
    
    def __repr__(self) -> str:
        """Representación más limpia para logs"""
        return f"Catalog(name='{self.name}', filename='{self.filename}', fields={len(self.fields)})"

@dataclass
class Package:
    name: str
    description: str
    file_format: FileFormat
    catalogs: List[str]
    package_validation: List[ValidationRule]
    
    def __repr__(self) -> str:
        """Representación más limpia para logs"""
        return f"Package(name='{self.name}', catalogs={len(self.catalogs)})"

@dataclass
class SageConfig:
    name: str
    description: str
    version: str
    author: str
    comments: str
    catalogs: Dict[str, Catalog]
    packages: Dict[str, Package]
    
    def __repr__(self) -> str:
        """Representación más limpia para logs"""
        return f"SageConfig(name='{self.name}', catalogs={len(self.catalogs)}, packages={len(self.packages)})"