from flask import Flask
from flask_socketio import SocketIO
import os
from routes.auth_routes import init_auth_routes
from routes.course_routes import init_course_routes
from routes.lesson_routes import init_lesson_routes
from routes.student_routes import init_student_routes


UPLOAD_FOLDER = "uploads"
ALLOWED_EXTENSIONS = {"webm", "mp4", "ogg"}

app = Flask(__name__)
app.secret_key = "your_secret_key"
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
socketio = SocketIO(app)

# Initialize routes
init_auth_routes(app)
init_course_routes(app)
init_lesson_routes(app)
init_student_routes(app)

if __name__ == "__main__":
     if not os.path.exists(UPLOAD_FOLDER):
        os.makedirs(UPLOAD_FOLDER)
     app.run(debug=True)