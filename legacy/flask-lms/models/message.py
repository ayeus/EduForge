from database.db_connection import get_db_connection

class Message:
    def __init__(self, student_id, instructor_id, course_id, content):
        self.student_id = student_id
        self.instructor_id = instructor_id
        self.course_id = course_id
        self.content = content
        self.message_id = None  # Initialize message_id

    def save(self):
        """Save message and return generated ID"""
        conn = None
        cursor = None
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            query = """
                INSERT INTO messages 
                (student_id, instructor_id, course_id, content)
                VALUES (%s, %s, %s, %s)
            """
            values = (self.student_id, self.instructor_id, 
                     self.course_id, self.content)
            cursor.execute(query, values)
            conn.commit()
            
            # Get the auto-generated ID
            cursor.execute("SELECT LAST_INSERT_ID()")
            self.message_id = cursor.fetchone()[0]
            return True
            
        except Exception as e:
            if conn:
                conn.rollback()
            raise e
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()