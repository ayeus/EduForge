from database.db_connection import get_db_connection
class Course:
    @classmethod
    def get_by_id(cls, course_id):
        """Get course by ID from database"""
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM courses WHERE course_id = %s", (course_id,))
        course = cursor.fetchone()
        cursor.close()
        conn.close()
        return course
    def __init__(self, course_id, course_name, description, instructor_id):
        self.course_id = course_id
        self.course_name = course_name
        self.description = description
        self.instructor_id = instructor_id

    def __repr__(self):
        return f"Course(course_id={self.course_id}, course_name={self.course_name}, instructor_id={self.instructor_id})"