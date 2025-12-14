#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Flask Application - Algoritma Dijkstra
Jalankan dengan: python app.py
"""
import os
import json
import sqlite3
from flask import Flask, render_template, send_from_directory, jsonify, request, redirect
from flask_cors import CORS

# Set working directory to project root
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(ROOT_DIR)

# Import modules
from modules.dijkstra_with_iterations import dijkstra_with_iterations
from modules.graf import build_graph_from_json

# Initialize Flask app
app = Flask(__name__, 
            template_folder='template',
            static_folder='static')
CORS(app)

# Database
DB_PATH = os.path.join(ROOT_DIR, "graf.db")

def db_init():
    """Initialize database tables"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""
        CREATE TABLE IF NOT EXISTS graphs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nama TEXT NOT NULL,
            dibuat TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)
    c.execute("""
        CREATE TABLE IF NOT EXISTS nodes (
            graph_id INTEGER,
            id TEXT,
            nama TEXT,
            x REAL,
            y REAL
        )
    """)
    c.execute("""
        CREATE TABLE IF NOT EXISTS edges (
            graph_id INTEGER,
            a TEXT,
            b TEXT,
            w REAL
        )
    """)
    conn.commit()
    conn.close()

def db_count_graphs():
    """Count total graphs in database"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    cnt = c.execute("SELECT COUNT(*) FROM graphs").fetchone()[0]
    conn.close()
    return cnt

def db_insert_graph(nama, titik, garis):
    """Insert new graph into database"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("INSERT INTO graphs(nama) VALUES (?)", (nama or "Tanpa Nama",))
    gid = c.lastrowid
    for n in titik:
        c.execute("INSERT INTO nodes(graph_id,id,nama,x,y) VALUES (?,?,?,?,?)",
                  (gid, str(n.get("id")), str(n.get("name")), float(n.get("x",0)), float(n.get("y",0))))
    for e in garis:
        c.execute("INSERT INTO edges(graph_id,a,b,w) VALUES (?,?,?,?)",
                  (gid, str(e.get("a")), str(e.get("b")), float(e.get("w",0))))
    conn.commit()
    conn.close()
    return gid

def db_daftar_graf():
    """Get list of all graphs"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    rows = c.execute("SELECT id, nama, dibuat FROM graphs ORDER BY id DESC").fetchall()
    conn.close()
    return [{"id": r[0], "nama": r[1], "dibuat": r[2]} for r in rows]

def db_muat_graf(graph_id):
    """Load graph by ID"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    nodes = c.execute("SELECT id, nama, x, y FROM nodes WHERE graph_id=?", (graph_id,)).fetchall()
    edges = c.execute("SELECT a, b, w FROM edges WHERE graph_id=?", (graph_id,)).fetchall()
    conn.close()
    titik = [{"id": r[0], "name": r[1], "x": r[2], "y": r[3]} for r in nodes]
    garis = [{"a": r[0], "b": r[1], "w": r[2]} for r in edges]
    return {"titik": titik, "garis": garis}

def db_find_graph_by_name(nama):
    """Find graph by name"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    row = c.execute("SELECT id FROM graphs WHERE nama=?", (nama,)).fetchone()
    conn.close()
    return row[0] if row else None

def preload_from_file():
    """Preload graph data from JSON file"""
    file_path = os.path.join(ROOT_DIR, "data", "list graf.json")
    try:
        data = build_graph_from_json(file_path) or {}
    except Exception:
        data = {}

    # Hanya insert saat DB masih kosong dan data JSON valid
    if db_count_graphs() == 0 and data.get("nama") and isinstance(data.get("titik"), list) and isinstance(data.get("garis"), list):
        db_insert_graph(data.get("nama"), data.get("titik", []), data.get("garis", []))

def jalankan_dijkstra(titik_ids, garis, awal_id, tujuan_id):
    """Run Dijkstra algorithm and return path, total distance, and iterations"""
    try:
        if not titik_ids or not garis or not awal_id or not tujuan_id:
            return {"path": [], "total": None, "edgePath": [], "iterations": []}
        
        result = dijkstra_with_iterations(titik_ids, garis, awal_id, tujuan_id)
        
        if not isinstance(result, dict):
            result = {"path": [], "total": None, "edgePath": [], "iterations": []}
        
        if "iterations" not in result or not isinstance(result.get("iterations"), list):
            result["iterations"] = []
        
        return result
    except Exception as e:
        return {"path": [], "total": None, "edgePath": [], "iterations": []}

# Routes
@app.route('/')
@app.route('/index.html')
@app.route('/Home.html')
def index():
    """Serve main page"""
    return render_template('Home.html')

@app.route('/Static/<path:filename>')
def static_files_legacy(filename):
    """Compat: serve static files for legacy '/Static/...' paths (case sensitive on Linux)."""
    return redirect(f"/static/{filename}", code=301)

@app.route('/desain.css')
def desain_css_root():
    """Compat: serve CSS from root path."""
    return redirect("/static/desain.css", code=301)

@app.route('/Script.js')
def script_js_root():
    """Compat: serve JS from root path."""
    return redirect("/static/Script.js", code=301)

@app.route('/gambar/<path:filename>')
def gambar(filename):
    """Serve images"""
    gambar_dir = os.path.join(app.static_folder, 'Gambar')
    return send_from_directory(gambar_dir, filename)

# API Routes
@app.route('/api/graf/daftar', methods=['GET'])
@app.route('/graf/daftar', methods=['GET'])
def api_graf_daftar():
    """Get list of all graphs"""
    return jsonify(db_daftar_graf())

@app.route('/api/graf/muat', methods=['GET'])
@app.route('/graf/muat', methods=['GET'])
def api_graf_muat():
    """Load graph by ID"""
    graph_id = request.args.get('id', type=int, default=0)
    return jsonify(db_muat_graf(graph_id))

@app.route('/api/graf/json', methods=['GET'])
@app.route('/graf/json', methods=['GET'])
def api_graf_json():
    """Load graph from JSON file"""
    file_path = os.path.join(ROOT_DIR, "data", "list graf.json")
    data = build_graph_from_json(file_path) or {}
    try:
        nama = data.get("nama")
        if nama and not db_find_graph_by_name(nama):
            db_insert_graph(nama, data.get("titik", []), data.get("garis", []))
    except Exception:
        pass
    return jsonify(data)

@app.route('/api/graf/simpan', methods=['POST'])
@app.route('/graf/simpan', methods=['POST'])
def api_graf_simpan():
    """Save new graph"""
    try:
        body = request.get_json() or {}
        nama = body.get("nama") or "Graf Kustom"
        titik = body.get("titik", [])
        garis = body.get("garis", [])
        gid = db_insert_graph(nama, titik, garis)
        return jsonify({"id": gid, "nama": nama})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/dijkstra', methods=['POST'])
@app.route('/dijkstra', methods=['POST'])
def api_dijkstra():
    """Calculate shortest path using Dijkstra algorithm"""
    try:
        body = request.get_json() or {}
        r = jalankan_dijkstra(
            body.get("titik", []),
            body.get("garis", []),
            body.get("awalId"),
            body.get("tujuanId")
        )
        
        if not isinstance(r, dict):
            r = {"path": [], "total": None, "edgePath": [], "iterations": []}
        
        iterations_list = r.get("iterations", [])
        if not isinstance(iterations_list, list):
            iterations_list = []
        
        response = {
            "path": r.get("path", []),
            "total": r.get("total"),
            "edgePath": r.get("edgePath", []),
            "iterations": iterations_list
        }
        
        return jsonify(response)
    except Exception as e:
        return jsonify({
            "path": [],
            "total": None,
            "edgePath": [],
            "iterations": [],
            "error": str(e)
        }), 500

# Initialize database and preload data
db_init()
preload_from_file()

# Main execution
if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8000"))
    host = os.environ.get("HOST", "0.0.0.0")
    
    print(f"Server berjalan di http://{host}:{port}")
    print("Tekan Ctrl+C untuk menghentikan server")
    
    app.run(host=host, port=port, debug=False)
