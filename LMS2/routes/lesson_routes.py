from flask import request, redirect, url_for, session, flash, Response
from services.lesson_service import get_lessons_for_course
from database.db_connection import get_db_connection

def init_lesson_routes(app):
    @app.route("/video/<int:lesson_id>")
    def get_video(lesson_id):
        db = get_db_connection()
        cursor = db.cursor()
        try:
            # Fetch the video data from the database
            query = "SELECT video FROM Lessons WHERE lesson_id = %s"
            cursor.execute(query, (lesson_id,))
            result = cursor.fetchone()

            if result and result[0]:
                video_data = result[0]
                # Determine the MIME type dynamically (e.g., video/mp4, video/webm)
                # You can store the MIME type in the database or infer it from the file extension.
                mime_type = "video/webm"  # Change this based on your video format
                
                # Return the video as a response with the correct MIME type
                return Response(video_data, mimetype=mime_type)
            else:
                return "Video not found", 404
        except Exception as e:
            print(f"Error fetching video: {e}")
            return "Internal Server Error", 500
        finally:
            cursor.close()
            db.close()