import bcrypt

def hash_password(password):
    # Hash a password for the first time
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())

def verify_password(password, hashed_password):
    # Check hashed password against plain text password
    return bcrypt.checkpw(password.encode('utf-8'), hashed_password.encode('utf-8'))