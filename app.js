const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session');
const routes = require('./routes/routes');
const ejsLayouts = require('express-ejs-layouts');
const flash = require('connect-flash')

const app = express();
const PORT = process.env.PORT || 3000;

// Configurar EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Usa express-ejs-layouts
app.use(ejsLayouts);
app.set('layout', 'layout'); // Nombre del archivo de layout sin la extensión

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Configurar sesiones
app.use(session({
    secret: 'tu_secreto', // Cambia esto por una cadena secreta
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Cambia a true si usas HTTPS
}));
app.use(flash());
app.use((req, res, next) => {
    res.locals.messages = req.flash();
    next();
});
// Rutas
app.use('/', routes);

app.use('/ads.txt', express.static(path.join(__dirname, 'ads.txt')));
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor escuchando en http://0.0.0.0:${PORT}`);
});
