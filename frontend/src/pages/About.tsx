import { useEffect } from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

const About = () => {
  useEffect(() => {
    // Scroll to top when component mounts
    window.scrollTo(0, 0);
  }, []);
  
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-grow pt-24 pb-16">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl font-bold mb-8 text-center animate-fade-in">About EduForge</h1>
          
          <div className="max-w-3xl mx-auto glass-morphism rounded-lg p-8 animate-fade-in animate-delay-100">
            <p className="mb-4 text-white/80">
              EduForge is a personalized learning management system designed to transform the educational experience 
              for both students and instructors. Our platform brings together cutting-edge technology and 
              pedagogical best practices to create a seamless, engaging learning environment.
            </p>
            <p className="mb-4 text-white/80">
              Founded with the mission to make high-quality education accessible to everyone, 
              EduForge provides intuitive tools for course creation, interactive learning experiences, 
              and comprehensive progress tracking.
            </p>
            <p className="text-white/80">
              Whether you're a student looking to expand your knowledge or an instructor wanting to share your 
              expertise, EduForge offers the features and support you need to succeed in your educational journey.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default About;