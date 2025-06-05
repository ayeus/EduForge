from flask import Blueprint, request, jsonify
from models.message import Message
from models.user import User
from models.course import Course
from datetime import datetime
from extensions import socketio
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

message_bp = Blueprint('message', __name__)

@message_bp.route('/send_message', methods=['POST'])
def send_message():
    """Handle message sending with validation and real-time delivery"""
    
    try:
        # 1. Validate request and JSON data
        if not request.is_json:
            return jsonify({"error": "Request must be JSON"}), 400
            
        data = request.get_json()
        logger.info(f"Received message data: {data}")

        # 2. Validate required fields
        required_fields = {
            'student_id': {'type': int, 'error': "Student ID must be a number"},
            'instructor_id': {'type': int, 'error': "Instructor ID must be a number"},
            'course_id': {'type': int, 'error': "Course ID must be a number"},
            'content': {
                'type': str, 
                'error': "Message content must be a string",
                'validate': lambda x: 0 < len(x.strip()) <= 1000
            }
        }

        errors = []
        validated_data = {}

        for field, config in required_fields.items():
            if field not in data:
                errors.append(f"Missing required field: {field}")
                continue
                
            try:
                # Type conversion
                value = config['type'](data[field])
                
                # Additional validation if specified
                if 'validate' in config:
                    if not config['validate'](value):
                        errors.append(f"Invalid {field}: must be 1-1000 characters")
                        continue
                
                # Special handling for content
                if field == 'content':
                    value = value.strip()
                
                validated_data[field] = value
                
            except (ValueError, TypeError):
                errors.append(config['error'])

        if errors:
            logger.warning(f"Validation errors: {errors}")
            return jsonify({
                "error": "Validation failed",
                "details": errors
            }), 400

        # 3. Create and save message
        message = Message(**validated_data)
        
        if not message.save():
            logger.error("Failed to save message to database")
            return jsonify({
                "error": "Database operation failed",
                "message": "Could not save message"
            }), 500

        # 4. Prepare real-time notification
        # Define socket_data with a default timestamp
        socket_data = {
            'timestamp': datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        
        try:
            student = User.get_by_id(message.student_id)
            course = Course.get_by_id(message.course_id)
            
            # Update socket_data with additional fields
            socket_data.update({
                'content': message.content,
                'student_id': message.student_id,
                'student_name': student.username if student else "Unknown Student",
                'course_id': message.course_id,
                'course_name': course.course_name if course else "Unknown Course"
            })
            
            # Emit to instructor's room
            socketio.emit(
                'new_message', 
                socket_data, 
                room=f"user_{message.instructor_id}",
                namespace='/messages'
            )
            logger.info(f"Message emitted to instructor {message.instructor_id}")
            
        except Exception as e:
            logger.error(f"Error emitting socket message: {str(e)}")
            # Don't fail the request, just log the socket error

        # 5. Return success response
        return jsonify({
            "status": "success",
            "message": "Message sent successfully",
            "data": {
                "timestamp": socket_data['timestamp']
            }
        }), 200

    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}", exc_info=True)
        return jsonify({
            "error": "Internal server error",
            "message": "Failed to process message"
        }), 500