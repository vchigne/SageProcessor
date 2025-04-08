"""CLI for generating test data"""
import os
import argparse
from .test_data_generator import TestDataGenerator

def main():
    parser = argparse.ArgumentParser(
        description="Generate test data for YAML Studio",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python -m sage.generate_test_data
  python -m sage.generate_test_data --output-dir ./my_test_data
        """
    )
    
    parser.add_argument(
        "--output-dir",
        help="Directory where test files will be generated",
        default="test_YAML_Studio"
    )
    
    args = parser.parse_args()
    
    print("🚀 Generating test data for YAML Studio...")
    generator = TestDataGenerator(args.output_dir)
    files = generator.generate_all()
    
    print("\n✅ Test files generated successfully!\n")
    print("📁 Directory structure created:")
    print(f"  📂 {args.output_dir}/")
    print(f"  ├─ 📂 input_files/      (Test files)")
    print(f"  ├─ 📂 generated_yaml/   (For AI-generated YAMLs)")
    print(f"  ├─ 📂 validation_logs/  (Validation results)")
    print(f"  └─ 📂 processing_output/(CLI processing results)")
    
    print("\n📄 Generated files:")
    for file_type, file_list in files.items():
        print(f"\n🗂️  {file_type.upper()}:")
        for f in file_list:
            print(f"  ├─ {os.path.basename(f)}")

if __name__ == "__main__":
    main()
