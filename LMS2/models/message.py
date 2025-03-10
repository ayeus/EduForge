# models/message.py
from database.db_connection import get_db_connection

class Message:
    def __init__(self, student_id, instructor_id, course_id, content):
        self.student_id = student_id
        self.instructor_id = instructor_id
        self.course_id = course_id
        self.content = content

    def save(self):
        """Save the message to the database."""
        db = None
        cursor = None
        try:
            db = get_db_connection()
            cursor = db.cursor()
            query = """
                INSERT INTO messages (student_id, instructor_id, course_id, content)
                VALUES (%s, %s, %s, %s)
            """
            values = (self.student_id, self.instructor_id, self.course_id, self.content)
            cursor.execute(query, values)
            db.commit()
        except Exception as e:
            if db:
                db.rollback()
            raise e  # Re-raise the exception to be handled by the route
        finally:
            if cursor:
                cursor.close()
            if db:
                db.close()