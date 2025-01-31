import mysql.connector

def get_db_connection():
    return mysql.connector.connect(
        host="localhost",
        user="root",
        password="Aasu@1234",  # Replace with your MySQL password
        database="lms"
    )

# Test the connection
if __name__ == "__main__":
    try:
        db = get_db_connection()
        print("Database connection successful!")
    except mysql.connector.Error as err:
        print(f"Error: {err}")