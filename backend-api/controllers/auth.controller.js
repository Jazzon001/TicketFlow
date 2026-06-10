const { getConnection, sql } = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const registro = async (req, res) => {
    const { nombre, email, password, id_rol } = req.body;
    try {
        const pool = await getConnection();
        const hash = await bcrypt.hash(password, 10);
        await pool.request()
            .input('nombre', sql.NVarChar, nombre)
            .input('email', sql.NVarChar, email)
            .input('password_hash', sql.NVarChar, hash)
            .input('id_rol', sql.Int, id_rol || 3)
            .execute('sp_RegistrarUsuario');
        res.json({ mensaje: 'Usuario registrado correctamente' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const login = async (req, res) => {
    const { email, password } = req.body;
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('email', sql.NVarChar, email)
            .query('SELECT * FROM Usuarios WHERE email = @email AND activo = 1');

        const usuario = result.recordset[0];
        if (!usuario) return res.status(401).json({ error: 'Credenciales inválidas' });

        const valido = await bcrypt.compare(password, usuario.password_hash);
        if (!valido) return res.status(401).json({ error: 'Credenciales inválidas' });

        const token = jwt.sign(
            { id: usuario.id_usuario, rol: usuario.id_rol },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );
        res.json({ token, usuario: { nombre: usuario.nombre, rol: usuario.id_rol } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getAgentes = async (req, res) => {
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .query('SELECT id_usuario, nombre FROM Usuarios WHERE id_rol = 2 AND activo = 1');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = { login, registro, getAgentes };
