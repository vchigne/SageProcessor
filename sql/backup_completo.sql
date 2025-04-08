--
-- PostgreSQL database dump
--

-- Dumped from database version 16.8
-- Dumped by pg_dump version 16.5

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: trigger_casilla_email_actualizada(); Type: FUNCTION; Schema: public; Owner: neondb_owner
--

CREATE FUNCTION public.trigger_casilla_email_actualizada() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Si cambió la dirección de email
    IF OLD.email_casilla IS DISTINCT FROM NEW.email_casilla THEN
        -- Marcar configuración anterior como sin uso
        IF OLD.email_casilla IS NOT NULL AND OLD.email_casilla != '' THEN
            UPDATE email_configuraciones
            SET 
                estado = 'sin_uso',
                casilla_id = NULL,
                fecha_modificacion = NOW()
            WHERE 
                direccion = OLD.email_casilla
                AND casilla_id = OLD.id;
        END IF;
        
        -- Si tiene nueva dirección
        IF NEW.email_casilla IS NOT NULL AND NEW.email_casilla != '' THEN
            -- Verificar si ya existe la configuración
            IF NOT EXISTS (
                SELECT 1 FROM email_configuraciones 
                WHERE direccion = NEW.email_casilla
            ) THEN
                -- Crear configuración pendiente con valor predeterminado para usuario
                INSERT INTO email_configuraciones (
                    nombre, 
                    direccion, 
                    proposito,
                    usuario,            -- Añadimos el campo usuario
                    password,           -- Añadimos el campo password
                    casilla_id,
                    estado
                ) VALUES (
                    'Casilla: ' || NEW.nombre_yaml,
                    NEW.email_casilla,
                    'recepcion',
                    'sistema',          -- Valor predeterminado para usuario
                    'pendiente',        -- Valor predeterminado para password
                    NEW.id,
                    'pendiente'
                );
            ELSE
                -- Actualizar configuración existente para vincularla a esta casilla
                UPDATE email_configuraciones
                SET 
                    casilla_id = NEW.id,
                    estado = CASE WHEN estado = 'sin_uso' THEN 'pendiente' ELSE estado END,
                    fecha_modificacion = NOW()
                WHERE direccion = NEW.email_casilla;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION public.trigger_casilla_email_actualizada() OWNER TO neondb_owner;

--
-- Name: trigger_casilla_email_eliminada(); Type: FUNCTION; Schema: public; Owner: neondb_owner
--

CREATE FUNCTION public.trigger_casilla_email_eliminada() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Marcar configuración como sin uso
    IF OLD.email_casilla IS NOT NULL AND OLD.email_casilla != '' THEN
        UPDATE email_configuraciones
        SET 
            estado = 'sin_uso',
            casilla_id = NULL,
            fecha_modificacion = NOW()
        WHERE 
            direccion = OLD.email_casilla
            AND casilla_id = OLD.id;
    END IF;

    RETURN OLD;
END;
$$;


ALTER FUNCTION public.trigger_casilla_email_eliminada() OWNER TO neondb_owner;

--
-- Name: trigger_casilla_email_nueva(); Type: FUNCTION; Schema: public; Owner: neondb_owner
--

CREATE FUNCTION public.trigger_casilla_email_nueva() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Si la casilla tiene dirección de email
    IF NEW.email_casilla IS NOT NULL AND NEW.email_casilla != '' THEN
        -- Verificar si ya existe la configuración
        IF NOT EXISTS (
            SELECT 1 FROM email_configuraciones 
            WHERE direccion = NEW.email_casilla
        ) THEN
            -- Crear configuración pendiente
            INSERT INTO email_configuraciones (
                nombre, 
                direccion, 
                proposito,
                casilla_id,
                estado
            ) VALUES (
                'Casilla: ' || NEW.nombre_yaml,
                NEW.email_casilla,
                'recepcion',
                NEW.id,
                'pendiente'
            );
        ELSE
            -- Actualizar configuración existente para vincularla a esta casilla
            UPDATE email_configuraciones
            SET 
                casilla_id = NEW.id,
                estado = CASE WHEN estado = 'sin_uso' THEN 'pendiente' ELSE estado END,
                fecha_modificacion = NOW()
            WHERE direccion = NEW.email_casilla;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION public.trigger_casilla_email_nueva() OWNER TO neondb_owner;

--
-- Name: update_fecha_modificacion(); Type: FUNCTION; Schema: public; Owner: neondb_owner
--

CREATE FUNCTION public.update_fecha_modificacion() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
   NEW.fecha_modificacion = CURRENT_TIMESTAMP;
   RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_fecha_modificacion() OWNER TO neondb_owner;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: casillas; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.casillas (
    id integer NOT NULL,
    instalacion_id integer,
    nombre_yaml character varying(255) NOT NULL,
    email_casilla character varying(255),
    api_endpoint character varying(255),
    api_key character varying(255),
    creado_en timestamp without time zone DEFAULT now(),
    is_active boolean DEFAULT true,
    nombre character varying(255),
    descripcion character varying(255),
    yaml_contenido text
);


ALTER TABLE public.casillas OWNER TO neondb_owner;

--
-- Name: casillas_recepcion_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.casillas_recepcion_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.casillas_recepcion_id_seq OWNER TO neondb_owner;

--
-- Name: casillas_recepcion_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.casillas_recepcion_id_seq OWNED BY public.casillas.id;


--
-- Name: ejecuciones_yaml; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.ejecuciones_yaml (
    id integer NOT NULL,
    uuid uuid DEFAULT gen_random_uuid(),
    nombre_yaml character varying(255) NOT NULL,
    archivo_datos character varying(255) NOT NULL,
    fecha_ejecucion timestamp without time zone DEFAULT now(),
    estado character varying(50),
    errores_detectados integer DEFAULT 0,
    warnings_detectados integer DEFAULT 0,
    ruta_directorio text NOT NULL,
    casilla_id integer,
    emisor_id integer,
    metodo_envio character varying(50),
    CONSTRAINT ejecuciones_yaml_estado_check CHECK (((estado)::text = ANY ((ARRAY['Éxito'::character varying, 'Fallido'::character varying, 'Parcial'::character varying])::text[]))),
    CONSTRAINT ejecuciones_yaml_metodo_envio_check CHECK (((metodo_envio)::text = ANY ((ARRAY['email'::character varying, 'sftp'::character varying, 'direct_upload'::character varying, 'portal_upload'::character varying, 'api'::character varying])::text[])))
);


ALTER TABLE public.ejecuciones_yaml OWNER TO neondb_owner;

--
-- Name: ejecuciones_yaml_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.ejecuciones_yaml_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ejecuciones_yaml_id_seq OWNER TO neondb_owner;

--
-- Name: ejecuciones_yaml_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.ejecuciones_yaml_id_seq OWNED BY public.ejecuciones_yaml.id;


--
-- Name: email_configuraciones; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.email_configuraciones (
    id integer NOT NULL,
    nombre character varying(100) NOT NULL,
    direccion character varying(255) NOT NULL,
    proposito character varying(50) NOT NULL,
    servidor_entrada character varying(255),
    puerto_entrada integer,
    protocolo_entrada character varying(20),
    usar_ssl_entrada boolean DEFAULT true,
    servidor_salida character varying(255),
    puerto_salida integer,
    usar_tls_salida boolean DEFAULT true,
    usuario character varying(255) NOT NULL,
    password character varying(255),
    casilla_id integer,
    estado character varying(50) DEFAULT 'pendiente'::character varying NOT NULL,
    ultimo_chequeo timestamp without time zone,
    mensaje_error text,
    fecha_creacion timestamp without time zone DEFAULT now() NOT NULL,
    fecha_modificacion timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.email_configuraciones OWNER TO neondb_owner;

--
-- Name: email_configuraciones_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.email_configuraciones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.email_configuraciones_id_seq OWNER TO neondb_owner;

--
-- Name: email_configuraciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.email_configuraciones_id_seq OWNED BY public.email_configuraciones.id;


--
-- Name: emisores; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.emisores (
    id integer NOT NULL,
    organizacion_id integer,
    nombre character varying(255) NOT NULL,
    email_corporativo character varying(255) NOT NULL,
    telefono character varying(50),
    tipo_emisor character varying(50),
    creado_en timestamp without time zone DEFAULT now(),
    activo boolean DEFAULT true,
    CONSTRAINT emisores_tipo_emisor_check CHECK ((lower((tipo_emisor)::text) = ANY (ARRAY['interno'::text, 'corporativo'::text, 'distribuidora'::text, 'bot'::text, 'cadena mt'::text, 'eccomerce'::text, 'erp'::text, 'otros'::text])))
);


ALTER TABLE public.emisores OWNER TO neondb_owner;

--
-- Name: emisores_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.emisores_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.emisores_id_seq OWNER TO neondb_owner;

--
-- Name: emisores_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.emisores_id_seq OWNED BY public.emisores.id;


--
-- Name: emisores_por_casilla; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.emisores_por_casilla (
    id integer NOT NULL,
    emisor_id integer,
    casilla_id integer,
    metodo_envio character varying(50),
    parametros jsonb NOT NULL,
    responsable_nombre character varying(100),
    responsable_email character varying(255),
    responsable_telefono character varying(20),
    configuracion_frecuencia jsonb,
    frecuencia_tipo_id integer,
    responsable_activo boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    responsable text,
    frecuencia text,
    CONSTRAINT metodos_envio_emisor_metodo_envio_check CHECK (((metodo_envio)::text = ANY ((ARRAY['email'::character varying, 'sftp'::character varying, 'local'::character varying, 'api'::character varying])::text[])))
);


ALTER TABLE public.emisores_por_casilla OWNER TO neondb_owner;

--
-- Name: envios_realizados; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.envios_realizados (
    id integer NOT NULL,
    emisor_id integer,
    casilla_recepcion_id integer,
    metodo_envio character varying(50),
    usuario_envio_id integer,
    fecha_envio timestamp without time zone DEFAULT now(),
    archivo_nombre character varying(255) NOT NULL,
    uuid_ejecucion uuid,
    estado character varying(50),
    CONSTRAINT envios_realizados_estado_check CHECK (((estado)::text = ANY ((ARRAY['pendiente'::character varying, 'procesado'::character varying, 'fallido'::character varying])::text[]))),
    CONSTRAINT envios_realizados_metodo_envio_check CHECK (((metodo_envio)::text = ANY ((ARRAY['sftp'::character varying, 'email'::character varying, 'api'::character varying])::text[])))
);


ALTER TABLE public.envios_realizados OWNER TO neondb_owner;

--
-- Name: envios_realizados_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.envios_realizados_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.envios_realizados_id_seq OWNER TO neondb_owner;

--
-- Name: envios_realizados_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.envios_realizados_id_seq OWNED BY public.envios_realizados.id;


--
-- Name: eventos_notificacion; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.eventos_notificacion (
    id integer NOT NULL,
    tipo character varying(20) NOT NULL,
    emisor character varying(255) NOT NULL,
    casilla_id integer,
    mensaje text NOT NULL,
    detalles jsonb,
    fecha_creacion timestamp with time zone DEFAULT now(),
    procesado boolean DEFAULT false,
    fecha_procesado timestamp with time zone,
    CONSTRAINT eventos_notificacion_tipo_check CHECK (((tipo)::text = ANY ((ARRAY['error'::character varying, 'advertencia'::character varying, 'mensaje'::character varying, 'otro'::character varying])::text[])))
);


ALTER TABLE public.eventos_notificacion OWNER TO neondb_owner;

--
-- Name: eventos_notificacion_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.eventos_notificacion_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.eventos_notificacion_id_seq OWNER TO neondb_owner;

--
-- Name: eventos_notificacion_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.eventos_notificacion_id_seq OWNED BY public.eventos_notificacion.id;


--
-- Name: eventos_pendientes; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.eventos_pendientes (
    id integer NOT NULL,
    suscripcion_id integer NOT NULL,
    evento_id integer NOT NULL,
    fecha_creacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    fecha_programada timestamp without time zone,
    procesado boolean DEFAULT false NOT NULL,
    fecha_procesado timestamp without time zone,
    intentos integer DEFAULT 0 NOT NULL,
    ultimo_error text
);


ALTER TABLE public.eventos_pendientes OWNER TO neondb_owner;

--
-- Name: eventos_pendientes_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.eventos_pendientes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.eventos_pendientes_id_seq OWNER TO neondb_owner;

--
-- Name: eventos_pendientes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.eventos_pendientes_id_seq OWNED BY public.eventos_pendientes.id;


--
-- Name: frecuencias_tipo; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.frecuencias_tipo (
    id integer NOT NULL,
    nombre character varying(50) NOT NULL,
    descripcion text,
    activo boolean DEFAULT true
);


ALTER TABLE public.frecuencias_tipo OWNER TO neondb_owner;

--
-- Name: frecuencias_tipo_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.frecuencias_tipo_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.frecuencias_tipo_id_seq OWNER TO neondb_owner;

--
-- Name: frecuencias_tipo_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.frecuencias_tipo_id_seq OWNED BY public.frecuencias_tipo.id;


--
-- Name: instalaciones; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.instalaciones (
    id integer NOT NULL,
    organizacion_id integer,
    pais_id integer,
    producto_id integer,
    nombre text
);


ALTER TABLE public.instalaciones OWNER TO neondb_owner;

--
-- Name: instalaciones_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.instalaciones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.instalaciones_id_seq OWNER TO neondb_owner;

--
-- Name: instalaciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.instalaciones_id_seq OWNED BY public.instalaciones.id;


--
-- Name: metodos_envio_emisor_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.metodos_envio_emisor_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.metodos_envio_emisor_id_seq OWNER TO neondb_owner;

--
-- Name: metodos_envio_emisor_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.metodos_envio_emisor_id_seq OWNED BY public.emisores_por_casilla.id;


--
-- Name: migrations; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.migrations (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    applied_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.migrations OWNER TO neondb_owner;

--
-- Name: migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.migrations_id_seq OWNER TO neondb_owner;

--
-- Name: migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.migrations_id_seq OWNED BY public.migrations.id;


--
-- Name: notificaciones_enviadas; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.notificaciones_enviadas (
    id integer NOT NULL,
    suscripcion_id integer,
    eventos_ids integer[] NOT NULL,
    cantidad_eventos integer NOT NULL,
    resumen text,
    fecha_envio timestamp with time zone DEFAULT now(),
    estado character varying(20) NOT NULL,
    mensaje_error text,
    tipo_envio character varying(20) NOT NULL,
    detalles_envio jsonb,
    CONSTRAINT notificaciones_enviadas_estado_check CHECK (((estado)::text = ANY ((ARRAY['enviado'::character varying, 'error'::character varying, 'pendiente'::character varying])::text[]))),
    CONSTRAINT notificaciones_enviadas_tipo_envio_check CHECK (((tipo_envio)::text = ANY ((ARRAY['email'::character varying, 'webhook'::character varying, 'sms'::character varying, 'otro'::character varying])::text[])))
);


ALTER TABLE public.notificaciones_enviadas OWNER TO neondb_owner;

--
-- Name: notificaciones_enviadas_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.notificaciones_enviadas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notificaciones_enviadas_id_seq OWNER TO neondb_owner;

--
-- Name: notificaciones_enviadas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.notificaciones_enviadas_id_seq OWNED BY public.notificaciones_enviadas.id;


--
-- Name: organizaciones; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.organizaciones (
    id integer NOT NULL,
    nombre character varying(255) NOT NULL,
    creado_en timestamp without time zone DEFAULT now()
);


ALTER TABLE public.organizaciones OWNER TO neondb_owner;

--
-- Name: organizaciones_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.organizaciones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.organizaciones_id_seq OWNER TO neondb_owner;

--
-- Name: organizaciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.organizaciones_id_seq OWNED BY public.organizaciones.id;


--
-- Name: paises; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.paises (
    id integer NOT NULL,
    codigo_iso character(2) NOT NULL,
    nombre character varying(100) NOT NULL,
    es_territorio_personalizado boolean DEFAULT false
);


ALTER TABLE public.paises OWNER TO neondb_owner;

--
-- Name: paises_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.paises_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.paises_id_seq OWNER TO neondb_owner;

--
-- Name: paises_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.paises_id_seq OWNED BY public.paises.id;


--
-- Name: portales; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.portales (
    id integer NOT NULL,
    instalacion_id integer NOT NULL,
    uuid uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre character varying(255) NOT NULL,
    creado_en timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    activo boolean DEFAULT true,
    ultimo_acceso timestamp with time zone
);


ALTER TABLE public.portales OWNER TO neondb_owner;

--
-- Name: portales_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.portales_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.portales_id_seq OWNER TO neondb_owner;

--
-- Name: portales_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.portales_id_seq OWNED BY public.portales.id;


--
-- Name: productos; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.productos (
    id integer NOT NULL,
    nombre character varying(255) NOT NULL
);


ALTER TABLE public.productos OWNER TO neondb_owner;

--
-- Name: productos_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.productos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.productos_id_seq OWNER TO neondb_owner;

--
-- Name: productos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.productos_id_seq OWNED BY public.productos.id;


--
-- Name: suscripciones; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.suscripciones (
    id integer NOT NULL,
    nombre character varying(255) NOT NULL,
    email character varying(255),
    telefono character varying(50),
    activo boolean DEFAULT true,
    frecuencia character varying(20) NOT NULL,
    nivel_detalle character varying(30) NOT NULL,
    dia_envio integer,
    tipos_evento jsonb DEFAULT '["error"]'::jsonb NOT NULL,
    casilla_id integer NOT NULL,
    emisores jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_notification_at timestamp with time zone,
    metodo_envio character varying(20) DEFAULT 'email'::character varying NOT NULL,
    es_tecnico boolean DEFAULT false NOT NULL,
    webhook_url character varying(255),
    api_key character varying(255),
    hora_envio time without time zone,
    CONSTRAINT suscripciones_dia_envio_check CHECK (((dia_envio >= 1) AND (dia_envio <= 31))),
    CONSTRAINT suscripciones_frecuencia_check CHECK (((frecuencia)::text = ANY ((ARRAY['inmediata'::character varying, 'diaria'::character varying, 'semanal'::character varying, 'mensual'::character varying])::text[]))),
    CONSTRAINT suscripciones_nivel_detalle_check CHECK (((nivel_detalle)::text = ANY ((ARRAY['detallado'::character varying, 'resumido_emisor'::character varying, 'resumido_casilla'::character varying])::text[])))
);


ALTER TABLE public.suscripciones OWNER TO neondb_owner;

--
-- Name: COLUMN suscripciones.metodo_envio; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public.suscripciones.metodo_envio IS 'Método de envío de notificaciones (email, whatsapp, telegram, etc.)';


--
-- Name: COLUMN suscripciones.es_tecnico; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public.suscripciones.es_tecnico IS 'Indica si es una suscripción técnica (webhook)';


--
-- Name: COLUMN suscripciones.webhook_url; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public.suscripciones.webhook_url IS 'URL del webhook para suscripciones técnicas';


--
-- Name: COLUMN suscripciones.api_key; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public.suscripciones.api_key IS 'API key opcional para autenticación en webhooks';


--
-- Name: COLUMN suscripciones.hora_envio; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public.suscripciones.hora_envio IS 'Hora del día para envío de notificaciones, en formato TIME';


--
-- Name: suscripciones_backup; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.suscripciones_backup (
    id integer,
    suscriptor_id integer,
    casilla_id integer,
    emisores_ids integer[],
    notificar_errores boolean,
    notificar_warnings boolean,
    notificar_mensajes boolean,
    notificar_otros boolean,
    frecuencia character varying(20),
    hora_envio time without time zone,
    dia_envio integer,
    extension character varying(20),
    formato_notificacion character varying(20),
    fecha_creacion timestamp without time zone,
    fecha_modificacion timestamp without time zone,
    fecha_ultima_notificacion timestamp without time zone,
    activo boolean,
    uuid uuid
);


ALTER TABLE public.suscripciones_backup OWNER TO neondb_owner;

--
-- Name: suscripciones_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.suscripciones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.suscripciones_id_seq OWNER TO neondb_owner;

--
-- Name: suscripciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.suscripciones_id_seq OWNED BY public.suscripciones.id;


--
-- Name: usuarios; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.usuarios (
    id integer NOT NULL,
    nombre character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    creado_en timestamp without time zone DEFAULT now()
);


ALTER TABLE public.usuarios OWNER TO neondb_owner;

--
-- Name: usuarios_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.usuarios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.usuarios_id_seq OWNER TO neondb_owner;

--
-- Name: usuarios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.usuarios_id_seq OWNED BY public.usuarios.id;


--
-- Name: webhooks_configuracion; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.webhooks_configuracion (
    id integer NOT NULL,
    suscripcion_id integer NOT NULL,
    url_endpoint character varying(512) NOT NULL,
    metodo_http character varying(10) NOT NULL,
    headers jsonb,
    requiere_autenticacion boolean DEFAULT false NOT NULL,
    tipo_autenticacion character varying(20),
    credenciales text,
    activo boolean DEFAULT true NOT NULL,
    fecha_creacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    fecha_modificacion timestamp without time zone,
    CONSTRAINT chk_auth CHECK ((((requiere_autenticacion = false) AND (tipo_autenticacion IS NULL) AND (credenciales IS NULL)) OR ((requiere_autenticacion = true) AND (tipo_autenticacion IS NOT NULL)))),
    CONSTRAINT webhooks_configuracion_metodo_http_check CHECK (((metodo_http)::text = ANY ((ARRAY['GET'::character varying, 'POST'::character varying, 'PUT'::character varying, 'PATCH'::character varying])::text[]))),
    CONSTRAINT webhooks_configuracion_tipo_autenticacion_check CHECK (((tipo_autenticacion)::text = ANY ((ARRAY['basic'::character varying, 'bearer'::character varying, 'api_key'::character varying, NULL::character varying])::text[])))
);


ALTER TABLE public.webhooks_configuracion OWNER TO neondb_owner;

--
-- Name: webhooks_configuracion_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.webhooks_configuracion_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.webhooks_configuracion_id_seq OWNER TO neondb_owner;

--
-- Name: webhooks_configuracion_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.webhooks_configuracion_id_seq OWNED BY public.webhooks_configuracion.id;


--
-- Name: casillas id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.casillas ALTER COLUMN id SET DEFAULT nextval('public.casillas_recepcion_id_seq'::regclass);


--
-- Name: ejecuciones_yaml id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.ejecuciones_yaml ALTER COLUMN id SET DEFAULT nextval('public.ejecuciones_yaml_id_seq'::regclass);


--
-- Name: email_configuraciones id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.email_configuraciones ALTER COLUMN id SET DEFAULT nextval('public.email_configuraciones_id_seq'::regclass);


--
-- Name: emisores id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.emisores ALTER COLUMN id SET DEFAULT nextval('public.emisores_id_seq'::regclass);


--
-- Name: emisores_por_casilla id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.emisores_por_casilla ALTER COLUMN id SET DEFAULT nextval('public.metodos_envio_emisor_id_seq'::regclass);


--
-- Name: envios_realizados id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.envios_realizados ALTER COLUMN id SET DEFAULT nextval('public.envios_realizados_id_seq'::regclass);


--
-- Name: eventos_notificacion id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.eventos_notificacion ALTER COLUMN id SET DEFAULT nextval('public.eventos_notificacion_id_seq'::regclass);


--
-- Name: eventos_pendientes id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.eventos_pendientes ALTER COLUMN id SET DEFAULT nextval('public.eventos_pendientes_id_seq'::regclass);


--
-- Name: frecuencias_tipo id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.frecuencias_tipo ALTER COLUMN id SET DEFAULT nextval('public.frecuencias_tipo_id_seq'::regclass);


--
-- Name: instalaciones id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.instalaciones ALTER COLUMN id SET DEFAULT nextval('public.instalaciones_id_seq'::regclass);


--
-- Name: migrations id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.migrations ALTER COLUMN id SET DEFAULT nextval('public.migrations_id_seq'::regclass);


--
-- Name: notificaciones_enviadas id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.notificaciones_enviadas ALTER COLUMN id SET DEFAULT nextval('public.notificaciones_enviadas_id_seq'::regclass);


--
-- Name: organizaciones id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.organizaciones ALTER COLUMN id SET DEFAULT nextval('public.organizaciones_id_seq'::regclass);


--
-- Name: paises id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.paises ALTER COLUMN id SET DEFAULT nextval('public.paises_id_seq'::regclass);


--
-- Name: portales id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.portales ALTER COLUMN id SET DEFAULT nextval('public.portales_id_seq'::regclass);


--
-- Name: productos id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.productos ALTER COLUMN id SET DEFAULT nextval('public.productos_id_seq'::regclass);


--
-- Name: suscripciones id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.suscripciones ALTER COLUMN id SET DEFAULT nextval('public.suscripciones_id_seq'::regclass);


--
-- Name: usuarios id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.usuarios ALTER COLUMN id SET DEFAULT nextval('public.usuarios_id_seq'::regclass);


--
-- Name: webhooks_configuracion id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.webhooks_configuracion ALTER COLUMN id SET DEFAULT nextval('public.webhooks_configuracion_id_seq'::regclass);


--
-- Data for Name: casillas; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.casillas (id, instalacion_id, nombre_yaml, email_casilla, api_endpoint, api_key, creado_en, is_active, nombre, descripcion, yaml_contenido) FROM stdin;
30	2	ventas_completo.yaml	\N	\N	\N	2025-03-11 01:24:24.462086	t	Sistema Completo de Ventas	Test complejo con múltiples catálogos y validaciones cruzadas	sage_yaml:\n  name: "Sistema Completo de Ventas"\n  description: "Test complejo con múltiples catálogos y validaciones cruzadas"\n  version: "1.0.0"\n  author: "SAGE Tests"\n  comments: "Caso de prueba complejo con ZIP"\n\ncatalogs:\n  productos:\n    name: "Catálogo de Productos"\n    description: "Productos disponibles"\n    filename: "productos.xlsx"\n    path: "./data"\n    file_format:\n      type: "EXCEL"\n      header: true\n    fields:\n      - name: "codigo_producto"\n        type: "texto"\n        required: true\n        unique: true\n        validation_rules:\n          - name: "Formato código producto"\n            description: "El código debe seguir el formato PROD-XXX"\n            rule: "df['codigo_producto'].str.match('PROD-[0-9]{3}')"\n            severity: "error"\n      - name: "existencias"\n        type: "entero"\n        required: true\n        validation_rules:\n          - name: "Stock válido"\n            description: "El stock debe ser positivo"\n            rule: "df['existencias'] >= 0"\n            severity: "error"\n\n  clientes:\n    name: "Catálogo de Clientes"\n    description: "Clientes registrados"\n    filename: "clientes.csv"\n    path: "./data"\n    file_format:\n      type: "CSV"\n      delimiter: ","\n      header: true\n    fields:\n      - name: "codigo_cliente"\n        type: "texto"\n        required: true\n        unique: true\n        validation_rules:\n          - name: "Formato código cliente"\n            description: "El código debe seguir el formato CLI-XXX"\n            rule: "df['codigo_cliente'].str.match('CLI-[0-9]{3}')"\n            severity: "error"\n      - name: "limite_credito"\n        type: "decimal"\n        required: true\n        validation_rules:\n          - name: "Límite válido"\n            description: "El límite debe ser positivo"\n            rule: "df['limite_credito'] > 0"\n            severity: "error"\n\n  ventas:\n    name: "Registro de Ventas"\n    description: "Ventas realizadas"\n    filename: "ventas.csv"\n    path: "./data"\n    file_format:\n      type: "CSV"\n      delimiter: ","\n      header: true\n    fields:\n      - name: "codigo_venta"\n        type: "texto"\n        required: true\n        unique: true\n        validation_rules:\n          - name: "Formato código venta"\n            description: "El código debe seguir el formato VTA-XXX"\n            rule: "df['codigo_venta'].str.match('VTA-[0-9]{3}')"\n            severity: "error"\n      - name: "codigo_cliente"\n        type: "texto"\n        required: true\n      - name: "codigo_producto"\n        type: "texto"\n        required: true\n      - name: "cantidad"\n        type: "entero"\n        required: true\n        validation_rules:\n          - name: "Cantidad válida"\n            description: "La cantidad debe ser positiva"\n            rule: "df['cantidad'] > 0"\n            severity: "error"\n\npackages:\n  paquete_ventas:\n    name: "Paquete Completo de Ventas"\n    description: "Sistema completo de ventas"\n    file_format:\n      type: "ZIP"\n    catalogs:\n      - productos\n      - clientes\n      - ventas\n    package_validation:\n      - name: "Stock suficiente"\n        description: "Debe haber suficiente stock para cada venta"\n        rule: "df['ventas'].groupby('codigo_producto')['cantidad'].sum() <= df['productos'].set_index('codigo_producto')['existencias']"\n        severity: "error"\n      - name: "Clientes válidos"\n        description: "Las ventas deben ser a clientes existentes"\n        rule: "df['ventas']['codigo_cliente'].isin(df['clientes']['codigo_cliente'])"\n        severity: "error"\n
43	3	input.yaml	\N	\N	\N	2025-03-11 18:55:52.866643	t	Validación de Sistema de Ventas	Configuración para validar archivos de ventas, productos y clientes	sage_yaml:\n  name: "Validación de Sistema de Ventas"\n  description: "Configuración para validar archivos de ventas, productos y clientes"\n  version: "1.0.0"\n  author: "SAGE"\n  comments: "Ejemplo de validación compleja con múltiples catálogos y reglas cruzadas"\n\ncatalogs:\n  productos:\n    name: "Catálogo de Productos"\n    description: "Lista maestra de productos con precios y existencias"\n    filename: "productos.xlsx"  # Cambiado a Excel\n    path: "/data/sage/ventas/"\n    file_format:\n      type: "EXCEL"  # Cambiado de CSV a EXCEL\n      header: true\n    fields:\n      - name: "codigo_producto"\n        type: "texto"\n        required: true\n        unique: true\n        validation_rules:\n          - name: "Código producto válido"\n            description: "El código del producto debe seguir el formato: P-XXXXXX (donde X son números)"\n            rule: "df['codigo_producto'].str.match('P-[0-9]{6}')"\n            severity: "error"\n      - name: "nombre"\n        type: "texto"\n        required: true\n        validation_rules:\n          - name: "Longitud nombre"\n            description: "El nombre del producto debe tener entre 5 y 100 caracteres"\n            rule: "df['nombre'].str.len().between(5, 100)"\n            severity: "error"\n      - name: "precio"\n        type: "decimal"\n        required: true\n        validation_rules:\n          - name: "Precio válido"\n            description: "El precio debe ser mayor que cero"\n            rule: "df['precio'] > 0"\n            severity: "error"\n      - name: "existencias"\n        type: "entero"\n        required: true\n        validation_rules:\n          - name: "Existencias válidas"\n            description: "Las existencias no pueden ser negativas"\n            rule: "df['existencias'] >= 0"\n            severity: "error"\n    catalog_validation:\n      - name: "Productos sin stock"\n        description: "Advertencia de productos con existencias bajas (menos de 10 unidades)"\n        rule: "df['existencias'].min() >= 10"\n        severity: "warning"\n\n  clientes:\n    name: "Catálogo de Clientes"\n    description: "Información de clientes y sus límites de crédito"\n    filename: "clientes.csv"\n    path: "/data/sage/ventas/"\n    file_format:\n      type: "CSV"\n      delimiter: ","\n      header: true\n    fields:\n      - name: "codigo_cliente"\n        type: "texto"\n        required: true\n        unique: true\n        validation_rules:\n          - name: "Código cliente válido"\n            description: "El código del cliente debe seguir el formato: C-XXXXXXXX (donde X son números)"\n            rule: "df['codigo_cliente'].str.match('C-[0-9]{8}')"\n            severity: "error"\n      - name: "nombre"\n        type: "texto"\n        required: true\n      - name: "limite_credito"\n        type: "decimal"\n        required: true\n        validation_rules:\n          - name: "Límite crédito válido"\n            description: "El límite de crédito debe ser mayor que cero"\n            rule: "df['limite_credito'] > 0"\n            severity: "error"\n      - name: "credito_usado"\n        type: "decimal"\n        required: true\n        validation_rules:\n          - name: "Crédito usado válido"\n            description: "El crédito usado no puede ser negativo"\n            rule: "df['credito_usado'] >= 0"\n            severity: "error"\n    row_validation:\n      - name: "Límite de crédito excedido"\n        description: "El crédito usado no puede superar el límite de crédito"\n        rule: "df['credito_usado'] <= df['limite_credito']"\n        severity: "error"\n    catalog_validation:\n      - name: "Clientes cerca del límite"\n        description: "Advertencia de clientes usando más del 80% de su crédito"\n        rule: "(df['credito_usado'] / df['limite_credito']).max() <= 0.8"\n        severity: "warning"\n\n  ventas:\n    name: "Registro de Ventas"\n    description: "Transacciones de venta realizadas"\n    filename: "ventas.csv"\n    path: "/data/sage/ventas/"\n    file_format:\n      type: "CSV"\n      delimiter: ","\n      header: true\n    fields:\n      - name: "codigo_venta"\n        type: "texto"\n        required: true\n        unique: true\n        validation_rules:\n          - name: "Código venta válido"\n            description: "El código de venta debe seguir el formato: V-XXXXXXXXXX (donde X son números)"\n            rule: "df['codigo_venta'].str.match('V-[0-9]{10}')"\n            severity: "error"\n      - name: "fecha"\n        type: "fecha"\n        required: true\n        validation_rules:\n          - name: "Fecha válida"\n            description: "La fecha no puede ser futura"\n            rule: "pd.to_datetime(df['fecha']) <= pd.Timestamp.now()"\n            severity: "error"\n      - name: "codigo_cliente"\n        type: "texto"\n        required: true\n      - name: "codigo_producto"\n        type: "texto"\n        required: true\n      - name: "cantidad"\n        type: "entero"\n        required: true\n        validation_rules:\n          - name: "Cantidad válida"\n            description: "La cantidad debe ser mayor que cero"\n            rule: "df['cantidad'] > 0"\n            severity: "error"\n      - name: "precio_unitario"\n        type: "decimal"\n        required: true\n        validation_rules:\n          - name: "Precio unitario válido"\n            description: "El precio unitario debe ser mayor que cero"\n            rule: "df['precio_unitario'] > 0"\n            severity: "error"\n      - name: "total"\n        type: "decimal"\n        required: true\n        validation_rules:\n          - name: "Total válido"\n            description: "El total debe ser mayor que cero"\n            rule: "df['total'] > 0"\n            severity: "error"\n    row_validation:\n      - name: "Total calculado correcto"\n        description: "El total debe ser igual a cantidad * precio_unitario"\n        rule: "abs(df['total'] - (df['cantidad'] * df['precio_unitario'])) < 0.01"\n        severity: "error"\n\npackages:\n  paquete_ventas:\n    name: "Paquete de Ventas"\n    description: "Contiene todos los archivos relacionados con ventas"\n    file_format:\n      type: "ZIP"\n    catalogs:\n      - productos\n      - clientes\n      - ventas\n    package_validation:\n      - name: "Referencias válidas a productos"\n        description: "Todas las ventas deben referenciar a productos existentes"\n        rule: "df['ventas']['codigo_producto'].isin(df['productos']['codigo_producto'])"\n        severity: "error"\n      - name: "Referencias válidas a clientes"\n        description: "Todas las ventas deben referenciar a clientes existentes"\n        rule: "df['ventas']['codigo_cliente'].isin(df['clientes']['codigo_cliente'])"\n        severity: "error"\n      - name: "Stock suficiente"\n        description: "Cada producto debe tener suficiente stock para sus ventas"\n        rule: "df['ventas'].groupby('codigo_producto')['cantidad'].sum() <= df['productos'].set_index('codigo_producto')['existencias']"\n        severity: "error"\n      - name: "Precios consistentes"\n        description: "Los precios en las ventas deben coincidir con el catálogo de productos"\n        rule: "df['ventas']['precio_unitario'] == df['productos'].set_index('codigo_producto').loc[df['ventas']['codigo_producto'], 'precio'].values"\n        severity: "error"
44	4	configuracion (1).yaml	\N	\N	\N	2025-03-19 17:32:56.937125	t	Configuración de Catálogos de Ventas	Definición y validación de catálogos de productos, clientes y ventas	sage_yaml:\n  name: "Configuración de Catálogos de Ventas"\n  description: "Definición y validación de catálogos de productos, clientes y ventas"\n  version: "1.0.0"\n  author: "Usuario"\n  comments: "Archivo generado para validar catálogos de ventas y sus relaciones"\n\ncatalogs:\n  productos_csv:\n    name: "Catálogo de Productos CSV"\n    description: "Listado de productos con precios y existencias"\n    filename: "productos.csv"\n    file_format:\n      type: "CSV"\n      delimiter: ","\n      header: true\n    fields:\n      - name: "codigo_producto"\n        type: "texto"\n        required: true\n        unique: true\n      - name: "nombre"\n        type: "texto"\n        required: true\n      - name: "precio"\n        type: "decimal"\n        required: true\n        validation_rules:\n          - name: "Precio Positivo"\n            description: "¡Ops! El precio debe ser mayor a cero 💰"\n            rule: "df['precio'].astype(float) > 0"\n            severity: "error"\n      - name: "existencias"\n        type: "entero"\n        required: true\n        validation_rules:\n          - name: "Existencias No Negativas"\n            description: "¡Hey! Las existencias no pueden ser negativas 📦"\n            rule: "df['existencias'].astype(int) >= 0"\n            severity: "error"\n\n  clientes_csv:\n    name: "Catálogo de Clientes"\n    description: "Listado de clientes con su límite de crédito"\n    filename: "clientes.csv"\n    file_format:\n      type: "CSV"\n      delimiter: ","\n      header: true\n    fields:\n      - name: "codigo_cliente"\n        type: "texto"\n        required: true\n        unique: true\n      - name: "nombre"\n        type: "texto"\n        required: true\n      - name: "limite_credito"\n        type: "decimal"\n        required: true\n        validation_rules:\n          - name: "Límite de Crédito Positivo"\n            description: "¡Atención! El límite de crédito debe ser positivo 💳"\n            rule: "df['limite_credito'].astype(float) > 0"\n            severity: "error"\n\n  ventas_csv:\n    name: "Catálogo de Ventas"\n    description: "Registro de ventas realizadas"\n    filename: "ventas.csv"\n    file_format:\n      type: "CSV"\n      delimiter: ","\n      header: true\n    fields:\n      - name: "codigo_venta"\n        type: "texto"\n        required: true\n        unique: true\n      - name: "codigo_cliente"\n        type: "texto"\n        required: true\n      - name: "codigo_producto"\n        type: "texto"\n        required: true\n      - name: "cantidad"\n        type: "entero"\n        required: true\n        validation_rules:\n          - name: "Cantidad Positiva"\n            description: "¡Ops! La cantidad debe ser mayor a cero 🛒"\n            rule: "df['cantidad'].astype(int) > 0"\n            severity: "error"\n\n  productos_xlsx:\n    name: "Catálogo de Productos XLSX"\n    description: "Listado de productos con existencias"\n    filename: "productos.xlsx"\n    file_format:\n      type: "EXCEL"\n    fields:\n      - name: "codigo_producto"\n        type: "texto"\n        required: true\n        unique: true\n      - name: "nombre"\n        type: "texto"\n        required: true\n      - name: "existencias"\n        type: "entero"\n        required: true\n        validation_rules:\n          - name: "Existencias No Negativas"\n            description: "¡Hey! Las existencias no pueden ser negativas 📦"\n            rule: "df['existencias'].astype(int) >= 0"\n            severity: "error"\n\npackages:\n  paquete_ventas:\n    name: "Paquete de Ventas"\n    description: "Paquete que incluye catálogos de productos, clientes y ventas"\n    file_format:\n      type: "ZIP"\n    catalogs:\n      - productos_csv\n      - clientes_csv\n      - ventas_csv\n      - productos_xlsx\n    package_validation:\n      - name: "Verificar Cliente en Ventas"\n        description: "¡Ups! El cliente de la venta no existe en el catálogo de clientes 🤔"\n        rule: "df['ventas_csv']['codigo_cliente'].isin(df['clientes_csv']['codigo_cliente'])"\n        severity: "error"\n      - name: "Verificar Producto en Ventas"\n        description: "¡Ups! El producto de la venta no existe en el catálogo de productos 🔍"\n        rule: "df['ventas_csv']['codigo_producto'].isin(df['productos_csv']['codigo_producto'])"\n        severity: "error"
46	1	input(1).yaml	\N	\N	\N	2025-03-24 20:52:56.313338	t	Validación de Sistema de Ventas	Configuración para validar archivos de ventas, productos y clientes	sage_yaml:\n  name: "Validación de Sistema de Ventas"\n  description: "Configuración para validar archivos de ventas, productos y clientes"\n  version: "1.0.0"\n  author: "SAGE"\n  comments: "Ejemplo de validación compleja con múltiples catálogos y reglas cruzadas"\n\ncatalogs:\n  productos:\n    name: "Catálogo de Productos"\n    description: "Lista maestra de productos con precios y existencias"\n    filename: "productos.xlsx"  # Cambiado a Excel\n    path: "/data/sage/ventas/"\n    file_format:\n      type: "EXCEL"  # Cambiado de CSV a EXCEL\n      header: true\n    fields:\n      - name: "codigo_producto"\n        type: "texto"\n        required: true\n        unique: true\n        validation_rules:\n          - name: "Código producto válido"\n            description: "El código del producto debe seguir el formato: P-XXXXXX (donde X son números)"\n            rule: "df['codigo_producto'].str.match('P-[0-9]{6}')"\n            severity: "error"\n      - name: "nombre"\n        type: "texto"\n        required: true\n        validation_rules:\n          - name: "Longitud nombre"\n            description: "El nombre del producto debe tener entre 5 y 100 caracteres"\n            rule: "df['nombre'].str.len().between(5, 100)"\n            severity: "error"\n      - name: "precio"\n        type: "decimal"\n        required: true\n        validation_rules:\n          - name: "Precio válido"\n            description: "El precio debe ser mayor que cero"\n            rule: "df['precio'] > 0"\n            severity: "error"\n      - name: "existencias"\n        type: "entero"\n        required: true\n        validation_rules:\n          - name: "Existencias válidas"\n            description: "Las existencias no pueden ser negativas"\n            rule: "df['existencias'] >= 0"\n            severity: "error"\n    catalog_validation:\n      - name: "Productos sin stock"\n        description: "Advertencia de productos con existencias bajas (menos de 10 unidades)"\n        rule: "df['existencias'].min() >= 10"\n        severity: "warning"\n\n  clientes:\n    name: "Catálogo de Clientes"\n    description: "Información de clientes y sus límites de crédito"\n    filename: "clientes.csv"\n    path: "/data/sage/ventas/"\n    file_format:\n      type: "CSV"\n      delimiter: ","\n      header: true\n    fields:\n      - name: "codigo_cliente"\n        type: "texto"\n        required: true\n        unique: true\n        validation_rules:\n          - name: "Código cliente válido"\n            description: "El código del cliente debe seguir el formato: C-XXXXXXXX (donde X son números)"\n            rule: "df['codigo_cliente'].str.match('C-[0-9]{8}')"\n            severity: "error"\n      - name: "nombre"\n        type: "texto"\n        required: true\n      - name: "limite_credito"\n        type: "decimal"\n        required: true\n        validation_rules:\n          - name: "Límite crédito válido"\n            description: "El límite de crédito debe ser mayor que cero"\n            rule: "df['limite_credito'] > 0"\n            severity: "error"\n      - name: "credito_usado"\n        type: "decimal"\n        required: true\n        validation_rules:\n          - name: "Crédito usado válido"\n            description: "El crédito usado no puede ser negativo"\n            rule: "df['credito_usado'] >= 0"\n            severity: "error"\n    row_validation:\n      - name: "Límite de crédito excedido"\n        description: "El crédito usado no puede superar el límite de crédito"\n        rule: "df['credito_usado'] <= df['limite_credito']"\n        severity: "error"\n    catalog_validation:\n      - name: "Clientes cerca del límite"\n        description: "Advertencia de clientes usando más del 80% de su crédito"\n        rule: "(df['credito_usado'] / df['limite_credito']).max() <= 0.8"\n        severity: "warning"\n\n  ventas:\n    name: "Registro de Ventas"\n    description: "Transacciones de venta realizadas"\n    filename: "ventas.csv"\n    path: "/data/sage/ventas/"\n    file_format:\n      type: "CSV"\n      delimiter: ","\n      header: true\n    fields:\n      - name: "codigo_venta"\n        type: "texto"\n        required: true\n        unique: true\n        validation_rules:\n          - name: "Código venta válido"\n            description: "El código de venta debe seguir el formato: V-XXXXXXXXXX (donde X son números)"\n            rule: "df['codigo_venta'].str.match('V-[0-9]{10}')"\n            severity: "error"\n      - name: "fecha"\n        type: "fecha"\n        required: true\n        validation_rules:\n          - name: "Fecha válida"\n            description: "La fecha no puede ser futura"\n            rule: "pd.to_datetime(df['fecha']) <= pd.Timestamp.now()"\n            severity: "error"\n      - name: "codigo_cliente"\n        type: "texto"\n        required: true\n      - name: "codigo_producto"\n        type: "texto"\n        required: true\n      - name: "cantidad"\n        type: "entero"\n        required: true\n        validation_rules:\n          - name: "Cantidad válida"\n            description: "La cantidad debe ser mayor que cero"\n            rule: "df['cantidad'] > 0"\n            severity: "error"\n      - name: "precio_unitario"\n        type: "decimal"\n        required: true\n        validation_rules:\n          - name: "Precio unitario válido"\n            description: "El precio unitario debe ser mayor que cero"\n            rule: "df['precio_unitario'] > 0"\n            severity: "error"\n      - name: "total"\n        type: "decimal"\n        required: true\n        validation_rules:\n          - name: "Total válido"\n            description: "El total debe ser mayor que cero"\n            rule: "df['total'] > 0"\n            severity: "error"\n    row_validation:\n      - name: "Total calculado correcto"\n        description: "El total debe ser igual a cantidad * precio_unitario"\n        rule: "abs(df['total'] - (df['cantidad'] * df['precio_unitario'])) < 0.01"\n        severity: "error"\n\npackages:\n  paquete_ventas:\n    name: "Paquete de Ventas"\n    description: "Contiene todos los archivos relacionados con ventas"\n    file_format:\n      type: "ZIP"\n    catalogs:\n      - productos\n      - clientes\n      - ventas\n    package_validation:\n      - name: "Referencias válidas a productos"\n        description: "Todas las ventas deben referenciar a productos existentes"\n        rule: "df['ventas']['codigo_producto'].isin(df['productos']['codigo_producto'])"\n        severity: "error"\n      - name: "Referencias válidas a clientes"\n        description: "Todas las ventas deben referenciar a clientes existentes"\n        rule: "df['ventas']['codigo_cliente'].isin(df['clientes']['codigo_cliente'])"\n        severity: "error"\n      - name: "Stock suficiente"\n        description: "Cada producto debe tener suficiente stock para sus ventas"\n        rule: "df['ventas'].groupby('codigo_producto')['cantidad'].sum() <= df['productos'].set_index('codigo_producto')['existencias']"\n        severity: "error"\n      - name: "Precios consistentes"\n        description: "Los precios en las ventas deben coincidir con el catálogo de productos"\n        rule: "df['ventas']['precio_unitario'] == df['productos'].set_index('codigo_producto').loc[df['ventas']['codigo_producto'], 'precio'].values"\n        severity: "error"
56	6	configuracion3.yaml	\N	\N	\N	2025-03-30 15:21:19.050035	t	Configuración de Archivos de Distribuidor	Definición de la estructura y validación de archivos CSV para un distribuidor	sage_yaml:\n  name: "Configuración de Archivos de Distribuidor"\n  description: "Definición de la estructura y validación de archivos CSV para un distribuidor"\n  version: "1.0.0"\n  author: "Distribuidor Genérico"\n  comments: "Configuración para archivos CSV utilizados en el día a día de un distribuidor"\n\ncatalogs:\n  clientes:\n    name: "Catálogo de Clientes"\n    description: "Información detallada de los clientes"\n    filename: "clientes.csv"\n    file_format:\n      type: "CSV"\n      delimiter: ","\n      header: true\n    fields:\n      - name: "30001"\n        type: "entero"\n        unique: false\n      - name: "14007023"\n        type: "entero"\n        unique: false\n      - name: "00000001"\n        type: "entero"\n        unique: false\n      - name: "ABANTO RONCAL MARIA"\n        type: "texto"\n        unique: false\n      - name: "DNI/LE"\n        type: "texto"\n        unique: false\n      - name: "Unnamed: 5"\n        type: "texto"\n        unique: false\n      - name: "LA ALBORADA 1010"\n        type: "texto"\n        unique: false\n      - name: "Unnamed: 7"\n        type: "texto"\n        unique: false\n      - name: "Unnamed: 8"\n        type: "texto"\n        unique: false\n      - name: "DETALLISTA"\n        type: "texto"\n        unique: false\n      - name: "BODEGA ABIERTA"\n        type: "texto"\n        unique: false\n      - name: "Unnamed: 11"\n        type: "texto"\n        unique: false\n      - name: "150137"\n        type: "entero"\n        unique: false\n      - name: "LIMA / LIMA / SANTA ANITA"\n        type: "texto"\n        unique: false\n      - name: "I"\n        type: "texto"\n        unique: false\n      - name: "-76.7968"\n        type: "decimal"\n        unique: false\n      - name: "-12.361"\n        type: "decimal"\n        unique: false\n      - name: "Unnamed: 17"\n        type: "texto"\n        unique: false\n      - name: "2008-03-14"\n        type: "fecha"\n        unique: false\n      - name: "2023-01-18"\n        type: "fecha"\n        unique: false\n      - name: "2025-03-30 00:52:46"\n        type: "fecha"\n        unique: false\n      - name: "Unnamed: 21"\n        type: "texto"\n        unique: false\n      - name: "1"\n        type: "entero"\n        unique: false\n      - name: "01"\n        type: "entero"\n        unique: false\n      - name: "Unnamed: 24"\n        type: "texto"\n        unique: false\n      - name: "Unnamed: 25"\n        type: "texto"\n        unique: false\n      - name: "Unnamed: 26"\n        type: "texto"\n        unique: false\n      - name: "Unnamed: 27"\n        type: "texto"\n        unique: false\n      - name: "Unnamed: 28"\n        type: "texto"\n        unique: false\n      - name: "Unnamed: 29"\n        type: "texto"\n        unique: false\n      - name: "Unnamed: 30"\n        type: "texto"\n        unique: false\n\n  pedidos:\n    name: "Catálogo de Pedidos"\n    description: "Registro de pedidos realizados"\n    filename: "pedidos.csv"\n    file_format:\n      type: "CSV"\n      delimiter: ","\n      header: true\n    fields:\n      - name: "30001"\n        type: "entero"\n        unique: false\n      - name: "14007023"\n        type: "entero"\n        unique: false\n      - name: "00189212"\n        type: "entero"\n        unique: false\n      - name: "000393"\n        type: "entero"\n        unique: false\n      - name: "Unnamed: 4"\n        type: "texto"\n        unique: false\n      - name: "PE001 -07480792"\n        type: "texto"\n        unique: false\n      - name: "2025-01-16"\n        type: "fecha"\n        unique: false\n      - name: "APRO"\n        type: "texto"\n        unique: false\n      - name: "Unnamed: 8"\n        type: "texto"\n        unique: false\n      - name: "BO"\n        type: "texto"\n        unique: false\n      - name: "B031-01372424"\n        type: "texto"\n        unique: false\n      - name: "2025-01-17"\n        type: "fecha"\n        unique: false\n      - name: "APRO.1"\n        type: "texto"\n        unique: false\n      - name: "002"\n        type: "entero"\n        unique: false\n      - name: "00063332"\n        type: "texto"\n        unique: false\n      - name: "P"\n        type: "texto"\n        unique: false\n      - name: "2.00000000"\n        type: "decimal"\n        unique: false\n      - name: "UND"\n        type: "texto"\n        unique: false\n      - name: "0.50000000"\n        type: "decimal"\n        unique: false\n      - name: "CAJ"\n        type: "texto"\n        unique: false\n      - name: "16.0700"\n        type: "decimal"\n        unique: false\n      - name: "18.9600"\n        type: "decimal"\n        unique: false\n      - name: "0.0000"\n        type: "decimal"\n        unique: false\n      - name: "2025-03-30 00:53:21"\n        type: "fecha"\n        unique: false\n      - name: "002.1"\n        type: "entero"\n        unique: false\n      - name: "Unnamed: 25"\n        type: "texto"\n        unique: false\n      - name: "NORTE"\n        type: "texto"\n        unique: false\n      - name: "01"\n        type: "entero"\n        unique: false\n      - name: "Unnamed: 28"\n        type: "texto"\n        unique: false\n      - name: "Unnamed: 29"\n        type: "texto"\n        unique: false\n      - name: "Unnamed: 30"\n        type: "texto"\n        unique: false\n      - name: "Unnamed: 31"\n        type: "texto"\n        unique: false\n      - name: "Unnamed: 32"\n        type: "texto"\n        unique: false\n      - name: "Unnamed: 33"\n        type: "texto"\n        unique: false\n\n  productos:\n    name: "Catálogo de Productos"\n    description: "Listado de productos disponibles"\n    filename: "productos.csv"\n    file_format:\n      type: "CSV"\n      delimiter: ","\n      header: true\n    fields:\n      - name: "30001"\n        type: "entero"\n        unique: false\n      - name: "14007023"\n        type: "entero"\n        unique: false\n      - name: "00025788"\n        type: "entero"\n        unique: false\n      - name: "XF CLOROX ROPA CLRVIV QUITMNCH 292ML (01X20)"\n        type: "texto"\n        unique: false\n      - name: "Unnamed: 4"\n        type: "texto"\n        unique: false\n      - name: "Unnamed: 5"\n        type: "texto"\n        unique: false\n      - name: "20"\n        type: "entero"\n        unique: false\n      - name: "5.8400"\n        type: "decimal"\n        unique: false\n      - name: "0"\n        type: "entero"\n        unique: false\n      - name: "1"\n        type: "entero"\n        unique: false\n      - name: "1.75450000"\n        type: "decimal"\n        unique: false\n      - name: "1.9576"\n        type: "decimal"\n        unique: false\n      - name: "1.7544"\n        type: "decimal"\n        unique: false\n      - name: "2025-03-30 00:53:31"\n        type: "fecha"\n        unique: false\n      - name: "Unnamed: 14"\n        type: "texto"\n        unique: false\n      - name: "Unnamed: 15"\n        type: "texto"\n        unique: false\n      - name: "Unnamed: 16"\n        type: "texto"\n        unique: false\n      - name: "Unnamed: 17"\n        type: "texto"\n        unique: false\n      - name: "Unnamed: 18"\n        type: "texto"\n        unique: false\n      - name: "Unnamed: 19"\n        type: "texto"\n        unique: false\n      - name: "Unnamed: 20"\n        type: "texto"\n        unique: false\n      - name: "Unnamed: 21"\n        type: "texto"\n        unique: false\n      - name: "Unnamed: 22"\n        type: "texto"\n        unique: false\n      - name: "Unnamed: 23"\n        type: "texto"\n        unique: false\n\n  rutas:\n    name: "Catálogo de Rutas"\n    description: "Información sobre las rutas de distribución"\n    filename: "rutas.csv"\n    file_format:\n      type: "CSV"\n      delimiter: ","\n      header: true\n    fields:\n      - name: "30001"\n        type: "entero"\n        unique: false\n      - name: "14007023"\n        type: "entero"\n        unique: false\n      - name: "00000001"\n        type: "entero"\n        unique: false\n      - name: "000002"\n        type: "entero"\n        unique: false\n      - name: "Unnamed: 4"\n        type: "texto"\n        unique: false\n      - name: "S010000"\n        type: "texto"\n        unique: false\n      - name: "Unnamed: 6"\n        type: "texto"\n        unique: false\n      - name: "Unnamed: 7"\n        type: "texto"\n        unique: false\n      - name: "Unnamed: 8"\n        type: "texto"\n        unique: false\n      - name: "Unnamed: 9"\n        type: "texto"\n        unique: false\n      - name: "2025-03-30 00:53:32"\n        type: "fecha"\n        unique: false\n      - name: "Unnamed: 11"\n        type: "texto"\n        unique: false\n      - name: "01"\n        type: "entero"\n        unique: false\n      - name: "Unnamed: 13"\n        type: "texto"\n        unique: false\n      - name: "Unnamed: 14"\n        type: "texto"\n        unique: false\n      - name: "Unnamed: 15"\n        type: "texto"\n        unique: false\n      - name: "Unnamed: 16"\n        type: "texto"\n        unique: false\n      - name: "Unnamed: 17"\n        type: "texto"\n        unique: false\n      - name: "Unnamed: 18"\n        type: "texto"\n        unique: false\n      - name: "Unnamed: 19"\n        type: "texto"\n        unique: false\n      - name: "Unnamed: 20"\n        type: "texto"\n        unique: false\n\n  stock:\n    name: "Catálogo de Stock"\n    description: "Información sobre el stock disponible en almacenes"\n    filename: "stock.csv"\n    file_format:\n      type: "CSV"\n      delimiter: ","\n      header: true\n    fields:\n      - name: "30001"\n        type: "entero"\n        unique: false\n      - name: "14007023"\n        type: "entero"\n        unique: false\n      - name: "001"\n        type: "entero"\n        unique: false\n      - name: "ALMACEN CENTRAL JANDY(1)"\n        type: "texto"\n        unique: false\n      - name: "00025788"\n        type: "entero"\n        unique: false\n      - name: "Unnamed: 5"\n        type: "texto"\n        unique: false\n      - name: "1900-01-01"\n        type: "fecha"\n        unique: false\n      - name: "5506.00000000"\n        type: "decimal"\n        unique: false\n      - name: "UND"\n        type: "texto"\n        unique: false\n      - name: "275.30000000"\n        type: "decimal"\n        unique: false\n      - name: "CAJ"\n        type: "texto"\n        unique: false\n      - name: "9660.27700000"\n        type: "decimal"\n        unique: false\n      - name: "2025-03-29"\n        type: "fecha"\n        unique: false\n      - name: "5506.0000"\n        type: "decimal"\n        unique: false\n      - name: "0.0000"\n        type: "decimal"\n        unique: false\n      - name: "0"\n        type: "entero"\n        unique: false\n      - name: "0.1"\n        type: "decimal"\n        unique: false\n      - name: "0.2"\n        type: "decimal"\n        unique: false\n      - name: "0.3"\n        type: "decimal"\n        unique: false\n      - name: "3"\n        type: "entero"\n        unique: false\n      - name: "01"\n        type: "entero"\n        unique: false\n      - name: "Unnamed: 21"\n        type: "texto"\n        unique: false\n      - name: "Unnamed: 22"\n        type: "texto"\n        unique: false\n      - name: "Unnamed: 23"\n        type: "texto"\n        unique: false\n      - name: "Unnamed: 24"\n        type: "texto"\n        unique: false\n      - name: "Unnamed: 25"\n        type: "texto"\n        unique: false\n      - name: "Unnamed: 26"\n        type: "texto"\n        unique: false\n      - name: "Unnamed: 27"\n        type: "texto"\n        unique: false\n      - name: "Unnamed: 28"\n        type: "texto"\n        unique: false\n      - name: "Unnamed: 29"\n        type: "texto"\n        unique: false\n\n  vendedores:\n    name: "Catálogo de Vendedores"\n    description: "Información sobre los vendedores"\n    filename: "vendedores.csv"\n    file_format:\n      type: "CSV"\n      delimiter: ","\n      header: true\n    fields:\n      - name: "30001"\n        type: "entero"\n        unique: false\n      - name: "14007023"\n        type: "entero"\n        unique: false\n      - name: "000001"\n        type: "entero"\n        unique: false\n      - name: "CARLOS JUNIOR BAQUERIZO"\n        type: "texto"\n        unique: false\n      - name: "Unnamed: 4"\n        type: "texto"\n        unique: false\n      - name: "Unnamed: 5"\n        type: "texto"\n        unique: false\n      - name: "DETALLISTA"\n        type: "texto"\n        unique: false\n      - name: "1900-01-01"\n        type: "fecha"\n        unique: false\n      - name: "1900-01-01.1"\n        type: "fecha"\n        unique: false\n      - name: "2025-03-30 00:53:08"\n        type: "fecha"\n        unique: false\n      - name: "0"\n        type: "entero"\n        unique: false\n      - name: "Unnamed: 11"\n        type: "texto"\n        unique: false\n      - name: "Unnamed: 12"\n        type: "texto"\n        unique: false\n      - name: "Unnamed: 13"\n        type: "texto"\n        unique: false\n      - name: "Unnamed: 14"\n        type: "texto"\n        unique: false\n      - name: "I"\n        type: "texto"\n        unique: false\n      - name: "Unnamed: 16"\n        type: "texto"\n        unique: false\n      - name: "1"\n        type: "entero"\n        unique: false\n      - name: "01"\n        type: "entero"\n        unique: false\n      - name: "Unnamed: 19"\n        type: "texto"\n        unique: false\n      - name: "Unnamed: 20"\n        type: "texto"\n        unique: false\n      - name: "Unnamed: 21"\n        type: "texto"\n        unique: false\n      - name: "Unnamed: 22"\n        type: "texto"\n        unique: false\n      - name: "Unnamed: 23"\n        type: "texto"\n        unique: false\n      - name: "Unnamed: 24"\n        type: "texto"\n        unique: false\n\n  ventas:\n    name: "Catálogo de Ventas"\n    description: "Registro de ventas realizadas"\n    filename: "ventas.csv"\n    file_format:\n      type: "CSV"\n      delimiter: ","\n      header: true\n    fields:\n      - name: "30001"\n        type: "entero"\n        unique: false\n      - name: "14007023"\n        type: "entero"\n        unique: false\n      - name: "NC"\n        type: "texto"\n        unique: false\n      - name: "B053-00000117"\n        type: "texto"\n        unique: false\n      - name: "2025-01-14"\n        type: "fecha"\n        unique: false\n      - name: "ERROR DE PEDIDO"\n        type: "texto"\n        unique: false\n      - name: "Unnamed: 6"\n        type: "texto"\n        unique: false\n      - name: "00159550"\n        type: "entero"\n        unique: false\n      - name: "DETALLISTA"\n        type: "texto"\n        unique: false\n      - name: "BODEGA ABIERTA"\n        type: "texto"\n        unique: false\n      - name: "000248"\n        type: "entero"\n        unique: false\n      - name: "DETALLISTA.1"\n        type: "texto"\n        unique: false\n      - name: "Unnamed: 12"\n        type: "texto"\n        unique: false\n      - name: "010"\n        type: "entero"\n        unique: false\n      - name: "00063979"\n        type: "texto"\n        unique: false\n      - name: "-4.00000000"\n        type: "decimal"\n        unique: false\n      - name: "UND"\n        type: "texto"\n        unique: false\n      - name: "-1.00000000"\n        type: "decimal"\n        unique: false\n      - name: "CAJ"\n        type: "texto"\n        unique: false\n      - name: "PEN"\n        type: "texto"\n        unique: false\n      - name: "-43.190000"\n        type: "decimal"\n        unique: false\n      - name: "-50.960000"\n        type: "decimal"\n        unique: false\n      - name: "0.00000000"\n        type: "decimal"\n        unique: false\n      - name: "P"\n        type: "texto"\n        unique: false\n      - name: "Unnamed: 24"\n        type: "texto"\n        unique: false\n      - name: "Unnamed: 25"\n        type: "texto"\n        unique: false\n      - name: "BO"\n        type: "texto"\n        unique: false\n      - name: "B053-00011483"\n        type: "texto"\n        unique: false\n      - name: "2025-01-14.1"\n        type: "fecha"\n        unique: false\n      - name: "2025-03-30 00:53:08"\n        type: "fecha"\n        unique: false\n      - name: "Unnamed: 30"\n        type: "texto"\n        unique: false\n      - name: "Unnamed: 31"\n        type: "texto"\n        unique: false\n      - name: "Unnamed: 32"\n        type: "texto"\n        unique: false\n      - name: "Unnamed: 33"\n        type: "texto"\n        unique: false\n      - name: "SUR"\n        type: "texto"\n        unique: false\n      - name: "01"\n        type: "entero"\n        unique: false\n      - name: "01.1"\n        type: "entero"\n        unique: false\n      - name: "Unnamed: 37"\n        type: "texto"\n        unique: false\n      - name: "Unnamed: 38"\n        type: "texto"\n        unique: false\n      - name: "Unnamed: 39"\n        type: "texto"\n        unique: false\n\npackages:\n  distribuidor_paquete:\n    name: "Paquete de Archivos del Distribuidor"\n    description: "Conjunto de archivos CSV para la operación diaria del distribuidor"\n    file_format:\n      type: "ZIP"\n    catalogs:\n      - clientes\n      - pedidos\n      - productos\n      - rutas\n      - stock\n      - vendedores\n      - ventas\n    package_validation:\n      - name: "Validación de Referencias de Clientes"\n        description: "¡Ups! Algunos pedidos tienen clientes no registrados en el catálogo de clientes 🤔"\n        rule: "df['pedidos']['30001'].isin(df['clientes']['30001'])"\n        severity: "error"\n      - name: "Validación de Productos en Ventas"\n        description: "¡Atención! Algunos productos vendidos no están en el catálogo de productos 🔍"\n        rule: "df['ventas']['00063979'].isin(df['productos']['00025788'])"\n        severity: "error"
58	6	CanalTradicionalArchivosDistribuidora.yaml	\N	\N	\N	2025-03-30 23:22:24.163295	t	Proyecto BI CLOROX - Definición SAGE	YAML de configuración para la validación y estructura de los archivos maestros y transaccionales del Proyecto BI CLOROX.	sage_yaml:\r\n  name: "Proyecto BI CLOROX - Definición SAGE"\r\n  description: "YAML de configuración para la validación y estructura de los archivos maestros y transaccionales del Proyecto BI CLOROX."\r\n  version: "1.0.0"\r\n  author: "Equipo de Integración"\r\n  comments: "Configuración generada según especificaciones y reglas definidas por el usuario."\r\n\r\ncatalogs:\r\n  clientes:\r\n    name: "Catálogo de Clientes"\r\n    description: "Definición del archivo clientes.csv con datos maestros de clientes."\r\n    filename: "clientes.csv"\r\n    file_format:\r\n      type: "CSV"\r\n      delimiter: "|"\r\n      header: false\r\n    fields:\r\n      - name: "CodigoProveedor"\r\n        type: "texto"\r\n      - name: "CodigoDistribuidor"\r\n        type: "texto"\r\n      - name: "CodigoCliente"\r\n        type: "texto"\r\n        unique: true\r\n        validation_rules:\r\n          - name: "Sin espacios en blanco"\r\n            description: "¡Atención! El código de cliente no debe contener espacios en blanco. Revisa y corrige 📝"\r\n            rule: "df['CodigoCliente'].str.match('^\\\\S+$')"\r\n            severity: "error"\r\n      - name: "NombreCliente"\r\n        type: "texto"\r\n      - name: "TipoDocumento"\r\n        type: "texto"\r\n      - name: "DNI"\r\n        type: "texto"\r\n      - name: "Direccion"\r\n        type: "texto"\r\n      - name: "Mercado"\r\n        type: "texto"\r\n      - name: "Modulo"\r\n        type: "texto"\r\n      - name: "Canal"\r\n        type: "texto"\r\n      - name: "GiroNegocio"\r\n        type: "texto"\r\n      - name: "SubGiroNegocio"\r\n        type: "texto"\r\n      - name: "Ubigeo"\r\n        type: "texto"\r\n      - name: "Distrito"\r\n        type: "texto"\r\n      - name: "Estatus"\r\n        type: "texto"\r\n        validation_rules:\r\n          - name: "Valor de Estatus"\r\n            description: "¡Atención! El estatus debe ser A (Activo), I (Inactivo) o T (Temporal) 😊"\r\n            rule: "df['Estatus'].isin(['A','I','T'])"\r\n            severity: "error"\r\n      - name: "X"\r\n        type: "decimal"\r\n      - name: "Y"\r\n        type: "decimal"\r\n      - name: "CodigoPadre"\r\n        type: "texto"\r\n      - name: "FechaIngreso"\r\n        type: "fecha"\r\n      - name: "FechaActualizacion"\r\n        type: "fecha"\r\n      - name: "FechaProceso"\r\n        type: "fecha"\r\n      - name: "REF1"\r\n        type: "texto"\r\n      - name: "REF2"\r\n        type: "texto"\r\n      - name: "REF3"\r\n        type: "texto"\r\n      - name: "REF4"\r\n        type: "texto"\r\n      - name: "REF5"\r\n        type: "texto"\r\n      - name: "REF6"\r\n        type: "texto"\r\n      - name: "REF7"\r\n        type: "texto"\r\n      - name: "REF8"\r\n        type: "texto"\r\n      - name: "REF9"\r\n        type: "texto"\r\n      - name: "REF10"\r\n        type: "texto"\r\n\r\n  productos:\r\n    name: "Catálogo de Productos"\r\n    description: "Definición del archivo productos.csv con datos maestros de productos."\r\n    filename: "productos.csv"\r\n    file_format:\r\n      type: "CSV"\r\n      delimiter: "|"\r\n      header: false\r\n    fields:\r\n      - name: "CodigoProveedor"\r\n        type: "texto"\r\n      - name: "CodigoDistribuidor"\r\n        type: "texto"\r\n      - name: "CodigoProducto"\r\n        type: "texto"\r\n        unique: true\r\n      - name: "NombreProducto"\r\n        type: "texto"\r\n      - name: "EAN"\r\n        type: "texto"\r\n      - name: "DUN"\r\n        type: "texto"\r\n      - name: "FactorCaja"\r\n        type: "entero"\r\n      - name: "Peso"\r\n        type: "decimal"\r\n      - name: "FlagBonificado"\r\n        type: "texto"\r\n      - name: "Afecto"\r\n        type: "texto"\r\n      - name: "PrecioCompra"\r\n        type: "decimal"\r\n      - name: "PrecioSugerido"\r\n        type: "decimal"\r\n      - name: "PrecioPromedio"\r\n        type: "decimal"\r\n      - name: "FechaProceso"\r\n        type: "fecha"\r\n      - name: "REF1"\r\n        type: "texto"\r\n      - name: "REF2"\r\n        type: "texto"\r\n      - name: "REF3"\r\n        type: "texto"\r\n      - name: "REF4"\r\n        type: "texto"\r\n      - name: "REF5"\r\n        type: "texto"\r\n      - name: "REF6"\r\n        type: "texto"\r\n      - name: "REF7"\r\n        type: "texto"\r\n      - name: "REF8"\r\n        type: "texto"\r\n      - name: "REF9"\r\n        type: "texto"\r\n      - name: "REF10"\r\n        type: "texto"\r\n\r\n  stock:\r\n    name: "Catálogo de Stock"\r\n    description: "Definición del archivo stock.csv con información de inventario."\r\n    filename: "stock.csv"\r\n    file_format:\r\n      type: "CSV"\r\n      delimiter: "|"\r\n      header: false\r\n    fields:\r\n      - name: "CodigoProveedor"\r\n        type: "texto"\r\n      - name: "CodigoDistribuidor"\r\n        type: "texto"\r\n      - name: "CodigoAlmacen"\r\n        type: "texto"\r\n      - name: "NombreAlmacen"\r\n        type: "texto"\r\n      - name: "CodigoProducto"\r\n        type: "texto"\r\n      - name: "Lote"\r\n        type: "texto"\r\n      - name: "FechaVencimiento"\r\n        type: "fecha"\r\n      - name: "StockEnUnidadMinima"\r\n        type: "decimal"\r\n      - name: "UnidadDeMedidaMinima"\r\n        type: "texto"\r\n      - name: "StockEnUnidadesMaximas"\r\n        type: "decimal"\r\n      - name: "UnidadDeMedidaMaxima"\r\n        type: "texto"\r\n      - name: "ValorStock"\r\n        type: "decimal"\r\n      - name: "FechaProceso"\r\n        type: "fecha"\r\n      - name: "IngresosEnUnidadDeConsumo"\r\n        type: "decimal"\r\n      - name: "ValorIngresos"\r\n        type: "decimal"\r\n      - name: "VentasEnUnidadDeConsumo"\r\n        type: "decimal"\r\n      - name: "ValorVentas"\r\n        type: "decimal"\r\n      - name: "OtrosEnUnidadDeConsumo"\r\n        type: "decimal"\r\n      - name: "ValorOtros"\r\n        type: "decimal"\r\n      - name: "Periodo"\r\n        type: "entero"\r\n      - name: "REF1"\r\n        type: "texto"\r\n      - name: "REF2"\r\n        type: "texto"\r\n      - name: "REF3"\r\n        type: "texto"\r\n      - name: "REF4"\r\n        type: "texto"\r\n      - name: "REF5"\r\n        type: "texto"\r\n      - name: "REF6"\r\n        type: "texto"\r\n      - name: "REF7"\r\n        type: "texto"\r\n      - name: "REF8"\r\n        type: "texto"\r\n      - name: "REF9"\r\n        type: "texto"\r\n      - name: "REF10"\r\n        type: "texto"\r\n\r\n  vendedores:\r\n    name: "Catálogo de Vendedores"\r\n    description: "Definición del archivo vendedores.csv con datos maestros de vendedores."\r\n    filename: "vendedores.csv"\r\n    file_format:\r\n      type: "CSV"\r\n      delimiter: "|"\r\n      header: false\r\n    fields:\r\n      - name: "CodigoProveedor"\r\n        type: "texto"\r\n      - name: "CodigoDistribuidor"\r\n        type: "texto"\r\n      - name: "CodigoVendedor"\r\n        type: "texto"\r\n        unique: true\r\n      - name: "NombreVendedor"\r\n        type: "texto"\r\n      - name: "TipoDocumento"\r\n        type: "texto"\r\n      - name: "DI"\r\n        type: "texto"\r\n      - name: "Canal"\r\n        type: "texto"\r\n      - name: "FechaIngreso"\r\n        type: "fecha"\r\n      - name: "FechaActualizacion"\r\n        type: "fecha"\r\n      - name: "FechaProceso"\r\n        type: "fecha"\r\n      - name: "Exclusivo"\r\n        type: "texto"\r\n      - name: "CodigoSupervisor"\r\n        type: "texto"\r\n      - name: "NombreSupervisor"\r\n        type: "texto"\r\n      - name: "CRutaLogica"\r\n        type: "texto"\r\n      - name: "CLineaLogica"\r\n        type: "texto"\r\n      - name: "EstadoVendedor"\r\n        type: "texto"\r\n      - name: "ZonaVendedor"\r\n        type: "texto"\r\n      - name: "REF3"\r\n        type: "texto"\r\n      - name: "REF4"\r\n        type: "texto"\r\n      - name: "REF5"\r\n        type: "texto"\r\n      - name: "REF6"\r\n        type: "texto"\r\n      - name: "REF7"\r\n        type: "texto"\r\n      - name: "REF8"\r\n        type: "texto"\r\n      - name: "REF9"\r\n        type: "texto"\r\n      - name: "REF10"\r\n        type: "texto"\r\n\r\n  ventas:\r\n    name: "Catálogo de Ventas"\r\n    description: "Definición del archivo ventas.csv con información de transacciones de ventas."\r\n    filename: "ventas.csv"\r\n    file_format:\r\n      type: "CSV"\r\n      delimiter: "|"\r\n      header: false\r\n    fields:\r\n      - name: "CodigoProveedor"\r\n        type: "texto"\r\n      - name: "CodigoDistribuidor"\r\n        type: "texto"\r\n      - name: "TipoDocumento"\r\n        type: "texto"\r\n      - name: "NroDocumento"\r\n        type: "texto"\r\n      - name: "FechaDocumento"\r\n        type: "fecha"\r\n      - name: "MotivoNC"\r\n        type: "texto"\r\n      - name: "Origen"\r\n        type: "texto"\r\n      - name: "CodigoCliente"\r\n        type: "texto"\r\n      - name: "CanalCliente"\r\n        type: "texto"\r\n      - name: "TipoNegocio"\r\n        type: "texto"\r\n      - name: "CodigoVendedor"\r\n        type: "texto"\r\n      - name: "CanalVendedor"\r\n        type: "texto"\r\n      - name: "Ruta"\r\n        type: "texto"\r\n      - name: "NumeroItem"\r\n        type: "entero"\r\n      - name: "CodigoProducto"\r\n        type: "texto"\r\n      - name: "CantidadUnidadMinima"\r\n        type: "decimal"\r\n      - name: "TipoUnidadMinima"\r\n        type: "texto"\r\n      - name: "CantidadUnidadMaxima"\r\n        type: "decimal"\r\n      - name: "TipoUnidadMaxima"\r\n        type: "texto"\r\n      - name: "Moneda"\r\n        type: "texto"\r\n      - name: "ImporteNetoSinImpuesto"\r\n        type: "decimal"\r\n      - name: "ImporteNetoConImpuesto"\r\n        type: "decimal"\r\n      - name: "Descuento"\r\n        type: "decimal"\r\n      - name: "TipoVenta"\r\n        type: "texto"\r\n      - name: "CodCombo"\r\n        type: "texto"\r\n      - name: "CodPromocion"\r\n        type: "texto"\r\n      - name: "TipoDocumentoReferencia"\r\n        type: "texto"\r\n      - name: "NroDocumentoReferencia"\r\n        type: "texto"\r\n      - name: "FechaDocumentoReferencia"\r\n        type: "fecha"\r\n      - name: "FechaProceso"\r\n        type: "fecha"\r\n      - name: "DescripcionPromocion"\r\n        type: "texto"\r\n      - name: "REF2"\r\n        type: "texto"\r\n      - name: "REF3"\r\n        type: "texto"\r\n      - name: "REF4"\r\n        type: "texto"\r\n      - name: "ZonaVendedor"\r\n        type: "texto"\r\n      - name: "REF6"\r\n        type: "texto"\r\n      - name: "REF7"\r\n        type: "texto"\r\n      - name: "REF8"\r\n        type: "texto"\r\n      - name: "REF9"\r\n        type: "texto"\r\n      - name: "REF10"\r\n        type: "texto"\r\n\r\n  pedidos:\r\n    name: "Catálogo de Pedidos"\r\n    description: "Definición del archivo pedidos.csv con información de pedidos."\r\n    filename: "pedidos.csv"\r\n    file_format:\r\n      type: "CSV"\r\n      delimiter: "|"\r\n      header: false\r\n    fields:\r\n      - name: "CodigoProveedor"\r\n        type: "texto"\r\n      - name: "CodigoDistribuidor"\r\n        type: "texto"\r\n      - name: "CodigoCliente"\r\n        type: "texto"\r\n      - name: "CodigoVendedor"\r\n        type: "texto"\r\n      - name: "Origen"\r\n        type: "texto"\r\n      - name: "CodigoPedido"\r\n        type: "texto"\r\n      - name: "FechaPedido"\r\n        type: "fecha"\r\n      - name: "EstatusPedido"\r\n        type: "texto"\r\n      - name: "MotivoCancelacion"\r\n        type: "texto"\r\n      - name: "TipoDocumento"\r\n        type: "texto"\r\n      - name: "Documento"\r\n        type: "texto"\r\n      - name: "FechaDocumento"\r\n        type: "fecha"\r\n      - name: "EstatusDocumento"\r\n        type: "texto"\r\n      - name: "NumeroItem"\r\n        type: "entero"\r\n      - name: "CodigoProducto"\r\n        type: "texto"\r\n      - name: "TipoProducto"\r\n        type: "texto"\r\n      - name: "CantidadUnidadMinima"\r\n        type: "decimal"\r\n      - name: "TipoUnidadMinima"\r\n        type: "texto"\r\n      - name: "CantidadUnidadMaxima"\r\n        type: "decimal"\r\n      - name: "TipoUnidadMaxima"\r\n        type: "texto"\r\n      - name: "ImportePedidoNetoSinImpuesto"\r\n        type: "decimal"\r\n      - name: "ImportePedidoNetoConImpuesto"\r\n        type: "decimal"\r\n      - name: "Descuento"\r\n        type: "decimal"\r\n      - name: "FechaProceso"\r\n        type: "fecha"\r\n      - name: "REF1"\r\n        type: "texto"\r\n      - name: "CodCombo"\r\n        type: "texto"\r\n      - name: "ZonaVendedor"\r\n        type: "texto"\r\n      - name: "REF4"\r\n        type: "texto"\r\n      - name: "REF5"\r\n        type: "texto"\r\n      - name: "REF6"\r\n        type: "texto"\r\n      - name: "REF7"\r\n        type: "texto"\r\n      - name: "REF8"\r\n        type: "texto"\r\n      - name: "REF9"\r\n        type: "texto"\r\n      - name: "REF10"\r\n        type: "texto"\r\n\r\n  rutas:\r\n    name: "Catálogo de Rutas"\r\n    description: "Definición del archivo rutas.csv con información de rutas y visitas."\r\n    filename: "rutas.csv"\r\n    file_format:\r\n      type: "CSV"\r\n      delimiter: "|"\r\n      header: false\r\n    fields:\r\n      - name: "CodigoProveedor"\r\n        type: "texto"\r\n      - name: "CodigoDistribuidor"\r\n        type: "texto"\r\n      - name: "CodigoCliente"\r\n        type: "texto"\r\n      - name: "CodigoVendedor"\r\n        type: "texto"\r\n      - name: "FuerzaDeVenta"\r\n        type: "texto"\r\n      - name: "FrecuenciaVisita"\r\n        type: "texto"\r\n      - name: "Zona"\r\n        type: "texto"\r\n      - name: "Mesa"\r\n        type: "texto"\r\n      - name: "Ruta"\r\n        type: "texto"\r\n      - name: "Modulo"\r\n        type: "texto"\r\n      - name: "FechaProceso"\r\n        type: "fecha"\r\n      - name: "ZonaVendedor"\r\n        type: "texto"\r\n      - name: "REF2"\r\n        type: "texto"\r\n      - name: "REF3"\r\n        type: "texto"\r\n      - name: "REF4"\r\n        type: "texto"\r\n      - name: "REF5"\r\n        type: "texto"\r\n      - name: "REF6"\r\n        type: "texto"\r\n      - name: "REF7"\r\n        type: "texto"\r\n      - name: "REF8"\r\n        type: "texto"\r\n      - name: "REF9"\r\n        type: "texto"\r\n      - name: "REF10"\r\n        type: "texto"\r\n\r\npackages:\r\n  paquete_bi_clorox:\r\n    name: "Paquete BI CLOROX"\r\n    description: "Paquete que agrupa los 7 catálogos del Proyecto BI CLOROX en un archivo ZIP."\r\n    file_format:\r\n      type: "ZIP"\r\n    catalogs:\r\n      - clientes\r\n      - productos\r\n      - stock\r\n      - vendedores\r\n      - ventas\r\n      - pedidos\r\n      - rutas\r\n    package_validation:\r\n      - name: "Validación de integridad de claves"\r\n        description: "¡Ups! Verifica que no existan códigos en transacciones (Ventas, Pedidos, Rutas) que no estén presentes en los catálogos maestros correspondientes 😊"\r\n        rule: "df['ventas']['CodigoCliente'].isin(df['clientes']['CodigoCliente']) and df['pedidos']['CodigoCliente'].isin(df['clientes']['CodigoCliente']) and df['ventas']['CodigoProducto'].isin(df['productos']['CodigoProducto']) and df['pedidos']['CodigoProducto'].isin(df['productos']['CodigoProducto']) and df['ventas']['CodigoVendedor'].isin(df['vendedores']['CodigoVendedor'])"\r\n        severity: "error"\r\n
60	6	Proyecto BI CLOROX - Definición SAGE.yaml	\N	\N	\N	2025-03-30 23:22:26.42339	t	Proyecto BI CLOROX - Definición SAGE	YAML de configuración para la validación y estructura de los archivos maestros y transaccionales del Proyecto BI CLOROX.	sage_yaml:\r\n  name: "Proyecto BI CLOROX - Definición SAGE"\r\n  description: "YAML de configuración para la validación y estructura de los archivos maestros y transaccionales del Proyecto BI CLOROX."\r\n  version: "1.0.0"\r\n  author: "Equipo de Integración"\r\n  comments: "Configuración generada según especificaciones y reglas definidas por el usuario."\r\n\r\ncatalogs:\r\n  clientes:\r\n    name: "Catálogo de Clientes"\r\n    description: "Definición del archivo clientes.csv con datos maestros de clientes."\r\n    filename: "clientes.csv"\r\n    file_format:\r\n      type: "CSV"\r\n      delimiter: "|"\r\n      header: false\r\n    fields:\r\n      - name: "CodigoProveedor"\r\n        type: "texto"\r\n      - name: "CodigoDistribuidor"\r\n        type: "texto"\r\n      - name: "CodigoCliente"\r\n        type: "texto"\r\n        unique: true\r\n        validation_rules:\r\n          - name: "Sin espacios en blanco"\r\n            description: "¡Atención! El código de cliente no debe contener espacios en blanco. Revisa y corrige 📝"\r\n            rule: "df['CodigoCliente'].str.match('^\\\\S+$')"\r\n            severity: "error"\r\n      - name: "NombreCliente"\r\n        type: "texto"\r\n      - name: "TipoDocumento"\r\n        type: "texto"\r\n      - name: "DNI"\r\n        type: "texto"\r\n      - name: "Direccion"\r\n        type: "texto"\r\n      - name: "Mercado"\r\n        type: "texto"\r\n      - name: "Modulo"\r\n        type: "texto"\r\n      - name: "Canal"\r\n        type: "texto"\r\n      - name: "GiroNegocio"\r\n        type: "texto"\r\n      - name: "SubGiroNegocio"\r\n        type: "texto"\r\n      - name: "Ubigeo"\r\n        type: "texto"\r\n      - name: "Distrito"\r\n        type: "texto"\r\n      - name: "Estatus"\r\n        type: "texto"\r\n        validation_rules:\r\n          - name: "Valor de Estatus"\r\n            description: "¡Atención! El estatus debe ser A (Activo), I (Inactivo) o T (Temporal) 😊"\r\n            rule: "df['Estatus'].isin(['A','I','T'])"\r\n            severity: "error"\r\n      - name: "X"\r\n        type: "decimal"\r\n      - name: "Y"\r\n        type: "decimal"\r\n      - name: "CodigoPadre"\r\n        type: "texto"\r\n      - name: "FechaIngreso"\r\n        type: "fecha"\r\n      - name: "FechaActualizacion"\r\n        type: "fecha"\r\n      - name: "FechaProceso"\r\n        type: "fecha"\r\n      - name: "REF1"\r\n        type: "texto"\r\n      - name: "REF2"\r\n        type: "texto"\r\n      - name: "REF3"\r\n        type: "texto"\r\n      - name: "REF4"\r\n        type: "texto"\r\n      - name: "REF5"\r\n        type: "texto"\r\n      - name: "REF6"\r\n        type: "texto"\r\n      - name: "REF7"\r\n        type: "texto"\r\n      - name: "REF8"\r\n        type: "texto"\r\n      - name: "REF9"\r\n        type: "texto"\r\n      - name: "REF10"\r\n        type: "texto"\r\n\r\n  productos:\r\n    name: "Catálogo de Productos"\r\n    description: "Definición del archivo productos.csv con datos maestros de productos."\r\n    filename: "productos.csv"\r\n    file_format:\r\n      type: "CSV"\r\n      delimiter: "|"\r\n      header: false\r\n    fields:\r\n      - name: "CodigoProveedor"\r\n        type: "texto"\r\n      - name: "CodigoDistribuidor"\r\n        type: "texto"\r\n      - name: "CodigoProducto"\r\n        type: "texto"\r\n        unique: true\r\n      - name: "NombreProducto"\r\n        type: "texto"\r\n      - name: "EAN"\r\n        type: "texto"\r\n      - name: "DUN"\r\n        type: "texto"\r\n      - name: "FactorCaja"\r\n        type: "entero"\r\n      - name: "Peso"\r\n        type: "decimal"\r\n      - name: "FlagBonificado"\r\n        type: "texto"\r\n      - name: "Afecto"\r\n        type: "texto"\r\n      - name: "PrecioCompra"\r\n        type: "decimal"\r\n      - name: "PrecioSugerido"\r\n        type: "decimal"\r\n      - name: "PrecioPromedio"\r\n        type: "decimal"\r\n      - name: "FechaProceso"\r\n        type: "fecha"\r\n      - name: "REF1"\r\n        type: "texto"\r\n      - name: "REF2"\r\n        type: "texto"\r\n      - name: "REF3"\r\n        type: "texto"\r\n      - name: "REF4"\r\n        type: "texto"\r\n      - name: "REF5"\r\n        type: "texto"\r\n      - name: "REF6"\r\n        type: "texto"\r\n      - name: "REF7"\r\n        type: "texto"\r\n      - name: "REF8"\r\n        type: "texto"\r\n      - name: "REF9"\r\n        type: "texto"\r\n      - name: "REF10"\r\n        type: "texto"\r\n\r\n  stock:\r\n    name: "Catálogo de Stock"\r\n    description: "Definición del archivo stock.csv con información de inventario."\r\n    filename: "stock.csv"\r\n    file_format:\r\n      type: "CSV"\r\n      delimiter: "|"\r\n      header: false\r\n    fields:\r\n      - name: "CodigoProveedor"\r\n        type: "texto"\r\n      - name: "CodigoDistribuidor"\r\n        type: "texto"\r\n      - name: "CodigoAlmacen"\r\n        type: "texto"\r\n      - name: "NombreAlmacen"\r\n        type: "texto"\r\n      - name: "CodigoProducto"\r\n        type: "texto"\r\n      - name: "Lote"\r\n        type: "texto"\r\n      - name: "FechaVencimiento"\r\n        type: "fecha"\r\n      - name: "StockEnUnidadMinima"\r\n        type: "decimal"\r\n      - name: "UnidadDeMedidaMinima"\r\n        type: "texto"\r\n      - name: "StockEnUnidadesMaximas"\r\n        type: "decimal"\r\n      - name: "UnidadDeMedidaMaxima"\r\n        type: "texto"\r\n      - name: "ValorStock"\r\n        type: "decimal"\r\n      - name: "FechaProceso"\r\n        type: "fecha"\r\n      - name: "IngresosEnUnidadDeConsumo"\r\n        type: "decimal"\r\n      - name: "ValorIngresos"\r\n        type: "decimal"\r\n      - name: "VentasEnUnidadDeConsumo"\r\n        type: "decimal"\r\n      - name: "ValorVentas"\r\n        type: "decimal"\r\n      - name: "OtrosEnUnidadDeConsumo"\r\n        type: "decimal"\r\n      - name: "ValorOtros"\r\n        type: "decimal"\r\n      - name: "Periodo"\r\n        type: "entero"\r\n      - name: "REF1"\r\n        type: "texto"\r\n      - name: "REF2"\r\n        type: "texto"\r\n      - name: "REF3"\r\n        type: "texto"\r\n      - name: "REF4"\r\n        type: "texto"\r\n      - name: "REF5"\r\n        type: "texto"\r\n      - name: "REF6"\r\n        type: "texto"\r\n      - name: "REF7"\r\n        type: "texto"\r\n      - name: "REF8"\r\n        type: "texto"\r\n      - name: "REF9"\r\n        type: "texto"\r\n      - name: "REF10"\r\n        type: "texto"\r\n\r\n  vendedores:\r\n    name: "Catálogo de Vendedores"\r\n    description: "Definición del archivo vendedores.csv con datos maestros de vendedores."\r\n    filename: "vendedores.csv"\r\n    file_format:\r\n      type: "CSV"\r\n      delimiter: "|"\r\n      header: false\r\n    fields:\r\n      - name: "CodigoProveedor"\r\n        type: "texto"\r\n      - name: "CodigoDistribuidor"\r\n        type: "texto"\r\n      - name: "CodigoVendedor"\r\n        type: "texto"\r\n        unique: true\r\n      - name: "NombreVendedor"\r\n        type: "texto"\r\n      - name: "TipoDocumento"\r\n        type: "texto"\r\n      - name: "DI"\r\n        type: "texto"\r\n      - name: "Canal"\r\n        type: "texto"\r\n      - name: "FechaIngreso"\r\n        type: "fecha"\r\n      - name: "FechaActualizacion"\r\n        type: "fecha"\r\n      - name: "FechaProceso"\r\n        type: "fecha"\r\n      - name: "Exclusivo"\r\n        type: "texto"\r\n      - name: "CodigoSupervisor"\r\n        type: "texto"\r\n      - name: "NombreSupervisor"\r\n        type: "texto"\r\n      - name: "CRutaLogica"\r\n        type: "texto"\r\n      - name: "CLineaLogica"\r\n        type: "texto"\r\n      - name: "EstadoVendedor"\r\n        type: "texto"\r\n      - name: "ZonaVendedor"\r\n        type: "texto"\r\n      - name: "REF3"\r\n        type: "texto"\r\n      - name: "REF4"\r\n        type: "texto"\r\n      - name: "REF5"\r\n        type: "texto"\r\n      - name: "REF6"\r\n        type: "texto"\r\n      - name: "REF7"\r\n        type: "texto"\r\n      - name: "REF8"\r\n        type: "texto"\r\n      - name: "REF9"\r\n        type: "texto"\r\n      - name: "REF10"\r\n        type: "texto"\r\n\r\n  ventas:\r\n    name: "Catálogo de Ventas"\r\n    description: "Definición del archivo ventas.csv con información de transacciones de ventas."\r\n    filename: "ventas.csv"\r\n    file_format:\r\n      type: "CSV"\r\n      delimiter: "|"\r\n      header: false\r\n    fields:\r\n      - name: "CodigoProveedor"\r\n        type: "texto"\r\n      - name: "CodigoDistribuidor"\r\n        type: "texto"\r\n      - name: "TipoDocumento"\r\n        type: "texto"\r\n      - name: "NroDocumento"\r\n        type: "texto"\r\n      - name: "FechaDocumento"\r\n        type: "fecha"\r\n      - name: "MotivoNC"\r\n        type: "texto"\r\n      - name: "Origen"\r\n        type: "texto"\r\n      - name: "CodigoCliente"\r\n        type: "texto"\r\n      - name: "CanalCliente"\r\n        type: "texto"\r\n      - name: "TipoNegocio"\r\n        type: "texto"\r\n      - name: "CodigoVendedor"\r\n        type: "texto"\r\n      - name: "CanalVendedor"\r\n        type: "texto"\r\n      - name: "Ruta"\r\n        type: "texto"\r\n      - name: "NumeroItem"\r\n        type: "entero"\r\n      - name: "CodigoProducto"\r\n        type: "texto"\r\n      - name: "CantidadUnidadMinima"\r\n        type: "decimal"\r\n      - name: "TipoUnidadMinima"\r\n        type: "texto"\r\n      - name: "CantidadUnidadMaxima"\r\n        type: "decimal"\r\n      - name: "TipoUnidadMaxima"\r\n        type: "texto"\r\n      - name: "Moneda"\r\n        type: "texto"\r\n      - name: "ImporteNetoSinImpuesto"\r\n        type: "decimal"\r\n      - name: "ImporteNetoConImpuesto"\r\n        type: "decimal"\r\n      - name: "Descuento"\r\n        type: "decimal"\r\n      - name: "TipoVenta"\r\n        type: "texto"\r\n      - name: "CodCombo"\r\n        type: "texto"\r\n      - name: "CodPromocion"\r\n        type: "texto"\r\n      - name: "TipoDocumentoReferencia"\r\n        type: "texto"\r\n      - name: "NroDocumentoReferencia"\r\n        type: "texto"\r\n      - name: "FechaDocumentoReferencia"\r\n        type: "fecha"\r\n      - name: "FechaProceso"\r\n        type: "fecha"\r\n      - name: "DescripcionPromocion"\r\n        type: "texto"\r\n      - name: "REF2"\r\n        type: "texto"\r\n      - name: "REF3"\r\n        type: "texto"\r\n      - name: "REF4"\r\n        type: "texto"\r\n      - name: "ZonaVendedor"\r\n        type: "texto"\r\n      - name: "REF6"\r\n        type: "texto"\r\n      - name: "REF7"\r\n        type: "texto"\r\n      - name: "REF8"\r\n        type: "texto"\r\n      - name: "REF9"\r\n        type: "texto"\r\n      - name: "REF10"\r\n        type: "texto"\r\n\r\n  pedidos:\r\n    name: "Catálogo de Pedidos"\r\n    description: "Definición del archivo pedidos.csv con información de pedidos."\r\n    filename: "pedidos.csv"\r\n    file_format:\r\n      type: "CSV"\r\n      delimiter: "|"\r\n      header: false\r\n    fields:\r\n      - name: "CodigoProveedor"\r\n        type: "texto"\r\n      - name: "CodigoDistribuidor"\r\n        type: "texto"\r\n      - name: "CodigoCliente"\r\n        type: "texto"\r\n      - name: "CodigoVendedor"\r\n        type: "texto"\r\n      - name: "Origen"\r\n        type: "texto"\r\n      - name: "CodigoPedido"\r\n        type: "texto"\r\n      - name: "FechaPedido"\r\n        type: "fecha"\r\n      - name: "EstatusPedido"\r\n        type: "texto"\r\n      - name: "MotivoCancelacion"\r\n        type: "texto"\r\n      - name: "TipoDocumento"\r\n        type: "texto"\r\n      - name: "Documento"\r\n        type: "texto"\r\n      - name: "FechaDocumento"\r\n        type: "fecha"\r\n      - name: "EstatusDocumento"\r\n        type: "texto"\r\n      - name: "NumeroItem"\r\n        type: "entero"\r\n      - name: "CodigoProducto"\r\n        type: "texto"\r\n      - name: "TipoProducto"\r\n        type: "texto"\r\n      - name: "CantidadUnidadMinima"\r\n        type: "decimal"\r\n      - name: "TipoUnidadMinima"\r\n        type: "texto"\r\n      - name: "CantidadUnidadMaxima"\r\n        type: "decimal"\r\n      - name: "TipoUnidadMaxima"\r\n        type: "texto"\r\n      - name: "ImportePedidoNetoSinImpuesto"\r\n        type: "decimal"\r\n      - name: "ImportePedidoNetoConImpuesto"\r\n        type: "decimal"\r\n      - name: "Descuento"\r\n        type: "decimal"\r\n      - name: "FechaProceso"\r\n        type: "fecha"\r\n      - name: "REF1"\r\n        type: "texto"\r\n      - name: "CodCombo"\r\n        type: "texto"\r\n      - name: "ZonaVendedor"\r\n        type: "texto"\r\n      - name: "REF4"\r\n        type: "texto"\r\n      - name: "REF5"\r\n        type: "texto"\r\n      - name: "REF6"\r\n        type: "texto"\r\n      - name: "REF7"\r\n        type: "texto"\r\n      - name: "REF8"\r\n        type: "texto"\r\n      - name: "REF9"\r\n        type: "texto"\r\n      - name: "REF10"\r\n        type: "texto"\r\n\r\n  rutas:\r\n    name: "Catálogo de Rutas"\r\n    description: "Definición del archivo rutas.csv con información de rutas y visitas."\r\n    filename: "rutas.csv"\r\n    file_format:\r\n      type: "CSV"\r\n      delimiter: "|"\r\n      header: false\r\n    fields:\r\n      - name: "CodigoProveedor"\r\n        type: "texto"\r\n      - name: "CodigoDistribuidor"\r\n        type: "texto"\r\n      - name: "CodigoCliente"\r\n        type: "texto"\r\n      - name: "CodigoVendedor"\r\n        type: "texto"\r\n      - name: "FuerzaDeVenta"\r\n        type: "texto"\r\n      - name: "FrecuenciaVisita"\r\n        type: "texto"\r\n      - name: "Zona"\r\n        type: "texto"\r\n      - name: "Mesa"\r\n        type: "texto"\r\n      - name: "Ruta"\r\n        type: "texto"\r\n      - name: "Modulo"\r\n        type: "texto"\r\n      - name: "FechaProceso"\r\n        type: "fecha"\r\n      - name: "ZonaVendedor"\r\n        type: "texto"\r\n      - name: "REF2"\r\n        type: "texto"\r\n      - name: "REF3"\r\n        type: "texto"\r\n      - name: "REF4"\r\n        type: "texto"\r\n      - name: "REF5"\r\n        type: "texto"\r\n      - name: "REF6"\r\n        type: "texto"\r\n      - name: "REF7"\r\n        type: "texto"\r\n      - name: "REF8"\r\n        type: "texto"\r\n      - name: "REF9"\r\n        type: "texto"\r\n      - name: "REF10"\r\n        type: "texto"\r\n\r\npackages:\r\n  paquete_bi_clorox:\r\n    name: "Paquete BI CLOROX"\r\n    description: "Paquete que agrupa los 7 catálogos del Proyecto BI CLOROX en un archivo ZIP."\r\n    file_format:\r\n      type: "ZIP"\r\n    catalogs:\r\n      - clientes\r\n      - productos\r\n      - stock\r\n      - vendedores\r\n      - ventas\r\n      - pedidos\r\n      - rutas\r\n    package_validation:\r\n      - name: "Validación de integridad de claves"\r\n        description: "¡Ups! Verifica que no existan códigos en transacciones (Ventas, Pedidos, Rutas) que no estén presentes en los catálogos maestros correspondientes 😊"\r\n        rule: "df['ventas']['CodigoCliente'].isin(df['clientes']['CodigoCliente']) and df['pedidos']['CodigoCliente'].isin(df['clientes']['CodigoCliente']) and df['ventas']['CodigoProducto'].isin(df['productos']['CodigoProducto']) and df['pedidos']['CodigoProducto'].isin(df['productos']['CodigoProducto']) and df['ventas']['CodigoVendedor'].isin(df['vendedores']['CodigoVendedor'])"\r\n        severity: "error"\r\n
47	1	ventas_completo(1).yaml	\N	\N	\N	2025-03-28 20:36:50.949475	t	Sistema Completo de Ventas	Test complejo con múltiples catálogos y validaciones cruzadas	sage_yaml:\n  name: "Sistema Completo de Ventas"\n  description: "Test complejo con múltiples catálogos y validaciones cruzadas"\n  version: "1.0.0"\n  author: "SAGE Tests"\n  comments: "Caso de prueba complejo con ZIP"\n\ncatalogs:\n  productos:\n    name: "Catálogo de Productos"\n    description: "Productos disponibles"\n    filename: "productos.xlsx"\n    path: "./data"\n    file_format:\n      type: "EXCEL"\n      header: true\n    fields:\n      - name: "codigo_producto"\n        type: "texto"\n        required: true\n        unique: true\n        validation_rules:\n          - name: "Formato código producto"\n            description: "El código debe seguir el formato PROD-XXX"\n            rule: "df['codigo_producto'].str.match('PROD-[0-9]{3}')"\n            severity: "error"\n      - name: "existencias"\n        type: "entero"\n        required: true\n        validation_rules:\n          - name: "Stock válido"\n            description: "El stock debe ser positivo"\n            rule: "df['existencias'] >= 0"\n            severity: "error"\n\n  clientes:\n    name: "Catálogo de Clientes"\n    description: "Clientes registrados"\n    filename: "clientes.csv"\n    path: "./data"\n    file_format:\n      type: "CSV"\n      delimiter: ","\n      header: true\n    fields:\n      - name: "codigo_cliente"\n        type: "texto"\n        required: true\n        unique: true\n        validation_rules:\n          - name: "Formato código cliente"\n            description: "El código debe seguir el formato CLI-XXX"\n            rule: "df['codigo_cliente'].str.match('CLI-[0-9]{3}')"\n            severity: "error"\n      - name: "limite_credito"\n        type: "decimal"\n        required: true\n        validation_rules:\n          - name: "Límite válido"\n            description: "El límite debe ser positivo"\n            rule: "df['limite_credito'] > 0"\n            severity: "error"\n\n  ventas:\n    name: "Registro de Ventas"\n    description: "Ventas realizadas"\n    filename: "ventas.csv"\n    path: "./data"\n    file_format:\n      type: "CSV"\n      delimiter: ","\n      header: true\n    fields:\n      - name: "codigo_venta"\n        type: "texto"\n        required: true\n        unique: true\n        validation_rules:\n          - name: "Formato código venta"\n            description: "El código debe seguir el formato VTA-XXX"\n            rule: "df['codigo_venta'].str.match('VTA-[0-9]{3}')"\n            severity: "error"\n      - name: "codigo_cliente"\n        type: "texto"\n        required: true\n      - name: "codigo_producto"\n        type: "texto"\n        required: true\n      - name: "cantidad"\n        type: "entero"\n        required: true\n        validation_rules:\n          - name: "Cantidad válida"\n            description: "La cantidad debe ser positiva"\n            rule: "df['cantidad'] > 0"\n            severity: "error"\n\npackages:\n  paquete_ventas:\n    name: "Paquete Completo de Ventas"\n    description: "Sistema completo de ventas"\n    file_format:\n      type: "ZIP"\n    catalogs:\n      - productos\n      - clientes\n      - ventas\n    package_validation:\n      - name: "Stock suficiente"\n        description: "Debe haber suficiente stock para cada venta"\n        rule: "df['ventas'].groupby('codigo_producto')['cantidad'].sum() <= df['productos'].set_index('codigo_producto')['existencias']"\n        severity: "error"\n      - name: "Clientes válidos"\n        description: "Las ventas deben ser a clientes existentes"\n        rule: "df['ventas']['codigo_cliente'].isin(df['clientes']['codigo_cliente'])"\n        severity: "error"\n
51	5	maestroAlicorp.yaml	\N	\N	\N	2025-03-29 00:08:29.77351	t	Configuración Maestro Productos Alicorp	Validación y estructura del catálogo de productos de Alicorp	sage_yaml:\n  name: "Configuración Maestro Productos Alicorp"\n  description: "Validación y estructura del catálogo de productos de Alicorp"\n  version: "1.0.0"\n  author: "Nombre del Autor"\n  comments: "Este YAML define las reglas de validación para el catálogo de productos de Alicorp."\n\ncatalogs:\n  maestro_productos_alicorp:\n    name: "Maestro de Productos Alicorp"\n    description: "Catálogo que contiene la información detallada de los productos de Alicorp"\n    filename: "Maestro productos Alicorp.xlsx"\n    file_format:\n      type: "EXCEL"\n\n    fields:\n      - name: "CodigoProducto"\n        type: "entero"\n        required: true\n        unique: true\n\n      - name: "EAN13"\n        type: "entero"\n        required: true\n        unique: true\n\n      - name: "DescripcionProducto"\n        type: "texto"\n        required: true\n        validation_rules:\n          - name: "Validación de Descripción"\n            description: "La descripción del producto no debe estar vacía 📄"\n            rule: "df['DescripcionProducto'].notnull()"\n            severity: "error"\n\n      - name: "Negocio"\n        type: "texto"\n        required: true\n\n      - name: "SubNegocio"\n        type: "texto"\n        required: true\n\n      - name: "Empresa"\n        type: "texto"\n        required: true\n\n      - name: "Plataforma"\n        type: "texto"\n        required: true\n\n      - name: "SubPlataforma"\n        type: "texto"\n        required: true\n\n      - name: "CodigoCategoria"\n        type: "entero"\n        required: true\n\n      - name: "Categoria"\n        type: "texto"\n        required: true\n\n      - name: "CodigoFamilia"\n        type: "entero"\n        required: true\n\n      - name: "Familia"\n        type: "texto"\n        required: true\n\n      - name: "CodigoMarca"\n        type: "entero"\n        required: true\n\n      - name: "Marca"\n        type: "texto"\n        required: true\n\n      - name: "Variedad"\n        type: "texto"\n        required: true\n\n      - name: "Presentacion"\n        type: "texto"\n        required: true\n\n      - name: "UnidadesPorCaja"\n        type: "entero"\n        required: true\n\n      - name: "PesoUnidadBase"\n        type: "decimal"\n        required: true\n\n      - name: "PesoUnidadVenta"\n        type: "decimal"\n        required: true\n\n      - name: "DUENOMARCA"\n        type: "texto"\n        required: true\n\n      - name: "CODDUENOMARCA"\n        type: "entero"\n        required: true\n\n      - name: "ESTADO"\n        type: "texto"\n        required: true\n\n      - name: "COD. REEMPLAZO"\n        type: "entero"\n        required: false\n\npackages:\n  paquete_maestro_productos:\n    name: "Paquete Maestro Productos"\n    description: "Paquete que contiene el catálogo maestro de productos de Alicorp"\n    file_format:\n      type: "ZIP"\n    catalogs:\n      - maestro_productos_alicorp
52	5	MAestroAlicorpv2.yaml	\N	\N	\N	2025-03-29 01:19:01.009478	t	Configuración Maestro Productos Alicorp	Definición y validación del catálogo de productos de Alicorp	sage_yaml:\n  name: "Configuración Maestro Productos Alicorp"\n  description: "Definición y validación del catálogo de productos de Alicorp"\n  version: "1.0.0"\n  author: "Nombre del Autor"\n  comments: "Este YAML define la estructura y validaciones para el catálogo de productos de Alicorp."\n\ncatalogs:\n  maestro_productos_alicorp:\n    name: "Maestro Productos Alicorp"\n    description: "Catálogo de productos de Alicorp con detalles específicos"\n    filename: "Maestro productos Alicorp.xlsx"\n    file_format:\n      type: "EXCEL"\n      header: true\n    fields:\n      - name: "CodigoProducto"\n        type: "entero"\n        required: true\n        unique: true\n      - name: "EAN13"\n        type: "entero"\n        required: true\n        unique: true\n      - name: "DescripcionProducto"\n        type: "texto"\n        required: true\n      - name: "Negocio"\n        type: "texto"\n        required: true\n      - name: "SubNegocio"\n        type: "texto"\n        required: true\n      - name: "Empresa"\n        type: "texto"\n        required: true\n      - name: "Plataforma"\n        type: "texto"\n        required: true\n      - name: "SubPlataforma"\n        type: "texto"\n        required: true\n      - name: "CodigoCategoria"\n        type: "entero"\n        required: true\n      - name: "Categoria"\n        type: "texto"\n        required: true\n      - name: "CodigoFamilia"\n        type: "entero"\n        required: true\n      - name: "Familia"\n        type: "texto"\n        required: true\n      - name: "CodigoMarca"\n        type: "entero"\n        required: true\n      - name: "Marca"\n        type: "texto"\n        required: true\n      - name: "Variedad"\n        type: "texto"\n        required: true\n      - name: "Presentacion"\n        type: "texto"\n        required: true\n      - name: "UnidadesPorCaja"\n        type: "entero"\n        required: true\n      - name: "PesoUnidadBase"\n        type: "decimal"\n        required: true\n      - name: "PesoUnidadVenta"\n        type: "decimal"\n        required: true\n      - name: "DUENOMARCA"\n        type: "texto"\n        required: true\n      - name: "CODDUENOMARCA"\n        type: "entero"\n        required: true\n      - name: "ESTADO"\n        type: "texto"\n        required: true\n      - name: "COD. REEMPLAZO"\n        type: "entero"\n        required: false\n\npackages:\n  paquete_maestro_productos:\n    name: "Paquete Maestro Productos"\n    description: "Paquete que contiene el catálogo de productos de Alicorp"\n    file_format:\n      type: "ZIP"\n    catalogs:\n      - maestro_productos_alicorp
53	5	MaestroAlicorpV3.yaml	\N	\N	\N	2025-03-29 01:21:42.505735	t	Configuración Maestro Productos Alicorp	Definición y validación del catálogo de productos de Alicorp	sage_yaml:\n  name: "Configuración Maestro Productos Alicorp"\n  description: "Definición y validación del catálogo de productos de Alicorp"\n  version: "1.0.0"\n  author: "Nombre del Autor"\n  comments: "Este YAML define la estructura y validaciones para el catálogo de productos de Alicorp."\n\ncatalogs:\n  maestro_productos_alicorp:\n    name: "Maestro Productos Alicorp"\n    description: "Catálogo de productos de Alicorp con detalles específicos"\n    filename: "Maestro productos Alicorp.xlsx"\n    file_format:\n      type: "EXCEL"\n      header: true\n    fields:\n      - name: "CodigoProducto"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "EAN13"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "DescripcionProducto"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "Negocio"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "SubNegocio"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "Empresa"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "Plataforma"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "SubPlataforma"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "CodigoCategoria"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "Categoria"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "CodigoFamilia"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "Familia"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "CodigoMarca"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "Marca"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "Variedad"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "Presentacion"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "UnidadesPorCaja"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "PesoUnidadBase"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "PesoUnidadVenta"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "DUENOMARCA"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "CODDUENOMARCA"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "ESTADO"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "COD. REEMPLAZO"\n        type: "texto"\n        required: true\n        unique: false\n\npackages:\n  paquete_maestro_productos:\n    name: "Paquete Maestro Productos"\n    description: "Paquete que contiene el catálogo maestro de productos de Alicorp"\n    file_format:\n      type: "ZIP"\n    catalogs:\n      - maestro_productos_alicorp
54	5	MaestroAlicorpV3(1).yaml	\N	\N	\N	2025-03-29 01:21:43.192766	t	Configuración Maestro Productos Alicorp	Definición y validación del catálogo de productos de Alicorp	sage_yaml:\n  name: "Configuración Maestro Productos Alicorp"\n  description: "Definición y validación del catálogo de productos de Alicorp"\n  version: "1.0.0"\n  author: "Nombre del Autor"\n  comments: "Este YAML define la estructura y validaciones para el catálogo de productos de Alicorp."\n\ncatalogs:\n  maestro_productos_alicorp:\n    name: "Maestro Productos Alicorp"\n    description: "Catálogo de productos de Alicorp con detalles específicos"\n    filename: "Maestro productos Alicorp.xlsx"\n    file_format:\n      type: "EXCEL"\n      header: true\n    fields:\n      - name: "CodigoProducto"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "EAN13"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "DescripcionProducto"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "Negocio"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "SubNegocio"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "Empresa"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "Plataforma"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "SubPlataforma"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "CodigoCategoria"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "Categoria"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "CodigoFamilia"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "Familia"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "CodigoMarca"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "Marca"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "Variedad"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "Presentacion"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "UnidadesPorCaja"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "PesoUnidadBase"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "PesoUnidadVenta"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "DUENOMARCA"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "CODDUENOMARCA"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "ESTADO"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "COD. REEMPLAZO"\n        type: "texto"\n        required: true\n        unique: false\n\npackages:\n  paquete_maestro_productos:\n    name: "Paquete Maestro Productos"\n    description: "Paquete que contiene el catálogo maestro de productos de Alicorp"\n    file_format:\n      type: "ZIP"\n    catalogs:\n      - maestro_productos_alicorp
48	1	ventas_completo(1).yaml	\N	\N	\N	2025-03-28 20:36:52.580199	t	Sistema Completo de Ventas	Test complejo con múltiples catálogos y validaciones cruzadas	sage_yaml:\n  name: "Sistema Completo de Ventas"\n  description: "Test complejo con múltiples catálogos y validaciones cruzadas"\n  version: "1.0.0"\n  author: "SAGE Tests"\n  comments: "Caso de prueba complejo con ZIP"\n\ncatalogs:\n  productos:\n    name: "Catálogo de Productos"\n    description: "Productos disponibles"\n    filename: "productos.xlsx"\n    path: "./data"\n    file_format:\n      type: "EXCEL"\n      header: true\n    fields:\n      - name: "codigo_producto"\n        type: "texto"\n        required: true\n        unique: true\n        validation_rules:\n          - name: "Formato código producto"\n            description: "El código debe seguir el formato PROD-XXX"\n            rule: "df['codigo_producto'].str.match('PROD-[0-9]{3}')"\n            severity: "error"\n      - name: "existencias"\n        type: "entero"\n        required: true\n        validation_rules:\n          - name: "Stock válido"\n            description: "El stock debe ser positivo"\n            rule: "df['existencias'] >= 0"\n            severity: "error"\n\n  clientes:\n    name: "Catálogo de Clientes"\n    description: "Clientes registrados"\n    filename: "clientes.csv"\n    path: "./data"\n    file_format:\n      type: "CSV"\n      delimiter: ","\n      header: true\n    fields:\n      - name: "codigo_cliente"\n        type: "texto"\n        required: true\n        unique: true\n        validation_rules:\n          - name: "Formato código cliente"\n            description: "El código debe seguir el formato CLI-XXX"\n            rule: "df['codigo_cliente'].str.match('CLI-[0-9]{3}')"\n            severity: "error"\n      - name: "limite_credito"\n        type: "decimal"\n        required: true\n        validation_rules:\n          - name: "Límite válido"\n            description: "El límite debe ser positivo"\n            rule: "df['limite_credito'] > 0"\n            severity: "error"\n\n  ventas:\n    name: "Registro de Ventas"\n    description: "Ventas realizadas"\n    filename: "ventas.csv"\n    path: "./data"\n    file_format:\n      type: "CSV"\n      delimiter: ","\n      header: true\n    fields:\n      - name: "codigo_venta"\n        type: "texto"\n        required: true\n        unique: true\n        validation_rules:\n          - name: "Formato código venta"\n            description: "El código debe seguir el formato VTA-XXX"\n            rule: "df['codigo_venta'].str.match('VTA-[0-9]{3}')"\n            severity: "error"\n      - name: "codigo_cliente"\n        type: "texto"\n        required: true\n      - name: "codigo_producto"\n        type: "texto"\n        required: true\n      - name: "cantidad"\n        type: "entero"\n        required: true\n        validation_rules:\n          - name: "Cantidad válida"\n            description: "La cantidad debe ser positiva"\n            rule: "df['cantidad'] > 0"\n            severity: "error"\n\npackages:\n  paquete_ventas:\n    name: "Paquete Completo de Ventas"\n    description: "Sistema completo de ventas"\n    file_format:\n      type: "ZIP"\n    catalogs:\n      - productos\n      - clientes\n      - ventas\n    package_validation:\n      - name: "Stock suficiente"\n        description: "Debe haber suficiente stock para cada venta"\n        rule: "df['ventas'].groupby('codigo_producto')['cantidad'].sum() <= df['productos'].set_index('codigo_producto')['existencias']"\n        severity: "error"\n      - name: "Clientes válidos"\n        description: "Las ventas deben ser a clientes existentes"\n        rule: "df['ventas']['codigo_cliente'].isin(df['clientes']['codigo_cliente'])"\n        severity: "error"\n
50	1	configuracion.yaml	\N	\N	\N	2025-03-28 23:20:49.061355	t	Configuración de Catálogos de Productos, Clientes y Ventas	Definición y validación de catálogos para productos, clientes y ventas en formato CSV y Excel.	sage_yaml:\n  name: "Configuración de Catálogos de Productos, Clientes y Ventas"\n  description: "Definición y validación de catálogos para productos, clientes y ventas en formato CSV y Excel."\n  version: "1.0.0"\n  author: "Nombre del Autor"\n  comments: "Este YAML define las reglas de validación para los catálogos de productos, clientes y ventas."\n\ncatalogs:\n  productos_csv:\n    name: "Catálogo de Productos CSV"\n    description: "Catálogo de productos en formato CSV con detalles de código, nombre, precio y existencias."\n    filename: "productos.csv"\n    file_format:\n      type: "CSV"\n      delimiter: ","\n      header: true\n    fields:\n      - name: "codigo_producto"\n        type: "texto"\n        required: true\n        unique: true\n        validation_rules:\n          - name: "Formato de Código de Producto"\n            description: "¡Hey! El código del producto debe seguir el formato P-XXXXX 📝"\n            rule: "df['codigo_producto'].str.match('^P-[0-9]{6}$')"\n            severity: "error"\n      - name: "nombre"\n        type: "texto"\n        required: true\n      - name: "precio"\n        type: "decimal"\n        required: true\n        validation_rules:\n          - name: "Precio Positivo"\n            description: "¡Ops! El precio debe ser mayor a cero 💰"\n            rule: "df['precio'].astype(float) > 0"\n            severity: "error"\n      - name: "existencias"\n        type: "entero"\n        required: true\n        validation_rules:\n          - name: "Existencias No Negativas"\n            description: "¡Atención! Las existencias no pueden ser negativas 📦"\n            rule: "df['existencias'].astype(int) >= 0"\n            severity: "error"\n\n  clientes:\n    name: "Catálogo de Clientes"\n    description: "Catálogo de clientes con código, nombre y límite de crédito."\n    filename: "clientes.csv"\n    file_format:\n      type: "CSV"\n      delimiter: ","\n      header: true\n    fields:\n      - name: "codigo_cliente"\n        type: "texto"\n        required: true\n        unique: true\n      - name: "nombre"\n        type: "texto"\n        required: true\n      - name: "limite_credito"\n        type: "decimal"\n        required: true\n        validation_rules:\n          - name: "Límite de Crédito Positivo"\n            description: "¡Hey! El límite de crédito debe ser mayor a cero 💳"\n            rule: "df['limite_credito'].astype(float) > 0"\n            severity: "error"\n\n  ventas:\n    name: "Catálogo de Ventas"\n    description: "Catálogo de ventas con detalles de código de venta, cliente, producto y cantidad."\n    filename: "ventas.csv"\n    file_format:\n      type: "CSV"\n      delimiter: ","\n      header: true\n    fields:\n      - name: "codigo_venta"\n        type: "texto"\n        required: true\n        unique: true\n      - name: "codigo_cliente"\n        type: "texto"\n        required: true\n      - name: "codigo_producto"\n        type: "texto"\n        required: true\n      - name: "cantidad"\n        type: "entero"\n        required: true\n        validation_rules:\n          - name: "Cantidad Positiva"\n            description: "¡Ops! La cantidad debe ser mayor a cero 🛒"\n            rule: "df['cantidad'].astype(int) > 0"\n            severity: "error"\n\n  productos_xlsx:\n    name: "Catálogo de Productos Excel"\n    description: "Catálogo de productos en formato Excel con detalles de código, nombre y existencias."\n    filename: "productos.xlsx"\n    file_format:\n      type: "EXCEL"\n    fields:\n      - name: "codigo_producto"\n        type: "texto"\n        required: true\n        unique: true\n      - name: "nombre"\n        type: "texto"\n        required: true\n      - name: "existencias"\n        type: "entero"\n        required: true\n        validation_rules:\n          - name: "Existencias No Negativas"\n            description: "¡Atención! Las existencias no pueden ser negativas 📦"\n            rule: "df['existencias'].astype(int) >= 0"\n            severity: "error"\n\npackages:\n  paquete_datos:\n    name: "Paquete de Datos de Productos, Clientes y Ventas"\n    description: "Paquete que agrupa los catálogos de productos, clientes y ventas en un archivo ZIP."\n    file_format:\n      type: "ZIP"\n    catalogs:\n      - productos_csv\n      - clientes\n      - ventas\n      - productos_xlsx\n    package_validation:\n      - name: "Validación de Referencias de Cliente"\n        description: "¡Ups! Algunos códigos de cliente en ventas no existen en el catálogo de clientes 🤔"\n        rule: "df['ventas']['codigo_cliente'].isin(df['clientes']['codigo_cliente'])"\n        severity: "error"\n      - name: "Validación de Referencias de Producto"\n        description: "¡Ups! Algunos códigos de producto en ventas no existen en el catálogo de productos 🔍"\n        rule: "df['ventas']['codigo_producto'].isin(df['productos_csv']['codigo_producto'])"\n        severity: "error"
57	6	DistribuidorSimple.yaml	\N	\N	\N	2025-03-30 18:33:19.852555	t	1743359382813	Configuración generada para 7 catálogos	sage_yaml:\n  name: '1743359382813'\n  description: Configuración generada para 7 catálogos\n  version: 1.0.0\n  author: YAML Studio\ncatalogs:\n  clientes:\n    name: Catálogo de Clientes\n    description: Información de clientes del distribuidor\n    filename: clientes.csv\n    file_format:\n      type: CSV\n      delimiter: '|'\n      header: false\n    fields:\n    - name: COLUMNA_1\n      type: entero\n      unique: false\n    - name: COLUMNA_2\n      type: entero\n      unique: false\n    - name: COLUMNA_3\n      type: entero\n      unique: false\n    - name: COLUMNA_4\n      type: texto\n      unique: false\n    - name: COLUMNA_5\n      type: texto\n      unique: false\n    - name: COLUMNA_6\n      type: texto\n      unique: false\n    - name: COLUMNA_7\n      type: texto\n      unique: false\n    - name: COLUMNA_8\n      type: texto\n      unique: false\n    - name: COLUMNA_9\n      type: texto\n      unique: false\n    - name: COLUMNA_10\n      type: texto\n      unique: false\n    - name: COLUMNA_11\n      type: texto\n      unique: false\n    - name: COLUMNA_12\n      type: entero\n      unique: false\n    - name: COLUMNA_13\n      type: texto\n      unique: false\n    - name: COLUMNA_14\n      type: texto\n      unique: false\n    - name: COLUMNA_15\n      type: decimal\n      unique: false\n    - name: COLUMNA_16\n      type: decimal\n      unique: false\n    - name: COLUMNA_17\n      type: texto\n      unique: false\n    - name: COLUMNA_18\n      type: fecha\n      unique: false\n    - name: COLUMNA_19\n      type: fecha\n      unique: false\n    - name: COLUMNA_20\n      type: fecha\n      unique: false\n    - name: COLUMNA_21\n      type: texto\n      unique: false\n    - name: COLUMNA_22\n      type: entero\n      unique: false\n    - name: COLUMNA_23\n      type: entero\n      unique: false\n    - name: COLUMNA_24\n      type: texto\n      unique: false\n    - name: COLUMNA_25\n      type: texto\n      unique: false\n    - name: COLUMNA_26\n      type: texto\n      unique: false\n    - name: COLUMNA_27\n      type: texto\n      unique: false\n    - name: COLUMNA_28\n      type: texto\n      unique: false\n    - name: COLUMNA_29\n      type: texto\n      unique: false\n    - name: COLUMNA_30\n      type: texto\n      unique: false\n  pedidos:\n    name: Catálogo de Pedidos\n    description: Información de pedidos del distribuidor\n    filename: pedidos.csv\n    file_format:\n      type: CSV\n      delimiter: '|'\n      header: false\n    fields:\n    - name: COLUMNA_1\n      type: entero\n      unique: false\n    - name: COLUMNA_2\n      type: entero\n      unique: false\n    - name: COLUMNA_3\n      type: entero\n      unique: false\n    - name: COLUMNA_4\n      type: entero\n      unique: false\n    - name: COLUMNA_5\n      type: texto\n      unique: false\n    - name: COLUMNA_6\n      type: texto\n      unique: false\n    - name: COLUMNA_7\n      type: fecha\n      unique: false\n    - name: COLUMNA_8\n      type: texto\n      unique: false\n    - name: COLUMNA_9\n      type: texto\n      unique: false\n    - name: COLUMNA_10\n      type: texto\n      unique: false\n    - name: COLUMNA_11\n      type: texto\n      unique: false\n    - name: COLUMNA_12\n      type: fecha\n      unique: false\n    - name: COLUMNA_13\n      type: texto\n      unique: false\n    - name: COLUMNA_14\n      type: entero\n      unique: false\n    - name: COLUMNA_15\n      type: texto\n      unique: false\n    - name: COLUMNA_16\n      type: texto\n      unique: false\n    - name: COLUMNA_17\n      type: decimal\n      unique: false\n    - name: COLUMNA_18\n      type: texto\n      unique: false\n    - name: COLUMNA_19\n      type: decimal\n      unique: false\n    - name: COLUMNA_20\n      type: texto\n      unique: false\n    - name: COLUMNA_21\n      type: decimal\n      unique: false\n    - name: COLUMNA_22\n      type: decimal\n      unique: false\n    - name: COLUMNA_23\n      type: decimal\n      unique: false\n    - name: COLUMNA_24\n      type: fecha\n      unique: false\n    - name: COLUMNA_25\n      type: texto\n      unique: false\n    - name: COLUMNA_26\n      type: texto\n      unique: false\n    - name: COLUMNA_27\n      type: entero\n      unique: false\n    - name: COLUMNA_28\n      type: texto\n      unique: false\n    - name: COLUMNA_29\n      type: texto\n      unique: false\n    - name: COLUMNA_30\n      type: texto\n      unique: false\n    - name: COLUMNA_31\n      type: texto\n      unique: false\n    - name: COLUMNA_32\n      type: texto\n      unique: false\n    - name: COLUMNA_33\n      type: texto\n      unique: false\n  productos:\n    name: Catálogo de Productos\n    description: Información de productos del distribuidor\n    filename: productos.csv\n    file_format:\n      type: CSV\n      delimiter: '|'\n      header: false\n    fields:\n    - name: COLUMNA_1\n      type: entero\n      unique: false\n    - name: COLUMNA_2\n      type: entero\n      unique: false\n    - name: COLUMNA_3\n      type: entero\n      unique: false\n    - name: COLUMNA_4\n      type: texto\n      unique: false\n    - name: COLUMNA_5\n      type: texto\n      unique: false\n    - name: COLUMNA_6\n      type: texto\n      unique: false\n    - name: COLUMNA_7\n      type: entero\n      unique: false\n    - name: COLUMNA_8\n      type: decimal\n      unique: false\n    - name: COLUMNA_9\n      type: entero\n      unique: false\n    - name: COLUMNA_10\n      type: entero\n      unique: false\n    - name: COLUMNA_11\n      type: decimal\n      unique: false\n    - name: COLUMNA_12\n      type: decimal\n      unique: false\n    - name: COLUMNA_13\n      type: decimal\n      unique: false\n    - name: COLUMNA_14\n      type: fecha\n      unique: false\n    - name: COLUMNA_15\n      type: texto\n      unique: false\n    - name: COLUMNA_16\n      type: texto\n      unique: false\n    - name: COLUMNA_17\n      type: texto\n      unique: false\n    - name: COLUMNA_18\n      type: texto\n      unique: false\n    - name: COLUMNA_19\n      type: texto\n      unique: false\n    - name: COLUMNA_20\n      type: texto\n      unique: false\n    - name: COLUMNA_21\n      type: texto\n      unique: false\n    - name: COLUMNA_22\n      type: texto\n      unique: false\n    - name: COLUMNA_23\n      type: texto\n      unique: false\n  rutas:\n    name: Catálogo de Rutas\n    description: Contiene información sobre las rutas de distribución\n    filename: rutas.csv\n    file_format:\n      type: CSV\n      delimiter: '|'\n      header: false\n    fields:\n    - name: COLUMNA_1\n      type: entero\n      unique: false\n    - name: COLUMNA_2\n      type: entero\n      unique: false\n    - name: COLUMNA_3\n      type: entero\n      unique: false\n    - name: COLUMNA_4\n      type: entero\n      unique: false\n    - name: COLUMNA_5\n      type: texto\n      unique: false\n    - name: COLUMNA_6\n      type: texto\n      unique: false\n    - name: COLUMNA_7\n      type: texto\n      unique: false\n    - name: COLUMNA_8\n      type: texto\n      unique: false\n    - name: COLUMNA_9\n      type: texto\n      unique: false\n    - name: COLUMNA_10\n      type: texto\n      unique: false\n    - name: COLUMNA_11\n      type: fecha\n      unique: false\n    - name: COLUMNA_12\n      type: texto\n      unique: false\n    - name: COLUMNA_13\n      type: entero\n      unique: false\n    - name: COLUMNA_14\n      type: texto\n      unique: false\n    - name: COLUMNA_15\n      type: texto\n      unique: false\n    - name: COLUMNA_16\n      type: texto\n      unique: false\n    - name: COLUMNA_17\n      type: texto\n      unique: false\n    - name: COLUMNA_18\n      type: texto\n      unique: false\n    - name: COLUMNA_19\n      type: texto\n      unique: false\n    - name: COLUMNA_20\n      type: texto\n      unique: false\n    - name: COLUMNA_21\n      type: texto\n      unique: false\n  stock:\n    name: Catálogo de Stock\n    description: Contiene información sobre el stock de productos\n    filename: stock.csv\n    file_format:\n      type: CSV\n      delimiter: '|'\n      header: false\n    fields:\n    - name: COLUMNA_1\n      type: entero\n      unique: false\n    - name: COLUMNA_2\n      type: entero\n      unique: false\n    - name: COLUMNA_3\n      type: entero\n      unique: false\n    - name: COLUMNA_4\n      type: texto\n      unique: false\n    - name: COLUMNA_5\n      type: entero\n      unique: false\n    - name: COLUMNA_6\n      type: texto\n      unique: false\n    - name: COLUMNA_7\n      type: fecha\n      unique: false\n    - name: COLUMNA_8\n      type: decimal\n      unique: false\n    - name: COLUMNA_9\n      type: texto\n      unique: false\n    - name: COLUMNA_10\n      type: decimal\n      unique: false\n    - name: COLUMNA_11\n      type: texto\n      unique: false\n    - name: COLUMNA_12\n      type: decimal\n      unique: false\n    - name: COLUMNA_13\n      type: fecha\n      unique: false\n    - name: COLUMNA_14\n      type: decimal\n      unique: false\n    - name: COLUMNA_15\n      type: decimal\n      unique: false\n    - name: COLUMNA_16\n      type: entero\n      unique: false\n    - name: COLUMNA_17\n      type: decimal\n      unique: false\n    - name: COLUMNA_18\n      type: decimal\n      unique: false\n    - name: COLUMNA_19\n      type: decimal\n      unique: false\n    - name: COLUMNA_20\n      type: entero\n      unique: false\n    - name: COLUMNA_21\n      type: entero\n      unique: false\n    - name: COLUMNA_22\n      type: texto\n      unique: false\n    - name: COLUMNA_23\n      type: texto\n      unique: false\n    - name: COLUMNA_24\n      type: texto\n      unique: false\n    - name: COLUMNA_25\n      type: texto\n      unique: false\n    - name: COLUMNA_26\n      type: texto\n      unique: false\n    - name: COLUMNA_27\n      type: texto\n      unique: false\n    - name: COLUMNA_28\n      type: texto\n      unique: false\n    - name: COLUMNA_29\n      type: texto\n      unique: false\n    - name: COLUMNA_30\n      type: texto\n      unique: false\n  vendedores:\n    name: Catálogo de Vendedores\n    description: Contiene información sobre los vendedores\n    filename: vendedores.csv\n    file_format:\n      type: CSV\n      delimiter: '|'\n      header: false\n    fields:\n    - name: COLUMNA_1\n      type: entero\n      unique: false\n    - name: COLUMNA_2\n      type: entero\n      unique: false\n    - name: COLUMNA_3\n      type: entero\n      unique: false\n    - name: COLUMNA_4\n      type: texto\n      unique: false\n    - name: COLUMNA_5\n      type: texto\n      unique: false\n    - name: COLUMNA_6\n      type: texto\n      unique: false\n    - name: COLUMNA_7\n      type: texto\n      unique: false\n    - name: COLUMNA_8\n      type: fecha\n      unique: false\n    - name: COLUMNA_9\n      type: fecha\n      unique: false\n    - name: COLUMNA_10\n      type: fecha\n      unique: false\n    - name: COLUMNA_11\n      type: entero\n      unique: false\n    - name: COLUMNA_12\n      type: texto\n      unique: false\n    - name: COLUMNA_13\n      type: texto\n      unique: false\n    - name: COLUMNA_14\n      type: texto\n      unique: false\n    - name: COLUMNA_15\n      type: texto\n      unique: false\n    - name: COLUMNA_16\n      type: texto\n      unique: false\n    - name: COLUMNA_17\n      type: texto\n      unique: false\n    - name: COLUMNA_18\n      type: entero\n      unique: false\n    - name: COLUMNA_19\n      type: entero\n      unique: false\n    - name: COLUMNA_20\n      type: texto\n      unique: false\n    - name: COLUMNA_21\n      type: texto\n      unique: false\n    - name: COLUMNA_22\n      type: texto\n      unique: false\n    - name: COLUMNA_23\n      type: texto\n      unique: false\n    - name: COLUMNA_24\n      type: texto\n      unique: false\n    - name: COLUMNA_25\n      type: texto\n      unique: false\n  ventas:\n    name: Catálogo de Ventas\n    description: Datos de ventas del distribuidor\n    filename: ventas.csv\n    file_format:\n      type: CSV\n      delimiter: '|'\n      header: false\n    fields:\n    - name: COLUMNA_1\n      type: entero\n      unique: false\n    - name: COLUMNA_2\n      type: entero\n      unique: false\n    - name: COLUMNA_3\n      type: texto\n      unique: false\n    - name: COLUMNA_4\n      type: texto\n      unique: false\n    - name: COLUMNA_5\n      type: fecha\n      unique: false\n    - name: COLUMNA_6\n      type: texto\n      unique: false\n    - name: COLUMNA_7\n      type: texto\n      unique: false\n    - name: COLUMNA_8\n      type: entero\n      unique: false\n    - name: COLUMNA_9\n      type: texto\n      unique: false\n    - name: COLUMNA_10\n      type: texto\n      unique: false\n    - name: COLUMNA_11\n      type: entero\n      unique: false\n    - name: COLUMNA_12\n      type: texto\n      unique: false\n    - name: COLUMNA_13\n      type: texto\n      unique: false\n    - name: COLUMNA_14\n      type: entero\n      unique: false\n    - name: COLUMNA_15\n      type: texto\n      unique: false\n    - name: COLUMNA_16\n      type: decimal\n      unique: false\n    - name: COLUMNA_17\n      type: texto\n      unique: false\n    - name: COLUMNA_18\n      type: decimal\n      unique: false\n    - name: COLUMNA_19\n      type: texto\n      unique: false\n    - name: COLUMNA_20\n      type: texto\n      unique: false\n    - name: COLUMNA_21\n      type: decimal\n      unique: false\n    - name: COLUMNA_22\n      type: decimal\n      unique: false\n    - name: COLUMNA_23\n      type: decimal\n      unique: false\n    - name: COLUMNA_24\n      type: texto\n      unique: false\n    - name: COLUMNA_25\n      type: texto\n      unique: false\n    - name: COLUMNA_26\n      type: texto\n      unique: false\n    - name: COLUMNA_27\n      type: texto\n      unique: false\n    - name: COLUMNA_28\n      type: fecha\n      unique: false\n    - name: COLUMNA_29\n      type: fecha\n      unique: false\n    - name: COLUMNA_30\n      type: texto\n      unique: false\n    - name: COLUMNA_31\n      type: texto\n      unique: false\n    - name: COLUMNA_32\n      type: texto\n      unique: false\n    - name: COLUMNA_33\n      type: texto\n      unique: false\n    - name: COLUMNA_34\n      type: texto\n      unique: false\n    - name: COLUMNA_35\n      type: entero\n      unique: false\n    - name: COLUMNA_36\n      type: entero\n      unique: false\n    - name: COLUMNA_37\n      type: texto\n      unique: false\n    - name: COLUMNA_38\n      type: texto\n      unique: false\n    - name: COLUMNA_39\n      type: texto\n      unique: false\npackages:\n  paquete_principal:\n    name: Paquete Principal\n    description: Paquete que agrupa todos los catálogos\n    file_format:\n      type: ZIP\n    catalogs:\n    - clientes\n    - pedidos\n    - productos\n    - rutas\n    - stock\n    - vendedores\n    - ventas\n
49	1	configuracion (2).yaml	\N	\N	\N	2025-03-28 20:37:23.046876	t	Configuración de Validación de Datos	Archivo YAML para validar catálogos de productos, clientes y ventas	sage_yaml:\n  name: "Configuración de Validación de Datos"\n  description: "Archivo YAML para validar catálogos de productos, clientes y ventas"\n  version: "1.0.0"\n  author: "Usuario"\n  comments: "Generado automáticamente para validar datos de entrada"\n\ncatalogs:\n  productos_csv:\n    name: "Catálogo de Productos CSV"\n    description: "Catálogo de productos en formato CSV"\n    filename: "productos.csv"\n    file_format:\n      type: "CSV"\n      delimiter: ","\n      header: true\n    fields:\n      - name: "codigo_producto"\n        type: "texto"\n        required: true\n        unique: true\n        validation_rules:\n          - name: "Código Numérico"\n            description: "¡Ops! El código del producto debe ser numérico 😅"\n            rule: "df['codigo_producto'].str.match('^[0-9]+$')"\n            severity: "error"\n      - name: "nombre"\n        type: "texto"\n        required: true\n      - name: "precio"\n        type: "decimal"\n        required: true\n      - name: "existencias"\n        type: "entero"\n        required: true\n\n  clientes_csv:\n    name: "Catálogo de Clientes CSV"\n    description: "Catálogo de clientes en formato CSV"\n    filename: "clientes.csv"\n    file_format:\n      type: "CSV"\n      delimiter: ","\n      header: true\n    fields:\n      - name: "codigo_cliente"\n        type: "texto"\n        required: true\n        unique: true\n        validation_rules:\n          - name: "Código Numérico"\n            description: "¡Ops! El código del cliente debe ser numérico 😅"\n            rule: "df['codigo_cliente'].str.match('^[0-9]+$')"\n            severity: "error"\n      - name: "nombre"\n        type: "texto"\n        required: true\n      - name: "limite_credito"\n        type: "decimal"\n        required: true\n\n  ventas_csv:\n    name: "Catálogo de Ventas CSV"\n    description: "Catálogo de ventas en formato CSV"\n    filename: "ventas.csv"\n    file_format:\n      type: "CSV"\n      delimiter: ","\n      header: true\n    fields:\n      - name: "codigo_venta"\n        type: "texto"\n        required: true\n        unique: true\n        validation_rules:\n          - name: "Código Numérico"\n            description: "¡Ops! El código de la venta debe ser numérico 😅"\n            rule: "df['codigo_venta'].str.match('^[0-9]+$')"\n            severity: "error"\n      - name: "codigo_cliente"\n        type: "texto"\n        required: true\n      - name: "codigo_producto"\n        type: "texto"\n        required: true\n      - name: "cantidad"\n        type: "entero"\n        required: true\n\n  productos_xlsx:\n    name: "Catálogo de Productos XLSX"\n    description: "Catálogo de productos en formato XLSX"\n    filename: "productos.xlsx"\n    file_format:\n      type: "EXCEL"\n    fields:\n      - name: "codigo_producto"\n        type: "texto"\n        required: true\n        unique: true\n        validation_rules:\n          - name: "Código Numérico"\n            description: "¡Ops! El código del producto debe ser numérico 😅"\n            rule: "df['codigo_producto'].str.match('^[0-9]+$')"\n            severity: "error"\n      - name: "nombre"\n        type: "texto"\n        required: true\n      - name: "existencias"\n        type: "entero"\n        required: true\n\npackages:\n  paquete_datos:\n    name: "Paquete de Datos"\n    description: "Paquete que contiene catálogos de productos, clientes y ventas"\n    file_format:\n      type: "ZIP"\n    catalogs:\n      - productos_csv\n      - clientes_csv\n      - ventas_csv\n      - productos_xlsx\n    package_validation:\n      - name: "Validación de Referencias"\n        description: "¡Ups! Algunos códigos de producto no existen en el catálogo de productos 😮"\n        rule: "df['ventas_csv']['codigo_producto'].isin(df['productos_csv']['codigo_producto'])"\n        severity: "error"\n      - name: "Validación de Clientes"\n        description: "¡Ups! Algunos códigos de cliente no existen en el catálogo de clientes 😮"\n        rule: "df['ventas_csv']['codigo_cliente'].isin(df['clientes_csv']['codigo_cliente'])"\n        severity: "error"
59	6	CanalTradicionalArchivosDistribuidora(1).yaml	\N	\N	\N	2025-03-30 23:22:24.634256	t	Proyecto BI CLOROX - Definición SAGE	YAML de configuración para la validación y estructura de los archivos maestros y transaccionales del Proyecto BI CLOROX.	sage_yaml:\r\n  name: "Proyecto BI CLOROX - Definición SAGE"\r\n  description: "YAML de configuración para la validación y estructura de los archivos maestros y transaccionales del Proyecto BI CLOROX."\r\n  version: "1.0.0"\r\n  author: "Equipo de Integración"\r\n  comments: "Configuración generada según especificaciones y reglas definidas por el usuario."\r\n\r\ncatalogs:\r\n  clientes:\r\n    name: "Catálogo de Clientes"\r\n    description: "Definición del archivo clientes.csv con datos maestros de clientes."\r\n    filename: "clientes.csv"\r\n    file_format:\r\n      type: "CSV"\r\n      delimiter: "|"\r\n      header: false\r\n    fields:\r\n      - name: "CodigoProveedor"\r\n        type: "texto"\r\n      - name: "CodigoDistribuidor"\r\n        type: "texto"\r\n      - name: "CodigoCliente"\r\n        type: "texto"\r\n        unique: true\r\n        validation_rules:\r\n          - name: "Sin espacios en blanco"\r\n            description: "¡Atención! El código de cliente no debe contener espacios en blanco. Revisa y corrige 📝"\r\n            rule: "df['CodigoCliente'].str.match('^\\\\S+$')"\r\n            severity: "error"\r\n      - name: "NombreCliente"\r\n        type: "texto"\r\n      - name: "TipoDocumento"\r\n        type: "texto"\r\n      - name: "DNI"\r\n        type: "texto"\r\n      - name: "Direccion"\r\n        type: "texto"\r\n      - name: "Mercado"\r\n        type: "texto"\r\n      - name: "Modulo"\r\n        type: "texto"\r\n      - name: "Canal"\r\n        type: "texto"\r\n      - name: "GiroNegocio"\r\n        type: "texto"\r\n      - name: "SubGiroNegocio"\r\n        type: "texto"\r\n      - name: "Ubigeo"\r\n        type: "texto"\r\n      - name: "Distrito"\r\n        type: "texto"\r\n      - name: "Estatus"\r\n        type: "texto"\r\n        validation_rules:\r\n          - name: "Valor de Estatus"\r\n            description: "¡Atención! El estatus debe ser A (Activo), I (Inactivo) o T (Temporal) 😊"\r\n            rule: "df['Estatus'].isin(['A','I','T'])"\r\n            severity: "error"\r\n      - name: "X"\r\n        type: "decimal"\r\n      - name: "Y"\r\n        type: "decimal"\r\n      - name: "CodigoPadre"\r\n        type: "texto"\r\n      - name: "FechaIngreso"\r\n        type: "fecha"\r\n      - name: "FechaActualizacion"\r\n        type: "fecha"\r\n      - name: "FechaProceso"\r\n        type: "fecha"\r\n      - name: "REF1"\r\n        type: "texto"\r\n      - name: "REF2"\r\n        type: "texto"\r\n      - name: "REF3"\r\n        type: "texto"\r\n      - name: "REF4"\r\n        type: "texto"\r\n      - name: "REF5"\r\n        type: "texto"\r\n      - name: "REF6"\r\n        type: "texto"\r\n      - name: "REF7"\r\n        type: "texto"\r\n      - name: "REF8"\r\n        type: "texto"\r\n      - name: "REF9"\r\n        type: "texto"\r\n      - name: "REF10"\r\n        type: "texto"\r\n\r\n  productos:\r\n    name: "Catálogo de Productos"\r\n    description: "Definición del archivo productos.csv con datos maestros de productos."\r\n    filename: "productos.csv"\r\n    file_format:\r\n      type: "CSV"\r\n      delimiter: "|"\r\n      header: false\r\n    fields:\r\n      - name: "CodigoProveedor"\r\n        type: "texto"\r\n      - name: "CodigoDistribuidor"\r\n        type: "texto"\r\n      - name: "CodigoProducto"\r\n        type: "texto"\r\n        unique: true\r\n      - name: "NombreProducto"\r\n        type: "texto"\r\n      - name: "EAN"\r\n        type: "texto"\r\n      - name: "DUN"\r\n        type: "texto"\r\n      - name: "FactorCaja"\r\n        type: "entero"\r\n      - name: "Peso"\r\n        type: "decimal"\r\n      - name: "FlagBonificado"\r\n        type: "texto"\r\n      - name: "Afecto"\r\n        type: "texto"\r\n      - name: "PrecioCompra"\r\n        type: "decimal"\r\n      - name: "PrecioSugerido"\r\n        type: "decimal"\r\n      - name: "PrecioPromedio"\r\n        type: "decimal"\r\n      - name: "FechaProceso"\r\n        type: "fecha"\r\n      - name: "REF1"\r\n        type: "texto"\r\n      - name: "REF2"\r\n        type: "texto"\r\n      - name: "REF3"\r\n        type: "texto"\r\n      - name: "REF4"\r\n        type: "texto"\r\n      - name: "REF5"\r\n        type: "texto"\r\n      - name: "REF6"\r\n        type: "texto"\r\n      - name: "REF7"\r\n        type: "texto"\r\n      - name: "REF8"\r\n        type: "texto"\r\n      - name: "REF9"\r\n        type: "texto"\r\n      - name: "REF10"\r\n        type: "texto"\r\n\r\n  stock:\r\n    name: "Catálogo de Stock"\r\n    description: "Definición del archivo stock.csv con información de inventario."\r\n    filename: "stock.csv"\r\n    file_format:\r\n      type: "CSV"\r\n      delimiter: "|"\r\n      header: false\r\n    fields:\r\n      - name: "CodigoProveedor"\r\n        type: "texto"\r\n      - name: "CodigoDistribuidor"\r\n        type: "texto"\r\n      - name: "CodigoAlmacen"\r\n        type: "texto"\r\n      - name: "NombreAlmacen"\r\n        type: "texto"\r\n      - name: "CodigoProducto"\r\n        type: "texto"\r\n      - name: "Lote"\r\n        type: "texto"\r\n      - name: "FechaVencimiento"\r\n        type: "fecha"\r\n      - name: "StockEnUnidadMinima"\r\n        type: "decimal"\r\n      - name: "UnidadDeMedidaMinima"\r\n        type: "texto"\r\n      - name: "StockEnUnidadesMaximas"\r\n        type: "decimal"\r\n      - name: "UnidadDeMedidaMaxima"\r\n        type: "texto"\r\n      - name: "ValorStock"\r\n        type: "decimal"\r\n      - name: "FechaProceso"\r\n        type: "fecha"\r\n      - name: "IngresosEnUnidadDeConsumo"\r\n        type: "decimal"\r\n      - name: "ValorIngresos"\r\n        type: "decimal"\r\n      - name: "VentasEnUnidadDeConsumo"\r\n        type: "decimal"\r\n      - name: "ValorVentas"\r\n        type: "decimal"\r\n      - name: "OtrosEnUnidadDeConsumo"\r\n        type: "decimal"\r\n      - name: "ValorOtros"\r\n        type: "decimal"\r\n      - name: "Periodo"\r\n        type: "entero"\r\n      - name: "REF1"\r\n        type: "texto"\r\n      - name: "REF2"\r\n        type: "texto"\r\n      - name: "REF3"\r\n        type: "texto"\r\n      - name: "REF4"\r\n        type: "texto"\r\n      - name: "REF5"\r\n        type: "texto"\r\n      - name: "REF6"\r\n        type: "texto"\r\n      - name: "REF7"\r\n        type: "texto"\r\n      - name: "REF8"\r\n        type: "texto"\r\n      - name: "REF9"\r\n        type: "texto"\r\n      - name: "REF10"\r\n        type: "texto"\r\n\r\n  vendedores:\r\n    name: "Catálogo de Vendedores"\r\n    description: "Definición del archivo vendedores.csv con datos maestros de vendedores."\r\n    filename: "vendedores.csv"\r\n    file_format:\r\n      type: "CSV"\r\n      delimiter: "|"\r\n      header: false\r\n    fields:\r\n      - name: "CodigoProveedor"\r\n        type: "texto"\r\n      - name: "CodigoDistribuidor"\r\n        type: "texto"\r\n      - name: "CodigoVendedor"\r\n        type: "texto"\r\n        unique: true\r\n      - name: "NombreVendedor"\r\n        type: "texto"\r\n      - name: "TipoDocumento"\r\n        type: "texto"\r\n      - name: "DI"\r\n        type: "texto"\r\n      - name: "Canal"\r\n        type: "texto"\r\n      - name: "FechaIngreso"\r\n        type: "fecha"\r\n      - name: "FechaActualizacion"\r\n        type: "fecha"\r\n      - name: "FechaProceso"\r\n        type: "fecha"\r\n      - name: "Exclusivo"\r\n        type: "texto"\r\n      - name: "CodigoSupervisor"\r\n        type: "texto"\r\n      - name: "NombreSupervisor"\r\n        type: "texto"\r\n      - name: "CRutaLogica"\r\n        type: "texto"\r\n      - name: "CLineaLogica"\r\n        type: "texto"\r\n      - name: "EstadoVendedor"\r\n        type: "texto"\r\n      - name: "ZonaVendedor"\r\n        type: "texto"\r\n      - name: "REF3"\r\n        type: "texto"\r\n      - name: "REF4"\r\n        type: "texto"\r\n      - name: "REF5"\r\n        type: "texto"\r\n      - name: "REF6"\r\n        type: "texto"\r\n      - name: "REF7"\r\n        type: "texto"\r\n      - name: "REF8"\r\n        type: "texto"\r\n      - name: "REF9"\r\n        type: "texto"\r\n      - name: "REF10"\r\n        type: "texto"\r\n\r\n  ventas:\r\n    name: "Catálogo de Ventas"\r\n    description: "Definición del archivo ventas.csv con información de transacciones de ventas."\r\n    filename: "ventas.csv"\r\n    file_format:\r\n      type: "CSV"\r\n      delimiter: "|"\r\n      header: false\r\n    fields:\r\n      - name: "CodigoProveedor"\r\n        type: "texto"\r\n      - name: "CodigoDistribuidor"\r\n        type: "texto"\r\n      - name: "TipoDocumento"\r\n        type: "texto"\r\n      - name: "NroDocumento"\r\n        type: "texto"\r\n      - name: "FechaDocumento"\r\n        type: "fecha"\r\n      - name: "MotivoNC"\r\n        type: "texto"\r\n      - name: "Origen"\r\n        type: "texto"\r\n      - name: "CodigoCliente"\r\n        type: "texto"\r\n      - name: "CanalCliente"\r\n        type: "texto"\r\n      - name: "TipoNegocio"\r\n        type: "texto"\r\n      - name: "CodigoVendedor"\r\n        type: "texto"\r\n      - name: "CanalVendedor"\r\n        type: "texto"\r\n      - name: "Ruta"\r\n        type: "texto"\r\n      - name: "NumeroItem"\r\n        type: "entero"\r\n      - name: "CodigoProducto"\r\n        type: "texto"\r\n      - name: "CantidadUnidadMinima"\r\n        type: "decimal"\r\n      - name: "TipoUnidadMinima"\r\n        type: "texto"\r\n      - name: "CantidadUnidadMaxima"\r\n        type: "decimal"\r\n      - name: "TipoUnidadMaxima"\r\n        type: "texto"\r\n      - name: "Moneda"\r\n        type: "texto"\r\n      - name: "ImporteNetoSinImpuesto"\r\n        type: "decimal"\r\n      - name: "ImporteNetoConImpuesto"\r\n        type: "decimal"\r\n      - name: "Descuento"\r\n        type: "decimal"\r\n      - name: "TipoVenta"\r\n        type: "texto"\r\n      - name: "CodCombo"\r\n        type: "texto"\r\n      - name: "CodPromocion"\r\n        type: "texto"\r\n      - name: "TipoDocumentoReferencia"\r\n        type: "texto"\r\n      - name: "NroDocumentoReferencia"\r\n        type: "texto"\r\n      - name: "FechaDocumentoReferencia"\r\n        type: "fecha"\r\n      - name: "FechaProceso"\r\n        type: "fecha"\r\n      - name: "DescripcionPromocion"\r\n        type: "texto"\r\n      - name: "REF2"\r\n        type: "texto"\r\n      - name: "REF3"\r\n        type: "texto"\r\n      - name: "REF4"\r\n        type: "texto"\r\n      - name: "ZonaVendedor"\r\n        type: "texto"\r\n      - name: "REF6"\r\n        type: "texto"\r\n      - name: "REF7"\r\n        type: "texto"\r\n      - name: "REF8"\r\n        type: "texto"\r\n      - name: "REF9"\r\n        type: "texto"\r\n      - name: "REF10"\r\n        type: "texto"\r\n\r\n  pedidos:\r\n    name: "Catálogo de Pedidos"\r\n    description: "Definición del archivo pedidos.csv con información de pedidos."\r\n    filename: "pedidos.csv"\r\n    file_format:\r\n      type: "CSV"\r\n      delimiter: "|"\r\n      header: false\r\n    fields:\r\n      - name: "CodigoProveedor"\r\n        type: "texto"\r\n      - name: "CodigoDistribuidor"\r\n        type: "texto"\r\n      - name: "CodigoCliente"\r\n        type: "texto"\r\n      - name: "CodigoVendedor"\r\n        type: "texto"\r\n      - name: "Origen"\r\n        type: "texto"\r\n      - name: "CodigoPedido"\r\n        type: "texto"\r\n      - name: "FechaPedido"\r\n        type: "fecha"\r\n      - name: "EstatusPedido"\r\n        type: "texto"\r\n      - name: "MotivoCancelacion"\r\n        type: "texto"\r\n      - name: "TipoDocumento"\r\n        type: "texto"\r\n      - name: "Documento"\r\n        type: "texto"\r\n      - name: "FechaDocumento"\r\n        type: "fecha"\r\n      - name: "EstatusDocumento"\r\n        type: "texto"\r\n      - name: "NumeroItem"\r\n        type: "entero"\r\n      - name: "CodigoProducto"\r\n        type: "texto"\r\n      - name: "TipoProducto"\r\n        type: "texto"\r\n      - name: "CantidadUnidadMinima"\r\n        type: "decimal"\r\n      - name: "TipoUnidadMinima"\r\n        type: "texto"\r\n      - name: "CantidadUnidadMaxima"\r\n        type: "decimal"\r\n      - name: "TipoUnidadMaxima"\r\n        type: "texto"\r\n      - name: "ImportePedidoNetoSinImpuesto"\r\n        type: "decimal"\r\n      - name: "ImportePedidoNetoConImpuesto"\r\n        type: "decimal"\r\n      - name: "Descuento"\r\n        type: "decimal"\r\n      - name: "FechaProceso"\r\n        type: "fecha"\r\n      - name: "REF1"\r\n        type: "texto"\r\n      - name: "CodCombo"\r\n        type: "texto"\r\n      - name: "ZonaVendedor"\r\n        type: "texto"\r\n      - name: "REF4"\r\n        type: "texto"\r\n      - name: "REF5"\r\n        type: "texto"\r\n      - name: "REF6"\r\n        type: "texto"\r\n      - name: "REF7"\r\n        type: "texto"\r\n      - name: "REF8"\r\n        type: "texto"\r\n      - name: "REF9"\r\n        type: "texto"\r\n      - name: "REF10"\r\n        type: "texto"\r\n\r\n  rutas:\r\n    name: "Catálogo de Rutas"\r\n    description: "Definición del archivo rutas.csv con información de rutas y visitas."\r\n    filename: "rutas.csv"\r\n    file_format:\r\n      type: "CSV"\r\n      delimiter: "|"\r\n      header: false\r\n    fields:\r\n      - name: "CodigoProveedor"\r\n        type: "texto"\r\n      - name: "CodigoDistribuidor"\r\n        type: "texto"\r\n      - name: "CodigoCliente"\r\n        type: "texto"\r\n      - name: "CodigoVendedor"\r\n        type: "texto"\r\n      - name: "FuerzaDeVenta"\r\n        type: "texto"\r\n      - name: "FrecuenciaVisita"\r\n        type: "texto"\r\n      - name: "Zona"\r\n        type: "texto"\r\n      - name: "Mesa"\r\n        type: "texto"\r\n      - name: "Ruta"\r\n        type: "texto"\r\n      - name: "Modulo"\r\n        type: "texto"\r\n      - name: "FechaProceso"\r\n        type: "fecha"\r\n      - name: "ZonaVendedor"\r\n        type: "texto"\r\n      - name: "REF2"\r\n        type: "texto"\r\n      - name: "REF3"\r\n        type: "texto"\r\n      - name: "REF4"\r\n        type: "texto"\r\n      - name: "REF5"\r\n        type: "texto"\r\n      - name: "REF6"\r\n        type: "texto"\r\n      - name: "REF7"\r\n        type: "texto"\r\n      - name: "REF8"\r\n        type: "texto"\r\n      - name: "REF9"\r\n        type: "texto"\r\n      - name: "REF10"\r\n        type: "texto"\r\n\r\npackages:\r\n  paquete_bi_clorox:\r\n    name: "Paquete BI CLOROX"\r\n    description: "Paquete que agrupa los 7 catálogos del Proyecto BI CLOROX en un archivo ZIP."\r\n    file_format:\r\n      type: "ZIP"\r\n    catalogs:\r\n      - clientes\r\n      - productos\r\n      - stock\r\n      - vendedores\r\n      - ventas\r\n      - pedidos\r\n      - rutas\r\n    package_validation:\r\n      - name: "Validación de integridad de claves"\r\n        description: "¡Ups! Verifica que no existan códigos en transacciones (Ventas, Pedidos, Rutas) que no estén presentes en los catálogos maestros correspondientes 😊"\r\n        rule: "df['ventas']['CodigoCliente'].isin(df['clientes']['CodigoCliente']) and df['pedidos']['CodigoCliente'].isin(df['clientes']['CodigoCliente']) and df['ventas']['CodigoProducto'].isin(df['productos']['CodigoProducto']) and df['pedidos']['CodigoProducto'].isin(df['productos']['CodigoProducto']) and df['ventas']['CodigoVendedor'].isin(df['vendedores']['CodigoVendedor'])"\r\n        severity: "error"\r\n
45	1	configuracion (2).yaml	casilla45@sage.vidahub.ai	\N	\N	2025-03-19 19:19:28.282037	t	Proyecto BI CLOROX - Definición SAGE	YAML de configuración para la validación y estructura de los archivos maestros y transaccionales del Proyecto BI CLOROX.	sage_yaml:\n  name: "Proyecto BI CLOROX - Definición SAGE"\n  description: "YAML de configuración para la validación y estructura de los archivos maestros y transaccionales del Proyecto BI CLOROX."\n  version: "1.0.0"\n  author: "Equipo de Integración"\n  comments: "Configuración generada según especificaciones y reglas definidas por el usuario."\n\ncatalogs:\n  clientes:\n    name: "Catálogo de Clientes"\n    description: "Definición del archivo clientes.csv con datos maestros de clientes."\n    filename: "clientes.csv"\n    file_format:\n      type: "CSV"\n      delimiter: "|"\n      header: false\n    fields:\n      - name: "CodigoProveedor"\n        type: "texto"\n      - name: "CodigoDistribuidor"\n        type: "texto"\n      - name: "CodigoCliente"\n        type: "texto"\n        unique: true\n        validation_rules:\n          - name: "Sin espacios en blanco"\n            description: "¡Atención! El código de cliente no debe contener espacios en blanco. Revisa y corrige 📝"\n            rule: "df['CodigoCliente'].str.match('^\\\\S+$')"\n            severity: "error"\n      - name: "NombreCliente"\n        type: "texto"\n      - name: "TipoDocumento"\n        type: "texto"\n      - name: "DNI"\n        type: "texto"\n      - name: "Direccion"\n        type: "texto"\n      - name: "Mercado"\n        type: "texto"\n      - name: "Modulo"\n        type: "texto"\n      - name: "Canal"\n        type: "texto"\n      - name: "GiroNegocio"\n        type: "texto"\n      - name: "SubGiroNegocio"\n        type: "texto"\n      - name: "Ubigeo"\n        type: "texto"\n      - name: "Distrito"\n        type: "texto"\n      - name: "Estatus"\n        type: "texto"\n        validation_rules:\n          - name: "Valor de Estatus"\n            description: "¡Atención! El estatus debe ser A (Activo), I (Inactivo) o T (Temporal) 😊"\n            rule: "df['Estatus'].isin(['A','I','T'])"\n            severity: "error"\n      - name: "X"\n        type: "decimal"\n      - name: "Y"\n        type: "decimal"\n      - name: "CodigoPadre"\n        type: "texto"\n      - name: "FechaIngreso"\n        type: "fecha"\n      - name: "FechaActualizacion"\n        type: "fecha"\n      - name: "FechaProceso"\n        type: "fecha"\n      - name: "REF1"\n        type: "texto"\n      - name: "REF2"\n        type: "texto"\n      - name: "REF3"\n        type: "texto"\n      - name: "REF4"\n        type: "texto"\n      - name: "REF5"\n        type: "texto"\n      - name: "REF6"\n        type: "texto"\n      - name: "REF7"\n        type: "texto"\n      - name: "REF8"\n        type: "texto"\n      - name: "REF9"\n        type: "texto"\n      - name: "REF10"\n        type: "texto"\n\n  productos:\n    name: "Catálogo de Productos"\n    description: "Definición del archivo productos.csv con datos maestros de productos."\n    filename: "productos.csv"\n    file_format:\n      type: "CSV"\n      delimiter: "|"\n      header: false\n    fields:\n      - name: "CodigoProveedor"\n        type: "texto"\n      - name: "CodigoDistribuidor"\n        type: "texto"\n      - name: "CodigoProducto"\n        type: "texto"\n        unique: true\n      - name: "NombreProducto"\n        type: "texto"\n      - name: "EAN"\n        type: "texto"\n      - name: "DUN"\n        type: "texto"\n      - name: "FactorCaja"\n        type: "entero"\n      - name: "Peso"\n        type: "decimal"\n      - name: "FlagBonificado"\n        type: "texto"\n      - name: "Afecto"\n        type: "texto"\n      - name: "PrecioCompra"\n        type: "decimal"\n      - name: "PrecioSugerido"\n        type: "decimal"\n      - name: "PrecioPromedio"\n        type: "decimal"\n      - name: "FechaProceso"\n        type: "fecha"\n      - name: "REF1"\n        type: "texto"\n      - name: "REF2"\n        type: "texto"\n      - name: "REF3"\n        type: "texto"\n      - name: "REF4"\n        type: "texto"\n      - name: "REF5"\n        type: "texto"\n      - name: "REF6"\n        type: "texto"\n      - name: "REF7"\n        type: "texto"\n      - name: "REF8"\n        type: "texto"\n      - name: "REF9"\n        type: "texto"\n      - name: "REF10"\n        type: "texto"\n\n  stock:\n    name: "Catálogo de Stock"\n    description: "Definición del archivo stock.csv con información de inventario."\n    filename: "stock.csv"\n    file_format:\n      type: "CSV"\n      delimiter: "|"\n      header: false\n    fields:\n      - name: "CodigoProveedor"\n        type: "texto"\n      - name: "CodigoDistribuidor"\n        type: "texto"\n      - name: "CodigoAlmacen"\n        type: "texto"\n      - name: "NombreAlmacen"\n        type: "texto"\n      - name: "CodigoProducto"\n        type: "texto"\n      - name: "Lote"\n        type: "texto"\n      - name: "FechaVencimiento"\n        type: "fecha"\n      - name: "StockEnUnidadMinima"\n        type: "decimal"\n      - name: "UnidadDeMedidaMinima"\n        type: "texto"\n      - name: "StockEnUnidadesMaximas"\n        type: "decimal"\n      - name: "UnidadDeMedidaMaxima"\n        type: "texto"\n      - name: "ValorStock"\n        type: "decimal"\n      - name: "FechaProceso"\n        type: "fecha"\n      - name: "IngresosEnUnidadDeConsumo"\n        type: "decimal"\n      - name: "ValorIngresos"\n        type: "decimal"\n      - name: "VentasEnUnidadDeConsumo"\n        type: "decimal"\n      - name: "ValorVentas"\n        type: "decimal"\n      - name: "OtrosEnUnidadDeConsumo"\n        type: "decimal"\n      - name: "ValorOtros"\n        type: "decimal"\n      - name: "Periodo"\n        type: "entero"\n      - name: "REF1"\n        type: "texto"\n      - name: "REF2"\n        type: "texto"\n      - name: "REF3"\n        type: "texto"\n      - name: "REF4"\n        type: "texto"\n      - name: "REF5"\n        type: "texto"\n      - name: "REF6"\n        type: "texto"\n      - name: "REF7"\n        type: "texto"\n      - name: "REF8"\n        type: "texto"\n      - name: "REF9"\n        type: "texto"\n      - name: "REF10"\n        type: "texto"\n\n  vendedores:\n    name: "Catálogo de Vendedores"\n    description: "Definición del archivo vendedores.csv con datos maestros de vendedores."\n    filename: "vendedores.csv"\n    file_format:\n      type: "CSV"\n      delimiter: "|"\n      header: false\n    fields:\n      - name: "CodigoProveedor"\n        type: "texto"\n      - name: "CodigoDistribuidor"\n        type: "texto"\n      - name: "CodigoVendedor"\n        type: "texto"\n        unique: true\n      - name: "NombreVendedor"\n        type: "texto"\n      - name: "TipoDocumento"\n        type: "texto"\n      - name: "DI"\n        type: "texto"\n      - name: "Canal"\n        type: "texto"\n      - name: "FechaIngreso"\n        type: "fecha"\n      - name: "FechaActualizacion"\n        type: "fecha"\n      - name: "FechaProceso"\n        type: "fecha"\n      - name: "Exclusivo"\n        type: "texto"\n      - name: "CodigoSupervisor"\n        type: "texto"\n      - name: "NombreSupervisor"\n        type: "texto"\n      - name: "CRutaLogica"\n        type: "texto"\n      - name: "CLineaLogica"\n        type: "texto"\n      - name: "EstadoVendedor"\n        type: "texto"\n      - name: "ZonaVendedor"\n        type: "texto"\n      - name: "REF3"\n        type: "texto"\n      - name: "REF4"\n        type: "texto"\n      - name: "REF5"\n        type: "texto"\n      - name: "REF6"\n        type: "texto"\n      - name: "REF7"\n        type: "texto"\n      - name: "REF8"\n        type: "texto"\n      - name: "REF9"\n        type: "texto"\n      - name: "REF10"\n        type: "texto"\n\n  ventas:\n    name: "Catálogo de Ventas"\n    description: "Definición del archivo ventas.csv con información de transacciones de ventas."\n    filename: "ventas.csv"\n    file_format:\n      type: "CSV"\n      delimiter: "|"\n      header: false\n    fields:\n      - name: "CodigoProveedor"\n        type: "texto"\n      - name: "CodigoDistribuidor"\n        type: "texto"\n      - name: "TipoDocumento"\n        type: "texto"\n      - name: "NroDocumento"\n        type: "texto"\n      - name: "FechaDocumento"\n        type: "fecha"\n      - name: "MotivoNC"\n        type: "texto"\n      - name: "Origen"\n        type: "texto"\n      - name: "CodigoCliente"\n        type: "texto"\n      - name: "CanalCliente"\n        type: "texto"\n      - name: "TipoNegocio"\n        type: "texto"\n      - name: "CodigoVendedor"\n        type: "texto"\n      - name: "CanalVendedor"\n        type: "texto"\n      - name: "Ruta"\n        type: "texto"\n      - name: "NumeroItem"\n        type: "entero"\n      - name: "CodigoProducto"\n        type: "texto"\n      - name: "CantidadUnidadMinima"\n        type: "decimal"\n      - name: "TipoUnidadMinima"\n        type: "texto"\n      - name: "CantidadUnidadMaxima"\n        type: "decimal"\n      - name: "TipoUnidadMaxima"\n        type: "texto"\n      - name: "Moneda"\n        type: "texto"\n      - name: "ImporteNetoSinImpuesto"\n        type: "decimal"\n      - name: "ImporteNetoConImpuesto"\n        type: "decimal"\n      - name: "Descuento"\n        type: "decimal"\n      - name: "TipoVenta"\n        type: "texto"\n      - name: "CodCombo"\n        type: "texto"\n      - name: "CodPromocion"\n        type: "texto"\n      - name: "TipoDocumentoReferencia"\n        type: "texto"\n      - name: "NroDocumentoReferencia"\n        type: "texto"\n      - name: "FechaDocumentoReferencia"\n        type: "fecha"\n      - name: "FechaProceso"\n        type: "fecha"\n      - name: "DescripcionPromocion"\n        type: "texto"\n      - name: "REF2"\n        type: "texto"\n      - name: "REF3"\n        type: "texto"\n      - name: "REF4"\n        type: "texto"\n      - name: "ZonaVendedor"\n        type: "texto"\n      - name: "REF6"\n        type: "texto"\n      - name: "REF7"\n        type: "texto"\n      - name: "REF8"\n        type: "texto"\n      - name: "REF9"\n        type: "texto"\n      - name: "REF10"\n        type: "texto"\n\n  pedidos:\n    name: "Catálogo de Pedidos"\n    description: "Definición del archivo pedidos.csv con información de pedidos."\n    filename: "pedidos.csv"\n    file_format:\n      type: "CSV"\n      delimiter: "|"\n      header: false\n    fields:\n      - name: "CodigoProveedor"\n        type: "texto"\n      - name: "CodigoDistribuidor"\n        type: "texto"\n      - name: "CodigoCliente"\n        type: "texto"\n      - name: "CodigoVendedor"\n        type: "texto"\n      - name: "Origen"\n        type: "texto"\n      - name: "CodigoPedido"\n        type: "texto"\n      - name: "FechaPedido"\n        type: "fecha"\n      - name: "EstatusPedido"\n        type: "texto"\n      - name: "MotivoCancelacion"\n        type: "texto"\n      - name: "TipoDocumento"\n        type: "texto"\n      - name: "Documento"\n        type: "texto"\n      - name: "FechaDocumento"\n        type: "fecha"\n      - name: "EstatusDocumento"\n        type: "texto"\n      - name: "NumeroItem"\n        type: "entero"\n      - name: "CodigoProducto"\n        type: "texto"\n      - name: "TipoProducto"\n        type: "texto"\n      - name: "CantidadUnidadMinima"\n        type: "decimal"\n      - name: "TipoUnidadMinima"\n        type: "texto"\n      - name: "CantidadUnidadMaxima"\n        type: "decimal"\n      - name: "TipoUnidadMaxima"\n        type: "texto"\n      - name: "ImportePedidoNetoSinImpuesto"\n        type: "decimal"\n      - name: "ImportePedidoNetoConImpuesto"\n        type: "decimal"\n      - name: "Descuento"\n        type: "decimal"\n      - name: "FechaProceso"\n        type: "fecha"\n      - name: "REF1"\n        type: "texto"\n      - name: "CodCombo"\n        type: "texto"\n      - name: "ZonaVendedor"\n        type: "texto"\n      - name: "REF4"\n        type: "texto"\n      - name: "REF5"\n        type: "texto"\n      - name: "REF6"\n        type: "texto"\n      - name: "REF7"\n        type: "texto"\n      - name: "REF8"\n        type: "texto"\n      - name: "REF9"\n        type: "texto"\n      - name: "REF10"\n        type: "texto"\n\n  rutas:\n    name: "Catálogo de Rutas"\n    description: "Definición del archivo rutas.csv con información de rutas y visitas."\n    filename: "rutas.csv"\n    file_format:\n      type: "CSV"\n      delimiter: "|"\n      header: false\n    fields:\n      - name: "CodigoProveedor"\n        type: "texto"\n      - name: "CodigoDistribuidor"\n        type: "texto"\n      - name: "CodigoCliente"\n        type: "texto"\n      - name: "CodigoVendedor"\n        type: "texto"\n      - name: "FuerzaDeVenta"\n        type: "texto"\n      - name: "FrecuenciaVisita"\n        type: "texto"\n      - name: "Zona"\n        type: "texto"\n      - name: "Mesa"\n        type: "texto"\n      - name: "Ruta"\n        type: "texto"\n      - name: "Modulo"\n        type: "texto"\n      - name: "FechaProceso"\n        type: "fecha"\n      - name: "ZonaVendedor"\n        type: "texto"\n      - name: "REF2"\n        type: "texto"\n      - name: "REF3"\n        type: "texto"\n      - name: "REF4"\n        type: "texto"\n      - name: "REF5"\n        type: "texto"\n      - name: "REF6"\n        type: "texto"\n      - name: "REF7"\n        type: "texto"\n      - name: "REF8"\n        type: "texto"\n      - name: "REF9"\n        type: "texto"\n      - name: "REF10"\n        type: "texto"\n\npackages:\n  paquete_bi_clorox:\n    name: "Paquete BI CLOROX"\n    description: "Paquete que agrupa los 7 catálogos del Proyecto BI CLOROX en un archivo ZIP."\n    file_format:\n      type: "ZIP"\n    catalogs:\n      - clientes\n      - productos\n      - stock\n      - vendedores\n      - ventas\n      - pedidos\n      - rutas\n    package_validation:\n      - name: "Validación de integridad de claves"\n        description: "¡Ups! Verifica que no existan códigos en transacciones (Ventas, Pedidos, Rutas) que no estén presentes en los catálogos maestros correspondientes 😊"\n        rule: "df['ventas']['CodigoCliente'].isin(df['clientes']['CodigoCliente']) and df['pedidos']['CodigoCliente'].isin(df['clientes']['CodigoCliente']) and df['ventas']['CodigoProducto'].isin(df['productos']['CodigoProducto']) and df['pedidos']['CodigoProducto'].isin(df['productos']['CodigoProducto']) and df['ventas']['CodigoVendedor'].isin(df['vendedores']['CodigoVendedor'])"\n        severity: "error"\n
55	6	CloroxGenerico.yaml	\N	\N	\N	2025-03-30 13:46:20.245898	t	cloroxGenerico.yaml	Gestión de ventas de una distribuidora de Clorox	sage_yaml:\n  name: "cloroxGenerico.yaml"\n  description: "Gestión de ventas de una distribuidora de Clorox"\n  version: "1.0.0"\n  author: "Distribuidora Clorox"\n  comments: "Este archivo describe la estructura de datos para la gestión de ventas, rutas, vendedores, stock, etc."\n\ncatalogs:\n  clientes:\n    name: "Catálogo de Clientes"\n    description: "Información sobre los clientes de la distribuidora"\n    filename: "clientes.csv"\n    file_format:\n      type: "CSV"\n      delimiter: "|"\n      header: false\n    fields:\n      - name: "codigo_distribuidora"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "codigo_cliente"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "nombre_cliente"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "tipo_documento"\n        type: "texto"\n        required: false\n        unique: false\n      - name: "direccion"\n        type: "texto"\n        required: false\n        unique: false\n      - name: "tipo_cliente"\n        type: "texto"\n        required: false\n        unique: false\n      - name: "ubicacion"\n        type: "texto"\n        required: false\n        unique: false\n      - name: "fecha_creacion"\n        type: "fecha"\n        required: false\n        unique: false\n      - name: "fecha_actualizacion"\n        type: "fecha"\n        required: false\n        unique: false\n      - name: "estado"\n        type: "texto"\n        required: false\n        unique: false\n\n  pedidos:\n    name: "Catálogo de Pedidos"\n    description: "Registro de pedidos realizados por los clientes"\n    filename: "pedidos.csv"\n    file_format:\n      type: "CSV"\n      delimiter: "|"\n      header: false\n    fields:\n      - name: "codigo_distribuidora"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "codigo_pedido"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "fecha_pedido"\n        type: "fecha"\n        required: true\n        unique: false\n      - name: "estado_pedido"\n        type: "texto"\n        required: false\n        unique: false\n      - name: "tipo_documento"\n        type: "texto"\n        required: false\n        unique: false\n      - name: "codigo_producto"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "cantidad"\n        type: "decimal"\n        required: true\n        unique: false\n      - name: "unidad_medida"\n        type: "texto"\n        required: false\n        unique: false\n      - name: "precio_unitario"\n        type: "decimal"\n        required: true\n        unique: false\n      - name: "total"\n        type: "decimal"\n        required: true\n        unique: false\n\n  productos:\n    name: "Catálogo de Productos"\n    description: "Detalles de los productos disponibles"\n    filename: "productos.csv"\n    file_format:\n      type: "CSV"\n      delimiter: "|"\n      header: false\n    fields:\n      - name: "codigo_distribuidora"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "codigo_producto"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "nombre_producto"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "cantidad_por_paquete"\n        type: "entero"\n        required: false\n        unique: false\n      - name: "precio_unitario"\n        type: "decimal"\n        required: true\n        unique: false\n      - name: "estado"\n        type: "texto"\n        required: false\n        unique: false\n\n  rutas:\n    name: "Catálogo de Rutas"\n    description: "Información sobre las rutas de distribución"\n    filename: "rutas.csv"\n    file_format:\n      type: "CSV"\n      delimiter: "|"\n      header: false\n    fields:\n      - name: "codigo_distribuidora"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "codigo_ruta"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "descripcion_ruta"\n        type: "texto"\n        required: false\n        unique: false\n      - name: "fecha_creacion"\n        type: "fecha"\n        required: false\n        unique: false\n\n  stock:\n    name: "Catálogo de Stock"\n    description: "Registro del stock disponible en almacenes"\n    filename: "stock.csv"\n    file_format:\n      type: "CSV"\n      delimiter: "|"\n      header: false\n    fields:\n      - name: "codigo_distribuidora"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "codigo_almacen"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "codigo_producto"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "cantidad_disponible"\n        type: "decimal"\n        required: true\n        unique: false\n      - name: "unidad_medida"\n        type: "texto"\n        required: false\n        unique: false\n      - name: "fecha_actualizacion"\n        type: "fecha"\n        required: false\n        unique: false\n\n  vendedores:\n    name: "Catálogo de Vendedores"\n    description: "Información sobre los vendedores de la distribuidora"\n    filename: "vendedores.csv"\n    file_format:\n      type: "CSV"\n      delimiter: "|"\n      header: false\n    fields:\n      - name: "codigo_distribuidora"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "codigo_vendedor"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "nombre_vendedor"\n        type: "texto"\n        required: false\n        unique: false\n      - name: "zona"\n        type: "texto"\n        required: false\n        unique: false\n\n  ventas:\n    name: "Catálogo de Ventas"\n    description: "Registro de ventas realizadas"\n    filename: "ventas.csv"\n    file_format:\n      type: "CSV"\n      delimiter: "|"\n      header: false\n    fields:\n      - name: "codigo_distribuidora"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "codigo_venta"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "fecha_venta"\n        type: "fecha"\n        required: true\n        unique: false\n      - name: "codigo_cliente"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "codigo_producto"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "cantidad_vendida"\n        type: "decimal"\n        required: true\n        unique: false\n      - name: "precio_total"\n        type: "decimal"\n        required: true\n        unique: false\n\npackages:\n  clorox_package:\n    name: "Paquete de Datos Clorox"\n    description: "Paquete que agrupa todos los catálogos relacionados con la gestión de Clorox"\n    file_format:\n      type: "ZIP"\n    catalogs:\n      - clientes\n      - pedidos\n      - productos\n      - rutas\n      - stock\n      - vendedores\n      - ventas\n    package_validation:\n      - name: "Validación de Clientes en Ventas"\n        description: "¡Ups! Algunos clientes en ventas no existen en el catálogo de clientes 🤔"\n        rule: "df['ventas']['codigo_cliente'].isin(df['clientes']['codigo_cliente'])"\n        severity: "error"\n      - name: "Validación de Productos en Ventas"\n        description: "¡Ups! Algunos productos en ventas no existen en el catálogo de productos 🔍"\n        rule: "df['ventas']['codigo_producto'].isin(df['productos']['codigo_producto'])"\n        severity: "error"
61	4	CloroxGenerico_fixed.yaml	\N	\N	\N	2025-04-01 21:26:55.329553	t	cloroxGenerico.yaml	Gestión de ventas de una distribuidora de Clorox	sage_yaml:\n  name: "cloroxGenerico.yaml"\n  description: "Gestión de ventas de una distribuidora de Clorox"\n  version: "1.0.0"\n  author: "Distribuidora Clorox"\n  comments: "Este archivo describe la estructura de datos para la gestión de ventas, rutas, vendedores, stock, etc."\n\ncatalogs:\n  clientes:\n    name: "Catálogo de Clientes"\n    description: "Información sobre los clientes de la distribuidora"\n    filename: "clientes.csv"\n    file_format:\n      type: "CSV"\n      delimiter: "|"\n      encoding: "utf-8-sig"\n      header: false\n    fields:\n      - name: "codigo_distribuidora"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "codigo_cliente"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "nombre_cliente"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "tipo_documento"\n        type: "texto"\n        required: false\n        unique: false\n      - name: "direccion"\n        type: "texto"\n        required: false\n        unique: false\n      - name: "tipo_cliente"\n        type: "texto"\n        required: false\n        unique: false\n      - name: "ubicacion"\n        type: "texto"\n        required: false\n        unique: false\n      - name: "fecha_creacion"\n        type: "fecha"\n        required: false\n        unique: false\n      - name: "fecha_actualizacion"\n        type: "fecha"\n        required: false\n        unique: false\n      - name: "estado"\n        type: "texto"\n        required: false\n        unique: false\n\n  pedidos:\n    name: "Catálogo de Pedidos"\n    description: "Registro de pedidos realizados por los clientes"\n    filename: "pedidos.csv"\n    file_format:\n      type: "CSV"\n      delimiter: "|"\n      encoding: "utf-8-sig"\n      header: false\n    fields:\n      - name: "codigo_distribuidora"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "codigo_pedido"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "fecha_pedido"\n        type: "fecha"\n        required: true\n        unique: false\n      - name: "estado_pedido"\n        type: "texto"\n        required: false\n        unique: false\n      - name: "tipo_documento"\n        type: "texto"\n        required: false\n        unique: false\n      - name: "codigo_producto"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "cantidad"\n        type: "decimal"\n        required: true\n        unique: false\n      - name: "unidad_medida"\n        type: "texto"\n        required: false\n        unique: false\n      - name: "precio_unitario"\n        type: "decimal"\n        required: true\n        unique: false\n      - name: "total"\n        type: "decimal"\n        required: true\n        unique: false\n\n  productos:\n    name: "Catálogo de Productos"\n    description: "Detalles de los productos disponibles"\n    filename: "productos.csv"\n    file_format:\n      type: "CSV"\n      delimiter: "|"\n      encoding: "utf-8-sig"\n      header: false\n    fields:\n      - name: "codigo_distribuidora"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "codigo_producto"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "nombre_producto"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "cantidad_por_paquete"\n        type: "texto"\n        required: false\n        unique: false\n      - name: "precio_unitario"\n        type: "decimal"\n        required: true\n        unique: false\n      - name: "estado"\n        type: "texto"\n        required: false\n        unique: false\n\n  rutas:\n    name: "Catálogo de Rutas"\n    description: "Información sobre las rutas de distribución"\n    filename: "rutas.csv"\n    file_format:\n      type: "CSV"\n      delimiter: "|"\n      encoding: "utf-8-sig"\n      header: false\n    fields:\n      - name: "codigo_distribuidora"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "codigo_ruta"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "descripcion_ruta"\n        type: "texto"\n        required: false\n        unique: false\n      - name: "fecha_creacion"\n        type: "fecha"\n        required: false\n        unique: false\n\n  stock:\n    name: "Catálogo de Stock"\n    description: "Registro del stock disponible en almacenes"\n    filename: "stock.csv"\n    file_format:\n      type: "CSV"\n      delimiter: "|"\n      encoding: "utf-8-sig"\n      header: false\n    fields:\n      - name: "codigo_distribuidora"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "codigo_almacen"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "codigo_producto"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "cantidad_disponible"\n        type: "decimal"\n        required: true\n        unique: false\n      - name: "unidad_medida"\n        type: "texto"\n        required: false\n        unique: false\n      - name: "fecha_actualizacion"\n        type: "fecha"\n        required: false\n        unique: false\n\n  vendedores:\n    name: "Catálogo de Vendedores"\n    description: "Información sobre los vendedores de la distribuidora"\n    filename: "vendedores.csv"\n    file_format:\n      type: "CSV"\n      delimiter: "|"\n      encoding: "utf-8-sig"\n      header: false\n    fields:\n      - name: "codigo_distribuidora"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "codigo_vendedor"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "nombre_vendedor"\n        type: "texto"\n        required: false\n        unique: false\n      - name: "zona"\n        type: "texto"\n        required: false\n        unique: false\n\n  ventas:\n    name: "Catálogo de Ventas"\n    description: "Registro de ventas realizadas"\n    filename: "ventas.csv"\n    file_format:\n      type: "CSV"\n      delimiter: "|"\n      encoding: "utf-8-sig"\n      header: false\n    fields:\n      - name: "codigo_distribuidora"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "codigo_venta"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "fecha_venta"\n        type: "fecha"\n        required: true\n        unique: false\n      - name: "codigo_cliente"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "codigo_producto"\n        type: "texto"\n        required: true\n        unique: false\n      - name: "cantidad_vendida"\n        type: "decimal"\n        required: true\n        unique: false\n      - name: "precio_total"\n        type: "decimal"\n        required: true\n        unique: false\n\npackages:\n  clorox_package:\n    name: "Paquete de Datos Clorox"\n    description: "Paquete que agrupa todos los catálogos relacionados con la gestión de Clorox"\n    file_format:\n      type: "ZIP"\n    catalogs:\n      - clientes\n      - pedidos\n      - productos\n      - rutas\n      - stock\n      - vendedores\n      - ventas\n    package_validation:\n      - name: "Validación de Clientes en Ventas"\n        description: "¡Ups! Algunos clientes en ventas no existen en el catálogo de clientes 🤔"\n        rule: "df['ventas']['codigo_cliente'].isin(df['clientes']['codigo_cliente'])"\n        severity: "error"\n      - name: "Validación de Productos en Ventas"\n        description: "¡Ups! Algunos productos en ventas no existen en el catálogo de productos 🔍"\n        rule: "df['ventas']['codigo_producto'].isin(df['productos']['codigo_producto'])"\n        severity: "error"
\.


--
-- Data for Name: ejecuciones_yaml; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.ejecuciones_yaml (id, uuid, nombre_yaml, archivo_datos, fecha_ejecucion, estado, errores_detectados, warnings_detectados, ruta_directorio, casilla_id, emisor_id, metodo_envio) FROM stdin;
1	85403d76-385f-4233-b432-2b0b890be4d2	ventas_diarias.yaml	ventas_peru_20250310.csv	2025-03-10 21:07:56.570948	Éxito	0	1	/data/mondelez/peru/2025/03/10	\N	\N	\N
2	74a9e230-2ff4-4e35-8dfe-552662b8c39e	ventas_diarias.yaml	ventas_chile_20250310.csv	2025-03-10 21:07:56.570948	Fallido	2	0	/data/mondelez/chile/2025/03/10	\N	\N	\N
4	782df402-cc9a-43d6-9ec9-f7e8dc4af5c5	input.yaml	data	2025-03-14 17:58:42.092774	Fallido	1	2	/home/runner/workspace/executions/04eebea3-18ce-4ca1-95e6-80526d3089b1	\N	\N	\N
5	746c2f5e-7a07-4c8a-81a7-020b904d3a26	input.yaml	data	2025-03-14 17:59:50.629883	Fallido	1	2	/home/runner/workspace/executions/d1290987-cdc7-4c98-9daa-7ad659a38fa0	\N	\N	\N
6	2be49598-c315-4b90-9479-89c3ba7f3652	input.yaml	data	2025-03-14 18:03:56.325052	Fallido	1	2	/home/runner/workspace/executions/6790cee7-b23a-4f4f-acab-e7ea43cc9a45	\N	\N	\N
7	6651f230-fe6c-463f-8b23-eec1c38b0b6e	input.yaml	data	2025-03-14 18:04:55.453153	Fallido	15	0	/home/runner/workspace/executions/5affa141-ae94-4c59-bf49-fdd61ac989ee	\N	\N	\N
8	dd1fb006-0f0c-45db-a36a-282681e8429b	input.yaml	data	2025-03-14 18:05:01.133236	Fallido	15	0	/home/runner/workspace/executions/d416c793-3567-4af6-99da-d3511c2eafed	\N	\N	\N
9	1852d40e-a98f-4eb9-a9dd-22c1749cac5c	input.yaml	data	2025-03-14 18:31:22.746933	Fallido	1	2	/home/runner/workspace/executions/54c57cfd-2db4-4b78-966a-04c13dc3b437	\N	\N	\N
10	261ad642-ab89-4900-b683-01d2b6261199	input.yaml	data	2025-03-14 18:42:11.113685	Fallido	1	2	/home/runner/workspace/executions/a00fffb7-b273-4eb4-8cdd-81265ab8668e	\N	\N	\N
11	54dabcea-f4d2-46a8-a8b1-f690ea10882e	input.yaml	data	2025-03-14 19:24:11.650285	Fallido	1	2	/home/runner/workspace/executions/6b011271-e80f-41f1-9ff2-3383b0a1fdb3	\N	\N	\N
12	993adba2-4846-4c18-884d-1d53c2bd08a6	input.yaml	data	2025-03-14 19:27:36.803721	Fallido	1	2	/home/runner/workspace/executions/b6e24174-07a4-4460-a667-25d982bcfce2	\N	\N	\N
13	5dbf19ae-263a-472e-b622-2de5ff4e4b41	input.yaml	data	2025-03-14 19:30:53.466522	Fallido	1	2	/home/runner/workspace/executions/b673ee78-ddf1-44f6-bb79-17ae53313358	\N	\N	\N
14	696a9825-9e86-46ac-af37-b40a59c099d0	input.yaml	data	2025-03-14 19:33:58.185991	Fallido	1	2	/home/runner/workspace/executions/2342d135-e6cb-4d5f-8451-ba7f845f6392	\N	\N	\N
15	e2d91d13-1b8d-4881-b210-4456d6dc3889	input.yaml	data	2025-03-14 19:35:46.281613	Fallido	1	2	/home/runner/workspace/executions/4274d070-fb4c-4296-b45b-c53ac14c9129	\N	\N	\N
16	2578c762-c050-457c-8fb5-43a7eb9f0f6f	input.yaml	data	2025-03-14 19:37:14.81107	Fallido	1	2	/home/runner/workspace/executions/8378361b-cead-4065-b039-53c586606988	\N	\N	\N
17	f99c3984-5a95-4e66-a1da-edd593c6df9f	input.yaml	data	2025-03-14 19:38:25.848714	Fallido	1	2	/home/runner/workspace/executions/11d7c268-0980-4c89-8c1c-f71ceee7d578	\N	\N	\N
18	8f987fe6-32ce-47a1-9b6d-2727f8ff8085	input.yaml	data	2025-03-14 19:42:40.229373	Fallido	1	2	/home/runner/workspace/executions/13b07c0b-353b-4249-9cb5-1fe31526a4b6	\N	\N	\N
19	50e6319f-8504-4bb4-a452-237a6df055d8	input.yaml	data	2025-03-14 19:45:22.799099	Fallido	1	2	/home/runner/workspace/executions/2e39dd2e-5ed7-4d62-a1b5-c0d277be7580	\N	\N	\N
20	3c2a323d-32b3-4e6a-ae7a-4c8325998e9f	input.yaml	data	2025-03-14 19:48:27.877796	Fallido	1	2	/home/runner/workspace/executions/92bac09e-a7f9-483e-ac59-56fd0026f641	\N	\N	\N
21	4a949e6d-9a9c-4812-b292-0c2ff98c5df8	input.yaml	data	2025-03-14 19:52:04.326132	Fallido	1	2	/home/runner/workspace/executions/843517f2-e766-4343-8b97-d571fc577994	\N	\N	\N
22	4c13ca8b-d3f2-4810-87c9-0a49fb7e1b3b	input.yaml	data	2025-03-14 19:56:50.460005	Fallido	1	2	/home/runner/workspace/executions/dacc7c51-10bb-4a2a-9b3d-ffdb65d0a180	\N	\N	\N
23	8b7c9fc3-4856-42d5-96a5-02a08c0e8fc1	input.yaml	data	2025-03-14 19:59:40.92631	Fallido	1	2	/home/runner/workspace/executions/feaf57c0-d9ce-448d-a87c-74b9c1cd91a1	\N	\N	\N
24	54b52cec-07ee-403f-93e8-8ee791c75843	input.yaml	data	2025-03-14 20:01:46.910729	Fallido	1	2	/home/runner/workspace/executions/2bafb23c-a2f4-4760-a909-e656775e6ae5	\N	\N	\N
25	5d14b4da-e7f6-4177-864c-da4c89bd37dd	input.yaml	data	2025-03-14 20:05:46.583702	Fallido	1	2	/home/runner/workspace/executions/95ac503a-7333-4e6a-8736-2527bff5addb	\N	\N	\N
26	678803bd-3aaf-4e69-bcbf-2ac9c61cfcd0	input.yaml	data	2025-03-14 20:19:05.950418	Fallido	1	2	/home/runner/workspace/executions/d63d3080-b3ae-419e-82a9-d2700b8617d7	\N	\N	\N
27	87418e28-9f4e-40f6-b567-4b623d0626f9	input.yaml	data	2025-03-14 20:21:43.256734	Fallido	1	2	/home/runner/workspace/executions/fc8c4912-c355-4ff1-a432-33e8ba317dc3	\N	\N	\N
28	1ccc2234-c2f3-4700-9dbd-8689d9fa253a	input.yaml	data	2025-03-14 20:23:33.303282	Fallido	1	2	/home/runner/workspace/executions/2ff8c3fb-c955-455f-8ee4-13ce7384b0c3	\N	\N	\N
29	c6029df3-e340-41b5-9e3a-c5a9922695e8	input.yaml	data	2025-03-14 20:27:14.326438	Fallido	1	2	/home/runner/workspace/executions/64b20cae-d772-4988-89b7-612b5dd1570b	\N	\N	\N
30	ca355237-98a9-4829-b3d8-99ad29de7487	input.yaml	data	2025-03-14 20:31:36.878747	Fallido	1	2	/home/runner/workspace/executions/f80b7761-c040-4012-b7f6-a15708873da3	\N	\N	\N
31	d5b6e113-e21f-441c-9fe2-3ba13ac9b441	input.yaml	data	2025-03-14 20:34:40.424585	Fallido	1	2	/home/runner/workspace/executions/4eb6056f-b00f-4f69-aea0-c345738f9823	\N	\N	\N
32	05e5d714-839d-4f47-880c-eee8802b6b11	input.yaml	data	2025-03-14 20:38:16.687164	Fallido	1	2	/home/runner/workspace/executions/8359b1f5-1384-4d66-b2d8-e247b1430a58	\N	\N	\N
33	4ceaf85b-d8aa-4557-ba86-6070b9d41f42	input.yaml	data	2025-03-14 20:41:17.72809	Fallido	1	2	/home/runner/workspace/executions/6cb77993-ad15-42ae-8f27-b636c3ed2d8a	\N	\N	\N
34	9708be10-559a-46ce-8439-c5ad2bb2996e	input.yaml	data	2025-03-14 20:45:47.881487	Fallido	1	2	/home/runner/workspace/executions/c75950ed-a748-49b0-8fbb-6ce923dfa03a	\N	\N	\N
35	210c8dce-3231-4941-ae46-cf96f422fa86	input.yaml	data	2025-03-14 20:49:22.861751	Fallido	1	2	/home/runner/workspace/executions/2d6dc13b-e816-45b6-8d4a-f13444df1e15	\N	\N	\N
36	04398a8d-e3e3-45f9-b30d-b4a71e16dac2	input.yaml	data	2025-03-14 21:01:45.568984	Fallido	1	2	/home/runner/workspace/executions/f09c5225-7c2b-4853-93f8-cfe55411d697	\N	\N	\N
37	362c5f0f-9ff2-4995-ba44-5d8c3fed1c20	input.yaml	data	2025-03-14 21:02:50.905032	Fallido	1	2	/home/runner/workspace/executions/866f6e26-6f56-4f25-b09b-266dae7f9ffe	\N	\N	\N
38	01134b43-4147-442d-9c67-c89d241939fd	input.yaml	data	2025-03-14 21:06:03.622305	Fallido	1	2	/home/runner/workspace/executions/c0921374-fe55-4651-aeb1-5ac6e5658df7	\N	\N	\N
39	6bf37ded-1943-49b2-ba5b-e4e87dd0a8d3	input.yaml	data	2025-03-14 21:08:45.352357	Fallido	1	2	/home/runner/workspace/executions/dd7d2d2f-ca7c-45c8-896a-cfc801536d0c	\N	\N	\N
40	9365c340-584a-4ecd-90b9-6681ed2534e0	input.yaml	data	2025-03-14 21:14:19.033122	Fallido	1	2	/home/runner/workspace/executions/34469b85-6d5b-4bba-83c0-3b332343e88c	\N	\N	\N
41	de889c70-c59d-4e28-a51e-48a20c0e9d81	input.yaml	data	2025-03-14 21:26:13.012132	Fallido	1	2	/home/runner/workspace/executions/07bea46d-01fb-4039-a6ce-e2b6ce920fe2	\N	\N	\N
42	97bd2b23-6186-468c-929e-72de22dda363	input.yaml	data	2025-03-14 23:20:28.472603	Fallido	1	2	/home/runner/workspace/executions/60f45b03-dae7-4306-86af-187fe3ddd48b	\N	\N	\N
43	3f3b7be8-1c8f-45ee-b130-be013a0dcb7c	input.yaml	data	2025-03-15 02:10:25.713282	Fallido	1	2	/home/runner/workspace/executions/73c641a6-0ea1-41dc-b0c2-fba3416af5d5	\N	\N	\N
44	b0381126-f0e0-4f7a-a7d9-5f15fdb57ce6	input.yaml	data	2025-03-15 14:47:53.807691	Fallido	1	2	/home/runner/workspace/executions/80e6ebe0-e273-4e01-993c-4c3577a21360	\N	\N	\N
45	627b5a9d-5664-428a-abb0-3ab6fbc779aa	input.yaml	data	2025-03-15 14:57:32.770321	Fallido	1	2	/home/runner/workspace/executions/b068b6d4-8305-4a18-9e09-d1f06709df53	\N	\N	\N
46	e43c3a77-6813-4568-a952-2284f9535264	input.yaml	data	2025-03-15 15:02:47.146903	Fallido	1	2	/home/runner/workspace/executions/60989cdf-2248-4828-8dbd-bcca74e87c30	\N	\N	\N
47	cba12785-71b1-401b-ae5f-20a23c19b1ba	input.yaml	data	2025-03-15 15:04:43.148893	Fallido	1	2	/home/runner/workspace/executions/ec95e742-607e-4d62-9a2d-4819df147a3f	\N	\N	\N
48	7934ddea-ef22-4951-a085-d1c8c8ff2692	input.yaml	data	2025-03-15 15:06:59.989267	Fallido	1	2	/home/runner/workspace/executions/355bd7e5-d066-43c4-963a-947a7639cff9	\N	\N	\N
49	21587bf1-032e-40e4-9434-52e17f818b79	input.yaml	data	2025-03-15 15:12:49.925434	Fallido	1	2	/home/runner/workspace/executions/0f871d57-4473-4c5d-81b4-11ce5da5cf3e	\N	\N	\N
50	9266f142-73be-4b36-b5f6-d1b20786ede4	input.yaml	data	2025-03-15 15:14:55.671239	Fallido	1	2	/home/runner/workspace/executions/fc28b90f-c7da-4bd7-8ec2-4e260dc704aa	\N	\N	\N
51	67d91846-1067-4797-893b-fb8e711218c6	input.yaml	data	2025-03-15 15:16:38.945862	Fallido	1	2	/home/runner/workspace/executions/0f5ed47e-febc-434a-a4b0-b8618b3eba6a	\N	\N	\N
52	199f2fab-9e7f-4a2c-9135-92913ec6a6c6	input.yaml	data	2025-03-15 15:24:19.403524	Fallido	1	2	/home/runner/workspace/executions/ca99549e-75f0-437b-80cb-d8f89dba401a	\N	\N	\N
53	4251aa81-e69e-4864-8ace-4e3dc2776a6a	input.yaml	data	2025-03-16 02:01:33.482272	Fallido	1	2	/home/runner/workspace/executions/69aa8c1d-4730-4891-a8e2-094faf06ed44	\N	\N	\N
54	53b189ea-f109-4ca2-b570-1b02ac249714	input.yaml	data	2025-03-16 18:32:21.897434	Fallido	1	2	/home/runner/workspace/executions/0b5f5063-6bc7-4e65-88a9-c198489381f5	\N	\N	\N
55	ae257d60-53f3-4261-8ad1-7082df8510fe	input.yaml	data	2025-03-17 03:21:32.288342	Fallido	1	2	/home/runner/workspace/executions/fcd295ad-bd9d-4d26-a090-47876e3b147c	\N	\N	\N
56	8077a935-3ffa-4495-b442-2ae607690442	input.yaml	data	2025-03-17 03:38:36.672265	Fallido	1	2	/home/runner/workspace/executions/1c7f4391-ca37-4470-be0d-adb9630b239e	\N	\N	\N
57	62320c8b-7ffc-47d8-bb10-ca384acd86b1	input.yaml	data	2025-03-17 16:15:24.341883	Fallido	1	2	/home/runner/workspace/executions/b54a2cd8-d9d7-4ee2-9ee3-95ebd08ccd21	\N	\N	\N
58	238aa43b-65b0-4cfd-a4d0-7207b499b295	input.yaml	data	2025-03-17 21:19:55.705013	Fallido	1	2	/home/runner/workspace/executions/d25295a9-5da9-4962-9ccc-5d3a1fe2736d	\N	\N	\N
59	c984d914-46eb-40c1-8e2a-90a45484adf4	input.yaml	data	2025-03-17 21:43:31.324167	Fallido	1	2	/home/runner/workspace/executions/35723ea5-35c2-4227-9f1e-d8a4545ebd04	\N	\N	\N
60	ea44e852-2035-4b0f-bb49-2fdc02d8a88b	input.yaml	data	2025-03-17 21:47:04.476302	Fallido	1	2	/home/runner/workspace/executions/c21909f6-0b42-4303-ba46-8df3a5ce79d7	\N	\N	\N
61	67516cea-18e3-454f-b224-f073205043de	input.yaml	data	2025-03-17 21:47:43.695426	Fallido	1	2	/home/runner/workspace/executions/e1fd2b52-d8da-49d3-a9dd-a015223935d3	\N	\N	\N
62	034c2674-a983-41f7-b518-1e9298d6669e	input.yaml	data	2025-03-17 21:50:36.851791	Fallido	1	2	/home/runner/workspace/executions/cab27c07-6273-4663-8727-ba0384ef5b1c	\N	\N	\N
63	5f3834d6-413b-4bdb-bc31-488e76806731	input.yaml	data	2025-03-17 21:55:18.928763	Fallido	1	2	/home/runner/workspace/executions/3b02467a-02a5-4859-bf2d-d19cafd8a2d1	\N	\N	\N
64	71f5a511-5463-4197-8593-49c092b0e686	input.yaml	data	2025-03-17 21:57:07.27366	Fallido	1	2	/home/runner/workspace/executions/5b5395ae-5f46-456a-afc3-231d4d7b6a45	\N	\N	\N
65	a5a06b3d-f80e-4eea-9217-8693ed59a1b9	input.yaml	data	2025-03-17 22:04:15.935057	Fallido	1	2	/home/runner/workspace/executions/efaf81a4-5337-4a72-b4e2-3bfcc5b8b204	\N	\N	\N
66	4179f1be-3de2-4068-83dc-0deaabe8c94b	input.yaml	data	2025-03-17 22:09:29.158752	Fallido	1	2	/home/runner/workspace/executions/ae983949-81ed-4308-81c7-fe71e1ec2f9e	\N	\N	\N
67	b2e24215-589b-42b3-a060-09de41ad7619	input.yaml	data	2025-03-17 22:13:02.36193	Fallido	1	2	/home/runner/workspace/executions/a26acdda-3627-480a-8a2b-9492961ee8d4	\N	\N	\N
68	e475b165-94ee-492c-9e6d-9ed0df804fd8	input.yaml	data	2025-03-17 22:14:45.9313	Fallido	1	2	/home/runner/workspace/executions/a63a9343-184f-4ff8-bcb8-29ecbb686543	\N	\N	\N
69	3d2e8240-48e7-453e-971d-eef16b97d478	input.yaml	data	2025-03-17 22:16:30.892368	Fallido	1	2	/home/runner/workspace/executions/ffe33c1c-1ab7-43c5-a006-35e04f83074d	\N	\N	\N
70	90e16ebc-0fae-4b2f-ad25-6263e5a16491	input.yaml	data	2025-03-17 22:20:46.02	Fallido	1	2	/home/runner/workspace/executions/20e1c515-0d5c-4874-98fd-4ddb91b55e98	\N	\N	\N
71	06c6b27c-87d5-4d18-86f3-6060fd36e89a	input.yaml	data	2025-03-17 22:38:36.403061	Fallido	1	2	/home/runner/workspace/executions/cca30355-4e1b-4632-9da3-33fbd3743447	\N	\N	\N
72	2f10fabb-02bb-4978-9854-b24db64e5e56	input.yaml	data	2025-03-17 22:39:54.464335	Fallido	1	2	/home/runner/workspace/executions/ffe42a0c-10ab-452a-b526-838e0561b9fd	\N	\N	\N
73	46323809-24fa-40a0-899d-ee28777f5a23	input.yaml	data	2025-03-17 23:07:39.796425	Fallido	1	2	/home/runner/workspace/executions/07cf4a9f-5616-48f1-b675-a716bbaaee1b	\N	\N	\N
74	45c224de-a449-4b21-9226-eb83c3a56da2	input.yaml	data	2025-03-17 23:11:02.836574	Fallido	1	2	/home/runner/workspace/executions/28762d1d-1054-4ead-8e82-9bf9731ed034	\N	\N	\N
75	956e84f1-7965-4e8b-889b-144b8461ec33	input.yaml	data	2025-03-17 23:14:59.266432	Fallido	1	2	/home/runner/workspace/executions/90618476-08c2-4ac4-b214-b6ad880451b1	\N	\N	\N
76	e81505b2-deb8-4045-8282-a89701e47480	input.yaml	data	2025-03-17 23:21:26.538346	Fallido	1	2	/home/runner/workspace/executions/a8797bb4-a01e-4822-aa87-dd170c51c35b	\N	\N	\N
77	5fb929b2-ec37-49fe-a364-83ec228179ce	input.yaml	data	2025-03-17 23:59:05.393002	Fallido	1	2	/home/runner/workspace/executions/58a111fa-d681-4991-949e-062e0530f06d	\N	\N	\N
78	e2f0a9e3-460c-4bcc-ac64-6ece0fac9888	input.yaml	data	2025-03-18 00:03:46.948051	Fallido	1	2	/home/runner/workspace/executions/fa827052-4813-4673-93b4-976b8acfed5e	\N	\N	\N
79	53ff51a3-8d80-4ab6-b625-4d792d27a541	input.yaml	data	2025-03-18 00:11:45.530934	Fallido	1	2	/home/runner/workspace/executions/810b65c5-8c96-45dc-aac8-f08b00d9c4aa	\N	\N	\N
80	ea33be08-d177-4e47-876e-5d482997e49b	input.yaml	data	2025-03-18 00:15:57.493796	Fallido	1	2	/home/runner/workspace/executions/6d66c864-6883-4ae0-984d-329c2cfb8f19	\N	\N	\N
81	cf54d551-4492-4d75-be3f-dd7d8f3d8c67	input.yaml	data	2025-03-18 00:16:19.340786	Fallido	1	2	/home/runner/workspace/executions/dd35def9-a7d0-4a22-bbf9-52539f2ce505	\N	\N	\N
82	fac66fa3-6ae5-4196-ad76-61243d48c8da	input.yaml	data	2025-03-18 00:19:12.48952	Fallido	1	2	/home/runner/workspace/executions/b7867269-da6c-4948-852c-400ac9f07adf	\N	\N	\N
83	53d62d0a-0858-4026-8e0a-05ec5c5815f0	input.yaml	data	2025-03-18 00:22:54.127959	Fallido	1	2	/home/runner/workspace/executions/48ed4459-4f5f-48b8-965a-36c035dee862	\N	\N	\N
84	814442ff-18cd-4f1b-a947-9108d4bd85b7	input.yaml	data	2025-03-18 00:25:15.808576	Fallido	1	2	/home/runner/workspace/executions/2e7ac40d-1fb3-4279-9ea8-d6986048eac2	\N	\N	\N
85	5231cff9-3ede-4554-b8d8-447ea9036076	input.yaml	data	2025-03-18 00:30:00.547722	Fallido	1	2	/home/runner/workspace/executions/5e55885b-7221-452f-bc8c-d25b0fba65a5	\N	\N	\N
86	f9d2ad86-b102-4366-8292-d000ed3e07db	input.yaml	data	2025-03-18 00:35:12.45992	Fallido	1	2	/home/runner/workspace/executions/daa72ba7-b24d-4b14-bf2c-c245e6a7ff88	\N	\N	\N
87	f7fca6e8-525a-4907-b430-d22e7dca9111	input.yaml	data	2025-03-18 00:38:56.651921	Fallido	1	2	/home/runner/workspace/executions/1f7a648d-ad24-4d7a-932b-14cc84ca6b4d	\N	\N	\N
88	cfa14e74-e0ef-43f3-9ef0-07ea2f653824	input.yaml	data	2025-03-18 17:28:15.328937	Fallido	1	2	/home/runner/workspace/executions/4a96ec08-f2e4-4fb6-8077-aa2dce157110	\N	\N	\N
89	fe07151e-e433-4d9d-810a-08ba12bf4331	input.yaml	data	2025-03-18 17:33:51.653395	Fallido	1	2	/home/runner/workspace/executions/4d61fe6e-e04c-441d-9f1c-0690174e02f4	\N	\N	\N
90	ac6db36d-3655-439a-9891-1cf3a32ed764	input.yaml	data	2025-03-18 17:37:39.704627	Fallido	1	2	/home/runner/workspace/executions/69dd128b-bf92-4090-87fe-911b42d5eb8a	\N	\N	\N
91	ee92c759-9022-4f30-a8c8-028c23c9935e	input.yaml	data	2025-03-19 17:18:48.91969	Fallido	1	2	/home/runner/workspace/executions/0165b67e-2e30-4307-bf82-292da313dd04	\N	\N	\N
92	bbe2f19c-160b-4739-95d6-11715fa1dc0d	input.yaml	data	2025-03-19 17:18:50.45852	Fallido	1	2	/home/runner/workspace/executions/9490c7b9-6b44-42b7-b8f0-9fb615b218b3	\N	\N	\N
93	7a03ef3b-bae5-443a-bf6d-dd3aa6909c77	input.yaml	data	2025-03-19 17:18:51.960837	Fallido	1	2	/home/runner/workspace/executions/e2b2fd7c-0613-4a46-9801-6029a0224a9f	\N	\N	\N
94	9e6ed35d-1b1e-4772-9484-c0e80172e96a	input.yaml	data	2025-03-19 17:18:53.558149	Fallido	1	2	/home/runner/workspace/executions/c88fbdec-ac7d-4104-8156-53f646e0f19a	\N	\N	\N
95	cf2c5827-dabc-4935-b89d-945479679303	input.yaml	data	2025-03-19 17:18:55.677469	Fallido	1	2	/home/runner/workspace/executions/5a672420-e20b-4e3c-8da6-bf69d6131630	\N	\N	\N
96	8bb0f104-4490-4a39-9b9b-c5c5a2c8942d	input.yaml	data	2025-03-19 17:18:58.388711	Fallido	1	2	/home/runner/workspace/executions/03ad1fe3-0e2f-4666-b094-7be0b1969ada	\N	\N	\N
97	2a44c853-374c-4e39-a4c2-6a6de05bf6ef	input.yaml	data	2025-03-19 17:19:00.642466	Fallido	1	2	/home/runner/workspace/executions/91367cf7-b7b0-4729-aded-7288def5c3bf	\N	\N	\N
98	0b59ecec-4c97-449a-a6bf-f0db29234a9c	input.yaml	data	2025-03-19 17:19:05.527767	Fallido	1	2	/home/runner/workspace/executions/3d555b5a-46c4-4b36-be06-e381808c3e86	\N	\N	\N
99	08512e44-9371-4223-8cd1-ebe05a26c902	input.yaml	data	2025-03-19 17:19:09.197125	Fallido	1	2	/home/runner/workspace/executions/1115a271-b191-4451-8a39-c4b1130c61c2	\N	\N	\N
100	2419ee43-4519-43a5-b27a-aafa40e763f4	input.yaml	data	2025-03-19 17:19:10.775389	Fallido	1	2	/home/runner/workspace/executions/3354d092-a69f-491b-917d-c8ead68df459	\N	\N	\N
101	5fde9e2b-40d2-40a2-b9b8-dcfed97e9bda	input.yaml	data	2025-03-19 17:23:25.320661	Fallido	1	2	/home/runner/workspace/executions/0a852668-787c-4745-945e-b905f0b19e44	\N	\N	\N
102	c59bedbb-8246-4ece-a760-bb4b5a049514	input.yaml	data	2025-03-19 17:39:11.741783	Fallido	1	2	/home/runner/workspace/executions/bb8dfe2c-67c0-4481-a58d-397af89f7147	\N	\N	\N
103	9dc3eae9-d280-44c7-9a8d-44408a7a6a64	input.yaml	data	2025-03-19 20:26:58.311023	Fallido	1	2	/home/runner/workspace/executions/3978f660-6613-448a-b06b-8df607d048a8	\N	\N	\N
104	d5452e79-6eae-44a8-b2d8-8d1534bf7fbf	input.yaml	data	2025-03-19 20:28:51.306984	Fallido	1	2	/home/runner/workspace/executions/1cbab348-fbd4-47be-b0a3-cf1c14acaa46	\N	\N	\N
105	a0586b14-e439-4b2e-96a3-b0b7a7a41270	input.yaml	data	2025-03-19 20:35:23.538759	Fallido	1	2	/home/runner/workspace/executions/ca7ee2e2-7601-45ab-94f8-c2a072b5ad41	\N	\N	\N
106	b459500e-f73d-4db2-a004-0bbdcafa6ebd	input.yaml	data	2025-03-19 20:37:42.949379	Fallido	1	2	/home/runner/workspace/executions/3abae08b-dd99-4cef-bc6d-78537d411adc	\N	\N	\N
107	421d3fd5-62d6-4b3a-be7d-82944948acb4	input.yaml	data	2025-03-19 20:40:39.212602	Fallido	1	2	/home/runner/workspace/executions/e38f5a8c-d23a-4721-88c9-723f7432e0df	\N	\N	\N
108	2e6e1e44-ff5f-40b3-968b-a7e184163067	input.yaml	data	2025-03-19 20:41:55.73911	Fallido	1	2	/home/runner/workspace/executions/9a008f1e-6f04-40f6-b183-78b543a1e279	\N	\N	\N
109	9a284dcd-356f-4b82-b7ac-fe5fc602c88f	input.yaml	data	2025-03-19 20:43:13.438144	Fallido	1	2	/home/runner/workspace/executions/11b55430-61f4-4f36-aa85-b3b142c22ebe	\N	\N	\N
110	5f7b4eb7-2af5-453b-ae41-5825800727e8	input.yaml	data	2025-03-19 20:46:16.868465	Fallido	1	2	/home/runner/workspace/executions/706f12e9-6e6f-45ba-a828-efc0bb761528	\N	\N	\N
111	5340e421-1b56-4d09-990a-0263bd14fa7a	input.yaml	data	2025-03-19 21:09:29.786474	Fallido	1	2	/home/runner/workspace/executions/0bcb911b-bf8b-4cfb-a491-e0c0a9f24b95	\N	\N	\N
112	84cb77fa-bcc9-42ef-9b93-6fa8ca24a525	input.yaml	data	2025-03-19 21:11:27.167216	Fallido	1	2	/home/runner/workspace/executions/3f684640-22cb-43aa-b59f-1837abc8a0ca	\N	\N	\N
113	dc7235ca-a1d5-4fea-ae68-defaecca01b8	input.yaml	data	2025-03-19 21:14:25.972516	Fallido	1	2	/home/runner/workspace/executions/84a31d53-1a4b-4b37-9e62-f89bbee52924	\N	\N	\N
114	8d4ba8e9-1ed5-409f-b413-29232e4beeae	input.yaml	data	2025-03-19 21:26:12.325881	Fallido	1	2	/home/runner/workspace/executions/f187667b-8dc3-4108-8fea-ac721a9020f6	\N	\N	\N
115	420bf8b2-0650-4893-9a12-f0b105c17ce5	input.yaml	data	2025-03-19 21:31:53.894596	Fallido	1	2	/home/runner/workspace/executions/e132bb7b-fcd7-4d03-ad79-9949cc752387	\N	\N	\N
116	4b5e59a2-8e10-4eb6-9d2b-530a4d8e2d47	input.yaml	data	2025-03-19 21:37:51.520391	Fallido	1	2	/home/runner/workspace/executions/a27ebc6d-d95f-4260-b8f4-8c3890378cc1	\N	\N	\N
117	e97d1c23-8bf3-4496-a852-5df8dbe21e25	input.yaml	data	2025-03-19 21:39:12.067518	Fallido	1	2	/home/runner/workspace/executions/70678717-506b-407d-806a-f9a88bed2099	\N	\N	\N
118	ab2a4a98-5f20-46a8-958d-43b930c516a9	input.yaml	data	2025-03-19 21:39:32.81431	Fallido	1	2	/home/runner/workspace/executions/cc63ff00-2aeb-41dd-b9c7-ec960e113caa	\N	\N	\N
119	0ea9742b-ed26-4e81-ad31-35c709b6e332	input.yaml	data	2025-03-19 21:39:47.230241	Fallido	1	2	/home/runner/workspace/executions/3154a600-61a8-4ba4-9ae5-76416721d488	\N	\N	\N
120	7b6111c0-9a53-4e06-b9b3-ea893675f196	input.yaml	data	2025-03-19 21:40:28.52334	Fallido	1	2	/home/runner/workspace/executions/b58e8553-b689-46ce-b920-4a1048319578	\N	\N	\N
121	4bf8ea7f-8532-405e-a722-bb81297caef3	input.yaml	data	2025-03-19 21:41:34.054503	Fallido	1	2	/home/runner/workspace/executions/df947af4-4529-48f0-a8f1-3006aa2a24cc	\N	\N	\N
122	3af0c07c-4f7a-4be5-961d-ecc6228a4723	input.yaml	data	2025-03-19 21:43:41.59092	Fallido	1	2	/home/runner/workspace/executions/0465a3ab-a0b0-4e51-888f-2e2b7b2a5279	\N	\N	\N
123	c1df85c4-b0bd-4add-a23c-f12feda49281	input.yaml	data	2025-03-19 21:45:21.320861	Fallido	1	2	/home/runner/workspace/executions/94b80555-f5b2-479a-83fe-3d7029937c1d	\N	\N	\N
124	19127e64-e41e-4a54-81a8-9ce3523b9d18	input.yaml	data	2025-03-19 21:46:34.043315	Fallido	1	2	/home/runner/workspace/executions/5fcf5021-a32a-411f-b80e-61e8eb36c858	\N	\N	\N
125	ceecb6ad-468e-482c-8c18-56bb00f174e6	input.yaml	data	2025-03-19 22:01:40.432705	Fallido	1	2	/home/runner/workspace/executions/0e091386-cc25-461d-bc6c-e032fb535bc0	\N	\N	\N
126	185b3498-37ca-461d-84e8-8cbe848d7e3c	input.yaml	data	2025-03-19 22:11:17.024965	Fallido	1	2	/home/runner/workspace/executions/8343f3f6-ad7a-4af4-b1da-3ddee69958b8	\N	\N	\N
127	3a160049-eeef-412e-b32e-7bfa91335f08	input.yaml	data	2025-03-19 22:14:17.419704	Fallido	1	2	/home/runner/workspace/executions/dc6df9e0-ef7a-4e06-98ee-578d696cd89c	\N	\N	\N
128	46463cc9-e9de-426b-a7ee-46d0f18bf4eb	input.yaml	data	2025-03-19 22:29:54.028574	Fallido	1	2	/home/runner/workspace/executions/331253b2-ae12-4918-a980-49dfb2595a0a	\N	\N	\N
129	bd8bc595-2859-4a46-bada-90b1757c98de	input.yaml	data	2025-03-19 22:34:16.152788	Fallido	1	2	/home/runner/workspace/executions/c211036e-d2a6-407f-b317-604a2e410ccf	\N	\N	\N
130	1a18febc-0822-4fe7-bf1c-500ca8c73b6c	input.yaml	data	2025-03-19 22:39:03.378569	Fallido	1	2	/home/runner/workspace/executions/4a99a9b6-0966-4b6f-94bb-54bf79147ac8	\N	\N	\N
131	d431b593-65c4-4fad-81b3-28474e3f11ea	input.yaml	data	2025-03-19 22:46:00.703692	Fallido	1	2	/home/runner/workspace/executions/fb79c5be-cbc6-4ee1-8c8e-42b848b58fcb	\N	\N	\N
132	1c43b50e-0466-4715-8fab-3b86c3c7e5b7	input.yaml	data	2025-03-19 22:56:04.595378	Fallido	1	2	/home/runner/workspace/executions/c1abb395-cf26-4a58-92b8-8236a56dc44b	\N	\N	\N
133	62f2f024-e4a1-4204-b314-77116b9b500b	input.yaml	data	2025-03-19 22:59:02.749517	Fallido	1	2	/home/runner/workspace/executions/0d95c9e6-8d6f-4ed4-b1e6-c3b8ef8d8ec6	\N	\N	\N
134	770216c4-0d82-41ba-a69e-e9e5720d309c	input.yaml	data	2025-03-19 23:11:30.030853	Fallido	1	2	/home/runner/workspace/executions/7c7ee355-42d8-48ae-bbd7-9902c1e3a9bb	\N	\N	\N
135	c016c168-04e3-495d-8a2e-2cd9a493e420	input.yaml	data	2025-03-19 23:14:25.972846	Fallido	1	2	/home/runner/workspace/executions/62df448f-2260-4ae1-bf38-d47788e8bbf3	\N	\N	\N
136	02dd2672-1946-410e-a5a2-e1c9f179e2be	input.yaml	data	2025-03-19 23:17:33.823454	Fallido	1	2	/home/runner/workspace/executions/91010c1f-6ccc-4794-bd13-0ed239a8fe78	\N	\N	\N
137	1d2745d6-8299-4998-b6c3-e30659183eaf	input.yaml	data	2025-03-19 23:20:27.944329	Fallido	1	2	/home/runner/workspace/executions/58ea1f6e-1062-473d-a800-721e374e7a54	\N	\N	\N
138	4a134ce8-fb9f-495f-b837-ecdcf85934af	input.yaml	data	2025-03-19 23:25:11.485951	Fallido	1	2	/home/runner/workspace/executions/0ce471a9-b5f3-48e6-9664-1c8fc4924264	\N	\N	\N
139	bada6eed-1b60-4cdd-8aad-f76be53bcc01	input.yaml	data	2025-03-19 23:28:07.576954	Fallido	1	2	/home/runner/workspace/executions/358d5908-fed2-4599-9bde-43e3985edf57	\N	\N	\N
140	6101e4c4-e5ab-4fd3-a81a-e3e008256ffd	input.yaml	data	2025-03-19 23:38:45.984738	Fallido	1	2	/home/runner/workspace/executions/f8c07be7-83ee-4f6a-8237-059fe1ca5676	\N	\N	\N
141	29ff1a37-39b9-4c0b-b455-3fd330aed22f	input.yaml	data	2025-03-19 23:40:44.943276	Fallido	1	2	/home/runner/workspace/executions/7381d645-1aaf-4a17-9f18-7ad8f911e983	\N	\N	\N
142	f9c7953e-a1cc-4307-b4ec-49dd514590cc	input.yaml	data	2025-03-19 23:50:15.162302	Fallido	1	2	/home/runner/workspace/executions/88bfff04-4e7d-48cf-925a-cd7781929f44	\N	\N	\N
143	85249728-786e-4673-ba0e-94f46234b759	input.yaml	data	2025-03-20 00:16:01.353215	Fallido	1	2	/home/runner/workspace/executions/c92822f8-37a0-4190-8133-fe652a3af8fa	\N	\N	\N
144	ab2ed122-c16c-4b2f-a8c0-fe5cc775722f	input.yaml	data	2025-03-20 00:16:40.361531	Fallido	1	2	/home/runner/workspace/executions/73f43523-3ff2-476b-a732-6b2576beb838	\N	\N	\N
145	0d05656c-8b69-4af2-b0f8-d6fc8e4f751a	input.yaml	data	2025-03-24 15:43:41.631033	Fallido	1	2	/home/runner/workspace/executions/1a17572b-9424-48d7-bf72-3eda12c949dd	\N	\N	\N
146	a973ba60-f672-4509-87dd-f5c35ff02ce1	input.yaml	data	2025-03-24 15:56:41.571379	Fallido	1	2	/home/runner/workspace/executions/35dafa17-3c41-43dd-9243-a1eee5e241f4	\N	\N	\N
147	d000724d-3cbc-4455-9b7b-0ad628c46860	input.yaml	data	2025-03-24 16:02:28.619046	Fallido	1	2	/home/runner/workspace/executions/d9f09333-625a-4f0b-b466-df180b0e4630	\N	\N	\N
148	6d501712-53fd-47eb-a6c8-b6d7a5392484	input.yaml	data	2025-03-24 16:03:09.476619	Fallido	1	2	/home/runner/workspace/executions/4c53dd6d-c8f6-4026-9d46-f52780aa1461	\N	\N	\N
149	b33edab6-dbbf-4a14-a77f-7154922b9886	input.yaml	data	2025-03-24 16:05:34.797937	Fallido	1	2	/home/runner/workspace/executions/7137d800-2b00-474f-b129-a731f8191549	\N	\N	\N
150	e959027f-073c-479e-8a7f-fc8f05841faa	input.yaml	data	2025-03-24 16:27:09.087333	Fallido	1	2	/home/runner/workspace/executions/d475d121-1bfa-427f-8d54-7cd72f65248c	\N	\N	\N
151	898abe5a-ffb1-4ad1-a9cc-169b4401eade	input.yaml	data	2025-03-24 17:46:33.810735	Fallido	1	2	/home/runner/workspace/executions/597e4724-3e19-4160-ba83-0cb32f96a586	\N	\N	\N
152	134b6b80-b4d0-416d-ae04-279fbd8d5ac6	input.yaml	data	2025-03-24 17:47:42.389398	Fallido	1	2	/home/runner/workspace/executions/408b067d-2500-48b9-9eec-8540f018b359	\N	\N	\N
153	ccd6e0cc-ee65-4664-bea4-7c4e303df944	input.yaml	data	2025-03-24 17:51:37.114411	Fallido	1	2	/home/runner/workspace/executions/e4fdbb87-33b5-428c-867b-80f8bcfc7955	\N	\N	\N
154	ddd6c0c9-e32f-4d62-9065-a4583386ab9d	input.yaml	data	2025-03-24 17:54:30.81151	Fallido	1	2	/home/runner/workspace/executions/0b9b7a0b-cb1f-4956-8808-4dc5fd201c56	\N	\N	\N
155	dcf2791d-ae8e-4041-a880-78d4dbd2fbad	input.yaml	data	2025-03-24 18:02:30.119746	Fallido	1	2	/home/runner/workspace/executions/2ffdce1e-19fc-47bf-a6b0-ba2f8ecb04ce	\N	\N	\N
156	b0c1f383-4116-4a44-9e52-4557f241041e	input.yaml	data	2025-03-24 18:47:07.523835	Fallido	1	2	/home/runner/workspace/executions/7148c749-ee42-4d73-94b4-62485154027b	\N	\N	\N
157	76c7d583-e091-4175-9942-292c21ab5817	input.yaml	data	2025-03-24 18:48:57.484601	Fallido	1	2	/home/runner/workspace/executions/dc728ea8-c91c-4e76-a735-7f751003e833	\N	\N	\N
158	d5237b0a-725a-4456-8753-36f4dcea840d	input.yaml	data	2025-03-24 18:51:42.346412	Fallido	1	2	/home/runner/workspace/executions/cb475a8c-51af-4ba9-9e37-caffef78fbb9	\N	\N	\N
159	0e9bd880-c057-4910-b845-cfce3a470fea	input.yaml	data	2025-03-24 18:54:17.446992	Fallido	1	2	/home/runner/workspace/executions/960e14a3-5837-4ace-8e82-2f74a16a17e9	\N	\N	\N
160	1761104a-c2ae-43b8-9ec7-96f4bcf35dfb	input.yaml	data	2025-03-24 19:00:42.42314	Fallido	1	2	/home/runner/workspace/executions/45c669fd-658e-4e86-8149-30fd31ae08ef	\N	\N	\N
161	ef1c7d88-a183-40f4-a07e-a9603a5b7231	input.yaml	data	2025-03-24 19:02:26.06322	Fallido	1	2	/home/runner/workspace/executions/92477d55-e098-4dc4-a298-c161911e1836	\N	\N	\N
162	67cfd7da-448f-425e-bff8-3fec5526cc67	input.yaml	data	2025-03-24 19:08:23.774321	Fallido	1	2	/home/runner/workspace/executions/040578ab-f65e-49c0-8505-3d192e11b37d	\N	\N	\N
163	dda9c465-0e6a-46bd-bf33-a2e66d4794df	input.yaml	data	2025-03-24 19:11:01.701665	Fallido	1	2	/home/runner/workspace/executions/11b9a34f-51f3-443e-be9e-2662b82a6cc3	\N	\N	\N
164	135d36d7-fad8-44db-b649-32652b0928f6	input.yaml	data	2025-03-24 19:13:41.088641	Fallido	1	2	/home/runner/workspace/executions/c0ee4335-b50d-4023-a8c5-f2779dc443b7	\N	\N	\N
165	86a95d2c-7e8e-4a01-8cf1-dde542b80337	input.yaml	data	2025-03-24 19:21:26.047414	Fallido	1	2	/home/runner/workspace/executions/57d7a4be-a8d4-4f17-94dc-1c5c69cb016d	\N	\N	\N
166	d948ec90-534f-4d63-b3b7-1da2c5770f0e	input.yaml	data	2025-03-24 19:23:49.757345	Fallido	1	2	/home/runner/workspace/executions/012af93c-634d-4cc7-b552-8169f4403e5a	\N	\N	\N
167	b0f97cbf-2ad7-4e22-829c-3ba73bc92084	input.yaml	data	2025-03-24 20:08:04.422608	Fallido	1	2	/home/runner/workspace/executions/90f45539-6ee0-41ea-a36a-f307681e3107	\N	\N	\N
168	a5141f50-c2ad-47ee-b479-d0fe2b3fe0f6	input.yaml	data	2025-03-24 20:19:54.942945	Fallido	1	2	/home/runner/workspace/executions/80e7e220-e9eb-4140-8930-576435490644	\N	\N	\N
169	3fa62c94-819d-4ea1-8c3c-922975ab0c6f	input.yaml	data	2025-03-24 20:40:08.310511	Fallido	1	2	/home/runner/workspace/executions/a280cb55-6f76-459e-af4c-69c31ab7f2b9	\N	\N	\N
170	c82c2f3c-b986-4b1e-b68b-aca0784507ae	input.yaml	data	2025-03-24 20:56:35.184849	Fallido	1	2	/home/runner/workspace/executions/fb8cc7df-4193-48b4-b429-9e851b2aadd8	\N	\N	\N
171	60f30b73-743a-441c-89cd-25f198b165a8	input.yaml	data	2025-03-24 21:02:36.305058	Fallido	1	2	/home/runner/workspace/executions/45a866d5-4bce-4a7d-b58b-f9f6661d5540	\N	\N	\N
172	6325e436-1328-4720-bfda-68261b9d6c10	input.yaml	data	2025-03-24 21:03:41.385634	Fallido	1	2	/home/runner/workspace/executions/4bc59b10-e6e2-4f22-83fa-c1ef623ae17e	\N	\N	\N
174	7f662650-e278-43d8-8a3c-9fc508b9387c	input.yaml	data	2025-03-24 21:18:37.987437	Fallido	1	2	/home/runner/workspace/executions/ea30f2d2-59b2-4f97-b73e-b0d6ee0794b9	\N	\N	\N
175	e9cb7f50-d46d-4336-8318-b4a53dca499b	input.yaml	data	2025-03-24 21:21:37.57647	Fallido	1	2	/home/runner/workspace/executions/ac4488a5-e264-437b-bc79-423fc6df9ff1	\N	\N	\N
176	7940cf8f-22e5-4e1d-82a6-8496d4407c25	input.yaml	data	2025-03-24 21:33:55.34065	Fallido	1	2	/home/runner/workspace/executions/22050f12-c897-4731-93bd-61797d46d9df	\N	\N	\N
177	37a524f1-b10b-40ca-9778-b81b8fae98cd	input.yaml	data	2025-03-24 21:36:14.813054	Fallido	1	2	/home/runner/workspace/executions/ebecdacc-f06c-45f8-978e-1b9f17cd3369	\N	\N	\N
178	eaaae3c2-90d3-4de1-bfbb-24bb181705e1	input.yaml	data	2025-03-24 21:37:35.765015	Fallido	1	2	/home/runner/workspace/executions/a38ceb0a-7354-404c-b39a-7b960b349c09	\N	\N	\N
179	b819c16e-9bf5-40f1-9e66-6b5cba619dbb	input.yaml	data	2025-03-24 21:50:16.047755	Fallido	1	2	/home/runner/workspace/executions/afbc2b5b-f502-4312-8566-dcf2bc205be5	\N	\N	\N
180	22fad400-a274-43d4-8883-579ef6f2fff0	input.yaml	data	2025-03-24 21:51:33.453549	Fallido	1	2	/home/runner/workspace/executions/84f4d1c0-b864-40b7-ad5a-930e57c153b3	\N	\N	\N
181	0605621e-0a39-4497-bd48-f54ef320963c	input.yaml	data	2025-03-24 22:02:21.016568	Fallido	1	2	/home/runner/workspace/executions/7e3df428-1c0b-4a1a-b373-51b9ffec3793	\N	\N	\N
182	a17d1b12-67f7-41c2-bc8e-da1195e42dbd	input.yaml	data	2025-03-24 22:03:46.637444	Fallido	1	2	/home/runner/workspace/executions/35b1825c-6c67-4b88-ab35-159b33f638ba	\N	\N	\N
183	5eba9756-2451-4d67-8529-6955b77defdc	input.yaml	data	2025-03-24 22:13:46.746091	Fallido	1	2	/home/runner/workspace/executions/27c0bd96-bf35-48cd-96e4-fcd2aa27983f	\N	\N	\N
184	8e9e4e8b-99fd-4eb1-872b-9c0e4b0f2fb3	input.yaml	data	2025-03-24 22:15:56.763153	Fallido	1	2	/home/runner/workspace/executions/c70623f1-298b-4188-9cd1-1d10532841d7	\N	\N	\N
185	db08d184-8412-4eb3-9a09-5dfa56970d4c	input.yaml	data	2025-03-24 22:20:34.964791	Fallido	1	2	/home/runner/workspace/executions/bdf5c1c3-77d4-48bc-af64-609f3facf60f	\N	\N	\N
186	2b4cbd9c-b958-47b9-8646-c1f16f2a0585	input.yaml	data	2025-03-24 22:21:58.715365	Fallido	1	2	/home/runner/workspace/executions/ac874bb6-61e9-430c-971b-4ae703d08c5f	\N	\N	\N
187	6639b21d-a6e7-405d-95f9-3251f7557811	input.yaml	data	2025-03-24 22:25:36.315987	Fallido	1	2	/home/runner/workspace/executions/d0f2469d-85e9-40e9-b830-51b18447c5fc	\N	\N	\N
188	0783c409-9b62-4a3e-a7f1-14a7ccdc5e06	input.yaml	data	2025-03-24 22:30:20.168007	Fallido	1	2	/home/runner/workspace/executions/e4be4c67-d9dc-4e89-86f8-7050d26c32fe	\N	\N	\N
189	05e79d69-7261-4831-83ea-45b73edb46cd	input.yaml	data	2025-03-24 22:32:30.961115	Fallido	1	2	/home/runner/workspace/executions/01a4fbec-edd9-4a62-af5a-d58f1b8d169d	\N	\N	\N
190	20977171-198a-4b0f-bcc1-681b882f669b	input.yaml	data	2025-03-24 22:33:27.039274	Fallido	1	2	/home/runner/workspace/executions/9859f23f-57f5-4223-84a5-7ac38d41cdc0	\N	\N	\N
191	00114b36-4980-4e26-946b-ff4870be74ca	input.yaml	data	2025-03-24 22:38:35.406455	Fallido	1	2	/home/runner/workspace/executions/a10f9dc0-9d5f-4b2e-8902-375227681e3a	\N	\N	\N
192	05350ec9-cdbe-4e31-818d-7e0d3e169f35	input.yaml	data	2025-03-24 22:42:39.795362	Fallido	1	2	/home/runner/workspace/executions/3ad11e61-b305-44d0-b583-cdc9c2e43c40	\N	\N	\N
193	53d3f263-527f-44e8-8755-45d8443d28c7	input.yaml	data	2025-03-24 22:45:04.023102	Fallido	1	2	/home/runner/workspace/executions/b6f026d2-964d-4332-b920-7402e5c150cf	\N	\N	\N
194	9bf14c5b-c3a8-4337-a99e-1abcb5f4be68	input.yaml	data	2025-03-24 22:46:58.859362	Fallido	1	2	/home/runner/workspace/executions/999d678c-47e9-4e1c-a523-babb6b147b5e	\N	\N	\N
195	70b59192-c612-4b6a-9750-3e7cd837acaf	input.yaml	data	2025-03-24 22:49:15.91837	Fallido	1	2	/home/runner/workspace/executions/a7783d86-f214-4655-bfe2-eea13d040352	\N	\N	\N
196	d035961d-127d-467f-a5f2-aaf74265600a	input.yaml	data	2025-03-24 22:53:41.464846	Fallido	1	2	/home/runner/workspace/executions/a6db57d5-a904-4185-9c11-06088e8bfa80	\N	\N	\N
197	d36f6c5a-0f1d-41b1-b7da-699535aeead8	input.yaml	data	2025-03-24 22:57:19.361528	Fallido	1	2	/home/runner/workspace/executions/ea9c0cfe-d0bb-4bc4-92da-2aecf22b03ad	\N	\N	\N
198	f686345e-62dd-4799-9beb-9d61c2678fc1	input.yaml	data	2025-03-24 22:58:39.682643	Fallido	1	2	/home/runner/workspace/executions/e0ec0bd1-f1fa-4665-87df-31cb26823ec2	\N	\N	\N
199	032775c0-7641-4574-943f-edfd01ec1104	input.yaml	data	2025-03-24 23:26:01.441642	Fallido	1	2	/home/runner/workspace/executions/41853142-ac4d-400d-a5dd-1dc07e40ac42	\N	\N	\N
200	514f0f67-7eea-413b-9438-382465dccd73	input.yaml	data	2025-03-24 23:31:37.455199	Fallido	1	2	/home/runner/workspace/executions/fd688281-6595-4547-8831-bb7538d0303a	\N	\N	\N
201	de80438a-7bb6-493d-93a5-09470c2da6f9	input.yaml	data	2025-03-24 23:33:57.000338	Fallido	1	2	/home/runner/workspace/executions/2bf2cb63-778e-4cee-b852-a72fb36f0a6e	\N	\N	\N
202	b2c6d2c6-63c5-485a-a2d2-9c69aed54f1a	input.yaml	data	2025-03-24 23:50:17.480258	Fallido	1	2	/home/runner/workspace/executions/ded9f61e-2f0b-4ce2-8cdc-d781c30b439e	\N	\N	\N
203	061633c1-8a85-4b5f-9047-47cfacb3ac41	input.yaml	data	2025-03-24 23:54:23.822579	Fallido	1	2	/home/runner/workspace/executions/33f97e53-55e0-4cf1-b42e-bc94b385512f	\N	\N	\N
204	ecf3ad96-d58e-4471-959b-bcdb7141c97c	input.yaml	data	2025-03-24 23:56:28.217037	Fallido	1	2	/home/runner/workspace/executions/d2058149-5816-4673-b2aa-586f076a8823	\N	\N	\N
205	74fffa46-03de-43e0-bb4f-04f8cd6042b9	input.yaml	data	2025-03-24 23:58:11.08086	Fallido	1	2	/home/runner/workspace/executions/2be8d822-335e-489f-81bc-ca78fa6eefb5	\N	\N	\N
206	06d546d9-3c46-4d71-b4d7-e22c3dd3dbd7	input.yaml	data	2025-03-25 00:00:51.232101	Fallido	1	2	/home/runner/workspace/executions/3f2db23b-8886-4891-8928-d0c7e5dbb009	\N	\N	\N
207	67ad8068-1cfb-4f97-9d17-271729a46a69	input.yaml	data	2025-03-26 15:42:01.939691	Fallido	1	2	/home/runner/workspace/executions/f4cd4361-e59a-44bb-abcc-9388572fbeab	\N	\N	\N
208	5bf196e7-64d7-4154-88f0-94e509d69e04	input.yaml	data	2025-03-26 15:44:57.851192	Fallido	1	2	/home/runner/workspace/executions/2c8e00db-466c-4959-b0d3-487f8a30d5bf	\N	\N	\N
209	9be79aa7-08a2-4eae-949e-b2057e6ae65b	input.yaml	data	2025-03-26 15:52:09.665655	Fallido	1	2	/home/runner/workspace/executions/b8c94d6e-68c5-4e04-8618-ff083d2146f8	\N	\N	\N
210	42331e4d-8536-4a2c-a232-657f60237276	input.yaml	data	2025-03-26 15:53:43.817731	Éxito	0	0	/home/runner/workspace/ejemplos/executions/3fb775ea-a373-4bc5-bf48-1e746cfee601	\N	\N	\N
213	823b5cf0-e58a-482c-a208-3fb519d975e4	input.yaml	data	2025-03-26 15:53:47.270214	Éxito	0	0	/home/runner/workspace/ejemplos/executions/88bfa3fd-a463-406c-b8c6-eb8b2cd1e7ac	\N	\N	portal_upload
216	d70377ce-c21e-4770-b6a5-241840c3a841	input.yaml	data	2025-03-26 15:53:58.714484	Fallido	1	2	/home/runner/workspace/executions/71eb7fdf-b9b7-40c2-80ca-0423eb45f40c	\N	\N	\N
218	2518d0d2-0e3f-4827-8c4d-76fa04bb0037	input.yaml	data	2025-03-26 16:01:42.066515	Éxito	0	0	/home/runner/workspace/ejemplos/executions/82bd8fe2-6a4b-463b-8778-3da63718cee7	46	10	portal_upload
219	c310e511-94f6-45b0-a57b-ce393c5176f8	input.yaml	data	2025-03-26 16:03:28.654295	Fallido	1	2	/home/runner/workspace/executions/954ee9ff-cb05-4550-ae67-6422ee80e7ab	\N	\N	\N
220	1ea03870-5868-4566-8707-1c24911aad0a	input.yaml	data	2025-03-26 16:05:31.798993	Éxito	0	0	/home/runner/workspace/ejemplos/executions/2faa31c6-e78a-4929-ba19-6b7bf365c06c	46	\N	portal_upload
221	1c9b5106-5f14-490b-a23e-6072d8e25a6c	input.yaml	data	2025-03-26 16:11:22.92285	Éxito	0	0	/home/runner/workspace/ejemplos/executions/6d3898e6-8444-4a6a-8f6c-79268d280c59	46	18	portal_upload
222	10ccdb63-2e2d-4d19-a61b-7da1496e6bef	input.yaml	data	2025-03-26 16:18:03.09163	Éxito	0	0	/home/runner/workspace/ejemplos/executions/96a91375-e804-43d6-a637-6198f7d9c306	46	18	portal_upload
223	fae966a6-e199-48cc-9574-dcd49f0a5a3a	input.yaml	data	2025-03-26 16:18:10.809978	Fallido	1	2	/home/runner/workspace/executions/a65c0b9e-1206-46ff-bfd8-cd51ad335378	\N	\N	\N
224	f83b0f23-efa4-48c6-b53b-c9478886f832	input.yaml	data	2025-03-26 16:22:36.405244	Parcial	0	0	/home/runner/workspace/ejemplos/executions/50bf04e5-c38a-4656-99e0-b366dc3e5eb0	\N	18	portal_upload
225	28e3b59f-50d3-4fd6-a70c-8d6f8307b64e	input.yaml	data	2025-03-26 16:23:18.725094	Parcial	0	0	/home/runner/workspace/ejemplos/executions/6d0ba4c5-3758-4df9-a63a-73bcb79e998b	\N	\N	portal_upload
226	4e1ca127-8e6c-435d-a978-050714b5235f	input.yaml	data	2025-03-26 16:33:46.368889	Fallido	1	2	/home/runner/workspace/executions/33826f73-0bad-4971-a214-44b5124a7ce4	\N	\N	\N
227	dd80c43f-3641-4015-8ba0-459f3967d26e	input.yaml	data	2025-03-26 16:57:06.838068	Fallido	1	2	/home/runner/workspace/executions/8dc5516a-52df-46b8-8b6e-5beb285c7b7f	\N	\N	\N
228	cdff8354-7ac4-4685-8ee9-4046e28fd45a	input.yaml	data	2025-03-26 17:15:41.107683	Fallido	1	2	/home/runner/workspace/executions/4143914f-8e60-414c-bdec-57337ad0219f	\N	\N	\N
229	7d491e1b-2cc6-4621-b163-0dc53fcd77eb	input.yaml	data	2025-03-26 17:20:04.741755	Fallido	1	2	/home/runner/workspace/executions/775336bc-f2ed-43e8-b037-a39fbf7ba95d	\N	\N	\N
230	9358ce3a-e6aa-4890-a9cb-f27bdf7ede39	input.yaml	data	2025-03-26 17:25:23.234051	Fallido	1	2	/home/runner/workspace/executions/dd78b15c-2086-43b5-914f-bd40330c76aa	\N	\N	\N
232	b795800b-e14f-4cff-b5f1-38d50a85cd0e	input.yaml	data	2025-03-26 17:29:25.264964	Fallido	1	0	/home/runner/workspace/executions/c4f0e21c-dbd0-44a2-a5cb-24c036f9f1c2	\N	\N	\N
233	35b8b4fc-0ffc-4cc5-80e0-8c90c3592d07	input.yaml	data	2025-03-26 17:30:31.97823	Fallido	1	2	/home/runner/workspace/executions/a81bcee4-e2a6-42e5-8eaa-d0dcd0d1d6ca	\N	\N	\N
234	03b8414f-ee5a-4996-aae7-8d42721fb7c1	input.yaml	data	2025-03-26 17:35:13.918509	Fallido	1	0	/home/runner/workspace/executions/90812c9b-708e-4dd2-acf0-f7533f02c10a	46	\N	portal_upload
235	c069fb68-9d15-4a9d-86c2-26dd513d1787	input.yaml	data	2025-03-26 17:35:24.862749	Fallido	1	0	/home/runner/workspace/executions/c4af443f-f35b-4493-8d71-4a4289bb4685	45	17	portal_upload
236	20bc1b98-2046-461c-a6e4-b2cb3e7c046d	input.yaml	data	2025-03-26 17:35:34.85095	Fallido	1	0	/home/runner/workspace/executions/e23b7748-828f-4ad6-a3e3-ea344b82622b	44	13	portal_upload
237	bbb18a08-d444-4c9e-ab52-5b3c41dfb1d3	input.yaml	data	2025-03-26 17:35:55.829482	Fallido	1	0	/home/runner/workspace/executions/915b6e9d-a4f4-4bd8-81a3-917c3a5c92a6	45	17	portal_upload
238	062750e3-9269-4690-8204-c18388a25477	input.yaml	data	2025-03-26 17:39:39.02969	Fallido	1	2	/home/runner/workspace/executions/33ee760d-ca14-4134-9023-15350b117ebd	\N	\N	\N
239	46c3a318-dee3-456a-903b-73c1f4341d1a	input.yaml	data	2025-03-26 17:39:42.096559	Fallido	1	0	/home/runner/workspace/executions/ca12b1e1-f48b-42f0-9454-2854213e4dd8	\N	\N	\N
240	ea5f9cd7-9a0b-4d2a-8072-472c2ff5025d	input.yaml	data	2025-03-26 17:41:59.698628	Fallido	1	0	/home/runner/workspace/executions/947e39e5-714f-428e-beed-dd0b9a60deaa	46	\N	portal_upload
241	a04fe8a5-5f38-4900-aca7-3481e871a18f	input.yaml	data	2025-03-26 17:42:14.748757	Fallido	1	0	/home/runner/workspace/executions/9918eb4e-8989-4077-99dc-947c36dc53dc	43	\N	portal_upload
242	8120f9fd-a6d4-4366-a1ba-9edfcb4999c6	input.yaml	data	2025-03-26 17:42:54.816391	Fallido	1	0	/home/runner/workspace/executions/949f096e-7fe1-42e9-bcfd-9397e1d740c0	45	\N	portal_upload
243	d8e11258-73d5-4188-832d-24b794bb55bd	input.yaml	data	2025-03-26 17:46:08.530026	Fallido	1	2	/home/runner/workspace/executions/13e0c009-8db2-4f0f-bb4d-713819f3c274	\N	\N	\N
244	a4236f3d-d0d1-4071-b2cf-2ef638539604	input.yaml	data	2025-03-26 17:46:13.718208	Fallido	1	0	/home/runner/workspace/executions/b49f8814-c1d2-4794-b4e6-c58fea4265c0	\N	\N	\N
245	fc2ff1fa-26cb-456e-b698-88d387bf9b2c	input.yaml	data	2025-03-26 17:50:10.785574	Fallido	1	2	/home/runner/workspace/executions/f6411f88-ceb9-4161-b426-614736333814	\N	\N	\N
246	6e2af537-3392-4081-858e-c84addbd6b27	input.yaml	data	2025-03-26 17:50:14.695278	Fallido	1	0	/home/runner/workspace/executions/296e3186-1d35-4108-8e95-9172f63a8917	\N	\N	\N
247	a7ff6f27-b65f-4b71-8da7-401268a95fcb	input.yaml	data	2025-03-26 18:18:19.469975	Fallido	1	0	/home/runner/workspace/executions/4f078e54-5821-4fe3-ad29-269090a6e1a9	45	\N	portal_upload
248	c9f007b6-1f67-41cb-bb27-f9f3db88d948	input.yaml	data	2025-03-26 18:28:07.293644	Fallido	1	2	/home/runner/workspace/executions/87bb28a5-58f2-4e59-9f73-c883c50009f8	\N	\N	\N
249	5e452e0d-88a5-43e0-abeb-ffaadcd4a01f	input.yaml	data	2025-03-26 18:28:25.04339	Fallido	1	0	/home/runner/workspace/executions/d3c95a02-b6ed-4451-b350-d802bc313d23	\N	\N	\N
250	3bc13f82-9aa3-49fc-bdd8-412e27ef7b99	input.yaml	data	2025-03-26 20:00:52.398533	Fallido	1	2	/home/runner/workspace/executions/c50d3aa2-f3da-477d-8172-845b49f10eea	\N	\N	\N
251	51a1083f-8d8f-4df5-adf0-86d39c502291	input.yaml	data	2025-03-26 20:00:53.690224	Fallido	1	0	/home/runner/workspace/executions/e24f0151-28da-476c-b847-68f18db5b18a	\N	\N	\N
252	092ba139-413d-416e-930a-2a70695857a3	input.yaml	data	2025-03-26 20:12:57.150107	Fallido	1	2	/home/runner/workspace/executions/1d003963-ed9b-46ed-b4a6-6ce94d3c2a80	\N	\N	\N
253	92073f40-c62a-4582-937c-d2918b89d1e3	input.yaml	data	2025-03-26 20:13:55.426356	Fallido	1	0	/home/runner/workspace/executions/8634b0f2-6c75-4fe4-bb9a-7ed9895e36a9	\N	\N	\N
254	b50f4b8f-7c09-4c6b-9ed4-a184a67c0d18	input.yaml	data	2025-03-26 20:15:41.63519	Fallido	1	2	/home/runner/workspace/executions/d8f01514-f114-4336-8928-888dc38bff44	\N	\N	\N
255	e243a9c4-7568-40c5-a81e-1067cc640073	input.yaml	data	2025-03-26 20:15:46.927785	Fallido	1	0	/home/runner/workspace/executions/ac9c86f1-2b80-48c3-9795-54759bf5b8ec	\N	\N	\N
256	44882ced-4706-4660-976c-b9ee5d9eb98d	input.yaml	data	2025-03-26 20:18:08.544489	Fallido	1	2	/home/runner/workspace/executions/e25020f4-bfd4-4c38-9860-9d17761a47ad	\N	\N	\N
257	36c45ab4-c2a3-4364-8c1b-a9d90a701420	input.yaml	data	2025-03-26 20:18:29.168379	Fallido	1	0	/home/runner/workspace/executions/0852a3bd-98bd-4326-98a0-0e4f99a2a2d3	\N	\N	\N
258	4e258e9c-4369-41d2-bf04-3f299b984a92	input.yaml	data	2025-03-26 20:20:36.704282	Fallido	1	2	/home/runner/workspace/executions/53eef0f0-f2ec-4524-8e9b-2c9b04dd223d	\N	\N	\N
259	8921abd2-aafd-4cef-b49d-8fa385b3f32a	input.yaml	data	2025-03-26 20:20:40.946193	Fallido	1	0	/home/runner/workspace/executions/79b7fbac-5728-4b5b-9543-8b378bbd6277	\N	\N	\N
260	aaeb8899-c296-4778-a0ab-b7bb354be14c	input.yaml	data	2025-03-26 20:24:40.962359	Fallido	1	0	/home/runner/workspace/executions/396162a6-3e4f-4088-9840-9b301fdd209a	46	\N	portal_upload
261	fcb83a54-d206-4bc0-b4cf-2f26b3b63a0a	input.yaml	data	2025-03-26 20:38:32.119277	Fallido	1	2	/home/runner/workspace/executions/134443b7-55f7-4e77-8b50-216d944cbb13	\N	\N	\N
262	5f651f4e-49ee-421d-bab3-0f104548f601	input.yaml	data	2025-03-26 20:38:35.970997	Fallido	1	0	/home/runner/workspace/executions/700a2f2e-bad5-4e8f-9ff8-ee769278e7df	\N	\N	\N
263	f39b0de3-813b-479f-ad5d-43a04708765e	input.yaml	data	2025-03-26 20:40:55.632889	Fallido	1	2	/home/runner/workspace/executions/b52afaa9-a207-466c-829d-ff137588d137	\N	\N	\N
264	e087ef02-0733-4e5c-97a7-b80cf66e515c	input.yaml	data	2025-03-26 20:40:59.959261	Fallido	1	0	/home/runner/workspace/executions/278a2ba6-9ddd-4c24-989b-709a3358402d	\N	\N	\N
265	91db264f-703e-4d84-8588-d3ccf7222ac1	input.yaml	data	2025-03-26 20:45:44.821197	Fallido	1	2	/home/runner/workspace/executions/4cb97fb1-9270-4efe-81f8-443d4d89d1e1	\N	\N	\N
266	e71004b5-885f-4681-a4f0-f41f5638955a	input.yaml	data	2025-03-26 20:45:48.725249	Fallido	1	0	/home/runner/workspace/executions/cf206d85-8cf7-4a70-a650-5a4cc524695e	\N	\N	\N
267	9e1fb583-5336-4bb1-9834-ac513038ce58	input.yaml	data	2025-03-26 20:47:46.712605	Fallido	1	2	/home/runner/workspace/executions/cd0cb946-7a7c-4908-a33f-11847234961d	\N	\N	\N
268	1a6d74ed-bbd6-45b0-9061-a580cf0b3d5b	input.yaml	data	2025-03-26 20:47:52.410235	Fallido	1	0	/home/runner/workspace/executions/92fc209e-fae3-4efa-9247-fa7d74efacd8	\N	\N	\N
269	e3315713-6221-4d3f-9d0c-c148dc1a96fa	input.yaml	data	2025-03-26 20:50:36.916946	Fallido	1	2	/home/runner/workspace/executions/ee028c10-691e-4f2a-bbdf-780fbd8b82b2	\N	\N	\N
270	58ec9884-99be-4aba-8cdc-33806a3d2c72	input.yaml	data	2025-03-26 20:50:41.348698	Fallido	1	0	/home/runner/workspace/executions/3599c5cc-c5ea-42cb-a5f1-93bed468d7c9	\N	\N	\N
271	d82cd5c2-c718-44a5-ade6-432a51ee7bdf	input.yaml	data	2025-03-26 20:52:03.970206	Fallido	1	2	/home/runner/workspace/executions/42b583ee-9cd1-41b9-b82f-2d7e2584133b	\N	\N	\N
272	7ce2f8ba-0aac-4877-b26a-e1509f39a393	input.yaml	data	2025-03-26 20:52:07.967725	Fallido	1	0	/home/runner/workspace/executions/b34509e6-4124-43ea-bd4e-8ad9ef86d9aa	\N	\N	\N
273	4d5945fc-dee9-41a0-a2f0-ea99ca774a71	input.yaml	data	2025-03-26 20:54:33.423988	Fallido	1	2	/home/runner/workspace/executions/14fda4c9-3cef-48eb-9263-e07aebe97310	\N	\N	\N
274	bc967235-9166-45e2-9466-ecc29d5c4913	input.yaml	data	2025-03-26 20:54:37.716994	Fallido	1	0	/home/runner/workspace/executions/d880522a-d83f-44e3-a6b9-3c3d49e8feb8	\N	\N	\N
275	4fcebfb3-9913-48f2-9ba5-fe1872c68ac4	input.yaml	data	2025-03-26 21:12:42.329436	Fallido	1	2	/home/runner/workspace/executions/2f698059-7bc8-4ea3-9ab8-e760e49e4d53	\N	\N	\N
276	2f2d7c8b-b689-4bb3-b5ff-f4daba72a298	input.yaml	data	2025-03-26 21:12:46.424355	Fallido	1	0	/home/runner/workspace/executions/3c0f1be0-0b38-46d5-9c6b-312594e0aa98	\N	\N	\N
277	7f5d1676-0205-48dd-9969-ba9c25da2c81	input.yaml	data	2025-03-26 21:18:54.802409	Fallido	1	2	/home/runner/workspace/executions/e6915c50-41d7-49ba-be49-a8874da54f97	\N	\N	\N
278	cb92114c-dfde-4c3d-9246-b5a7f8843fc2	input.yaml	data	2025-03-26 21:19:04.284601	Fallido	1	0	/home/runner/workspace/executions/79e05ff2-c477-4f13-8603-aff9c37ab22b	\N	\N	\N
279	d7a9acfc-9c75-47da-bfc0-a3aea6030819	input.yaml	data	2025-03-26 21:19:40.728709	Fallido	1	2	/home/runner/workspace/executions/6dab9fe8-0dac-4eda-898b-c1c42df137c9	\N	\N	\N
280	d152b66d-4fe7-4df9-81c1-e74cfcd0f542	input.yaml	data	2025-03-26 21:19:47.900113	Fallido	1	0	/home/runner/workspace/executions/4342cf91-5a44-450f-9fc7-8258c05bbca3	\N	\N	\N
281	c46f28f5-f134-4edf-9799-ee02cf30e611	input.yaml	data	2025-03-26 21:40:27.843739	Fallido	1	2	/home/runner/workspace/executions/360af63b-865b-4be8-8b7e-57781b1bfbcf	\N	\N	\N
282	b08c2311-4ab9-4e02-a891-7b706c744e1d	input.yaml	data	2025-03-26 21:40:30.641871	Fallido	1	0	/home/runner/workspace/executions/721b4f18-c949-4f38-af07-4b2ea050e1b6	\N	\N	\N
283	d683bcae-bd9c-487a-8ca1-84d16d0dc374	input.yaml	data	2025-03-26 21:55:15.996612	Fallido	1	2	/home/runner/workspace/executions/8b738aba-baad-44fd-9b2e-5a9a4805ad4e	\N	\N	\N
284	7ed6b8a8-b39d-4205-806e-0eff2c0d4ae9	input.yaml	data	2025-03-26 21:55:18.62874	Fallido	1	0	/home/runner/workspace/executions/ae8a02a7-f913-407f-be39-f771b0d15f45	\N	\N	\N
285	57015003-e45a-4ef1-8010-3eb0ef40f9aa	input.yaml	data	2025-03-26 22:02:35.701152	Fallido	1	2	/home/runner/workspace/executions/92c3e774-2c87-48f8-9174-155764f4f86c	\N	\N	\N
286	988e99bc-c311-4e8f-938d-68f9b6f6a3dd	input.yaml	data	2025-03-26 22:03:13.432968	Fallido	1	0	/home/runner/workspace/executions/ea8cb945-77f5-456c-9fbc-6c12b1a05511	\N	\N	\N
287	85a5617d-bd63-428d-9666-e4632ce62a48	input.yaml	data	2025-03-26 22:04:36.62105	Fallido	1	2	/home/runner/workspace/executions/d8da1668-2318-4d3e-ac91-303ad0d7ff77	\N	\N	\N
288	36ce9165-c341-4094-bcfa-db587b6b8d67	input.yaml	data	2025-03-26 22:04:40.097677	Fallido	1	0	/home/runner/workspace/executions/46f06249-361e-4101-ab3a-de84dd467067	\N	\N	\N
289	a7e07f3b-d217-4c42-bd6d-7e9459c1454a	input.yaml	data	2025-03-26 22:11:03.670561	Fallido	1	2	/home/runner/workspace/executions/0619babb-7dea-4b08-8e6f-d6a8aadfc4d1	\N	\N	\N
290	72d09c57-3311-4ffe-a6f6-99367e99d115	input.yaml	data	2025-03-26 22:11:09.39992	Fallido	1	0	/home/runner/workspace/executions/a5d1c857-027d-45ff-83d4-242d1579e9c3	\N	\N	\N
291	1e1ebd60-8419-4da6-88b7-30cd525b7544	input.yaml	data	2025-03-26 22:20:44.206787	Fallido	1	2	/home/runner/workspace/executions/353777ca-6b19-48b9-9c17-211078475278	\N	\N	\N
292	e6d20708-e845-4be2-9a41-8f485a43bde0	input.yaml	data	2025-03-26 22:20:47.461042	Fallido	1	0	/home/runner/workspace/executions/c013767c-42aa-4c46-a650-bf2172b6fc1c	\N	\N	\N
293	21ae3c30-59f4-4f0c-bec0-a3378c697c45	input.yaml	data	2025-03-26 22:26:56.707537	Fallido	1	2	/home/runner/workspace/executions/6a663a02-53f3-447b-af6f-eec84d759ecb	\N	\N	\N
294	4ece100e-7a2b-4f32-b773-3801ac65984c	input.yaml	data	2025-03-26 22:27:00.262289	Fallido	1	0	/home/runner/workspace/executions/07d128e8-c909-4d7a-a397-254274d299a0	\N	\N	\N
295	fbb0dff0-1c5e-4e3a-8f29-852cd147978a	input.yaml	data	2025-03-26 22:29:58.422466	Fallido	1	2	/home/runner/workspace/executions/9fb2570f-3e6b-409c-87af-b8c8824ca2a4	\N	\N	\N
296	57cf6cfb-6af8-4b2e-bede-fb23a6d8aec3	input.yaml	data	2025-03-26 22:30:15.850655	Fallido	1	0	/home/runner/workspace/executions/8f27f297-859e-43fb-8995-0fb56cccf332	\N	\N	\N
297	68537f37-f4b5-4c38-8da6-9d8846624d27	input.yaml	data	2025-03-26 22:35:53.349415	Fallido	1	2	/home/runner/workspace/executions/1ad01a67-d0dd-43df-a7f7-f50df1d0e1b8	\N	\N	\N
298	6b9fdaa0-b2fe-43df-9121-ab36d5ebc479	input.yaml	data	2025-03-26 22:35:53.995812	Fallido	1	0	/home/runner/workspace/executions/4788c625-1b63-4a0d-9dd6-6b9c07ce5f98	\N	\N	\N
299	19f5dd0f-a089-4c9e-a8f4-126a77b28671	input.yaml	data	2025-03-26 22:39:12.542983	Fallido	1	2	/home/runner/workspace/executions/730a0111-e41c-44f6-b11d-3326eeb35540	\N	\N	\N
300	0c0c8202-352f-4071-ae8b-7e416dcc6004	input.yaml	data	2025-03-26 22:39:14.638598	Fallido	1	0	/home/runner/workspace/executions/30bb1093-0ca1-4a23-bdb8-b62f494f4669	\N	\N	\N
301	53405210-05ca-4e59-9a60-b0324fb2a6e1	input.yaml	data	2025-03-26 22:43:02.324417	Fallido	1	2	/home/runner/workspace/executions/e6acfc5d-5b7f-4a77-96fa-9a2c7043ca65	\N	\N	\N
302	fd347d5d-9e89-4330-9d7f-4ec8b0d79b35	input.yaml	data	2025-03-26 22:43:06.132988	Fallido	1	0	/home/runner/workspace/executions/d19f7c79-2627-42d9-82a7-8f28d8a7ddaf	\N	\N	\N
303	323d7aee-565f-426a-a74d-1d05dd2ed4ee	input.yaml	data	2025-03-26 23:14:26.657576	Fallido	1	2	/home/runner/workspace/executions/c552e648-7d17-42c3-b1b1-a87000e10586	\N	\N	\N
304	c0a3cee8-6c0c-4f83-a140-6f85003685ab	input.yaml	data	2025-03-26 23:14:31.725511	Fallido	1	0	/home/runner/workspace/executions/7752b464-63b3-48ae-80b1-02e8f8840f23	\N	\N	\N
305	09be74e7-1807-423f-9f0b-9278c64e5ba0	input.yaml	data	2025-03-26 23:18:00.645187	Fallido	1	2	/home/runner/workspace/executions/511d596d-31c7-47d5-ad18-ffd162f71a5a	\N	\N	\N
306	2692e75c-ead4-43a8-9f9d-ae76909d0aa7	input.yaml	data	2025-03-26 23:18:01.118322	Fallido	1	0	/home/runner/workspace/executions/7dacbb57-6b0a-4161-adb5-89f8f448ce03	\N	\N	\N
307	22329c9e-bd66-43e9-97e6-07e96079153e	input.yaml	data	2025-03-26 23:30:37.699335	Fallido	1	2	/home/runner/workspace/executions/3e37611a-a65f-4d9a-9f24-ffac9cffb989	\N	\N	\N
308	7694d0f1-92bd-48c1-bbd7-9e21dd1a5df4	input.yaml	data	2025-03-26 23:30:40.629222	Fallido	1	0	/home/runner/workspace/executions/fb410888-518c-4519-8e10-7b8bd16f6b05	\N	\N	\N
309	9d7a415f-4d41-48f6-8c40-1bf7f72fc122	input.yaml	data	2025-03-27 02:06:48.28655	Fallido	1	2	/home/runner/workspace/executions/fef5a33c-230f-4175-a00d-cc4f28106998	\N	\N	\N
310	192e16da-954b-4b9e-bc73-df0435f60816	input.yaml	data	2025-03-27 02:08:19.279513	Fallido	1	0	/home/runner/workspace/executions/4b0a43c9-5753-4aa8-b6a2-4bad8df6b26e	\N	\N	\N
311	0a8ed9f2-1762-4b74-8c4b-7c36180ea948	input.yaml	data	2025-03-27 02:08:20.89567	Fallido	1	2	/home/runner/workspace/executions/5b5357fe-9b5d-46a0-80c4-49a466a43812	\N	\N	\N
312	5725f7c7-fbf3-4b5d-b34c-ea6e50844fee	input.yaml	data	2025-03-27 02:12:32.292297	Fallido	1	2	/home/runner/workspace/executions/97e5af8c-7bf3-4eed-a328-53a988e1d68d	\N	\N	\N
313	6902b52b-d526-4708-9039-d8aec1b1faf6	input.yaml	data	2025-03-27 02:12:34.183586	Fallido	1	0	/home/runner/workspace/executions/b8906d63-48d4-420b-8926-c0712dd611f4	\N	\N	\N
314	7ce74af3-57de-4889-9fa5-c25c07702ae2	input.yaml	data	2025-03-27 02:13:50.559003	Fallido	1	2	/home/runner/workspace/executions/4934e650-a539-4c7c-8ad5-920e415f2661	\N	\N	\N
315	71823033-7a44-4b84-a9f3-c9207b296aa1	input.yaml	data	2025-03-27 02:13:51.711058	Fallido	1	0	/home/runner/workspace/executions/809d0dc2-54f0-4149-970c-50e11d07e8fe	\N	\N	\N
316	e5dd49af-c12b-4924-ba9d-e0993e39c5bc	input.yaml	data	2025-03-27 02:15:17.37069	Fallido	1	2	/home/runner/workspace/executions/f2d4a793-e9d9-42e2-bbcd-509fbfaf5587	\N	\N	\N
317	558498b4-784e-4905-a637-2b6eb7674a45	input.yaml	data	2025-03-27 02:15:20.944979	Fallido	1	0	/home/runner/workspace/executions/37e57c70-20c9-4129-8a2b-41dae124ce04	\N	\N	\N
318	92adcb5d-fe23-4719-ac64-0e3838eaf6ec	input.yaml	data	2025-03-27 02:21:25.614732	Fallido	1	2	/home/runner/workspace/executions/c3a3d496-da46-4eea-b1f6-0c0150ee7668	\N	\N	\N
319	afb43897-6400-45df-9d65-85a19ef0574f	input.yaml	data	2025-03-27 02:21:28.166974	Fallido	1	0	/home/runner/workspace/executions/d0f84721-2df2-429d-8b03-adaf560a3ea4	\N	\N	\N
320	3f686359-e5c2-416c-baba-9f91f882f3c3	input.yaml	data	2025-03-27 02:22:33.473651	Fallido	1	2	/home/runner/workspace/executions/ab3d7306-008a-4c1e-b17a-e3fe2f3d0901	\N	\N	\N
321	7c5ff677-7565-4d6e-b93d-8d291262957c	input.yaml	data	2025-03-27 02:22:36.176529	Fallido	1	0	/home/runner/workspace/executions/dffe22ea-669e-4dc0-b65e-b5db4bf4af4d	\N	\N	\N
322	455769eb-5b65-409b-8c7e-f27596eea060	input.yaml	data	2025-03-27 02:32:26.73319	Fallido	1	2	/home/runner/workspace/executions/3b49cb5e-98b4-43c0-a694-54b691cf6513	\N	\N	\N
323	4e02afda-276f-4f8c-ac97-acbee1e3a974	input.yaml	data	2025-03-27 02:33:42.370192	Fallido	1	0	/home/runner/workspace/executions/355a7078-e925-48fe-a936-8488aa5c29e1	\N	\N	\N
324	9fe84242-a7ba-4bde-8216-023aed64a098	input.yaml	data	2025-03-27 20:35:14.836154	Fallido	1	2	/home/runner/workspace/executions/a69b1777-4065-492b-ab99-c76b578cb2cb	\N	\N	\N
325	9b031f83-a342-4251-8fd7-c91f0f3ed505	input.yaml	data	2025-03-27 20:35:19.046818	Fallido	1	0	/home/runner/workspace/executions/e6957ebb-4e7f-4995-b220-1ef671268fba	\N	\N	\N
326	d8607926-f3fc-4ee9-b085-ebf33ec6fa60	input.yaml	data	2025-03-27 20:48:41.887515	Fallido	1	2	/home/runner/workspace/executions/76c65c1a-fd36-4bbe-b858-8e3b4a25a4c6	\N	\N	\N
327	aa327db8-bd80-40a7-ad7f-83e06a7b8658	input.yaml	data	2025-03-27 20:48:48.347224	Fallido	1	0	/home/runner/workspace/executions/bfd25468-bcba-46d6-8ea5-783be121c128	\N	\N	\N
328	ad14ba01-66d0-45df-94b9-e918743a9f74	input.yaml	data	2025-03-27 20:59:18.678577	Fallido	1	2	/home/runner/workspace/executions/665129ba-663d-493c-a372-769afa2fb51e	\N	\N	\N
329	84e1d40f-99a5-424e-98df-28d711760ebe	input.yaml	data	2025-03-27 20:59:21.353623	Fallido	1	0	/home/runner/workspace/executions/230b0076-af81-4100-8554-a6b4bdeb5567	\N	\N	\N
330	cf21c8aa-5c00-4d96-9f7a-125dc5c7ba43	input.yaml	data	2025-03-27 21:02:16.210863	Fallido	1	2	/home/runner/workspace/executions/a6dcbcf5-d7a7-483f-a32c-e90b78796f37	\N	\N	\N
331	acf68e1f-356d-472a-89f7-e9f7f90a59fa	input.yaml	data	2025-03-27 21:02:19.544413	Fallido	1	0	/home/runner/workspace/executions/5f1a402f-c640-4211-b5ea-a3ff31ca70c0	\N	\N	\N
332	5a1c5096-b960-45e4-a1f5-daf64e82b680	input.yaml	data	2025-03-27 21:10:01.285532	Fallido	1	2	/home/runner/workspace/executions/1553965d-c207-4e7a-bb2a-2f5786f3d591	\N	\N	\N
333	a2c7f791-1a6d-4906-834e-3e2fc6df7f1c	input.yaml	data	2025-03-27 21:10:09.727659	Fallido	1	0	/home/runner/workspace/executions/8809d528-a1cf-4117-b25c-7b96525fe74d	\N	\N	\N
334	f5090c30-9246-4343-bcf9-b730cdaa2c99	input.yaml	data	2025-03-27 21:19:54.92272	Fallido	1	2	/home/runner/workspace/executions/41bfb69a-65ba-4aad-b60c-32a8f40d2f0c	\N	\N	\N
335	935095c9-0a77-4ab2-ad9d-899605771380	input.yaml	data	2025-03-27 21:20:01.356337	Fallido	1	0	/home/runner/workspace/executions/cb533562-a4df-4aa8-ab0f-e3c60a958b3a	\N	\N	\N
336	0c27c8a7-18f7-4070-bd33-43bd1e579f75	input.yaml	data	2025-03-27 21:52:11.184752	Fallido	1	2	/home/runner/workspace/executions/c7b3c477-bdc2-4067-8ffa-3a4b29ef3c4f	\N	\N	\N
337	84cf3e93-0924-4ac6-871a-b749f9134d93	input.yaml	data	2025-03-27 21:52:19.565049	Fallido	1	0	/home/runner/workspace/executions/fee08544-7854-4165-990d-677ba1767f27	\N	\N	\N
338	31c553b2-5933-45c7-8427-1ecffff4aba5	input.yaml	data	2025-03-27 21:54:17.128757	Fallido	1	2	/home/runner/workspace/executions/56f24a40-9de6-4947-9767-6e8677e4c846	\N	\N	\N
339	f0aff622-2efa-4b5c-908c-4eff2f1e993e	input.yaml	data	2025-03-27 21:54:21.419121	Fallido	1	0	/home/runner/workspace/executions/c55869b1-605b-47ba-8439-7934776ad03c	\N	\N	\N
340	4f892a18-e15f-47bb-9cb2-cde49aee4185	input.yaml	data	2025-03-27 22:58:28.785636	Fallido	1	2	/home/runner/workspace/executions/b83f43d8-3aaf-4d51-a447-43b8b644416d	\N	\N	\N
341	accdf503-7e3a-4940-9141-67f78c17c60f	input.yaml	data	2025-03-27 22:58:28.831776	Fallido	1	0	/home/runner/workspace/executions/b09d9474-238f-48ea-9cdc-585589564fcf	\N	\N	\N
342	741a3f83-d805-4c98-9197-f30991aaba60	input.yaml	data	2025-03-27 23:51:38.442098	Fallido	1	2	/home/runner/workspace/executions/a15a265a-ef05-4e73-998a-70257d7ef877	\N	\N	\N
343	becc41b7-4a5e-41df-9ec7-a726a51a0fbd	input.yaml	data	2025-03-27 23:51:41.558894	Fallido	1	0	/home/runner/workspace/executions/19929d79-feb8-4c80-8e56-1c4ed486040f	\N	\N	\N
344	c24a79d0-8729-4165-95a0-f8ba29e5f38a	input.yaml	data	2025-03-27 23:55:03.748078	Fallido	1	2	/home/runner/workspace/executions/e90c4b08-d8f8-4ad7-b7a7-0574911d4ee9	\N	\N	\N
345	9bc6605b-bd58-42e6-a3e0-8699b61afa9f	input.yaml	data	2025-03-27 23:55:07.363669	Fallido	1	0	/home/runner/workspace/executions/93f0e12c-382b-457f-bfb1-95ef6cb512a1	\N	\N	\N
346	94068252-c46c-48fc-9f65-fea744810107	input.yaml	data	2025-03-28 00:00:16.073191	Fallido	1	2	/home/runner/workspace/executions/dc18d2f1-497a-4b15-bd60-5ced4dfbe2b3	\N	\N	\N
347	b38214d1-6738-4cc2-a4e3-70f17a218dcf	input.yaml	data	2025-03-28 00:00:18.928704	Fallido	1	0	/home/runner/workspace/executions/96dbd22e-c722-4dc8-a7da-cd3e1e8e4e79	\N	\N	\N
348	cea33361-d4a6-409e-b09e-159df60a78c1	input.yaml	data	2025-03-28 00:09:29.902161	Fallido	1	2	/home/runner/workspace/executions/073d05b9-dcf6-4172-b354-2c8c9bd82d4a	\N	\N	\N
349	c4136c1b-58b8-401c-9db2-416467ad8818	input.yaml	data	2025-03-28 00:09:33.029551	Fallido	1	0	/home/runner/workspace/executions/9d4c55c7-7760-4126-ae92-408de4676f17	\N	\N	\N
350	51b60e22-52d8-4c88-9f1e-e49e59fa8ec9	input.yaml	data	2025-03-28 00:16:51.094242	Fallido	1	2	/home/runner/workspace/executions/1c268230-810e-42d0-bcd4-57f3bb3c0278	\N	\N	\N
351	64905343-a144-4dbc-a9b6-0b3dde0fa010	input.yaml	data	2025-03-28 00:17:16.47431	Fallido	1	0	/home/runner/workspace/executions/35519185-2470-4692-8faa-f05352b5be07	\N	\N	\N
352	512215df-5eaf-41db-9f13-3cc8f4ae17dc	input.yaml	data	2025-03-28 00:30:46.903552	Fallido	1	2	/home/runner/workspace/executions/1520ab1d-3b3a-44a0-953b-b7ae54fc5317	\N	\N	\N
353	8060c763-c4c7-4b36-a882-43c9914a08af	input.yaml	data	2025-03-28 00:30:59.329153	Fallido	1	0	/home/runner/workspace/executions/440c6c65-efa7-4fd8-89a0-2b5cfb5eac4b	\N	\N	\N
354	7bcdf2ce-8234-4cc5-968f-9f1993528ea7	input.yaml	data	2025-03-28 00:39:19.273047	Fallido	1	2	/home/runner/workspace/executions/7d479ffa-4e61-4c00-82af-3906e18cfab3	\N	\N	\N
355	43131832-1e22-4f2a-b2a9-bb079bc42160	input.yaml	data	2025-03-28 00:39:50.791521	Fallido	1	0	/home/runner/workspace/executions/5424b6bd-88fa-4805-917f-80638714d64f	\N	\N	\N
356	75210169-5171-40f0-b256-43bc2688ce0a	input.yaml	data	2025-03-28 00:46:52.717384	Fallido	1	2	/home/runner/workspace/executions/8199996b-ec0d-47c1-9243-8ff783c59118	\N	\N	\N
357	8c7c7381-0c5a-4592-9750-20ac520dc863	input.yaml	data	2025-03-28 00:46:56.175577	Fallido	1	0	/home/runner/workspace/executions/951871c0-72b1-4fd6-b2e2-0a771ceab6d6	\N	\N	\N
358	e9f96f72-433b-4374-abfc-d6c393366079	input.yaml	data	2025-03-28 00:54:35.107921	Fallido	1	2	/home/runner/workspace/executions/add53319-fdfe-41a4-8271-d214e727020b	\N	\N	\N
359	6ff26197-5481-4d81-8118-780ba150b74a	input.yaml	data	2025-03-28 00:54:40.069919	Fallido	1	0	/home/runner/workspace/executions/ade6efee-3265-4af8-8076-b2fb7a211ded	\N	\N	\N
360	088240e9-deb3-44e2-a7e3-bf165db8049b	input.yaml	data	2025-03-28 00:57:18.916317	Fallido	1	0	/home/runner/workspace/executions/fb349a4f-250a-4532-acea-e69bc6dc1ce4	44	\N	portal_upload
361	5264d635-3f22-45ae-a68d-48fe72b69bfa	input.yaml	data	2025-03-28 00:57:22.344455	Fallido	1	0	/home/runner/workspace/executions/70b0794d-c1cc-468f-9754-5c2dff8a1033	44	\N	portal_upload
362	9e2b6d1b-273b-4f78-9809-df073d1c8031	input.yaml	data	2025-03-28 01:01:28.364124	Fallido	1	2	/home/runner/workspace/executions/72463dd2-4427-4b98-9bcb-03a803cbf3a4	\N	\N	\N
363	d055c943-eb71-4932-b887-bfcd25143050	input.yaml	data	2025-03-28 01:01:35.292657	Fallido	1	0	/home/runner/workspace/executions/c7551d94-761a-4449-a826-378e3e46acb5	\N	\N	\N
364	7881adc1-754f-4350-b2fa-9d3ad07ae503	input.yaml	data	2025-03-28 01:02:02.983167	Fallido	1	2	/home/runner/workspace/executions/3cb6cf4d-9594-4bf8-9040-21e320388b27	\N	\N	\N
365	ba7f9bb1-4cfa-4ef9-997f-24a2200c2090	input.yaml	data	2025-03-28 01:02:06.837457	Fallido	1	0	/home/runner/workspace/executions/72421edb-2279-4a4a-9d43-30462038d26e	\N	\N	\N
366	15ccfed1-25bc-4480-b1e1-f7e305bbb0ac	input.yaml	data	2025-03-28 01:05:53.676492	Fallido	1	2	/home/runner/workspace/executions/c89826ac-a59d-4e49-a897-131ebdc2a7d0	\N	\N	\N
367	864c4b51-4330-4a2c-9e15-54fd44cc5657	input.yaml	data	2025-03-28 01:05:57.269637	Fallido	1	0	/home/runner/workspace/executions/f50e42e7-c2d5-475d-8c83-f471a1b7cb34	\N	\N	\N
368	e8ab1da9-e7d3-479a-b2e9-da00e3768765	input.yaml	data	2025-03-28 01:15:25.459644	Fallido	1	2	/home/runner/workspace/executions/1dca7932-cfc5-40be-a83b-4fe61db8a39c	\N	\N	\N
369	a92425bc-079f-48e8-861e-06eed468719b	input.yaml	data	2025-03-28 01:15:33.637251	Fallido	1	0	/home/runner/workspace/executions/e855575a-3f08-4490-a4ca-8d81ba439e42	\N	\N	\N
370	de3d5428-6460-4541-94c9-657a58067c64	input.yaml	data	2025-03-28 01:29:02.746116	Fallido	1	2	/home/runner/workspace/executions/cefb2cb3-26ae-4f8f-a2bd-f29c9930afe5	\N	\N	\N
371	cc10f094-0ee5-4182-81f1-cfdbaa7c12dc	input.yaml	data	2025-03-28 01:29:07.505094	Fallido	1	0	/home/runner/workspace/executions/5d71f410-0813-4ae2-b732-16eca550f50b	\N	\N	\N
372	78d7f3bf-50c1-42fe-8d4d-4a47b0f20056	input.yaml	data	2025-03-28 15:47:04.263684	Fallido	1	2	/home/runner/workspace/executions/a99c259b-b124-436a-9e48-23fd758d1726	\N	\N	\N
373	86c1d849-c124-4a0a-8072-30c30c1ce2e8	input.yaml	data	2025-03-28 15:47:19.113907	Fallido	1	0	/home/runner/workspace/executions/901e006b-b031-45ef-9150-c99bad7d5c53	\N	\N	\N
374	c27ddcf9-3601-4276-88f7-12826698b11d	input.yaml	data	2025-03-28 15:47:33.850989	Fallido	1	2	/home/runner/workspace/executions/da151d30-1ede-49eb-8e23-80ad04b10acb	\N	\N	\N
375	c19b98ee-f7cf-4b9c-b9ad-0a4d4d27193f	input.yaml	data	2025-03-28 15:47:45.752391	Fallido	1	0	/home/runner/workspace/executions/932737b6-9133-40be-862d-1635a754f0e9	\N	\N	\N
376	f21a8b22-ee7a-49a8-b03b-ecb8e3d0d0e9	input.yaml	data	2025-03-28 15:52:20.045269	Fallido	1	2	/home/runner/workspace/executions/8b79beab-64a1-409d-8646-65dc51957099	\N	\N	\N
377	54cac13b-f637-4bfd-9cd2-75bc6212c52c	input.yaml	data	2025-03-28 15:52:23.618478	Fallido	1	0	/home/runner/workspace/executions/4d59fa5d-0bd5-45d3-99ae-8b79bfdb629d	\N	\N	\N
378	67323508-1ce8-491f-8c1e-13e05c4f537c	input.yaml	data	2025-03-28 16:07:23.82608	Fallido	1	2	/home/runner/workspace/executions/8cefeddf-f303-4dd5-9a3a-fc150f81702d	\N	\N	\N
379	ad52acd5-7a71-442b-afc1-d3c04ad5006b	input.yaml	data	2025-03-28 16:07:28.237953	Fallido	1	0	/home/runner/workspace/executions/77ffe5b0-a893-4c35-b49c-7fc51f1be933	\N	\N	\N
380	cb0a3369-9e6d-4b6e-a8a7-cadb0d165b34	input.yaml	data	2025-03-28 16:08:01.99379	Fallido	1	2	/home/runner/workspace/executions/4b4098f9-0625-476c-8089-cf30b77d244c	\N	\N	\N
381	246917a6-28e1-4e54-9ace-d6d1c5ed5355	input.yaml	data	2025-03-28 16:08:05.463842	Fallido	1	0	/home/runner/workspace/executions/14d7a371-5eec-412f-a0df-7d1799afb3bf	\N	\N	\N
382	5e6fb66f-45f6-4841-badc-6db4e75bfc5c	input.yaml	data	2025-03-28 16:12:44.623354	Fallido	1	2	/home/runner/workspace/executions/dab3549d-1a28-48f5-98a7-2cca9147acbe	\N	\N	\N
383	ec092eaa-125d-41fb-8eab-3943effbd114	input.yaml	data	2025-03-28 16:12:48.521937	Fallido	1	0	/home/runner/workspace/executions/2c62131b-163f-43aa-8de0-fd451ad535c4	\N	\N	\N
384	772c1fba-e945-4d4c-8e7f-a8e92d2c6324	input.yaml	data	2025-03-28 17:11:31.471182	Fallido	1	2	/home/runner/workspace/executions/78a2c7e6-5f43-4c0d-9171-b28fd264d820	\N	\N	\N
385	11bcd2df-26d4-4f3f-81a9-17e46056ed59	input.yaml	data	2025-03-28 17:11:36.450122	Fallido	1	0	/home/runner/workspace/executions/42c7ad33-0080-4559-a3d0-57b32f471c4b	\N	\N	\N
386	f6eec525-59fb-4156-b1f0-b7bd837f0cbe	input.yaml	data	2025-03-28 17:12:15.874805	Fallido	1	2	/home/runner/workspace/executions/f0b6ad9e-725c-475f-bb4b-3fd3d9ca13d7	\N	\N	\N
387	c864fd62-14e2-4b54-bb66-012abb21a2da	input.yaml	data	2025-03-28 17:12:22.008533	Fallido	1	0	/home/runner/workspace/executions/ade6c776-f686-416a-95af-fbd5dfc4c943	\N	\N	\N
388	e697fbbb-2acb-48fa-a923-110b3d709ce0	input.yaml	data	2025-03-28 17:14:43.494045	Fallido	1	2	/home/runner/workspace/executions/b0d6b886-ac03-4999-b275-cdf59e34fac0	\N	\N	\N
389	54edfe5d-02af-47ef-a004-b50f03764fa3	input.yaml	data	2025-03-28 17:14:45.121446	Fallido	1	0	/home/runner/workspace/executions/2b29b8d4-bbde-4f03-b93a-8e3639236f5e	\N	\N	\N
390	b5297c6a-dbf4-4b04-aad6-74578fbde95a	input.yaml	data	2025-03-28 17:17:58.237669	Fallido	1	2	/home/runner/workspace/executions/993a4c6e-f3bb-4de8-b8c5-1e2c625b7280	\N	\N	\N
391	bf7769e6-c037-4dbb-b00f-e25102867d9e	input.yaml	data	2025-03-28 17:18:03.533284	Fallido	1	0	/home/runner/workspace/executions/60397deb-340e-4106-9a79-bd9f1282dc90	\N	\N	\N
392	29af7a3c-743c-4356-8fb7-63dd3cf1cbee	input.yaml	data	2025-03-28 17:22:14.202099	Fallido	1	2	/home/runner/workspace/executions/2dddd81e-7935-41ea-a6e4-a0fa8bc0bf40	\N	\N	\N
393	73ec9529-8468-41df-914d-7bdc77ab041a	input.yaml	data	2025-03-28 17:22:19.336448	Fallido	1	0	/home/runner/workspace/executions/19e4a53e-72df-4fa9-9b23-dfb1f05d050b	\N	\N	\N
394	bd5721ff-69ea-44a9-a1b4-0d3e5d2f29a0	input.yaml	data	2025-03-28 17:48:50.281203	Fallido	1	2	/home/runner/workspace/executions/300e7c25-17cd-440f-8eb3-a0659a7ee91e	\N	\N	\N
395	9cb02532-e415-4aef-8c08-4d3467772cb6	input.yaml	data	2025-03-28 17:49:11.975014	Fallido	1	0	/home/runner/workspace/executions/dff20d2b-df3b-4cbf-b515-8c9421093e54	\N	\N	\N
396	4710f95d-e669-44ac-9b4c-f00b124b41e1	input.yaml	data	2025-03-28 18:43:06.422001	Fallido	1	2	/home/runner/workspace/executions/3cff7cf0-360a-497d-84ab-3faeef9d85f4	\N	\N	\N
397	e6c3b460-93ea-4358-9fbd-96b9b5b62e33	input.yaml	data	2025-03-28 18:43:08.856424	Fallido	1	0	/home/runner/workspace/executions/c973affc-02a3-4709-9b75-eb28ec98c6cc	\N	\N	\N
398	f85315d5-bf97-4ec8-a894-6108dd6d0c47	input.yaml	data	2025-03-28 18:47:59.155399	Fallido	1	2	/home/runner/workspace/executions/05ce572e-b439-4000-9114-15eb157cd154	\N	\N	\N
399	30dce9a1-0285-48d9-991d-cb086203f27e	input.yaml	data	2025-03-28 18:48:08.745272	Fallido	1	0	/home/runner/workspace/executions/a0a2e0cb-73cf-4b61-814b-fff224d50c62	\N	\N	\N
400	3cb534a8-4a60-49da-b455-80ede9e2a7a3	input.yaml	data	2025-03-28 18:49:46.992874	Fallido	1	0	/home/runner/workspace/executions/192a290b-3749-4b4e-9481-2942cb3caf6b	46	\N	portal_upload
401	86674b18-6bdd-46bb-8d44-3583326a58f7	input.yaml	data	2025-03-28 18:57:14.428735	Fallido	1	2	/home/runner/workspace/executions/6b57d757-2cbc-4159-97e9-6dddcf020054	\N	\N	\N
402	094c8147-0fb8-47d0-8f04-a0da0f1ef7de	input.yaml	data	2025-03-28 18:57:18.338099	Fallido	1	0	/home/runner/workspace/executions/7b2a4955-f122-423b-b382-080082763fbe	\N	\N	\N
403	69abb8b3-d1fd-4a9c-b152-3a3b6fc42f07	input.yaml	data	2025-03-28 19:04:07.796151	Fallido	1	2	/home/runner/workspace/executions/59d76de2-29d4-419d-91dd-229815580464	\N	\N	\N
404	30109517-f313-4594-b4c3-b07ec47d160e	input.yaml	data	2025-03-28 19:04:11.680734	Fallido	1	0	/home/runner/workspace/executions/339c3046-ac27-4599-bfea-875ca76434e6	\N	\N	\N
405	caa530ec-0592-4b89-970b-de3037d054ae	input.yaml	data	2025-03-28 19:12:22.592683	Fallido	1	2	/home/runner/workspace/executions/36c70abc-96ea-43ed-bd12-323d958f5f0f	\N	\N	\N
406	e041297e-7b84-4371-9e49-98cf79d07c58	input.yaml	data	2025-03-28 19:12:29.959819	Fallido	1	0	/home/runner/workspace/executions/7d24131d-8461-482c-86a0-f43f45f8ec57	\N	\N	\N
407	f7546fa5-ebd6-4685-8191-35af9cbfb31d	input.yaml	data	2025-03-28 19:22:30.911684	Fallido	1	2	/home/runner/workspace/executions/9026ee57-58de-414f-afbd-d87dcc14d688	\N	\N	\N
408	44952fb8-7e5b-40bb-8c52-9c6b2b4c4988	input.yaml	data	2025-03-28 19:22:44.017285	Fallido	1	0	/home/runner/workspace/executions/3e93ef19-9634-44d7-8b84-6024a1169a30	\N	\N	\N
409	ef24d920-b4ee-4e51-b732-a2412631b902	input.yaml	data	2025-03-28 19:29:59.358151	Fallido	1	2	/home/runner/workspace/executions/668df646-ac05-48cb-875d-c0d60b15509c	\N	\N	\N
410	8cc337e8-ec4d-416c-aa76-2ff389ff44e2	input.yaml	data	2025-03-28 19:30:02.223163	Fallido	1	0	/home/runner/workspace/executions/70beef26-43b2-4425-8a21-2240993ab868	\N	\N	\N
411	0e94d9fc-103e-4904-b509-08a653fcc0a7	input.yaml	data	2025-03-28 19:32:14.236163	Fallido	1	2	/home/runner/workspace/executions/dd48db88-9217-4ef1-8f7e-88829f2208cf	\N	\N	\N
412	48a2fe9f-b7eb-4f70-86d9-0de6c6eb86be	input.yaml	data	2025-03-28 19:32:15.685701	Fallido	1	0	/home/runner/workspace/executions/fd9b4c07-6f84-4593-a5e5-a751812401fe	\N	\N	\N
413	3abb5ee0-82cf-41ac-b6da-ff78b405603c	input.yaml	data	2025-03-28 19:41:30.126327	Fallido	1	2	/home/runner/workspace/executions/66b4cda1-393f-4abf-af93-e4899609c771	\N	\N	\N
414	3b91dcff-5752-4ba2-bf77-d42e4596b42d	input.yaml	data	2025-03-28 19:41:33.622047	Fallido	1	0	/home/runner/workspace/executions/76bf102a-489c-4985-8a96-b1057531d41d	\N	\N	\N
415	f086970b-513e-4bbb-aff5-c3732e15bc65	input.yaml	data	2025-03-28 19:50:23.427342	Fallido	1	2	/home/runner/workspace/executions/26efec98-d9bd-45bb-aad9-86372adb4b1f	\N	\N	\N
416	c3b3ac7a-7205-4dfd-a1d9-3a1fbd4d6fa2	input.yaml	data	2025-03-28 19:50:28.993654	Fallido	1	0	/home/runner/workspace/executions/e11aa4a6-3b80-406a-a18c-c8c44f19e24d	\N	\N	\N
417	2a3f14b6-b7e1-4f47-a7e3-f0bb29012cd6	input.yaml	data	2025-03-28 20:01:08.351206	Fallido	1	2	/home/runner/workspace/executions/8e2d9b96-208a-4f05-a2ec-971bc1db1141	\N	\N	\N
418	ba4a190b-6110-4bfd-a886-4f363d3bc33d	input.yaml	data	2025-03-28 20:01:12.44409	Fallido	1	0	/home/runner/workspace/executions/c597e66c-1733-4a42-be87-722de2489ab9	\N	\N	\N
419	8a515d1d-20b8-4dea-bf74-163b224b155d	input.yaml	data	2025-03-28 20:03:05.431687	Fallido	1	0	/home/runner/workspace/executions/6ed95020-e8c8-44c8-9a33-1e604f373a19	45	\N	portal_upload
420	c1920a0d-ab01-4017-9990-d45f6dd8fe44	input.yaml	data	2025-03-28 20:11:36.205716	Fallido	1	0	/home/runner/workspace/executions/a4393a83-a15a-4472-b35d-bf1887e55461	46	\N	portal_upload
421	42ad5d08-3a9f-4824-a359-1cc2a16c9152	input.yaml	data	2025-03-28 20:13:09.417938	Fallido	1	0	/home/runner/workspace/executions/43e131c7-9752-4f96-9ac6-ef319ef0f99a	46	\N	portal_upload
422	c7712d7f-cb48-4370-bab6-e5e43e7f3dcf	input.yaml	data	2025-03-28 20:14:58.086431	Fallido	1	0	/home/runner/workspace/executions/2fa4365f-f972-4611-b7d7-60a30495593b	45	\N	portal_upload
423	1ceb1f96-ea95-4224-8802-78a04ce28958	input.yaml	data	2025-03-28 20:22:25.192018	Fallido	1	0	/home/runner/workspace/executions/0aa9bc95-c6f4-4958-810e-dd835f7150c3	45	20	portal_upload
424	b028e0ec-a396-4e33-bd35-7af4bf5846f1	input.yaml	data	2025-03-28 20:23:04.196866	Fallido	1	0	/home/runner/workspace/executions/27aca841-791e-41d1-a1fe-45befd0e7b2b	44	\N	portal_upload
425	3e417124-3698-4593-add6-a2e42ba057f7	input.yaml	data	2025-03-28 20:33:48.63216	Fallido	1	0	/home/runner/workspace/executions/a166cc5f-031b-4340-ba48-f8d271c9cebb	45	18	portal_upload
426	0d1758bf-145b-41d1-b4f7-c94a60b3478f	input.yaml	data	2025-03-28 21:14:02.40291	Fallido	1	2	/home/runner/workspace/executions/64a0e9fc-fe35-4c8e-af41-89182abfd718	\N	\N	\N
427	c73cf830-d511-4e3d-b010-70be7ba414cf	input.yaml	data	2025-03-28 21:14:07.155454	Fallido	1	0	/home/runner/workspace/executions/91b6d52b-7675-4d19-bcbb-0b18c8aaa8a5	\N	\N	\N
428	84df1b79-97de-4055-902e-20e946c879b5	input.yaml	data	2025-03-28 21:17:57.507335	Fallido	1	2	/home/runner/workspace/executions/c35a2c59-4b5c-4e94-b30e-3541908968fa	\N	\N	\N
429	88e056ef-a6cc-485e-b6ed-549e84f9e69f	input.yaml	data	2025-03-28 21:18:00.819163	Fallido	1	0	/home/runner/workspace/executions/071789de-afcc-43c7-b8b5-a76ef53cbefb	\N	\N	\N
430	d624900c-01b3-452b-b67b-2db940a6cbff	input.yaml	data	2025-03-28 21:55:11.381008	Fallido	1	2	/home/runner/workspace/executions/c3a81422-2417-4e10-af0b-dff9ed1442d4	\N	\N	\N
431	99891644-030e-41a1-8e97-e8c697f8ab5f	input.yaml	data	2025-03-28 21:55:14.258863	Fallido	1	0	/home/runner/workspace/executions/931778f5-93a1-4707-9d1e-082158484c3d	\N	\N	\N
432	eb6e767b-74d1-4582-bde3-29c9f928049e	input.yaml	data	2025-03-28 22:07:57.086105	Fallido	1	2	/home/runner/workspace/executions/9703053d-8be1-47c5-befa-0e3c190de940	\N	\N	\N
433	b3f1c320-7165-4f68-9291-3b6869d5ae08	input.yaml	data	2025-03-28 22:08:00.807608	Fallido	1	0	/home/runner/workspace/executions/d6ebe424-700a-4308-bf7f-d40a93ef59d9	\N	\N	\N
434	bb486f1d-dce0-4fd4-be6c-95666896d78f	input.yaml	data	2025-03-28 22:14:46.514804	Fallido	1	2	/home/runner/workspace/executions/606cee0b-488c-496a-9d80-ad599e221e20	\N	\N	\N
435	45b1f2c1-c1de-4960-8ee2-3c3bbc3eda59	input.yaml	data	2025-03-28 22:14:48.031785	Fallido	1	0	/home/runner/workspace/executions/1e6c1708-2a88-43f0-9adb-1439476b0eda	\N	\N	\N
436	e4cee883-1e44-48e9-8299-7ac6c0a6016d	input.yaml	data	2025-03-28 22:28:36.430767	Fallido	1	2	/home/runner/workspace/executions/56a8ec29-f9e8-42eb-8433-efb4eff296ec	\N	\N	\N
437	3a890434-1efb-4ae6-ba0e-59caaa615b5e	input.yaml	data	2025-03-28 22:28:42.696613	Fallido	1	0	/home/runner/workspace/executions/2fb87127-5f96-4de9-8365-b5dc943e157c	\N	\N	\N
438	a5bec356-9524-4aab-b3d2-75d8762ed78e	input.yaml	data	2025-03-28 22:38:34.283263	Fallido	1	2	/home/runner/workspace/executions/8e8ffe3e-a94b-41b5-a151-f26ebecf0108	\N	\N	\N
439	736351ed-f4bc-4563-a7cb-8383e429aeb6	input.yaml	data	2025-03-28 22:38:38.062075	Fallido	1	0	/home/runner/workspace/executions/021c5f69-6920-476d-a092-5d581786688b	\N	\N	\N
440	d66f7580-dce0-4af2-9f09-5177a9b9ed3b	input.yaml	data	2025-03-28 22:46:50.292143	Fallido	1	2	/home/runner/workspace/executions/e720c430-692b-4205-b851-0e0f92bef099	\N	\N	\N
441	ec415ef4-8e39-4db2-8344-0642ed76db9b	input.yaml	data	2025-03-28 22:46:57.890061	Fallido	1	0	/home/runner/workspace/executions/5b4a8f52-bd7b-4011-a166-28856ff1dc3c	\N	\N	\N
442	1b97af35-e8ab-4ba3-b942-75a6a9af0e59	input.yaml	data	2025-03-28 23:00:15.412097	Fallido	1	2	/home/runner/workspace/executions/52a2e6aa-14bf-412c-bc3d-16aa4dc63d30	\N	\N	\N
443	8816f0d4-7c84-446f-a100-8af205f96ab5	input.yaml	data	2025-03-28 23:00:18.140869	Fallido	1	0	/home/runner/workspace/executions/faf4ca38-bad7-4261-9874-5ac205814d5f	\N	\N	\N
444	cfcceb20-144a-4729-a3d6-243506a3a679	input.yaml	data	2025-03-28 23:16:10.535557	Fallido	1	2	/home/runner/workspace/executions/b23d252a-e7a0-4ff7-ba3b-b5f0f3580f89	\N	\N	\N
445	f68ecfa1-86cc-4307-94be-414d962d131d	input.yaml	data	2025-03-28 23:16:13.034609	Fallido	1	0	/home/runner/workspace/executions/3674c970-47b1-42c9-a537-6d676988ce0d	\N	\N	\N
446	d09cbc4f-fa02-427f-8fda-3f9799670823	input.yaml	data	2025-03-28 23:18:38.706073	Fallido	1	2	/home/runner/workspace/executions/276e9b56-c7d1-4d88-98ca-380e06ba8df8	\N	\N	\N
447	e3892aed-d613-438b-bc29-ac6a137d33eb	input.yaml	data	2025-03-28 23:18:41.938405	Fallido	1	0	/home/runner/workspace/executions/710d5e12-a927-4e61-8359-5a5eb30279ae	\N	\N	\N
448	b478c444-bf75-415b-91c9-48085ca57862	input.yaml	data	2025-03-28 23:25:44.167428	Fallido	1	2	/home/runner/workspace/executions/e6ce49bd-2f88-4e48-88aa-adc33985ece6	\N	\N	\N
449	cd1fb0dd-32cc-41f8-8e16-a5ef6706ef41	input.yaml	data	2025-03-28 23:25:46.707738	Fallido	1	0	/home/runner/workspace/executions/306e1905-657f-4579-9053-8dbadb9e1446	\N	\N	\N
450	067b53e2-2e2a-4e01-aa01-f88b265393b1	input.yaml	data	2025-03-28 23:27:15.139839	Fallido	1	2	/home/runner/workspace/executions/5f01e4b1-0c69-4db9-ab9d-a5cc3e36dfd0	\N	\N	\N
451	ef47d438-3ce3-4875-b2ac-a316ae0707f7	input.yaml	data	2025-03-28 23:27:20.884977	Fallido	1	0	/home/runner/workspace/executions/da56474a-5413-4ab5-8004-8210cbe85129	\N	\N	\N
452	b4606ca7-d4c0-4136-a726-31feb8ed386e	input.yaml	data	2025-03-28 23:36:43.135443	Fallido	1	2	/home/runner/workspace/executions/b65ad9ee-5f64-4c8b-bc04-61940dd232c3	\N	\N	\N
453	d5bf787c-da00-4ec1-aeea-05fd0d58a7bb	input.yaml	data	2025-03-28 23:36:48.061615	Fallido	1	0	/home/runner/workspace/executions/c51e34a7-e717-4979-9c1c-bf156d79b409	\N	\N	\N
454	0f05cd7d-25fa-49d9-af65-085414ef8e0c	input.yaml	data	2025-03-28 23:41:46.313263	Fallido	1	2	/home/runner/workspace/executions/615a06e3-780e-43e8-aac5-1c34100ca274	\N	\N	\N
455	9308bd88-0749-4055-b1eb-66af051f96c0	input.yaml	data	2025-03-28 23:41:48.067463	Fallido	1	0	/home/runner/workspace/executions/9524444a-9ed7-47c3-9620-f14b3d4bf57f	\N	\N	\N
456	780a1996-a2cb-4aef-bc13-0b2cf1f29fc5	input.yaml	data	2025-03-28 23:46:27.440243	Fallido	1	2	/home/runner/workspace/executions/46a75f48-030b-408a-a693-15c1683799c8	\N	\N	\N
457	53bdfd4e-f515-4981-8e94-5be5c78ea638	input.yaml	data	2025-03-28 23:46:31.512355	Fallido	1	0	/home/runner/workspace/executions/cfb28cb5-e8ce-4db5-a5ed-15e9a6f39cc4	\N	\N	\N
458	f713f094-2085-4720-9b0b-cd56c2ba20dd	input.yaml	data	2025-03-28 23:50:57.370296	Fallido	1	2	/home/runner/workspace/executions/5ad94db4-6879-4b02-8d7a-2f25c1662ef9	\N	\N	\N
459	cd8fab0e-2100-4418-834c-df90d8d020c6	input.yaml	data	2025-03-28 23:51:00.044498	Fallido	1	0	/home/runner/workspace/executions/9ae704f6-0667-484a-b410-3a0a1db55f54	\N	\N	\N
460	6d835418-4093-480a-9d8f-8b26a49000ba	input.yaml	data	2025-03-28 23:53:07.944699	Fallido	1	2	/home/runner/workspace/executions/8a37e6a0-7909-4b36-9c74-8d56cd40a87c	\N	\N	\N
461	ff962878-9a5e-4463-b29e-56a0cf88cbc8	input.yaml	data	2025-03-28 23:53:11.721097	Fallido	1	0	/home/runner/workspace/executions/32ffc743-0844-4286-9fef-e66595438f4c	\N	\N	\N
462	e4ca1083-2f24-4a88-b362-3e1313c16a95	input.yaml	data	2025-03-28 23:56:19.659363	Fallido	1	2	/home/runner/workspace/executions/769a863f-b531-4b96-9564-ecc1ee163f8e	\N	\N	\N
463	0daa6af3-2ffa-4446-bd38-d98204cef8cc	input.yaml	data	2025-03-28 23:56:36.01171	Fallido	1	0	/home/runner/workspace/executions/81edc585-9f63-49ff-ae97-ba1afd05064b	\N	\N	\N
464	acbd0a28-acf8-4bca-8a15-94cdd6c5846a	input.yaml	data	2025-03-29 00:01:50.57224	Fallido	1	2	/home/runner/workspace/executions/bdbab52a-40d9-48b9-afca-a53502d149d2	\N	\N	\N
465	cdd2f119-b53e-4cc9-9996-bd7a4d90d772	input.yaml	data	2025-03-29 00:01:53.608197	Fallido	1	0	/home/runner/workspace/executions/a3b344c3-233b-42b1-91de-1703d77bba31	\N	\N	\N
466	0411fa8d-42ac-485e-93cc-e7c7c6577bb4	input.yaml	data	2025-03-29 00:06:35.531995	Fallido	1	2	/home/runner/workspace/executions/7d49c41d-5ac1-430d-8958-7109cc802380	\N	\N	\N
467	3d172eea-3d7d-47e3-8731-b578281d3aa3	input.yaml	data	2025-03-29 00:06:39.264961	Fallido	1	0	/home/runner/workspace/executions/f5395119-d325-4ac1-a4a5-c134d43d8df1	\N	\N	\N
468	c2a96690-ceb2-469e-bf2a-83c1dc5b9ad5	input.yaml	data	2025-03-29 00:07:21.422158	Fallido	1	2	/home/runner/workspace/executions/19f3ae38-8ddd-4edb-a668-fed15e92d87c	\N	\N	\N
469	411ef904-f2fc-4b06-84f6-ffebbdb77148	input.yaml	data	2025-03-29 00:07:24.691785	Fallido	1	0	/home/runner/workspace/executions/2a0f3ecf-d9b9-4411-8a02-ffdc423c6c61	\N	\N	\N
470	11099ed4-1ffe-46a0-a2c4-6fc75825ff45	input.yaml	data	2025-03-29 00:12:26.899447	Fallido	1	2	/home/runner/workspace/executions/23fb1d3c-cafc-4f58-9bd1-55b6c615218e	\N	\N	\N
471	912c1e11-eb3a-4c86-bcaf-2378a348eb9f	input.yaml	data	2025-03-29 00:12:30.065515	Fallido	1	0	/home/runner/workspace/executions/d6dbec4c-836a-473f-b579-fb94f87b0db5	\N	\N	\N
472	e514ca1c-3c25-41d0-86a1-353df9c0ced9	input.yaml	data	2025-03-29 00:15:22.566325	Fallido	1	2	/home/runner/workspace/executions/1c73d2b5-d694-4e4e-9770-946efc034be8	\N	\N	\N
473	606c46f9-e8d3-4dde-90c1-af8e56f7ca66	input.yaml	data	2025-03-29 00:15:25.851912	Fallido	1	0	/home/runner/workspace/executions/15ad986f-885b-4125-9c20-b9549ddb1aa3	\N	\N	\N
474	6d58eb82-e1c7-4bef-b22b-54d9de3edfca	input.yaml	data	2025-03-29 00:18:00.049168	Fallido	1	0	/home/runner/workspace/executions/62bb6e47-e4f7-4b0f-95c0-de8a39f0aa06	51	\N	portal_upload
475	10b9598b-42df-44ca-b13a-5c1fed06dc5e	input.yaml	data	2025-03-29 00:18:01.069317	Fallido	1	2	/home/runner/workspace/executions/6c41a3f7-adda-44ec-8c98-7a5464b110e0	\N	\N	\N
476	3605bf20-b654-46b3-bd8a-31fd3ed6eaa7	input.yaml	data	2025-03-29 00:18:02.741824	Fallido	1	0	/home/runner/workspace/executions/bfc3b0fc-0417-4455-9e98-107082f4ebe8	\N	\N	\N
477	4d2754b1-386d-4e21-b01b-c1e08f3f1890	input.yaml	data	2025-03-29 00:18:11.845183	Fallido	1	0	/home/runner/workspace/executions/dc7b8af8-2344-4c90-b6a2-816d48688a22	51	\N	portal_upload
478	ae95b912-b31d-429f-837e-8875d8d68f6f	input.yaml	data	2025-03-29 00:20:36.043986	Fallido	1	2	/home/runner/workspace/executions/e279a935-d08b-45bc-adfa-5fe37020509f	\N	\N	\N
479	a6c18b0e-6ecf-4235-bf4a-5ee060ec03ef	input.yaml	data	2025-03-29 00:20:37.746522	Fallido	1	0	/home/runner/workspace/executions/878d56bf-ca7b-4ac6-a96d-c32aaed8233d	\N	\N	\N
480	ac898fba-ecd6-4900-8f83-4177fc1a8737	input.yaml	data	2025-03-29 00:26:34.213681	Fallido	1	2	/home/runner/workspace/executions/706e52e5-bdf4-433a-b03f-0ea97d83ab73	\N	\N	\N
481	db52fb2d-9047-42c5-a246-481253b1b495	input.yaml	data	2025-03-29 00:26:37.79761	Fallido	1	0	/home/runner/workspace/executions/e2f0cb55-256b-464f-99af-86ce049e0e34	\N	\N	\N
482	ab71660c-b4c1-4d64-b866-d35ac7eef22d	input.yaml	data	2025-03-29 00:31:31.105978	Fallido	1	2	/home/runner/workspace/executions/014195fa-bc2e-408a-8040-e557b256331a	\N	\N	\N
483	186bfd0c-a35c-4f63-a8a6-f66bf3a469cf	input.yaml	data	2025-03-29 00:31:36.608488	Fallido	1	0	/home/runner/workspace/executions/f9867a86-7eb4-4832-9c7d-5bf29e972734	\N	\N	\N
484	0eb90c8c-4fd0-426a-b1c2-970c79c90239	input.yaml	data	2025-03-29 00:33:50.301965	Fallido	1	0	/home/runner/workspace/executions/b2cfd89d-acd4-4956-99a9-0c91f75b0358	51	\N	portal_upload
485	f627c329-fd93-4f9b-b8c1-a763ea7258bd	input.yaml	data	2025-03-29 00:33:53.712201	Fallido	1	0	/home/runner/workspace/executions/1c220ea9-1d0f-4132-897a-2dbe5d958544	51	\N	portal_upload
486	ca22f4f9-baa4-4a2b-8d29-2949f2704c15	input.yaml	data	2025-03-29 00:37:25.543752	Fallido	1	2	/home/runner/workspace/executions/2c3e180e-fdc9-4cf5-bc8c-11d36cd9f87d	\N	\N	\N
487	b722b42b-b2ff-4469-b56d-5e8395ce5e2c	input.yaml	data	2025-03-29 00:37:29.941464	Fallido	1	0	/home/runner/workspace/executions/019c9c94-8fa1-426f-b92a-bab9e49b13cc	\N	\N	\N
488	9a5ef165-6613-4f46-a6fa-444d1faa872c	input.yaml	data	2025-03-29 00:37:59.381306	Fallido	1	2	/home/runner/workspace/executions/8ff9f069-84c6-453c-ad61-57fb591b27c9	\N	\N	\N
489	dd5d7c92-b9ce-41a1-b80e-2be938818edf	input.yaml	data	2025-03-29 00:38:05.285538	Fallido	1	0	/home/runner/workspace/executions/7f1e0bff-76c7-41a6-a025-4637269ae106	\N	\N	\N
490	1d19e312-ef0e-4b00-97f7-ba565d06acae	input.yaml	data	2025-03-29 00:42:22.43147	Fallido	1	2	/home/runner/workspace/executions/c8bd796b-471d-4f04-9b3b-963e27a2dcfb	\N	\N	\N
491	8c93a18e-476e-4483-902f-aabbc8d5798c	input.yaml	data	2025-03-29 00:45:59.628948	Fallido	1	0	/home/runner/workspace/executions/f2eee432-d224-489d-8b21-2ec1b32361cd	\N	\N	\N
492	66d53393-990c-4742-9ce4-c52f5468e3fe	input.yaml	data	2025-03-29 00:46:31.790941	Fallido	1	0	/home/runner/workspace/executions/03db0a26-73d2-4f28-966a-de0ebbaf1dda	\N	\N	\N
493	0812844d-4c2c-41c7-85af-fbb7c9f1d0fd	input.yaml	data	2025-03-29 00:46:49.087843	Fallido	1	0	/home/runner/workspace/executions/0c7220c2-a9f2-4d91-a318-e3736650e32a	\N	\N	\N
494	07282039-237b-4f7c-bad2-5b7199eabda8	input.yaml	data	2025-03-29 00:47:29.627535	Fallido	1	0	/home/runner/workspace/executions/3c1eda09-7f5e-43a0-b888-f056feed519d	\N	\N	\N
495	44c252a6-52e9-4091-8357-fb216b96558b	input.yaml	data	2025-03-29 00:53:06.054074	Fallido	1	0	/home/runner/workspace/executions/47fe34b8-4e67-4c08-86d4-61bbb0890c23	\N	\N	\N
496	f4483fad-04f5-4353-a6ad-8293a9e6d61b	input.yaml	data	2025-03-29 00:53:26.122605	Fallido	48	0	/home/runner/workspace/executions/d75bf353-b83a-4b10-b32d-5aa1e8788bf0	\N	\N	\N
497	ac8ad7ee-4140-40a6-b2a1-24ccf1e7340d	input.yaml	data	2025-03-29 00:53:53.01894	Fallido	4	0	/home/runner/workspace/executions/0c8462a8-b253-4c09-aab5-25ea914db905	\N	\N	\N
498	57dae97a-76d3-4d2e-ae8b-3c094c0670bf	input.yaml	data	2025-03-29 00:54:05.923722	Éxito	0	0	/home/runner/workspace/executions/cb9316ee-abcc-4235-8194-8ac477a32357	\N	\N	\N
499	284058ce-0c5d-452c-8ebd-91a60c2ad822	input.yaml	data	2025-03-29 01:03:02.258357	Fallido	1	0	/home/runner/workspace/executions/395b7e9a-8edf-40c6-8310-95cc8da72459	\N	\N	\N
500	e34deb77-a6d0-4962-8515-4090cb7810e4	input.yaml	data	2025-03-29 01:09:48.081628	Fallido	45	0	/home/runner/workspace/executions/264b15b6-567d-4f87-a7b3-d406f287f9c5	\N	\N	\N
501	c53020c7-9f3b-4c10-9094-f65ed846d428	input.yaml	data	2025-03-29 01:10:15.450287	Éxito	0	0	/home/runner/workspace/executions/30558152-d99a-489b-ac72-c393e967c388	\N	\N	\N
502	ffc99f0f-9be2-4235-a59b-b05fa45ba514	input.yaml	data	2025-03-29 01:11:00.224066	Fallido	1	0	/home/runner/workspace/executions/b7a25f6d-51a7-4c2a-b882-a4dd2bb6e173	\N	\N	\N
503	d7b2bb7f-c576-4d30-be81-00fe9ab66043	input.yaml	data	2025-03-29 01:11:47.569742	Fallido	1	0	/home/runner/workspace/executions/3e47aba0-d027-4d81-a495-c0a6e6df5a0a	\N	\N	\N
504	8be66b3a-69f0-43e8-83b6-995866ef9a90	input.yaml	data	2025-03-29 01:16:24.768612	Fallido	1	0	/home/runner/workspace/executions/15c91aec-bad8-4920-9460-88baf5ce6a38	\N	\N	\N
505	e6261d66-aaf0-4109-99ec-6134d8b12298	input.yaml	data	2025-03-29 01:16:44.454309	Fallido	1	2	/home/runner/workspace/executions/307d5180-494b-40a1-8f9a-cf21680564cb	\N	\N	\N
506	f1524e9c-6a0f-4fc1-acde-734a39b6f5cc	input.yaml	data	2025-03-29 01:19:21.874713	Fallido	48	0	/home/runner/workspace/executions/58c4cbc4-054e-4ee1-8b7f-5d734ebb1bcb	52	\N	portal_upload
507	ba49f562-0010-4e59-bc22-2f85e27161bd	input.yaml	data	2025-03-29 01:19:25.712371	Fallido	48	0	/home/runner/workspace/executions/11f62985-2108-4d31-898c-46f7701f7532	52	\N	portal_upload
508	26c394ec-14f0-4368-9b6c-bf3dbae33765	input.yaml	data	2025-03-29 01:22:01.466018	Éxito	0	0	/home/runner/workspace/executions/ff360a95-e297-4e00-a4fe-0bd82b9a9447	54	\N	portal_upload
509	f65b1a0f-a48d-491f-9e5a-01fb1add587c	input.yaml	data	2025-03-29 01:22:05.963144	Éxito	0	0	/home/runner/workspace/executions/14653a2c-5d39-4f8d-afa5-0d4bb312ff76	54	\N	portal_upload
510	378200ba-1dcb-49be-a86e-8b0d7d70b65c	input.yaml	data	2025-03-29 01:24:28.311842	Éxito	0	0	/home/runner/workspace/executions/022e9651-c3f9-4987-b3f6-05a9640f142c	54	\N	portal_upload
511	e21b0c5b-f6d0-41ae-933c-d11245717033	input.yaml	data	2025-03-29 01:24:31.912595	Éxito	0	0	/home/runner/workspace/executions/2d8c0480-ca07-4aee-8cbf-240903279e85	54	\N	portal_upload
512	c2210242-cdcf-4410-baf6-4b4427a42843	input.yaml	data	2025-03-29 01:33:23.338902	Fallido	1	2	/home/runner/workspace/executions/883c2d5c-767b-4a7e-84df-9a3c44a51da8	\N	\N	\N
513	64daf8db-5e30-44a9-af21-ca6f90d64df5	input.yaml	data	2025-03-29 01:33:26.631051	Fallido	1	0	/home/runner/workspace/executions/c406fc79-4645-4645-b624-f573bbcf32fb	\N	\N	\N
514	3be27e1f-729e-4cd9-869a-4215c8d94b4d	input.yaml	data	2025-03-29 01:38:22.357779	Fallido	1	2	/home/runner/workspace/executions/b12cd604-0f19-438f-a782-ce77fe050c11	\N	\N	\N
515	1197b880-e5d9-4747-a365-a4fbea191423	input.yaml	data	2025-03-29 01:38:25.961029	Fallido	1	0	/home/runner/workspace/executions/b33e915f-d2e3-4940-b178-8642d8961e8d	\N	\N	\N
516	f5c1aed6-0072-4e4c-8d22-0c9d190f2d53	input.yaml	data	2025-03-29 01:44:54.223491	Fallido	1	2	/home/runner/workspace/executions/3088115a-442a-4f2c-82fd-d33298095476	\N	\N	\N
517	3ce07ebd-b606-4820-b06d-7b597f38e63f	input.yaml	data	2025-03-29 01:45:15.343346	Fallido	1	0	/home/runner/workspace/executions/ecbeea31-a1dd-42a2-88e4-596f3e19e93e	\N	\N	\N
518	f77b0987-ad93-4b5b-854c-a3e1af0e173c	input.yaml	data	2025-03-29 01:51:34.771187	Fallido	1	0	/home/runner/workspace/executions/2fd76644-015b-4d43-89f2-365499df9ba4	50	\N	portal_upload
519	416195a1-2437-449a-b07f-4c9e7f467db8	input.yaml	data	2025-03-29 01:51:40.292491	Fallido	1	0	/home/runner/workspace/executions/cf800456-0ee2-493b-ab1a-7d198fd90c46	50	\N	portal_upload
520	d0a2a34b-b1ec-4414-aecb-2bab28d436d8	input.yaml	data	2025-03-29 01:53:37.692393	Fallido	1	2	/home/runner/workspace/executions/408b8d87-aea2-4fd8-8df9-790cf3522f54	\N	\N	\N
521	f748910f-97ad-416c-bf36-570f6849cffc	input.yaml	data	2025-03-29 02:05:11.278878	Fallido	1	2	/home/runner/workspace/executions/16833e71-3d47-41a2-8450-bf92c407dc6e	\N	\N	\N
522	eada9d41-5a04-431c-8efd-29f8581eb24c	input.yaml	data	2025-03-29 02:05:15.977066	Fallido	1	0	/home/runner/workspace/executions/f9511bae-ff59-419f-bf11-af587defd66b	\N	\N	\N
523	efd1b34a-46b2-4fd1-b983-ea2b31054045	input.yaml	data	2025-03-29 02:08:09.043281	Fallido	1	2	/home/runner/workspace/executions/4a018d5e-9281-4e6b-888a-dfa992dfe7f9	\N	\N	\N
524	3d1fb673-bf3a-4583-8a0a-6458041f53fb	input.yaml	data	2025-03-29 02:08:12.179203	Fallido	1	0	/home/runner/workspace/executions/2b9efd1a-35f4-44c4-84dd-59083cf22554	\N	\N	\N
525	756c3c3d-ebaf-4da3-abf5-620dcf7b4f7a	input.yaml	data	2025-03-29 02:19:51.432297	Fallido	1	2	/home/runner/workspace/executions/0d267c16-2826-4d09-abbf-c0c143fdc873	\N	\N	\N
526	5d453476-c9bf-4640-af00-8a2703340151	input.yaml	data	2025-03-29 02:19:55.924931	Fallido	1	0	/home/runner/workspace/executions/3a30eccf-063b-4b15-8f32-949e2b425ba1	\N	\N	\N
527	b4e8290f-2513-4deb-88ce-9a3d55d2fdcc	input.yaml	data	2025-03-29 02:20:45.63784	Fallido	1	2	/home/runner/workspace/executions/08d4dc03-b678-456f-aeaa-b1d2d4a1c899	\N	\N	\N
528	eb6df4cf-b015-4496-ab78-2e593558eced	input.yaml	data	2025-03-29 02:20:50.201155	Fallido	1	0	/home/runner/workspace/executions/ec983a68-73b9-4139-a2ca-03641522ef04	\N	\N	\N
529	be974df6-e5f1-4478-8923-263e2487a17a	input.yaml	data	2025-03-29 02:23:50.192139	Fallido	1	2	/home/runner/workspace/executions/471931a2-5a3e-42cc-bf65-a14b8ad5efcc	\N	\N	\N
530	3c54d5ca-6f94-4abd-841a-7a8e37874645	input.yaml	data	2025-03-29 02:24:00.52115	Fallido	1	0	/home/runner/workspace/executions/f04080c8-662c-4ea4-8174-7ca0de93147e	\N	\N	\N
531	80e25ae8-2866-4b84-b78c-e4ebd089f563	input.yaml	data	2025-03-29 02:30:28.041351	Fallido	1	2	/home/runner/workspace/executions/6f1ee313-f6fc-4ffe-854f-9484b2b7c220	\N	\N	\N
532	388033c8-82b0-4823-8de6-602b93bebea1	input.yaml	data	2025-03-29 02:30:31.022286	Fallido	1	0	/home/runner/workspace/executions/854d695a-0bb5-4b39-8681-e1d4902b6f23	\N	\N	\N
533	8076b035-2c63-4ed6-b7f0-632a16e6c46a	input.yaml	data	2025-03-29 02:31:02.143935	Fallido	1	2	/home/runner/workspace/executions/cd70ea95-9bec-4b06-be08-fb6fccdfe762	\N	\N	\N
534	0764bd9b-7b75-4d14-9ae1-1847375ef33b	input.yaml	data	2025-03-29 02:31:05.537067	Fallido	1	0	/home/runner/workspace/executions/9f5efe4a-394e-469f-9029-bd6dc1f6e958	\N	\N	\N
535	51a9fa74-42d5-4c39-a198-8c0761afb9e7	input.yaml	data	2025-03-29 20:17:40.170181	Fallido	1	0	/home/runner/workspace/executions/96855fad-2a57-48ef-8af3-44220b2728d7	\N	\N	\N
536	1deeda1b-1e38-4105-a347-d3895be36e51	input.yaml	data	2025-03-29 20:17:41.932487	Fallido	1	2	/home/runner/workspace/executions/94ea9e75-c2e0-456b-bfa2-89ef0933f6d5	\N	\N	\N
537	77e91475-275b-4574-9059-c4249f1105d9	input.yaml	data	2025-03-29 20:18:25.029232	Fallido	1	2	/home/runner/workspace/executions/0427d708-8d3d-4650-85aa-d4cbfe88ed25	\N	\N	\N
538	8c95a0d5-8e8e-44c3-9360-f5c4c02e30ae	input.yaml	data	2025-03-29 20:18:29.400555	Fallido	1	0	/home/runner/workspace/executions/c5cf8cd6-1272-4639-afe1-cee5c74721ce	\N	\N	\N
539	37e41487-4a81-413f-9f1c-17aa487b9843	input.yaml	data	2025-03-29 20:25:33.456488	Fallido	1	2	/home/runner/workspace/executions/c47ff041-7e1f-4095-9c26-f700f993892e	\N	\N	\N
540	6a086c3c-664f-4711-9644-d61e9e3b0e20	input.yaml	data	2025-03-29 20:25:37.168901	Fallido	1	0	/home/runner/workspace/executions/73a608d5-7e68-4efd-a7eb-c59b685ce3f5	\N	\N	\N
541	b5b9a1f0-3d3e-413b-bb1f-f03b547bd39b	input.yaml	data	2025-03-29 20:30:05.583971	Fallido	1	2	/home/runner/workspace/executions/2a66ba59-dbca-44cc-819d-01444898b681	\N	\N	\N
542	d6ae54c8-fa4c-4528-8319-6587a22f2367	input.yaml	data	2025-03-29 20:30:09.395461	Fallido	1	0	/home/runner/workspace/executions/e85d9552-dfc5-46ee-bbaa-44e5bd50ef1d	\N	\N	\N
543	5bb916d6-3183-4537-8aeb-f4607e902d9f	input.yaml	data	2025-03-29 20:32:26.742362	Fallido	1	2	/home/runner/workspace/executions/6664ce21-ae1b-4b89-9797-f23f876012a3	\N	\N	\N
544	f403dd8e-c220-4a72-a656-64933398812c	input.yaml	data	2025-03-29 20:32:30.399983	Fallido	1	0	/home/runner/workspace/executions/b22e7a34-10c2-409d-bfdd-39b32a06f08c	\N	\N	\N
545	d7cf6584-e056-47aa-ad8f-eb138b6bebc9	input.yaml	data	2025-03-29 20:35:12.069192	Fallido	1	2	/home/runner/workspace/executions/3d246f78-a407-4f8c-b2bd-583e1ae23cea	\N	\N	\N
546	39359b24-eaa9-4500-a334-83ff9b71d5f5	input.yaml	data	2025-03-29 20:35:16.149907	Fallido	1	0	/home/runner/workspace/executions/83a5dc6c-2485-4510-8f19-930d4849ea42	\N	\N	\N
547	e936b404-32ea-40e6-a346-fbe02ca5c03c	input.yaml	data	2025-03-29 20:37:36.611861	Fallido	1	2	/home/runner/workspace/executions/17cd2f55-0a01-4da5-94b7-21704a792435	\N	\N	\N
548	2f96bef9-912a-4867-8366-8952b15046fb	input.yaml	data	2025-03-29 20:37:41.119948	Fallido	1	0	/home/runner/workspace/executions/0de635d8-e209-4beb-b457-e47c3f342e16	\N	\N	\N
549	a73ec396-0f67-494e-8277-144469ba6fd1	input.yaml	data	2025-03-29 20:40:17.012334	Fallido	1	2	/home/runner/workspace/executions/a7bd39b3-0d84-47ae-9b9a-bed13e7f69ac	\N	\N	\N
550	f201e6b2-9c26-44b7-954d-ab9ac47a2924	input.yaml	data	2025-03-29 20:40:22.437483	Fallido	1	0	/home/runner/workspace/executions/7bc036c1-f3a7-42e4-b579-8a11b0d35f93	\N	\N	\N
551	fa503e99-dbe3-4244-8110-8443798db69a	input.yaml	data	2025-03-29 20:45:53.523808	Fallido	1	2	/home/runner/workspace/executions/a9c65cf6-2da2-480e-b51f-8711263cdcbf	\N	\N	\N
552	c674c91a-8de9-45af-af26-6e7ec872b80d	input.yaml	data	2025-03-29 20:45:56.134219	Fallido	1	0	/home/runner/workspace/executions/74394ace-6aeb-4659-ace7-05da9b8fefbb	\N	\N	\N
553	3bc224c7-a546-4959-a3f7-8a32ea8c84ee	input.yaml	data	2025-03-29 20:50:42.243575	Fallido	1	2	/home/runner/workspace/executions/e26afce9-b150-45db-ad79-33b3d874d952	\N	\N	\N
554	daed4e2f-d3da-434c-8177-84dceb176bae	input.yaml	data	2025-03-29 20:50:47.650297	Fallido	1	0	/home/runner/workspace/executions/4d46dbe5-05b9-4feb-8002-443c96ad9786	\N	\N	\N
555	28a33756-5457-4dae-b5a6-8fcdb1174ab7	input.yaml	data	2025-03-29 21:00:04.949338	Fallido	1	2	/home/runner/workspace/executions/76549891-ebe6-4072-b101-bb68dca5b048	\N	\N	\N
556	6c78e186-6f1e-4284-90b1-ec1ab216945a	input.yaml	data	2025-03-29 21:00:06.003727	Fallido	1	0	/home/runner/workspace/executions/0dac9d0b-3fd7-448b-853e-ba49ac031215	\N	\N	\N
557	5dc4f482-777c-4063-84dd-f2f42e7113ce	input.yaml	data	2025-03-29 21:10:56.352505	Fallido	1	2	/home/runner/workspace/executions/0e9d2bcf-a862-4231-bcaf-81bfb118a498	\N	\N	\N
558	9b39dfef-c17f-4621-be1e-c64a41bccbf2	input.yaml	data	2025-03-29 21:11:00.500122	Fallido	1	0	/home/runner/workspace/executions/afe54e30-aca5-4ae5-a78f-0bedb722ae4b	\N	\N	\N
559	d96e7d46-3379-42d6-92a4-f8c895c61c2e	input.yaml	data	2025-03-29 21:28:53.612946	Fallido	1	2	/home/runner/workspace/executions/fb797b39-e29b-4530-af8c-22d1a18305ec	\N	\N	\N
560	6eb9b1f7-b208-47e1-9d2d-f1392f5f94f3	input.yaml	data	2025-03-29 21:28:54.115411	Fallido	1	0	/home/runner/workspace/executions/14ef6615-c246-4daa-984a-8ede88c4f259	\N	\N	\N
561	f31cdce3-f29d-42d9-a39d-87394a91a105	input.yaml	data	2025-03-29 21:38:53.231962	Fallido	1	2	/home/runner/workspace/executions/32b52e29-268e-4ccd-8ed6-371ef1a5d8c2	\N	\N	\N
562	5f23a0e4-69df-4bd6-9534-fe16039d5433	input.yaml	data	2025-03-29 21:39:08.098218	Fallido	1	0	/home/runner/workspace/executions/36f973de-e1c8-4536-b496-680834691927	\N	\N	\N
563	cc79df06-6ae0-4538-bc30-d4a2cc1de404	input.yaml	data	2025-03-29 21:41:44.26348	Fallido	1	2	/home/runner/workspace/executions/f27b11ca-9ab5-45ab-85de-f4907ba422f6	\N	\N	\N
564	5e749b2d-16e9-41d7-9292-7cc581cb799f	input.yaml	data	2025-03-29 21:41:47.585535	Fallido	1	0	/home/runner/workspace/executions/f4dd32cc-78f2-417a-885c-b52e3c91d00b	\N	\N	\N
565	2e00e3fa-77da-480d-bc56-9b83f1c62e6e	input.yaml	data	2025-03-29 21:46:35.845672	Fallido	1	2	/home/runner/workspace/executions/eea53058-3728-4bc8-8dbc-743812968ae7	\N	\N	\N
566	f345d888-1df6-4d4d-9739-6e7abc052104	input.yaml	data	2025-03-29 21:46:50.178206	Fallido	1	0	/home/runner/workspace/executions/25ab96e1-a296-4884-b475-c59ceabef10f	\N	\N	\N
567	5442a4c0-874a-4cd0-859b-4b9b83c56b77	input.yaml	data	2025-03-29 21:52:09.191201	Fallido	1	2	/home/runner/workspace/executions/cc2cc2d7-aef8-407b-a49c-c825ea1b1df6	\N	\N	\N
568	1f1693e2-1fc1-4130-bd9f-a09b8075819c	input.yaml	data	2025-03-29 21:52:13.502705	Fallido	1	0	/home/runner/workspace/executions/79371ac7-18cc-4a6e-8a08-07244377ff41	\N	\N	\N
569	f122ea8e-5056-4add-936b-c7cf1f398f65	input.yaml	data	2025-03-29 21:54:43.037849	Fallido	1	2	/home/runner/workspace/executions/cd5f0482-d13f-4e7c-96c6-f9eff6a74bfe	\N	\N	\N
570	faf47b2c-0a1e-47d7-b7c4-f2b566fdaed1	input.yaml	data	2025-03-29 21:54:51.591082	Fallido	1	0	/home/runner/workspace/executions/fe051218-0bbf-4bfb-8881-107963885d8b	\N	\N	\N
571	6a13ba7c-8dde-402b-bc76-abc0d7908731	input.yaml	data	2025-03-29 22:03:16.744262	Fallido	1	2	/home/runner/workspace/executions/67169364-1bd7-4d9d-93bc-e2b3673e5d7a	\N	\N	\N
572	5cb50670-d4f0-45bf-ae1a-be20cb57ebf8	input.yaml	data	2025-03-29 22:03:19.834944	Fallido	1	0	/home/runner/workspace/executions/454a147f-90ad-4f9e-8951-00d609450e1d	\N	\N	\N
573	83b29ebc-2497-4d4c-99c6-0af736f53610	input.yaml	data	2025-03-29 22:04:26.081496	Fallido	1	2	/home/runner/workspace/executions/f460ec9a-3e8b-438a-8a82-8eb2f7a06454	\N	\N	\N
574	22bd6557-8e12-42e3-a35c-50c9de345c80	input.yaml	data	2025-03-29 22:04:30.46755	Fallido	1	0	/home/runner/workspace/executions/3b235a71-2319-4a39-86e8-011d1148b1ce	\N	\N	\N
575	44acb3e9-49ad-4309-abb7-8cf79a426575	input.yaml	data	2025-03-29 22:05:56.378505	Fallido	1	2	/home/runner/workspace/executions/0d0926a0-4713-4cb0-b857-ce958aac3a70	\N	\N	\N
576	2d709bfc-6a19-4e4c-adb0-c3c31439f668	input.yaml	data	2025-03-29 22:06:00.590866	Fallido	1	0	/home/runner/workspace/executions/271a206a-f2de-4649-893b-9f2c156d6d3e	\N	\N	\N
577	cda164b3-c4e9-4da7-b78f-246b3057d5f3	input.yaml	data	2025-03-29 22:06:45.499123	Fallido	1	2	/home/runner/workspace/executions/748ad7b4-78b5-40c9-985c-3b24a3c0e25c	\N	\N	\N
578	e721877b-ce8b-4123-9d65-8a2b859108f3	input.yaml	data	2025-03-29 22:07:04.616942	Fallido	1	0	/home/runner/workspace/executions/c4cf010e-df20-4c01-9266-0aab8d653048	\N	\N	\N
579	65318e1a-aa6f-401d-893f-7c0d7e0468f3	input.yaml	data	2025-03-29 22:09:22.106213	Fallido	1	2	/home/runner/workspace/executions/82ca339c-b085-408f-9625-216f552f99b2	\N	\N	\N
580	49588bc3-3e34-47e0-805b-7380baec9938	input.yaml	data	2025-03-29 22:09:26.049073	Fallido	1	0	/home/runner/workspace/executions/4257b244-d2f8-4bfd-afb9-ecd951e0c99a	\N	\N	\N
581	a2c414cf-4715-4ada-a36c-dd7546eb840c	input.yaml	data	2025-03-30 00:43:02.913754	Fallido	1	2	/home/runner/workspace/executions/5101c6e0-491e-4e6d-bf77-7c46c39f7293	\N	\N	\N
582	b275ba59-cb7e-4ec9-8958-c70bb74f8a2b	input.yaml	data	2025-03-30 00:43:03.52164	Fallido	1	0	/home/runner/workspace/executions/8ee48012-a5e3-44e9-9583-f78221b50355	\N	\N	\N
583	53c4812a-f58b-4891-a889-655b08a7ba0a	input.yaml	data	2025-03-30 01:00:03.960465	Fallido	1	2	/home/runner/workspace/executions/dff1ea76-c0be-4e47-b2b3-930f316d121f	\N	\N	\N
584	f8e52b6c-2ade-41a2-be3a-08f988e26893	input.yaml	data	2025-03-30 01:00:04.53231	Fallido	1	0	/home/runner/workspace/executions/d3d95e9b-40c1-4a62-94cd-45792392b113	\N	\N	\N
585	dcf0d0c9-cb1e-4397-ac7e-6806c170ce45	input.yaml	data	2025-03-30 01:06:23.759376	Fallido	1	2	/home/runner/workspace/executions/9bb6a4ab-5226-469e-bb3d-cb6104bcfcac	\N	\N	\N
586	ae6184de-14fe-4085-8bf0-9fb2c1955d01	input.yaml	data	2025-03-30 01:06:29.901526	Fallido	1	0	/home/runner/workspace/executions/67dade15-42ee-4c96-b013-535466777b38	\N	\N	\N
587	5a6bb20e-51dc-4171-bb80-01077a2083ab	input.yaml	data	2025-03-30 01:07:03.128271	Fallido	1	2	/home/runner/workspace/executions/1d3e13b0-19fe-443f-924c-508e8e0094fa	\N	\N	\N
588	9b24a3f8-ef1a-478a-9e48-dccb9a305a95	input.yaml	data	2025-03-30 01:07:09.123984	Fallido	1	0	/home/runner/workspace/executions/ce91f38f-d83b-48cc-8837-69b4d0742327	\N	\N	\N
589	f86a62a2-befe-4439-bb69-3b33be1f3352	input.yaml	data	2025-03-30 01:07:50.911111	Fallido	1	2	/home/runner/workspace/executions/c1a2c869-4d8e-4b27-b8fe-cf575c8657ef	\N	\N	\N
590	8e9aa902-2eb6-43fe-ade8-ec2c30e58269	input.yaml	data	2025-03-30 01:07:55.303496	Fallido	1	0	/home/runner/workspace/executions/e9005109-f618-490d-9022-c96b3be763f4	\N	\N	\N
591	6406994c-f882-411e-9674-201be770769f	input.yaml	data	2025-03-30 01:11:44.17207	Fallido	1	2	/home/runner/workspace/executions/9b15f98e-0519-4c2d-86c1-21873155568d	\N	\N	\N
592	fbe5935d-6fe1-4a04-a664-9db3f7bf2425	input.yaml	data	2025-03-30 01:11:48.241621	Fallido	1	0	/home/runner/workspace/executions/ab5426b0-0292-419e-a12d-edc7bac03322	\N	\N	\N
593	23ab5123-4901-4b2e-a087-28d8d814b75b	input.yaml	data	2025-03-30 01:15:20.572298	Fallido	1	2	/home/runner/workspace/executions/44eb0568-f840-44f4-8265-b659decd624d	\N	\N	\N
594	cf4dbd55-94f9-4f60-8707-158f0608dde5	input.yaml	data	2025-03-30 01:15:56.736677	Fallido	1	0	/home/runner/workspace/executions/8be6cbe9-fce9-4a04-a9c0-165c5c78e3e9	\N	\N	\N
595	6f34d3ad-d113-47a1-adcf-3ffed809fbb4	input.yaml	data	2025-03-30 05:14:22.690082	Fallido	1	0	/home/runner/workspace/executions/dd0de71d-3e74-494d-9744-6df49da5e7bd	50	\N	portal_upload
596	d947c2af-a950-4fbe-a944-6454880dbb9b	input.yaml	data	2025-03-30 05:14:25.824168	Fallido	1	0	/home/runner/workspace/executions/7a18dc3a-625f-4dfa-a5c3-e008976364e7	50	\N	portal_upload
597	74020ff8-7fd9-47d6-a3da-3d3990ced024	input.yaml	data	2025-03-30 13:47:27.291482	Fallido	1	0	/home/runner/workspace/executions/0932e333-8943-4ee1-92c5-dfa438948191	55	\N	portal_upload
598	ac556ca0-f4fa-4b09-a833-070b737d4a82	input.yaml	data	2025-03-30 13:47:47.507733	Fallido	1	0	/home/runner/workspace/executions/5f577d81-040b-4133-9101-64807533f6ac	55	\N	portal_upload
599	cafbe7d0-491e-4a6b-a85a-b63235ce6c7b	input.yaml	data	2025-03-30 13:55:51.017622	Fallido	1	0	/home/runner/workspace/executions/d1e6cb28-0539-4344-a25d-4bb001696f75	\N	\N	\N
600	b2dbc2a0-e1f5-4cdb-868f-1d8534a2b2e9	input.yaml	data	2025-03-30 13:59:11.543026	Fallido	1	0	/home/runner/workspace/test_cli/executions/f2f29f20-6e99-4dc1-a722-573ac08e7cc2	\N	\N	\N
601	c1148eb0-1d64-4451-82b2-be2c289b0580	input.yaml	data	2025-03-30 14:05:16.376384	Fallido	1	0	/home/runner/workspace/executions/91f501d8-f8ea-4329-a69e-f6e409a71106	\N	\N	\N
602	d2eeba70-ef21-4277-9cb4-8e302838493c	input.yaml	data	2025-03-30 14:05:21.898001	Fallido	1	0	/home/runner/workspace/executions/f7f2c64b-5a39-45f4-8695-a48b5875742b	\N	\N	\N
603	d800d41a-0d5a-4381-93d8-14a3803f015f	input.yaml	data	2025-03-30 14:07:47.289727	Fallido	1	0	/home/runner/workspace/executions/ed4413c9-fda7-44ea-9cce-9c2c706aaf5f	\N	\N	\N
604	a288de6d-bba1-46bf-b81e-556f85dfb86a	input.yaml	data	2025-03-30 14:09:19.099526	Fallido	1	0	/home/runner/workspace/executions/538b1118-d52b-43f8-ab13-3f80ebee332e	\N	\N	\N
605	d907a4d3-9488-466a-ae9d-e864ba294030	input.yaml	data	2025-03-30 14:10:37.465988	Fallido	1	0	/home/runner/workspace/executions/d0b0cce2-9e61-4484-b523-17ffc1b1090b	\N	\N	\N
606	ab8f8687-46f8-4068-b161-13cd42c75aef	input.yaml	data	2025-03-30 14:11:32.921129	Fallido	1	0	/home/runner/workspace/executions/a2c48a77-7294-4080-9335-a44ab644d7b2	\N	\N	\N
607	09d1ee53-c465-488e-91b8-75e517d8eea5	input.yaml	data	2025-03-30 14:14:28.39234	Fallido	1	0	/home/runner/workspace/executions/a78e5fe9-9935-4ca9-ab87-0da3c09556ef	\N	\N	\N
608	281e81da-913d-4173-80ca-8bee790959dd	input.yaml	data	2025-03-30 14:15:23.696889	Fallido	1	0	/home/runner/workspace/test_csv/executions/a78e6899-b93b-458b-8598-73d5f66462ae	\N	\N	\N
609	771e5add-d231-4504-b8b4-1265b679afb4	input.yaml	data	2025-03-30 14:15:33.017802	Fallido	1	0	/home/runner/workspace/test_csv/executions/2448e506-2b93-442d-abd0-e6750ad0fc8a	\N	\N	\N
610	46afef04-769e-4a0b-a5db-1ca7dce7c8ca	input.yaml	data	2025-03-30 14:19:31.611295	Fallido	1	0	/home/runner/workspace/executions/9750817f-71a0-4e7b-bf22-bea39f434270	\N	\N	\N
611	44de48b4-c95d-4dfb-b12b-bceeece96c6d	input.yaml	data	2025-03-30 14:25:21.429697	Fallido	1	0	/home/runner/workspace/executions/6c88ad4b-2525-474f-969d-6b81ae320018	\N	\N	\N
612	bf9c6d10-056d-4b00-8231-c2b2517a4731	input.yaml	data	2025-03-30 14:26:35.733621	Fallido	1	0	/home/runner/workspace/executions/a14bfd39-a970-4af0-b0aa-54d6ed4c8705	\N	\N	\N
613	24e21b42-d4b3-4228-b2f7-5b64a73dddc1	input.yaml	data	2025-03-30 14:27:52.762469	Fallido	1	0	/home/runner/workspace/executions/71e489fe-a57c-4fdc-b5fa-768c02ffab22	\N	\N	\N
614	ae9fcc77-2609-4b32-822e-6425fb8d2201	input.yaml	data	2025-03-30 14:29:10.413176	Fallido	1	0	/home/runner/workspace/executions/051179b1-4585-41c3-b9e2-dd4412c639ce	\N	\N	\N
615	225d9a13-c272-4abe-b803-549fb7595e78	input.yaml	data	2025-03-30 14:33:44.136075	Fallido	1	0	/home/runner/workspace/executions/192f780c-0738-4316-806c-07bd2bd9ac66	\N	\N	\N
616	02388a7d-57b0-4189-9a92-9d016fda4cf4	input.yaml	data	2025-03-30 14:33:50.852745	Fallido	1	0	/home/runner/workspace/executions/e3872a0d-d73c-486f-9ee3-ad5b18ec3b73	\N	\N	\N
617	36a11613-d968-4767-a87b-40d43bbda324	input.yaml	data	2025-03-30 15:21:53.509742	Fallido	1	0	/home/runner/workspace/executions/667086c8-1d5d-4e58-8fa3-847ae2f820e6	56	\N	portal_upload
618	18b3f1ec-40f6-4e43-9af3-e5b930b3cecc	input.yaml	data	2025-03-30 15:22:12.338215	Fallido	1	0	/home/runner/workspace/executions/ef2ec66b-4667-4e92-adb0-d2d1f599fbb4	56	\N	portal_upload
619	8d3e9092-bff7-4388-b0dc-909e21b940b8	input.yaml	data	2025-03-30 15:25:21.244186	Fallido	1	0	/home/runner/workspace/executions/03553ff9-212f-4f29-ba17-058e953e307e	56	\N	portal_upload
620	91016caa-7376-4a6e-953c-a74738bc35c6	input.yaml	data	2025-03-30 15:27:39.627896	Fallido	1	0	/home/runner/workspace/executions/f82fc9f0-e282-4c33-9f5d-1e02644338f3	\N	\N	\N
621	b6d4a370-7400-4d09-915d-1fa10bdc031a	input.yaml	data	2025-03-30 15:30:03.642791	Fallido	1	0	/home/runner/workspace/executions/8ee03824-7c83-4035-8a01-50703d5252ed	56	\N	portal_upload
622	777479e9-e194-4257-a294-58ce3f4d30a2	input.yaml	data	2025-03-30 15:30:06.002021	Fallido	3013	0	/home/runner/workspace/executions/195153e9-88c2-4aad-a9d6-2c411f89c32d	\N	\N	\N
623	970c4ece-395b-4492-9f3c-40e1609bec43	input.yaml	data	2025-03-30 15:30:25.739187	Éxito	0	0	/home/runner/workspace/executions/233f20c8-dd31-4fd5-a810-0fe4a7d9d0d9	\N	\N	\N
624	8f6114a3-ea5d-4654-8b6c-e5ba8c2194d5	input.yaml	data	2025-03-30 18:34:21.1668	Fallido	1	0	/home/runner/workspace/executions/62c0e282-efb3-485d-be6c-11ccd218473b	57	\N	portal_upload
625	7dfb8f4b-d197-4ad4-9f46-8bcb2be7b229	input.yaml	data	2025-03-30 18:35:19.98895	Fallido	1	0	/home/runner/workspace/executions/35db1041-d510-4c00-9a21-84d421b848fc	57	\N	portal_upload
626	b864d13a-bff6-4027-8b47-853781b3ed6d	input.yaml	data	2025-03-30 18:43:57.572947	Fallido	1	0	/home/runner/workspace/executions/f33e6544-d7c3-495e-835c-d1a5629d0f62	\N	\N	\N
627	b7a54c48-1963-4a05-976a-5a991bbbdabf	input.yaml	data	2025-03-30 18:46:38.242826	Fallido	1	0	/home/runner/workspace/executions/e292b8f1-2295-4aff-9fa8-b0e589db2df2	\N	\N	\N
628	ed293777-9eb7-498e-a3ea-866a0ac74c26	input.yaml	data	2025-03-30 18:47:54.399246	Fallido	3	0	/home/runner/workspace/executions/0455db7b-5278-4056-a36a-31ec646dd102	\N	\N	\N
629	3e2ef867-dcb2-498b-b1b1-2ce3df10d378	input.yaml	data	2025-03-30 18:49:31.259663	Fallido	1	0	/home/runner/workspace/executions/b302212b-8ec2-4108-a10d-5c8b0d25bd9e	\N	\N	\N
630	a7823918-3ae2-47a0-a789-aa90c8cc5aa7	input.yaml	data	2025-03-30 18:50:38.211865	Fallido	3	0	/home/runner/workspace/executions/78ec164b-b8ba-43c5-8b08-13fb1e7b0412	\N	\N	\N
631	3dfcf4e6-82e1-423d-b69f-ece987d266a7	input.yaml	data	2025-03-30 18:52:22.375258	Fallido	1	0	/home/runner/workspace/executions/a19f3c20-31fa-4f3a-a6f7-0eee44ff141e	57	\N	portal_upload
632	1a08b697-3eee-4c7b-8424-75e00c869326	input.yaml	data	2025-03-30 18:53:08.437156	Fallido	1	0	/home/runner/workspace/executions/f23fe498-49a0-4dec-b3f0-c6b6f24d7190	57	\N	portal_upload
633	ef17c49c-15f1-4fa2-a2b2-86be612f101a	input.yaml	data	2025-03-30 19:00:01.628215	Éxito	0	0	/home/runner/workspace/executions/c3411c80-e529-451b-a2c9-074f3d7e0fe5	\N	\N	\N
634	27289323-a095-472a-842e-a6e35075d3a7	input.yaml	data	2025-03-30 19:02:08.034688	Fallido	881359	0	/home/runner/workspace/executions/9e2c2ec2-9080-4625-bccd-e7cf88cbf817	57	\N	portal_upload
635	c766b0ff-e9a0-4943-a8f2-ee093b78fda6	input.yaml	data	2025-03-30 19:03:30.59623	Fallido	881359	0	/home/runner/workspace/executions/e193524c-8274-4e1c-86ae-c0a7ee5beecc	57	\N	portal_upload
636	976ab81f-5e90-4adb-91f8-f7d18fd3a528	input.yaml	data	2025-03-30 23:24:55.30444	Fallido	1	0	/home/runner/workspace/executions/ba94750c-1719-48a4-9d12-72ac1381879b	59	\N	portal_upload
637	040136e9-feb8-4693-a1c6-557b0233347d	input.yaml	data	2025-03-30 23:26:08.796077	Fallido	1	0	/home/runner/workspace/executions/dae79800-2590-4d9d-b466-8ee3472c2b37	59	\N	portal_upload
638	0800f191-24fd-439d-96ef-6ed5e7439cb6	input.yaml	data	2025-03-30 23:28:44.846253	Fallido	1	0	/home/runner/workspace/executions/ff843253-8b27-4c5f-888e-152602f5f572	58	\N	portal_upload
639	499e5527-b46a-4105-acef-7d2be1abed1b	input.yaml	data	2025-03-30 23:29:40.510007	Fallido	1	0	/home/runner/workspace/executions/6cfe1da7-3ec1-4f73-bef3-2220fb5c6f1f	58	\N	portal_upload
640	74251c9f-3bf6-4569-8a1c-837152bdb364	input.yaml	data	2025-03-30 23:36:54.796333	Fallido	1	0	/home/runner/workspace/executions/76629f76-4333-492b-973d-d50c9badb28c	\N	\N	\N
641	b97768c5-4abf-4171-b4c5-693770b88251	input.yaml	data	2025-03-30 23:37:39.530842	Fallido	1	0	/home/runner/workspace/executions/cfb2a30c-c669-49d5-9e56-c919e1ee4fbc	\N	\N	\N
642	f4fadb1a-d2be-4a7c-9941-06899b25052a	input.yaml	data	2025-03-30 23:38:28.512115	Fallido	53	0	/home/runner/workspace/executions/cd7f63d5-2944-4f29-917f-1d85c72ab6d2	\N	\N	\N
643	640a1e7a-0b3a-4ba1-a84b-82b6570cfa98	input.yaml	data	2025-03-30 23:38:41.102113	Fallido	53	0	/home/runner/workspace/executions/98d4ae3b-79b4-413b-9462-66b4ecc8f939	\N	\N	\N
644	ac72e2da-293b-43b6-9952-27db5adbada3	input.yaml	data	2025-03-30 23:39:48.248471	Fallido	53	0	/home/runner/workspace/executions/e1a28586-2cbe-49fc-b41c-dfb6c750d307	\N	\N	\N
645	989a0915-2871-43f7-b8ac-3ab90a390526	input.yaml	data	2025-03-30 23:55:44.377779	Fallido	3	0	/home/runner/workspace/executions/4b159b50-14d1-4d02-bae4-4e523463de5d	\N	\N	\N
646	637e0d42-7451-4dc7-93d3-12b93780352b	input.yaml	data	2025-03-30 23:55:57.367934	Fallido	1	0	/home/runner/workspace/executions/6f7c4971-9235-428b-b38d-b6ff58a2b0bf	\N	\N	\N
647	f13169d2-2542-4457-8a95-d8d99421371e	input.yaml	data	2025-03-30 23:56:19.144205	Fallido	1	0	/home/runner/workspace/executions/4c14222f-a443-4e03-94ee-64caab3873e4	\N	\N	\N
648	67257a40-2818-4023-9c6e-fbac01f7e759	input.yaml	data	2025-03-30 23:56:41.108978	Fallido	1	0	/home/runner/workspace/executions/aa361e1c-c3d5-4e74-b157-d25155097d1b	\N	\N	\N
649	012387e6-d821-4eca-a146-d6590149d0d9	input.yaml	data	2025-03-30 23:56:55.87255	Fallido	1	0	/home/runner/workspace/executions/fcb66df1-8eed-43bd-b8d9-a626064bc840	\N	\N	\N
650	73f9c126-cd8d-4f04-bea0-b2db51f75df9	input.yaml	data	2025-03-30 23:57:02.967628	Éxito	0	0	/home/runner/workspace/executions/7daf1e72-c362-4f9d-8e57-d6b68c5f9e5b	\N	\N	\N
651	914b61ef-679f-447b-8941-023500dc08f7	input.yaml	data	2025-03-31 00:13:06.540057	Fallido	1	0	/home/runner/workspace/executions/350598ce-b2c3-470e-9915-618d618cfc5b	\N	\N	\N
652	75278d60-1f41-4534-970f-14746e3ad4c1	input.yaml	data	2025-03-31 00:13:21.631169	Fallido	1	0	/home/runner/workspace/executions/4ab408ad-b81a-4bbb-bb5d-980050d7e69d	\N	\N	\N
653	6a8c5988-6eca-41e7-b8bd-cc58b672e88f	input.yaml	data	2025-03-31 00:37:02.263715	Fallido	53	0	/home/runner/workspace/executions/c92a4348-661a-4d9d-86a1-8138f5b954c5	59	\N	portal_upload
654	b57d35e5-e062-4b1a-9b7a-a75d2a3b821d	input.yaml	data	2025-03-31 00:38:22.390237	Fallido	53	0	/home/runner/workspace/executions/6f0ed1e7-b09c-43ae-8440-1486daf311f0	59	\N	portal_upload
655	b8ffdc56-978d-4ee8-b625-2b03baa9412a	input.yaml	data	2025-03-31 00:42:00.6516	Fallido	53	0	/home/runner/workspace/executions/3f687cc6-a7c8-40bb-8276-b7f18218aca9	58	\N	portal_upload
656	b965c88c-242b-467a-83b1-91bde6b5da6c	input.yaml	data	2025-03-31 00:44:53.9424	Fallido	53	0	/home/runner/workspace/executions/89078d0e-f4a5-491c-9658-49aa787d5f99	58	\N	portal_upload
657	a97ba9d7-f6b2-438b-87a7-c3b510b7b14b	input.yaml	data	2025-03-31 00:46:39.359535	Fallido	53	0	/home/runner/workspace/executions/7871a764-e478-4217-b5f6-3db37019afeb	60	\N	portal_upload
658	9e73b7de-845d-469a-92da-e03fafbea117	input.yaml	data	2025-03-31 00:47:27.156084	Fallido	53	0	/home/runner/workspace/executions/dab71d92-b087-4f9e-bcfa-85fcfc9f1667	60	\N	portal_upload
659	8fd3e33c-a6b1-48a9-9f41-2ccb8db18a30	input.yaml	data	2025-03-31 01:44:56.779382	Fallido	15	10	./test_results_log	\N	\N	\N
660	b09cd6b2-7077-4cd0-a8cf-ca7911ef62af	input.yaml	data	2025-04-02 22:47:20.277581	Fallido	53	0	/home/runner/workspace/executions/8f6acdc0-e5fd-46c7-8c35-bd2b44e6c052	\N	\N	\N
661	9897038f-d83d-45df-977e-d85e62fa8a0c	input.yaml	data	2025-04-02 22:55:14.096026	Fallido	53	0	/home/runner/workspace/executions/b87964f7-d5ec-462b-abe4-3b3b1d4b51d0	\N	\N	\N
662	076f0407-ad93-44ad-a848-88a528199e49	input.yaml	data	2025-04-02 22:55:27.183308	Fallido	53	0	/home/runner/workspace/executions/0f4a62c3-aeea-4606-82ff-6ae607eefe8f	\N	\N	\N
663	f6fc85f7-f266-48ca-b79b-4a68f5674076	input.yaml	data	2025-04-03 03:35:36.596628	Fallido	53	0	/home/runner/workspace/executions/aaf794a2-e68c-44e1-bb2a-44091cfb477f	45	\N	email
664	2e6fa49e-eeb8-40ac-85f8-96e2e336834d	input.yaml	data	2025-04-03 03:59:01.592881	Fallido	53	0	/home/runner/workspace/executions/8803d589-e349-41ec-a834-43c6b8742c84	45	28	email
665	a03f7707-1b6e-45fd-9178-cd8dd3a427c7	input.yaml	data	2025-04-03 03:59:12.48357	Fallido	53	0	/home/runner/workspace/executions/89120103-8c8c-4a55-9b7e-57754e7f98bf	45	28	email
666	0e1c2337-e6b0-42a6-a791-cfce55e0b8d9	input.yaml	data	2025-04-03 17:28:54.906403	Fallido	23	0	/home/runner/workspace/executions/deb3ba60-dc89-4770-a576-09bae0df0457	49	\N	portal_upload
667	aa2d6b46-0b65-40c4-9b29-d20e915a5204	input.yaml	data	2025-04-03 17:28:59.408652	Fallido	23	0	/home/runner/workspace/executions/f945e84f-b10d-4f64-9e5c-6556943880f3	49	\N	portal_upload
669	007b4e20-4507-46a4-9664-e46db4a82f2d	configuracion	clientes_nuevos.csv	2025-04-04 01:51:40.315763	Éxito	0	0	executions/20250404_015140_clientes_nuevos.csv	45	\N	\N
670	416b4afa-6c35-4cfc-9fce-a93fcb0629f2	input.yaml	data	2025-04-04 02:35:33.199001	Fallido	53	0	/home/runner/workspace/executions/d110d63c-0694-41c8-a602-0e081fdbc147	45	\N	sftp
671	4876873f-be40-4ef8-b8dd-c4b9619fabba	input.yaml	data	2025-04-04 02:38:59.240434	Fallido	53	0	/home/runner/workspace/executions/32d73e97-a99d-409e-ab1c-137109cbdf48	45	\N	sftp
672	eecdd018-522b-46bb-a03d-30932f51617f	input.yaml	data	2025-04-04 02:45:36.694573	Fallido	53	0	/home/runner/workspace/executions/4cb180c0-b13d-46ed-9bef-9026350472c6	45	\N	sftp
673	d49d3674-ae4a-4936-8b51-408f2f705393	configuracion	output.zip	2025-04-04 02:49:43.942471	Éxito	0	0	executions/20250404_024944_output.zip	45	\N	\N
674	0ca3ef2d-c070-4fa1-85e7-dc8890efbcf3	input.yaml	data	2025-04-04 02:51:01.010482	Fallido	53	0	/home/runner/workspace/executions/b56f9c57-7fff-4e02-8ae9-44dea73a2605	45	\N	sftp
675	9d839771-6211-4a3f-a359-93a178a4013f	configuracion	output2.zip	2025-04-04 02:53:15.62144	Éxito	0	0	executions/20250404_025315_output2.zip	45	\N	\N
676	768335d4-b944-4fa2-92cf-6071f88f770d	configuracion	test_output.txt	2025-04-04 02:53:16.023612	Éxito	0	0	executions/20250404_025315_test_output.txt	45	\N	\N
677	c979f424-7c9a-462f-b480-1130418dc932	configuracion	test_file.csv	2025-04-04 02:56:13.765321	Éxito	0	0	executions/20250404_025613_test_file.csv	45	22	\N
678	2cf70e41-e58c-4ee9-82ab-1aea0fbc755f	input.yaml	data	2025-04-04 03:01:36.787257	Fallido	53	0	/home/runner/workspace/executions/843f1030-76f8-4ead-be53-84b540a26a9b	45	\N	sftp
679	1bbfa48b-c6fd-42f7-bca3-1fc6114733a0	configuracion	output.zip	2025-04-04 02:52:47.780806	Éxito	0	0	executions/843f1030-76f8-4ead-be53-84b540a26a9b	45	22	sftp
680	9e4b4e36-9a50-4abd-9a0a-2121fed13d13	input.yaml	data	2025-04-04 03:14:45.405919	Fallido	53	0	/home/runner/workspace/executions/11495692-6058-4169-b83f-577aa04aafa1	45	\N	sftp
681	992c1842-f549-467d-a837-7621404df155	configuracion	output.zip	2025-04-04 03:02:41.379687	Éxito	0	0	executions/11495692-6058-4169-b83f-577aa04aafa1	45	22	sftp
682	a789883c-5aaa-4081-9a5b-05656f851971	configuracion	test_productos.csv	2025-04-04 03:19:35.251393	Éxito	0	0	executions/20250404_031935_test_productos.csv	45	18	\N
683	d868d7f2-4f5e-43c5-8dd6-daf391ba24a7	configuracion	test_productos2.csv	2025-04-04 03:21:53.927864	Éxito	0	0	executions/20250404_032154_test_productos2.csv	45	18	\N
684	724ecbdb-dcf7-4047-8b02-d9643e1aa935	input.yaml	data	2025-04-04 03:23:33.639175	Fallido	53	0	/home/runner/workspace/executions/7acab045-4b3c-4f2c-a221-26de27641abd	45	\N	sftp
685	abbd45c7-516d-4369-a713-021741e50c18	configuracion	output.zip	2025-04-04 03:21:14.047029	Éxito	0	0	executions/7acab045-4b3c-4f2c-a221-26de27641abd	45	22	sftp
686	4ae81c48-ec3e-438c-97a1-5e638b20675a	configuracion	test_file.txt	2025-04-04 03:26:55.093572	Éxito	0	0	executions/20250404_032655_test_file.txt	45	18	\N
687	bf4bb282-6fc3-46cc-ae6f-3526e50999f6	configuracion	test_file_20250404032945.txt	2025-04-04 03:30:17.441265	Éxito	0	0	executions/20250404_033017_test_file_20250404032945.txt	45	18	\N
688	410ba4e5-2dea-4fc1-901a-a0dba64a4d3f	input.yaml	data	2025-04-04 03:30:48.204443	Fallido	53	0	/home/runner/workspace/executions/7c20404f-3add-4fee-89b8-ead07f46b7bb	45	18	sftp
689	284d9491-8f9d-442e-8929-812f74bd1666	configuracion	output.zip	2025-04-04 03:28:26.304063	Éxito	0	0	executions/7c20404f-3add-4fee-89b8-ead07f46b7bb	45	18	sftp
691	801384fd-2f2c-461e-8dc8-a17ab8ccfbff	input.yaml	data	2025-04-04 03:38:21.92342	Fallido	1	0	/home/runner/workspace/executions/37df174d-d242-41a2-ba9a-c37430673360	45	18	direct_upload
692	5b6d0443-a98b-46eb-963b-bbf2b936de70	input.yaml	data	2025-04-04 22:56:10.33922	Fallido	53	0	/home/runner/workspace/executions/651f1e5e-91c1-4af6-a85e-700e8494637b	45	18	sftp
693	407c30bb-ea5a-47c5-9002-734d1b7ba72d	configuracion	output.zip	2025-04-04 22:53:48.519199	Éxito	0	0	executions/651f1e5e-91c1-4af6-a85e-700e8494637b	45	18	sftp
694	fbffe98d-d3c1-438c-b2b4-4d7b76cf99ce	input.yaml	data	2025-04-04 23:14:49.392561	Fallido	53	0	/home/runner/workspace/executions/a6cc7c6a-c4d7-4d46-84c1-b778e77fe1be	45	18	sftp
695	6d1ba5d0-8310-4767-8830-99b48aa4f6d0	configuracion	output.zip	2025-04-04 23:12:24.033008	Éxito	0	0	executions/a6cc7c6a-c4d7-4d46-84c1-b778e77fe1be	45	18	sftp
696	cce89b73-1707-4553-92a1-f97db83354e5	input.yaml	data	2025-04-04 23:20:36.362705	Fallido	53	0	/home/runner/workspace/executions/d513132e-60ef-45e7-8fc0-90a6f5567b01	45	18	sftp
697	7b61fb9a-8f87-474e-bd75-eef848e697ac	configuracion	output.zip	2025-04-04 23:18:11.737328	Éxito	0	0	executions/d513132e-60ef-45e7-8fc0-90a6f5567b01	45	18	sftp
698	db1fb9a4-0b78-48d1-a2ad-e4fcbb19e617	input.yaml	data	2025-04-04 23:24:06.974748	Fallido	53	0	/home/runner/workspace/executions/d271de3b-1164-4afa-808e-43e68d391fe5	45	18	sftp
699	46f1efe6-416a-4961-8dfc-37e2f85dc87d	configuracion	output.zip	2025-04-04 23:21:43.637258	Éxito	0	0	executions/d271de3b-1164-4afa-808e-43e68d391fe5	45	18	sftp
700	8a98a672-6379-484c-80bb-be916071f303	input.yaml	data	2025-04-04 23:33:57.46904	Fallido	53	0	/home/runner/workspace/executions/417949f8-a5ae-44d6-be5a-9be8d987f595	45	18	sftp
701	b04ad105-c1ff-44c2-958b-cdafb00c32a0	configuracion	output.zip	2025-04-04 23:31:24.075186	Éxito	0	0	executions/417949f8-a5ae-44d6-be5a-9be8d987f595	45	18	sftp
702	a7eed547-45a3-4ed0-844b-2a2cc513d807	input.yaml	data	2025-04-04 23:37:27.548604	Fallido	53	0	/home/runner/workspace/executions/3d32d90b-656e-468a-8ced-779865c34a0f	45	18	sftp
703	72ab9e19-bbfc-446a-bffd-ebbc6502936d	configuracion	output.zip	2025-04-04 23:35:04.684243	Éxito	0	0	executions/3d32d90b-656e-468a-8ced-779865c34a0f	45	18	sftp
704	dc4997bc-26b2-4fda-b54c-822a1738ea62	input.yaml	data	2025-04-04 23:43:22.791732	Fallido	53	0	/home/runner/workspace/executions/b1631648-c6ea-4f4a-bbb3-539aac8c2052	45	18	sftp
705	1795554f-a49d-4481-bc12-b162005ee07e	configuracion	output.zip	2025-04-04 23:40:57.414101	Éxito	0	0	executions/b1631648-c6ea-4f4a-bbb3-539aac8c2052	45	18	sftp
707	bd56af10-bded-4eb8-8ba8-e2a2aec39901	configuracion_notificaciones.yaml	test_notificaciones.csv	2025-04-05 01:00:30.059319	Fallido	5	3	/tmp/executions/test_notif001	45	18	email
\.


--
-- Data for Name: email_configuraciones; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.email_configuraciones (id, nombre, direccion, proposito, servidor_entrada, puerto_entrada, protocolo_entrada, usar_ssl_entrada, servidor_salida, puerto_salida, usar_tls_salida, usuario, password, casilla_id, estado, ultimo_chequeo, mensaje_error, fecha_creacion, fecha_modificacion) FROM stdin;
5	Casilla: Mondelez distribuidores	casilla45@sage.vidahub.ai	multiple	imap.dreamhost.com	993	imap	t	smtp.dreamhost.com	587	t	casilla45@sage.vidahub.ai	krx32aFF	45	pendiente	\N	\N	2025-03-31 20:10:01.628708	2025-04-02 02:05:52.751446
1	Info SAGE	info@sage.vidahub.ai	admin	imap.dreamhost.com	993	imap	t	smtp.dreamhost.com	587	t	info@sage.vidahub.ai	krx32aFF	49	activo	\N	\N	2025-03-31 19:18:32.049815	2025-03-31 23:19:41.044598
\.


--
-- Data for Name: emisores; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.emisores (id, organizacion_id, nombre, email_corporativo, telefono, tipo_emisor, creado_en, activo) FROM stdin;
1	1	Juan Pérez	juan@mondelez.com	+51 999999999	interno	2025-03-10 10:00:00	t
2	1	Distribuidor XYZ	contacto@xyz.com	+51 988888888	distribuidora	2025-03-10 10:00:00	t
18	2	Distribuidor Oscar Rejas	vchigne@yahoo.com	997924355	distribuidora	2025-03-11 20:57:55.072599	t
20	2	Distribuidor Los amigos	vchigne@yaho1.com	997924355	bot	2025-03-11 21:00:32.502687	t
25	4	Aceros Procesados S.A.	aceros@example.com	+511234567	corporativo	2025-03-29 21:51:06.918251	t
26	4	Industrias Plásticas	plasticos@example.com	+511234568	distribuidora	2025-03-29 21:51:06.918251	t
27	4	Transportes Rápidos	transportes@example.com	+511234569	otros	2025-03-29 21:51:06.918251	t
28	\N	Emisor de Prueba	victor.chigne@gmail.com	\N	\N	2025-04-02 02:08:29.054361	t
\.


--
-- Data for Name: emisores_por_casilla; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.emisores_por_casilla (id, emisor_id, casilla_id, metodo_envio, parametros, responsable_nombre, responsable_email, responsable_telefono, configuracion_frecuencia, frecuencia_tipo_id, responsable_activo, created_at, updated_at, responsable, frecuencia) FROM stdin;
6	20	43	email	{"emails_autorizados": "victor.chigne@gmail.com"}	\N	\N	\N	\N	\N	t	2025-03-28 21:40:45.010242+00	2025-03-28 21:40:45.010242+00	\N	\N
7	18	43	email	{"emails_autorizados": "victor.chigne@gmail.com"}	\N	\N	\N	\N	\N	t	2025-03-28 21:40:45.010242+00	2025-03-28 21:40:45.010242+00	\N	\N
8	2	43	sftp	{"clave": "123", "usuario": "listo", "servidor": "LISTA.COM"}	\N	\N	\N	\N	\N	t	2025-03-28 21:40:45.010242+00	2025-03-28 21:40:45.010242+00	\N	\N
9	2	43	local	{}	\N	\N	\N	\N	\N	t	2025-03-28 21:40:45.010242+00	2025-03-28 21:40:45.010242+00	\N	\N
10	18	44	email	{"emails_autorizados": "victor.chigne@gmail.com"}	\N	\N	\N	\N	\N	t	2025-03-28 21:40:45.010242+00	2025-03-28 21:40:45.010242+00	\N	\N
13	1	30	email	{"emails_autorizados": "victor.chigne@gmail.com"}	\N	\N	\N	\N	\N	t	2025-03-28 21:40:45.010242+00	2025-03-28 21:40:45.010242+00	\N	\N
14	2	30	api	{}	\N	\N	\N	\N	\N	t	2025-03-28 21:40:45.010242+00	2025-03-28 21:40:45.010242+00	\N	\N
17	1	49	email	{"emails_autorizados": "juancarlos.vallejos@vida.software"}	Oscar Perez	oscar@perez.com	997924355	{"hora": "09:00", "tipo": "hasta_dia_n", "dia_limite": "16"}	\N	t	2025-03-28 23:01:56.564263+00	2025-03-28 23:01:56.564263+00	\N	\N
18	2	49	api	{}	Juan	\N	\N	\N	\N	t	2025-03-28 23:02:28.344246+00	2025-03-28 23:02:28.344246+00	\N	\N
19	1	43	email	{"emails_autorizados": "victor.chigne@gmail.com"}	Oscar Rodriguez	\N	\N	\N	\N	t	2025-04-01 00:09:25.389997+00	2025-04-01 00:09:25.389997+00	\N	\N
20	18	61	email	{"emails_autorizados": "dey.inteliventas@gmail.com"}	\N	\N	\N	\N	\N	t	2025-04-03 19:01:00.888947+00	2025-04-03 19:01:00.888947+00	\N	\N
22	18	45	sftp	{"clave": "krx32aFF", "usuario": "distribuidortest", "servidor": "iad1-shared-e1-15.dreamhost.com"}	\N	\N	\N	\N	\N	t	2025-04-04 01:04:23.947319+00	2025-04-04 01:04:23.947319+00	\N	\N
11	20	45	email	{"sftp_host": "localhost", "sftp_port": 22, "sftp_user": "sage", "sftp_password": "sage123", "emails_autorizados": ["test@sftp.com", "info@sage.vidahub.ai"]}	\N	\N	\N	\N	\N	t	2025-03-28 21:40:45.010242+00	2025-03-28 21:40:45.010242+00	\N	\N
21	18	45	local	{"sftp_host": "localhost", "sftp_port": 22, "sftp_user": "testuser", "sftp_password": "testpassword", "emails_autorizados": ["test@sftp.com", "info@sage.vidahub.ai"]}	\N	\N	\N	\N	\N	t	2025-04-04 01:04:23.947319+00	2025-04-04 01:04:23.947319+00	\N	\N
23	20	59	email	{"emails_autorizados": "ramiro_calle@gmail.com"}	Ramiro Calle	ramiro@calle.com	\N	{"hora": "09:00", "tipo": "diario"}	\N	t	2025-04-06 20:13:56.870194+00	2025-04-06 20:13:56.870194+00	\N	\N
\.


--
-- Data for Name: envios_realizados; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.envios_realizados (id, emisor_id, casilla_recepcion_id, metodo_envio, usuario_envio_id, fecha_envio, archivo_nombre, uuid_ejecucion, estado) FROM stdin;
\.


--
-- Data for Name: eventos_notificacion; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.eventos_notificacion (id, tipo, emisor, casilla_id, mensaje, detalles, fecha_creacion, procesado, fecha_procesado) FROM stdin;
2	error	SAGE Daemon	45	Error al procesar archivo	{"error": "Formato incorrecto", "linea": 25, "archivo": "datos.csv"}	2025-04-05 00:14:11.592095+00	f	\N
\.


--
-- Data for Name: eventos_pendientes; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.eventos_pendientes (id, suscripcion_id, evento_id, fecha_creacion, fecha_programada, procesado, fecha_procesado, intentos, ultimo_error) FROM stdin;
\.


--
-- Data for Name: frecuencias_tipo; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.frecuencias_tipo (id, nombre, descripcion, activo) FROM stdin;
1	diaria	Frecuencia de envío diaria	t
2	semanal	Frecuencia de envío semanal	t
3	mensual	Frecuencia de envío mensual	t
\.


--
-- Data for Name: instalaciones; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.instalaciones (id, organizacion_id, pais_id, producto_id, nombre) FROM stdin;
1	1	1	1	Strategio Canal Tradicional - Mondelez (Perú)
2	1	2	2	Strategio Canal Moderno - Mondelez (Chile)
3	3	2	4	Strategio Moderno - Nestlé (Chile)
4	2	3	3	Geosales - Clorox (Caribe)
5	4	1	1	Strategio Canal Tradicional - Alicorp (Perú)
6	2	1	1	Strategio Canal Tradicional - Clorox (Perú)
7	1	1	2	Strategio Canal Moderno - Mondelez (Perú)
\.


--
-- Data for Name: migrations; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.migrations (id, name, applied_at) FROM stdin;
1	01_reset_suscripciones.sql	2025-03-29 20:01:12.451463+00
2	02_add_metodo_envio_to_suscripciones.sql	2025-03-29 21:28:57.066516+00
3	03_add_tech_fields_to_suscripciones_fix.sql	2025-03-30 00:39:31.887875+00
4	04_allow_null_email_in_suscripciones.sql	2025-03-30 00:41:43.61051+00
\.


--
-- Data for Name: notificaciones_enviadas; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.notificaciones_enviadas (id, suscripcion_id, eventos_ids, cantidad_eventos, resumen, fecha_envio, estado, mensaje_error, tipo_envio, detalles_envio) FROM stdin;
1	10	{707,704,705,702,703,700,701,698,699,696,697,694,695,692,693,691,688,687,689,686,684,683,685,682,680,681,678,677,676,675,679}	31	SAGE - Nestlé canal tradicional Perú  - Proyecto BI CLOROX - Definición SAGE - 13 errores	2025-04-05 02:51:52.419829+00	enviado	\N	email	\N
\.


--
-- Data for Name: organizaciones; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.organizaciones (id, nombre, creado_en) FROM stdin;
1	Mondelez	2025-03-10 10:00:00
2	Clorox	2025-03-10 10:05:00
3	Nestlé	2025-03-10 22:33:23.571743
4	Alicorp	2025-03-28 23:31:02.887634
\.


--
-- Data for Name: paises; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.paises (id, codigo_iso, nombre, es_territorio_personalizado) FROM stdin;
1	PE	Perú	f
2	CL	Chile	f
3	CB	Caribe	t
\.


--
-- Data for Name: portales; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.portales (id, instalacion_id, uuid, nombre, creado_en, activo, ultimo_acceso) FROM stdin;
4	1	1268c351-93e9-4b1d-8675-9c1360133cf3	Strategio Canal Tradicional - Mondelez	2025-03-14 19:32:07.783612+00	t	\N
7	4	bc832676-940a-4479-bef7-736f4562f86a	Geosales - Clorox	2025-03-14 20:28:18.359723+00	t	2025-03-14 20:39:06.74927+00
6	3	49766cfb-a304-4623-a671-a8ca9b0b32a0	Strategio Moderno - Nestlé	2025-03-14 20:06:35.01303+00	t	2025-03-18 17:39:02.997069+00
10	1	7c49c57e-8aa0-4103-b247-c1c85a1ab6c1	Strategio Canal Tradicional - Mondelez	2025-03-14 20:47:11.137705+00	t	2025-04-06 20:56:55.340901+00
13	6	e4621e48-6dac-466d-aa4a-c84c0b993463	Strategio Canal Tradicional - Clorox	2025-03-30 13:45:39.920023+00	t	2025-04-06 20:59:19.721965+00
2	1	1f89e96b-e1bb-4aa4-b584-74b84c546aba	Tradicional Mondeléz peru	2025-03-14 19:28:20.283778+00	t	2025-04-07 16:02:58.495135+00
9	4	b67fe8dc-3f12-44c1-88ee-9c64b61cc314	Geosales - Clorox5	2025-03-14 20:42:02.524712+00	t	2025-03-19 20:51:09.653683+00
8	4	e0bf732c-a4ef-475d-9288-cb986f3a776d	Geosales - Clorox4	2025-03-14 20:40:03.640227+00	t	2025-04-07 16:06:56.620397+00
12	3	16296296-913a-49c2-8b61-84cf0a73c691	Strategio Moderno - Nestlé	2025-03-29 00:21:43.353122+00	f	\N
5	2	954807fa-01c6-40a2-bb9e-fbacc5b82a73	Strategio Canal Moderno - Mondelez	2025-03-14 19:34:42.426633+00	t	2025-03-15 15:23:11.472244+00
1	3	dd3aa7cd-0b90-4dba-88bc-5ed7f6785636	Nestlé canal tradicional Perú 	2025-03-14 19:25:13.471295+00	t	2025-03-29 01:48:42.564896+00
3	1	7414a3f5-16b9-471a-b41a-0fce61220251	Tradicional Mondeléz peru	2025-03-14 19:28:21.103224+00	t	2025-03-17 16:21:35.956264+00
11	5	251e0f9b-be8e-4949-94db-71d6a5703c31	Strategio Canal Tradicional - Alicorp	2025-03-29 00:15:56.026312+00	t	2025-04-03 17:32:27.048745+00
\.


--
-- Data for Name: productos; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.productos (id, nombre) FROM stdin;
1	Strategio Canal Tradicional
2	Strategio Canal Moderno
3	Geosales
4	Strategio Moderno
\.


--
-- Data for Name: suscripciones; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.suscripciones (id, nombre, email, telefono, activo, frecuencia, nivel_detalle, dia_envio, tipos_evento, casilla_id, emisores, created_at, updated_at, last_notification_at, metodo_envio, es_tecnico, webhook_url, api_key, hora_envio) FROM stdin;
4	Webhook SAGE Eventos	\N	\N	t	inmediata	detallado	\N	["error", "warning"]	30	[]	2025-03-30 00:42:15.788545+00	2025-03-30 00:42:15.788545+00	\N	webhook	t	https://webhook.example.com/sage-events	api-key-123456	\N
5	BOT CARGA DAGSTER	\N		t	diaria	detallado	\N	["exito"]	54	[]	2025-03-30 01:34:26.798781+00	2025-03-30 01:57:23.376896+00	\N	email	t	http://testhook.com/test	1233444	07:09:00
7	BOT CARGA DAGSTER 3	\N	\N	t	semanal	detallado	1	["mensaje", "demora"]	54	[20, 18]	2025-03-30 02:00:54.752772+00	2025-03-30 02:00:54.752772+00	\N	email	t	http://testhook.com/test	\N	08:00:00
8	BOT CARGA DAGSTER	oramos@ramos.com	9987557744	t	inmediata	detallado	\N	["warning", "mensaje", "demora"]	52	[25]	2025-03-30 02:34:24.222418+00	2025-03-30 02:38:32.072267+00	\N	email	f			08:00:00
9	BOT CARGA DAGSTER 5	oramos@ramos.com	\N	t	inmediata	detallado	\N	["error", "warning", "mensaje", "exito", "demora"]	52	[]	2025-03-30 02:38:58.484753+00	2025-03-30 02:38:58.484753+00	\N	email	f	\N	\N	08:00:00
1	Oscar Ramos	oramos@ramos.com	9987557744	t	diaria	resumido_casilla	1	["error", "warning", "info", "success"]	46	[18, 26, 25]	2025-03-29 22:10:10.44128+00	2025-03-29 22:10:10.44128+00	\N	email	f	\N	\N	00:09:00
12	BOT CARGA DAGSTER n7	\N		t	inmediata	detallado	\N	["exito", "mensaje"]	53	[]	2025-03-30 02:57:59.001794+00	2025-03-30 02:58:21.665062+00	\N	email	t	http://testhook.com/test	1233444	08:00:00
11	BOT CARGA DAGSTER 7 	oramos@ramos.com		t	inmediata	detallado	\N	["mensaje", "exito"]	51	[]	2025-03-30 02:50:23.502877+00	2025-03-30 02:58:34.377636+00	\N	email	f			08:00:00
13	BOT CARGA DAGSTER 9	\N	\N	t	diaria	detallado	\N	["exito"]	53	[]	2025-03-30 02:59:11.892173+00	2025-03-30 02:59:11.892173+00	\N	email	t	http://testhook.com/test	1233444	08:00:00
14	Rojas Steven	restyeven@dalsttes.com	\N	t	inmediata	detallado	\N	["error", "warning", "mensaje", "exito", "demora"]	51	[]	2025-03-30 03:13:53.197155+00	2025-03-30 03:13:53.197155+00	\N	email	f	\N	\N	08:00:00
15	Jaier Zuloaga	vchigne@yahoo.com	9987557744	t	diaria	detallado	\N	["error", "warning", "mensaje", "exito", "demora", "otro"]	30	[]	2025-04-01 22:41:58.805915+00	2025-04-01 22:41:58.805915+00	\N	email	f	\N	\N	08:00:00
16	Prueba SAGE	admin@sage.vidahub.ai	\N	t	inmediata	detallado	\N	["error", "warning", "info", "success"]	45	[]	2025-04-05 02:45:11.45166+00	2025-04-05 02:45:11.45166+00	2025-04-05 02:49:05.108392+00	email	f	\N	\N	\N
10	BOT CARGA DAGSTER	oramos@ramos.com	\N	t	inmediata	detallado	\N	["error", "warning", "mensaje", "exito", "demora"]	45	[]	2025-03-30 02:50:08.950129+00	2025-03-30 02:50:08.950129+00	2025-04-05 02:51:52.559851+00	email	f	\N	\N	08:00:00
17	BOT CARGA YATO	\N	\N	t	inmediata	detallado	\N	["exito"]	61	[]	2025-04-07 16:04:31.938491+00	2025-04-07 16:04:31.938491+00	\N	email	t	http://testhook.com/test	\N	08:00:00
18	Darli	darli@darli.om	\N	t	diaria	resumido_casilla	\N	["error", "warning", "mensaje", "exito", "demora"]	61	[]	2025-04-07 16:05:22.706182+00	2025-04-07 16:05:22.706182+00	\N	email	f	\N	\N	08:00:00
\.


--
-- Data for Name: suscripciones_backup; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.suscripciones_backup (id, suscriptor_id, casilla_id, emisores_ids, notificar_errores, notificar_warnings, notificar_mensajes, notificar_otros, frecuencia, hora_envio, dia_envio, extension, formato_notificacion, fecha_creacion, fecha_modificacion, fecha_ultima_notificacion, activo, uuid) FROM stdin;
1	1	45	{1,2}	t	t	t	f	semanal	10:00:00	1	resumida_emisor	email	2025-03-29 19:09:40.596526	2025-03-29 19:09:54.119601	\N	t	2bff1dd9-01e8-4a37-8e3f-a26a3cb66f5b
\.


--
-- Data for Name: usuarios; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.usuarios (id, nombre, email, creado_en) FROM stdin;
1	Admin SAGE	admin@vidasoftware.com	2025-03-10 21:07:56.570948
\.


--
-- Data for Name: webhooks_configuracion; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.webhooks_configuracion (id, suscripcion_id, url_endpoint, metodo_http, headers, requiere_autenticacion, tipo_autenticacion, credenciales, activo, fecha_creacion, fecha_modificacion) FROM stdin;
\.


--
-- Name: casillas_recepcion_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.casillas_recepcion_id_seq', 62, true);


--
-- Name: ejecuciones_yaml_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.ejecuciones_yaml_id_seq', 707, true);


--
-- Name: email_configuraciones_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.email_configuraciones_id_seq', 6, true);


--
-- Name: emisores_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.emisores_id_seq', 28, true);


--
-- Name: envios_realizados_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.envios_realizados_id_seq', 2, true);


--
-- Name: eventos_notificacion_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.eventos_notificacion_id_seq', 2, true);


--
-- Name: eventos_pendientes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.eventos_pendientes_id_seq', 1, false);


--
-- Name: frecuencias_tipo_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.frecuencias_tipo_id_seq', 3, true);


--
-- Name: instalaciones_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.instalaciones_id_seq', 7, true);


--
-- Name: metodos_envio_emisor_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.metodos_envio_emisor_id_seq', 23, true);


--
-- Name: migrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.migrations_id_seq', 4, true);


--
-- Name: notificaciones_enviadas_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.notificaciones_enviadas_id_seq', 1, true);


--
-- Name: organizaciones_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.organizaciones_id_seq', 4, true);


--
-- Name: paises_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.paises_id_seq', 3, true);


--
-- Name: portales_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.portales_id_seq', 13, true);


--
-- Name: productos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.productos_id_seq', 4, true);


--
-- Name: suscripciones_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.suscripciones_id_seq', 18, true);


--
-- Name: usuarios_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.usuarios_id_seq', 1, true);


--
-- Name: webhooks_configuracion_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.webhooks_configuracion_id_seq', 1, false);


--
-- Name: casillas casillas_recepcion_email_casilla_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.casillas
    ADD CONSTRAINT casillas_recepcion_email_casilla_key UNIQUE (email_casilla);


--
-- Name: casillas casillas_recepcion_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.casillas
    ADD CONSTRAINT casillas_recepcion_pkey PRIMARY KEY (id);


--
-- Name: webhooks_configuracion chk_webhook_suscripcion; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.webhooks_configuracion
    ADD CONSTRAINT chk_webhook_suscripcion UNIQUE (suscripcion_id);


--
-- Name: ejecuciones_yaml ejecuciones_yaml_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.ejecuciones_yaml
    ADD CONSTRAINT ejecuciones_yaml_pkey PRIMARY KEY (id);


--
-- Name: ejecuciones_yaml ejecuciones_yaml_uuid_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.ejecuciones_yaml
    ADD CONSTRAINT ejecuciones_yaml_uuid_key UNIQUE (uuid);


--
-- Name: email_configuraciones email_configuraciones_direccion_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.email_configuraciones
    ADD CONSTRAINT email_configuraciones_direccion_key UNIQUE (direccion);


--
-- Name: email_configuraciones email_configuraciones_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.email_configuraciones
    ADD CONSTRAINT email_configuraciones_pkey PRIMARY KEY (id);


--
-- Name: emisores emisores_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.emisores
    ADD CONSTRAINT emisores_pkey PRIMARY KEY (id);


--
-- Name: envios_realizados envios_realizados_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.envios_realizados
    ADD CONSTRAINT envios_realizados_pkey PRIMARY KEY (id);


--
-- Name: eventos_notificacion eventos_notificacion_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.eventos_notificacion
    ADD CONSTRAINT eventos_notificacion_pkey PRIMARY KEY (id);


--
-- Name: eventos_pendientes eventos_pendientes_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.eventos_pendientes
    ADD CONSTRAINT eventos_pendientes_pkey PRIMARY KEY (id);


--
-- Name: frecuencias_tipo frecuencias_tipo_nombre_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.frecuencias_tipo
    ADD CONSTRAINT frecuencias_tipo_nombre_key UNIQUE (nombre);


--
-- Name: frecuencias_tipo frecuencias_tipo_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.frecuencias_tipo
    ADD CONSTRAINT frecuencias_tipo_pkey PRIMARY KEY (id);


--
-- Name: instalaciones instalaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.instalaciones
    ADD CONSTRAINT instalaciones_pkey PRIMARY KEY (id);


--
-- Name: emisores_por_casilla metodos_envio_emisor_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.emisores_por_casilla
    ADD CONSTRAINT metodos_envio_emisor_pkey PRIMARY KEY (id);


--
-- Name: migrations migrations_name_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.migrations
    ADD CONSTRAINT migrations_name_key UNIQUE (name);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


--
-- Name: notificaciones_enviadas notificaciones_enviadas_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.notificaciones_enviadas
    ADD CONSTRAINT notificaciones_enviadas_pkey PRIMARY KEY (id);


--
-- Name: organizaciones organizaciones_nombre_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.organizaciones
    ADD CONSTRAINT organizaciones_nombre_key UNIQUE (nombre);


--
-- Name: organizaciones organizaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.organizaciones
    ADD CONSTRAINT organizaciones_pkey PRIMARY KEY (id);


--
-- Name: paises paises_codigo_iso_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.paises
    ADD CONSTRAINT paises_codigo_iso_key UNIQUE (codigo_iso);


--
-- Name: paises paises_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.paises
    ADD CONSTRAINT paises_pkey PRIMARY KEY (id);


--
-- Name: portales portales_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.portales
    ADD CONSTRAINT portales_pkey PRIMARY KEY (id);


--
-- Name: portales portales_uuid_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.portales
    ADD CONSTRAINT portales_uuid_key UNIQUE (uuid);


--
-- Name: productos productos_nombre_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_nombre_key UNIQUE (nombre);


--
-- Name: productos productos_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_pkey PRIMARY KEY (id);


--
-- Name: suscripciones suscripciones_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.suscripciones
    ADD CONSTRAINT suscripciones_pkey PRIMARY KEY (id);


--
-- Name: eventos_pendientes uk_evento_suscripcion; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.eventos_pendientes
    ADD CONSTRAINT uk_evento_suscripcion UNIQUE (evento_id, suscripcion_id);


--
-- Name: usuarios usuarios_email_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_email_key UNIQUE (email);


--
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id);


--
-- Name: webhooks_configuracion webhooks_configuracion_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.webhooks_configuracion
    ADD CONSTRAINT webhooks_configuracion_pkey PRIMARY KEY (id);


--
-- Name: eventos_notificacion_casilla_id_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX eventos_notificacion_casilla_id_idx ON public.eventos_notificacion USING btree (casilla_id);


--
-- Name: eventos_notificacion_emisor_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX eventos_notificacion_emisor_idx ON public.eventos_notificacion USING btree (emisor);


--
-- Name: eventos_notificacion_procesado_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX eventos_notificacion_procesado_idx ON public.eventos_notificacion USING btree (procesado);


--
-- Name: eventos_notificacion_tipo_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX eventos_notificacion_tipo_idx ON public.eventos_notificacion USING btree (tipo);


--
-- Name: idx_email_config_casilla; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_email_config_casilla ON public.email_configuraciones USING btree (casilla_id);


--
-- Name: idx_email_config_estado; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_email_config_estado ON public.email_configuraciones USING btree (estado);


--
-- Name: idx_email_config_proposito; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_email_config_proposito ON public.email_configuraciones USING btree (proposito);


--
-- Name: idx_eventos_pendientes_evento; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_eventos_pendientes_evento ON public.eventos_pendientes USING btree (evento_id);


--
-- Name: idx_eventos_pendientes_fecha; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_eventos_pendientes_fecha ON public.eventos_pendientes USING btree (fecha_programada);


--
-- Name: idx_eventos_pendientes_procesado; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_eventos_pendientes_procesado ON public.eventos_pendientes USING btree (procesado);


--
-- Name: idx_eventos_pendientes_suscripcion; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_eventos_pendientes_suscripcion ON public.eventos_pendientes USING btree (suscripcion_id);


--
-- Name: idx_webhooks_suscripcion; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_webhooks_suscripcion ON public.webhooks_configuracion USING btree (suscripcion_id);


--
-- Name: notificaciones_enviadas_estado_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX notificaciones_enviadas_estado_idx ON public.notificaciones_enviadas USING btree (estado);


--
-- Name: notificaciones_enviadas_fecha_envio_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX notificaciones_enviadas_fecha_envio_idx ON public.notificaciones_enviadas USING btree (fecha_envio);


--
-- Name: notificaciones_enviadas_suscripcion_id_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX notificaciones_enviadas_suscripcion_id_idx ON public.notificaciones_enviadas USING btree (suscripcion_id);


--
-- Name: suscripciones_casilla_id_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX suscripciones_casilla_id_idx ON public.suscripciones USING btree (casilla_id);


--
-- Name: suscripciones_email_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX suscripciones_email_idx ON public.suscripciones USING btree (email);


--
-- Name: casillas casilla_email_actualizada; Type: TRIGGER; Schema: public; Owner: neondb_owner
--

CREATE TRIGGER casilla_email_actualizada AFTER UPDATE ON public.casillas FOR EACH ROW EXECUTE FUNCTION public.trigger_casilla_email_actualizada();


--
-- Name: casillas casilla_email_eliminada; Type: TRIGGER; Schema: public; Owner: neondb_owner
--

CREATE TRIGGER casilla_email_eliminada AFTER DELETE ON public.casillas FOR EACH ROW EXECUTE FUNCTION public.trigger_casilla_email_eliminada();


--
-- Name: casillas casilla_email_nueva; Type: TRIGGER; Schema: public; Owner: neondb_owner
--

CREATE TRIGGER casilla_email_nueva AFTER INSERT ON public.casillas FOR EACH ROW EXECUTE FUNCTION public.trigger_casilla_email_nueva();


--
-- Name: webhooks_configuracion update_webhooks_fecha_modificacion; Type: TRIGGER; Schema: public; Owner: neondb_owner
--

CREATE TRIGGER update_webhooks_fecha_modificacion BEFORE UPDATE ON public.webhooks_configuracion FOR EACH ROW EXECUTE FUNCTION public.update_fecha_modificacion();


--
-- Name: casillas casillas_recepcion_instalacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.casillas
    ADD CONSTRAINT casillas_recepcion_instalacion_id_fkey FOREIGN KEY (instalacion_id) REFERENCES public.instalaciones(id) ON DELETE CASCADE;


--
-- Name: ejecuciones_yaml ejecuciones_yaml_casilla_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.ejecuciones_yaml
    ADD CONSTRAINT ejecuciones_yaml_casilla_id_fkey FOREIGN KEY (casilla_id) REFERENCES public.casillas(id);


--
-- Name: email_configuraciones email_configuraciones_casilla_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.email_configuraciones
    ADD CONSTRAINT email_configuraciones_casilla_id_fkey FOREIGN KEY (casilla_id) REFERENCES public.casillas(id) ON DELETE SET NULL;


--
-- Name: emisores emisores_organizacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.emisores
    ADD CONSTRAINT emisores_organizacion_id_fkey FOREIGN KEY (organizacion_id) REFERENCES public.organizaciones(id) ON DELETE CASCADE;


--
-- Name: envios_realizados envios_realizados_casilla_recepcion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.envios_realizados
    ADD CONSTRAINT envios_realizados_casilla_recepcion_id_fkey FOREIGN KEY (casilla_recepcion_id) REFERENCES public.casillas(id) ON DELETE CASCADE;


--
-- Name: envios_realizados envios_realizados_emisor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.envios_realizados
    ADD CONSTRAINT envios_realizados_emisor_id_fkey FOREIGN KEY (emisor_id) REFERENCES public.emisores(id) ON DELETE CASCADE;


--
-- Name: envios_realizados envios_realizados_usuario_envio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.envios_realizados
    ADD CONSTRAINT envios_realizados_usuario_envio_id_fkey FOREIGN KEY (usuario_envio_id) REFERENCES public.usuarios(id);


--
-- Name: envios_realizados envios_realizados_uuid_ejecucion_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.envios_realizados
    ADD CONSTRAINT envios_realizados_uuid_ejecucion_fkey FOREIGN KEY (uuid_ejecucion) REFERENCES public.ejecuciones_yaml(uuid) ON DELETE SET NULL;


--
-- Name: eventos_notificacion eventos_notificacion_casilla_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.eventos_notificacion
    ADD CONSTRAINT eventos_notificacion_casilla_id_fkey FOREIGN KEY (casilla_id) REFERENCES public.casillas(id) ON DELETE CASCADE;


--
-- Name: instalaciones instalaciones_organizacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.instalaciones
    ADD CONSTRAINT instalaciones_organizacion_id_fkey FOREIGN KEY (organizacion_id) REFERENCES public.organizaciones(id) ON DELETE CASCADE;


--
-- Name: instalaciones instalaciones_pais_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.instalaciones
    ADD CONSTRAINT instalaciones_pais_id_fkey FOREIGN KEY (pais_id) REFERENCES public.paises(id) ON DELETE CASCADE;


--
-- Name: instalaciones instalaciones_producto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.instalaciones
    ADD CONSTRAINT instalaciones_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id) ON DELETE CASCADE;


--
-- Name: emisores_por_casilla metodos_envio_emisor_casilla_recepcion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.emisores_por_casilla
    ADD CONSTRAINT metodos_envio_emisor_casilla_recepcion_id_fkey FOREIGN KEY (casilla_id) REFERENCES public.casillas(id) ON DELETE CASCADE;


--
-- Name: emisores_por_casilla metodos_envio_emisor_emisor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.emisores_por_casilla
    ADD CONSTRAINT metodos_envio_emisor_emisor_id_fkey FOREIGN KEY (emisor_id) REFERENCES public.emisores(id) ON DELETE CASCADE;


--
-- Name: emisores_por_casilla metodos_envio_emisor_frecuencia_tipo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.emisores_por_casilla
    ADD CONSTRAINT metodos_envio_emisor_frecuencia_tipo_id_fkey FOREIGN KEY (frecuencia_tipo_id) REFERENCES public.frecuencias_tipo(id);


--
-- Name: notificaciones_enviadas notificaciones_enviadas_suscripcion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.notificaciones_enviadas
    ADD CONSTRAINT notificaciones_enviadas_suscripcion_id_fkey FOREIGN KEY (suscripcion_id) REFERENCES public.suscripciones(id) ON DELETE CASCADE;


--
-- Name: portales portales_instalacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.portales
    ADD CONSTRAINT portales_instalacion_id_fkey FOREIGN KEY (instalacion_id) REFERENCES public.instalaciones(id);


--
-- Name: suscripciones suscripciones_casilla_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.suscripciones
    ADD CONSTRAINT suscripciones_casilla_id_fkey FOREIGN KEY (casilla_id) REFERENCES public.casillas(id) ON DELETE SET NULL;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: cloud_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE cloud_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO neon_superuser WITH GRANT OPTION;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: cloud_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE cloud_admin IN SCHEMA public GRANT ALL ON TABLES TO neon_superuser WITH GRANT OPTION;


--
-- PostgreSQL database dump complete
--

