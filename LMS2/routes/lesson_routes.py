from flask import request, redirect, url_for, session, flash, Response
from services.lesson_service import get_lessons_for_course
from database.db_connection import get_db_connection

def init_lesson_routes(app):
    @app.route("/video/<int:lesson_id>")
    def get_video(lesson_id):
        db = get_db_connection()
        cursor = db.cursor()
        query = "SELECT video FROM Lessons WHERE lesson_id = %s"
        cursor.execute(query, (lesson_id,))
        video_data = cursor.fetchone()[0]
        cursor.close()
        db.close()

        if video_data:
            return Response(video_data, mimetype="video/webm")
        return "Video not found", 404