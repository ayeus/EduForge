from flask import Flask
from flask_socketio import SocketIO
import os
from routes.auth_routes import init_auth_routes
from routes.course_routes import init_course_routes
from routes.lesson_routes import init_lesson_routes
from routes.student_routes import init_student_routes
import openai
from routes.chatbot_routes import init_chatbot_routes
from flask import send_from_directory



# Initialize routes
app = Flask(__name__)
init_chatbot_routes(app)
app.secret_key = "2a429ad801baa5a64c5b931fb3244ae1"

 OpenAI Configuration
OPENAI_API_KEY = "sk-RMABP6kML3u9me_P3ukzMT665ylGeogjydVJ2K7FO3h8_x5HFSSxetvoSgDvPIMxc3Ev-7K8bvT3BlbkFJFfC4hy-AarRWGhhLybnspVYcKfJcBi-mqpq1sOGO05bveYPJFrt-n3sFq28nM2Bs8k3q-k8eUA"

 Ensure this variable is set

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
 raise ValueError("No OpenAI API key found. Please set the OPENAI_API_KEY environment variable.")
openai.api_key = OPENAI_API_KEY




UPLOAD_FOLDER = "uploads"
ALLOWED_EXTENSIONS = {'mp4'}


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

     