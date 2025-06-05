from flask import Blueprint, render_template, session, redirect, url_for
from models.message import Message
from models.user import User
from models.course import Course

instructor_bp = Blueprint('instructor', __name__)

@instructor_bp.route('/instructor/dashboard')
def instructor_dashboard():
    if not session.get('user_id') or session.get('role') != 'instructor':
        return redirect(url_for('auth.login'))  # Changed from 'auth.login' to match your auth blueprint
    
    instructor_id = session['user_id']
    messages = Message.get_by_instructor(instructor_id)
    
    enhanced_messages = []
    for msg in messages:
        student = User.get_by_id(msg['student_id'])
        course = Course.get_by_id(msg['course_id'])
        enhanced_messages.append({
            **msg,
            'student_name': f"{student.first_name} {student.last_name}",
            'course_name': course.course_name
        })
    
    return render_template('instructor_dashboard.html', messages=enhanced_messages)