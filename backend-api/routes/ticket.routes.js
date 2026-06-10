const express = require('express');
const router = express.Router();
const verificarToken = require('../auth/auth.middleware');
const { getTickets, crearTicket, actualizarEstado, asignarTicket, getAuditoria, getEstadisticas } = require('../controllers/ticket.controller');

router.get('/', verificarToken, getTickets);
router.post('/', verificarToken, crearTicket);
router.put('/:id/estado', verificarToken, actualizarEstado);
router.put('/:id/asignar', verificarToken, asignarTicket);
router.get('/auditoria', verificarToken, getAuditoria);
router.get('/estadisticas', verificarToken, getEstadisticas);

module.exports = router;