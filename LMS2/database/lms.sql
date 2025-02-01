-- Create the database
CREATE DATABASE IF NOT EXISTS lms;
USE lms;

-- Table: Users
CREATE TABLE IF NOT EXISTS Users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('student', 'instructor', 'admin') NOT NULL
);

-- Table: Courses
CREATE TABLE IF NOT EXISTS Courses (
    course_id INT AUTO_INCREMENT PRIMARY KEY,
    course_name VARCHAR(100) NOT NULL,
    description TEXT,
    instructor_id INT,
    FOREIGN KEY (instructor_id) REFERENCES Users(user_id)
);

-- Table: Lessons
CREATE TABLE IF NOT EXISTS Lessons (
    lesson_id INT AUTO_INCREMENT PRIMARY KEY,
    course_id INT,
    lesson_name VARCHAR(100) NOT NULL,
    content TEXT,
    FOREIGN KEY (course_id) REFERENCES Courses(course_id)
);

-- Table: Enrollments
CREATE TABLE IF NOT EXISTS Enrollments (
    enrollment_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    course_id INT,
    enrollment_date  DATE,
    FOREIGN KEY (user_id) REFERENCES Users(user_id),
    FOREIGN KEY (course_id) REFERENCES Courses(course_id)
);

-- Table: UserProgress
CREATE TABLE IF NOT EXISTS UserProgress (
    progress_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    course_id INT,
    lesson_id INT,
    completed BOOLEAN DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES Users(user_id),
    FOREIGN KEY (course_id) REFERENCES Courses(course_id),
    FOREIGN KEY (lesson_id) REFERENCES Lessons(lesson_id)
); 

ALTER TABLE Lessons ADD COLUMN video LONGBLOB;
ALTER TABLE Lessons ADD COLUMN video_filename VARCHAR(255);