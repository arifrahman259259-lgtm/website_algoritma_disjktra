// Mulai saat DOM siap
document.addEventListener("DOMContentLoaded", () => {
  // --- Graf Costum  ---
  // Inisialisasi elemen UI utama
  const canvas = document.getElementById("graphCanvas");
  const ctx = canvas ? canvas.getContext("2d") : null;
  const tombolTambahTitik = document.getElementById("modeAddNode");
  const tombolTambahGaris = document.getElementById("modeAddEdge");
  const tombolPilihAwal = document.getElementById("modeSelectStart");
  const tombolPilihTujuan = document.getElementById("modeSelectEnd");
  const inputJarak = document.getElementById("edgeWeightInput");
  const tombolReset = document.getElementById("resetGraph");
  const pilihAwal = document.getElementById("startNode");
  const pilihTujuan = document.getElementById("endNode");
  const tombolCariRute = document.getElementById("findPath");
  const infoRute = document.getElementById("customRouteInfo");
  const statusMode = document.getElementById("modeStatus");
  const tabelTitikBody = document.querySelector("#nodesTable tbody");
  const tabelGarisBody = document.querySelector("#edgesTable tbody");
  const selectDaftarGraf = document.getElementById("daftarGraf");
  const daftarGrafList = document.getElementById("daftarGrafList");
  const tombolMuatGraf = document.getElementById("muatGraf");
  const tombolSimpanGraf = document.getElementById("simpanGraf");
  

  

  // Status dan data graf
  let titik = [];
  let garis = [];
  let idTitikSeq = 1;
  let mode = "tambahTitik";
  let pilihGaris = { dari: null, ke: null };
  let garisRute = [];

  
// Ukuran titik pada kanvas
  const NODE_RADIUS = 8;

// Radius deteksi dasar klik node
  const DETECT_RADIUS = 24;

  // Tampilkan status mode dan highlight UI
  function updateActiveUI() {
    const mapBtn = new Map([
      ["tambahTitik", tombolTambahTitik],
      ["tambahGaris", tombolTambahGaris],
      ["pilihAwal", tombolPilihAwal],
      ["pilihTujuan", tombolPilihTujuan],
    ]);
    for (const [key, btn] of mapBtn) btn.classList.toggle("active", mode === key);
    pilihAwal.classList.toggle("active", mode === "pilihAwal");
    pilihTujuan.classList.toggle("active", mode === "pilihTujuan");
    canvas.style.cursor = (mode === "tambahTitik" || mode === "tambahGaris" || mode === "pilihAwal" || mode === "pilihTujuan") ? "crosshair" : "default";
    if (statusMode) {
      const teks = {
        tambahTitik: "Mode: Tambah Titik",
        tambahGaris: pilihGaris.dari ? "Mode: Tambah Garis (pilih titik kedua)" : "Mode: Tambah Garis",
        pilihAwal: "Mode: Pilih Titik Awal",
        pilihTujuan: "Mode: Pilih Titik Tujuan",
      };
      statusMode.textContent = teks[mode];
    }
  }
  // Set mode aktif, reset seleksi
  function setMode(m) { mode = m; pilihGaris = { dari: null, ke: null }; updateActiveUI(); draw(); }

  // Perbarui pilihan dropdown node
  function updateSelectOptions() {
    const options = titik.map(n => `<option value="${n.id}">${n.name}</option>`).join("");
    pilihAwal.innerHTML = options;
    pilihTujuan.innerHTML = options;
  }

  // Tambah node di posisi klik
  function tambahTitik(x, y) {
    let name = prompt("Nama lokasi:", `N${idTitikSeq}`);
    if (!name) name = `N${idTitikSeq}`;
    const grid = 60;
    const sx = Math.round(x/grid)*grid;
    const sy = Math.round(y/grid)*grid;
    const node = { id: String(idTitikSeq++), name, x: sx, y: sy };
    titik.push(node);
    tambahBarisTitik(node);
    updateSelectOptions();
    draw();
  }
  function tambahBarisTitik(node) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${node.name}</td><td>${Math.round(node.x)}</td><td>${Math.round(node.y)}</td>`;
    tabelTitikBody.appendChild(tr);
  }

  // Tambah sisi dengan bobot
  function tambahGaris(aId, bId, w) {
    const a = titik.find(n => n.id === aId);
    const b = titik.find(n => n.id === bId);
    if (!a || !b) return;
    if (aId === bId) return;
    const numW = Number(w);
    const edge = { a: aId, b: bId, w: Number.isFinite(numW) ? numW : 1 };
    garis.push(edge);
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${a.name}</td><td>${b.name}</td><td>${edge.w}</td>`;
    tabelGarisBody.appendChild(tr);
    autoFitKanvas();
  }

  // Konversi koordinat klik ke kanvas
  function posisiKanvas(evt) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (evt.clientX - rect.left) * scaleX;
    const y = (evt.clientY - rect.top) * scaleY;
    return { x, y };
  }

  // Cari node terdekat dari klik
  function pukulTitik(x, y) {
    let p = null, b = Infinity;
    for (const n of titik) {
      const dx = x - n.x, dy = y - n.y;
      const d = Math.sqrt(dx*dx + dy*dy);
      if (d <= DETECT_RADIUS && d < b) { p = n; b = d; }
    }
    return p;
  }

  // Gambar graf dan highlight
  function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    for (const e of garis) {
      const a = titik.find(n => n.id === e.a);
      const b = titik.find(n => n.id === e.b);
      if (!a || !b) continue;
      const inPath = garisRute.some(sp => (sp.a === e.a && sp.b === e.b) || (sp.a === e.b && sp.b === e.a));
      ctx.strokeStyle = inPath ? "#2575fc" : "#94a3b8";
      ctx.lineWidth = inPath ? 4 : 3;
      ctx.shadowColor = inPath ? "#a5b4fc" : "#cbd5e1"; ctx.shadowBlur = inPath ? 6 : 2;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const text = `${e.w} m`;
      ctx.font = "12px Poppins";
      const tw = ctx.measureText(text).width + 8;
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.fillRect(mx - tw/2, my - 11, tw, 16);
      ctx.fillStyle = inPath ? "#1e3a8a" : "#334155";
      ctx.fillText(text, mx - tw/2 + 4, my);
    }
    ctx.shadowBlur = 0;
    for (const n of titik) {
      ctx.fillStyle = "#6a00f4";
      ctx.beginPath(); ctx.arc(n.x, n.y, NODE_RADIUS, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = "#1e293b"; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = "#0f172a"; ctx.font = "12px Poppins"; ctx.fillText(n.name, n.x + 10, n.y - 10);
    }
    const ring = (n, c) => { ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(n.x, n.y, 12, 0, Math.PI*2); ctx.stroke(); };
    if (pilihGaris.dari) { const n = titik.find(x => x.id === pilihGaris.dari); if (n) ring(n, "#6366f1"); }
    if (pilihAwal.value) { const n = titik.find(x => x.id === pilihAwal.value); if (n) ring(n, "#22c55e"); }
    if (pilihTujuan.value) { const n = titik.find(x => x.id === pilihTujuan.value); if (n) ring(n, "#ef4444"); }
  }

  // Sesuaikan ukuran kanvas dengan container
  function sesuaikanKanvas() {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width));
    canvas.height = 520;
    draw();
  }

  // Simpan koordinat asli untuk transformasi
  let originalCoords = new Map();
  
  function saveOriginalCoords() {
    originalCoords.clear();
    for (const n of titik) {
      originalCoords.set(n.id, { x: n.x, y: n.y });
    }
  }
  
  function restoreOriginalCoords() {
    for (const n of titik) {
      const orig = originalCoords.get(n.id);
      if (orig) {
        n.x = orig.x;
        n.y = orig.y;
      }
    }
  }
  
  function autoFitKanvas() {
    if (!canvas) return;
    if (!titik.length) { sesuaikanKanvas(); return; }
    
    // Restore koordinat asli sebelum transformasi
    if (originalCoords.size > 0) {
      restoreOriginalCoords();
    }
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of titik) { if (n.x < minX) minX = n.x; if (n.y < minY) minY = n.y; if (n.x > maxX) maxX = n.x; if (n.y > maxY) maxY = n.y; }
    const margin = 40;
    const neededW = Math.ceil((maxX - minX) + margin * 2);
    const neededH = Math.ceil((maxY - minY) + margin * 2);
    const rect = canvas.getBoundingClientRect();
    const baseW = Math.max(Math.floor(rect.width), neededW);
    const baseH = Math.max(520, neededH);
    const dx = margin - minX;
    const dy = margin - minY;
    // Transformasi koordinat untuk tampilan
    for (const n of titik) { 
      n.x += dx; 
      n.y += dy;
    }
    canvas.width = baseW;
    canvas.height = baseH;
    draw();
  }

  

  async function cariRuteTerpendek(awalId, tujuanId) {
    const payload = {
      titik: titik.map(n => n.id),
      garis: garis.map(e => ({ a: e.a, b: e.b, w: e.w })),
      awalId,
      tujuanId
    };
    try {
      const res = await fetch("/api/dijkstra", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        return data;
      }
      return { path: [], total: null, edgePath: [] };
    } catch (_) {
      return { path: [], total: null, edgePath: [] };
    }
  }

  async function muatDaftarGraf() {
    const res = await fetch("/api/graf/daftar");
    const daftar = res.ok ? await res.json() : [];
    selectDaftarGraf.innerHTML = daftar.map(d => `<option value="${d.id}">${d.nama} (${d.dibuat})</option>`).join("");
    daftarGrafList.innerHTML = daftar.map(d => `<div data-id="${d.id}">#${d.id} - ${d.nama} <small>${d.dibuat}</small></div>`).join("");
    daftarGrafList.querySelectorAll('[data-id]').forEach(el => {
      el.addEventListener('click', async () => { selectDaftarGraf.value = el.getAttribute('data-id'); await muatGrafTerpilih(); });
    });
    if (daftar.length) {
      selectDaftarGraf.value = String(daftar[0].id);
      await muatGrafTerpilih();
    } else {
      const r2 = await fetch("/api/graf/json");
      if (r2.ok) {
        await muatDaftarGraf();
      }
    }
  }
  async function muatGrafTerpilih() {
    const id = selectDaftarGraf.value;
    if (!id) return;
    const res = await fetch(`/api/graf/muat?id=${encodeURIComponent(id)}`);
    if (!res.ok) return;
    const data = await res.json();
    titik = data.titik || [];
    garis = data.garis || [];
    
    // Reset koordinat asli
    originalCoords.clear();
    
    // Jangan ubah koordinat jika sudah ada dari koordinat_peta.json
    // Koordinat sudah diatur oleh server berdasarkan koordinat_peta.json
    // Hanya ubah jika semua node tidak punya koordinat yang valid
    const hasValidCoords = titik.every(n => n.x !== undefined && n.y !== undefined && n.x !== null && n.y !== null);
    if (titik.length && !hasValidCoords) {
      const rect = canvas.getBoundingClientRect();
      const cx = Math.max(220, Math.floor(rect.width/2));
      const cy = 260;
      const r = Math.max(140, Math.min(cx, cy) - 60) + Math.max(0, Math.floor(titik.length*2));
      const step = (Math.PI*2) / titik.length;
      for (let i = 0; i < titik.length; i++) {
        const ang = i * step;
        titik[i].x = cx + Math.cos(ang) * r;
        titik[i].y = cy + Math.sin(ang) * r;
      }
    }
    
    // Simpan koordinat asli setelah memuat
    saveOriginalCoords();
    
    const nextNum = Math.max(0, ...titik.map(n => {
      const m = String(n.id).match(/\d+/);
      return m ? parseInt(m[0], 10) : 0;
    })) + 1;
    idTitikSeq = Number.isFinite(nextNum) ? nextNum : (titik.length + 1);
    tabelTitikBody.innerHTML = "";
    tabelGarisBody.innerHTML = "";
    const idNum = (s) => { const m = String(s).match(/\d+/); return m ? parseInt(m[0],10) : 0; };
    [...titik].sort((a,b)=>idNum(a.id)-idNum(b.id)).forEach(n=>tambahBarisTitik(n));
    for (const e of garis) {
      const a = titik.find(t => t.id === e.a); const b = titik.find(t => t.id === e.b);
      const tr = document.createElement("tr"); tr.innerHTML = `<td>${a?a.name:e.a}</td><td>${b?b.name:e.b}</td><td>${e.w}</td>`;
      tabelGarisBody.appendChild(tr);
    }
    updateSelectOptions();
    autoFitKanvas();
    if (titik.length) {
      const sortedIds = [...titik].sort((a,b)=>idNum(a.id)-idNum(b.id)).map(n=>n.id);
      pilihAwal.value = sortedIds[0];
      pilihTujuan.value = sortedIds[sortedIds.length - 1];
    }
    draw();
  }


  if (canvas && ctx) {
    window.addEventListener("resize", sesuaikanKanvas);
    sesuaikanKanvas();

    // Klik kanvas jalankan mode
    canvas.addEventListener("click", (evt) => {
      const { x, y } = posisiKanvas(evt);
      if (mode === "tambahTitik") {
        tambahTitik(x, y);
      } else if (mode === "tambahGaris") {
        const n = pukulTitik(x, y);
        if (!n) return;
      if (!pilihGaris.dari) {
        pilihGaris.dari = n.id; updateActiveUI();
      } else if (!pilihGaris.ke) {
        pilihGaris.ke = n.id;
        const w = inputJarak.value || prompt("Jarak (m):", "1");
        tambahGaris(pilihGaris.dari, pilihGaris.ke, w);
        pilihGaris = { dari: null, ke: null }; updateActiveUI();
      }
      } else if (mode === "pilihAwal") {
        const n = pukulTitik(x, y); if (!n) return; pilihAwal.value = n.id;
      } else if (mode === "pilihTujuan") {
        const n = pukulTitik(x, y); if (!n) return; pilihTujuan.value = n.id;
      }
    });

    // Fitur: Mengatur Mode Operasi
    // Tombol mode dan reset graf
    tombolTambahTitik.addEventListener("click", () => setMode("tambahTitik"));
    tombolTambahGaris.addEventListener("click", () => setMode("tambahGaris"));
    tombolPilihAwal.addEventListener("click", () => setMode("pilihAwal"));
    tombolPilihTujuan.addEventListener("click", () => setMode("pilihTujuan"));
    tombolReset.addEventListener("click", () => {
      titik = []; garis = []; idTitikSeq = 1; garisRute = []; 
      tabelTitikBody.innerHTML = ""; tabelGarisBody.innerHTML = "";
      updateSelectOptions(); draw();
    });

    // Hitung rute terpendek
    tombolCariRute.addEventListener("click", async () => {
      const s = pilihAwal.value; const t = pilihTujuan.value;
      if (!s || !t) { alert("Pilih awal dan tujuan"); return; }
      const res = await cariRuteTerpendek(s, t);
      garisRute = (res && res.edgePath) ? res.edgePath : [];
      const names = ((res && res.path) ? res.path : []).map(id => {
        const n = titik.find(x => x.id === id);
        return n ? n.name : id;
      });
      infoRute.innerHTML = (res && res.total != null)
        ? `<strong>Jarak:</strong> ${res.total} m | <strong>Rute:</strong> ${names.join(" → ")}`
        : "Rute tidak ditemukan";
      draw();
    });

    
    // Sinkronisasi dropdown dengan kanvas
    pilihAwal.addEventListener("change", () => { if (mode === "pilihAwal") updateActiveUI(); draw(); });
    pilihTujuan.addEventListener("change", () => { if (mode === "pilihTujuan") updateActiveUI(); draw(); });
    if (tombolMuatGraf) tombolMuatGraf.addEventListener("click", muatGrafTerpilih);
    if (selectDaftarGraf) selectDaftarGraf.addEventListener("change", muatGrafTerpilih);
    if (tombolSimpanGraf) tombolSimpanGraf.addEventListener("click", async () => {
      const nama = prompt("Nama graf:", "Graf Kustom");
      const payload = { nama, titik, garis };
      try {
        const res = await fetch("/api/graf/simpan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          await muatDaftarGraf();
          alert("Graf tersimpan");
        } else {
          alert("Gagal menyimpan graf");
        }
      } catch (_) {
        alert("Gagal menyimpan graf");
      }
    });
    
    muatDaftarGraf();
  }
  // Inisialisasi tampilan awal UI
  updateActiveUI();
  
});
