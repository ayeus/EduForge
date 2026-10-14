# services/lesson_service.py
from database.db_connection import get_db_connection
from utils.s3_utils import upload_file_to_s3

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

def create_lesson(course_id, lesson_name, content, video_file, video_filename):
    """
    Create a new lesson, upload the video to S3, and store the URL in the database.
    :param course_id: ID of the course
    :param lesson_name: Name of the lesson
    :param content: Lesson content
    :param video_file: Video file object (from form upload)
    :param video_filename: Original filename of the video
    :return: Lesson ID if successful, None if failed
    """
    # Upload video to S3
    video_url = upload_file_to_s3(video_file, video_filename)
    if not video_url:
        raise Exception("Failed to upload video to S3")

    # Insert lesson into the database
    db = get_db_connection()
    cursor = db.cursor()
    try:
        query = """
        INSERT INTO Lessons (course_id, lesson_name, content, video_url, video_filename)
        VALUES (%s, %s, %s, %s, %s)
        """
        cursor.execute(query, (course_id, lesson_name, content, video_url, video_filename))
        db.commit()
        lesson_id = cursor.lastrowid
        return lesson_id
    except Exception as e:
        db.rollback()
        print(f"Error creating lesson: {e}")
        return None
    finally:
        cursor.close()
        db.close()