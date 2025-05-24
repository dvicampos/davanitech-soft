const db = require('../models/db');
const bcrypt = require('bcrypt');
const pdf = require('html-pdf');
const QRCode = require('qrcode');
const multer = require('multer');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');
const { v4: uuidv4 } = require('uuid');

exports.index = (req, res) => {
    res.render('inicio', {layout: false});
}

exports.dashboard = (req, res) => {
    if (!req.session.encargado || !req.session.encargado.grupo_id) {
        return res.redirect('/login');
    }

    const grupo_id = req.session.encargado.grupo_id; 
    const rol = req.session.encargado.especialidad;

    db.query(
        `SELECT * FROM recordatorios WHERE grupo_id = ?`, 
        [grupo_id], 
        (err, recordatorios) => {
            if (err) {
                console.error('Error al obtener los recordatorios:', err);
                return res.status(500).send('Error al obtener los recordatorios.');
            }

            db.query(
                `SELECT encargados.nombre, encargados.apellido, grupos.* 
                FROM encargados 
                LEFT JOIN grupos ON encargados.grupo_id = grupos.id 
                WHERE encargados.id = ?`,
                [req.session.encargadoId],
                (err, results) => {
                    if (err) {
                        console.error('Error al obtener los datos del usuario:', err);
                        return res.status(500).send('Error al obtener los datos del usuario.');
                    }

                    if (results.length === 0) {
                        return res.redirect('/login');
                    }

                    const usuario = results[0];
                    const grupo = results[0];

                    res.render('index', { 
                        recordatorios, 
                        usuario,
                        grupo,
                        rol : rol
                    });
                }
            );
        }
    );
};

// Registro de abogados
exports.register = (req, res) => {
    db.query('SELECT * FROM grupos', (err, grupos) => {
        if (err) {
            console.error(err);
            return res.render('register', { layout: false, grupos: [] });
        }
        res.render('register', { layout: false, grupos });
    });
};

// Ingreso de encargados
exports.login = (req, res) => {
    res.render('login', {layout: false});
};

exports.loginPost = (req, res) => {
    const { email, password } = req.body;

    db.query('SELECT * FROM encargados WHERE email = ?', [email], async (err, results) => {
        if (err || results.length === 0) {
            return res.redirect('/login');
        }
        const encargado = results[0];
        const match = await bcrypt.compare(password, encargado.password);
        if (match) {
            req.session.encargadoId = encargado.id;
            req.session.encargado = {
                id: encargado.id,
                nombre: encargado.nombre,
                apellido: encargado.apellido,
                especialidad: encargado.especialidad,
                grupo_id: encargado.grupo_id,
            };
            req.flash('success', 'Inicio de sesión exitoso.');
            res.redirect('/dashboard');
        } else {
            req.flash('error', 'Correo o contraseña incorrectos. Inténtalo nuevamente.');
            res.redirect('/login');
        }
    });
};

exports.createGroup = (req, res) => {
    res.render('createGroup', { layout: false });
};


exports.createGroupPost = (req, res) => {
    const { nombre_empresa, slogan, rubro, mision, vision, descripcion, ubicacion, horario, telefono, 
email, facebook, tiktok } = req.body;

    db.query('INSERT INTO grupos (nombre_empresa, slogan, rubro, mision, vision, descripcion, ubicacion, horario, telefono, email, facebook, tiktok) VALUES (?, ?, ?, ?, ?, ?, ? ,?, ?, ?, ?, ?)',
        [nombre_empresa, slogan, rubro, mision, vision, descripcion, ubicacion, horario, telefono, email, facebook, tiktok],
        (err, results) => {
            if (err) {
                console.error(err);
                return res.redirect('/create-group');
            }
            res.redirect('/register');
        }
    );
};

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads');
    },
    filename: (req, file, cb) => {
        const fileExtension = path.extname(file.originalname); 
        const fileName = Date.now() + fileExtension; 
        cb(null, fileName);
    }
});

const upload = multer({ storage: storage });
const fs = require('fs');

exports.editGroup = (req, res) => {
    if (!req.session.encargado || !req.session.encargado.grupo_id) {
        return res.redirect('/login');
    }

    const grupo_id = req.session.encargado.grupo_id;

    const grupoQuery = 'SELECT * FROM grupos WHERE id = ?';
    const mediaQuery = 'SELECT * FROM media WHERE grupo_id = ?';

    db.query(grupoQuery, [grupo_id], (err, grupoResults) => {
        if (err || grupoResults.length === 0) {
            console.error('Error al obtener grupo:', err);
            return res.render('mensaje', { layout: false, mensaje: 'Error al obtener el grupo.', tipo: 'error' });
        }

        const grupo = grupoResults[0];

        db.query(mediaQuery, [grupo_id], (err, mediaResults) => {
            if (err) {
                console.error('Error al obtener archivos multimedia:', err);
                return res.render('mensaje', { layout: false, mensaje: 'Error al obtener archivos multimedia, favor de revisar que sean archivos permitidos.', tipo: 'error' });
            }

            res.render('editGroup', {
                grupo,
                media: mediaResults 
            });
        });
    });
};

exports.deleteMedia = (req, res) => {
    const mediaId = req.params.id;

    const querySelect = 'SELECT archivo FROM media WHERE id = ?';
    db.query(querySelect, [mediaId], (err, results) => {
        if (err || results.length === 0) {
            return res.render('mensaje', { layout: false, mensaje: 'Error al buscar el archivo.', tipo: 'error' });
        }

        const filePath = path.join(__dirname, '..', results[0].archivo);
        fs.unlink(filePath, (unlinkErr) => {
            if (unlinkErr && unlinkErr.code !== 'ENOENT') {
                console.error('Error al borrar archivo físico:', unlinkErr);
            }

            const queryDelete = 'DELETE FROM media WHERE id = ?';
            db.query(queryDelete, [mediaId], (err) => {
                if (err) {
                    console.error('Error al eliminar de la BD:', err);
                }
                res.redirect('/dashboard');
            });
        });
    });
};


exports.updateGroup = (req, res) => {
    if (!req.session.encargado || !req.session.encargado.grupo_id) {
        return res.redirect('/login');
    }

    const grupo_id = req.session.encargado.grupo_id;

    upload.fields([
        { name: 'foto_perfil', maxCount: 1 },
        { name: 'media', maxCount: 10 }
    ])(req, res, (err) => {
        if (err) {
            console.error('Error al subir archivos:', err);
            // return res.status(500).send('Error al subir archivos.');
            return res.render('mensaje', { layout: false, mensaje: 'Error al subir archivos.', tipo: 'error' });
        }

        const {
            nombre_empresa, slogan, rubro, mision, vision, rfc, descripcion, ubicacion,
            horario, telefono, email, facebook, tiktok, terminos, color_grupo
        } = req.body;

        const foto_perfil = req.files['foto_perfil']?.[0]?.filename
            ? 'uploads/' + req.files['foto_perfil'][0].filename
            : null;

        if (!nombre_empresa || !rubro || !descripcion || !ubicacion || !horario || !telefono || !email) {
            // return res.status(400).send('Todos los campos son obligatorios.');
            return res.render('mensaje', { layout: false, mensaje: 'Los campos con * son obligatorios.', tipo: 'error' });
        }

        let query = 'UPDATE grupos SET nombre_empresa = ?, slogan = ?, rubro = ?, mision = ?, vision = ?, rfc = ?, descripcion = ?, ubicacion = ?, horario= ?, telefono= ?, email= ?, facebook= ?, tiktok= ?, terminos= ?, color_grupo =?';
        let queryParams = [nombre_empresa, slogan, rubro, mision, vision, rfc, descripcion, ubicacion, horario, telefono, email, facebook, tiktok, terminos,color_grupo];

        if (foto_perfil) {
            query += ', foto_perfil = ?';
            queryParams.push(foto_perfil);
        }

        query += ' WHERE id = ?';
        queryParams.push(grupo_id);

        db.query(query, queryParams, (err) => {
            if (err) {
                console.error('Error al actualizar el grupo:', err);
                // return res.status(500).send('Error al actualizar el grupo.');
                return res.render('mensaje', { layout: false, mensaje: 'Error al actualizar el grupo, revise su datos ingresados.', tipo: 'error' });
            }

            // Guardar archivos multimedia en tabla media si hay
            if (req.files['media']) {
                const insertMedia = 'INSERT INTO media (grupo_id, archivo, tipo) VALUES ?';
                const values = req.files['media'].map(file => {
                    const tipo = file.mimetype.startsWith('video/') ? 'video' : 'imagen';
                    return [grupo_id, 'uploads/' + file.filename, tipo];
                });

                db.query(insertMedia, [values], (err) => {
                    if (err) {
                        console.error('Error al guardar archivos multimedia:', err);
                    }
                    return res.redirect('/dashboard');
                });
            } else {
                return res.redirect('/dashboard');
            }
        });
    });
};

exports.showGroup = (req, res) => {
    const grupo_id = req.params.id;

    if (!grupo_id) {
        return res.render('mensaje', { layout: false, mensaje: 'Error al obtener grupo.', tipo: 'error' });
    }

    const queryGrupo = 'SELECT * FROM grupos WHERE id = ?';
    const queryMedia = 'SELECT * FROM media WHERE grupo_id = ?';
    const queryBlogs = 'SELECT * FROM publicaciones_blog WHERE grupo_id = ? ORDER BY fecha DESC'; // o el nombre de tu tabla de blogs

    db.query(queryGrupo, [grupo_id], (err, grupoResults) => {
        if (err) {
            console.error('Error al obtener el grupo:', err);
            return res.render('mensaje', { layout: false, mensaje: 'Error al obtener información del grupo.', tipo: 'error' });
        }

        if (grupoResults.length === 0) {
            return res.render('mensaje', { layout: false, mensaje: 'Grupo no encontrado.', tipo: 'error' });
        }

        const grupo = grupoResults[0];

        // Consultar multimedia
        db.query(queryMedia, [grupo_id], (err, mediaResults) => {
            if (err) {
                console.error('Error al obtener archivos multimedia:', err);
                return res.render('mensaje', { layout: false, mensaje: 'Error al obtener archivos multimedia.', tipo: 'error' });
            }

            // Consultar publicaciones del blog
            db.query(queryBlogs, [grupo_id], (err, blogResults) => {
                if (err) {
                    console.error('Error al obtener publicaciones del blog:', err);
                    return res.render('mensaje', { layout: false, mensaje: 'Error al obtener publicaciones.', tipo: 'error' });
                }

                res.render('grupo', {
                    layout: false,
                    grupo,
                    media: mediaResults,
                    blogs: blogResults
                });
            });
        });
    });
};


exports.downloadQRCode = (req, res) => {
    if (!req.session.encargado || !req.session.encargado.grupo_id) {
        return res.redirect('/login');
    }

    const grupo_id = req.session.encargado.grupo_id;
    const url = `${req.protocol}://${req.get('host')}/grupo/${grupo_id}`;

    QRCode.toBuffer(url, { type: 'png' }, (err, buffer) => {
        if (err) {
            console.error('Error al generar el código QR:', err);
            return res.status(500).send('Error al generar el código QR.');
        }

        res.setHeader('Content-Disposition', `attachment; filename=grupo_${grupo_id}_qr.png`);
        res.setHeader('Content-Type', 'image/png');
        res.send(buffer);
    });
};

/*
exports.registerPost = async (req, res) => {
    const { nombre, apellido, email, telefono, especialidad, password, grupo_id } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    db.query('INSERT INTO encargados (nombre, apellido, email, telefono, especialidad, password, grupo_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [nombre, apellido, email, telefono, especialidad, hashedPassword, grupo_id], (err, results) => {
            if (err) {
                console.error(err);
                return res.redirect('/register');
            }

            const encargadoId = results.insertId;
            if (grupo_id) {
                db.query('INSERT INTO grupo_encargado (grupo_id, encargado_id) VALUES (?, ?)',
                    [grupo_id, encargadoId],
                    (err) => {
                        if (err) {
                            console.error(err);
                        }
                    });
            }
            res.redirect('/login');
        });
};
*/


const MercadoPago = require("mercadopago");

// Configurar Mercado Pago
const mercadopago = new MercadoPago.MercadoPagoConfig({
    accessToken: "APP_USR-4675870761323737-032102-ed9b3ec372a024643003287ad603c6b2-1166673182"
});

const preferenceClient = new MercadoPago.Preference(mercadopago);

exports.registerPost = async (req, res) => {
    const { nombre, apellido, email, telefono, especialidad, password, grupo_id } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const tempId = uuidv4();

        // Guardar los datos temporalmente
        await db.query(
            'INSERT INTO registro_pendiente (id, nombre, apellido, email, telefono, especialidad, password, grupo_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [tempId, nombre, apellido, email, telefono, especialidad, hashedPassword, grupo_id]
        );

        // Crear preferencia de pago
        const preference = {
            items: [{
                title: "Suscripción única",
                quantity: 1,
                currency_id: "MXN",
                unit_price: 1000
            }],
            payer: { email },
            back_urls: {
                success: `https://davanitechnology.com/payment-success?id=${tempId}`,
                failure: "https://davanitechnology.com/payment-failure",
                pending: "https://davanitechnology.com/payment-pending"
            },
            auto_return: "approved"
        };

        // Crear y redirigir a la preferencia de MercadoPago
        const response = await preferenceClient.create({ body: preference });
        res.redirect(response.init_point);

    } catch (error) {
        console.error("Error en registerPost:", error);
        res.redirect('/register');
    }
};


exports.paymentSuccess = async (req, res) => {
    const { collection_status, id } = req.query;

    if (collection_status === 'approved') {
        db.query('SELECT * FROM registro_pendiente WHERE id = ?', [id], (err, results) => {
            if (err || results.length === 0) {
                console.error(err);
                return res.redirect('/register');
            }

            const user = results[0];

            db.query('INSERT INTO encargados (nombre, apellido, email, telefono, especialidad, password, grupo_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [user.nombre, user.apellido, user.email, user.telefono, user.especialidad, user.password, user.grupo_id],
                (err, results) => {
                    if (err) {
                        console.error(err);
                        return res.redirect('/register');
                    }

                    const encargadoId = results.insertId;
                    if (user.grupo_id) {
                        db.query('INSERT INTO grupo_encargado (grupo_id, encargado_id) VALUES (?, ?)',
                            [user.grupo_id, encargadoId], (err) => {
                                if (err) console.error(err);
                            });
                    }

                    // Limpia el registro temporal
                    db.query('DELETE FROM registro_pendiente WHERE id = ?', [id]);

                    res.redirect('/login');
                });
        });
    } else {
        res.redirect('/register');
    }
};


exports.paymentFailure = (req, res) => {
  res.render('payment-failure');
};

exports.paymentPending = (req, res) => {
  res.render('payment-pending');
};


// Cerrar sesión
exports.logout = (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error(err);
        }
        res.redirect('/');
    });
};

// CLIENTES 
exports.clientes = (req, res) => {
    if (!req.session.encargado || !req.session.encargado.grupo_id) {
        console.error('Error: No se encontró grupo_id en la sesión');
        return res.redirect('/crearCliente');
    }

    const grupo_id = req.session.encargado.grupo_id;
    const rol = req.session.encargado.especialidad;

    db.query(
        'SELECT * FROM grupos WHERE id = ?',
        [grupo_id],
        (err, grupoResults) => {
            if (err) {
                console.error('Error al obtener el grupo:', err);
                return res.status(500).send('Error al obtener el grupo.');
            }

            if (grupoResults.length === 0) {
                console.error('Grupo no encontrado');
                return res.status(404).send('Grupo no encontrado');
            }

            const grupo = grupoResults[0]; 

            const sql = `
                SELECT clientes.*, grupos.nombre_empresa AS grupo_nombre
                FROM clientes
                LEFT JOIN grupos ON clientes.grupo_id = grupos.id
                WHERE clientes.grupo_id = ?
            `;

            db.query(sql, [grupo_id], (err, clienteResults) => {
                if (err) {
                    console.error('Error al obtener clientes:', err);
                    return res.status(500).send('Error al obtener clientes');
                }

                res.render('clientes', { clientes: clienteResults, grupo: grupo, rol: rol });
            });
        }
    );
};


exports.crearCliente = (req, res) => {
    if (!req.session.encargado || !req.session.encargado.grupo_id) {
        console.error('Error: No se encontró grupo_id en la sesión');
        return res.redirect('/login');
    }

    const grupo_id = req.session.encargado.grupo_id;

    db.query('SELECT * FROM grupos WHERE id = ?', [grupo_id], (err, results) => {
        if (err) {
            console.error('Error al obtener el grupo:', err);
            return res.status(500).send('Error al obtener el grupo.');
        }

        if (results.length === 0) {
            console.error('Grupo no encontrado');
            return res.status(404).send('Grupo no encontrado');
        }

        const grupo = results[0]; 

        res.render('crearCliente', { grupo: grupo });
    });
};


exports.crearClientePost = (req, res) => {
    if (!req.session.encargado || !req.session.encargado.grupo_id) {
        console.error('Error: No se encontró grupo_id en la sesión');
        return res.redirect('/crearCliente');
    }

    const { nombre, apellido, email, telefono, rfc, direccion } = req.body;
    const grupo_id = req.session.encargado.grupo_id;

    db.query(
        'INSERT INTO clientes (nombre, apellido, email, telefono, rfc, direccion, grupo_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [nombre, apellido, email, telefono, rfc, direccion, grupo_id],
        (err, results) => {
            if (err) {
                console.error(err);
                return res.redirect('/crearCliente');
            }

            res.redirect('/clientes');
        }
    );
};


exports.editarCliente = (req, res) => {
    const { id } = req.params;

    if (!req.session.encargado || !req.session.encargado.grupo_id) {
        console.error('Error: No se encontró grupo_id en la sesión');
        return res.status(403).send('Acceso denegado');
    }

    const grupo_id = req.session.encargado.grupo_id;

    db.query('SELECT * FROM clientes WHERE id = ?', [id], (err, results) => {
        if (err) throw err;
        const cliente = results[0];

        db.query('SELECT * FROM grupos WHERE id = ?', [grupo_id], (err, grupoResults) => {
            if (err) {
                console.error('Error al obtener el grupo:', err);
                return res.status(500).send('Error al obtener el grupo.');
            }

            if (grupoResults.length === 0) {
                return res.status(404).send('Grupo no encontrado.');
            }

            const grupo = grupoResults[0];

            res.render('editarCliente', { cliente, grupo: grupo });
        });
    });
};


exports.editarClientePost = (req, res) => {
    const { id } = req.params;
    const { nombre, apellido, email, telefono, rfc, direccion } = req.body;
    db.query('UPDATE clientes SET nombre = ?, apellido = ?, email = ?, telefono = ?, rfc = ?, direccion = ? WHERE id = ?',
        [nombre, apellido, email, telefono, rfc, direccion, id], (err) => {
            if (err) throw err;
            res.redirect('/clientes');
        });
};

exports.eliminarCliente = (req, res) => {
    const { id } = req.params;

    db.query('DELETE FROM casos WHERE cliente_id = ?', [id], (err) => {
        if (err) {
            console.error('Error al eliminar relaciones en casos:', err);
            return res.status(500).send('Error al eliminar relaciones del cliente');
        }
        db.query('DELETE FROM clientes WHERE id = ?', [id], (err) => {
            if (err) {
                console.error('Error al eliminar el cliente:', err);
                return res.status(500).send('Error al eliminar el cliente');
            }

            res.redirect('/clientes');
        });
    });
};

// encargados
exports.encargados = (req, res) => {
    if (!req.session.encargado || !req.session.encargado.grupo_id) {
        console.error('Error: No se encontró grupo_id en la sesión');
        return res.status(403).send('Acceso denegado');
    }

    const grupo_id = req.session.encargado.grupo_id;
    const rol = req.session.encargado.especialidad;

    const query = `
        SELECT encargados.*, grupos.nombre_empresa AS grupo_nombre 
        FROM encargados 
        LEFT JOIN grupos ON encargados.grupo_id = grupos.id
        WHERE encargados.grupo_id = ?
    `;

    db.query(query, [grupo_id], (err, results) => {
        if (err) {
            console.error('Error al obtener encargados:', err);
            return res.status(500).send('Error al obtener encargados');
        }

        db.query('SELECT * FROM grupos WHERE id = ?', [grupo_id], (err, grupoResults) => {
            if (err) {
                console.error('Error al obtener el grupo:', err);
                return res.status(500).send('Error al obtener el grupo.');
            }

            if (grupoResults.length === 0) {
                return res.status(404).send('Grupo no encontrado.');
            }

            const grupo = grupoResults[0]; 

            res.render('encargados', { encargados: results, grupo, rol: rol });
        });
    });
};



exports.crearEncargado = (req, res) => {
    if (!req.session.encargado || !req.session.encargado.grupo_id) {
        console.error('Error: No se encontró grupo_id en la sesión');
        return res.status(403).send('Acceso denegado');
    }

    const grupo_id = req.session.encargado.grupo_id;

    db.query('SELECT * FROM grupos WHERE id = ?', [grupo_id], (err, grupoResults) => {
        if (err) {
            console.error('Error al obtener el grupo:', err);
            return res.status(500).send('Error al obtener el grupo.');
        }

        if (grupoResults.length === 0) {
            return res.status(404).send('Grupo no encontrado.');
        }

        const grupo = grupoResults[0]; 

        res.render('crearEncargado', { grupo });
    });
};


exports.crearEncargadoPost = async (req, res) => {
    const { nombre, apellido, email, telefono, especialidad, password } = req.body;
    if (!req.session.encargado || !req.session.encargado.grupo_id) {
        console.error('Error: No se encontró grupo_id en la sesión');
        return res.redirect('/crearCliente');
    }

    const grupo_id = req.session.encargado.grupo_id;
    const hashedPassword = await bcrypt.hash(password, 10);
    db.query('INSERT INTO encargados (nombre, apellido, email, telefono, especialidad, password, grupo_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [nombre, apellido, email, telefono, especialidad, hashedPassword, grupo_id], (err) => {
            if (err) throw err;
            res.redirect('/encargados');
        });
};

exports.editarEncargado = (req, res) => {
    const { id } = req.params;
    
    db.query('SELECT * FROM encargados WHERE id = ?', [id], (err, encargadoResults) => {
        if (err) return res.status(500).send('Error en la base de datos');
        if (encargadoResults.length === 0) return res.status(404).send('Encargado no encontrado');

        const encargado = encargadoResults[0];

        db.query('SELECT * FROM grupos WHERE id = ?', [encargado.grupo_id], (err, grupoResults) => {
            if (err) return res.status(500).send('Error al obtener el grupo');
            if (grupoResults.length === 0) return res.status(404).send('Grupo no encontrado');

            const grupo = grupoResults[0];

            res.render('editarEncargado', { encargado, grupo });
        });
    });
};


exports.editarEncargadoPost = async (req, res) => {
    const { id } = req.params;
    const { nombre, apellido, email, telefono, especialidad, password } = req.body;
    
    let query = `
        UPDATE encargados 
        SET nombre = ?, apellido = ?, email = ?, telefono = ?, especialidad = ?
    `;
    
    const values = [nombre, apellido, email, telefono, especialidad];

    if (password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        query += `, password = ?`;
        values.push(hashedPassword);
    }

    query += ` WHERE id = ?`;
    values.push(id);

    db.query(query, values, (err) => {
        if (err) {
            console.error('Error al actualizar el encargado:', err);
            return res.status(500).send('Error al actualizar el encargado');
        }
        res.redirect('/encargados');
    });
};


exports.eliminarEncargado = (req, res) => {
    const { id } = req.params;
    db.query('DELETE FROM encargados WHERE id = ?', [id], (err) => {
        if (err) throw err;
        res.redirect('/encargados');
    });
};


// CASOS 
// exports.casos = (req, res) => {
//     if (!req.session.encargado || !req.session.encargado.grupo_id) {
//         console.error('Error: No se encontró grupo_id en la sesión');
//         return res.status(403).send('Acceso denegado');
//     }

//     const playSuccessSound = req.session.playSuccessSound;
//     if (req.session) delete req.session.playSuccessSound;

//     const grupo_id = req.session.encargado.grupo_id;
//     const rol = req.session.encargado.especialidad;

//     const query = `
//         SELECT 
//             casos.id AS caso_id, 
//             clientes.nombre AS cliente_nombre, 
//             encargados.nombre AS abogado_nombre, 
//             grupos.nombre_empresa AS grupo_nombre, 
//             GROUP_CONCAT(categorias.nombre SEPARATOR ', ') AS categorias_nombres, 
//             casos.descripcion, 
//             casos.estado,
//             casos.precio,
//             casos.fecha_entrega,
//             casos.fecha_devolucion
//         FROM 
//             casos 
//         JOIN 
//             clientes ON casos.cliente_id = clientes.id 
//         JOIN 
//             encargados ON casos.abogado_id = encargados.id 
//         LEFT JOIN 
//             grupos ON casos.grupo_id = grupos.id 
//         JOIN 
//             caso_categorias ON casos.id = caso_categorias.caso_id 
//         JOIN 
//             categorias ON caso_categorias.categoria_id = categorias.id
//         WHERE 
//             casos.grupo_id = ?
//         GROUP BY 
//             casos.id, clientes.nombre, encargados.nombre, grupos.nombre_empresa, casos.descripcion, casos.estado, casos.precio, casos.fecha_entrega, casos.fecha_devolucion
//     `;

//     db.query(query, [grupo_id], (err, results) => {
//         if (err) {
//             console.error('Error al obtener los casos:', err);
//             return res.status(500).send('Error al obtener los casos.');
//         }

//         db.query('SELECT * FROM grupos WHERE id = ?', [grupo_id], (err, grupoResults) => {
//             if (err) {
//                 console.error('Error al obtener el grupo:', err);
//                 return res.status(500).send('Error al obtener el grupo.');
//             }

//             if (grupoResults.length === 0) {
//                 return res.status(404).send('Grupo no encontrado.');
//             }

//             const grupo = grupoResults[0]; 

//             res.render('casos', { casos: results, grupo, rol: rol, playSuccessSound });
//         });
//     });
// };
exports.casos = (req, res) => {
    if (!req.session.encargado || !req.session.encargado.grupo_id) {
        return res.status(403).send('Acceso denegado');
    }

    const grupo_id = req.session.encargado.grupo_id;
    const rol = req.session.encargado.especialidad;
    const playSuccessSound = req.session.playSuccessSound;
    if (req.session) delete req.session.playSuccessSound;

    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const offset = (page - 1) * limit;

    const countQuery = `SELECT COUNT(DISTINCT casos.id) AS total FROM casos WHERE grupo_id = ?`;

    db.query(countQuery, [grupo_id], (err, countResults) => {
        if (err) return res.status(500).send('Error al contar los casos.');

        const totalCasos = countResults[0].total;
        const totalPages = Math.ceil(totalCasos / limit);

        const dataQuery = `
            SELECT 
                casos.id AS caso_id, 
                clientes.nombre AS cliente_nombre, 
                encargados.nombre AS abogado_nombre, 
                grupos.nombre_empresa AS grupo_nombre, 
                GROUP_CONCAT(categorias.nombre SEPARATOR ', ') AS categorias_nombres, 
                casos.descripcion, 
                casos.estado,
                casos.precio,
                casos.fecha_entrega,
                casos.fecha_devolucion
            FROM 
                casos 
            JOIN clientes ON casos.cliente_id = clientes.id 
            JOIN encargados ON casos.abogado_id = encargados.id 
            LEFT JOIN grupos ON casos.grupo_id = grupos.id 
            JOIN caso_categorias ON casos.id = caso_categorias.caso_id 
            JOIN categorias ON caso_categorias.categoria_id = categorias.id
            WHERE casos.grupo_id = ?
            GROUP BY casos.id
            ORDER BY casos.fecha_entrega DESC
            LIMIT ? OFFSET ?
        `;

        db.query(dataQuery, [grupo_id, limit, offset], (err, results) => {
            if (err) return res.status(500).send('Error al obtener los casos.');

            db.query('SELECT * FROM grupos WHERE id = ?', [grupo_id], (err, grupoResults) => {
                if (err || grupoResults.length === 0) return res.status(500).send('Error al obtener el grupo.');

                const grupo = grupoResults[0];
                res.render('casos', {
                    casos: results,
                    grupo,
                    rol,
                    playSuccessSound,
                    currentPage: page,
                    totalPages
                });
            });
        });
    });
};

exports.casoIndividual = (req, res) => {
    const casoId = req.params.id;

    const query = `
        SELECT 
            casos.id AS caso_id, 
            clientes.nombre AS cliente_nombre, 
            clientes.apellido AS cliente_apellido,
            encargados.nombre AS abogado_nombre, 
            encargados.apellido AS abogado_apellido, 
            grupos.nombre_empresa AS grupo_nombre,
            grupos.email AS grupo_email,
            grupos.telefono AS grupo_telefono,
            GROUP_CONCAT(categorias.nombre SEPARATOR ', ') AS categorias_nombres, 
            GROUP_CONCAT(caso_categorias.cantidad SEPARATOR ', ') AS categorias_cantidades, 
            casos.descripcion, 
            casos.estado,
            casos.fecha_entrega, 
            casos.fecha_devolucion,
            casos.precio,
	    casos.pago_anticipo,
            casos.pago_extra,
            casos.nombre_pago_extra,
            casos.comentarios_adicionales
        FROM 
            casos 
        JOIN 
            clientes ON casos.cliente_id = clientes.id 
        JOIN 
            encargados ON casos.abogado_id = encargados.id 
        LEFT JOIN 
            grupos ON casos.grupo_id = grupos.id
        JOIN 
            caso_categorias ON casos.id = caso_categorias.caso_id 
        JOIN 
            categorias ON caso_categorias.categoria_id = categorias.id
        WHERE 
            casos.id = ?
        GROUP BY 
            casos.id, clientes.nombre, clientes.apellido, encargados.nombre, encargados.apellido, grupos.nombre_empresa, grupos.email, grupos.telefono, casos.descripcion, casos.estado, casos.fecha_entrega, casos.fecha_devolucion, casos.precio
    `;

    db.query(query, [casoId], (err, results) => {
        if (err) {
            console.error('Error al obtener el caso:', err);
            return res.status(500).send('Error al obtener el caso.');
        }

        if (results.length > 0) {
            res.render('casoIndividual', { caso: results[0], grupo: { nombre_empresa: results[0].grupo_nombre, email: results[0].grupo_email, telefono: results[0].grupo_telefono }, layout: false });
        } else {
            res.status(404).send('Caso no encontrado');
        }
    });
};


exports.crearCasoPost = (req, res) => {
    const { cliente_id, abogado_id, descripcion, estado, categoria_id, categoria_cantidad, fecha_entrega, fecha_devolucion, pago_anticipo, pago_extra, nombre_pago_extra, comentarios_adicionales } = req.body;

    if (!req.session.encargado || !req.session.encargado.grupo_id) {
        console.error('Error: No se encontró grupo_id en la sesión');
        return res.redirect('/crearCliente');
    }

    const grupo_id = req.session.encargado.grupo_id;
    const categoriasArray = Array.isArray(categoria_id) ? categoria_id.map(id => parseInt(id)) : [parseInt(categoria_id)];
    const cantidadesArray = Array.isArray(categoria_cantidad) ? categoria_cantidad.map(c => parseFloat(c)) : [parseFloat(categoria_cantidad)];

    db.query('SELECT id, nombre, precio, stock FROM categorias WHERE id IN (?)', [categoriasArray], (err, resultados) => {
        if (err) {
            console.error('Error al obtener precios y stock de categorías:', err);
            // return res.status(500).send('Error al obtener precios y stock de categorías.');
            return res.render('mensaje', { layout: false, mensaje: 'Error al obtener precios y stock de categorías.', tipo: 'error' });
        }

        // Verificar si hay suficiente stock
        const categoriaMap = new Map();
        resultados.forEach(c => categoriaMap.set(c.id, c));

        for (let i = 0; i < categoriasArray.length; i++) {
            const categoria = categoriaMap.get(categoriasArray[i]);
            const cantidad = cantidadesArray[i];

            if (!categoria || categoria.stock < cantidad) {
                return res.render('mensaje', { layout: false, mensaje: `Stock insuficiente para la categoría "${categoria ? categoria.nombre : 'desconocida'}"`, tipo: 'warning' });
            }
        }


        let precioTotal = 0;
        resultados.forEach((categoria, index) => {
            const cantidad = parseFloat(cantidadesArray[index]);
            precioTotal += categoria.precio * cantidad;
        });

        

        const pago_anticipo_conv = parseFloat(req.body.pago_anticipo?.trim() || 0);
        const pago_extra_conv = parseFloat(req.body.pago_extra?.trim() || 0);
        const nombre_pago_extra_conv = req.body.nombre_pago_extra?.trim() || 'No aplica';
        const comentarios_adicionales_conv = req.body.comentarios_adicionales?.trim() || 'Sin comentarios adicionales';

        precioTotal = parseFloat(precioTotal) || 0;
        precioTotal += pago_extra_conv;
        precioTotal = precioTotal.toFixed(2);

        
        console.log("pago extra: " + pago_anticipo_conv)
        console.log("pago totoal: " + precioTotal)
        db.query('INSERT INTO casos (cliente_id, abogado_id, descripcion, estado, precio, fecha_entrega, fecha_devolucion, grupo_id, pago_anticipo, pago_extra, nombre_pago_extra, comentarios_adicionales) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [cliente_id, abogado_id, descripcion, estado, precioTotal, fecha_entrega, fecha_devolucion, grupo_id, pago_anticipo_conv, pago_extra_conv, nombre_pago_extra_conv, comentarios_adicionales_conv], (err, result) => {
                if (err) {
                    console.error('Error al insertar el caso:', err);
                    return res.render('mensaje', { layout: false, mensaje: 'Error al insertar el caso.', tipo: 'error' });
                    // return res.status(500).send('Error al insertar el caso.');
                }

                const casoId = result.insertId;
                const categoriaQueries = categoriasArray.map((categoriaId, index) => {
                    const cantidad = parseFloat(cantidadesArray[index]);

                    return new Promise((resolve, reject) => {
                        // Insertar en caso_categorias
                        db.query('INSERT INTO caso_categorias (caso_id, categoria_id, cantidad, grupo_id) VALUES (?, ?, ?, ?)', 
                            [casoId, categoriaId, cantidad, grupo_id], (err) => {
                                if (err) {
                                    console.error('Error al insertar en caso_categorias:', err);
                                    reject(err);
                                } else {
                                    // Restar el stock en la tabla categorias
                                    db.query('UPDATE categorias SET stock = stock - ? WHERE id = ?', 
                                        [cantidad, categoriaId], (err) => {
                                            if (err) {
                                                console.error('Error al actualizar el stock:', err);
                                                reject(err);
                                            } else {
                                                resolve();
                                            }
                                        });
                                }
                            });
                    });
                });

                Promise.all(categoriaQueries)
                    .then(() => {
                        console.log('Caso y stock actualizados correctamente.');
                        req.session.playSuccessSound = true;
                        res.redirect('/casos');
                    })
                    .catch(err => {
                        console.error('Error al procesar las categorías:', err);
                        res.status(500).send('Error al procesar las categorías.');
                    });
            });
    });
};

exports.cerrarPedido = (req, res) => {
    const { caso_id } = req.body;
    
    if (!caso_id) {
        return res.render('mensaje', { layout: false, mensaje: 'El ID del caso es requerido.', tipo: 'error' });
    }

    db.query('SELECT estado FROM casos WHERE id = ?', [caso_id], (err, resultados) => {
        if (err) {
            console.error('Error al obtener el caso:', err);
            return res.render('mensaje', { layout: false, mensaje: 'Error al obtener el caso.', tipo: 'error' });
        }

        if (resultados.length === 0) {
            return res.render('mensaje', { layout: false, mensaje: 'Caso no encontrado.', tipo: 'error' });
        }

        if (resultados[0].estado === 'Cerrado') {
            return res.render('mensaje', { layout: false, mensaje: 'El caso ya está cerrado.', tipo: 'warning' });
        }

        db.query('SELECT categoria_id, cantidad FROM caso_categorias WHERE caso_id = ?', [caso_id], (err, categorias) => {
            if (err) {
                console.error('Error al obtener las categorías del caso:', err);
                return res.render('mensaje', { layout: false, mensaje: 'Error al obtener las categorías del caso.', tipo: 'error' });
            }

            if (categorias.length === 0) {
                return res.render('mensaje', { layout: false, mensaje: 'No hay categorías asociadas a este caso.', tipo: 'warning' });
            }

            const updateStockQueries = categorias.map(({ categoria_id, cantidad }) => {
                return new Promise((resolve, reject) => {
                    db.query('UPDATE categorias SET stock = stock + ? WHERE id = ?', [cantidad, categoria_id], (err) => {
                        if (err) {
                            console.error(`Error al actualizar el stock de la categoría ${categoria_id}:`, err);
                            reject(err);
                        } else {
                            resolve();
                        }
                    });
                });
            });

            Promise.all(updateStockQueries)
                .then(() => {
                    db.query('UPDATE casos SET estado = ? WHERE id = ?', ['Cerrado', caso_id], (err) => {
                        if (err) {
                            console.error('Error al cerrar el caso:', err);
                            return res.render('mensaje', { layout: false, mensaje: 'Error al cerrar el caso.', tipo: 'error' });
                        }
                        console.log('Caso cerrado y stock actualizado correctamente.');
                        return res.render('mensaje', { layout: false, mensaje: 'Caso cerrado exitosamente y stock actualizado.', tipo: 'success' });
                    });
                })
                .catch(err => {
                    console.error('Error al actualizar el stock:', err);
                    return res.render('mensaje', { layout: false, mensaje: 'Error al actualizar el stock.', tipo: 'error' });
                });
        });
    });
};


exports.crearCaso = (req, res) => {
    if (!req.session.encargado || !req.session.encargado.grupo_id) {
        console.error('Error: No se encontró grupo_id en la sesión');
        return res.status(403).send('Acceso denegado');
    }

    const grupo_id = req.session.encargado.grupo_id;

    db.query('SELECT * FROM clientes WHERE grupo_id = ?', [grupo_id], (err, clientes) => {
        if (err) {
            console.error('Error al obtener clientes:', err);
            return res.status(500).send('Error al obtener clientes.');
        }

        db.query('SELECT * FROM encargados WHERE grupo_id = ?', [grupo_id], (err, encargados) => {
            if (err) {
                console.error('Error al obtener encargados:', err);
                return res.status(500).send('Error al obtener encargados.');
            }

            db.query('SELECT * FROM categorias WHERE grupo_id = ?', [grupo_id], (err, categorias) => {
                if (err) {
                    console.error('Error al obtener categorías:', err);
                    return res.status(500).send('Error al obtener categorías.');
                }

                db.query('SELECT * FROM grupos WHERE id = ?', [grupo_id], (err, grupoResults) => {
                    if (err) {
                        console.error('Error al obtener el grupo:', err);
                        return res.status(500).send('Error al obtener el grupo.');
                    }

                    if (grupoResults.length === 0) {
                        return res.status(404).send('Grupo no encontrado.');
                    }

                    const grupo = grupoResults[0];

                    res.render('crearCaso', { clientes, encargados, categorias, grupo });
                });
            });
        });
    });
};


exports.editarCaso = (req, res) => {
    const { id } = req.params;

    if (!req.session.encargado || !req.session.encargado.grupo_id) {
        console.error('Error: No se encontró grupo_id en la sesión');
        return res.status(403).send('Acceso denegado');
    }

    const grupo_id = req.session.encargado.grupo_id;

    db.query('SELECT * FROM casos WHERE id = ?', [id], (err, results) => {
        if (err) {
            console.error('Error al obtener el caso:', err);
            return res.status(500).send('Error al obtener el caso.');
        }

        if (results.length === 0) {
            return res.status(404).send('Caso no encontrado.');
        }

        const caso = results[0];

        db.query('SELECT categoria_id, cantidad FROM caso_categorias WHERE caso_id = ?', [id], (err, casoCategorias) => {
            if (err) {
                console.error('Error al obtener las categorías del caso:', err);
                return res.status(500).send('Error al obtener las categorías del caso.');
            }

            db.query('SELECT * FROM clientes WHERE grupo_id = ?', [grupo_id], (err, clientes) => {
                if (err) {
                    console.error('Error al obtener clientes:', err);
                    return res.status(500).send('Error al obtener clientes.');
                }

                db.query('SELECT * FROM encargados WHERE grupo_id = ?', [grupo_id], (err, encargados) => {
                    if (err) {
                        console.error('Error al obtener encargados:', err);
                        return res.status(500).send('Error al obtener encargados.');
                    }

                    db.query('SELECT * FROM categorias WHERE grupo_id = ?', [grupo_id], (err, categorias) => {
                        if (err) {
                            console.error('Error al obtener categorías:', err);
                            return res.status(500).send('Error al obtener categorías.');
                        }

                        db.query('SELECT * FROM grupos WHERE id = ?', [grupo_id], (err, grupoResults) => {
                            if (err) {
                                console.error('Error al obtener el grupo:', err);
                                return res.status(500).send('Error al obtener el grupo.');
                            }

                            if (grupoResults.length === 0) {
                                return res.status(404).send('Grupo no encontrado.');
                            }

                            const grupo = grupoResults[0];

                            res.render('editarCaso', { caso, casoCategorias, clientes, encargados, categorias, grupo });
                        });
                    });
                });
            });
        });
    });
};

exports.editarCasoPost = (req, res) => {
    const { id } = req.params;
    const {
        cliente_id, abogado_id, categoria_id, categoria_cantidad,
        descripcion, estado,
        fecha_entrega, fecha_devolucion,
        pago_extra, pago_anticipo, nombre_pago_extra, comentarios_adicionales
    } = req.body;

    const categoriasArray = Array.isArray(categoria_id) ? categoria_id : [categoria_id];
    const cantidadesArray = Array.isArray(categoria_cantidad) ? categoria_cantidad : [categoria_cantidad];

    const pagoExtraConv = parseFloat(pago_extra?.trim() || 0);
    const pagoAnticipoConv = parseFloat(pago_anticipo?.trim() || 0);
    const nombrePagoExtraConv = nombre_pago_extra?.trim() || 'No aplica';
    const comentariosAdicionalesConv = comentarios_adicionales?.trim() || 'Sin comentarios';

    console.log("CATEGORIAS:", categoriasArray);
    console.log("CANTIDADES:", cantidadesArray);

    db.query('SELECT categoria_id, cantidad FROM caso_categorias WHERE caso_id = ?', [id], (err, anteriores) => {
        if (err) throw err;

        const devolverStock = anteriores.map(row => {
            return new Promise((resolve, reject) => {
                db.query('UPDATE categorias SET stock = stock + ? WHERE id = ?', [row.cantidad, row.categoria_id], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        });

        Promise.all(devolverStock)
            .then(() => {
                const obtenerPrecios = categoriasArray.map((catId, i) => {
                    const cantidad = parseFloat(cantidadesArray[i]) || 0;
                    const catIdInt = parseInt(catId); // 🔧 Conversión importante

                    return new Promise((resolve, reject) => {
                        db.query('SELECT precio FROM categorias WHERE id = ?', [catIdInt], (err, result) => {
                            if (err) return reject(err);
                            if (!result || result.length === 0) {
                                console.log(`❌ No se encontró precio para categoría ${catIdInt}`);
                                return resolve(0);
                            }
                            const precioUnitario = parseFloat(result[0].precio) || 0;
                            console.log(`💲Precio de cat ${catIdInt} x ${cantidad}: ${precioUnitario * cantidad}`);
                            resolve(precioUnitario * cantidad);
                        });
                    });
                });

                return Promise.all(obtenerPrecios);
            })
            .then(subtotales => {
                console.log("Subtotales:", subtotales);
                const precioBase = subtotales.reduce((total, actual) => total + actual, 0);
                const precioFinal = parseFloat((precioBase + pagoExtraConv - pagoAnticipoConv).toFixed(2));
                console.log("💰 Precio final calculado:", precioFinal);

                db.query(
                    `UPDATE casos SET cliente_id = ?, abogado_id = ?, descripcion = ?, estado = ?, precio = ?, 
                     fecha_entrega = ?, fecha_devolucion = ?, 
                     pago_anticipo = ?, pago_extra = ?, nombre_pago_extra = ?, comentarios_adicionales = ?
                     WHERE id = ?`,
                    [
                        cliente_id, abogado_id, descripcion, estado, precioFinal,
                        fecha_entrega, fecha_devolucion,
                        pagoAnticipoConv, pagoExtraConv, nombrePagoExtraConv,
                        comentariosAdicionalesConv, id
                    ],
                    (err) => {
                        if (err) throw err;

                        db.query('DELETE FROM caso_categorias WHERE caso_id = ?', [id], (err) => {
                            if (err) throw err;

                            const insertarCategorias = categoriasArray.map((categoriaId, i) => {
                                const cantidad = parseFloat(cantidadesArray[i]) || 0;
                                const categoriaIdInt = parseInt(categoriaId); // 🔧 Asegura que también sea entero

                                return new Promise((resolve, reject) => {
                                    db.query(
                                        'INSERT INTO caso_categorias (caso_id, categoria_id, cantidad) VALUES (?, ?, ?)',
                                        [id, categoriaIdInt, cantidad],
                                        (err) => {
                                            if (err) return reject(err);
                                            db.query(
                                                'UPDATE categorias SET stock = stock - ? WHERE id = ?',
                                                [cantidad, categoriaIdInt],
                                                (err) => {
                                                    if (err) reject(err);
                                                    else resolve();
                                                }
                                            );
                                        }
                                    );
                                });
                            });

                            Promise.all(insertarCategorias)
                                .then(() => res.redirect('/casos'))
                                .catch(err => { throw err; });
                        });
                    }
                );
            })
            .catch(err => {
                console.error("💥 Error general:", err);
                res.status(500).send("Error actualizando el caso");
            });
    });
};




exports.eliminarCaso = (req, res) => {
    const { id } = req.params;

    db.query('DELETE FROM caso_categorias WHERE caso_id = ?', [id], (err) => {
        if (err) throw err;

        db.query('DELETE FROM casos WHERE id = ?', [id], (err) => {
            if (err) throw err;
            res.redirect('/casos');
        });
    });
};

exports.generarPDF = (req, res) => {
    const { id } = req.params;

    // Primero obtenemos los detalles del caso
    db.query(`
        SELECT 
            casos.id, 
            clientes.nombre AS cliente_nombre,
            clientes.apellido AS cliente_apellido, 
            clientes.telefono AS cliente_telefono,
	    clientes.rfc AS cliente_rfc,
            encargados.nombre AS encargado_nombre, 
            encargados.apellido AS encargado_apellido,
            GROUP_CONCAT(categorias.nombre SEPARATOR ', ') AS categorias_nombres, 
            GROUP_CONCAT(caso_categorias.cantidad SEPARATOR ', ') AS categorias_cantidades,
            GROUP_CONCAT(categorias.precio SEPARATOR ', ') AS categorias_precios, 
            casos.descripcion, 
            casos.estado, 
            casos.precio,
            casos.fecha_creacion,
            casos.fecha_entrega, 
            casos.fecha_devolucion,
            casos.grupo_id,
	    casos.pago_anticipo,
            casos.pago_extra,
            casos.nombre_pago_extra,
            casos.comentarios_adicionales
        FROM casos 
        JOIN clientes ON casos.cliente_id = clientes.id 
        JOIN encargados ON casos.abogado_id = encargados.id 
        JOIN caso_categorias ON casos.id = caso_categorias.caso_id 
        JOIN categorias ON caso_categorias.categoria_id = categorias.id 
        WHERE casos.id = ? 
        GROUP BY casos.id, clientes.nombre, clientes.apellido, clientes.rfc, clientes.telefono, encargados.nombre, encargados.apellido, casos.descripcion, casos.estado, casos.precio, casos.fecha_creacion, casos.fecha_entrega, casos.fecha_devolucion`,
        [id], (err, results) => {
            if (err) {
                console.error('Error al obtener el caso:', err);
                return res.status(500).send('Error al obtener los detalles del caso.');
            }

            const caso = results[0];
            const casoUrl = `${req.protocol}://${req.get('host')}/casos/ver/${caso.id}`;
            
            // Ahora obtenemos los datos de la empresa (grupo)
            db.query(`
                SELECT 
                    nombre_empresa, 
                    telefono, 
                    email, 
                    foto_perfil, 
                    ubicacion,
                    terminos,
		    rfc
                FROM grupos
                WHERE id = ?`,
                [caso.grupo_id], (err, resultsGrupo) => {
                    if (err) {
                        console.error('Error al obtener los detalles del grupo:', err);
                        return res.status(500).send('Error al obtener los detalles del grupo.');
                    }

                    const grupo = resultsGrupo[0];

                    // Generamos el código QR
                    QRCode.toDataURL(casoUrl, (err, qrCodeUrl) => {
                        if (err) {
                            console.error('Error al generar el código QR:', err);
                            return res.status(500).send('Error al generar el código QR.');
                        }

                        // Pasamos todos los datos a la vista
                        res.render('pdfCaso', { 
                            caso, 
                            grupo, 
                            qrCodeUrl, 
                            layout: false 
                        }, (err, html) => {
                            if (err) {
                                console.error('Error al renderizar la vista:', err);
                                return res.status(500).send('Error al renderizar la vista.');
                            }

                            const options = {
                                format: 'A4',
                                orientation: 'portrait',
                                border: {
                                    top: "10mm",
                                    right: "10mm",
                                    bottom: "10mm",
                                    left: "10mm"
                                }
                            };

                            // Creamos el PDF
                            pdf.create(html, options).toBuffer((err, buffer) => {
                                if (err) {
                                    console.error('Error al crear el PDF:', err);
                                    return res.status(500).send('Error al crear el PDF.');
                                }
                                
                                res.set({
                                    'Content-Type': 'application/pdf',
                                    'Content-Disposition': `attachment; filename=caso_${id}.pdf`,
                                });
                                res.send(buffer);
                            });
                        });
                    });
                });
        });
};


// CATEGORIAS 
exports.categorias = (req, res) => {
    if (!req.session.encargado || !req.session.encargado.grupo_id) {
        console.error('Error: No se encontró grupo_id en la sesión');
        return res.status(403).send('Acceso denegado');
    }

    const grupo_id = req.session.encargado.grupo_id; 
    const rol = req.session.encargado.especialidad;

    const queryCategorias = `
        SELECT categorias.*, grupos.nombre_empresa AS grupo_nombre 
        FROM categorias 
        LEFT JOIN grupos ON categorias.grupo_id = grupos.id
        WHERE categorias.grupo_id = ?
    `;

    db.query(queryCategorias, [grupo_id], (err, categorias) => {
        if (err) {
            console.error('Error al obtener las categorías:', err);
            return res.status(500).send('Error al obtener las categorías.');
        }

        const queryGrupo = 'SELECT * FROM grupos WHERE id = ?';
        db.query(queryGrupo, [grupo_id], (err, grupoResults) => {
            if (err) {
                console.error('Error al obtener el grupo:', err);
                return res.status(500).send('Error al obtener el grupo.');
            }

            if (grupoResults.length === 0) {
                return res.status(404).send('Grupo no encontrado.');
            }

            const grupo = grupoResults[0]; 

            res.render('categorias', { categorias, grupo, rol: rol });
        });
    });
};



exports.crearCategoria = (req, res) => {
    if (!req.session.encargado || !req.session.encargado.grupo_id) {
        return res.redirect('/login');
    }

    const grupo_id = req.session.encargado.grupo_id;

    db.query('SELECT * FROM grupos WHERE id = ?', [grupo_id], (err, results) => {
        if (err) {
            console.error('Error al obtener el grupo:', err);
            return res.status(500).send('Error al obtener el grupo.');
        }

        if (results.length === 0) {
            return res.status(404).send('Grupo no encontrado.');
        }

        const grupo = results[0]; 

        res.render('crearCategoria', { grupo });
    });
};


exports.crearCategoriaPost = (req, res) => {
    const { nombre, precio, descripcion, stock } = req.body;

    if (!req.session.encargado || !req.session.encargado.grupo_id) {
        console.error('Error: No se encontró grupo_id en la sesión');
        return res.redirect('/crearCliente');
    }

    const grupo_id = req.session.encargado.grupo_id;

    db.query('INSERT INTO categorias (nombre, precio, descripcion, stock, grupo_id) VALUES (?, ?, ?, ?, ?)',
        [nombre, precio, descripcion, stock, grupo_id], (err) => {
            if (err) {
                console.error('Error al insertar categoría:', err);
                return res.status(500).send('Error al insertar la categoría.');
            }
            res.redirect('/categorias');
        });
};

exports.editarCategoria = (req, res) => {
    const { id } = req.params;
    
    if (!req.session.encargado || !req.session.encargado.grupo_id) {
        console.error('Error: No se encontró grupo_id en la sesión');
        return res.status(403).send('Acceso denegado');
    }

    const grupo_id = req.session.encargado.grupo_id;

    db.query('SELECT * FROM categorias WHERE id = ?', [id], (err, results) => {
        if (err) {
            console.error('Error al obtener la categoría:', err);
            return res.status(500).send('Error al obtener la categoría.');
        }

        if (results.length === 0) {
            return res.status(404).send('Categoría no encontrada.');
        }

        const categoria = results[0];

        db.query('SELECT * FROM grupos WHERE id = ?', [grupo_id], (err, grupoResults) => {
            if (err) {
                console.error('Error al obtener el grupo:', err);
                return res.status(500).send('Error al obtener el grupo.');
            }

            if (grupoResults.length === 0) {
                return res.status(404).send('Grupo no encontrado.');
            }

            const grupo = grupoResults[0]; 

            res.render('editarCategoria', { categoria, grupo });
        });
    });
};


exports.editarCategoriaPost = (req, res) => {
    const { id } = req.params;
    const { nombre, precio, descripcion, stock } = req.body;
    db.query('UPDATE categorias SET nombre = ?, precio = ?, descripcion = ?, stock = ? WHERE id = ?',
        [nombre, precio, descripcion, stock, id], (err) => {
            if (err) throw err;
            res.redirect('/categorias');
        });
};

exports.eliminarCategoria = (req, res) => {
    const { id } = req.params;

    db.query('DELETE FROM casos WHERE categoria_id = ?', [id], (err) => {
        if (err) {
            console.error('Error al eliminar relaciones en casos:', err);
            return res.status(500).send('Error al eliminar las relaciones en casos');
        }

        db.query('DELETE FROM caso_categorias WHERE categoria_id = ?', [id], (err) => {
            if (err) {
                console.error('Error al eliminar relaciones en caso_categorias:', err);
                return res.status(500).send('Error al eliminar las relaciones en caso_categorias');
            }

            db.query('DELETE FROM categorias WHERE id = ?', [id], (err) => {
                if (err) {
                    console.error('Error al eliminar la categoría:', err);
                    return res.status(500).send('Error al eliminar la categoría');
                }

                res.redirect('/categorias');
            });
        });
    });
};



//NOTAS
exports.crearNota = (req, res) => {
    const { titulo, contenido } = req.body;
    if (!req.session.encargado || !req.session.encargado.grupo_id) {
        console.error('Error: No se encontró grupo_id en la sesión');
        return res.redirect('/crearCliente');
    }

    const grupo_id = req.session.encargado.grupo_id;
    db.query('INSERT INTO notas (titulo, contenido, grupo_id) VALUES (?, ?, ?)', [titulo, contenido, grupo_id], (err) => {
        if (err) throw err;
        res.redirect('/notas');
    });
};

exports.leerNotas = (req, res) => {
    if (!req.session.encargado || !req.session.encargado.grupo_id) {
        console.error('Error: No se encontró grupo_id en la sesión');
        return res.status(403).send('Acceso denegado');
    }

    const grupo_id = req.session.encargado.grupo_id; 
    const rol = req.session.encargado.especialidad;

    const query = `
        SELECT notas.*, grupos.nombre_empresa AS grupo_nombre 
        FROM notas 
        LEFT JOIN grupos ON notas.grupo_id = grupos.id
        WHERE notas.grupo_id = ?
    `;

    db.query(query, [grupo_id], (err, results) => {
        if (err) {
            console.error('Error al obtener las notas:', err);
            return res.status(500).send('Error al obtener las notas.');
        }

        db.query('SELECT * FROM grupos WHERE id = ?', [grupo_id], (err, grupoResults) => {
            if (err) {
                console.error('Error al obtener el grupo:', err);
                return res.status(500).send('Error al obtener el grupo.');
            }
            if (grupoResults.length === 0) {
                return res.status(404).send('Grupo no encontrado.');
            }

            const grupo = grupoResults[0]; 

            res.render('notas', { notas: results, grupo, rol:rol });
        });
    });
};


// Obtener la nota para editar
exports.obtenerNotaParaEditar = (req, res) => {
    const { id } = req.params;
    db.query('SELECT * FROM notas WHERE id = ?', [id], (err, results) => {
        if (err) throw err;
        const nota = results[0];

        db.query('SELECT * FROM grupos WHERE id = ?', [nota.grupo_id], (err, grupoResults) => {
            if (err) throw err;
            if (grupoResults.length === 0) {
                return res.status(404).send('Grupo no encontrado.');
            }

            const grupo = grupoResults[0];

            res.render('editarNota', { nota, grupo });
        });
    });
};

// Actualizar una nota
exports.editarNota = (req, res) => {
    const { id } = req.params;
    const { titulo, contenido } = req.body;

    db.query('UPDATE notas SET titulo = ?, contenido = ? WHERE id = ?', [titulo, contenido, id], (err) => {
        if (err) throw err;
        res.redirect('/notas');
    });
};

exports.eliminarNota = (req, res) => {
    const { id } = req.params;
    db.query('DELETE FROM notas WHERE id = ?', [id], (err) => {
        if (err) throw err;
        res.redirect('/notas');
    });
};

//RECORDATORIOS
exports.crearRecordatorio = (req, res) => {
    const { titulo, contenido, fecha_inicio, fecha_fin } = req.body;
    if (!req.session.encargado || !req.session.encargado.grupo_id) {
        console.error('Error: No se encontró grupo_id en la sesión');
        return res.redirect('/crearCliente');
    }

    const grupo_id = req.session.encargado.grupo_id;
    db.query('INSERT INTO recordatorios (titulo, contenido, fecha_inicio, fecha_fin, grupo_id) VALUES (?, ?, ?, ?, ?)', 
        [titulo, contenido, fecha_inicio, fecha_fin, grupo_id], (err) => {
            if (err) throw err;
            res.redirect('/recordatorios');
        });
};

exports.leerRecordatorios = (req, res) => {
    if (!req.session.encargado || !req.session.encargado.grupo_id) {
        console.error('Error: No se encontró grupo_id en la sesión');
        return res.status(403).send('Acceso denegado');
    }

    const grupo_id = req.session.encargado.grupo_id;
    const rol = req.session.encargado.especialidad;

    const queryRecordatorios = `
        SELECT recordatorios.*, grupos.nombre_empresa AS grupo_nombre 
        FROM recordatorios 
        LEFT JOIN grupos ON recordatorios.grupo_id = grupos.id
        WHERE recordatorios.grupo_id = ?
    `;

    db.query(queryRecordatorios, [grupo_id], (err, recordatorioResults) => {
        if (err) {
            console.error('Error al obtener los recordatorios:', err);
            return res.status(500).send('Error al obtener los recordatorios.');
        }

        db.query('SELECT * FROM grupos WHERE id = ?', [grupo_id], (err, grupoResults) => {
            if (err) {
                console.error('Error al obtener el grupo:', err);
                return res.status(500).send('Error al obtener el grupo.');
            }

            if (grupoResults.length === 0) {
                return res.status(404).send('Grupo no encontrado.');
            }

            const grupo = grupoResults[0];

            const recordatorios = recordatorioResults.map(recordatorio => ({
                ...recordatorio,
                fecha_inicio: recordatorio.fecha_inicio ? recordatorio.fecha_inicio.toISOString().split('T')[0] : null,
                fecha_fin: recordatorio.fecha_fin ? recordatorio.fecha_fin.toISOString().split('T')[0] : null
            }));

            res.render('recordatorios', { recordatorios, grupo, rol:rol });
        });
    });
};


exports.editarRecordatorio = (req, res) => {
    const { id } = req.params;
    const { titulo, contenido, fecha_inicio, fecha_fin, completado } = req.body;

    db.query('UPDATE recordatorios SET titulo = ?, contenido = ?, fecha_inicio = ?, fecha_fin = ?, completado = ? WHERE id = ?', 
        [titulo, contenido, fecha_inicio, fecha_fin, completado === 'on', id], (err) => {
            if (err) throw err;
            res.redirect('/recordatorios');
        });
};

exports.obtenerRecordatorioParaEditar = (req, res) => {
    const { id } = req.params;
    db.query('SELECT * FROM recordatorios WHERE id = ?', [id], (err, recordatorioResults) => {
        if (err) throw err;

        if (recordatorioResults.length === 0) {
            return res.status(404).send('Recordatorio no encontrado.');
        }

        const recordatorio = recordatorioResults[0];

        db.query('SELECT * FROM grupos WHERE id = ?', [recordatorio.grupo_id], (err, grupoResults) => {
            if (err) throw err;

            if (grupoResults.length === 0) {
                return res.status(404).send('Grupo no encontrado.');
            }

            const grupo = grupoResults[0]; 

            res.render('editarRecordatorio', { recordatorio, grupo });
        });
    });
};

exports.eliminarRecordatorio = (req, res) => {
    const { id } = req.params;
    db.query('DELETE FROM recordatorios WHERE id = ?', [id], (err) => {
        if (err) throw err;
        res.redirect('/recordatorios');
    });
};

exports.enviar = (req, res) => {
    const { nombre, correo, mensaje } = req.body;
    if (!nombre || !correo || !mensaje) {
        req.flash('error', 'Todos los campos son obligatorios');
        return res.redirect('/');
    }
    const query = "INSERT INTO mensajes (nombre, correo, mensaje) VALUES (?, ?, ?)";
    db.query(query, [nombre, correo, mensaje], (err, result) => {
      if (err) {
        req.flash('error', 'Error al enviar el mensaje');
        return res.redirect('/');
      } else {
        req.flash('success', 'Mensaje enviado correctamente');
        res.redirect('/');
      }
    });
};


const nodemailer = require('nodemailer');
const crypto = require('crypto');

// Mostrar formulario de recuperación
exports.showForgotPassword = (req, res) => {
    res.render('forgot-password', { layout: false });
};

// Procesar solicitud de recuperación
exports.forgotPassword = (req, res) => {
    const { email } = req.body;
    
    db.query('SELECT * FROM encargados WHERE email = ?', [email], (err, results) => {
        if (err || results.length === 0) {
            return res.render('sesiones', { layout: false, mensaje: 'Correo no registrado.', tipo: 'error' });
            // return res.send('Correo no registrado.');
        }

        const token = crypto.randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + 3600000).toISOString().slice(0, 19).replace('T', ' ');

        db.query('UPDATE encargados SET reset_token = ?, reset_expires = ? WHERE email = ?', 
            [token, expires, email], (err) => {
                if (err) return res.render('sesiones', { layout: false, mensaje: 'Error al enviar el token.', tipo: 'error' });
                const resetLink = `https://davanitechnology.com/reset-password/${token}`;
                sendResetEmail(email, resetLink);
                return res.render('sesiones', { layout: false, mensaje: 'Revisa tu correo para recuperar tu contraseña.', tipo: 'success' });
                // res.send('Revisa tu correo para recuperar tu contraseña.');
        });

    });
};

// Mostrar formulario para nueva contraseña
exports.showResetPassword = (req, res) => {
    const { token } = req.params;

    db.query('SELECT * FROM encargados WHERE reset_token = ? AND reset_expires > NOW()', [token], 
(err, results) => {
        if (err) {
            console.error('Error en la consulta:', err);
            return res.render('sesiones', { layout: false, mensaje: 'Error al verificar el token.', tipo: 'error' });
            // return res.send('Error al verificar el token.');
        }
        if (results.length === 0) {
            console.log('Token inválido o expirado:', token);
            return res.render('sesiones', { layout: false, mensaje: 'Token inválido o expirado.', tipo: 'error' });
            // return res.send('Token inválido o expirado.');
        }
    
        res.render('reset-password', { layout: false, token });
    });
    
};

// Procesar nueva contraseña
exports.resetPassword = async (req, res) => {
    const { token, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    db.query('SELECT * FROM encargados WHERE reset_token = ? AND reset_expires > NOW()', [token], 
(err, results) => {
        if (err || results.length === 0) {
            return res.render('sesiones', { layout: false, mensaje: 'Token invalido o expirado.', tipo: 'error' });
            // return res.send('Token inválido o expirado.');
        }

        const email = results[0].email;

        db.query('UPDATE encargados SET password = ?, reset_token = NULL, reset_expires = NULL WHERE email = ?', 
            [hashedPassword, email], (err) => {
                if (err) return res.send('Error al actualizar la contraseña.');
                return res.render('sesiones', { layout: false, mensaje: 'Contraseña restablecida con exito.', tipo: 'success' });
                // res.send('Contraseña restablecida con éxito.');
            }
        );
    });
};

function sendResetEmail(to, link) {
    const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        auth: { 
            user: "technologydavani@gmail.com", 
            pass: "armpotcnkfzgmccv" 
        },
        tls: { rejectUnauthorized: false }
    });

    const mailOptions = {
        from: '"Davani Technology" <technologydavani@gmail.com>',
        to,
        subject: "🔒 Recuperación de contraseña",
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 
20px; text-align: center; border: 1px solid #ddd; border-radius: 10px; box-shadow: 0 4px 8px rgba(0, 
0, 0, 0.2);">
                <h2 style="color: #4CAF50;">🔑 Recuperación de contraseña</h2>
                <p style="color: #555;">Hemos recibido una solicitud para restablecer tu contraseña. 
Si no hiciste esta solicitud, ignora este mensaje.</p>
                <a href="${link}" style="display: inline-block; padding: 12px 20px; margin-top: 10px; 
font-size: 16px; color: white; background-color: #4CAF50; text-decoration: none; border-radius: 5px;">
                    🔗 Restablecer Contraseña
                </a>
                <p style="margin-top: 20px; font-size: 14px; color: #777;">Este enlace expirará en 1 
hora.</p>
                <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                <p style="font-size: 12px; color: #999;">Si tienes problemas, copia y pega el 
siguiente enlace en tu navegador:</p>
                <p style="word-wrap: break-word; font-size: 12px; color: #666;">${link}</p>
            </div>
        `
    };

    transporter.sendMail(mailOptions, (err, info) => {
        if (err) {
            console.error("❌ Error al enviar el correo:", err);
        } else {
            console.log("✅ Correo enviado: " + info.response);
        }
    });
}

exports.obtenerDatosCasos = (req, res) => { 
    if (!req.session.encargado || !req.session.encargado.grupo_id) {
        return res.status(403).send('Acceso denegado');
    }

    const grupo_id = req.session.encargado.grupo_id;
    const { fechaInicio, fechaFin } = req.query;

    let condiciones = `casos.grupo_id = ?`;
    const valores = [grupo_id];

    if (fechaInicio) {
        condiciones += ` AND DATE(casos.fecha_entrega) >= ?`;
        valores.push(fechaInicio);
    }

    if (fechaFin) {
        condiciones += ` AND DATE(casos.fecha_entrega) <= ?`;
        valores.push(fechaFin);
    }

    const query = `
        SELECT 
            casos.id AS caso_id, 
            clientes.nombre AS cliente_nombre, 
            encargados.nombre AS abogado_nombre, 
            grupos.nombre_empresa AS grupo_nombre, 
            GROUP_CONCAT(categorias.nombre SEPARATOR ', ') AS categorias_nombres, 
            casos.descripcion, 
            casos.estado,
            CASE WHEN casos.estado = 'Cerrado' THEN casos.precio ELSE NULL END AS precio,
            casos.fecha_entrega,
            casos.fecha_devolucion
        FROM 
            casos 
        JOIN 
            clientes ON casos.cliente_id = clientes.id 
        JOIN 
            encargados ON casos.abogado_id = encargados.id 
        LEFT JOIN 
            grupos ON casos.grupo_id = grupos.id 
        JOIN 
            caso_categorias ON casos.id = caso_categorias.caso_id 
        JOIN 
            categorias ON caso_categorias.categoria_id = categorias.id
        WHERE 
            ${condiciones}
        GROUP BY 
            casos.id
    `;

    // Obtener el grupo del encargado logueado
    db.query(
        `SELECT * FROM grupos WHERE id = ?`,
        [grupo_id],
        (err, grupoResults) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Error al obtener el grupo');
            }

            // Si no se encuentra el grupo
            if (grupoResults.length === 0) {
                return res.status(404).send('Grupo no encontrado');
            }

            // Obtener los casos
            db.query(query, valores, (err2, results) => {
                if (err2) {
                    console.error(err2);
                    return res.status(500).send('Error al obtener los casos');
                }

                res.render('graficas', {
                    grupo: grupoResults[0],  // El grupo del encargado logueado
                    casos: results,
                    grupo_nombre: grupoResults[0].nombre_empresa // Nombre del grupo
                });
            });
        }
    );
};


const ExcelJS = require('exceljs');

exports.exportarExcel = (req, res) => {
    const grupo_id = req.session.encargado?.grupo_id;
    if (!grupo_id) return res.status(403).send('Acceso denegado');

    const { fechaInicio, fechaFin, estado, cliente, categoria } = req.query;

    let condiciones = `casos.grupo_id = ?`;
    const valores = [grupo_id];

    if (fechaInicio) {
        condiciones += ` AND DATE(casos.fecha_entrega) >= ?`;
        valores.push(fechaInicio);
    }

    if (fechaFin) {
        condiciones += ` AND DATE(casos.fecha_entrega) <= ?`;
        valores.push(fechaFin);
    }

    if (estado) {
        condiciones += ` AND casos.estado = ?`;
        valores.push(estado);
    }

    if (cliente) {
        condiciones += ` AND clientes.nombre LIKE ?`;
        valores.push(`%${cliente}%`);
    }

    if (categoria) {
        condiciones += ` AND categorias.nombre LIKE ?`;
        valores.push(`%${categoria}%`);
    }

    const queryDetalles = `
        SELECT 
            casos.id AS caso_id, 
            clientes.nombre AS cliente_nombre, 
            encargados.nombre AS abogado_nombre, 
            grupos.nombre_empresa AS grupo_nombre, 
            GROUP_CONCAT(categorias.nombre SEPARATOR ', ') AS categorias_nombres, 
            casos.descripcion, 
            casos.estado,
            casos.precio,
            casos.fecha_entrega,
            casos.fecha_devolucion
        FROM 
            casos 
        JOIN 
            clientes ON casos.cliente_id = clientes.id 
        JOIN 
            encargados ON casos.abogado_id = encargados.id 
        LEFT JOIN 
            grupos ON casos.grupo_id = grupos.id 
        JOIN 
            caso_categorias ON casos.id = caso_categorias.caso_id 
        JOIN 
            categorias ON caso_categorias.categoria_id = categorias.id
        WHERE 
            ${condiciones}
        GROUP BY 
            casos.id
    `;

    const queryCategoriasResumen = `
        SELECT 
            categorias.nombre AS categoria_nombre,
            COUNT(casos.id) AS cantidad,
            SUM(CAST(casos.precio AS DECIMAL(10,2))) AS subtotal
        FROM 
            casos
        JOIN 
            caso_categorias ON casos.id = caso_categorias.caso_id
        JOIN 
            categorias ON caso_categorias.categoria_id = categorias.id
        JOIN 
            clientes ON casos.cliente_id = clientes.id
        WHERE 
            ${condiciones}
        GROUP BY 
            categorias.id
    `;

    db.query(queryDetalles, valores, async (err, detalles) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Error al exportar los casos');
        }

        db.query(queryCategoriasResumen, valores, async (err2, categoriasResumen) => {
            if (err2) {
                console.error(err2);
                return res.status(500).send('Error al exportar el resumen de categorías');
            }

            const workbook = new ExcelJS.Workbook();

            // =================
            // Hoja Resumen por Categoría
            // =================
            const sheetResumenCategorias = workbook.addWorksheet('Resumen Categorías');

            sheetResumenCategorias.columns = [
                { header: 'Categoría', key: 'categoria_nombre', width: 30 },
                { header: 'Cantidad de Ventas', key: 'cantidad', width: 20 },
                { header: 'Subtotal ($)', key: 'subtotal', width: 20 }
            ];

            let totalGeneral = 0;

            categoriasResumen.forEach(item => {
                sheetResumenCategorias.addRow({
                    categoria_nombre: item.categoria_nombre,
                    cantidad: item.cantidad,
                    subtotal: Number(item.subtotal) || 0
                });

                totalGeneral += Number(item.subtotal) || 0;
            });

            // Agregar línea vacía
            sheetResumenCategorias.addRow({});

            // Agregar TOTAL GENERAL
            sheetResumenCategorias.addRow({
                categoria_nombre: 'TOTAL GENERAL',
                cantidad: '',
                subtotal: totalGeneral
            });

            // Agregar Fechas de consulta
            sheetResumenCategorias.addRow({});
            sheetResumenCategorias.addRow({ categoria_nombre: `Fecha Inicio: ${fechaInicio || 'N/A'}` 
});
            sheetResumenCategorias.addRow({ categoria_nombre: `Fecha Fin: ${fechaFin || 'N/A'}` });

            // Poner en negritas TOTAL y Fechas
            sheetResumenCategorias.eachRow((row, rowNumber) => {
                if (rowNumber > categoriasResumen.length + 1) {
                    row.eachCell(cell => {
                        cell.font = { bold: true };
                    });
                }
            });

            // =================
            // Hoja Casos Detallados
            // =================
            const sheetCasos = workbook.addWorksheet('Casos Detallados');

            sheetCasos.columns = [
                { header: 'ID Caso', key: 'caso_id', width: 10 },
                { header: 'Cliente', key: 'cliente_nombre', width: 20 },
                { header: 'Abogado', key: 'abogado_nombre', width: 20 },
                { header: 'Grupo', key: 'grupo_nombre', width: 20 },
                { header: 'Categorías', key: 'categorias_nombres', width: 30 },
                { header: 'Descripción', key: 'descripcion', width: 30 },
                { header: 'Estado', key: 'estado', width: 15 },
                { header: 'Precio', key: 'precio', width: 15 },
                { header: 'Fecha Entrega', key: 'fecha_entrega', width: 20 },
                { header: 'Fecha Devolución', key: 'fecha_devolucion', width: 20 }
            ];

            detalles.forEach(caso => {
                const row = sheetCasos.addRow(caso);

                let color = 'FFFFFF'; // blanco

                if (caso.estado === 'Cerrado') color = 'C6EFCE'; // verde
                else if (caso.estado === 'Abierto') color = 'FFEB9C'; // amarillo
                else if (caso.estado === 'Pendiente') color = 'FFC7CE'; // rojo

                row.eachCell(cell => {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: color }
                    };
                });
            });

            // =================
            // Responder Excel
            // =================
            res.setHeader(
                'Content-Type',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            );
            res.setHeader(
                'Content-Disposition',
                'attachment; filename=casos_exportados.xlsx'
            );

            await workbook.xlsx.write(res);
            res.end();
        });
    });
};

// Crear un nuevo contacto
exports.crearContacto = (req, res) => {
    const { nombre, email, telefono, mensaje } = req.body;

    const grupo_id = req.body.grupo_id;

    db.query(
        'INSERT INTO contacto (nombre, email, telefono, mensaje, grupo_id) VALUES (?, ?, ?, ?, ?)',
        [nombre, email, telefono, mensaje, grupo_id],
        (err) => {
            if (err) {
                console.error('Error al crear el contacto:', err);
                return res.status(500).json({ error: 'Error al crear el contacto' });
            }
            req.flash('success', 'Tu mensaje fue enviado correctamente. En seguida nos contactaremos con usted.');
            res.redirect(`/grupo/${grupo_id}`);
        }
    );
};

// Leer todos los contactos del grupo
exports.leerContactos = (req, res) => {
    if (!req.session.encargado || !req.session.encargado.grupo_id) {
        console.error('Error: No se encontró grupo_id en la sesión');
        return res.status(403).send('Acceso denegado');
    }

    const grupo_id = req.session.encargado.grupo_id;
    const rol = req.session.encargado.especialidad;

    const query = `
        SELECT contacto.*, grupos.nombre_empresa AS grupo_nombre 
        FROM contacto 
        LEFT JOIN grupos ON contacto.grupo_id = grupos.id
        WHERE contacto.grupo_id = ?
    `;

    db.query(query, [grupo_id], (err, contactos) => {
        if (err) {
            console.error('Error al obtener los contactos:', err);
            return res.status(500).send('Error al obtener los contactos.');
        }

        db.query('SELECT * FROM grupos WHERE id = ?', [grupo_id], (err, grupoResults) => {
            if (err) {
                console.error('Error al obtener el grupo:', err);
                return res.status(500).send('Error al obtener el grupo.');
            }

            if (grupoResults.length === 0) {
                return res.status(404).send('Grupo no encontrado.');
            }

            const grupo = grupoResults[0];
            res.render('contactos', { contactos, grupo, rol });
        });
    });
};

// Obtener un contacto específico para editar
exports.obtenerContactoParaEditar = (req, res) => {
    const { id } = req.params;

    db.query('SELECT * FROM contacto WHERE id = ?', [id], (err, results) => {
        if (err) {
            console.error('Error al obtener el contacto:', err);
            return res.status(500).send('Error al obtener el contacto.');
        }

        if (results.length === 0) {
            return res.status(404).send('Contacto no encontrado.');
        }

        const contacto = results[0];

        db.query('SELECT * FROM grupos WHERE id = ?', [contacto.grupo_id], (err, grupoResults) => {
            if (err) {
                console.error('Error al obtener el grupo:', err);
                return res.status(500).send('Error al obtener el grupo.');
            }

            if (grupoResults.length === 0) {
                return res.status(404).send('Grupo no encontrado.');
            }

            const grupo = grupoResults[0];
            res.render('editarContacto', { contacto, grupo });
        });
    });
};

// Editar un contacto existente
exports.editarContacto = (req, res) => {
    const { id } = req.params;
    const { nombre, email, telefono, mensaje } = req.body;

    db.query(
        'UPDATE contacto SET nombre = ?, email = ?, telefono = ?, mensaje = ? WHERE id = ?',
        [nombre, email, telefono, mensaje, id],
        (err) => {
            if (err) {
                console.error('Error al editar el contacto:', err);
                return res.status(500).send('Error al editar el contacto.');
            }
            res.redirect('/contactos');
        }
    );
};

// Eliminar un contacto
exports.eliminarContacto = (req, res) => {
    const { id } = req.params;

    db.query('DELETE FROM contacto WHERE id = ?', [id], (err) => {
        if (err) {
            console.error('Error al eliminar el contacto:', err);
            return res.status(500).send('Error al eliminar el contacto.');
        }
        res.redirect('/contactos');
    });
};

// Controlador para crear publicación con multer
exports.crearPublicacion = (req, res) => {
    upload.array('archivos', 10)(req, res, (err) => {
        if (err) {
            console.error('Error al subir archivos:', err);
            return res.status(500).send('Error al subir archivos');
        }

        const { titulo, contenido } = req.body;
        const archivos = req.files;

        if (!req.session.encargado || !req.session.encargado.grupo_id) {
            return res.redirect('/login');
        }

        const grupo_id = req.session.encargado.grupo_id;
        const rol = req.session.encargado.especialidad;

        // Opcional: si necesitas info del grupo para algo acá, la puedes obtener así:
        db.query('SELECT * FROM grupos WHERE id = ?', [grupo_id], (errGrupo, grupoResults) => {
            if (errGrupo || grupoResults.length === 0) {
                console.error('Error al obtener grupo:', errGrupo);
                return res.status(500).send('Error al obtener grupo');
            }

            const grupo = grupoResults[0];

            db.query(
                'INSERT INTO publicaciones_blog (grupo_id, titulo, contenido) VALUES (?, ?, ?)',
                [grupo_id, titulo, contenido],
                (err, result) => {
                    if (err) {
                        console.error('Error al crear la publicación:', err);
                        return res.status(500).send('Error al crear publicación');
                    }

                    const publicacion_id = result.insertId;

                    if (archivos && archivos.length > 0) {
                        const insertArchivos = archivos.map(file => {
                            const ext = path.extname(file.originalname).toLowerCase();
                            const tipo = ['.mp4', '.webm'].includes(ext) ? 'video' : 'imagen';
                            return [publicacion_id, 'uploads/' + file.filename, tipo];
                        });

                        db.query(
                            'INSERT INTO publicaciones_archivos (publicacion_id, archivo, tipo) VALUES ?',
                            [insertArchivos],
                            (err2) => {
                                if (err2) {
                                    console.error('Error al guardar los archivos:', err2);
                                    return res.status(500).send('Error al guardar archivos');
                                }
                                res.redirect('/blogs');
                            }
                        );
                    } else {
                        res.redirect('/blogs');
                    }
                }
            );
        });
    });
};

// Mostrar formulario para crear una publicación en un grupo específico
exports.crearPublicacionForm = (req, res) => {
    const grupoId = req.params.grupoId;

    // Validar sesión y grupo
    if (!req.session.encargado || req.session.encargado.grupo_id != grupoId) {
        return res.status(403).send('Acceso denegado');
    }

    const rol = req.session.encargado.especialidad;

    db.query('SELECT * FROM grupos WHERE id = ?', [grupoId], (err, grupoResults) => {
        if (err) {
            console.error('Error al obtener grupo:', err);
            return res.status(500).send('Error al obtener grupo');
        }
        if (grupoResults.length === 0) {
            return res.status(404).send('Grupo no encontrado');
        }

        const grupo = grupoResults[0];

        // Renderiza la vista del formulario, pasando grupoId, grupo y rol
        res.render('crearPublicacion', { grupoId, grupo, rol });
    });
};

// Obtener publicación para editar
exports.obtenerPublicacionParaEditar = (req, res) => {
    const { id } = req.params;

    // Validar sesión y grupo
    if (!req.session.encargado || !req.session.encargado.grupo_id) {
        return res.redirect('/login');
    }

    const grupoIdSesion = req.session.encargado.grupo_id;

    // Buscar la publicación y asegurarse que pertenece al grupo del encargado
    db.query('SELECT * FROM publicaciones_blog WHERE id = ? AND grupo_id = ?', [id, grupoIdSesion], (err, pubRes) => {
        if (err || pubRes.length === 0) {
            console.error('Error al obtener la publicación o acceso denegado:', err);
            return res.status(404).send('Publicación no encontrada o sin permisos');
        }

        const publicacion = pubRes[0];

        db.query('SELECT * FROM publicaciones_archivos WHERE publicacion_id = ?', [id], (err2, archivos) => {
            if (err2) {
                console.error('Error al obtener archivos:', err2);
                return res.status(500).send('Error al obtener archivos');
            }

            db.query('SELECT * FROM grupos WHERE id = ?', [grupoIdSesion], (err3, grupoRes) => {
                if (err3 || grupoRes.length === 0) {
                    console.error('Error al obtener grupo:', err3);
                    return res.status(500).send('Error al obtener grupo');
                }

                res.render('editarBlog', {
                    publicacion,
                    archivos,
                    grupo: grupoRes[0]
                });
            });
        });
    });
};

// Editar publicación (solo texto)
exports.editarPublicacion = (req, res) => {
    const { id } = req.params;
    const { titulo, contenido } = req.body;

    // Validar sesión y grupo
    if (!req.session.encargado || !req.session.encargado.grupo_id) {
        return res.redirect('/login');
    }

    const grupoIdSesion = req.session.encargado.grupo_id;

    // Actualizar sólo si la publicación pertenece al grupo del encargado
    db.query(
        'UPDATE publicaciones_blog SET titulo = ?, contenido = ? WHERE id = ? AND grupo_id = ?',
        [titulo, contenido, id, grupoIdSesion],
        (err, result) => {
            if (err) {
                console.error('Error al actualizar publicación:', err);
                return res.status(500).send('Error al actualizar publicación');
            }

            if (result.affectedRows === 0) {
                return res.status(403).send('No tienes permiso para editar esta publicación');
            }

            res.redirect('/blogs');
        }
    );
};

// Eliminar publicación y archivos
exports.eliminarPublicacion = (req, res) => {
    const { id } = req.params;

    // Validar sesión y grupo
    if (!req.session.encargado || !req.session.encargado.grupo_id) {
        return res.redirect('/login');
    }

    const grupoIdSesion = req.session.encargado.grupo_id;

    // Primero eliminar archivos asociados
    db.query('DELETE FROM publicaciones_archivos WHERE publicacion_id = ?', [id], (err) => {
        if (err) {
            console.error('Error al eliminar archivos:', err);
            return res.status(500).send('Error al eliminar archivos');
        }

        // Luego eliminar la publicación sólo si pertenece al grupo
        db.query(
            'DELETE FROM publicaciones_blog WHERE id = ? AND grupo_id = ?',
            [id, grupoIdSesion],
            (err2, result) => {
                if (err2) {
                    console.error('Error al eliminar publicación:', err2);
                    return res.status(500).send('Error al eliminar publicación');
                }

                if (result.affectedRows === 0) {
                    return res.status(403).send('No tienes permiso para eliminar esta publicación');
                }

                res.redirect('/blogs');
            }
        );
    });
};

exports.listarPublicaciones = (req, res) => {
    if (!req.session.encargado || !req.session.encargado.grupo_id) {
        return res.redirect('/login');
    }

    const grupoId = req.session.encargado.grupo_id;
    const rol = req.session.encargado.especialidad;

    const queryPublicaciones = 'SELECT * FROM publicaciones_blog WHERE grupo_id = ? ORDER BY fecha DESC';
    const queryGrupo = 'SELECT * FROM grupos WHERE id = ?';

    db.query(queryPublicaciones, [grupoId], (err, publicaciones) => {
        if (err) {
            console.error('Error al obtener publicaciones:', err);
            return res.render('mensaje', { layout: false, mensaje: 'Error al cargar publicaciones.', tipo: 'error' });
        }

        db.query(queryGrupo, [grupoId], (err2, grupoResults) => {
            if (err2) {
                console.error('Error al obtener grupo:', err2);
                return res.render('mensaje', { layout: false, mensaje: 'Error al cargar grupo.', tipo: 'error' });
            }
            if (grupoResults.length === 0) {
                return res.status(404).send('Grupo no encontrado.');
            }

            const grupo = grupoResults[0];
            res.render('publicaciones', { grupoId, publicaciones, grupo, rol });
        });
    });
};

exports.verPublicacionIndividual = (req, res) => {
    const blog_id = req.params.id;

    const queryPublicacion = `
        SELECT pb.*, g.nombre_empresa AS nombre_grupo
        FROM publicaciones_blog pb
        LEFT JOIN grupos g ON pb.grupo_id = g.id
        WHERE pb.id = ?
    `;

    const queryArchivos = 'SELECT * FROM publicaciones_archivos WHERE publicacion_id = ?';

    db.query(queryPublicacion, [blog_id], (err, results) => {
        if (err || results.length === 0) {
            console.error('Error al obtener la publicación:', err);
            return res.render('mensaje', { layout: false, mensaje: 'Error al cargar la publicación.', tipo: 'error' });
        }

        const publicacion = results[0];

        db.query(queryArchivos, [blog_id], (err2, archivos) => {
            if (err2) {
                console.error('Error al obtener archivos:', err2);
                return res.render('mensaje', { layout: false, mensaje: 'Error al cargar archivos.', tipo: 'error' });
            }

            res.render('publicacionIndividual', {
                layout: false,
                publicacion,
                archivos
            });
        });
    });
};

