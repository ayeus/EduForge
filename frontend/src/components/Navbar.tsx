import { useState, useEffect } from 'react';
import {Button} from '@/components/ui/button';
import { LogIn, UserPlus, Menu, X } from "lucide-react";
import { Link } from "react-router-dom";

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const isScrolled = window.scrollY > 10;
      if (isScrolled !== scrolled) {
        setScrolled(isScrolled);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [scrolled]);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled ? 'glass-morphism py-2' : 'bg-transparent py-4'
    }`}>
      <div className="container mx-auto px-4 flex justify-between items-center">
        <Link to="/" className="flex items-center">
          <span className="text-2xl font-bold text-primary">EduForge</span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center space-x-6">
          <div className="flex space-x-6 mr-8">
            <Link to="/" className="text-white/90 hover:text-white transition-colors">Home</Link>
            <Link to="/about" className="text-white/90 hover:text-white transition-colors">About</Link>
            <Link to="/courses" className="text-white/90 hover:text-white transition-colors">Courses</Link>
          </div>
          <div className="flex space-x-3">
            <Button variant="outline" size="sm" className="flex items-center gap-1.5 border-white/20 hover:bg-white/10">
              <LogIn className="h-4 w-4" />
              Login
            </Button>
            <Button size="sm" className="flex items-center gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 button-glow">
              <UserPlus className="h-4 w-4" />
              Sign Up
            </Button>
          </div>
        </div>

        {/* Mobile Menu Toggle */}
        <button 
          className="md:hidden text-white focus:outline-none" 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden neo-blur py-4 px-4 animate-fade-in">
          <div className="flex flex-col space-y-4">
            <Link to="/" className="text-white/90 hover:text-white transition-colors py-2">Home</Link>
            <Link to="/about" className="text-white/90 hover:text-white transition-colors py-2">About</Link>
            <Link to="/courses" className="text-white/90 hover:text-white transition-colors py-2">Courses</Link>
            <div className="flex flex-col space-y-2 pt-2">
              <Button variant="outline" size="sm" className="flex items-center justify-center gap-1.5 border-white/20 w-full">
                <LogIn className="h-4 w-4" />
                Login
              </Button>
              <Button size="sm" className="flex items-center justify-center gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 w-full button-glow">
                <UserPlus className="h-4 w-4" />
                Sign Up
              </Button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;