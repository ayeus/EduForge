import { Mail, Phone, MapPin } from "lucide-react";
import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="bg-black/50 pt-12 pb-6">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          <div>
            <h3 className="text-xl font-bold text-primary mb-4">EduForge</h3>
            <p className="text-white/70 mb-4">Transforming education through interactive learning experiences.</p>
          </div>
          
          <div>
            <h4 className="text-lg font-semibold mb-4">Quick Links</h4>
            <ul className="space-y-2">
              <li><Link to="/" className="text-white/70 hover:text-white transition-colors">Home</Link></li>
              <li><Link to="/about" className="text-white/70 hover:text-white transition-colors">About</Link></li>
              <li><Link to="/courses" className="text-white/70 hover:text-white transition-colors">Courses</Link></li>
              <li><Link to="/login" className="text-white/70 hover:text-white transition-colors">Login</Link></li>
              <li><Link to="/register" className="text-white/70 hover:text-white transition-colors">Sign Up</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="text-lg font-semibold mb-4">Popular Categories</h4>
            <ul className="space-y-2">
              <li><Link to="/category/web-development" className="text-white/70 hover:text-white transition-colors">Web Development</Link></li>
              <li><Link to="/category/data-science" className="text-white/70 hover:text-white transition-colors">Data Science</Link></li>
              <li><Link to="/category/mobile-apps" className="text-white/70 hover:text-white transition-colors">Mobile Apps</Link></li>
              <li><Link to="/category/design" className="text-white/70 hover:text-white transition-colors">UI/UX Design</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="text-lg font-semibold mb-4">Contact</h4>
            <ul className="space-y-3">
              <li className="flex items-center gap-2 text-white/70">
                <Mail className="h-4 w-4 text-primary" />
                <span>aayushnamdeo962@gmail.com</span>
              </li>
              <li className="flex items-center gap-2 text-white/70">
                <Phone className="h-4 w-4 text-primary" />
                <span>+91 8329887767</span>
              </li>
              <li className="flex items-center gap-2 text-white/70">
                <MapPin className="h-4 w-4 text-primary" />
                <span>Mumbai, India</span>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-white/10 pt-6 text-center text-white/60 text-sm">
          <p>&copy; 2024 EduForge. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;