from flask import Flask, g, session
from extensions import socketio
import os
from routes.auth_routes import init_auth_routes
from routes.course_routes import init_course_routes
from routes.lesson_routes import init_lesson_routes
from routes.student_routes import init_student_routes
from routes.chatbot_routes import init_chatbot_routes
from routes.message_routes import message_bp
from routes.instructor_routes import instructor_bp
from models.user import User
from flask_cors import CORS
from routes.progress_routes import progress_bp

# Initialize Flask app
app = Flask(__name__)
CORS(app)
app.secret_key = "2a429ad801baa5a64c5b931fb3244ae1"

# Configure upload folder
UPLOAD_FOLDER = "uploads"
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

# Initialize SocketIO with app
socketio.init_app(app, cors_allowed_origins="*", async_mode='eventlet')

# Socket.IO Events
@socketio.on('connect')
def handle_connect():
    if 'user_id' in session:
        socketio.emit('join_room', {'room': f"user_{session['user_id']}"})
        print(f"User {session['user_id']} connected")

# Application Hooks
@app.before_request
def load_logged_in_user():
    user_id = session.get("user_id")
    g.current_user = User.get_by_id(user_id) if user_id else None

@app.context_processor
def inject_current_user():
    return dict(current_user=g.get("current_user"))

# Initialize Routes
init_auth_routes(app)
init_course_routes(app)
init_lesson_routes(app)
init_student_routes(app)
init_chatbot_routes(app)
app.register_blueprint(message_bp)
app.register_blueprint(instructor_bp)
app.register_blueprint(progress_bp, url_prefix='/progress')

if __name__ == "__main__":
    socketio.run(app, debug=True, host='127.0.0.1', port=5000)