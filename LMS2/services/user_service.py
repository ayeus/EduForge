from database.db_connection import get_db_connection
from models.user import User
from utils.auth import hash_password, verify_password

def register_user(username, email, password, role):
    db = get_db_connection()
    cursor = db.cursor()
    query = "INSERT INTO Users (username, email, password_hash, role) VALUES (%s, %s, %s, %s)"
    values = (username, email, hash_password(password), role)
    cursor.execute(query, values)
    db.commit()
    print("User registered successfully!")

def login_user(email, password):
    db = get_db_connection()
    cursor = db.cursor(dictionary=True)
    query = "SELECT * FROM Users WHERE email = %s"
    cursor.execute(query, (email,))
    user_data = cursor.fetchone()

    if user_data and verify_password(password, user_data['password_hash']):
        return User(**user_data)  # Return User object
    return None  # Login failed