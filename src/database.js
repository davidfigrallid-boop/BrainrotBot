const mysql = require('mysql2/promise');

// Database connection pool
const pool = mysql.createPool({
    host: process.env.MYSQLHOST || process.env.DB_HOST || 'localhost',
    user: process.env.MYSQLUSER || process.env.DB_USER || 'root',
    password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || '',
    database: process.env.MYSQLDATABASE || process.env.DB_NAME || 'brainrots_db',
    port: process.env.MYSQLPORT || process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

async function initDatabase() {
    try {
        const connection = await pool.getConnection();
        console.log('✅ Connected to Database');

        // Create Brainrots table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS brainrots (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                rarity VARCHAR(50) NOT NULL,
                mutation VARCHAR(50) DEFAULT 'Default',
                income_per_second DECIMAL(20, 8) DEFAULT 0,
                price_eur DECIMAL(20, 2) DEFAULT 0,
                price_crypto DECIMAL(20, 8) DEFAULT 0,
                traits JSON,
                quantity INT DEFAULT 1,
                owner_id VARCHAR(255),
                image_url VARCHAR(512),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create Giveaways table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS giveaways (
                id INT AUTO_INCREMENT PRIMARY KEY,
                message_id VARCHAR(255),
                channel_id VARCHAR(255),
                guild_id VARCHAR(255),
                prize VARCHAR(255) NOT NULL,
                winners_count INT DEFAULT 1,
                end_time TIMESTAMP,
                rigged_winner_id VARCHAR(255),
                ended BOOLEAN DEFAULT FALSE,
                participants JSON,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create Config table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS config (
                key_name VARCHAR(50) PRIMARY KEY,
                value VARCHAR(255)
            )
        `);

        // Insert default config if not exists
        await connection.query(`INSERT IGNORE INTO config (key_name, value) VALUES ('defaultCrypto', 'BTC')`);

        connection.release();
        console.log('✅ Database Tables Initialized');
    } catch (error) {
        console.error('❌ Database Initialization Error:', error);
    }
}

module.exports = { pool, initDatabase };
