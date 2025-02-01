from database.db_connection import get_db_connection

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
    return cursor.fetchall()

def create_course_service(course_name, description, instructor_id):
    db = get_db_connection()
    cursor = db.cursor()
    query = "INSERT INTO Courses (course_name, description, instructor_id) VALUES (%s, %s, %s)"
    values = (course_name, description, instructor_id)
    cursor.execute(query, values)
    db.commit()
    print("Course created successfully!")

 