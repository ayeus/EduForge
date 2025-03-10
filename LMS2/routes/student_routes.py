from flask import render_template, request, redirect, url_for, session, flash, Response
from services.course_service import get_all_courses
from services.lesson_service import get_lessons_for_course
from services.progress_service import get_student_progress
from database.db_connection import get_db_connection
import mimetypes

def init_student_routes(app):
    @app.route("/student/dashboard")
    def student_dashboard():
        if "user_id" not in session or session.get("role") != "student":
            return redirect(url_for("login"))
        courses = get_all_courses()
        return render_template("student_dashboard.html", courses=courses)

   

    @app.route("/student/about")
    def about():
        if "user_id" not in session or session.get("role") != "student":
            return redirect(url_for("login"))
        return render_template("about.html")

    @app.route("/student/progress")
    def student_progress():
        if "user_id" not in session or session.get("role") != "student":
            return redirect(url_for("login"))
        student_id = session.get("user_id")
        course_id = request.args.get("course_id", type=int)
        if not course_id:
            flash("Course ID is required.", "error")
            return redirect(url_for("student_dashboard"))
        progress = get_student_progress(student_id, course_id)
        return render_template("progress.html", progress=progress, course_id=course_id)

def init_lesson_routes(app):
    @app.route("/video/<int:lesson_id>")
    def get_video(lesson_id):
        db = get_db_connection()
        cursor = db.cursor()
        try:
            query = "SELECT video, video_filename FROM Lessons WHERE lesson_id = %s"
            cursor.execute(query, (lesson_id,))
            result = cursor.fetchone()
            if result and result[0]:
                video_data, video_filename = result
                print(f"Video size: {len(video_data)} bytes, Filename: {video_filename}")
                mime_type, _ = mimetypes.guess_type(video_filename or 'default.mp4')
                mime_type = mime_type or "video/mp4"
                return Response(video_data, mimetype=mime_type)
            else:
                print(f"No video found for lesson_id: {lesson_id}")
                return "Video not found", 404
        except Exception as e:
            print(f"Error fetching video: {e}")
            return "Internal Server Error", 500
        finally:
            cursor.close()
            db.close()

def init_app(app):
    init_student_routes(app)
    init_lesson_routes(app)