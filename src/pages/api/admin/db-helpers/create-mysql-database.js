/**
 * API para crear una base de datos en un servidor MySQL
 * 
 * Este endpoint realiza una conexión real al servidor MySQL
 * y crea una nueva base de datos.
 */

// Activar modo estricto
'use strict';

// Importar el helper Python para MySQL
import pythonMySQLHandler from './python-mysql-helper';

export default async function handler(req, res) {
  // Agregar la operación al cuerpo de la solicitud
  req.body.operation = 'create_database';
  
  // Utilizar el helper de Python para manejar la solicitud
  return pythonMySQLHandler(req, res);
}