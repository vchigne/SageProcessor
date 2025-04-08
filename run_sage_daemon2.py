#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para ejecutar el SAGE Daemon 2 en modo continuo

Este script inicia el SAGE Daemon 2, que monitorea cuentas de correo
configuradas en la base de datos, procesa los correos entrantes y
responde automáticamente según reglas definidas.
"""

import sys
import os
import logging
from sage_daemon2.daemon import SageDaemon2

def main():
    """Función principal"""
    # Configurar logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler("sage_daemon2_log.txt"),
            logging.StreamHandler(sys.stdout)
        ]
    )
    
    logger = logging.getLogger("run_sage_daemon2")
    logger.info("Iniciando SAGE Daemon 2 en modo continuo")
    
    # Configurar variables de entorno para SMTP
    os.environ.setdefault('SMTP_SERVER', 'smtp.gmail.com')
    os.environ.setdefault('SMTP_PORT', '587')
    os.environ.setdefault('SMTP_USERNAME', 'sage.vidahub@gmail.com')
    os.environ.setdefault('SMTP_PASSWORD', 'App-specific-password-here')  # Reemplazar con la contraseña real
    os.environ.setdefault('SMTP_FROM_EMAIL', 'sage.vidahub@gmail.com')
    os.environ.setdefault('SMTP_FROM_NAME', 'SAGE Notificaciones')
    
    logger.info("Variables de entorno SMTP configuradas")
    
    # Crear e iniciar daemon
    daemon = SageDaemon2()
    daemon.run(single_execution=False)

if __name__ == "__main__":
    main()