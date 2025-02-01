from database.db_connection import get_db_connection

def get_lessons_for_student(user_id):
    db = get_db_connection()
    cursor = db.cursor(dictionary=True)
    query = """
    SELECT Lessons.lesson_id, Lessons.lesson_name, Lessons.content
    FROM Lessons
    JOIN Enrollments ON Lessons.course_id = Enrollments.course_id
    WHERE Enrollments.user_id = %s
    """
    cursor.execute(query, (user_id,))
    lessons = cursor.fetchall()
    cursor.close()
    db.close()
    return lessons

def get_lessons_for_course(course_id):
    db = get_db_connection()
    cursor = db.cursor(dictionary=True)
    query = "SELECT * FROM Lessons WHERE course_id = %s"
    cursor.execute(query, (course_id,))
    lessons = cursor.fetchall()
    cursor.close()
    db.close()
    return lessons