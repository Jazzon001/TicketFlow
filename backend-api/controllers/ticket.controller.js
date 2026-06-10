const { getConnection, sql } = require('../config/db');

const getTickets = async (req, res) => {
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('id_usuario', sql.Int, req.usuario.id)
            .input('id_rol', sql.Int, req.usuario.rol)
            .execute('sp_ObtenerTickets');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const crearTicket = async (req, res) => {
    const { titulo, descripcion, prioridad, id_categoria } = req.body;
    try {
        const pool = await getConnection();
        await pool.request()
            .input('titulo', sql.NVarChar, titulo)
            .input('descripcion', sql.NVarChar, descripcion)
            .input('prioridad', sql.NVarChar, prioridad)
            .input('id_categoria', sql.Int, id_categoria)
            .input('id_usuario_creador', sql.Int, req.usuario.id)
            .execute('sp_CrearTicket');
        res.json({ mensaje: 'Ticket creado correctamente' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const actualizarEstado = async (req, res) => {
    const { id } = req.params;
    const { estado } = req.body;

    if (req.usuario.rol === 3) {
        return res.status(403).json({ error: 'No tienes permiso para cambiar el estado' });
    }

    try {
        const pool = await getConnection();
        await pool.request()
            .input('id_ticket', sql.Int, id)
            .input('nuevo_estado', sql.NVarChar, estado)
            .input('id_usuario', sql.Int, req.usuario.id)
            .execute('sp_ActualizarEstadoTicket');
        res.json({ mensaje: 'Estado actualizado correctamente' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const asignarTicket = async (req, res) => {
    if (req.usuario.rol !== 1)
        return res.status(403).json({ error: 'Solo el administrador puede asignar tickets' });

    const { id } = req.params;
    const { id_agente } = req.body;
    try {
        const pool = await getConnection();
        await pool.request()
            .input('id_ticket', sql.Int, id)
            .input('id_agente', sql.Int, id_agente)
            .input('id_usuario', sql.Int, req.usuario.id)
            .execute('sp_AsignarTicket');
        res.json({ mensaje: 'Ticket asignado correctamente' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getAuditoria = async (req, res) => {
    if (req.usuario.rol !== 1)
        return res.status(403).json({ error: 'Solo el administrador puede ver la auditoría' });
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .query('SELECT * FROM Vista_Auditoria ORDER BY fecha DESC');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getEstadisticas = async (req, res) => {
    if (req.usuario.rol === 3)
        return res.status(403).json({ error: 'Sin permiso' });
    try {
        const pool = await getConnection();

        const totales = await pool.request().query(`
            SELECT estado, COUNT(*) as total FROM Tickets GROUP BY estado
        `);

        const prioridades = await pool.request().query(`
            SELECT prioridad, COUNT(*) as total FROM Tickets GROUP BY prioridad
        `);

        const categorias = await pool.request().query(`
            SELECT c.nombre, COUNT(t.id_ticket) as total
            FROM Tickets t
            JOIN Categorias c ON t.id_categoria = c.id_categoria
            GROUP BY c.nombre
        `);

        res.json({
            porEstado: totales.recordset,
            porPrioridad: prioridades.recordset,
            porCategoria: categorias.recordset
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = { getTickets, crearTicket, actualizarEstado, asignarTicket, getAuditoria, getEstadisticas };



