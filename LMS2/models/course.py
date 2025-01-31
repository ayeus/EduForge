class Course:
    def __init__(self, course_id, course_name, description, instructor_id):
        self.course_id = course_id
        self.course_name = course_name
        self.description = description
        self.instructor_id = instructor_id

    def __repr__(self):
        return f"Course(course_id={self.course_id}, course_name={self.course_name}, instructor_id={self.instructor_id})"