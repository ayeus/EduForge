from database.db_connection import get_db_connection

class UserProgress:
    def __init__(self, progress_id, user_id, lesson_id, completed, completed_at, created_at, updated_at):
        self.progress_id = progress_id
        self.user_id = user_id
        self.lesson_id = lesson_id
        self.completed = completed
        self.completed_at = completed_at
        self.created_at = created_at
        self.updated_at = updated_at

    @staticmethod
    def update_completion(user_id, lesson_id, completed):
        """Update or create a progress record"""
        try:
            conn = get_db_connection()
            if not conn:
                raise Exception("Failed to connect to the database")
                
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO UserProgress (user_id, lesson_id, completed, completed_at)
                VALUES (%s, %s, %s, NOW())
                ON DUPLICATE KEY UPDATE 
                    completed = VALUES(completed),
                    completed_at = NOW(),
                    updated_at = NOW()
            """, (user_id, lesson_id, completed))
            conn.commit()
            return True
        except Exception as e:
            print(f"Error in UserProgress.update_completion: {str(e)}")
            return False
        finally:
            if 'cursor' in locals():
                cursor.close()
            if 'conn' in locals():
                conn.close()

    @staticmethod
    def get_completed_videos_count(user_id, course_id):
        """Count completed videos for a user in a course"""
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("""
                SELECT COUNT(*) 
                FROM UserProgress up
                JOIN Lessons l ON up.lesson_id = l.lesson_id
                WHERE up.user_id = %s AND l.course_id = %s AND up.completed = 1
            """, (user_id, course_id))
            return cursor.fetchone()[0] or 0
        except Exception as e:
            print(f"Error in get_completed_videos_count: {str(e)}")
            return 0
        finally:
            cursor.close()
            conn.close()