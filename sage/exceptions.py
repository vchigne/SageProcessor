"""Custom exceptions for SAGE"""

class SAGEError(Exception):
    """Base exception for SAGE errors"""
    pass

class YAMLValidationError(SAGEError):
    """Raised when YAML validation fails"""
    pass

class FileProcessingError(SAGEError):
    """Raised when file processing fails"""
    pass

class ConfigurationError(SAGEError):
    """Raised when configuration is invalid"""
    pass

class YAMLGenerationError(SAGEError):
    """Raised when YAML generation with AI fails"""
    pass