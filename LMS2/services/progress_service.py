from database.db_connection import get_db_connection

def get_user_progress(user_id, course_id):
    db = get_db_connection()
    cursor = db.cursor(dictionary=True)
    query = """
    SELECT Lessons.lesson_name, UserProgress.completed
    FROM UserProgress
    JOIN Lessons ON UserProgress.lesson_id = Lessons.lesson_id
    WHERE UserProgress.user_id = %s AND UserProgress.course_id = %s
    """
    cursor.execute(query, (user_id, course_id))
    return cursor.fetchall()