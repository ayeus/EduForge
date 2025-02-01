from flask import Flask, render_template, request, redirect, url_for, session, flash
from services.user_service import register_user, login_user
from services.course_service import create_course_service
from services.course_service import get_all_courses
from services.enrollment_service import enroll_user_service
from database.db_connection import get_db_connection
from services.lesson_service import get_lessons_for_student
from services.lesson_service import get_lessons_for_course
from flask import Response
import os

UPLOAD_FOLDER = "uploads"
ALLOWED_EXTENSIONS = {"webm", "mp4", "ogg"}
app = Flask(__name__) 
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


#hello how are you


app = Flask(__name__)
app.secret_key = "your_secret_key"  # Required for session management

# Home route (Login Page)
@app.route("/")
def login():
    
    return render_template("login.html")

# Login route
@app.route("/login", methods=["POST"])
def login_post():
    email = request.form.get("email")
    password = request.form.get("password")
    user = login_user(email, password)

    if user:
        session["user_id"] = user.user_id
        session["role"] = user.role  # Store the user's role in the session

        # Redirect based on role
        if user.role == "instructor":
            return redirect(url_for("instructor_dashboard"))
        elif user.role == "student":
            return redirect(url_for("student_dashboard"))
    flash("Invalid email or password. Please try again.")
    return redirect(url_for("login"))
# Registration route (GET)
@app.route("/register")
def register():
    return render_template("register.html")

# Registration route (POST)
@app.route("/register", methods=["POST"])
def register_post():
    username = request.form.get("username")
    email = request.form.get("email")
    password = request.form.get("password")
    role = request.form.get("role")

    try:
        register_user(username, email, password, role)
        flash("Registration successful! Please login.")
        return redirect(url_for("login"))
    except Exception as e:
        flash(f"Registration failed: {str(e)}")
        return redirect(url_for("register"))

# Dashboard route
@app.route("/dashboard")
def dashboard():
    if "user_id" not in session:
        return redirect(url_for("login"))
    return render_template("dashboard.html")

@app.route("/instructor/dashboard")
def instructor_dashboard():
    if "user_id" not in session or session.get("role") != "instructor":
        return redirect(url_for("login"))
    return render_template("instructor_dashboard.html")



@app.route("/student/dashboard")
def student_dashboard():
    if "user_id" not in session or session.get("role") != "student":
        return redirect(url_for("login"))

    # Fetch all available courses
    courses = get_all_courses()
    return render_template("student_dashboard.html", courses=courses)

@app.route("/enroll/<int:course_id>")
def enroll_course(course_id):
    if "user_id" not in session or session.get("role") != "student":
        return redirect(url_for("login"))

    user_id = session["user_id"]
    try:
        enroll_user_service(user_id, course_id)
        flash("Enrolled successfully!")
    except Exception as e:
        flash(f"Failed to enroll: {str(e)}")
    return redirect(url_for("student_dashboard"))

@app.route("/create_course", methods=["POST"])
def create_course():
    if "user_id" not in session or session.get("role") != "instructor":
        return redirect(url_for("login"))

    course_name = request.form.get("course_name")
    description = request.form.get("description")
    instructor_id = session["user_id"]

    try:
        # Create the course
        db = get_db_connection()
        cursor = db.cursor()
        query = "INSERT INTO Courses (course_name, description, instructor_id) VALUES (%s, %s, %s)"
        values = (course_name, description, instructor_id)
        cursor.execute(query, values)
        course_id = cursor.lastrowid  # Get the ID of the newly created course

        # Add lessons
        lesson_count = 1
        while True:
            lesson_name = request.form.get(f"lesson_name_{lesson_count}")
            lesson_content = request.form.get(f"lesson_content_{lesson_count}")
            video_url = request.form.get(f"video_{lesson_count}")
            uploaded_video = request.files.get(f"upload_video_{lesson_count}")

            if not lesson_name or not lesson_content:
                break  # Stop if no more lessons are found

            # Handle uploaded video
            video_filename = None
            if uploaded_video and allowed_file(uploaded_video.filename):
                video_filename = f"course_{course_id}_lesson_{lesson_count}.webm"
                uploaded_video.save(os.path.join(app.config["UPLOAD_FOLDER"], video_filename))

            # Handle recorded video
            if video_url:
                import requests
                video_data = requests.get(video_url).content
                video_filename = f"course_{course_id}_lesson_{lesson_count}.webm"
                with open(os.path.join(app.config["UPLOAD_FOLDER"], video_filename), "wb") as f:
                    f.write(video_data)

            # Save lesson to database
            query = "INSERT INTO Lessons (course_id, lesson_name, content, video_filename) VALUES (%s, %s, %s, %s)"
            values = (course_id, lesson_name, lesson_content, video_filename)
            cursor.execute(query, values)
            lesson_count += 1

        db.commit()
        flash("Course and lessons created successfully!")
    except Exception as e:
        db.rollback()
        flash(f"Failed to create course: {str(e)}")
    finally:
        if cursor:
            cursor.close()
        if db:
            db.close()

    return redirect(url_for("instructor_dashboard"))
@app.route("/video/<int:lesson_id>")
def get_video(lesson_id):
    db = get_db_connection()
    cursor = db.cursor()
    query = "SELECT video FROM Lessons WHERE lesson_id = %s"
    cursor.execute(query, (lesson_id,))
    video_data = cursor.fetchone()[0]
    cursor.close()
    db.close()

    if video_data:
        return Response(video_data, mimetype="video/webm")
    return "Video not found", 404

@app.route("/course/<int:course_id>")
def course_details(course_id):
    if "user_id" not in session or session.get("role") != "student":
        return redirect(url_for("login"))

    # Fetch lessons for the selected course
    lessons = get_lessons_for_course(course_id)
    return render_template("course_details.html", lessons=lessons)

# Logout route
@app.route("/logout")
def logout():
    session.pop("user_id", None)
    return redirect(url_for("login"))

if __name__ == "__main__":
    app.run(debug=True)