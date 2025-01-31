class Progress:
    def __init__(self, progress_id, user_id, course_id, lesson_id, completed):
        self.progress_id = progress_id
        self.user_id = user_id
        self.course_id = course_id
        self.lesson_id = lesson_id
        self.completed = completed

    def __repr__(self):
        return f"Progress(progress_id={self.progress_id}, user_id={self.user_id}, course_id={self.course_id}, lesson_id={self.lesson_id}, completed={self.completed})"