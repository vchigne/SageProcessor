"""Test data generator for SAGE YAML Studio"""
import os
import csv
import json
import zipfile
from typing import Dict, List
import pandas as pd
from datetime import datetime, timedelta

class TestDataGenerator:
    """Generates test data files for YAML Studio"""

    def __init__(self):
        """Initialize generator with base directory"""
        self.base_dir = "test_YAML_Studio"  # Removed duplicate directory
        self.input_dir = os.path.join(self.base_dir, "input_files")
        self.yaml_dir = os.path.join(self.base_dir, "generated_yaml")
        self.logs_dir = os.path.join(self.base_dir, "validation_logs")
        self.output_dir = os.path.join(self.base_dir, "processing_output")

        # Create directory structure
        for directory in [self.input_dir, self.yaml_dir, self.logs_dir, self.output_dir]:
            os.makedirs(directory, exist_ok=True)

    def generate_vendedores(self) -> pd.DataFrame:
        """Generate vendors data"""
        return pd.DataFrame({
            'codigo_vendedor': ['V-001', 'V-002', 'V-003', 'V-004', 'V-005'],
            'nombre': ['Ana López', 'Juan Pérez', 'María García', 'Carlos Ruiz', 'Laura Torres'],
            'zona': ['Norte', 'Sur', 'Este', 'Oeste', 'Centro'],
            'fecha_ingreso': [
                (datetime.now() - timedelta(days=x*365)).strftime('%Y-%m-%d')
                for x in range(5)
            ]
        })

    def generate_clientes(self) -> pd.DataFrame:
        """Generate customers data"""
        return pd.DataFrame({
            'codigo_cliente': ['C-001', 'C-002', 'C-003', 'C-004', 'C-005'],
            'nombre': ['Empresa A', 'Comercial B', 'Distribuidora C', 'Mayorista D', 'Minorista E'],
            'tipo': ['Mayorista', 'Minorista', 'Mayorista', 'Mayorista', 'Minorista'],
            'limite_credito': [100000, 50000, 75000, 80000, 25000]
        })

    def generate_productos(self) -> pd.DataFrame:
        """Generate products data"""
        return pd.DataFrame({
            'codigo_producto': ['P-001', 'P-002', 'P-003', 'P-004', 'P-005'],
            'nombre': ['Laptop', 'Monitor', 'Teclado', 'Mouse', 'Impresora'],
            'categoria': ['Computadoras', 'Periféricos', 'Periféricos', 'Periféricos', 'Impresión'],
            'precio_base': [1200.50, 350.00, 45.50, 25.99, 299.99]
        })

    def generate_stock(self) -> pd.DataFrame:
        """Generate stock data"""
        return pd.DataFrame({
            'codigo_producto': ['P-001', 'P-002', 'P-003', 'P-004', 'P-005'],
            'almacen': ['Principal', 'Principal', 'Secundario', 'Principal', 'Secundario'],
            'cantidad': [50, 100, 150, 200, 75],
            'fecha_actualizacion': [datetime.now().strftime('%Y-%m-%d')] * 5
        })

    def generate_ventas(self) -> pd.DataFrame:
        """Generate sales data with references to other catalogs"""
        return pd.DataFrame({
            'codigo_venta': ['VTA-001', 'VTA-002', 'VTA-003', 'VTA-004', 'VTA-005'],
            'fecha': [(datetime.now() - timedelta(days=x)).strftime('%Y-%m-%d') for x in range(5)],
            'codigo_cliente': ['C-001', 'C-002', 'C-003', 'C-002', 'C-001'],
            'codigo_vendedor': ['V-001', 'V-002', 'V-001', 'V-003', 'V-002'],
            'codigo_producto': ['P-001', 'P-002', 'P-003', 'P-004', 'P-005'],
            'cantidad': [2, 3, 5, 10, 1],
            'precio_unitario': [1200.50, 350.00, 45.50, 25.99, 299.99],
            'total': [2401.00, 1050.00, 227.50, 259.90, 299.99]
        })

    def create_complex_zip(self) -> str:
        """Create ZIP with multiple related catalogs"""
        # Generate all dataframes
        catalogs = {
            'vendedores.csv': self.generate_vendedores(),
            'clientes.csv': self.generate_clientes(),
            'productos.csv': self.generate_productos(),
            'stock.csv': self.generate_stock(),
            'ventas.csv': self.generate_ventas()
        }

        # Create ZIP file
        zip_name = os.path.join(self.input_dir, "catalogs_complex.zip")

        with zipfile.ZipFile(zip_name, 'w') as zf:
            for filename, df in catalogs.items():
                # Save DataFrame to CSV in memory
                csv_content = df.to_csv(index=False)
                # Add CSV to ZIP
                zf.writestr(filename, csv_content)

        return zip_name

    def generate_complex_instructions(self) -> str:
        """Generate instructions for complex catalog validation"""
        instructions_path = os.path.join(self.input_dir, "instructions_complex.txt")

        instructions = """Reglas de Validación para Sistema de Ventas:

1. Catálogo de Vendedores (vendedores.csv):
   - codigo_vendedor: formato V-XXX (donde X son números)
   - nombre: no puede estar vacío
   - zona: debe ser uno de: Norte, Sur, Este, Oeste, Centro
   - fecha_ingreso: formato YYYY-MM-DD, no puede ser futura

2. Catálogo de Clientes (clientes.csv):
   - codigo_cliente: formato C-XXX
   - nombre: no puede estar vacío
   - tipo: debe ser 'Mayorista' o 'Minorista'
   - limite_credito: debe ser positivo

3. Catálogo de Productos (productos.csv):
   - codigo_producto: formato P-XXX
   - nombre: no puede estar vacío
   - categoria: no puede estar vacía
   - precio_base: debe ser positivo

4. Catálogo de Stock (stock.csv):
   - codigo_producto: debe existir en productos.csv
   - almacen: debe ser 'Principal' o 'Secundario'
   - cantidad: debe ser >= 0
   - fecha_actualizacion: formato YYYY-MM-DD

5. Catálogo de Ventas (ventas.csv):
   - codigo_venta: formato VTA-XXX
   - fecha: formato YYYY-MM-DD, no puede ser futura
   - codigo_cliente: debe existir en clientes.csv
   - codigo_vendedor: debe existir en vendedores.csv
   - codigo_producto: debe existir en productos.csv
   - cantidad: debe ser positiva
   - precio_unitario: debe ser positivo
   - total: debe ser igual a cantidad * precio_unitario

Validaciones entre catálogos:
1. Las ventas solo pueden usar productos con stock disponible
2. El total de ventas por cliente no puede exceder su límite de crédito
3. Los precios unitarios deben coincidir con los precios base de productos
"""

        with open(instructions_path, 'w', encoding='utf-8') as f:
            f.write(instructions)

        return instructions_path

    def generate_test_data(self) -> Dict[str, str]:
        """Generate test data and return paths"""
        return {
            'zip_file': self.create_complex_zip(),
            'instructions': self.generate_complex_instructions()
        }

if __name__ == "__main__":
    generator = TestDataGenerator()
    files = generator.generate_test_data()
    print("✅ Generated test files successfully:")
    for file_type, file_path in files.items():
        print(f"  📄 {file_type}: {os.path.basename(file_path)}")