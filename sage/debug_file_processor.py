"""Debug version of file processor with enhanced error reporting"""
import os
import pandas as pd
import traceback
import json
from sage.yaml_validator import YAMLValidator
from sage.logger import SageLogger
from sage.file_processor import FileProcessor

def debug_process_file(yaml_path, zip_path):
    """Process files with enhanced error reporting"""
    print(f"Using YAML config: {yaml_path}")
    print(f"Using data file: {zip_path}")
    
    # Initialize logger
    logs_dir = os.path.join("debug_output", "logs")
    os.makedirs(logs_dir, exist_ok=True)
    logger = SageLogger(logs_dir)
    
    try:
        # Load and validate YAML
        validator = YAMLValidator()
        config = validator.load_and_validate(yaml_path)
        print("YAML validation successful")
        
        # Create file processor
        processor = FileProcessor(config, logger)
        
        # Debug info
        print("Packages defined in YAML:")
        for package_name in config.packages.keys():
            print(f"  - {package_name}")
        
        package_name = list(config.packages.keys())[0]
        print(f"Using package: {package_name}")
        
        # Extract catalog info
        package = config.packages.get(package_name)
        if not package:
            print(f"ERROR: Package '{package_name}' not found in configuration")
            return
        
        print(f"Catalogs in package: {package.catalogs}")
        
        # Process the file with detailed error reporting
        try:
            errors, warnings = processor.process_file(zip_path, package_name)
            print(f"Processing complete: {errors} errors, {warnings} warnings")
        except Exception as e:
            print(f"ERROR during processing: {str(e)}")
            traceback.print_exc()
            
            # Try to debug catalog by catalog
            print("\nAttempting to debug catalog by catalog:")
            for catalog_name in package.catalogs:
                catalog = config.catalogs.get(catalog_name)
                if not catalog:
                    print(f"  Catalog '{catalog_name}' not found in configuration")
                    continue
                
                print(f"\nDebugging catalog: {catalog_name}")
                print(f"  Expected filename: {catalog.filename}")
                print(f"  Fields defined: {[f.name for f in catalog.fields]}")
                
                # Try to extract the file from the ZIP and read it
                try:
                    import zipfile
                    import tempfile
                    
                    with tempfile.TemporaryDirectory() as temp_dir:
                        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                            # List all files in the ZIP
                            files_in_zip = zip_ref.namelist()
                            print(f"  Files in ZIP: {files_in_zip}")
                            
                            # Extract the specific file
                            try:
                                zip_ref.extract(catalog.filename, temp_dir)
                                file_path = os.path.join(temp_dir, catalog.filename)
                                print(f"  Extracted {catalog.filename} to {file_path}")
                                
                                # Try reading with different encodings
                                for encoding in ['utf-8', 'latin1', 'utf-8-sig']:
                                    try:
                                        print(f"  Trying to read with encoding: {encoding}")
                                        df = pd.read_csv(
                                            file_path,
                                            delimiter=catalog.file_format.delimiter,
                                            header=0 if catalog.file_format.header else None,
                                            encoding=encoding
                                        )
                                        print(f"  Success with encoding {encoding}!")
                                        print(f"  DataFrame shape: {df.shape}")
                                        print(f"  DataFrame columns: {list(df.columns)}")
                                        print(f"  First row: {df.iloc[0].tolist()}")
                                        
                                        # Check if expected columns are present
                                        expected_fields = [f.name for f in catalog.fields]
                                        if df.shape[1] != len(expected_fields):
                                            print(f"  WARNING: Number of columns in file ({df.shape[1]}) doesn't match number of fields defined in YAML ({len(expected_fields)})")
                                        
                                        # For debugging data mismatches
                                        if catalog_name == 'clientes':
                                            print("\nDebug information for clientes catalog:")
                                            print(f"  Expected fields: {expected_fields}")
                                            
                                            if df.shape[1] > len(expected_fields):
                                                print("  File has MORE columns than expected")
                                            elif df.shape[1] < len(expected_fields):
                                                print("  File has FEWER columns than expected")
                                            
                                            # Display field names with their positions
                                            print("\n  Field mapping (YAML definition <-> CSV position):")
                                            for i, field_name in enumerate(expected_fields):
                                                if i < df.shape[1]:
                                                    value = df.iloc[0, i]
                                                    print(f"    {field_name} (field {i+1}) => {value}")
                                                else:
                                                    print(f"    {field_name} (field {i+1}) => MISSING IN CSV")
                                        
                                        # Check the first two fields specifically
                                        if catalog_name == 'clientes' and df.shape[1] >= 2:
                                            print("\n  First two fields in the file:")
                                            print(f"    Field 1: {df.iloc[0, 0]}")
                                            print(f"    Field 2: {df.iloc[0, 1]}")
                                            
                                            # Check specifically the codigo_distribuidora field
                                            codigo_field_index = expected_fields.index('codigo_distribuidora') if 'codigo_distribuidora' in expected_fields else -1
                                            if codigo_field_index != -1 and codigo_field_index < df.shape[1]:
                                                print(f"\n  'codigo_distribuidora' field (index {codigo_field_index}):")
                                                print(f"    Value: {df.iloc[0, codigo_field_index]}")
                                            else:
                                                print("\n  'codigo_distribuidora' field not found or outside range")
                                        
                                        break  # Exit the encoding loop if successful
                                    except Exception as e2:
                                        print(f"  Error reading with encoding {encoding}: {str(e2)}")
                            except KeyError:
                                print(f"  ERROR: {catalog.filename} not found in ZIP file")
                except Exception as e2:
                    print(f"  ERROR extracting/processing {catalog_name}: {str(e2)}")
                    traceback.print_exc()
    
    except Exception as e:
        print(f"General error: {str(e)}")
        traceback.print_exc()

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) != 3:
        print("Usage: python -m sage.debug_file_processor <yaml_file> <zip_file>")
        sys.exit(1)
    
    yaml_path = sys.argv[1]
    zip_path = sys.argv[2]
    
    debug_process_file(yaml_path, zip_path)