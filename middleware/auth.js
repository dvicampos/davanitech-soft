function isAuthenticated(req, res, next) {
    if (req.session.encargadoId) {
        return next();
    }
    res.redirect('/login');
}

module.exports = isAuthenticated;
