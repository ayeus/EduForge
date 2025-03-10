# routes/message_routes.py
from flask import Blueprint, request, jsonify
from models.message import Message
import traceback  # Add this import

message_bp = Blueprint('message', __name__)

@message_bp.route('/send_message', methods=['POST'])
def send_message():
    try:
        data = request.json
        print("Received data:", data)  # Debug: Print the received data

        student_id = data.get('student_id')
        instructor_id = data.get('instructor_id')
        course_id = data.get('course_id')
        content = data.get('content')

        if not all([student_id, instructor_id, course_id, content]):
            return jsonify({"error": "Missing required fields"}), 400

        # Create and save the message
        message = Message(student_id, instructor_id, course_id, content)
        print("Message object created:", message)  # Debug: Print the message object
        message.save()

        return jsonify({"status": "success", "message": "Message sent successfully"}), 201
    except Exception as e:
        print("Error occurred:", str(e))  # Debug: Print the error
        print(traceback.format_exc())  # Debug: Print the full traceback
        return jsonify({"error": "An internal server error occurred"}), 500