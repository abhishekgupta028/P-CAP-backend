from flask import Flask, request, jsonify
from flask_cors import CORS
import pickle
import re
import string
import os
import nltk
from nltk.corpus import stopwords
from nltk.stem import PorterStemmer
from nltk.tokenize import word_tokenize
from datetime import datetime

# Download required NLTK data with better error handling
def ensure_nltk_data():
    """Ensure all required NLTK data is downloaded"""
    required_packages = [
        ('corpora/stopwords', 'stopwords'),
        ('tokenizers/punkt', 'punkt'),
        ('tokenizers/punkt_tab', 'punkt_tab')
    ]
    
    for path, package in required_packages:
        try:
            nltk.data.find(path)
            print(f"✅ NLTK {package} already available")
        except LookupError:
            try:
                print(f"📥 Downloading NLTK {package}...")
                nltk.download(package, quiet=True)
                print(f"✅ NLTK {package} downloaded successfully")
            except Exception as e:
                print(f"⚠️  Warning: Could not download NLTK {package}: {e}")

# Download NLTK data on import
ensure_nltk_data()

app = Flask(__name__)
CORS(app, origins=[
    'http://localhost:3000',
    'http://localhost:5000',
    'https://p-cap-frontend.vercel.app'
], supports_credentials=True)

# Configuration - Use absolute path relative to this file
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BACKEND_DIR)

# FIX: Models are in the backend directory, not model_Training
SPAM_MODEL_FILE = os.path.join(BACKEND_DIR, 'spam_detection_model.pkl')
SPAM_VECTORIZER_FILE = os.path.join(BACKEND_DIR, 'spam_tfidf_vectorizer.pkl')
SPAM_INFO_FILE = os.path.join(BACKEND_DIR, 'spam_model_info.pkl')

# Fallback to model_Training/cleaned_dataset if not found in backend
FALLBACK_MODEL_PATH = os.path.join(PROJECT_ROOT, 'model_Training', 'cleaned_dataset')
FALLBACK_MODEL_FILE = os.path.join(FALLBACK_MODEL_PATH, 'spam_detection_model.pkl')
FALLBACK_VECTORIZER_FILE = os.path.join(FALLBACK_MODEL_PATH, 'spam_tfidf_vectorizer.pkl')
FALLBACK_INFO_FILE = os.path.join(FALLBACK_MODEL_PATH, 'spam_model_info.pkl')

# Global variables
spam_model = None
spam_vectorizer = None
spam_model_info = None
spam_model_loaded = False

def preprocess_text(text):
    """
    Preprocess text for NLP:
    1. Convert to lowercase
    2. Remove URLs
    3. Remove emails
    4. Remove phone numbers
    5. Remove special characters and digits
    6. Remove extra whitespace
    7. Tokenize
    8. Remove stopwords
    9. Stemming
    """
    if not isinstance(text, str) or len(text.strip()) == 0:
        return ""
    
    # Convert to lowercase
    text = text.lower()
    
    # Remove URLs
    text = re.sub(r'http\S+|www\S+|https\S+', '', text, flags=re.MULTILINE)
    
    # Remove emails
    text = re.sub(r'\S+@\S+', '', text)
    
    # Remove phone numbers
    text = re.sub(r'\d{10,}|\+\d+|\(\d+\)\s*\d+', '', text)
    
    # Remove special characters and digits
    text = re.sub(r'[^a-zA-Z\s]', '', text)
    
    # Remove extra whitespace
    text = ' '.join(text.split())
    
    # Tokenize
    tokens = word_tokenize(text)
    
    # Remove stopwords
    stop_words = set(stopwords.words('english'))
    tokens = [word for word in tokens if word not in stop_words and len(word) > 2]
    
    # Stemming
    stemmer = PorterStemmer()
    tokens = [stemmer.stem(word) for word in tokens]
    
    return ' '.join(tokens)

def load_spam_model():
    """Load the trained spam detection model and vectorizer"""
    global spam_model, spam_vectorizer, spam_model_info, spam_model_loaded
    
    model_file = SPAM_MODEL_FILE
    vectorizer_file = SPAM_VECTORIZER_FILE
    info_file = SPAM_INFO_FILE
    
    # FIX: Try backend directory first, then fallback to model_Training
    try:
        # Try loading from backend directory first
        if not os.path.exists(model_file):
            print(f"⚠️  Model not found in backend, trying fallback location...")
            model_file = FALLBACK_MODEL_FILE
            vectorizer_file = FALLBACK_VECTORIZER_FILE
            info_file = FALLBACK_INFO_FILE
        
        # Load model
        print(f"📂 Loading model from: {model_file}")
        with open(model_file, 'rb') as f:
            spam_model = pickle.load(f)
        
        # Load vectorizer
        print(f"📂 Loading vectorizer from: {vectorizer_file}")
        with open(vectorizer_file, 'rb') as f:
            spam_vectorizer = pickle.load(f)
        
        # Load model info
        try:
            print(f"📂 Loading model info from: {info_file}")
            with open(info_file, 'rb') as f:
                spam_model_info = pickle.load(f)
        except Exception as e:
            print(f"⚠️  Could not load model info: {e}")
            spam_model_info = {
                'model_name': spam_model.__class__.__name__,
                'accuracy': 0.0,
                'f1_score': 0.0
            }
        
        spam_model_loaded = True
        print("✅ Spam Detection Model loaded successfully!")
        print(f"   Model Type: {spam_model.__class__.__name__}")
        print(f"   Accuracy: {spam_model_info.get('accuracy', 0)*100:.2f}%")
        return True
        
    except FileNotFoundError as e:
        print(f"❌ Error: Spam model files not found - {e}")
        print(f"   Searched in:")
        print(f"     1. {SPAM_MODEL_FILE}")
        print(f"     2. {FALLBACK_MODEL_FILE}")
        print(f"   Please train the model first using spam_detection_training.ipynb")
        spam_model_loaded = False
        return False
    except Exception as e:
        print(f"❌ Error loading spam model: {e}")
        import traceback
        traceback.print_exc()
        spam_model_loaded = False
        return False

# Load model on startup
load_spam_model()

@app.route('/api/spam/health', methods=['GET'])
def spam_health_check():
    """Health check endpoint for spam detection service"""
    return jsonify({
        'status': 'OK' if spam_model_loaded else 'ERROR',
        'message': 'Spam Detection Service is running',
        'model_loaded': spam_model_loaded,
        'model_type': spam_model.__class__.__name__ if spam_model else None,
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/spam/detect', methods=['POST'])
def detect_spam():
    """Detect if a message is spam"""
    if not spam_model_loaded:
        return jsonify({
            'success': False,
            'error': 'Spam detection model not loaded. Please train the model first.'
        }), 500
    
    try:
        # Get message data
        data = request.json
        message = data.get('message', '').strip()
        
        if not message:
            return jsonify({
                'success': False,
                'error': 'Message text is required'
            }), 400
        
        # Preprocess message
        processed_message = preprocess_text(message)
        
        if not processed_message:
            return jsonify({
                'success': False,
                'error': 'Message could not be processed. Please provide valid text.'
            }), 400
        
        # Vectorize
        vectorized_message = spam_vectorizer.transform([processed_message])
        
        # Predict
        prediction = spam_model.predict(vectorized_message)[0]
        
        # Get probability if available
        if hasattr(spam_model, 'predict_proba'):
            probability = spam_model.predict_proba(vectorized_message)[0]
            spam_prob = float(probability[1])
            ham_prob = float(probability[0])
        else:
            spam_prob = float(prediction)
            ham_prob = float(1 - prediction)
        
        # Determine risk level
        if spam_prob >= 0.9:
            risk_level = 'CRITICAL'
        elif spam_prob >= 0.7:
            risk_level = 'HIGH'
        elif spam_prob >= 0.5:
            risk_level = 'MEDIUM'
        else:
            risk_level = 'LOW'
        
        # Determine threat category
        lower_msg = message.lower()
        if not bool(prediction == 1) and spam_prob < 0.5:
            category = "Legitimate (Ham)"
        elif any(k in lower_msg for k in ['upi', 'qr code', 'collect request', 'gpay', 'phonepe', 'paytm', 'refund', 'olx', 'scan code']):
            category = "UPI scam"
        elif any(k in lower_msg for k in ['otp', 'kyc', 'electricity', 'disconnect', 'power', 'bill unpaid', 'bank account block', 'debit card block', 'vishing']):
            category = "OTP fraud"
        elif any(k in lower_msg for k in ['pan card', 'aadhaar', 'cibil', 'loan approved', 'identity', 'passport', 'mule']):
            category = "Identity theft"
        elif any(k in lower_msg for k in ['.apk', 'download app', 'anydesk', 'teamviewer', 'quicksupport', 'install', 'trojan', 'malware']):
            category = "Malware & Ransomware"
        elif any(k in lower_msg for k in ['click here', 'http', 'https', 'login', 'verify account', 'congratulations', 'won', 'lottery', 'telegram', 'job', 'part time']):
            category = "Phishing"
        else:
            category = "General Spam"

        # Prepare response
        result = {
            'success': True,
            'data': {
                'is_spam': bool(prediction == 1),
                'spam_label': 'SPAM' if prediction == 1 else 'LEGITIMATE (HAM)',
                'category': category,
                'confidence': float(max(spam_prob, ham_prob)),
                'risk_level': risk_level,
                'spam_probability': float(spam_prob),
                'ham_probability': float(ham_prob),
                'spam_percentage': f"{spam_prob*100:.2f}%",
                'ham_percentage': f"{ham_prob*100:.2f}%",
                'probabilities': {
                    'spam': float(spam_prob),
                    'ham': float(ham_prob)
                }
            },
            'message_info': {
                'original_message': message,
                'message_length': len(message),
                'word_count': len(message.split()),
                'processed_length': len(processed_message.split())
            },
            'model_info': {
                'model_type': spam_model.__class__.__name__,
                'accuracy': spam_model_info.get('accuracy', 0) * 100,
                'f1_score': spam_model_info.get('f1_score', 0) * 100
            },
            'timestamp': datetime.now().isoformat()
        }
        
        return jsonify(result)
        
    except Exception as e:
        print(f"❌ Spam detection error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': f'Spam detection failed: {str(e)}'
        }), 500

@app.route('/api/spam/predict', methods=['POST'])
def predict_spam():
    """Alternative endpoint for spam prediction (simplified response)"""
    if not spam_model_loaded:
        return jsonify({
            'success': False,
            'error': 'Model not loaded'
        }), 500
    
    try:
        data = request.json
        message = data.get('message', '').strip()
        
        if not message:
            return jsonify({
                'success': False,
                'error': 'Message is required'
            }), 400
        
        # Preprocess and predict
        processed = preprocess_text(message)
        if not processed:
            return jsonify({
                'is_spam': False,
                'confidence': 0.0,
                'probabilities': {'spam': 0.0, 'ham': 1.0},
                'risk_level': 'LOW'
            })
        
        vectorized = spam_vectorizer.transform([processed])
        prediction = spam_model.predict(vectorized)[0]
        
        if hasattr(spam_model, 'predict_proba'):
            probability = spam_model.predict_proba(vectorized)[0]
            spam_prob = float(probability[1])
            ham_prob = float(probability[0])
        else:
            spam_prob = float(prediction)
            ham_prob = float(1 - prediction)
        
        # Determine risk level
        if spam_prob >= 0.7:
            risk_level = 'high'
        elif spam_prob >= 0.4:
            risk_level = 'medium'
        else:
            risk_level = 'low'
        
        return jsonify({
            'is_spam': bool(prediction == 1),
            'confidence': float(max(spam_prob, ham_prob)),
            'probabilities': {
                'spam': float(spam_prob),
                'ham': float(ham_prob)
            },
            'risk_level': risk_level
        })
        
    except Exception as e:
        print(f"❌ Prediction error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/spam/statistics', methods=['GET'])
def get_spam_statistics():
    """Get spam detection model statistics"""
    if not spam_model_loaded:
        return jsonify({
            'success': False,
            'error': 'Model not loaded'
        }), 500
    
    return jsonify({
        'success': True,
        'statistics': {
            'model_type': spam_model_info.get('model_name', 'Unknown'),
            'accuracy': spam_model_info.get('accuracy', 0) * 100,
            'precision': spam_model_info.get('precision', 0) * 100,
            'recall': spam_model_info.get('recall', 0) * 100,
            'f1_score': spam_model_info.get('f1_score', 0) * 100,
            'training_samples': spam_model_info.get('training_samples', 0),
            'test_samples': spam_model_info.get('test_samples', 0),
            'features': spam_model_info.get('features', 0)
        },
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/spam/batch-detect', methods=['POST'])
def batch_detect_spam():
    """Detect spam for multiple messages"""
    if not spam_model_loaded:
        return jsonify({
            'success': False,
            'error': 'Model not loaded'
        }), 500
    
    try:
        messages = request.json.get('messages', [])
        
        if not messages:
            return jsonify({
                'success': False,
                'error': 'No messages provided'
            }), 400
        
        results = []
        for idx, message in enumerate(messages):
            # Preprocess
            processed = preprocess_text(message)
            
            if not processed:
                results.append({
                    'message_id': idx + 1,
                    'is_spam': False,
                    'confidence': 0.0,
                    'error': 'Could not process message'
                })
                continue
            
            # Vectorize and predict
            vectorized = spam_vectorizer.transform([processed])
            prediction = spam_model.predict(vectorized)[0]
            
            if hasattr(spam_model, 'predict_proba'):
                probability = spam_model.predict_proba(vectorized)[0]
                confidence = float(max(probability))
            else:
                confidence = float(prediction)
            
            results.append({
                'message_id': idx + 1,
                'message': message[:100] + '...' if len(message) > 100 else message,
                'is_spam': bool(prediction == 1),
                'confidence': confidence,
                'prediction': 'SPAM' if prediction == 1 else 'HAM'
            })
        
        return jsonify({
            'success': True,
            'total_messages': len(messages),
            'results': results,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Batch detection failed: {str(e)}'
        }), 500

# Error handlers
@app.errorhandler(404)
def not_found(error):
    return jsonify({
        'success': False,
        'error': 'Endpoint not found'
    }), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({
        'success': False,
        'error': 'Internal server error'
    }), 500

if __name__ == '__main__':
    PORT = int(os.environ.get('SPAM_PORT', 5002))
    print("="*60)
    print("🔍 CyberShield Spam Detection Service (Flask)")
    print("="*60)
    print(f"📡 Starting on port {PORT}")
    print(f"🧠 Model Status: {'✅ Loaded' if spam_model_loaded else '❌ Not Loaded'}")
    print("="*60)
    
    app.run(
        host='0.0.0.0',
        port=PORT,
        debug=True
    )
