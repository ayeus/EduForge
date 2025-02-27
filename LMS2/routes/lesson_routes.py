from flask import request, redirect, url_for, session, flash, Response
from services.lesson_service import get_lessons_for_course
from database.db_connection import get_db_connection
import mimetypes

def init_lesson_routes(app):
    @app.route("/video/<int:lesson_id>")
    def get_video(lesson_id):
        db = get_db_connection()
        cursor = db.cursor()
        try:
            # Fetch both video data and filename
            query = "SELECT video, video_filename FROM Lessons WHERE lesson_id = %s"
            cursor.execute(query, (lesson_id,))
            result = cursor.fetchone()

            if result and result[0]:  # Check if video data exists
                video_data, video_filename = result
                if not video_data:
                    return "No video data available", 404
                
                # Determine MIME type from filename (e.g., 'video/mp4', 'video/mp4')
                mime_type, _ = mimetypes.guess_type(video_filename or 'default.mp4')
                mime_type = mime_type or "video/mp4"  # Fallback to mp4 if unknown
                
                return Response(video_data, mimetype=mime_type)
            else:
                return "Video not found", 404
        except Exception as e:
            print(f"Error fetching video: {e}")
            return "Internal Server Error", 500
        finally:
            cursor.close()
            db.close()