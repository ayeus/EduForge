import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";

const Hero = () => {
  return (
    <section className="pt-20 pb-16 md:pt-28 md:pb-24 hero-gradient">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center text-center space-y-8 max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight typing-effect mx-auto">
            Transform Your Learning Journey
          </h1>
          
          <p className="text-lg md:text-xl text-white/80 max-w-2xl mx-auto animate-fade-in animate-delay-300">
            A comprehensive learning platform connecting students with expert instructors
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 pt-4 animate-fade-in animate-delay-400">
            <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 button-glow">
              Browse Courses
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
            <Button variant="outline" size="lg" className="border-white/20 hover:bg-white/10">
              Learn More
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;