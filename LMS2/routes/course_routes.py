from flask import request, redirect, url_for, session, flash, render_template
from services.course_service import create_course_service, get_all_courses
from services.enrollment_service import enroll_user_service
from database.db_connection import get_db_connection
from utils import allowed_file  # Import the allowed_file function
import os

def init_course_routes(app):
    @app.route("/instructor/dashboard")
    def instructor_dashboard():
        if "user_id" not in session or session.get("role") != "instructor":
            return redirect(url_for("login"))
        return render_template("instructor_dashboard.html")

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
                recorded_video = request.files.get(f"video_{lesson_count}")
                uploaded_video = request.files.get(f"upload_video_{lesson_count}")

                if not lesson_name or not lesson_content:
                    break  # Stop if no more lessons are found

                # Handle recorded or uploaded video
                video_filename = None
                if recorded_video and allowed_file(recorded_video.filename):
                    video_filename = f"course_{course_id}_lesson_{lesson_count}_recorded.webm"
                    recorded_video.save(os.path.join(app.config["UPLOAD_FOLDER"], video_filename))
                elif uploaded_video and allowed_file(uploaded_video.filename):
                    video_filename = f"course_{course_id}_lesson_{lesson_count}_uploaded.webm"
                    uploaded_video.save(os.path.join(app.config["UPLOAD_FOLDER"], video_filename))

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