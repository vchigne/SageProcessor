-- Script para inicializar la base de datos SAGE en un servidor nuevo
-- Creado para despliegue en nuevos servidores

-- Crear extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================
-- TABLAS PRINCIPALES
-- ========================================

-- Tabla de países (referencias del sistema actual)
CREATE TABLE IF NOT EXISTS paises (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    codigo_iso VARCHAR(3),
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de organizaciones
CREATE TABLE IF NOT EXISTS organizaciones (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de productos
CREATE TABLE IF NOT EXISTS productos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    version VARCHAR(50),
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de instalaciones
CREATE TABLE IF NOT EXISTS instalaciones (
    id SERIAL PRIMARY KEY,
    organizacion_id INTEGER REFERENCES organizaciones(id),
    pais_id INTEGER REFERENCES paises(id),
    producto_id INTEGER REFERENCES productos(id),
    nombre TEXT
);

-- Tabla de casillas (estructura real del sistema)
CREATE TABLE IF NOT EXISTS casillas (
    id SERIAL PRIMARY KEY,
    instalacion_id INTEGER REFERENCES instalaciones(id),
    nombre_yaml VARCHAR(255) NOT NULL,
    email_casilla VARCHAR(255),
    api_endpoint VARCHAR(255),
    api_key VARCHAR(255),
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    nombre VARCHAR(255),
    descripcion VARCHAR(255),
    yaml_contenido TEXT
);

-- Tabla de respaldo de casillas
CREATE TABLE IF NOT EXISTS casillas_backup (
    id SERIAL PRIMARY KEY,
    casilla_id INTEGER NOT NULL,
    nombre_backup VARCHAR(255) NOT NULL,
    yaml_contenido TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- TABLAS DE CLOUD Y SECRETS
-- ========================================

-- Tabla de secrets de nube
CREATE TABLE IF NOT EXISTS cloud_secrets (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    tipo VARCHAR(255) NOT NULL,
    secretos JSONB NOT NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    modificado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    activo BOOLEAN DEFAULT TRUE
);

-- Tabla de proveedores de nube
CREATE TABLE IF NOT EXISTS cloud_providers (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    tipo VARCHAR(255) NOT NULL,
    credenciales JSONB NOT NULL,
    configuracion JSONB NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    estado VARCHAR(255),
    ultimo_chequeo TIMESTAMP,
    mensaje_error TEXT,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    modificado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    secreto_id INTEGER REFERENCES cloud_secrets(id)
);

-- ========================================
-- TABLAS DE BASE DE DATOS
-- ========================================

-- Tabla de secrets de base de datos
CREATE TABLE IF NOT EXISTS db_secrets (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    tipo VARCHAR(255) NOT NULL,
    servidor VARCHAR(255) NOT NULL,
    puerto INTEGER NOT NULL,
    usuario VARCHAR(255) NOT NULL,
    contrasena VARCHAR(255),
    basedatos VARCHAR(255),
    opciones_conexion JSONB,
    estado VARCHAR(255),
    ultimo_test TIMESTAMP,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de conexiones de base de datos
CREATE TABLE IF NOT EXISTS database_connections (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    secret_id INTEGER NOT NULL REFERENCES db_secrets(id),
    base_datos VARCHAR(255) NOT NULL,
    esquema VARCHAR(255),
    configuracion JSONB,
    estado_conexion VARCHAR(255),
    ultimo_test TIMESTAMP,
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de logs de operaciones de BD
CREATE TABLE IF NOT EXISTS db_operations_log (
    id SERIAL PRIMARY KEY,
    secreto_id INTEGER NOT NULL,
    operacion VARCHAR(255) NOT NULL,
    detalles JSONB,
    estado VARCHAR(255),
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- TABLAS DE EMISORES
-- ========================================

-- Tabla de emisores
CREATE TABLE IF NOT EXISTS emisores (
    id SERIAL PRIMARY KEY,
    organizacion_id INTEGER REFERENCES organizaciones(id),
    nombre VARCHAR(255) NOT NULL,
    email_corporativo VARCHAR(255) NOT NULL,
    telefono VARCHAR(255),
    tipo_emisor VARCHAR(255),
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    activo BOOLEAN DEFAULT TRUE,
    codigo_interno VARCHAR(255),
    codigo_agente_merlin VARCHAR(255),
    tipo_origen VARCHAR(255),
    sftp_servidor VARCHAR(255),
    sftp_puerto INTEGER,
    sftp_usuario VARCHAR(255),
    sftp_clave VARCHAR(255),
    sftp_directorio VARCHAR(255),
    cloud_secret_id INTEGER REFERENCES cloud_secrets(id),
    bucket_nombre VARCHAR(255)
);

-- Tabla de frecuencias tipo
CREATE TABLE IF NOT EXISTS frecuencias_tipo (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE
);

-- Tabla de emisores por casilla
CREATE TABLE IF NOT EXISTS emisores_por_casilla (
    id SERIAL PRIMARY KEY,
    emisor_id INTEGER REFERENCES emisores(id),
    casilla_id INTEGER REFERENCES casillas(id),
    metodo_envio VARCHAR(255),
    parametros JSONB NOT NULL,
    responsable_nombre VARCHAR(255),
    responsable_email VARCHAR(255),
    responsable_telefono VARCHAR(255),
    configuracion_frecuencia JSONB,
    frecuencia_tipo_id INTEGER REFERENCES frecuencias_tipo(id),
    responsable_activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    responsable TEXT,
    frecuencia TEXT,
    emisor_sftp_subdirectorio VARCHAR(255),
    emisor_bucket_prefijo VARCHAR(255)
);

-- Tabla de logs de emisores por casilla
CREATE TABLE IF NOT EXISTS emisores_por_casilla_logs (
    id SERIAL PRIMARY KEY,
    operacion TEXT NOT NULL,
    emisor_id INTEGER NOT NULL,
    casilla_id INTEGER NOT NULL,
    metodo_envio TEXT,
    parametros JSONB,
    responsable_nombre TEXT,
    responsable_email TEXT,
    responsable_telefono TEXT,
    emisor_sftp_subdirectorio TEXT,
    emisor_bucket_prefijo TEXT,
    fecha_operacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- TABLAS DE EJECUCIONES
-- ========================================

-- Configuración de ejecuciones
CREATE TABLE IF NOT EXISTS ejecuciones_config (
    id SERIAL PRIMARY KEY,
    nube_primaria_id INTEGER REFERENCES cloud_providers(id),
    nubes_alternativas INTEGER[],
    tiempo_retencion_local INTEGER,
    prefijo_ruta_nube VARCHAR(255),
    migrar_automaticamente BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de ejecuciones YAML (estructura real del sistema)
CREATE TABLE IF NOT EXISTS ejecuciones_yaml (
    id SERIAL PRIMARY KEY,
    uuid UUID,
    nombre_yaml VARCHAR(255) NOT NULL,
    archivo_datos VARCHAR(255) NOT NULL,
    fecha_ejecucion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    estado VARCHAR(255),
    errores_detectados INTEGER,
    warnings_detectados INTEGER,
    ruta_directorio TEXT NOT NULL,
    casilla_id INTEGER REFERENCES casillas(id),
    emisor_id INTEGER REFERENCES emisores(id),
    metodo_envio VARCHAR(255),
    nube_primaria_id INTEGER REFERENCES cloud_providers(id),
    ruta_nube VARCHAR(255),
    nubes_alternativas INTEGER[],
    rutas_alternativas VARCHAR(255)[],
    migrado_a_nube BOOLEAN DEFAULT FALSE
);

-- Tabla de envíos realizados
CREATE TABLE IF NOT EXISTS envios_realizados (
    id SERIAL PRIMARY KEY,
    emisor_id INTEGER REFERENCES emisores(id),
    casilla_recepcion_id INTEGER REFERENCES casillas(id),
    metodo_envio VARCHAR(255),
    usuario_envio_id INTEGER,
    fecha_envio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    archivo_nombre VARCHAR(255) NOT NULL,
    uuid_ejecucion UUID,
    estado VARCHAR(255)
);

-- ========================================
-- TABLAS DE MATERIALIZACIONES
-- ========================================

-- Tabla de materializaciones
CREATE TABLE IF NOT EXISTS materializaciones (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    casilla_id INTEGER NOT NULL REFERENCES casillas(id),
    configuracion JSONB,
    estado VARCHAR(255),
    ultima_materializacion TIMESTAMP,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Servidores de materialización
CREATE TABLE IF NOT EXISTS materializacion_servidores (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    url VARCHAR(255) NOT NULL,
    api_key VARCHAR(255) NOT NULL,
    configuracion JSONB,
    estado VARCHAR(255),
    ultimo_test TIMESTAMP,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Destinos de materialización
CREATE TABLE IF NOT EXISTS materializacion_destinos (
    id SERIAL PRIMARY KEY,
    materializacion_id INTEGER NOT NULL REFERENCES materializaciones(id),
    nombre VARCHAR(255) NOT NULL,
    tipo VARCHAR(255) NOT NULL,
    connection_id INTEGER REFERENCES database_connections(id),
    cloud_provider_id INTEGER REFERENCES cloud_providers(id),
    ruta_destino VARCHAR(255),
    estrategia_actualizacion VARCHAR(255),
    configuracion JSONB,
    estado VARCHAR(255),
    ultimo_test TIMESTAMP,
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tablas de materialización
CREATE TABLE IF NOT EXISTS materializacion_tablas (
    id SERIAL PRIMARY KEY,
    materializacion_id INTEGER NOT NULL REFERENCES materializaciones(id),
    nombre VARCHAR(255) NOT NULL,
    tabla_origen VARCHAR(255) NOT NULL,
    esquema_columnas JSONB NOT NULL,
    clave_primaria VARCHAR(255)[] NOT NULL,
    columnas_particion VARCHAR(255)[],
    columnas_agrupacion VARCHAR(255)[],
    formato_destino VARCHAR(255),
    configuracion JSONB,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Logs de materializaciones
CREATE TABLE IF NOT EXISTS materializacion_logs (
    id SERIAL PRIMARY KEY,
    materializacion_id INTEGER NOT NULL REFERENCES materializaciones(id),
    destino_id INTEGER REFERENCES materializacion_destinos(id),
    servidor_id INTEGER REFERENCES materializacion_servidores(id),
    estado VARCHAR(255) NOT NULL,
    mensaje TEXT,
    detalles JSONB,
    fecha_inicio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_fin TIMESTAMP,
    activo BOOLEAN DEFAULT TRUE
);

-- Ejecuciones de materializaciones
CREATE TABLE IF NOT EXISTS materializaciones_ejecuciones (
    id SERIAL PRIMARY KEY,
    materialization_id INTEGER REFERENCES materializaciones(id),
    execution_id VARCHAR(255),
    estado VARCHAR(255),
    mensaje TEXT,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- TABLAS DE EMAIL Y NOTIFICACIONES
-- ========================================

-- Configuraciones de email
CREATE TABLE IF NOT EXISTS email_configuraciones (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    direccion VARCHAR(255) NOT NULL,
    proposito VARCHAR(255) NOT NULL,
    servidor_entrada VARCHAR(255),
    puerto_entrada INTEGER,
    protocolo_entrada VARCHAR(255),
    usar_ssl_entrada BOOLEAN DEFAULT TRUE,
    servidor_salida VARCHAR(255),
    puerto_salida INTEGER,
    usar_tls_salida BOOLEAN DEFAULT TRUE,
    usuario VARCHAR(255) NOT NULL,
    password VARCHAR(255),
    casilla_id INTEGER REFERENCES casillas(id),
    estado VARCHAR(255) NOT NULL,
    ultimo_chequeo TIMESTAMP,
    mensaje_error TEXT,
    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Plantillas de email
CREATE TABLE IF NOT EXISTS plantillas_email (
    asunto VARCHAR(255),
    contenido_html TEXT,
    contenido_texto TEXT,
    es_predeterminada BOOLEAN DEFAULT FALSE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Clientes plantilla
CREATE TABLE IF NOT EXISTS cliente_plantilla (
    id SERIAL PRIMARY KEY,
    cliente_id INTEGER NOT NULL,
    plantilla_id INTEGER NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Eventos de notificación
CREATE TABLE IF NOT EXISTS eventos_notificacion (
    id SERIAL PRIMARY KEY,
    tipo VARCHAR(255) NOT NULL,
    emisor VARCHAR(255) NOT NULL,
    casilla_id INTEGER REFERENCES casillas(id),
    mensaje TEXT NOT NULL,
    detalles JSONB,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    procesado BOOLEAN DEFAULT FALSE,
    fecha_procesado TIMESTAMP WITH TIME ZONE
);

-- Suscripciones de notificaciones
CREATE TABLE IF NOT EXISTS notification_subscriptions (
    id SERIAL PRIMARY KEY,
    casilla_id INTEGER REFERENCES casillas(id),
    tipo VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    nombre VARCHAR(255),
    telefono VARCHAR(255),
    tipos_evento JSONB,
    frecuencia VARCHAR(255) DEFAULT 'inmediata',
    configuracion JSONB,
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ultima_notificacion TIMESTAMP WITH TIME ZONE
);

-- Eventos pendientes
CREATE TABLE IF NOT EXISTS eventos_pendientes (
    id SERIAL PRIMARY KEY,
    suscripcion_id INTEGER NOT NULL REFERENCES notification_subscriptions(id),
    evento_id INTEGER NOT NULL REFERENCES eventos_notificacion(id),
    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_programada TIMESTAMP,
    procesado BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_procesado TIMESTAMP,
    intentos INTEGER NOT NULL DEFAULT 0,
    ultimo_error TEXT
);

-- ========================================
-- TABLAS DE DUCKDB
-- ========================================

-- Servidores DuckDB
CREATE TABLE IF NOT EXISTS duckdb_servers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    hostname VARCHAR(255) NOT NULL,
    port INTEGER NOT NULL,
    server_key VARCHAR(255),
    server_type VARCHAR(255) NOT NULL,
    is_local BOOLEAN DEFAULT FALSE,
    status VARCHAR(255),
    cloud_secret_id VARCHAR(255),
    bucket_name VARCHAR(255),
    installation_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ssh_host VARCHAR(255),
    ssh_port INTEGER,
    ssh_username VARCHAR(255),
    ssh_password VARCHAR(255),
    ssh_key TEXT,
    last_error TEXT
);

-- Logs de servidores DuckDB
CREATE TABLE IF NOT EXISTS duckdb_server_logs (
    id SERIAL PRIMARY KEY,
    server_id INTEGER NOT NULL REFERENCES duckdb_servers(id),
    operation VARCHAR(255) NOT NULL,
    status VARCHAR(255) NOT NULL,
    message TEXT,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- ÍNDICES PARA OPTIMIZACIÓN
-- ========================================

-- Índices en ejecuciones_yaml
CREATE INDEX IF NOT EXISTS idx_ejecuciones_fecha ON ejecuciones_yaml(fecha_ejecucion);
CREATE INDEX IF NOT EXISTS idx_ejecuciones_estado ON ejecuciones_yaml(estado);
CREATE INDEX IF NOT EXISTS idx_ejecuciones_casilla ON ejecuciones_yaml(casilla_id);
CREATE INDEX IF NOT EXISTS idx_ejecuciones_uuid ON ejecuciones_yaml(uuid);

-- Índices en casillas
CREATE INDEX IF NOT EXISTS idx_casillas_instalacion ON casillas(instalacion_id);
CREATE INDEX IF NOT EXISTS idx_casillas_activo ON casillas(is_active);

-- Índices en materializaciones
CREATE INDEX IF NOT EXISTS idx_materializaciones_casilla ON materializaciones(casilla_id);

-- Índices en notificaciones
CREATE INDEX IF NOT EXISTS idx_notifications_casilla ON notification_subscriptions(casilla_id);
CREATE INDEX IF NOT EXISTS idx_notifications_activo ON notification_subscriptions(activo);

-- Índices en emisores
CREATE INDEX IF NOT EXISTS idx_emisores_organizacion ON emisores(organizacion_id);
CREATE INDEX IF NOT EXISTS idx_emisores_activo ON emisores(activo);

-- Índices en cloud_providers
CREATE INDEX IF NOT EXISTS idx_cloud_providers_tipo ON cloud_providers(tipo);
CREATE INDEX IF NOT EXISTS idx_cloud_providers_activo ON cloud_providers(activo);

-- Índices en emisores_por_casilla
CREATE INDEX IF NOT EXISTS idx_emisores_por_casilla_emisor ON emisores_por_casilla(emisor_id);
CREATE INDEX IF NOT EXISTS idx_emisores_por_casilla_casilla ON emisores_por_casilla(casilla_id);

-- Índices en envios_realizados
CREATE INDEX IF NOT EXISTS idx_envios_realizados_fecha ON envios_realizados(fecha_envio);
CREATE INDEX IF NOT EXISTS idx_envios_realizados_emisor ON envios_realizados(emisor_id);
CREATE INDEX IF NOT EXISTS idx_envios_realizados_uuid ON envios_realizados(uuid_ejecucion);

-- ========================================
-- DATOS INICIALES BÁSICOS
-- ========================================

-- Insertar países básicos
INSERT INTO paises (nombre, codigo_iso) VALUES 
('Perú', 'PER'),
('Colombia', 'COL'),
('México', 'MEX'),
('Argentina', 'ARG'),
('Chile', 'CHL'),
('Brasil', 'BRA')
ON CONFLICT (nombre) DO NOTHING;

-- Insertar organizaciones ejemplo
INSERT INTO organizaciones (nombre, descripcion) VALUES 
('Strategio', 'Plataforma de gestión de datos empresariales'),
('Mondelez', 'Empresa multinacional de alimentos y bebidas'),
('Coca-Cola', 'Empresa de bebidas'),
('Nestlé', 'Empresa de alimentos y bebidas')
ON CONFLICT DO NOTHING;

-- Insertar productos ejemplo
INSERT INTO productos (nombre, descripcion, version) VALUES 
('Strategio Canal Tradicional', 'Sistema de análisis de canal tradicional', '1.0'),
('Strategio Modern Trade', 'Sistema de análisis de comercio moderno', '1.0'),
('SAGE Data Validator', 'Validador de datos SAGE', '2.0')
ON CONFLICT DO NOTHING;

-- ========================================
-- FUNCIONES ÚTILES
-- ========================================

-- Función para limpiar ejecuciones antiguas
CREATE OR REPLACE FUNCTION limpiar_ejecuciones_antiguas(dias_antiguedad INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    registros_eliminados INTEGER;
BEGIN
    DELETE FROM ejecuciones_yaml 
    WHERE fecha_ejecucion < CURRENT_DATE - INTERVAL '1 day' * dias_antiguedad
    AND migrado_cloud = TRUE;
    
    GET DIAGNOSTICS registros_eliminados = ROW_COUNT;
    RETURN registros_eliminados;
END;
$$ LANGUAGE plpgsql;

-- Función para obtener estadísticas del dashboard
CREATE OR REPLACE FUNCTION obtener_estadisticas_dashboard(dias INTEGER DEFAULT 30)
RETURNS TABLE(
    archivos_procesados BIGINT,
    archivos_exitosos BIGINT,
    archivos_fallidos BIGINT,
    archivos_parciales BIGINT,
    tasa_exito DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*) AS archivos_procesados,
        COUNT(CASE WHEN estado = 'Éxito' THEN 1 END) AS archivos_exitosos,
        COUNT(CASE WHEN estado = 'Fallido' THEN 1 END) AS archivos_fallidos,
        COUNT(CASE WHEN estado = 'Parcial' THEN 1 END) AS archivos_parciales,
        CASE 
            WHEN COUNT(*) > 0 THEN 
                ROUND((COUNT(CASE WHEN estado = 'Éxito' THEN 1 END)::DECIMAL / COUNT(*)) * 100, 2)
            ELSE 0
        END AS tasa_exito
    FROM ejecuciones_yaml
    WHERE fecha_ejecucion > CURRENT_DATE - INTERVAL '1 day' * dias;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- CONFIGURACIÓN FINAL
-- ========================================

-- Crear usuario específico para la aplicación (opcional)
-- CREATE USER sage_user WITH PASSWORD 'secure_password_here';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO sage_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO sage_user;

-- Configurar parámetros de PostgreSQL recomendados
-- ALTER SYSTEM SET shared_buffers = '256MB';
-- ALTER SYSTEM SET effective_cache_size = '1GB';
-- ALTER SYSTEM SET maintenance_work_mem = '64MB';
-- ALTER SYSTEM SET random_page_cost = 1.1;

COMMIT;

-- Mensaje de confirmación
SELECT 'Base de datos SAGE inicializada correctamente' AS mensaje;
SELECT 'Total de tablas creadas: ' || COUNT(*) AS estadisticas 
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';