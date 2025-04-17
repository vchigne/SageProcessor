import os
import logging
import tempfile
import shutil
from datetime import datetime

# Configurar logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger('test_s3_direct')

def upload_to_s3_direct():
    """Prueba una subida directa a S3 sin usar boto3"""
    import subprocess
    import json
    
    # Crear un archivo de prueba
    temp_dir = tempfile.mkdtemp()
    test_file = os.path.join(temp_dir, 'test.txt')
    with open(test_file, 'w') as f:
        f.write(f"Archivo de prueba creado el {datetime.now().isoformat()}")
    
    logger.info(f"Archivo de prueba creado: {test_file}")
    
    # Credenciales S3
    bucket = 'sage.vidasoft'
    region = 'us-east-2'
    access_key = 'AKIA23WII4ZHBQFEIM4Q'
    secret_key = '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'
    
    # Configurar AWS CLI a través de variables de entorno
    env = os.environ.copy()
    env['AWS_ACCESS_KEY_ID'] = access_key
    env['AWS_SECRET_ACCESS_KEY'] = secret_key
    env['AWS_DEFAULT_REGION'] = region
    
    # Ruta en S3
    s3_path = f"s3://{bucket}/test_direct_upload/{datetime.now().strftime('%Y-%m-%d_%H-%M-%S')}/test.txt"
    
    try:
        # Subir archivo usando AWS CLI
        logger.info(f"Subiendo archivo a {s3_path}")
        result = subprocess.run(['aws', 's3', 'cp', test_file, s3_path], 
                              env=env, 
                              capture_output=True, 
                              text=True)
        
        if result.returncode == 0:
            logger.info(f"Archivo subido exitosamente: {result.stdout}")
        else:
            logger.error(f"Error al subir archivo: {result.stderr}")
    except Exception as e:
        logger.error(f"Excepción: {e}")
    finally:
        # Limpiar
        shutil.rmtree(temp_dir)
        logger.info(f"Directorio temporal eliminado: {temp_dir}")

if __name__ == "__main__":
    upload_to_s3_direct()