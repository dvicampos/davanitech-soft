const express = require('express');
const router = express.Router();
const controller = require('../controllers/controller');
const isAuthenticated = require('../middleware/auth');

// Rutas para la página principal
router.get('/', controller.index);
router.post('/enviar', controller.enviar);
router.get('/dashboard', isAuthenticated, controller.dashboard);

// Rutas de registro
router.get('/register', controller.register);
router.post('/register', controller.registerPost);

// Rutas de inicio de sesión
router.get('/login', controller.login);
router.post('/login', controller.loginPost);

// Ruta para cerrar sesión
router.get('/logout', controller.logout);

// Rutas para Clientes
router.get('/clientes', isAuthenticated, controller.clientes);
router.get('/clientes/crear', isAuthenticated, controller.crearCliente);
router.post('/clientes/crear', isAuthenticated, controller.crearClientePost);
router.get('/clientes/editar/:id', isAuthenticated, controller.editarCliente);
router.post('/clientes/editar/:id', isAuthenticated, controller.editarClientePost);
router.get('/clientes/eliminar/:id', isAuthenticated, controller.eliminarCliente);

// Rutas para Abogados
router.get('/encargados', isAuthenticated, controller.encargados);
router.get('/encargados/crear', isAuthenticated, controller.crearEncargado);
router.post('/encargados/crear', isAuthenticated, controller.crearEncargadoPost);
router.get('/encargados/editar/:id', isAuthenticated, controller.editarEncargado);
router.post('/encargados/editar/:id', isAuthenticated, controller.editarEncargadoPost);
router.get('/encargados/eliminar/:id', isAuthenticated, controller.eliminarEncargado);

// Rutas para Casos
router.get('/casos', isAuthenticated, controller.casos);
router.get('/casos/ver/:id', controller.casoIndividual);
router.get('/casos/crear', isAuthenticated, controller.crearCaso);
router.post('/casos/crear', isAuthenticated, controller.crearCasoPost);
router.get('/casos/editar/:id', isAuthenticated, controller.editarCaso);
router.post('/casos/editar/:id', isAuthenticated, controller.editarCasoPost);
router.get('/casos/eliminar/:id', isAuthenticated, controller.eliminarCaso);
router.get('/generar-pdf/:id', isAuthenticated, controller.generarPDF);

// Rutas para Categorías
router.get('/categorias', isAuthenticated, controller.categorias);
router.get('/categorias/crear', isAuthenticated, controller.crearCategoria);
router.post('/categorias/crear', isAuthenticated, controller.crearCategoriaPost);
router.get('/categorias/editar/:id', isAuthenticated, controller.editarCategoria);
router.post('/categorias/editar/:id', isAuthenticated, controller.editarCategoriaPost);
router.get('/categorias/eliminar/:id', isAuthenticated, controller.eliminarCategoria);

router.get('/notas',isAuthenticated, controller.leerNotas);
router.post('/crear-nota',isAuthenticated, controller.crearNota);
router.post('/editar-nota/:id',isAuthenticated, controller.editarNota);
router.get('/editar-nota/:id',isAuthenticated, controller.obtenerNotaParaEditar);
router.get('/eliminar-nota/:id',isAuthenticated, controller.eliminarNota);

router.get('/recordatorios',isAuthenticated, controller.leerRecordatorios);
router.post('/crear-recordatorio',isAuthenticated, controller.crearRecordatorio);
router.get('/editar-recordatorio/:id',isAuthenticated, controller.obtenerRecordatorioParaEditar);
router.post('/editar-recordatorio/:id',isAuthenticated, controller.editarRecordatorio);
router.get('/eliminar-recordatorio/:id',isAuthenticated, controller.eliminarRecordatorio);

// Rutas para Grupos
router.get('/create-group', controller.createGroup);
router.post('/create-group', controller.createGroupPost);
router.get('/edit-group', isAuthenticated, controller.editGroup);
router.post('/edit-group', isAuthenticated, controller.updateGroup);
router.get('/grupo/:id', controller.showGroup);
router.get('/grupos/:id/qr', controller.downloadQRCode);
router.post('/cerrarPedido', controller.cerrarPedido);
router.get('/forgot-password', controller.showForgotPassword);
router.post('/forgot-password', controller.forgotPassword);
router.get('/reset-password/:token', controller.showResetPassword);
router.post('/reset-password', controller.resetPassword);
router.post('/eliminar-media/:id', controller.deleteMedia);

router.post('/contacto', controller.crearContacto);
router.get('/contactos', isAuthenticated, controller.leerContactos);
router.get('/contacto/:id/editar', isAuthenticated, controller.obtenerContactoParaEditar);
router.post('/contacto/:id/editar', isAuthenticated, controller.editarContacto);
router.get('/contacto/:id/eliminar', isAuthenticated, controller.eliminarContacto);

router.get('/blogs/', isAuthenticated, controller.listarPublicaciones);
router.get('/blog/:grupoId/nueva', isAuthenticated, controller.crearPublicacionForm);
router.post('/blog/:grupoId/nueva', isAuthenticated, controller.crearPublicacion);
router.get('/blog/:id/editar', isAuthenticated, controller.obtenerPublicacionParaEditar);
router.post('/blog/:id/editar', isAuthenticated, controller.editarPublicacion);
router.post('/blog/:id/eliminar', isAuthenticated, controller.eliminarPublicacion);
router.get('/blog/:id', controller.verPublicacionIndividual);

router.get('/graficas', isAuthenticated, controller.obtenerDatosCasos);
router.post('/casos/exportar', isAuthenticated, controller.exportarExcel); // nueva ruta para exportar

module.exports = router;
