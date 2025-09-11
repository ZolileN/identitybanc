import { Shield, Lock, Server } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-card border-t border-border mt-16" data-testid="footer">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Shield className="text-primary-foreground h-4 w-4" />
              </div>
              <span className="font-bold text-foreground" data-testid="text-footer-brand">
                Identity Banc
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Secure, compliant identity verification for South Africa.
            </p>
          </div>
          
          <div>
            <h3 className="font-medium text-foreground mb-3">Legal</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-foreground" data-testid="link-privacy">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-foreground" data-testid="link-terms">Terms of Service</a></li>
              <li><a href="#" className="hover:text-foreground" data-testid="link-popia">POPIA Compliance</a></li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-medium text-foreground mb-3">Support</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-foreground" data-testid="link-help">Help Center</a></li>
              <li><a href="#" className="hover:text-foreground" data-testid="link-contact">Contact Us</a></li>
              <li><a href="#" className="hover:text-foreground" data-testid="link-api-docs">API Documentation</a></li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-medium text-foreground mb-3">Security</h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center space-x-2">
                <Lock className="text-success h-4 w-4" />
                <span data-testid="text-ssl-badge">256-bit SSL</span>
              </div>
              <div className="flex items-center space-x-2">
                <Shield className="text-success h-4 w-4" />
                <span data-testid="text-popia-badge">POPIA Certified</span>
              </div>
              <div className="flex items-center space-x-2">
                <Server className="text-success h-4 w-4" />
                <span data-testid="text-local-data-badge">Local Data Centers</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="border-t border-border mt-8 pt-6 text-center text-sm text-muted-foreground">
          <p data-testid="text-copyright">
            &copy; 2024 Identity Banc. All rights reserved. Made in South Africa 🇿🇦
          </p>
        </div>
      </div>
    </footer>
  );
}
