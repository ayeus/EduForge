from flask import render_template, request, redirect, url_for, session, flash
from services.user_service import register_user, login_user
from database.db_connection import get_db_connection

def init_auth_routes(app):
    @app.route("/")
    def index():
        return render_template("index.html")

    @app.route("/login")
    def login():
        return render_template("login.html")

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

    @app.route("/register")
    def register():
        return render_template("register.html")

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

    @app.route("/logout")
    def logout():
        session.pop("user_id", None)
        session.pop("role", None)
        flash("You have been logged out.", "success")
        return redirect(url_for("login"))