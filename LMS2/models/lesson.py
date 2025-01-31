class Lesson:
    def __init__(self, lesson_id, course_id, lesson_name, content):
        self.lesson_id = lesson_id
        self.course_id = course_id
        self.lesson_name = lesson_name
        self.content = content

    def __repr__(self):
        return f"Lesson(lesson_id={self.lesson_id}, course_id={self.course_id}, lesson_name={self.lesson_name})"