const db = require('../models/db');
const bcrypt = require('bcrypt');

// Página principal
exports.index = (req, res) => {
    db.query('SELECT * FROM recordatorios', (err, results) => {
        if (err) throw err;
        res.render('index', { recordatorios: results });
    });
    // res.render('index');
};

// Registro de abogados
exports.register = (req, res) => {
    res.render('register', {layout: false});
};

exports.registerPost = async (req, res) => {
    const { nombre, apellido, email, telefono, especialidad, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    db.query('INSERT INTO encargados (nombre, apellido, email, telefono, especialidad, password) VALUES (?, ?, ?, ?, ?, ?)',
        [nombre, apellido, email, telefono, especialidad, hashedPassword], (err, results) => {
            if (err) {
                console.error(err);
                return res.redirect('/register');
            }
            res.redirect('/login');
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
            req.session.encargadoId = encargado.id; // Guardar ID en sesión
            res.redirect('/');
        } else {
            res.redirect('/login');
        }
    });
};

// Cerrar sesión
exports.logout = (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error(err);
        }
        res.redirect('/login');
    });
};

// CLIENTES 

// Otras funciones existentes para Clientes, encargados, Casos y Categorías...
exports.clientes = (req, res) => {
    db.query('SELECT * FROM clientes', (err, results) => {
        if (err) throw err;
        res.render('clientes', { clientes: results });
    });
};

exports.crearCliente = (req, res) => {
    res.render('crearCliente');
};

exports.crearClientePost = (req, res) => {
    const { nombre, apellido, email, telefono, direccion } = req.body;
    db.query('INSERT INTO clientes (nombre, apellido, email, telefono, direccion) VALUES (?, ?, ?, ?, ?)',
        [nombre, apellido, email, telefono, direccion], (err) => {
            if (err) throw err;
            res.redirect('/clientes');
        });
};

exports.editarCliente = (req, res) => {
    const { id } = req.params;
    db.query('SELECT * FROM clientes WHERE id = ?', [id], (err, results) => {
        if (err) throw err;
        res.render('editarCliente', { cliente: results[0] });
    });
};

exports.editarClientePost = (req, res) => {
    const { id } = req.params;
    const { nombre, apellido, email, telefono, direccion } = req.body;
    db.query('UPDATE clientes SET nombre = ?, apellido = ?, email = ?, telefono = ?, direccion = ? WHERE id = ?',
        [nombre, apellido, email, telefono, direccion, id], (err) => {
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
    const query = 'SELECT * FROM encargados';
    db.query(query, (err, results) => {
        if (err) throw err;
        res.render('encargados', { encargados: results });
    });
};

exports.crearEncargado = (req, res) => {
    res.render('crearEncargado');
};

exports.crearEncargadoPost = async (req, res) => {
    const { nombre, apellido, email, telefono, especialidad, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    db.query('INSERT INTO encargados (nombre, apellido, email, telefono, especialidad, password) VALUES (?, ?, ?, ?, ?, ?)',
        [nombre, apellido, email, telefono, especialidad, hashedPassword], (err) => {
            if (err) throw err;
            res.redirect('/encargados');
        });
};

exports.editarEncargado = (req, res) => {
    const { id } = req.params;
    db.query('SELECT * FROM encargados WHERE id = ?', [id], (err, results) => {
        if (err) return res.status(500).send('Error en la base de datos');
        if (results.length === 0) return res.status(404).send('Encargado no encontrado');
        res.render('editarEncargado', { encargado: results[0] });
    });
};

exports.editarEncargadoPost = async (req, res) => {
    const { id } = req.params;
    const { nombre, apellido, email, telefono, especialidad, password } = req.body;
    const hashedPassword = password ? await bcrypt.hash(password, 10) : null;

    const query = `
        UPDATE encargados 
        SET nombre = ?, apellido = ?, email = ?, telefono = ?, especialidad = ? 
        ${hashedPassword ? ', password = ?' : ''}
        WHERE id = ?
    `;

    const values = hashedPassword
        ? [nombre, apellido, email, telefono, especialidad, hashedPassword, id]
        : [nombre, apellido, email, telefono, especialidad, id];

    db.query(query, values, (err) => {
        if (err) throw err;
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

exports.casos = (req, res) => {
    const query = `
        SELECT 
            casos.id AS caso_id, 
            clientes.nombre AS cliente_nombre, 
            encargados.nombre AS abogado_nombre, 
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
        JOIN 
            caso_categorias ON casos.id = caso_categorias.caso_id 
        JOIN 
            categorias ON caso_categorias.categoria_id = categorias.id
        GROUP BY 
            casos.id, clientes.nombre, encargados.nombre, casos.descripcion, casos.estado, casos.precio, casos.fecha_entrega, casos.fecha_devolucion
    `;

    db.query(query, (err, results) => {
        if (err) throw err;
        res.render('casos', { casos: results });
    });
};

exports.casoIndividual = (req, res) => {
    const casoId = req.params.id; // Obtener el ID del caso de la URL

    // Consulta SQL actualizada para obtener el caso con sus categorías y cantidades asociadas
    const query = `
        SELECT 
            casos.id AS caso_id, 
            clientes.nombre AS cliente_nombre, 
            clientes.apellido AS cliente_apellido,
            encargados.nombre AS abogado_nombre, 
            encargados.apellido AS abogado_apellido, 
            GROUP_CONCAT(categorias.nombre SEPARATOR ', ') AS categorias_nombres, 
            GROUP_CONCAT(caso_categorias.cantidad SEPARATOR ', ') AS categorias_cantidades, 
            casos.descripcion, 
            casos.estado,
            casos.fecha_entrega, 
            casos.fecha_devolucion,
            casos.precio
        FROM 
            casos 
        JOIN 
            clientes ON casos.cliente_id = clientes.id 
        JOIN 
            encargados ON casos.abogado_id = encargados.id 
        JOIN 
            caso_categorias ON casos.id = caso_categorias.caso_id 
        JOIN 
            categorias ON caso_categorias.categoria_id = categorias.id
        WHERE 
            casos.id = ?
        GROUP BY 
            casos.id, clientes.nombre, clientes.apellido, encargados.nombre, encargados.apellido, casos.descripcion, casos.estado, casos.fecha_entrega, casos.fecha_devolucion, casos.precio
    `;

    db.query(query, [casoId], (err, results) => {
        if (err) throw err;

        // Verificar si se encontró el caso
        if (results.length > 0) {
            res.render('casoIndividual', { caso: results[0], layout: false });
        } else {
            res.status(404).send('Caso no encontrado');
        }
    });
};


exports.crearCasoPost = (req, res) => {
    const { cliente_id, abogado_id, descripcion, estado, categoria_id, categoria_cantidad, fecha_entrega, fecha_devolucion } = req.body;

    const categoriasArray = Array.isArray(categoria_id) ? categoria_id : [categoria_id];
    const cantidadesArray = Array.isArray(categoria_cantidad) ? categoria_cantidad : [categoria_cantidad];

    console.log('Categorías seleccionadas:', categoriasArray);
    console.log('Cantidades seleccionadas:', cantidadesArray);

    db.query('SELECT id, precio FROM categorias WHERE id IN (?)', [categoriasArray], (err, resultados) => {
        if (err) {
            console.error('Error al obtener precios de categorías:', err);
            throw err;
        }

        let precioTotal = 0;
        resultados.forEach((categoria, index) => {
            const cantidad = parseFloat(cantidadesArray[index]);
            precioTotal += categoria.precio * cantidad;
        });

        precioTotal = precioTotal.toFixed(2);
        console.log('Precio total calculado:', precioTotal);

        db.query('INSERT INTO casos (cliente_id, abogado_id, descripcion, estado, precio, fecha_entrega, fecha_devolucion) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [cliente_id, abogado_id, descripcion, estado, precioTotal, fecha_entrega, fecha_devolucion], (err, result) => {
                if (err) {
                    console.error('Error al insertar el caso:', err);
                    throw err;
                }

                console.log('Caso insertado con ID:', result.insertId);
                const casoId = result.insertId;

                const categoriaQueries = categoriasArray.map((categoriaId, index) => {
                    const cantidad = parseFloat(cantidadesArray[index]);
                    return new Promise((resolve, reject) => {
                        db.query('INSERT INTO caso_categorias (caso_id, categoria_id, cantidad) VALUES (?, ?, ?)', [casoId, categoriaId, cantidad], (err) => {
                            if (err) {
                                console.error('Error al insertar en caso_categorias:', err);
                                reject(err);
                            } else {
                                resolve();
                            }
                        });
                    });
                });

                Promise.all(categoriaQueries)
                    .then(() => {
                        console.log('Categorías del caso insertadas correctamente.');
                        res.redirect('/casos');
                    })
                    .catch(err => {
                        console.error('Error al insertar categorías del caso:', err);
                        throw err;
                    });
            });
    });
};

// exports.crearCasoPost = (req, res) => {
//     const { cliente_id, abogado_id, descripcion, estado, categoria_id, categoria_cantidad, fecha_entrega, fecha_devolucion } = req.body;

//     const categoriasArray = Array.isArray(categoria_id) ? categoria_id : [categoria_id];
//     const cantidadesArray = Array.isArray(categoria_cantidad) ? categoria_cantidad : [categoria_cantidad];

//     console.log('Categorías seleccionadas:', categoriasArray);
//     console.log('Cantidades seleccionadas:', cantidadesArray);

//     const fechaEntrega = new Date(fecha_entrega);
//     const fechaDevolucion = new Date(fecha_devolucion);
//     const numDias = (fechaDevolucion - fechaEntrega) / (1000 * 60 * 60 * 24) + 1;

//     db.query('SELECT id, precio FROM categorias WHERE id IN (?)', [categoriasArray], (err, resultados) => {
//         if (err) {
//             console.error('Error al obtener precios de categorías:', err);
//             throw err;
//         }

//         let precioTotal = 0;
//         resultados.forEach((categoria, index) => {
//             const cantidad = parseFloat(cantidadesArray[index]);
//             precioTotal += categoria.precio * cantidad;
//         });
//         console.log("precio de renta", precioTotal)
//         console.log("numero de dias", numDias)
//         // redondear 
//         let dias = Math.round(numDias)
//         precioTotal = (precioTotal * dias).toFixed(2);
//         console.log('Precio total calculado:', precioTotal);

//         db.query('INSERT INTO casos (cliente_id, abogado_id, descripcion, estado, precio, fecha_entrega, fecha_devolucion) VALUES (?, ?, ?, ?, ?, ?, ?)',
//             [cliente_id, abogado_id, descripcion, estado, precioTotal, fecha_entrega, fecha_devolucion], (err, result) => {
//                 if (err) {
//                     console.error('Error al insertar el caso:', err);
//                     throw err;
//                 }

//                 console.log('Caso insertado con ID:', result.insertId);
//                 const casoId = result.insertId;

//                 const categoriaQueries = categoriasArray.map((categoriaId, index) => {
//                     const cantidad = parseFloat(cantidadesArray[index]);
//                     return new Promise((resolve, reject) => {
//                         db.query('INSERT INTO caso_categorias (caso_id, categoria_id, cantidad) VALUES (?, ?, ?)', [casoId, categoriaId, cantidad], (err) => {
//                             if (err) {
//                                 console.error('Error al insertar en caso_categorias:', err);
//                                 reject(err);
//                             } else {
//                                 resolve();
//                             }
//                         });
//                     });
//                 });

//                 Promise.all(categoriaQueries)
//                     .then(() => {
//                         console.log('Categorías del caso insertadas correctamente.');
//                         res.redirect('/casos');
//                     })
//                     .catch(err => {
//                         console.error('Error al insertar categorías del caso:', err);
//                         throw err;
//                     });
//             });
//     });
// };



exports.crearCaso = (req, res) => {
    db.query('SELECT * FROM clientes', (err, clientes) => {
        if (err) throw err;
        db.query('SELECT * FROM encargados', (err, encargados) => {
            if (err) throw err;
            db.query('SELECT * FROM categorias', (err, categorias) => {
                if (err) throw err;
                res.render('crearCaso', { clientes, encargados, categorias });
            });
        });
    });
};

exports.editarCaso = (req, res) => {
    const { id } = req.params;

    // Obtener los detalles del caso
    db.query('SELECT * FROM casos WHERE id = ?', [id], (err, results) => {
        if (err) throw err;
        const caso = results[0];

        // Obtener las categorías y cantidades asociadas con el caso
        db.query('SELECT categoria_id, cantidad FROM caso_categorias WHERE caso_id = ?', [id], (err, casoCategorias) => {
            if (err) throw err;

            // Obtener la lista de clientes
            db.query('SELECT * FROM clientes', (err, clientes) => {
                if (err) throw err;

                // Obtener la lista de encargados
                db.query('SELECT * FROM encargados', (err, encargados) => {
                    if (err) throw err;

                    // Obtener la lista de categorías
                    db.query('SELECT * FROM categorias', (err, categorias) => {
                        if (err) throw err;

                        // Renderizar la vista con el caso, la lista de clientes, encargados, categorías y las categorías del caso
                        res.render('editarCaso', { caso, casoCategorias, clientes, encargados, categorias });
                    });
                });
            });
        });
    });
};

exports.editarCasoPost = (req, res) => {
    const { id } = req.params;
    const { cliente_id, abogado_id, categoria_id, categoria_cantidad, descripcion, estado, precio, fecha_entrega, fecha_devolucion } = req.body;

    const categoriasArray = Array.isArray(categoria_id) ? categoria_id : [categoria_id];
    const cantidadesArray = Array.isArray(categoria_cantidad) ? categoria_cantidad : [categoria_cantidad];

    // Actualizar el caso
    db.query('UPDATE casos SET cliente_id = ?, abogado_id = ?, descripcion = ?, estado = ?, precio = ?, fecha_entrega = ?, fecha_devolucion = ? WHERE id = ?',
        [cliente_id, abogado_id, descripcion, estado, precio, fecha_entrega, fecha_devolucion, id], (err) => {
            if (err) throw err;

            // Eliminar categorías existentes para el caso
            db.query('DELETE FROM caso_categorias WHERE caso_id = ?', [id], (err) => {
                if (err) throw err;

                // Insertar categorías actualizadas para el caso
                const categoriaQueries = categoriasArray.map((categoriaId, index) => {
                    const cantidad = parseFloat(cantidadesArray[index]);
                    return new Promise((resolve, reject) => {
                        db.query('INSERT INTO caso_categorias (caso_id, categoria_id, cantidad) VALUES (?, ?, ?)', [id, categoriaId, cantidad], (err) => {
                            if (err) {
                                reject(err);
                            } else {
                                resolve();
                            }
                        });
                    });
                });

                Promise.all(categoriaQueries)
                    .then(() => {
                        res.redirect('/casos');
                    })
                    .catch(err => {
                        throw err;
                    });
            });
        });
};



exports.eliminarCaso = (req, res) => {
    const { id } = req.params;

    // Primero, eliminar las filas en caso_categorias
    db.query('DELETE FROM caso_categorias WHERE caso_id = ?', [id], (err) => {
        if (err) throw err;

        // Después, eliminar el caso
        db.query('DELETE FROM casos WHERE id = ?', [id], (err) => {
            if (err) throw err;
            res.redirect('/casos');
        });
    });
};


const pdf = require('html-pdf');
const QRCode = require('qrcode');

exports.generarPDF = (req, res) => {
    const { id } = req.params;

    db.query(`SELECT 
                casos.id, 
                clientes.nombre AS cliente_nombre,
                clientes.apellido AS cliente_apellido, 
                clientes.telefono AS cliente_telefono,
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
                casos.fecha_devolucion
              FROM casos 
              JOIN clientes ON casos.cliente_id = clientes.id 
              JOIN encargados ON casos.abogado_id = encargados.id 
              JOIN caso_categorias ON casos.id = caso_categorias.caso_id 
              JOIN categorias ON caso_categorias.categoria_id = categorias.id 
              WHERE casos.id = ? 
              GROUP BY casos.id, clientes.nombre, clientes.apellido, clientes.telefono, encargados.nombre, encargados.apellido, casos.descripcion, casos.estado, casos.precio, casos.fecha_creacion, casos.fecha_entrega, casos.fecha_devolucion`, 
              [id], (err, results) => {
        if (err) throw err;

        const caso = results[0];

        const casoUrl = `https://mexwebtechnological.com/casos/ver/${caso.id}`;

        QRCode.toDataURL(casoUrl, (err, qrCodeUrl) => {
            if (err) throw err;

            res.render('pdfCaso', { caso, qrCodeUrl, layout: false }, (err, html) => {
                if (err) return res.send(err);

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

                // Crear el PDF
                pdf.create(html, options).toBuffer((err, buffer) => {
                    if (err) return res.send(err);
                    res.set({
                        'Content-Type': 'application/pdf',
                        'Content-Disposition': `attachment; filename=caso_${id}.pdf`,
                    });
                    res.send(buffer);
                });
            });
        });
    });
};


// CATEGORIAS 

exports.categorias = (req, res) => {
    db.query('SELECT * FROM categorias', (err, results) => {
        if (err) throw err;
        res.render('categorias', { categorias: results });
    });
};

exports.crearCategoria = (req, res) => {
    res.render('crearCategoria');
};

exports.crearCategoriaPost = (req, res) => {
    const { nombre, precio, descripcion, stock } = req.body;
    db.query('INSERT INTO categorias (nombre, precio, descripcion, stock) VALUES (?, ?, ?, ?)',
        [nombre, precio, descripcion, stock], (err) => {
            if (err) throw err;
            res.redirect('/categorias');
        });
};

exports.editarCategoria = (req, res) => {
    const { id } = req.params;
    db.query('SELECT * FROM categorias WHERE id = ?', [id], (err, results) => {
        if (err) throw err;
        res.render('editarCategoria', { categoria: results[0] });
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
    db.query('INSERT INTO notas (titulo, contenido) VALUES (?, ?)', [titulo, contenido], (err) => {
        if (err) throw err;
        res.redirect('/notas');
    });
};
exports.leerNotas = (req, res) => {
    db.query('SELECT * FROM notas', (err, results) => {
        if (err) throw err;
        res.render('notas', { notas: results });
    });
};
// Obtener la nota para editar
exports.obtenerNotaParaEditar = (req, res) => {
    const { id } = req.params;
    db.query('SELECT * FROM notas WHERE id = ?', [id], (err, results) => {
        if (err) throw err;
        res.render('editarNota', { nota: results[0] });
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
    db.query('INSERT INTO recordatorios (titulo, contenido, fecha_inicio, fecha_fin) VALUES (?, ?, ?, ?)', 
        [titulo, contenido, fecha_inicio, fecha_fin], (err) => {
            if (err) throw err;
            res.redirect('/recordatorios');
        });
};
exports.leerRecordatorios = (req, res) => {
    db.query('SELECT * FROM recordatorios', (err, results) => {
        if (err) throw err;

        // Formatear las fechas
        const recordatorios = results.map(recordatorio => {
            return {
                ...recordatorio,
                fecha_inicio: recordatorio.fecha_inicio.toISOString().split('T')[0], // Formato YYYY-MM-DD
                fecha_fin: recordatorio.fecha_fin.toISOString().split('T')[0]
            };
        });

        res.render('recordatorios', { recordatorios });
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
    db.query('SELECT * FROM recordatorios WHERE id = ?', [id], (err, results) => {
        if (err) throw err;
        res.render('editarRecordatorio', { recordatorio: results[0] });
    });
};
exports.eliminarRecordatorio = (req, res) => {
    const { id } = req.params;
    db.query('DELETE FROM recordatorios WHERE id = ?', [id], (err) => {
        if (err) throw err;
        res.redirect('/recordatorios');
    });
};
