# models/user.py
class User:
    def __init__(self, user_id, username, email, password_hash, role):
        self.user_id = user_id
        self.username = username
        self.email = email
        self.password_hash = password_hash
        self.role = role

    def __repr__(self):
        return f"User(user_id={self.user_id}, username={self.username}, email={self.email}, role={self.role})"

    @staticmethod
    def get_by_id(user_id):
        """
        Fetch a user from the database by user_id.
        """
        from database.db_connection import get_db_connection  # Import here to avoid circular imports
        db = get_db_connection()
        cursor = db.cursor(dictionary=True)
        cursor.execute("SELECT * FROM Users WHERE user_id = %s", (user_id,))
        user_data = cursor.fetchone()
        cursor.close()
        db.close()

        if user_data:
            return User(
                user_id=user_data['user_id'],
                username=user_data['username'],
                email=user_data['email'],
                password_hash=user_data['password_hash'],
                role=user_data['role']
            )
        return None