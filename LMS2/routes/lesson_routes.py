# routes/lesson_routes.py
from flask import request, redirect, url_for, session, flash, Response
from services.lesson_service import get_lessons_for_course, create_lesson
from database.db_connection import get_db_connection

def init_lesson_routes(app):
    @app.route("/video/<int:lesson_id>")
    def get_video(lesson_id):
        db = get_db_connection()
        cursor = db.cursor()
        try:
            # Fetch the video URL from the database
            query = "SELECT video_url FROM Lessons WHERE lesson_id = %s"
            cursor.execute(query, (lesson_id,))
            result = cursor.fetchone()

            if result and result[0]:  # Check if video_url exists
                video_url = result[0]
                # Redirect to the S3 URL
                return redirect(video_url)
            else:
                return "Video not found", 404
        except Exception as e:
            print(f"Error fetching video URL: {e}")
            return "Internal Server Error", 500
        finally:
            cursor.close()
            db.close()

    @app.route("/create_lesson/<int:course_id>", methods=["POST"])
    def create_lesson_route(course_id):
        # Check if user is logged in and has instructor/admin role
        if "user_id" not in session or session.get("role") not in ["instructor", "admin"]:
            flash("You do not have permission to create a lesson.", "error")
            return redirect(url_for("index"))

        # Get form data
        lesson_name = request.form.get("lesson_name")
        content = request.form.get("content")
        video_file = request.files.get("video_file")

        if not lesson_name or not video_file:
            flash("Lesson name and video file are required.", "error")
            return redirect(url_for("course", course_id=course_id))

        # Use the original filename for S3 upload
        video_filename = video_file.filename

        try:
            # Create the lesson and upload video to S3
            lesson_id = create_lesson(course_id, lesson_name, content, video_file, video_filename)
            if lesson_id:
                flash("Lesson created successfully!", "success")
            else:
                flash("Failed to create lesson.", "error")
        except Exception as e:
            print(f"Error creating lesson: {e}")
            flash(f"Error creating lesson: {str(e)}", "error")

        return redirect(url_for("course", course_id=course_id))