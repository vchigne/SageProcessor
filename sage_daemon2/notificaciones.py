#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gestor de notificaciones para SAGE Daemon 2

Este módulo se encarga de procesar suscripciones y enviar notificaciones
basadas en las ejecuciones registradas en la tabla ejecuciones_yaml.
"""

import logging
import json
import traceback
from datetime import datetime, timedelta, time
from typing import Dict, Any, List, Optional, Tuple
from sage.notificaciones.notificador import Notificador

class NotificacionesManager:
    """Gestor de notificaciones para SAGE Daemon 2"""
    
    def __init__(self, db_manager):
        """
        Inicializa el gestor de notificaciones
        
        Args:
            db_manager: Gestor de base de datos
        """
        self.db_manager = db_manager
        self.notificador = Notificador(db_manager.connection)
        self.logger = logging.getLogger("SAGE_Daemon2.Notificaciones")
    
    def procesar_notificaciones(self):
        """
        Procesa todas las notificaciones según las suscripciones configuradas
        
        Returns:
            Dict: Estadísticas del procesamiento
        """
        stats = {'total': 0, 'enviados': 0, 'error': 0}
        
        self.logger.info("Iniciando procesamiento de notificaciones")
        
        try:
            # 1. Procesar suscripciones inmediatas
            self.logger.info("Procesando suscripciones con frecuencia inmediata")
            stats_inmediatas = self._procesar_suscripciones_inmediatas()
            self.logger.info(f"Estadísticas de suscripciones inmediatas: {stats_inmediatas}")
            
            # 2. Procesar suscripciones programadas (diarias, semanales, mensuales)
            self.logger.info("Procesando suscripciones con frecuencia programada")
            stats_programadas = self._procesar_suscripciones_programadas()
            self.logger.info(f"Estadísticas de suscripciones programadas: {stats_programadas}")
            
            # Combinar estadísticas
            stats['total'] = stats_inmediatas['total'] + stats_programadas['total']
            stats['enviados'] = stats_inmediatas['enviados'] + stats_programadas['enviados']
            stats['error'] = stats_inmediatas['error'] + stats_programadas['error']
            
            self.logger.info(f"Procesamiento de notificaciones finalizado: {stats}")
            return stats
            
        except Exception as e:
            self.logger.error(f"Error general en procesamiento de notificaciones: {e}")
            self.logger.error(traceback.format_exc())
            return {'total': 0, 'enviados': 0, 'error': 1}
    
    def _procesar_suscripciones_inmediatas(self) -> Dict[str, int]:
        """
        Procesa las suscripciones configuradas con frecuencia inmediata
        
        Returns:
            Dict: Estadísticas del procesamiento
        """
        # Obtener suscripciones con frecuencia inmediata
        suscripciones = self._obtener_suscripciones('inmediata')
        
        stats = {'total': len(suscripciones), 'enviados': 0, 'error': 0}
        
        for suscripcion in suscripciones:
            try:
                # Obtener ejecuciones recientes relevantes para esta suscripción
                desde_ultima_notif = self._obtener_timestamp_ultima_notificacion(suscripcion['id'])
                
                # Si no hay notificación previa, usar un valor por defecto (24 horas atrás)
                if desde_ultima_notif is None:
                    desde_ultima_notif = datetime.now() - timedelta(hours=24)
                    self.logger.info(f"No hay notificaciones previas para suscripción {suscripcion['id']}, buscando desde hace 24 horas")
                
                ejecuciones = self._obtener_ejecuciones_por_suscripcion(
                    suscripcion, 
                    desde=desde_ultima_notif
                )
                
                if not ejecuciones:
                    continue  # No hay ejecuciones nuevas para notificar
                
                # Agrupar ejecuciones según nivel_detalle
                eventos = self._convertir_ejecuciones_a_eventos(ejecuciones, suscripcion['nivel_detalle'])
                
                if not eventos:
                    continue  # No hay eventos después de filtrar
                
                # Obtener información para notificación
                asunto, contenido_html = self._generar_contenido_notificacion(
                    eventos, 
                    suscripcion['nivel_detalle'],
                    self._obtener_portal_id(suscripcion['casilla_id']),
                    suscripcion['casilla_id']
                )
                
                # Enviar notificación según método configurado
                if suscripcion['metodo_envio'] == 'email':
                    if self._enviar_notificacion_email(suscripcion, asunto, contenido_html):
                        stats['enviados'] += 1
                        
                        # Registrar notificación enviada
                        self._registrar_notificacion_enviada(
                            suscripcion['id'], 
                            [e['id'] for e in ejecuciones], 
                            'email',
                            asunto
                        )
                    else:
                        stats['error'] += 1
                
                elif suscripcion['metodo_envio'] == 'webhook':
                    if self._enviar_notificacion_webhook(suscripcion, eventos):
                        stats['enviados'] += 1
                        
                        # Registrar notificación enviada
                        self._registrar_notificacion_enviada(
                            suscripcion['id'], 
                            [e['id'] for e in ejecuciones], 
                            'webhook',
                            f"Webhook a {suscripcion['webhook_url']}"
                        )
                    else:
                        stats['error'] += 1
                
            except Exception as e:
                self.logger.error(f"Error al procesar suscripción inmediata {suscripcion['id']}: {e}")
                self.logger.error(traceback.format_exc())
                stats['error'] += 1
        
        return stats
    
    def _procesar_suscripciones_programadas(self) -> Dict[str, int]:
        """
        Procesa las suscripciones programadas (diarias, semanales, mensuales)
        que deben ejecutarse en este momento
        
        Returns:
            Dict: Estadísticas del procesamiento
        """
        # Obtener hora y día actuales
        ahora = datetime.now()
        hora_actual = ahora.hour
        dia_semana_actual = ahora.weekday() + 1  # 1-7 (lunes-domingo)
        dia_mes_actual = ahora.day  # 1-31
        
        # Obtener suscripciones diarias para esta hora
        suscripciones_diarias = self._obtener_suscripciones('diaria', hora_actual)
        
        # Obtener suscripciones semanales para este día y hora
        suscripciones_semanales = self._obtener_suscripciones('semanal', hora_actual, dia_semana_actual)
        
        # Obtener suscripciones mensuales para este día y hora
        suscripciones_mensuales = self._obtener_suscripciones('mensual', hora_actual, dia_mes_actual)
        
        # Combinar todas las suscripciones programadas
        suscripciones = suscripciones_diarias + suscripciones_semanales + suscripciones_mensuales
        
        stats = {'total': len(suscripciones), 'enviados': 0, 'error': 0}
        
        for suscripcion in suscripciones:
            try:
                # Determinar el período desde la última notificación o desde hace:
                # - 1 día para suscripciones diarias
                # - 7 días para suscripciones semanales
                # - 30 días para suscripciones mensuales
                periodo = self._determinar_periodo_suscripcion(suscripcion)
                ultima_notificacion = self._obtener_timestamp_ultima_notificacion(suscripcion['id'])
                
                desde = max(
                    ultima_notificacion if ultima_notificacion else datetime.min,
                    datetime.now() - timedelta(days=periodo)
                )
                
                # Obtener ejecuciones relevantes para esta suscripción
                ejecuciones = self._obtener_ejecuciones_por_suscripcion(suscripcion, desde=desde)
                
                if not ejecuciones:
                    continue  # No hay ejecuciones nuevas para notificar
                
                # Agrupar ejecuciones según nivel_detalle
                eventos = self._convertir_ejecuciones_a_eventos(ejecuciones, suscripcion['nivel_detalle'])
                
                if not eventos:
                    continue  # No hay eventos después de filtrar
                
                # Obtener información para notificación
                asunto, contenido_html = self._generar_contenido_notificacion(
                    eventos, 
                    suscripcion['nivel_detalle'],
                    self._obtener_portal_id(suscripcion['casilla_id']),
                    suscripcion['casilla_id']
                )
                
                # Enviar notificación según método configurado
                if suscripcion['metodo_envio'] == 'email':
                    if self._enviar_notificacion_email(suscripcion, asunto, contenido_html):
                        stats['enviados'] += 1
                        
                        # Registrar notificación enviada
                        self._registrar_notificacion_enviada(
                            suscripcion['id'], 
                            [e['id'] for e in ejecuciones], 
                            'email',
                            asunto
                        )
                    else:
                        stats['error'] += 1
                
                elif suscripcion['metodo_envio'] == 'webhook':
                    if self._enviar_notificacion_webhook(suscripcion, eventos):
                        stats['enviados'] += 1
                        
                        # Registrar notificación enviada
                        self._registrar_notificacion_enviada(
                            suscripcion['id'], 
                            [e['id'] for e in ejecuciones], 
                            'webhook',
                            f"Webhook a {suscripcion['webhook_url']}"
                        )
                    else:
                        stats['error'] += 1
                        
            except Exception as e:
                self.logger.error(f"Error al procesar suscripción programada {suscripcion['id']}: {e}")
                self.logger.error(traceback.format_exc())
                stats['error'] += 1
        
        return stats
    
    def _obtener_suscripciones(self, frecuencia: str, hora: Optional[int] = None, dia: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Obtiene suscripciones según la frecuencia, hora y día especificados
        
        Args:
            frecuencia: Frecuencia de las suscripciones ('inmediata', 'diaria', 'semanal', 'mensual')
            hora: Hora del día (0-23) para filtrar suscripciones programadas
            dia: Día (1-7 para semana, 1-31 para mes) para filtrar suscripciones programadas
            
        Returns:
            Lista de suscripciones que cumplen con los criterios
        """
        query = """
        SELECT 
            id, nombre, email, telefono, activo, frecuencia, 
            nivel_detalle, dia_envio, tipos_evento, 
            casilla_id, emisores, es_tecnico, webhook_url, api_key,
            metodo_envio, last_notification_at, hora_envio
        FROM 
            suscripciones 
        WHERE 
            activo = TRUE 
            AND frecuencia = %s
        """
        
        params = [frecuencia]
        
        # Filtrar por hora si se especifica
        if hora is not None:
            query += " AND EXTRACT(HOUR FROM hora_envio) = %s"
            params.append(str(hora))
        
        # Filtrar por día si se especifica
        if dia is not None:
            query += " AND dia_envio = %s"
            params.append(str(dia))
        
        result = self.db_manager.execute_query(query, params)
        if not result:
            return []
            
        # Procesar campos JSON
        suscripciones = []
        for suscripcion in result:
            # Convertir tipos_evento y emisores a listas si son strings JSON
            if 'tipos_evento' in suscripcion and isinstance(suscripcion['tipos_evento'], str):
                try:
                    suscripcion['tipos_evento'] = json.loads(suscripcion['tipos_evento'])
                except:
                    suscripcion['tipos_evento'] = []
                    
            if 'emisores' in suscripcion and isinstance(suscripcion['emisores'], str):
                try:
                    suscripcion['emisores'] = json.loads(suscripcion['emisores'])
                except:
                    suscripcion['emisores'] = []
            
            suscripciones.append(suscripcion)
            
        return suscripciones
        
    def _obtener_ejecuciones_por_suscripcion(self, suscripcion: Dict[str, Any], desde: datetime) -> List[Dict[str, Any]]:
        """
        Obtiene ejecuciones relevantes para una suscripción desde una fecha dada
        
        Args:
            suscripcion: Datos de la suscripción
            desde: Fecha desde la cual buscar ejecuciones
            
        Returns:
            Lista de ejecuciones relevantes para la suscripción
        """
        self.logger.info(f"Buscando ejecuciones para suscripción {suscripcion['id']} desde {desde.isoformat()}")
        
        # Construir consulta base
        query = """
        SELECT 
            e.id, e.casilla_id, e.emisor_id, e.archivo_datos, 
            e.fecha_ejecucion as fecha_inicio, e.fecha_ejecucion as fecha_fin, 
            e.estado, 'N/A' as resultado,
            e.errores_detectados as errores, e.warnings_detectados as advertencias, 
            e.ruta_directorio as dir_ejecucion,
            c.nombre as casilla_nombre,
            em.nombre as emisor_nombre
        FROM 
            ejecuciones_yaml e
        LEFT JOIN 
            casillas c ON e.casilla_id = c.id
        LEFT JOIN 
            emisores em ON e.emisor_id = em.id
        WHERE 
            e.fecha_ejecucion > %s
        """
        
        params = [desde]
        
        # Filtrar por casilla_id
        if suscripcion['casilla_id']:
            query += " AND e.casilla_id = %s"
            params.append(suscripcion['casilla_id'])
            self.logger.info(f"Filtrando por casilla_id={suscripcion['casilla_id']}")
        
        # Filtrar por emisores si están especificados
        emisores = suscripcion.get('emisores', [])
        if emisores and len(emisores) > 0:
            placeholders = ', '.join(['%s'] * len(emisores))
            query += f" AND e.emisor_id IN ({placeholders})"
            params.extend(emisores)
            self.logger.info(f"Filtrando por emisores: {emisores}")
        
        # Filtrar por tipos de evento
        tipos_evento = suscripcion.get('tipos_evento', [])
        if tipos_evento and len(tipos_evento) > 0:
            self.logger.info(f"Filtrando por tipos de evento: {tipos_evento}")
            condiciones = []
            
            if 'error' in tipos_evento:
                condiciones.append("e.estado = 'Fallido'")
                
            if 'advertencia' in tipos_evento or 'warning' in tipos_evento:
                condiciones.append("e.warnings_detectados > 0")
                
            if 'exito' in tipos_evento:
                condiciones.append("e.estado = 'Éxito'")
                
            if 'mensaje' in tipos_evento or 'otro' in tipos_evento:
                # Cualquier estado que no sea error o exito
                condiciones.append("e.estado NOT IN ('Fallido', 'Éxito')")
            
            if condiciones:
                query += " AND (" + " OR ".join(condiciones) + ")"
                self.logger.info(f"Condiciones SQL generadas: {' OR '.join(condiciones)}")
        
        # Ordenar por fecha
        query += " ORDER BY e.fecha_ejecucion DESC"
        
        # Ejecutar consulta
        self.logger.debug(f"Ejecutando consulta: {query} con parámetros: {params}")
        result = self.db_manager.execute_query(query, params)
        
        if result:
            self.logger.info(f"Se encontraron {len(result)} ejecuciones")
        else:
            self.logger.warning("No se encontraron ejecuciones que coincidan con los criterios")
            
        return result if result else []
        
    def _convertir_ejecuciones_a_eventos(self, ejecuciones: List[Dict[str, Any]], nivel_detalle: str) -> List[Dict[str, Any]]:
        """
        Convierte ejecuciones a formato de eventos para notificaciones
        
        Args:
            ejecuciones: Lista de ejecuciones
            nivel_detalle: Nivel de detalle ('detallado', 'resumido_emisor', 'resumido_casilla')
            
        Returns:
            Lista de eventos formateados para notificaciones
        """
        if not ejecuciones:
            self.logger.warning("No hay ejecuciones para convertir a eventos")
            return []
            
        self.logger.info(f"Convirtiendo {len(ejecuciones)} ejecuciones a eventos (nivel_detalle: {nivel_detalle})")
        
        eventos = []
        
        for ejecucion in ejecuciones:
            self.logger.debug(f"Procesando ejecución: {ejecucion['id']} - Estado: {ejecucion['estado']} - Archivo: {ejecucion['archivo_datos']}")
            
            # Determinar tipo de evento
            tipo_evento = 'mensaje'  # Valor por defecto
            
            if ejecucion['estado'] == 'Fallido':
                tipo_evento = 'error'
                self.logger.debug(f"Ejecución {ejecucion['id']} clasificada como error")
            elif 'advertencias' in ejecucion and ejecucion['advertencias'] and ejecucion['advertencias'] > 0:
                tipo_evento = 'advertencia'
                self.logger.debug(f"Ejecución {ejecucion['id']} clasificada como advertencia")
            elif ejecucion['estado'] == 'Éxito':
                tipo_evento = 'exito'
                self.logger.debug(f"Ejecución {ejecucion['id']} clasificada como éxito")
                
            # Crear evento
            emisor = ejecucion['emisor_nombre'] or f"Emisor-{ejecucion['emisor_id']}"
            
            evento = {
                'id': ejecucion['id'],
                'tipo': tipo_evento,
                'emisor': emisor,
                'casilla_id': ejecucion['casilla_id'],
                'mensaje': f"Procesamiento de archivo {ejecucion['archivo_datos']} - {ejecucion['estado']}",
                'detalles': {
                    'archivo': ejecucion['archivo_datos'],
                    'estado': ejecucion['estado'],
                    'resultado': ejecucion['resultado'],
                    'errores': ejecucion['errores'],
                    'advertencias': ejecucion['advertencias'],
                    'dir_ejecucion': ejecucion['dir_ejecucion'],
                    'fecha': ejecucion['fecha_inicio'].isoformat() if ejecucion['fecha_inicio'] else None,
                },
                'fecha': ejecucion['fecha_inicio']
            }
            
            eventos.append(evento)
        
        return eventos
        
    def _generar_contenido_notificacion(self, eventos: List[Dict[str, Any]], 
                                      nivel_detalle: str, 
                                      portal_id: Optional[int] = None,
                                      casilla_id: Optional[int] = None) -> Tuple[str, str]:
        """
        Genera el contenido para una notificación
        
        Args:
            eventos: Lista de eventos a incluir
            nivel_detalle: Nivel de detalle ('detallado', 'resumido_emisor', 'resumido_casilla')
            portal_id: ID del portal
            casilla_id: ID de la casilla
            
        Returns:
            Tupla con (asunto, contenido_html)
        """
        # Valor por defecto para portal_id si es None
        if portal_id is None:
            portal_id = 1  # ID de portal por defecto
            self.logger.warning(f"Usando portal_id=1 por defecto para generar notificación")
        
        # Usar el generador de contenido del notificador
        return self.notificador._generar_contenido_notificacion(
            eventos, 
            nivel_detalle,
            portal_id,
            casilla_id
        )
    
    def _enviar_notificacion_email(self, suscripcion: Dict[str, Any], asunto: str, contenido_html: str) -> bool:
        """
        Envía una notificación por email
        
        Args:
            suscripcion: Datos de la suscripción
            asunto: Asunto del email
            contenido_html: Contenido HTML del email
            
        Returns:
            True si se envió correctamente, False en caso contrario
        """
        if not suscripcion.get('email'):
            self.logger.warning(f"Suscripción {suscripcion['id']} no tiene email configurado")
            return False
            
        return self.notificador.enviar_notificacion_email(
            suscripcion['email'],
            asunto,
            contenido_html
        )
    
    def _enviar_notificacion_webhook(self, suscripcion: Dict[str, Any], eventos: List[Dict[str, Any]]) -> bool:
        """
        Envía una notificación a través de webhook
        
        Args:
            suscripcion: Datos de la suscripción
            eventos: Lista de eventos a incluir
            
        Returns:
            True si se envió correctamente, False en caso contrario
        """
        if not suscripcion.get('webhook_url'):
            self.logger.warning(f"Suscripción {suscripcion['id']} no tiene webhook configurado")
            return False
        
        # TODO: Implementar envío de webhook (por ahora solo se registra)
        self.logger.info(f"Simulando envío de webhook a {suscripcion['webhook_url']} con {len(eventos)} eventos")
        return True
    
    def _registrar_notificacion_enviada(self, suscripcion_id: int, 
                                       evento_ids: List[int], 
                                       tipo_envio: str,
                                       resumen: str) -> bool:
        """
        Registra una notificación enviada
        
        Args:
            suscripcion_id: ID de la suscripción
            evento_ids: Lista de IDs de eventos incluidos
            tipo_envio: Tipo de envío ('email', 'webhook', etc.)
            resumen: Resumen de la notificación
            
        Returns:
            True si se registró correctamente, False en caso contrario
        """
        query = """
        INSERT INTO notificaciones_enviadas
        (suscripcion_id, eventos_ids, cantidad_eventos, resumen, fecha_envio, estado, tipo_envio)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        """
        
        params = (
            suscripcion_id,
            evento_ids,
            len(evento_ids),
            resumen,
            datetime.now(),
            'enviado',
            tipo_envio
        )
        
        result = self.db_manager.execute_query(query, params, fetch=False)
        
        # Actualizar timestamp de última notificación
        if result:
            update_query = """
            UPDATE suscripciones
            SET last_notification_at = %s
            WHERE id = %s
            """
            
            self.db_manager.execute_query(update_query, (datetime.now(), suscripcion_id), fetch=False)
        
        return result is not None
    
    def _obtener_timestamp_ultima_notificacion(self, suscripcion_id: int) -> Optional[datetime]:
        """
        Obtiene el timestamp de la última notificación enviada a un suscriptor
        
        Args:
            suscripcion_id: ID de la suscripción
            
        Returns:
            Timestamp de la última notificación o None si no hay notificaciones previas
        """
        query = """
        SELECT last_notification_at
        FROM suscripciones
        WHERE id = %s
        """
        
        result = self.db_manager.execute_query(query, (suscripcion_id,))
        if result and result[0]['last_notification_at']:
            return result[0]['last_notification_at']
        else:
            return None
    
    def _determinar_periodo_suscripcion(self, suscripcion: Dict[str, Any]) -> int:
        """
        Determina el período en días para una suscripción programada
        
        Args:
            suscripcion: Datos de la suscripción
            
        Returns:
            Período en días (1 para diaria, 7 para semanal, 30 para mensual)
        """
        frecuencia = suscripcion.get('frecuencia', 'diaria')
        
        if frecuencia == 'diaria':
            return 1
        elif frecuencia == 'semanal':
            return 7
        elif frecuencia == 'mensual':
            return 30
        else:
            return 1
    
    def _obtener_portal_id(self, casilla_id: int) -> Optional[int]:
        """
        Obtiene el ID del portal asociado a una casilla
        
        Args:
            casilla_id: ID de la casilla
            
        Returns:
            ID del portal o None si no se encuentra
        """
        query = """
        SELECT instalacion_id 
        FROM casillas
        WHERE id = %s
        """
        
        result = self.db_manager.execute_query(query, (casilla_id,))
        if result and len(result) > 0:
            return result[0]['instalacion_id']
        else:
            return None