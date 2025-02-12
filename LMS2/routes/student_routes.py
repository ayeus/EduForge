from flask import render_template, request, redirect, url_for, session, flash
from services.course_service import get_all_courses
from services.lesson_service import get_lessons_for_course
from services.progress_service import get_student_progress  # Assuming you have a progress service

def init_student_routes(app):
    @app.route("/student/dashboard")
    def student_dashboard():
        if "user_id" not in session or session.get("role") != "student":
            return redirect(url_for("login"))

        # Fetch all available courses
        courses = get_all_courses()
        return render_template("student_dashboard.html", courses=courses)

    @app.route("/course/<int:course_id>")
    def course_details(course_id):
        if "user_id" not in session or session.get("role") != "student":
            return redirect(url_for("login"))

        # Fetch lessons for the selected course
        lessons = get_lessons_for_course(course_id)
        return render_template("course_details.html", lessons=lessons)

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
        course_id = request.args.get("course_id")  # Get the course_id from the query parameters

        if not course_id:
            flash("Course ID is required.", "error")
            return redirect(url_for("student_dashboard"))  # Redirect to the student dashboard

        # Fetch the student's progress for the specified course
        progress = get_student_progress(student_id, course_id)
        return render_template("progress.html", progress=progress)