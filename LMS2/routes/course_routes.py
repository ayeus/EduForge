from flask import request, redirect, url_for, session, flash, render_template
from services.course_service import create_course_service, get_all_courses
from services.enrollment_service import enroll_user_service
from database.db_connection import get_db_connection
from utils import allowed_file  # Import the allowed_file function
import os

# Initialize routes
def init_course_routes(app):
    @app.route("/instructor/dashboard")
    def instructor_dashboard():
        if "user_id" not in session or session.get("role") != "instructor":
            return redirect(url_for("login"))
        return render_template("instructor_dashboard.html")

    @app.route("/create_course", methods=["GET", "POST"])
    def create_course():
        if "user_id" not in session or session.get("role") != "instructor":
            return redirect(url_for("login"))

        if request.method == "GET":
            return render_template("create_course.html")  # Serve the create course page
        
        if request.method == "POST":
            course_name = request.form.get("course_name")
            description = request.form.get("description")
            instructor_id = session["user_id"]

            if not course_name or not description:
                flash("Course name and description are required!", "error")
                return redirect(url_for("create_course"))

            db = None
            cursor = None
            try:
                db = get_db_connection()
                cursor = db.cursor()
                # Create the course
                query = "INSERT INTO Courses (course_name, description, instructor_id) VALUES (%s, %s, %s)"
                values = (course_name, description, instructor_id)
                cursor.execute(query, values)
                course_id = cursor.lastrowid  # Get the ID of the newly created course

                # Add lessons
                lesson_count = 1
                while True:
                    lesson_name = request.form.get(f"lesson_name_{lesson_count}")
                    lesson_content = request.form.get(f"lesson_content_{lesson_count}")
                    uploaded_video = request.files.get(f"upload_video_{lesson_count}")

                    if not lesson_name or not lesson_content:
                        break  # Stop if no more lessons are found

                    # Handle uploaded video
                    video_data = None
                    video_filename = None
                    if uploaded_video and allowed_file(uploaded_video.filename):
                        video_filename = uploaded_video.filename  # e.g., "myvideo.mp4"
                        video_data = uploaded_video.read()  # Read binary data for LONGBLOB
                        print(f"Uploaded video size for lesson {lesson_count}: {len(video_data)} bytes")
                        # Optionally save to uploads folder for debugging
                        # uploaded_video.save(os.path.join(app.config["UPLOAD_FOLDER"], video_filename))

                    # Save lesson to database
                    query = "INSERT INTO Lessons (course_id, lesson_name, content, video, video_filename) VALUES (%s, %s, %s, %s, %s)"
                    values = (course_id, lesson_name, lesson_content, video_data, video_filename)
                    cursor.execute(query, values)
                    lesson_count += 1

                db.commit()
                flash("Course and lessons created successfully!", "success")
            except Exception as e:
                if db:
                    db.rollback()
                flash(f"Failed to create course: {str(e)}", "error")
            finally:
                if cursor:
                    cursor.close()
                if db:
                    db.close()

            return redirect(url_for("instructor_dashboard"))

    @app.route("/enroll/<int:course_id>")
    def enroll_course(course_id):
        if "user_id" not in session or session.get("role") != "student":
            return redirect(url_for("login"))

        user_id = session["user_id"]
        try:
            enroll_user_service(user_id, course_id)
            flash("Enrolled successfully!", "success")
        except Exception as e:
            flash(f"Failed to enroll: {str(e)}", "error")
        return redirect(url_for("student_dashboard"))

    @app.route("/course/<int:course_id>")
    def course_details(course_id):
        # Fetch the course details from the database
        db = get_db_connection()
        cursor = db.cursor(dictionary=True)
        cursor.execute("SELECT * FROM Courses WHERE course_id = %s", (course_id,))
        course = cursor.fetchone()
        cursor.close()
        db.close()

        if not course:
            flash("Course not found.", "error")
            return redirect(url_for("student_dashboard"))

        # Fetch lessons for the course
        db = get_db_connection()
        cursor = db.cursor(dictionary=True)
        cursor.execute("SELECT * FROM Lessons WHERE course_id = %s", (course_id,))
        lessons = cursor.fetchall()
        cursor.close()
        db.close()

        # Render the template with course and lessons data
        return render_template(
            "course_details.html",
            course=course,  # Pass the course object to the template
            lessons=lessons,
            course_name=course['course_name'],
            course_id=course_id
        )