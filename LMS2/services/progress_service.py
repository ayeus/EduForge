from database.db_connection import get_db_connection

def get_student_progress(user_id, course_id):
    """
    Fetch the progress of a student for a specific course.

    Args:
        user_id (int): The ID of the student.
        course_id (int): The ID of the course.

    Returns:
        list: A list of dictionaries containing lesson names and completion status.
    """
    db = get_db_connection()
    if not db:
        raise Exception("Failed to connect to the database.")

    cursor = db.cursor(dictionary=True)
    try:
        query = """
        SELECT Lessons.lesson_name, UserProgress.completed
        FROM UserProgress
        JOIN Lessons ON UserProgress.lesson_id = Lessons.lesson_id
        WHERE UserProgress.user_id = %s AND UserProgress.course_id = %s
        """
        cursor.execute(query, (user_id, course_id))
        progress = cursor.fetchall()
        return progress
    except Exception as e:
        print(f"Error fetching student progress: {e}")
        return []
    finally:
        cursor.close()
        db.close()