#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Application entry point - Universal untuk semua use case
- Bisa digunakan dengan Gunicorn (WSGI): gunicorn -c config/gunicorn_config.py app:application
- Bisa dijalankan langsung: python app.py
"""
import os
import sys
from io import BytesIO

# Set working directory to project root
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(ROOT_DIR)

# Add modules to path
sys.path.insert(0, ROOT_DIR)

# Import server module
from modules import server

# Initialize database and preload data
server.db_init()
server.preload_from_file()


class WSGIAdapter:
    """Adapter to convert BaseHTTPRequestHandler to WSGI application"""
    
    def __init__(self, handler_class):
        self.handler_class = handler_class
    
    def __call__(self, environ, start_response):
        """WSGI application callable"""
        # Create a mock request object
        class MockRequest:
            def __init__(self, environ):
                self.environ = environ
                # Build full path with query string
                path = environ.get('PATH_INFO', '/')
                query_string = environ.get('QUERY_STRING', '')
                if query_string:
                    self.path = f"{path}?{query_string}"
                else:
                    self.path = path
                self.query_string = query_string
                self.method = environ.get('REQUEST_METHOD', 'GET')
                self.headers = {}
                # Parse headers from environ
                for key, value in environ.items():
                    if key.startswith('HTTP_'):
                        header_name = key[5:].replace('_', '-').title()
                        self.headers[header_name] = value
                # Content-Length header
                if 'CONTENT_LENGTH' in environ:
                    self.headers['Content-Length'] = environ['CONTENT_LENGTH']
                # Content-Type header
                if 'CONTENT_TYPE' in environ:
                    self.headers['Content-Type'] = environ['CONTENT_TYPE']
                # Read request body
                content_length = int(environ.get('CONTENT_LENGTH', 0))
                if content_length > 0:
                    body = environ.get('wsgi.input', BytesIO()).read(content_length)
                    self.rfile = BytesIO(body)
                else:
                    self.rfile = BytesIO()
                self.wfile = BytesIO()
        
        class MockHandler(self.handler_class):
            def __init__(self, request, client_address, server):
                self.request = request
                self.client_address = client_address
                self.server = server
                self.headers = {}
                self.response_code = 200
                self.response_message = 'OK'
                self.headers_sent = False
            
            def send_response(self, code, message=None):
                self.response_code = code
                self.response_message = message or 'OK'
            
            def send_header(self, key, value):
                self.headers[key] = value
            
            def end_headers(self):
                self.headers_sent = True
            
            def _cors(self):
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Access-Control-Allow-Headers", "Content-Type")
                self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        
        # Create mock request
        mock_request = MockRequest(environ)
        mock_handler = MockHandler(mock_request, ('127.0.0.1', 0), None)
        
        # Handle the request
        try:
            if mock_request.method == 'OPTIONS':
                mock_handler.do_OPTIONS()
            elif mock_request.method == 'GET':
                mock_handler.do_GET()
            elif mock_request.method == 'POST':
                mock_handler.do_POST()
            else:
                mock_handler.send_response(405)
                mock_handler._cors()
                mock_handler.end_headers()
        except Exception as e:
            mock_handler.send_response(500)
            mock_handler._cors()
            mock_handler.end_headers()
            mock_handler.wfile.write(f"Internal Server Error: {str(e)}".encode('utf-8'))
        
        # Get response
        response_body = mock_handler.wfile.getvalue()
        status = f"{mock_handler.response_code} {mock_handler.response_message}"
        
        # Prepare headers
        headers = list(mock_handler.headers.items())
        
        # Start response
        start_response(status, headers)
        
        return [response_body]


# Create WSGI application untuk Gunicorn
application = WSGIAdapter(server.Handler)


# Untuk direct execution (development/production)
if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    host = os.environ.get("HOST", "0.0.0.0")
    
    print(f"Server berjalan di http://{host}:{port}")
    print("Tekan Ctrl+C untuk menghentikan server")
    print("\nUntuk production dengan Gunicorn:")
    print("  gunicorn -c config/gunicorn_config.py app:application")
    
    from http.server import HTTPServer
    try:
        HTTPServer((host, port), server.Handler).serve_forever()
    except KeyboardInterrupt:
        print("\nServer dihentikan.")
