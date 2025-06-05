from database.db_connection import get_db_connection

class Lesson:
    def __init__(self, lesson_id, course_id, lesson_name, content, video_url, lesson_order, created_at, updated_at):
        self.lesson_id = lesson_id
        self.course_id = course_id
        self.lesson_name = lesson_name
        self.content = content
        self.video_url = video_url
        self.lesson_order = lesson_order
        self.created_at = created_at
        self.updated_at = updated_at

    @staticmethod
    def get_total_videos(course_id):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM Lessons WHERE course_id = %s", (course_id,))
        count = cursor.fetchone()[0]
        cursor.close()
        conn.close()
        return count