from flask import request, redirect, url_for, session, flash, render_template
from services.course_service import create_course_service, get_all_courses
from services.enrollment_service import enroll_user_service
from database.db_connection import get_db_connection

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

            # Parse lessons from the form
            lessons = []
            lesson_count = 1
            while True:
                lesson_name = request.form.get(f"lesson_name_{lesson_count}")
                lesson_content = request.form.get(f"lesson_content_{lesson_count}")
                video_file = request.files.get(f"upload_video_{lesson_count}")
                file = request.files.get(f"upload_file_{lesson_count}")

                if not lesson_name or not lesson_content:
                    break  # Stop if no more lessons are found

                lessons.append({
                    "name": lesson_name,
                    "content": lesson_content,
                    "video_file": video_file if video_file and video_file.filename else None,
                    "file": file if file and file.filename else None
                })
                lesson_count += 1

            if not lessons:
                flash("At least one lesson is required.", "error")
                return redirect(url_for("create_course"))

            try:
                # Create the course and lessons using the service
                course_id = create_course_service(instructor_id, course_name, description, lessons)
                flash("Course and lessons created successfully!", "success")
            except Exception as e:
                flash(f"Failed to create course: {str(e)}", "error")
                return redirect(url_for("create_course"))

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
        if "user_id" not in session or session.get("role") != "student":
            return redirect(url_for("login"))

        user_id = session["user_id"]
        db = get_db_connection()
        cursor = db.cursor(dictionary=True)

        # Fetch the course details
        cursor.execute("SELECT * FROM Courses WHERE course_id = %s", (course_id,))
        course = cursor.fetchone()

        if not course:
            cursor.close()
            db.close()
            flash("Course not found.", "error")
            return redirect(url_for("student_dashboard"))

        # Initialize UserProgress entries for all lessons in the course if not already present
        cursor.execute("SELECT lesson_id FROM Lessons WHERE course_id = %s", (course_id,))
        lessons = cursor.fetchall()
        for lesson in lessons:
            lesson_id = lesson['lesson_id']
            cursor.execute("""
                INSERT INTO UserProgress (user_id, lesson_id, completed)
                VALUES (%s, %s, 0)
                ON DUPLICATE KEY UPDATE completed = completed
            """, (user_id, lesson_id))

        # Fetch lessons and their completion status for the user
        cursor.execute("""
            SELECT l.*, up.completed
            FROM Lessons l
            LEFT JOIN UserProgress up ON l.lesson_id = up.lesson_id AND up.user_id = %s
            WHERE l.course_id = %s
            ORDER BY l.lesson_order
        """, (user_id, course_id))
        lessons = cursor.fetchall()

        # Log the lessons to debug
        print("Fetched lessons:", lessons)

        db.commit()
        cursor.close()
        db.close()

        # Render the template with course and lessons data
        return render_template(
            "course_details.html",
            course=course,
            lessons=lessons,
            course_name=course['course_name'],
            course_id=course_id,
            current_user={'user_id': user_id}
        )