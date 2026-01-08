import os
import psycopg2
from psycopg2 import pool
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Database connection pool
connection_pool = None

def init_db_pool():
    """Initialize database connection pool"""
    global connection_pool
    try:
        # Use NEON_DATABASE_URL for NeonDB connection
        db_url = os.getenv('NEON_DATABASE_URL')
        if not db_url:
            print("⚠️  NEON_DATABASE_URL not found, trying DATABASE_URL")
            db_url = os.getenv('DATABASE_URL')
        
        connection_pool = psycopg2.pool.SimpleConnectionPool(
            1, 20,  # min and max connections
            dsn=db_url,
            cursor_factory=RealDictCursor
        )
        if connection_pool:
            print("✅ Database connection pool created successfully")
            print(f"   Connected to: NeonDB PostgreSQL")
            return True
    except Exception as e:
        print(f"❌ Error creating connection pool: {e}")
        return False

def get_connection():
    """Get a connection from the pool"""
    if connection_pool:
        return connection_pool.getconn()
    return None

def release_connection(conn):
    """Release a connection back to the pool"""
    if connection_pool and conn:
        connection_pool.putconn(conn)

def execute_query(query, params=None, fetch=False):
    """Execute a query and optionally fetch results"""
    conn = None
    try:
        conn = get_connection()
        if not conn:
            raise Exception("Could not get database connection")
        
        cursor = conn.cursor()
        print(f"🔍 Executing query: {query[:100]}...")  # Debug log
        print(f"🔍 With params: {params}")  # Debug log
        cursor.execute(query, params)
        
        if fetch:
            result = cursor.fetchall()
            cursor.close()
            conn.commit()
            print(f"✅ Query executed and committed (fetch=True), rows: {len(result)}")  # Debug log
            return result
        else:
            conn.commit()
            cursor.close()
            print(f"✅ Query executed and committed (fetch=False)")  # Debug log
            return True
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"❌ Database error: {e}")
        raise e
    finally:
        if conn:
            release_connection(conn)

def fetch_one(query, params=None):
    """Fetch a single row"""
    conn = None
    try:
        conn = get_connection()
        if not conn:
            raise Exception("Could not get database connection")
        
        cursor = conn.cursor()
        cursor.execute(query, params)
        result = cursor.fetchone()
        cursor.close()
        return result
    except Exception as e:
        print(f"❌ Database error: {e}")
        raise e
    finally:
        if conn:
            release_connection(conn)

def fetch_all(query, params=None):
    """Fetch all rows"""
    return execute_query(query, params, fetch=True)

def create_tables():
    """Create database tables if they don't exist"""
    try:
        # Users table
        execute_query("""
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                clerk_user_id VARCHAR(255) UNIQUE NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                name VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Fraud detection logs
        execute_query("""
            CREATE TABLE IF NOT EXISTS fraud_logs (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                transaction_amount DECIMAL(10, 2),
                transaction_type VARCHAR(100),
                is_fraud BOOLEAN,
                confidence DECIMAL(5, 2),
                risk_level VARCHAR(50),
                transaction_data JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Spam detection logs
        execute_query("""
            CREATE TABLE IF NOT EXISTS spam_logs (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                message TEXT NOT NULL,
                is_spam BOOLEAN,
                confidence DECIMAL(5, 2),
                spam_probability DECIMAL(5, 2),
                ham_probability DECIMAL(5, 2),
                risk_level VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        print("✅ All database tables created successfully")
        return True
    except Exception as e:
        print(f"❌ Error creating tables: {e}")
        return False

def test_connection():
    """Test database connection"""
    try:
        result = fetch_one("SELECT version()")
        if result:
            print(f"✅ Database connection successful!")
            print(f"   PostgreSQL version: {result['version']}")
            return True
        return False
    except Exception as e:
        print(f"❌ Connection test failed: {e}")
        return False

# Initialize connection pool when module is imported
if __name__ != "__main__":
    init_db_pool()
