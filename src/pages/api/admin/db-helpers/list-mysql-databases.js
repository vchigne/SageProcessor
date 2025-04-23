/**
 * API para listar bases de datos desde un servidor MySQL
 * 
 * Este endpoint realiza una conexión real al servidor MySQL
 * y devuelve la lista completa de bases de datos disponibles.
 */

// Activar modo estricto
'use strict';

// Importar el helper Python para MySQL
import pythonMySQLHandler from './python-mysql-helper';

export default async function handler(req, res) {
  // Agregar la operación al cuerpo de la solicitud
  req.body.operation = 'list_databases';
  
  // Utilizar el helper de Python para manejar la solicitud
  return pythonMySQLHandler(req, res);
}