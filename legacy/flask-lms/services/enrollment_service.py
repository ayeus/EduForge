from database.db_connection import get_db_connection

def enroll_user_service(user_id, course_id):
    db = get_db_connection()
    cursor = db.cursor()
    query = "INSERT INTO Enrollments (user_id, course_id) VALUES (%s, %s)"
    values = (user_id, course_id)
    cursor.execute(query, values)
    db.commit()
    print("User enrolled successfully!")