#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Script untuk menjalankan server di localhost
"""
import os
import sys

# Set working directory ke root project
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(ROOT_DIR)

# Add modules to path
sys.path.insert(0, ROOT_DIR)

# Import server module
from modules import server

if __name__ == "__main__":
    # Initialize database
    server.db_init()
    server.preload_from_file()
    
    # Run server di localhost
    port = 5000
    host = "localhost"
    
    print(f"Server berjalan di http://{host}:{port}")
    print("Tekan Ctrl+C untuk menghentikan server")
    
    from http.server import HTTPServer
    try:
        HTTPServer((host, port), server.Handler).serve_forever()
    except KeyboardInterrupt:
        print("\nServer dihentikan.")

