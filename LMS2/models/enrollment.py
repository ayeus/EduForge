class Enrollment:
    def __init__(self, enrollment_id, user_id, course_id, enrollment_date):
        self.enrollment_id = enrollment_id
        self.user_id = user_id
        self.course_id = course_id
        self.enrollment_date = enrollment_date

    def __repr__(self):
        return f"Enrollment(enrollment_id={self.enrollment_id}, user_id={self.user_id}, course_id={self.course_id}, enrollment_date={self.enrollment_date})"