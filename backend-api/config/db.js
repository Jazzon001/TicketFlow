const sql = require('mssql');

const config = {
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

const getConnection = async () => {
    try {
        return await sql.connect(config);
    } catch (err) {
        console.error("Error conexión SQL:", err);
    }
};

module.exports = { sql, getConnection };