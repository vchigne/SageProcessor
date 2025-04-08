# Lista de archivos y directorios para limpieza

## Directorios de prueba/temporales (Tamaño total: ~1.4GB)
Estos directorios parecen ser temporales o de prueba y podrían eliminarse:

1. **Directorios de ejecución de pruebas** (736MB):
   - `/executions/` (682MB - Directorio de ejecuciones en la raíz)
   - `/tests/executions/` (54MB - Contiene miles de directorios de ejecuciones de prueba)
   - `/test_execution_dir/` (4KB)

2. **Directorios temporales** (161MB):
   - `/temp_extract_no_bom/` (109MB)
   - `/temp_extract/` (52MB)
   - `/tmp/`
   - `/debug_output/` (28KB)

3. **Directorios de prueba específicos** (521MB):
   - `/test_csv/` (412MB) - Muy grande, probablemente contiene muchos datos de prueba
   - `/test_cli/` (48MB)
   - `/test_YAML_Studio/` (64KB)
   - `/test_data/` (32KB)
   - `/test_multi_tipo_error/` (24KB)
   - `/test_multi_error/` (20KB)
   - `/test_results_log/` (12KB)
   - `/test_faltante/` (12KB)
   - `/test_bom/` (4KB)
   - `/test_columnas_error/` (4KB)
   - `/test_columnas_extra/` (4KB)
   - `/test_pequeno/` (4KB)
   - `/pruebas/`

## Archivos de prueba y depuración (Tamaño total: ~164KB)
Estos archivos parecen ser utilizados para pruebas o depuración:

1. **Scripts de depuración** (24KB):
   - `debug_sage_cli.py` (8KB)
   - `debug_sage.py` (4KB)
   - `debug_logger.py` (4KB)
   - `debug_csv_structure.py` (4KB)
   - `trace_sage.py` (4KB)

2. **Scripts de prueba** (128KB):
   - `test_strict_validation.py` (12KB)
   - `test_robust_simple.py` (12KB)
   - `test_results_generation.py` (12KB)
   - `test_yaml_studio_bom_complete.py` (8KB)
   - `test_yaml_o3_mini.py` (8KB)
   - `test_optimized_file_processor.py` (8KB)
   - `test_json_export.py` (8KB)
   - `test_column_validation.py` (8KB)
   - `test_bom_support.py` (8KB)
   - `test_yaml_studio_prompt.py` (4KB)
   - `test_yaml_studio_bom.py` (4KB)
   - `test_yaml_prompt.py` (4KB)
   - `test_yaml_o3_mini_improved.py` (4KB)
   - `test_simple_openrouter.py` (4KB)
   - `test_robust_validation.py` (4KB)
   - `test_results_txt.py` (4KB)
   - `test_openrouter.py` (4KB)
   - `test_generator_fix.py` (4KB)
   - `test_full_validation.py` (4KB)
   - `test_distribuidor.py` (4KB)
   - `test_create_columns.py` (4KB)
   - `test_cli_generate.py` (4KB)

3. **Scripts de verificación y demostración** (24KB):
   - `show_yaml_example.py` (8KB)
   - `show_yaml_example_improved.py` (4KB)
   - `show_prompt.py` (4KB)
   - `show_bom_detection.py` (4KB)

## Archivos temporales y de datos de prueba (Tamaño total: ~290MB)
Estos archivos parecen ser temporales o utilizados para pruebas:

1. **Archivos CSV y ZIP de prueba** (289MB):
   - `temp_extra_columns.zip` (112MB)
   - `temp_missing_columns.zip` (109MB)
   - `temp_missing_file.zip` (58MB)
   - `output_no_bom.zip` (12MB)
   - `test_pequeno.zip` (4KB)
   - `test_faltante.zip` (4KB)
   - `test_columnas_extra.zip` (4KB)
   - `test_columnas_error.zip` (4KB)
   - `test_bom.zip` (4KB)
   - `test_bom.csv` (4KB)
   - `temp_test.csv` (4KB)
   - `data.csv` (4KB)

2. **Archivos YAML de prueba** (28KB):
   - `test_output_o3mini.yaml` (4KB)
   - `test_output_o3mini_improved.yaml` (4KB)
   - `temp_test.yaml` (4KB)
   - `output_simple_test.yaml` (4KB)
   - `invalid_example.yaml` (4KB)
   - `example.yaml` (4KB)
   - `example_bom_support.yaml` (4KB)
   - `example_bom_support_improved.yaml` (4KB)
   - `example_bom_support_corrected.yaml` (4KB)

3. **Archivos de texto y logs** (96KB):
   - `test_prompt_improved.txt` (68KB)
   - `test_prompt.txt` (16KB)
   - `output.log` (8KB)
   - `procesar_clorox_bom.log` (4KB)
   - `output_analisis.txt` (0KB)

## Scripts de utilidad que se podrían mover a un directorio específico (Tamaño total: ~124KB)
Estos scripts podrían ser útiles pero deberían estar organizados en un directorio:

1. **Scripts de análisis** (24KB):
   - `analizar_archivos.py` (12KB)
   - `analizar_yaml.py` (12KB)

2. **Scripts de procesamiento** (76KB):
   - `generate_test_prompt.py` (20KB)
   - `eliminar_bom.py` (8KB)
   - `sage_strict.py` (8KB)
   - `sage_simple_validator.py` (8KB)
   - `sage_names_patch.py` (8KB)
   - `sage_json_export.py` (8KB)
   - `sage_column_validator.py` (8KB)
   - `sage_robust.py` (4KB)
   - `sage_fixed.py` (4KB)
   - `sage_con_bom.py` (4KB)
   - `sage_bom.py` (4KB)
   - `procesar_clorox_simple.py` (4KB)
   - `procesar_clorox.py` (4KB)
   - `procesar_clorox_bom.py` (4KB)
   - `ejecutar_processor.py` (4KB)
   - `check_sage_file_processor.py` (4KB)
   - `cleanup_executions.py` (4KB)

3. **Scripts de validación** (24KB):
   - `validar_con_sage.py` (16KB)
   - `validar_con_reporte.py` (8KB)
   - `validar.sh`
   - `validar_con_json.sh`
   - `validar_con_reporte.sh`

## Otros directorios a revisar
Estos directorios pueden contener información histórica o de respaldo:

1. **Directorios de respaldo** (32KB):
   - `/backups/` (20KB)
   - `/database_backups/` (12KB)

## Resumen de tamaños

| Categoría | Tamaño aproximado | % del total |
|-----------|------------------|------------|
| Directorios de ejecución de pruebas | 736MB | 42.6% |
| Directorios de prueba específicos | 521MB | 30.2% |
| Archivos CSV y ZIP de prueba | 289MB | 16.7% |
| Directorios temporales | 161MB | 9.3% |
| Scripts de prueba y depuración | 164KB | 0.01% |
| Scripts de utilidad | 124KB | 0.01% |
| Archivos de texto y logs | 96KB | 0.01% |
| Archivos YAML de prueba | 28KB | 0.001% |
| Directorios de respaldo | 32KB | 0.001% |
| **Total aproximado** | **~1.7GB** | **100%** |

## Recomendaciones
1. **Liberar espacio gradualmente**: 
   - Fase 1: Eliminar primero los directorios más grandes (~1.4GB): `/executions/`, `/temp_extract_no_bom/`, `/test_csv/`
   - Fase 2: Eliminar los archivos ZIP temporales grandes (279MB): `temp_extra_columns.zip`, `temp_missing_columns.zip`, `temp_missing_file.zip`
   - Fase 3: Realizar limpieza de archivos de prueba más pequeños

2. **Organizar scripts útiles**: 
   - Crear un directorio `/scripts/` para los scripts de utilidad que se quieren conservar
   - Mover los scripts de análisis, procesamiento y validación a este directorio

3. **Realizar copia de seguridad**:
   - Crear un respaldo completo de los archivos antes de eliminarlos, por si se necesitan en el futuro

## Notas importantes
- **Verificar dependencias**: Asegurarse de que no se eliminen archivos necesarios para el funcionamiento del sistema
- **Revisar referencias**: Verificar que no haya referencias en el código a los archivos que se eliminarán
- **Comunicar cambios**: Consultar con el equipo antes de eliminar archivos que puedan ser utilizados por otros desarrolladores
- **Limpieza periódica**: Establecer un proceso de limpieza periódica para evitar la acumulación de archivos temporales en el futuro