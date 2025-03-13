const jwt = require("jsonwebtoken");

// Middleware to authenticate device, based on JWT token passed in Authorization header 
// Each device has a unique token generated during registration which is stored in the Device Schema
const authenticateDevice = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Access Denied. No token provided.' });

    jwt.verify(token, process.env.JWT_SECRET, (err, device) => {
        if (err) return res.status(403).json({ error: 'Invalid or expired token.' });

        next();
    });
};

module.exports = authenticateDevice;
