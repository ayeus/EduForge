from flask import Blueprint, request, render_template, session, redirect, url_for
from services.progress_service import update_completion, get_progress_summary, get_student_progress
from database.db_connection import get_db_connection

progress_bp = Blueprint('progress', __name__)

def login_required(f):
    def wrap(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    wrap.__name__ = f.__name__
    return wrap

@progress_bp.route('/update_completion/<int:lesson_id>', methods=['POST'])
@login_required
def update_completion_route(lesson_id):
    try:
        user_id = session['user_id']
        completed = request.form.get('completed', 'false') == 'true'
        print(f"Updating completion: user_id={user_id}, lesson_id={lesson_id}, completed={completed}")
        update_completion(user_id, lesson_id, completed)
        return {"message": "Completion updated"}, 200
    except Exception as e:
        print(f"Error in update_completion_route: {str(e)}")
        return {"error": str(e)}, 500

@progress_bp.route('/progress/<int:course_id>')
@login_required
def view_progress(course_id):
    user_id = session['user_id']
    progress_summary = get_progress_summary(user_id, course_id)
    detailed_progress = get_student_progress(user_id, course_id)

    # Fetch the course name
    db = get_db_connection()
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT course_name FROM Courses WHERE course_id = %s", (course_id,))
    course = cursor.fetchone()
    cursor.close()
    db.close()

    course_name = course['course_name'] if course else "Unknown Course"

    return render_template('progress.html', 
                         progress=progress_summary, 
                         detailed_progress=detailed_progress,
                         course_id=course_id,
                         course_name=course_name)