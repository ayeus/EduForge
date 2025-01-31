class User:
    def __init__(self, user_id, username, email, password_hash, role):
        self.user_id = user_id
        self.username = username
        self.email = email
        self.password_hash = password_hash
        self.role = role

    def __repr__(self):
        return f"User(user_id={self.user_id}, username={self.username}, email={self.email}, role={self.role})"