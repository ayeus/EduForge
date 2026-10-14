from database.db_connection import get_db_connection
from models.progress import UserProgress
from models.lesson import Lesson

def update_completion(user_id, lesson_id, completed):
    """Update completion status for a lesson"""
    UserProgress.update_completion(user_id, lesson_id, completed)

def get_progress_summary(user_id, course_id):
    """Get summary of progress including percentage"""
    total_videos = Lesson.get_total_videos(course_id)
    completed_videos = UserProgress.get_completed_videos_count(user_id, course_id)
    
    return {
        "total_videos": total_videos or 0,
        "completed_videos": completed_videos or 0,
        "progress_percentage": (completed_videos / total_videos * 100) if total_videos > 0 else 0
    }

def get_student_progress(user_id, course_id):
    """Get detailed progress for each lesson in a course"""
    db = get_db_connection()
    if not db:
        raise Exception("Failed to connect to the database")

    cursor = db.cursor(dictionary=True)
    try:
        query = """
        SELECT l.lesson_id, l.lesson_name, 
               COALESCE(up.completed, 0) as completed
        FROM Lessons l
        LEFT JOIN UserProgress up ON l.lesson_id = up.lesson_id AND up.user_id = %s
        WHERE l.course_id = %s
        ORDER BY l.lesson_order
        """
        cursor.execute(query, (user_id, course_id))
        return cursor.fetchall()
    except Exception as e:
        print(f"Error fetching student progress: {e}")
        return []
    finally:
        cursor.close()
        db.close()