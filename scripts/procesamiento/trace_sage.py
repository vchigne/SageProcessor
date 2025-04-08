import os
import sys
import traceback
import pandas as pd
import zipfile
from sage.main import process_files
from sage.file_processor import FileProcessor
from sage.yaml_validator import YAMLValidator

# Directory for debugging
os.makedirs('debug_output', exist_ok=True)

# Extract original files
zip_path = 'pruebas/Maestro productos Alicorp.zip'
yaml_path = 'pruebas/maestroAlicorp.yaml'

# First extract and save the excel file
with zipfile.ZipFile(zip_path, 'r') as zipf:
    zipf.extractall('debug_output')

# Now try to read it with pandas
excel_path = os.path.join('debug_output', 'Maestro productos Alicorp.xlsx')
print(f"Reading Excel file: {excel_path}")

try:
    df = pd.read_excel(excel_path)
    print(f"Success! Excel file read with pandas. Shape: {df.shape}")
    print(f"Columns: {df.columns.tolist()}")
    
    # Save first few rows as CSV for inspection
    sample_csv = os.path.join('debug_output', 'sample.csv')
    df.head(10).to_csv(sample_csv, index=False)
    print(f"Saved sample to {sample_csv}")
except Exception as e:
    print(f"Failed to read with pandas: {str(e)}")
    traceback.print_exc()

# Now let's try to monkey patch the FileProcessor to see what happens
class TracedFileProcessor(FileProcessor):
    def read_excel_file(self, file_path, sheet_name=0):
        print(f"\n=== TRACING: Reading Excel file: {file_path} ===")
        try:
            if not os.path.exists(file_path):
                print(f"ERROR: File does not exist: {file_path}")
                return None
            
            # Try to read the file
            result = super().read_excel_file(file_path, sheet_name)
            print(f"SUCCESS: Read Excel file. Shape: {result.shape}")
            print(f"Columns: {result.columns.tolist()}")
            return result
        except Exception as e:
            print(f"ERROR in read_excel_file: {str(e)}")
            traceback.print_exc()
            raise

# Replace original with traced version
FileProcessor.original_read_excel = FileProcessor.read_excel_file
FileProcessor.read_excel_file = TracedFileProcessor.read_excel_file

# Now run process_files to see what happens
print("\n=== Running process_files with tracing ===")
try:
    process_files(yaml_path, zip_path)
except Exception as e:
    print(f"\nError: {str(e)}")
    traceback.print_exc()