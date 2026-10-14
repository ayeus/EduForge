# services/course_service.py
from database.db_connection import get_db_connection
from utils.s3_utils import upload_file_to_s3

def get_all_courses():
    db = get_db_connection()
    cursor = db.cursor(dictionary=True)
    query = "SELECT * FROM Courses"
    cursor.execute(query)
    courses = cursor.fetchall()
    cursor.close()
    db.close()
    return courses

def get_enrolled_courses(user_id):
    db = get_db_connection()
    cursor = db.cursor(dictionary=True)
    query = """
    SELECT Courses.course_id, Courses.course_name, Courses.description
    FROM Enrollments
    JOIN Courses ON Enrollments.course_id = Courses.course_id
    WHERE Enrollments.user_id = %s
    """
    cursor.execute(query, (user_id,))
    courses = cursor.fetchall()
    cursor.close()
    db.close()
    return courses

def create_course_service(instructor_id, course_name, description, lessons):
    """
    Create a new course and its lessons, uploading videos and files to S3.
    :param instructor_id: ID of the instructor creating the course
    :param course_name: Name of the course
    :param description: Course description
    :param lessons: List of lessons, each with name, content, video_file, and file
    :return: Course ID if successful, None if failed
    """
    db = get_db_connection()
    cursor = db.cursor()
    try:
        # Insert the course
        course_query = """
        INSERT INTO Courses (course_name, description, instructor_id, status)
        VALUES (%s, %s, %s, 'draft')
        """
        cursor.execute(course_query, (course_name, description, instructor_id))
        course_id = cursor.lastrowid

        # Insert lessons
        for lesson in lessons:
            lesson_name = lesson['name']
            content = lesson['content']
            video_file = lesson.get('video_file')
            video_filename = video_file.filename if video_file else None
            file = lesson.get('file')
            file_filename = file.filename if file else None

            # Upload video to S3 if provided
            video_url = None
            if video_file:
                video_file.seek(0)  # Reset file pointer to the beginning
                video_url = upload_file_to_s3(video_file, video_filename)
                if not video_url:
                    raise Exception(f"Failed to upload video for lesson: {lesson_name}")

            # Upload file (PDF/PPTX) to S3 if provided
            file_url = None
            if file:
                file.seek(0)  # Reset file pointer to the beginning
                file_url = upload_file_to_s3(file, file_filename)
                if not file_url:
                    raise Exception(f"Failed to upload file for lesson: {lesson_name}")

            # Insert the lesson
            lesson_query = """
            INSERT INTO Lessons (course_id, lesson_name, content, video_url, video_filename, file_url, file_filename, lesson_order)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """
            # Set lesson order based on its position in the list
            lesson_order = lessons.index(lesson) + 1
            cursor.execute(lesson_query, (course_id, lesson_name, content, video_url, video_filename, file_url, file_filename, lesson_order))

        db.commit()
        print(f"Course created successfully with ID: {course_id}")
        return course_id
    except Exception as e:
        db.rollback()
        print(f"Error creating course: {e}")
        raise e
    finally:
        cursor.close()
        db.close()