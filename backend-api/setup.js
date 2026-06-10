require('dotenv').config();
const bcrypt = require('bcryptjs');
const { getConnection, sql } = require('./config/db');

const usuarios = [
  { nombre: 'Administrador', email: 'admin@ticketflow.com', password: 'admin123', id_rol: 1 },
  { nombre: 'Agente Soporte', email: 'agente@ticketflow.com', password: 'agente123', id_rol: 2 },
  { nombre: 'Cliente Prueba', email: 'cliente@ticketflow.com', password: 'cliente123', id_rol: 3 }
];

const setup = async () => {
  try {
    const pool = await getConnection();

    // Limpia usuarios anteriores para evitar conflictos
    await pool.request().query('DELETE FROM Usuarios');
    console.log('Usuarios anteriores eliminados');

    for (const u of usuarios) {
      const hash = await bcrypt.hash(u.password, 10);
      await pool.request()
        .input('nombre', sql.NVarChar, u.nombre)
        .input('email', sql.NVarChar, u.email)
        .input('password_hash', sql.NVarChar, hash)
        .input('id_rol', sql.Int, u.id_rol)
        .execute('sp_RegistrarUsuario');
      console.log(`✓ Usuario creado: ${u.email} / ${u.password}`);
    }

    console.log('\n¡Listo! Ya podés iniciar sesión con:');
    console.log('admin@ticketflow.com     → admin123');
    console.log('agente@ticketflow.com    → agente123');
    console.log('cliente@ticketflow.com   → cliente123');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
};

setup();