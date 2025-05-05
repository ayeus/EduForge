from flask import Flask, g, session
from flask_socketio import SocketIO
import os
from routes.auth_routes import init_auth_routes
from routes.course_routes import init_course_routes
from routes.lesson_routes import init_lesson_routes
from routes.student_routes import init_student_routes
from routes.chatbot_routes import init_chatbot_routes
from routes.message_routes import message_bp
from models.user import User  # Import the User class
from flask_cors import CORS
import hashlib
import hmac

secret = "0u467aa4hwubw5d35uqiz3qftg0jl9l9"  # Get this from Chatbase dashboard
user_id = "d9428888-122b-11e1-b85c-61cd3cbb3210"    # Your user's unique identifier

# Generate hash
user_hash = hmac.new(
    secret.encode('utf-8'),
    user_id.encode('utf-8'),
    hashlib.sha256
).hexdigest()



# Initialize Flask app
app = Flask(__name__)
CORS(app)
app.secret_key = "2a429ad801baa5a64c5b931fb3244ae1"  # Required for sessions

# Configure upload folder
UPLOAD_FOLDER = "uploads"
ALLOWED_EXTENSIONS = {'mp4'}
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

# Initialize SocketIO
socketio = SocketIO(app)


# Fetch the logged-in user before each request
@app.before_request
def load_logged_in_user():
    """Fetch the logged-in user from the session and make it available globally."""
    user_id = session.get("user_id")
    if user_id:
        user = User.get_by_id(user_id)  # Use the User class method
        if user:
            g.current_user = user  # Store the user in Flask's global `g` object
        else:
            g.current_user = None
    else:
        g.current_user = None

# Make `current_user` available in all templates
@app.context_processor
def inject_current_user():
    """Inject the `current_user` variable into all templates."""
    return dict(current_user=g.get("current_user"))

# Initialize routes
init_auth_routes(app)
init_course_routes(app)
init_lesson_routes(app)
init_student_routes(app)
init_chatbot_routes(app)
app.register_blueprint(message_bp)

if __name__ == "__main__":
    if not os.path.exists(UPLOAD_FOLDER):
        os.makedirs(UPLOAD_FOLDER)
    app.run(debug=True)