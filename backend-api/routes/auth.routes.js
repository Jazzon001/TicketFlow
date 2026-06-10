const express = require('express');
const router = express.Router();
const { login, registro, getAgentes } = require('../controllers/auth.controller');
const verificarToken = require('../auth/auth.middleware');

router.post('/login', login);
router.post('/registro', verificarToken, (req, res, next) => {
    if (req.usuario.rol !== 1) {
        return res.status(403).json({ error: 'Solo el administrador puede crear usuarios' });
    }
    next();
}, registro);
router.get('/agentes', verificarToken, getAgentes);

module.exports = router;