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
                price_crypto JSON,
                traits JSON,
                quantity INT DEFAULT 1,
                owner_id VARCHAR(255),
                image_url VARCHAR(512),
                sold BOOLEAN DEFAULT FALSE,
                sold_price DECIMAL(20, 2) DEFAULT NULL,
                sold_date DATETIME DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Attempt to migrate price_crypto to JSON if it exists as DECIMAL
        try {
            await connection.query("ALTER TABLE brainrots MODIFY COLUMN price_crypto JSON");
        } catch (e) {
            // Ignore error if column is already JSON or other non-critical issue
        }

        // Add sold columns if they don't exist (migration)
        const columnsToAdd = [
            "ADD COLUMN sold BOOLEAN DEFAULT FALSE",
            "ADD COLUMN sold_price DECIMAL(20, 2) DEFAULT NULL",
            "ADD COLUMN sold_date DATETIME DEFAULT NULL"
        ];

        for (const col of columnsToAdd) {
            try {
                await connection.query(`ALTER TABLE brainrots ${col}`);
                console.log(`✅ Added column: ${col}`);
            } catch (e) {
                if (e.code === 'ER_DUP_FIELDNAME') {
                    // Column already exists, ignore
                } else {
                    console.error(`❌ Failed to add column (${col}):`, e.message);
                }
            }
        }

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

        // Create Log Config table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS log_config (
                guild_id VARCHAR(255) PRIMARY KEY,
                log_channel_id VARCHAR(255),
                enabled_events JSON,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create Server Logs table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS server_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                guild_id VARCHAR(255),
                event_type VARCHAR(50),
                user_id VARCHAR(255),
                channel_id VARCHAR(255),
                details JSON,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_guild_event (guild_id, event_type),
                INDEX idx_timestamp (timestamp)
            )
        `);

        // Create TikTok Tracking table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS tiktok_tracking (
                id INT AUTO_INCREMENT PRIMARY KEY,
                guild_id VARCHAR(255),
                tiktok_username VARCHAR(255),
                channel_id VARCHAR(255),
                last_video_id VARCHAR(255),
                last_check TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_tracking (guild_id, tiktok_username)
            )
        `);

        // Create User Stats table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS user_stats (
                id INT AUTO_INCREMENT PRIMARY KEY,
                guild_id VARCHAR(255),
                user_id VARCHAR(255),
                total_messages INT DEFAULT 0,
                voice_time_seconds BIGINT DEFAULT 0,
                text_active_seconds BIGINT DEFAULT 0,
                invites_total INT DEFAULT 0,
                invites_left INT DEFAULT 0,
                join_date TIMESTAMP,
                last_message_at TIMESTAMP,
                last_voice_at TIMESTAMP,
                UNIQUE KEY unique_user_stats (guild_id, user_id)
            )
        `);

        // Create Voice Sessions table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS voice_sessions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                guild_id VARCHAR(255),
                user_id VARCHAR(255),
                channel_id VARCHAR(255),
                join_time TIMESTAMP,
                leave_time TIMESTAMP NULL,
                INDEX idx_user (guild_id, user_id),
                INDEX idx_active (leave_time)
            )
        `);

        // Create User Invites table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS user_invites (
                id INT AUTO_INCREMENT PRIMARY KEY,
                guild_id VARCHAR(255),
                inviter_id VARCHAR(255),
                invited_id VARCHAR(255),
                invite_code VARCHAR(255),
                joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                left_server BOOLEAN DEFAULT FALSE,
                INDEX idx_inviter (guild_id, inviter_id)
            )
        `);

        // Create Polls table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS polls (
                id INT AUTO_INCREMENT PRIMARY KEY,
                guild_id VARCHAR(255),
                message_id VARCHAR(255),
                channel_id VARCHAR(255),
                question TEXT,
                options JSON,
                ended BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        connection.release();
        console.log('✅ Database Tables Initialized');
    } catch (error) {
        console.error('❌ Database Initialization Error:', error);
    }
}

module.exports = { pool, initDatabase };
