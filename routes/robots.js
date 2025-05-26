// routes/robots.js
const express = require('express');
const router = express.Router();

router.get('/robots.txt', (req, res) => {
    res.type('text/plain');
    res.send(`User-agent: *
Allow: /

Sitemap: https://davanitechnology.com/sitemap.xml`);
});

module.exports = router;
