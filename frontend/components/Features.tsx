import { BookOpen, Users, Lightbulb } from "lucide-react";

const Features = () => {
  const features = [
    {
      icon: <BookOpen className="h-8 w-8 text-primary" />,
      title: "For Students",
      description: "Access high-quality courses from expert instructors. Learn at your own pace with comprehensive learning materials."
    },
    {
      icon: <Users className="h-8 w-8 text-primary" />,
      title: "For Instructors",
      description: "Create and manage your courses with our intuitive tools. Reach students globally and share your expertise."
    },
    {
      icon: <Lightbulb className="h-8 w-8 text-primary" />,
      title: "Interactive Learning",
      description: "Engage with video content, quizzes, and assignments. Track your progress and achieve your learning goals."
    }
  ];

  return (
    <section className="py-16 md:py-24 bg-background">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-12 animate-fade-in">
          Why Choose <span className="text-primary">EduForge</span>?
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div 
              key={index}
              className="feature-card glass-morphism rounded-lg p-6 animate-fade-in"
              style={{ animationDelay: `${(index + 1) * 100}ms` }}
            >
              <div className="mb-4">{feature.icon}</div>
              <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
              <p className="text-white/70">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;