/**
 * API para inspeccionar contenido de un bucket específico de un secreto de nube
 * 
 * Esta API utiliza la misma implementación que la API de inspección en SAGE CLOUDS
 * para garantizar consistencia en el comportamiento, especialmente para Azure.
 */
import { pool } from '@/utils/db';
import { getAdapter } from '@/utils/cloud';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Método no permitido'
    });
  }
  
  const { id, bucketName } = req.query;
  const { path = '' } = req.body;
  
  if (!id || isNaN(parseInt(id))) {
    return res.status(400).json({
      success: false,
      message: 'ID de secreto de nube inválido'
    });
  }
  
  if (!bucketName) {
    return res.status(400).json({
      success: false,
      message: 'Nombre de bucket requerido'
    });
  }
  
  const secretoId = parseInt(id);
  let secreto = null;
  
  try {
    // Obtener detalles del secreto
    const client = await pool.connect();
    
    try {
      const result = await client.query(
        `SELECT id, nombre, descripcion, tipo as tipo_proveedor, secretos as credentials, activo, creado_en, modificado_en
         FROM cloud_secrets
         WHERE id = $1`,
        [secretoId]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Secreto de nube no encontrado'
        });
      }
      
      secreto = result.rows[0];
      
      // Convertir credenciales de JSON string a objeto
      if (typeof secreto.credentials === 'string') {
        secreto.credentials = JSON.parse(secreto.credentials);
      }
    } finally {
      client.release();
    }
    
    // Determinar qué adaptador usar según el tipo de proveedor
    const adapter = getAdapter(secreto.tipo_proveedor);
    
    if (!adapter) {
      return res.status(400).json({
        success: false,
        message: `Tipo de proveedor no soportado: ${secreto.tipo_proveedor}`
      });
    }
    
    console.log(`[API] Inspeccionando bucket ${bucketName} para secreto tipo ${secreto.tipo_proveedor}`);
    
    // Aquí está el cambio clave: Estructurar exactamente como en SAGE CLOUDS
    // En SAGE CLOUDS, las credenciales incluyen container_name y se pasa configuracion
    // Vamos a recrear ese mismo formato aquí
    let credentials = {};
    let config = {};
    
    // Configurar las credenciales y la configuración según el tipo de proveedor
    if (secreto.tipo_proveedor === 'minio') {
      credentials = {
        ...secreto.credentials,
        bucket: bucketName
      };
      config = {
        endpoint: secreto.credentials.endpoint,
        port: secreto.credentials.port,
        secure: secreto.credentials.secure !== false
      };
    } else if (secreto.tipo_proveedor === 's3') {
      credentials = {
        ...secreto.credentials,
        bucket: bucketName
      };
    } else if (secreto.tipo_proveedor === 'azure') {
      // Para Azure, imitar exactamente el formato que funciona en SAGE CLOUDS
      credentials = {
        connection_string: secreto.credentials.connection_string,
        container_name: bucketName
      };
      
      // Configuración adicional para azure (igual que en SAGE CLOUDS)
      config = {
        use_sas: false,
        sas_expiry: "3600"
      };
    } else if (secreto.tipo_proveedor === 'gcp') {
      credentials = {
        ...secreto.credentials,
        bucket: bucketName
      };
    }
    
    // Llamar al adaptador igual que en SAGE CLOUDS
    console.log(`[API] Llamando al adaptador ${secreto.tipo_proveedor} con container_name:`, credentials.container_name);
    const contents = await adapter.listContents(credentials, config, path);
    
    // Incluir información adicional en la respuesta
    return res.status(200).json({
      ...contents,
      details: {
        secreto_id: secretoId,
        secreto_nombre: secreto.nombre,
        tipo_proveedor: secreto.tipo_proveedor,
        bucket_name: bucketName
      }
    });
  } catch (error) {
    console.error(`[API] Error al inspeccionar bucket ${bucketName} para secreto ID ${secretoId}:`, error);
    
    // Incluir detalles del error y mantener el formato consistente con exploradores funcionales
    return res.status(200).json({
      error: true,
      errorMessage: error.message,
      bucket: bucketName,
      path: path || '/',
      files: [],
      folders: [],
      details: {
        secreto_id: secretoId,
        secreto_nombre: secreto ? secreto.nombre : 'Desconocido',
        tipo_proveedor: secreto ? secreto.tipo_proveedor : 'Desconocido',
        bucket_name: bucketName
      }
    });
  }
}