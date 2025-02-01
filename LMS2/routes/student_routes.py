from flask import render_template, request, redirect, url_for, session, flash
from services.course_service import get_all_courses
from services.lesson_service import get_lessons_for_course

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