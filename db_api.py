"""
Database API endpoints for logging fraud and spam detection results
"""
from flask import Flask, request, jsonify
from flask_cors import CORS
from database import fetch_one, fetch_all, execute_query, init_db_pool
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

# Initialize database connection pool
init_db_pool()

@app.route('/api/db/health', methods=['GET'])
def health_check():
    """Check database health"""
    try:
        result = fetch_one("SELECT 1 as status")
        return jsonify({
            'success': True,
            'status': 'connected',
            'message': 'Database connection is healthy'
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/db/user/create', methods=['POST'])
def create_user():
    """Create a new user"""
    try:
        data = request.json
        clerk_user_id = data.get('clerk_user_id')
        email = data.get('email')
        name = data.get('name')
        
        if not clerk_user_id or not email:
            return jsonify({
                'success': False,
                'error': 'clerk_user_id and email are required'
            }), 400
        
        # Check if user already exists
        existing_user = fetch_one(
            "SELECT id FROM users WHERE clerk_user_id = %s OR email = %s",
            (clerk_user_id, email)
        )
        
        if existing_user:
            return jsonify({
                'success': True,
                'message': 'User already exists',
                'user_id': existing_user['id']
            })
        
        # Insert new user
        execute_query(
            """INSERT INTO users (clerk_user_id, email, name) 
               VALUES (%s, %s, %s)""",
            (clerk_user_id, email, name)
        )
        
        # Get the created user
        user = fetch_one(
            "SELECT id, clerk_user_id, email, name, created_at FROM users WHERE clerk_user_id = %s",
            (clerk_user_id,)
        )
        
        return jsonify({
            'success': True,
            'message': 'User created successfully',
            'user': dict(user)
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/db/user/get/<clerk_user_id>', methods=['GET'])
def get_user(clerk_user_id):
    """Get user by Clerk user ID"""
    try:
        user = fetch_one(
            "SELECT id, clerk_user_id, email, name, created_at FROM users WHERE clerk_user_id = %s",
            (clerk_user_id,)
        )
        
        if not user:
            return jsonify({
                'success': False,
                'error': 'User not found'
            }), 404
        
        return jsonify({
            'success': True,
            'user': dict(user)
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/db/user/<int:user_id>', methods=['GET'])
def get_user_by_id(user_id):
    """Get user by database ID"""
    try:
        user = fetch_one(
            "SELECT id, clerk_user_id, email, name, created_at FROM users WHERE id = %s",
            (user_id,)
        )
        
        if not user:
            return jsonify({
                'success': False,
                'error': 'User not found'
            }), 404
        
        return jsonify({
            'success': True,
            'user': dict(user)
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/db/fraud/log', methods=['POST'])
def log_fraud_detection():
    """Log fraud detection result"""
    try:
        data = request.json
        user_id = data.get('user_id')
        transaction_amount = data.get('transaction_amount')
        transaction_type = data.get('transaction_type')
        is_fraud = data.get('is_fraud')
        confidence = data.get('confidence')
        risk_level = data.get('risk_level')
        transaction_data = data.get('transaction_data', {})
        
        execute_query(
            """INSERT INTO fraud_logs 
               (user_id, transaction_amount, transaction_type, is_fraud, confidence, risk_level, transaction_data)
               VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb)""",
            (user_id, transaction_amount, transaction_type, is_fraud, confidence, risk_level, str(transaction_data).replace("'", '"'))
        )
        
        return jsonify({
            'success': True,
            'message': 'Fraud detection logged successfully'
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/db/spam/log', methods=['POST'])
def log_spam_detection():
    """Log spam detection result"""
    try:
        data = request.json
        user_id = data.get('user_id')
        message = data.get('message')
        is_spam = data.get('is_spam')
        confidence = data.get('confidence')
        spam_probability = data.get('spam_probability')
        ham_probability = data.get('ham_probability')
        risk_level = data.get('risk_level')
        
        execute_query(
            """INSERT INTO spam_logs 
               (user_id, message, is_spam, confidence, spam_probability, ham_probability, risk_level)
               VALUES (%s, %s, %s, %s, %s, %s, %s)""",
            (user_id, message, is_spam, confidence, spam_probability, ham_probability, risk_level)
        )
        
        return jsonify({
            'success': True,
            'message': 'Spam detection logged successfully'
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/db/fraud/history/<int:user_id>', methods=['GET'])
def get_fraud_history(user_id):
    """Get fraud detection history for a user"""
    try:
        limit = request.args.get('limit', 50, type=int)
        
        history = fetch_all(
            """SELECT id, transaction_amount, transaction_type, is_fraud, 
                      confidence, risk_level, created_at 
               FROM fraud_logs 
               WHERE user_id = %s 
               ORDER BY created_at DESC 
               LIMIT %s""",
            (user_id, limit)
        )
        
        return jsonify({
            'success': True,
            'history': [dict(row) for row in history],
            'count': len(history)
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/db/spam/history/<int:user_id>', methods=['GET'])
def get_spam_history(user_id):
    """Get spam detection history for a user"""
    try:
        limit = request.args.get('limit', 50, type=int)
        
        history = fetch_all(
            """SELECT id, message, is_spam, confidence, 
                      spam_probability, ham_probability, risk_level, created_at 
               FROM spam_logs 
               WHERE user_id = %s 
               ORDER BY created_at DESC 
               LIMIT %s""",
            (user_id, limit)
        )
        
        return jsonify({
            'success': True,
            'history': [dict(row) for row in history],
            'count': len(history)
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/db/spam/all', methods=['GET'])
def get_all_spam():
    """Get all spam detection logs from all users"""
    try:
        limit = request.args.get('limit', 100, type=int)
        
        history = fetch_all(
            """SELECT id, user_id, message, is_spam, confidence, 
                      spam_probability, ham_probability, risk_level, created_at 
               FROM spam_logs 
               ORDER BY created_at DESC 
               LIMIT %s""",
            (limit,)
        )
        
        return jsonify({
            'success': True,
            'history': [dict(row) for row in history],
            'count': len(history)
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/db/fraud/all', methods=['GET'])
def get_all_fraud():
    """Get all fraud detection logs from all users"""
    try:
        limit = request.args.get('limit', 100, type=int)
        
        history = fetch_all(
            """SELECT id, user_id, transaction_amount, transaction_type, 
                      is_fraud, confidence, risk_level, created_at 
               FROM fraud_logs 
               ORDER BY created_at DESC 
               LIMIT %s""",
            (limit,)
        )
        
        return jsonify({
            'success': True,
            'history': [dict(row) for row in history],
            'count': len(history)
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/db/stats/user/<int:user_id>', methods=['GET'])
def get_user_stats(user_id):
    """Get user statistics"""
    try:
        fraud_stats = fetch_one(
            """SELECT 
                COUNT(*) as total_checks,
                SUM(CASE WHEN is_fraud THEN 1 ELSE 0 END) as fraud_detected,
                AVG(confidence) as avg_confidence
               FROM fraud_logs 
               WHERE user_id = %s""",
            (user_id,)
        )
        
        spam_stats = fetch_one(
            """SELECT 
                COUNT(*) as total_checks,
                SUM(CASE WHEN is_spam THEN 1 ELSE 0 END) as spam_detected,
                AVG(confidence) as avg_confidence
               FROM spam_logs 
               WHERE user_id = %s""",
            (user_id,)
        )
        
        return jsonify({
            'success': True,
            'stats': {
                'fraud': dict(fraud_stats) if fraud_stats else {},
                'spam': dict(spam_stats) if spam_stats else {}
            }
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/db/stats/overall', methods=['GET'])
def get_overall_stats():
    """Get overall system statistics"""
    try:
        # Get total users
        user_count = fetch_one("SELECT COUNT(*) as count FROM users")
        
        # Get fraud statistics
        fraud_stats = fetch_one(
            """SELECT 
                COUNT(*) as total_checks,
                SUM(CASE WHEN is_fraud THEN 1 ELSE 0 END) as fraud_detected,
                AVG(CAST(confidence AS FLOAT)) as avg_confidence
               FROM fraud_logs"""
        )
        
        # Get spam statistics
        spam_stats = fetch_one(
            """SELECT 
                COUNT(*) as total_checks,
                SUM(CASE WHEN is_spam THEN 1 ELSE 0 END) as spam_detected,
                AVG(CAST(confidence AS FLOAT)) as avg_confidence
               FROM spam_logs"""
        )
        
        # Get recent activity (last 10 checks)
        recent_spam = fetch_all(
            """SELECT 'spam' as type, is_spam as detected, created_at 
               FROM spam_logs 
               ORDER BY created_at DESC 
               LIMIT 5"""
        )
        
        recent_fraud = fetch_all(
            """SELECT 'fraud' as type, is_fraud as detected, created_at 
               FROM fraud_logs 
               ORDER BY created_at DESC 
               LIMIT 5"""
        )
        
        # Safely convert values
        total_spam = int(spam_stats['total_checks']) if spam_stats and spam_stats['total_checks'] else 0
        total_fraud = int(fraud_stats['total_checks']) if fraud_stats and fraud_stats['total_checks'] else 0
        spam_detected = int(spam_stats['spam_detected'] or 0) if spam_stats and spam_stats['spam_detected'] is not None else 0
        fraud_detected = int(fraud_stats['fraud_detected'] or 0) if fraud_stats and fraud_stats['fraud_detected'] is not None else 0
        
        return jsonify({
            'success': True,
            'stats': {
                'totalUsers': int(user_count['count']) if user_count else 0,
                'totalSpamChecks': total_spam,
                'totalFraudChecks': total_fraud,
                'spamDetected': spam_detected,
                'fraudDetected': fraud_detected,
                'avgSpamConfidence': float(spam_stats['avg_confidence'] or 0) if spam_stats and spam_stats['avg_confidence'] else 0,
                'avgFraudConfidence': float(fraud_stats['avg_confidence'] or 0) if fraud_stats and fraud_stats['avg_confidence'] else 0,
                'recentActivity': [dict(row) for row in (list(recent_spam) + list(recent_fraud))]
            }
        })
    except Exception as e:
        print(f"❌ Error in get_overall_stats: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    port = int(os.getenv('DB_API_PORT', 5003))
    print(f"🗄️  Database API running on port {port}")
    app.run(host='0.0.0.0', port=port, debug=True)
