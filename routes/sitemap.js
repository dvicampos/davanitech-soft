// routes/sitemap.js
const express = require('express');
const router = express.Router();
const db = require('../models/db'); // Tu conexión a MySQL

let cachedSitemap = null;
let lastGenerated = null;

router.get('/sitemap.xml', (req, res) => {
    const now = Date.now();
    const oneHour = 3600000; // 1 hora

    // Si ya está en caché y no ha pasado 1 hora, se devuelve el sitemap guardado
    if (cachedSitemap && (now - lastGenerated < oneHour)) {
        res.header('Content-Type', 'application/xml');
        return res.send(cachedSitemap);
    }

    // Generamos sitemap desde la base de datos
    const query = 'SELECT id, fecha_creacion FROM grupos ORDER BY id ASC';

    db.query(query, (err, results) => {
        if (err) {
            console.error('Error al generar el sitemap:', err);
            return res.status(500).send('Error generando el sitemap');
        }

        const urls = results.map(grupo => `
    <url>
        <loc>https://davanitechnology.com/grupo/${grupo.id}</loc>
        <lastmod>${grupo.fecha_creacion.toISOString().split('T')[0]}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.8</priority>
    </url>
        `).join('');

        cachedSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
        `.trim();

        lastGenerated = now;
        res.header('Content-Type', 'application/xml');
        res.send(cachedSitemap);
    });
});

module.exports = router;
