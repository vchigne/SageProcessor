"""Custom exceptions for SAGE"""

class SAGEError(Exception):
    """Base exception for SAGE errors"""
    def __str__(self):
        return super().__str__()
    
    def to_dict(self):
        """Convert exception to dictionary for JSON serialization"""
        return {
            "type": self.__class__.__name__,
            "message": str(self)
        }

class YAMLValidationError(SAGEError):
    """Raised when YAML validation fails"""
    pass

class FileProcessingError(SAGEError):
    """Raised when file processing fails"""
    def __init__(self, message, file=None, line=None, field=None, value=None, rule=None, **kwargs):
        super().__init__(message)
        self.message = message
        self.file = file
        self.line = line
        self.field = field
        self.value = value
        self.rule = rule
        self.extra = kwargs
    
    def __str__(self):
        parts = [self.message]
        if self.file:
            parts.append(f"file: {self.file}")
        if self.line:
            parts.append(f"line: {self.line}")
        if self.field:
            parts.append(f"field: {self.field}")
        if self.value:
            parts.append(f"value: {self.value}")
        if self.rule:
            parts.append(f"rule: {self.rule}")
        
        return "\n  ".join(parts)
    
    def to_dict(self):
        """Convert exception to dictionary for JSON serialization"""
        result = {
            "type": self.__class__.__name__,
            "message": self.message
        }
        
        # Add all the attributes that are not None
        if self.file:
            result["file"] = self.file
        if self.line:
            result["line"] = self.line
        if self.field:
            result["field"] = self.field
        if self.value:
            result["value"] = str(self.value)
        if self.rule:
            result["rule"] = self.rule
            
        # Add any extra attributes
        result.update({k: str(v) for k, v in self.extra.items()})
        
        return result

class ConfigurationError(SAGEError):
    """Raised when configuration is invalid"""
    pass

class YAMLGenerationError(SAGEError):
    """Raised when YAML generation with AI fails"""
    pass