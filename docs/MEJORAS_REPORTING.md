# Mejoras en Sistema de Reportes SAGE

## Fase 1: Implementación de Enlaces para Visualización y Descarga (Prioridad Alta)

### 1. Portal Externo

#### 1.1. Página de Subir Archivos
- Añadir botón "Ver Reporte HTML" que abre el reporte detallado (`report.html`) en una nueva pestaña
- Añadir botón "Descargar JSON" para obtener los datos estructurados (`report.json`)
- Incluir estos botones en la pantalla de resultados del procesamiento

#### 1.2. Página de Archivo Directo
- Implementar los mismos botones ("Ver Reporte HTML" y "Descargar JSON")
- Mostrar los botones una vez completado el procesamiento
- Asegurar visibilidad adecuada en la interfaz de usuario

### 2. Sistema de Casillas

#### 2.1. Opción Subir Archivo
- Añadir botones para visualizar y descargar reportes
- Implementar botón "Ver Reporte HTML" para visualización en navegador
- Implementar botón "Descargar JSON" para acceder a datos estructurados
- Ubicar los botones en la sección de resultados de procesamiento

## Aspectos Técnicos de Implementación

1. **Rutas de acceso**:
   - Crear endpoints específicos para acceder a los archivos de reporte
   - Implementar sistema de verificación de permisos para el acceso
   - Garantizar la persistencia temporal de los reportes para su descarga

2. **Interfaz de Usuario**:
   - Utilizar iconos intuitivos (HTML y JSON)
   - Implementar tooltips explicativos
   - Destacar visualmente los enlaces para mejor experiencia de usuario

3. **Consideraciones Técnicas**:
   - Asegurar que los reportes existan antes de mostrar los enlaces
   - Implementar manejo de errores si los archivos no se encuentran
   - Garantizar compatibilidad con diferentes navegadores

## Pruebas y Validación

1. Verificar que los reportes se generen correctamente en todos los canales de procesamiento
2. Comprobar funcionalidad de visualización y descarga en ambos portales
3. Validar visualización correcta del HTML en diferentes navegadores
4. Confirmar que el JSON descargado es válido y contiene todos los datos necesarios