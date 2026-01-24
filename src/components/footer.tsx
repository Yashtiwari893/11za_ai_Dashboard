export default function Footer() {
  return (
    <footer className="bg-[#0D163F] dark:bg-[#0D163F] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <img
                src="https://11za.com/wp-content/themes/one-1za/assets/images/logo/11za_logo.svg"
                alt="11za AI"
                className="h-8 w-auto"
              />
            </div>
            <p className="text-gray-300 text-sm">
              Intelligent Conversational AI Platform for Business Communication
            </p>
            <div className="flex space-x-4">
              <a href="https://www.linkedin.com/company/11za" className="text-gray-400 hover:text-[#09AF72] transition-colors">
                <span className="sr-only">LinkedIn</span>
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
              </a>
              <a href="https://twitter.com/11zaofficial" className="text-gray-400 hover:text-[#09AF72] transition-colors">
                <span className="sr-only">Twitter</span>
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                </svg>
              </a>
              <a href="https://www.instagram.com/11zaofficial" className="text-gray-400 hover:text-[#09AF72] transition-colors">
                <span className="sr-only">Instagram</span>
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12.017 0C8.396 0 7.996.014 6.79.067 5.584.12 4.775.302 4.084.588c-.693.288-1.279.67-1.864 1.255C1.635 2.428 1.253 3.014.965 3.707c-.288.691-.47 1.5-.523 2.706C.386 7.616.372 8.016.372 11.637c0 3.621.014 4.021.067 5.227.053 1.206.235 2.015.523 2.706.288.693.67 1.279 1.255 1.864.585.585 1.171.967 1.864 1.255.691.288 1.5.47 2.706.523C7.616 23.614 8.016 23.628 11.637 23.628c3.621 0 4.021-.014 5.227-.067 1.206-.053 2.015-.235 2.706-.523.693-.288 1.279-.67 1.864-1.255.585-.585.967-1.171 1.255-1.864.288-.691.47-1.5.523-2.706.067-1.206.081-1.606.081-5.227 0-3.621-.014-4.021-.067-5.227-.053-1.206-.235-2.015-.523-2.706-.288-.693-.67-1.279-1.255-1.864C20.572 1.635 19.986 1.253 19.293.965c-.691-.288-1.5-.47-2.706-.523C15.638.386 15.238.372 11.617.372 8.016.372 7.616.386 6.41.439c-1.206.053-2.015.235-2.706.523-.693.288-1.279.67-1.864 1.255C2.285 2.428 1.903 3.014 1.615 3.707c-.288.691-.47 1.5-.523 2.706C1.099 7.616 1.085 8.016 1.085 11.637c0 3.621.014 4.021.067 5.227.053 1.206.235 2.015.523 2.706.288.693.67 1.279 1.255 1.864.585.585 1.171.967 1.864 1.255.691.288 1.5.47 2.706.523 1.206.067 1.606.081 5.227.081 3.621 0 4.021-.014 5.227-.067 1.206-.053 2.015-.235 2.706-.523.693-.288 1.279-.67 1.864-1.255.585-.585.967-1.171 1.255-1.864.288-.691.47-1.5.523-2.706.067-1.206.081-1.606.081-5.227 0-3.621-.014-4.021-.067-5.227-.053-1.206-.235-2.015-.523-2.706-.288-.693-.67-1.279-1.255-1.864C21.715 1.635 22.097 1.253 22.385.965c.691-.288 1.5-.47 2.706-.523C16.384.386 16.784.372 20.405.372c3.621 0 4.021.014 5.227.067 1.206.053 2.015.235 2.706.523.693.288 1.279.67 1.864 1.255.585.585 1.171.967 1.864 1.255.288.691.47 1.5.523 2.706.067 1.206.081 1.606.081 5.227 0 3.621-.014 4.021-.067 5.227-.053 1.206-.235 2.015-.523 2.706-.288.693-.67 1.279-1.255 1.864-.585.585-1.171.967-1.864 1.255-.691.288-1.5.47-2.706.523-1.206.067-1.606.081-5.227.081-3.621 0-4.021-.014-5.227-.067-1.206-.053-2.015-.235-2.706-.523-.693-.288-1.279-.67-1.864-1.255C3.428 20.572 3.046 19.986 2.758 19.293c-.691-.288-1.5-.47-2.706-.523C5.616.386 5.216.372 1.595.372 0 0 0 0 0 0z"/>
                </svg>
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li><a href="/dashboard" className="text-gray-300 hover:text-[#09AF72] transition-colors text-sm">Dashboard</a></li>
              <li><a href="/chat" className="text-gray-300 hover:text-[#09AF72] transition-colors text-sm">AI Chatbot</a></li>
              <li><a href="/files" className="text-gray-300 hover:text-[#09AF72] transition-colors text-sm">Knowledge Base</a></li>
              <li><a href="/settings" className="text-gray-300 hover:text-[#09AF72] transition-colors text-sm">Settings</a></li>
            </ul>
          </div>

          {/* Services */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Services</h3>
            <ul className="space-y-2">
              <li><a href="/shopify" className="text-gray-300 hover:text-[#09AF72] transition-colors text-sm">Shopify Integration</a></li>
              <li><span className="text-gray-300 text-sm">WhatsApp Business API</span></li>
              <li><span className="text-gray-300 text-sm">Voice Processing</span></li>
              <li><span className="text-gray-300 text-sm">Multi-language Support</span></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Contact</h3>
            <div className="space-y-2 text-sm text-gray-300">
              <p>📞 (+91) 97266 54060</p>
              <p>✉️ hello@11za.com</p>
              <p>🕒 Mon - Sat | 10am - 7pm</p>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-700 mt-8 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-400 text-sm">
              © 2026 11za Communications. All rights reserved.
            </p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <a href="#" className="text-gray-400 hover:text-[#09AF72] text-sm transition-colors">Privacy Policy</a>
              <a href="#" className="text-gray-400 hover:text-[#09AF72] text-sm transition-colors">Terms of Service</a>
              <a href="#" className="text-gray-400 hover:text-[#09AF72] text-sm transition-colors">Support</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}