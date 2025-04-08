#!/usr/bin/env python3
"""
Script para diagnosticar problemas de DNS en correo electrónico

Este script verifica la configuración DNS completa para un dominio,
incluyendo registros MX, SPF, DKIM y DMARC, para identificar posibles
problemas que afecten la entrega de correos electrónicos.

Uso:
  python3 test_dns_configuration.py <dominio>
  
  Si no se especifica dominio, se usará sage.vidahub.ai por defecto
"""

import sys
import logging
import subprocess
import re
import socket
import dns.resolver
import dns.reversename

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("test_dns_config")

def ejecutar_comando(comando):
    """Ejecuta un comando y devuelve su salida"""
    try:
        resultado = subprocess.run(comando, shell=True, check=True,
                                  stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                  universal_newlines=True)
        return resultado.stdout
    except subprocess.CalledProcessError as e:
        logger.error(f"Error ejecutando comando: {comando}")
        logger.error(f"Salida de error: {e.stderr}")
        return e.stdout

def verificar_registro_dns(dominio, tipo, selector=None):
    """Verifica un registro DNS específico para un dominio"""
    consulta = dominio
    if selector:
        consulta = f"{selector}.{dominio}"
    
    try:
        respuestas = dns.resolver.resolve(consulta, tipo)
        return [str(resp) for resp in respuestas]
    except dns.resolver.NXDOMAIN:
        logger.warning(f"No se encontró registro {tipo} para {consulta}")
        return []
    except dns.resolver.NoAnswer:
        logger.warning(f"No hay respuesta para consulta {tipo} en {consulta}")
        return []
    except Exception as e:
        logger.error(f"Error consultando {tipo} para {consulta}: {str(e)}")
        return []

def verificar_mx(dominio):
    """Verifica los registros MX de un dominio"""
    print("\n" + "="*60)
    print(f" VERIFICACIÓN DE REGISTROS MX PARA {dominio}")
    print("="*60)
    
    registros = verificar_registro_dns(dominio, 'MX')
    
    if registros:
        print(f"✅ Registros MX encontrados:")
        for registro in registros:
            print(f"  - {registro}")
        
        # Verificar cada servidor de correo
        for registro in registros:
            partes = registro.split()
            if len(partes) >= 2:
                mx_hostname = partes[-1].rstrip('.')
                print(f"\nVerificando servidor de correo: {mx_hostname}")
                
                # Verificar dirección IP
                try:
                    ip = socket.gethostbyname(mx_hostname)
                    print(f"  ✓ Resuelve a IP: {ip}")
                    
                    # Verificar PTR (reverse DNS)
                    try:
                        addr = dns.reversename.from_address(ip)
                        respuestas = dns.resolver.resolve(addr, "PTR")
                        ptr_records = [str(r) for r in respuestas]
                        print(f"  ✓ Registro PTR: {', '.join(ptr_records)}")
                    except Exception as e:
                        print(f"  ✗ Sin registro PTR: {str(e)}")
                except Exception as e:
                    print(f"  ✗ No se pudo resolver: {str(e)}")
    else:
        print(f"❌ No se encontraron registros MX para {dominio}")
    
    return registros

def verificar_spf(dominio):
    """Verifica el registro SPF de un dominio"""
    print("\n" + "="*60)
    print(f" VERIFICACIÓN DE REGISTRO SPF PARA {dominio}")
    print("="*60)
    
    registros = verificar_registro_dns(dominio, 'TXT')
    spf_records = [r for r in registros if r.startswith('"v=spf1')]
    
    if spf_records:
        print(f"✅ Registro SPF encontrado:")
        for record in spf_records:
            print(f"  {record}")
        
        # Análisis básico de SPF
        for record in spf_records:
            if ' -all' in record:
                print(f"  ✓ Política estricta ('-all'): Los correos que no coincidan serán rechazados")
            elif ' ~all' in record:
                print(f"  ⚠️ Política suave ('~all'): Los correos que no coincidan pueden ser marcados como spam")
            elif ' ?all' in record:
                print(f"  ⚠️ Política neutral ('?all'): No afecta la entrega de correos")
            elif ' +all' in record:
                print(f"  ❌ Política permisiva ('+all'): Permite cualquier servidor enviar correos (inseguro)")
            
            # Verificar include
            includes = re.findall(r'include:(\S+)', record)
            if includes:
                print(f"  ✓ Incluye dominios: {', '.join(includes)}")
            
            # Verificar mecanismos IP
            ips = re.findall(r'ip[46]:(\S+)', record)
            if ips:
                print(f"  ✓ IPs autorizadas: {', '.join(ips)}")
    else:
        print(f"❌ No se encontró registro SPF para {dominio}")
    
    return spf_records

def verificar_dkim(dominio, selectores=None):
    """Verifica los registros DKIM de un dominio"""
    print("\n" + "="*60)
    print(f" VERIFICACIÓN DE REGISTROS DKIM PARA {dominio}")
    print("="*60)
    
    if not selectores:
        # Selectores comunes para probar
        selectores = ['default', 'selector1', 'selector2', 'dkim', 'k1', 'key1', 'mail']
    
    encontrado = False
    for selector in selectores:
        registros = verificar_registro_dns(dominio, 'TXT', f"{selector}._domainkey")
        dkim_records = [r for r in registros if 'v=DKIM1' in r]
        
        if dkim_records:
            encontrado = True
            print(f"✅ Registro DKIM encontrado para selector '{selector}':")
            for record in dkim_records:
                print(f"  {record}")
                
                # Analizar componentes
                if 'p=' in record:
                    print(f"  ✓ Clave pública presente")
                else:
                    print(f"  ❌ Falta clave pública")
                
                if 't=y' in record:
                    print(f"  ⚠️ Modo de prueba activo (t=y)")
    
    if not encontrado:
        print(f"❌ No se encontraron registros DKIM para {dominio}")
        print("  Recomendación: Configurar DKIM con el selector 'default'")
        print("  Comando: host -t TXT default._domainkey.{dominio}")
        print("  Formato típico: v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4...")
    
    return encontrado

def verificar_dmarc(dominio):
    """Verifica el registro DMARC de un dominio"""
    print("\n" + "="*60)
    print(f" VERIFICACIÓN DE REGISTRO DMARC PARA {dominio}")
    print("="*60)
    
    registros = verificar_registro_dns(f"_dmarc.{dominio}", 'TXT')
    dmarc_records = [r for r in registros if 'v=DMARC1' in r]
    
    if dmarc_records:
        print(f"✅ Registro DMARC encontrado:")
        for record in dmarc_records:
            print(f"  {record}")
            
            # Analizar política
            match_p = re.search(r'p=(\w+)', record)
            if match_p:
                politica = match_p.group(1)
                if politica == 'reject':
                    print(f"  ✓ Política estricta (reject): Rechazar correos que fallen")
                elif politica == 'quarantine':
                    print(f"  ⚠️ Política moderada (quarantine): Marcar como spam los correos que fallen")
                elif politica == 'none':
                    print(f"  ⚠️ Política de monitoreo (none): Solo monitorear, no afecta entrega")
            
            # Verificar reportes
            if 'rua=' in record:
                match_rua = re.search(r'rua=mailto:([^;]+)', record)
                if match_rua:
                    print(f"  ✓ Reportes de agregados configurados: {match_rua.group(1)}")
            
            if 'ruf=' in record:
                match_ruf = re.search(r'ruf=mailto:([^;]+)', record)
                if match_ruf:
                    print(f"  ✓ Reportes forenses configurados: {match_ruf.group(1)}")
            
            # Porcentaje
            match_pct = re.search(r'pct=(\d+)', record)
            if match_pct:
                pct = int(match_pct.group(1))
                if pct < 100:
                    print(f"  ⚠️ Aplicado solo al {pct}% de los correos")
                else:
                    print(f"  ✓ Aplicado al 100% de los correos")
    else:
        print(f"❌ No se encontró registro DMARC para {dominio}")
        print("  Recomendación: Configurar DMARC con al menos modo de monitoreo")
        print(f"  Comando: host -t TXT _dmarc.{dominio}")
        print("  Formato recomendado: v=DMARC1; p=none; rua=mailto:dmarc@{dominio}")
    
    return dmarc_records

def verificar_configuracion_dns(dominio):
    """Realiza una verificación completa de configuración DNS para correo"""
    print("\n" + "="*60)
    print(f" DIAGNÓSTICO DE CONFIGURACIÓN DNS PARA {dominio}")
    print("="*60)
    print(f"Fecha: {ejecutar_comando('date').strip()}")
    
    # Verificar registros A y resolución básica
    print("\n📌 Verificando resolución básica del dominio...")
    try:
        ip = socket.gethostbyname(dominio)
        print(f"✅ {dominio} resuelve a IP: {ip}")
        
        # Verificar reverse DNS
        try:
            host = socket.gethostbyaddr(ip)[0]
            print(f"✅ Reverse DNS para {ip}: {host}")
        except socket.herror:
            print(f"⚠️ No se encontró reverse DNS para {ip}")
    except socket.gaierror:
        print(f"❌ No se pudo resolver el dominio: {dominio}")
    
    # Verificar registros específicos para correo
    mx_records = verificar_mx(dominio)
    spf_records = verificar_spf(dominio)
    dkim_exists = verificar_dkim(dominio)
    dmarc_records = verificar_dmarc(dominio)
    
    # Resumen y recomendaciones
    print("\n" + "="*60)
    print(f" RESUMEN DE CONFIGURACIÓN DNS PARA {dominio}")
    print("="*60)
    
    puntuacion = 0
    maximo = 4
    
    print(f"MX: {'✅ CONFIGURADO' if mx_records else '❌ NO CONFIGURADO'}")
    if mx_records:
        puntuacion += 1
    
    print(f"SPF: {'✅ CONFIGURADO' if spf_records else '❌ NO CONFIGURADO'}")
    if spf_records:
        puntuacion += 1
    
    print(f"DKIM: {'✅ CONFIGURADO' if dkim_exists else '❌ NO CONFIGURADO'}")
    if dkim_exists:
        puntuacion += 1
    
    print(f"DMARC: {'✅ CONFIGURADO' if dmarc_records else '❌ NO CONFIGURADO'}")
    if dmarc_records:
        puntuacion += 1
    
    print("\n📋 Puntuación de entregabilidad: {}/{}".format(puntuacion, maximo))
    
    if puntuacion == maximo:
        print("🏆 ¡Excelente! Tu configuración DNS está completa.")
    elif puntuacion >= 2:
        print("⚠️ Configuración parcial. Implementa los registros faltantes para mejorar.")
    else:
        print("❌ Configuración deficiente. Es urgente mejorar los registros DNS.")
    
    # Recomendaciones específicas
    print("\n" + "="*60)
    print(" RECOMENDACIONES PARA MEJORAR LA ENTREGABILIDAD")
    print("="*60)
    
    if not dkim_exists:
        print("""
1. Configurar DKIM:
   a. Generar par de claves DKIM:
      openssl genrsa -out dkim-private.key 1024
      openssl rsa -in dkim-private.key -pubout -out dkim-public.key
   
   b. Añadir registro TXT para default._domainkey.{}:
      v=DKIM1; k=rsa; p=<clave-publica-aqui>
      
   Donde <clave-publica-aqui> es el contenido del archivo dkim-public.key
   (elimina cabeceras y pie, y quita todos los saltos de línea)
""".format(dominio))
    
    if not dmarc_records:
        print("""
2. Configurar DMARC:
   Añadir registro TXT para _dmarc.{}:
   v=DMARC1; p=none; rua=mailto:dmarc-reports@{}
   
   Inicialmente usa "p=none" para monitoreo, luego puedes cambiarlo a
   "p=quarantine" o "p=reject" cuando estés seguro del funcionamiento
""".format(dominio, dominio))
    
    if not spf_records:
        print("""
3. Configurar SPF:
   Añadir registro TXT para {}:
   v=spf1 mx include:_spf.google.com ~all
   
   Ajusta "include:" para incluir tus servicios de correo (Google, Microsoft, etc.)
   Usa "~all" inicialmente, y cambia a "-all" cuando estés seguro del funcionamiento
""".format(dominio))
    
    # Nota sobre servidores externos (SendGrid, Mailgun, etc)
    print("""
NOTA IMPORTANTE SOBRE SERVICIOS EXTERNOS:
Si usas servicios como SendGrid, Mailgun, o Postmark:
1. Asegúrate de incluir sus IPs o dominios en tu registro SPF
2. Sigue su documentación para configurar DKIM con sus selectores específicos
3. Considera usar un subdominio específico para servicios de correo masivo
   (ej: mail.{} o news.{})
""".format(dominio, dominio))

def instalar_dependencias():
    """Intenta instalar dependencias necesarias si no están presentes"""
    try:
        import dns.resolver
        return True
    except ImportError:
        print("El módulo 'dnspython' no está instalado.")
        try:
            print("Intentando instalar dependencias...")
            subprocess.run([sys.executable, "-m", "pip", "install", "dnspython"], 
                         check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            import dns.resolver
            print("Dependencias instaladas correctamente.")
            return True
        except Exception as e:
            print(f"Error instalando dependencias: {str(e)}")
            print("Por favor, instala manualmente 'dnspython' con: pip install dnspython")
            return False

def main():
    """Función principal"""
    # Verificar dependencias
    if not instalar_dependencias():
        sys.exit(1)
    
    # Procesar argumentos
    if len(sys.argv) > 1:
        dominio = sys.argv[1]
    else:
        dominio = "sage.vidahub.ai"  # Valor por defecto
    
    # Ejecutar diagnóstico
    verificar_configuracion_dns(dominio)

if __name__ == "__main__":
    main()