# Detalles Técnicos para Implementación Lambda en SAGE

Este documento complementa el Roadmap de implementación, proporcionando detalles técnicos específicos para cada componente del sistema de escalado con AWS Lambda.

## Componentes Clave

### 1. Adaptadores de Almacenamiento

#### Implementación de Abstracción de Almacenamiento

```python
class StorageAdapter:
    """Abstracción para almacenamiento de archivos de ejecución"""
    
    def __init__(self, config):
        self.config = config
        self.use_s3 = config.get('use_s3', False)
        self.s3_bucket = config.get('s3_bucket')
        self.s3_prefix = config.get('s3_prefix', 'executions/')
        self.local_path = config.get('local_path', './executions/')
        
        if self.use_s3:
            import boto3
            self.s3_client = boto3.client('s3')
    
    def write_file(self, execution_id, file_name, content):
        """Escribe un archivo en el almacenamiento apropiado"""
        if self.use_s3:
            key = f"{self.s3_prefix}{execution_id}/{file_name}"
            self.s3_client.put_object(
                Bucket=self.s3_bucket,
                Key=key,
                Body=content
            )
        else:
            os.makedirs(f"{self.local_path}/{execution_id}", exist_ok=True)
            with open(f"{self.local_path}/{execution_id}/{file_name}", 'wb') as f:
                f.write(content)
    
    def read_file(self, execution_id, file_name):
        """Lee un archivo del almacenamiento apropiado"""
        if self.use_s3:
            key = f"{self.s3_prefix}{execution_id}/{file_name}"
            response = self.s3_client.get_object(
                Bucket=self.s3_bucket,
                Key=key
            )
            return response['Body'].read()
        else:
            with open(f"{self.local_path}/{execution_id}/{file_name}", 'rb') as f:
                return f.read()
    
    def list_files(self, execution_id):
        """Lista archivos para una ejecución específica"""
        if self.use_s3:
            prefix = f"{self.s3_prefix}{execution_id}/"
            response = self.s3_client.list_objects_v2(
                Bucket=self.s3_bucket,
                Prefix=prefix
            )
            return [item['Key'].replace(prefix, '') for item in response.get('Contents', [])]
        else:
            path = f"{self.local_path}/{execution_id}"
            if os.path.exists(path):
                return os.listdir(path)
            return []
```

### 2. Sistema de Bloqueo Distribuido

#### Implementación con DynamoDB

```python
class DistributedLock:
    """Sistema de bloqueo distribuido usando DynamoDB"""
    
    def __init__(self, config):
        self.config = config
        self.table_name = config.get('lock_table', 'sage_execution_locks')
        self.ttl_seconds = config.get('lock_ttl_seconds', 3600)  # 1 hora por defecto
        
        import boto3
        self.dynamodb = boto3.resource('dynamodb')
        self.table = self.dynamodb.Table(self.table_name)
    
    def acquire(self, execution_id, owner_id=None):
        """Intenta adquirir un bloqueo para la ejecución"""
        import time
        from botocore.exceptions import ClientError
        
        if not owner_id:
            import uuid
            owner_id = str(uuid.uuid4())
        
        expiration_time = int(time.time()) + self.ttl_seconds
        
        try:
            # Usamos la operación condicional de DynamoDB para garantizar atomicidad
            self.table.put_item(
                Item={
                    'execution_id': execution_id,
                    'owner_id': owner_id,
                    'expiration_time': expiration_time
                },
                ConditionExpression='attribute_not_exists(execution_id)'
            )
            return True, owner_id
        except ClientError as e:
            if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
                # El bloqueo ya existe
                return False, None
            raise
    
    def release(self, execution_id, owner_id):
        """Libera un bloqueo si pertenece al propietario"""
        from botocore.exceptions import ClientError
        
        try:
            self.table.delete_item(
                Key={'execution_id': execution_id},
                ConditionExpression='owner_id = :owner',
                ExpressionAttributeValues={':owner': owner_id}
            )
            return True
        except ClientError as e:
            if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
                # El bloqueo no existe o pertenece a otro propietario
                return False
            raise
    
    def refresh(self, execution_id, owner_id):
        """Actualiza el TTL de un bloqueo existente"""
        import time
        from botocore.exceptions import ClientError
        
        expiration_time = int(time.time()) + self.ttl_seconds
        
        try:
            self.table.update_item(
                Key={'execution_id': execution_id},
                UpdateExpression='SET expiration_time = :exp',
                ConditionExpression='owner_id = :owner',
                ExpressionAttributeValues={
                    ':exp': expiration_time,
                    ':owner': owner_id
                }
            )
            return True
        except ClientError as e:
            if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
                return False
            raise
```

### 3. Modificación del sage_daemon

#### Lógica de Orquestación

```python
class LambdaOrchestrator:
    """Componente para orquestar ejecuciones entre local y Lambda"""
    
    def __init__(self, config):
        self.config = config
        self.max_local_executions = config.get('max_local_executions', 3)
        self.lambda_function_name = config.get('lambda_function_name', 'sage-file-processor')
        self.storage = StorageAdapter(config)
        self.lock = DistributedLock(config)
        
        import boto3
        self.lambda_client = boto3.client('lambda')
    
    def should_use_lambda(self, queue_size, current_system_load=None):
        """Determina si debe usarse Lambda"""
        if queue_size > self.max_local_executions:
            return True
            
        if current_system_load:
            # Podemos usar métricas de CPU, memoria, etc.
            if current_system_load.get('cpu_percent', 0) > 80:
                return True
        
        return False
    
    def invoke_lambda(self, execution_id, yaml_config, input_files):
        """Invoca una función Lambda para procesar"""
        import json
        
        payload = {
            'execution_id': execution_id,
            'yaml_config': yaml_config,
            'input_files': input_files
        }
        
        # Invocar la función Lambda de forma asincrónica
        response = self.lambda_client.invoke(
            FunctionName=self.lambda_function_name,
            InvocationType='Event',  # Asincrónico
            Payload=json.dumps(payload)
        )
        
        return response['StatusCode'] == 202  # 202 Accepted indica éxito para invocaciones asincrónicas
    
    def process_queue(self, execution_queue, system_metrics=None):
        """Procesa una cola de ejecuciones, delegando a Lambda según sea necesario"""
        active_local_executions = 0
        
        for execution in execution_queue:
            if active_local_executions < self.max_local_executions:
                # Procesar localmente
                # Implementar lógica para ejecutar localmente
                active_local_executions += 1
            else:
                # Delegar a Lambda
                success = self.invoke_lambda(
                    execution['id'], 
                    execution['yaml_config'], 
                    execution['input_files']
                )
                
                if not success:
                    # Manejar fallos en la invocación
                    # Tal vez intentar procesar localmente o reencolar
                    pass
```

### 4. Función Lambda para Procesamiento

#### Handler de Lambda Completo

```python
def lambda_handler(event, context):
    """Handler principal para la función Lambda de procesamiento de archivos SAGE"""
    import os
    import tempfile
    import json
    import traceback
    
    # Configuración y parámetros
    execution_id = event['execution_id']
    yaml_config = event['yaml_config']
    input_files = event['input_files']
    
    # Inicializar componentes necesarios
    config = {
        'use_s3': True,
        's3_bucket': os.environ['SAGE_S3_BUCKET'],
        'lock_table': os.environ['SAGE_LOCK_TABLE']
    }
    
    storage = StorageAdapter(config)
    lock = DistributedLock(config)
    
    # Adquirir bloqueo para esta ejecución
    acquired, owner_id = lock.acquire(execution_id)
    if not acquired:
        return {
            'statusCode': 409,
            'body': json.dumps({'error': 'Execution already in progress'})
        }
    
    try:
        # Preparar directorio temporal para archivos
        with tempfile.TemporaryDirectory() as temp_dir:
            execution_dir = os.path.join(temp_dir, execution_id)
            os.makedirs(execution_dir)
            
            # Descargar archivos necesarios al directorio temporal
            for file_info in input_files:
                file_content = storage.read_file(file_info['source_execution_id'], file_info['filename'])
                with open(os.path.join(execution_dir, file_info['filename']), 'wb') as f:
                    f.write(file_content)
            
            # Escribir configuración YAML
            with open(os.path.join(execution_dir, 'config.yaml'), 'w') as f:
                f.write(yaml_config)
            
            # Ejecutar procesamiento de archivos
            from sage.file_processor import FileProcessor  # Importar el procesador real
            
            processor = FileProcessor(
                yaml_path=os.path.join(execution_dir, 'config.yaml'),
                execution_dir=execution_dir
            )
            
            result = processor.process()
            
            # Subir resultados de regreso a almacenamiento
            for filename in os.listdir(execution_dir):
                if filename.startswith('output') or filename.startswith('log'):
                    with open(os.path.join(execution_dir, filename), 'rb') as f:
                        storage.write_file(execution_id, filename, f.read())
            
            # Registrar éxito en la base de datos
            # Este paso dependerá de la implementación específica
            
            return {
                'statusCode': 200,
                'body': json.dumps({
                    'status': 'success',
                    'execution_id': execution_id,
                    'result': result
                })
            }
    
    except Exception as e:
        # Registrar error
        error_message = str(e)
        stack_trace = traceback.format_exc()
        
        try:
            # Intentar guardar el error en el almacenamiento
            storage.write_file(
                execution_id, 
                'error.log', 
                f"Error: {error_message}\n\nStack trace:\n{stack_trace}".encode('utf-8')
            )
        except Exception:
            # Si falla el registro del error, al menos lo enviamos en la respuesta
            pass
        
        return {
            'statusCode': 500,
            'body': json.dumps({
                'status': 'error',
                'execution_id': execution_id,
                'error': error_message,
                'stack_trace': stack_trace
            })
        }
    
    finally:
        # Liberar el bloqueo
        lock.release(execution_id, owner_id)
```

## Configuraciones Recomendadas

### AWS Lambda

```
Runtime: Python 3.9+
Memory: 2048 MB (ajustar según complejidad del procesamiento)
Timeout: 15 minutos (máximo permitido)
Concurrency: Reservar 50 instancias para garantizar disponibilidad
VPC: Configurar para acceso a RDS si es necesario
Layers: Crear capas para dependencias pesadas
```

### DynamoDB para Bloqueos

```
Tabla: sage_execution_locks
Clave Primaria: execution_id (String)
TTL: Habilitar en campo expiration_time
Capacidad: Bajo demanda para costos optimizados
```

### S3 para Almacenamiento

```
Bucket: sage-executions
Estructura:
  - executions/
    - <execution_id>/
      - input.csv
      - output.csv
      - log.txt
      - error.log
      - ...
Lifecycle: Configurar eliminación automática después de 30 días
Encryption: Habilitar por defecto
```

### CloudWatch

```
Alarmas:
  - Errores Lambda > 5 en 5 minutos
  - Duración Lambda > 10 minutos
  - Concurrencia Lambda > 90% de límite reservado
  
Dashboards:
  - Distribución de procesamiento (local vs. Lambda)
  - Tiempo promedio de procesamiento
  - Tasa de éxito/fallo
  - Costo diario
```

## Consideraciones Adicionales

### Optimización de Rendimiento

- **Cold Starts**: Usar Provisioned Concurrency para funciones Lambda críticas
- **Memoria**: Ajustar memoria de Lambda según métricas de rendimiento
- **Compresión**: Comprimir archivos grandes antes de transferir entre servicios

### Gestión de Costos

- **Reserved Concurrency**: Utilizar para priorizar funciones críticas
- **Monitoreo**: Implementar dashboard de costos diarios
- **Optimización**: Ajuste de memoria/duración Lambda según uso real

### Seguridad

- **IAM**: Principio de mínimo privilegio para todos los roles
- **Encryption**: Encriptación en tránsito y en reposo
- **VPC**: Restringir acceso según necesidad real
- **Secretos**: Usar Secrets Manager para credenciales

### Recuperación ante Desastres

- **Reintentos**: Automatizar reintentos con backoff exponencial
- **Fallback**: Sistema para detectar y reintentar ejecuciones fallidas
- **Multi-región**: Considerar respaldo en región alternativa para alta disponibilidad