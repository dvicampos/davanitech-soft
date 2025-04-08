const mysql = require('mysql2');

const db = mysql.createConnection({
    host: 'localhost',
    user: 'aseashvt_david',
    password: 'v_)hj(inH9b{',
    database: 'aseashvt_abogados_asociados',
});

db.connect(err => {
    if (err) {
        console.error('Error conectando a la base de datos: ' + err.stack);
        return;
    }
    console.log('Conectado a la base de datos.');
});

module.exports = db;
