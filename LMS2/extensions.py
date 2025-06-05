from flask_socketio import SocketIO

# Initialize SocketIO without app context
socketio = SocketIO()

__all__ = ['socketio']