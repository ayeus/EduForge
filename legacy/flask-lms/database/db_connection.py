import os

import mysql.connector


def get_db_connection():
    return mysql.connector.connect(
        host=os.getenv("MYSQL_HOST", "localhost"),
        user=os.getenv("MYSQL_USER", "root"),
        password=os.getenv("MYSQL_PASSWORD", ""),
        database=os.getenv("MYSQL_DATABASE", "lms"),
    )


# Test the connection
if __name__ == "__main__":
    try:
        db = get_db_connection()
        print("Database connection successful!")
    except mysql.connector.Error as err:
        print(f"Error: {err}")
