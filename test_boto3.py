import os
import traceback
import boto3

try:
    # Crear cliente S3 con las credenciales
    s3 = boto3.client(
        's3',
        aws_access_key_id='*********',
        aws_secret_access_key='**********',
        region_name='us-east-2'
    )
    print('Cliente S3 creado con éxito')
    
    # Listar buckets para probar la conexión
    response = s3.list_buckets()
    print(f"Buckets disponibles: {[bucket['Name'] for bucket in response['Buckets']]}")

except Exception as e:
    print(f'Error: {e}\n')
    traceback.print_exc()
