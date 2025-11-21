// =========================================================
// FILE: laporan.js (FULL VERSION)
// Fitur: Filter, Realtime, Grafik, Peta, Export PDF/Excel
// =========================================================

let allReports = [];       // Data mentah dari database
let currentFilteredData = []; // Data yang sedang aktif (hasil filter tanggal)

// Expose fungsi agar bisa dipanggil dari HTML/Console jika perlu
window.renderReportList = renderReportList;
window.updateStatistics = updateStatistics;
window.fillDataTable = fillDataTable;
window.addLocalReport = addLocalReport;
window.updateLocalReport = updateLocalReport;

// ==========================================
// 1. HELPER: AMBIL TANGGAL DARI ID MONGODB
// ==========================================
function getDateFromId(hexId) {
    try {
        const timestamp = parseInt(hexId.substring(0, 8), 16) * 1000;
        return new Date(timestamp);
    } catch (e) {
        return new Date(); 
    }
}

// ==========================================
// 2. FETCH DATA API (LOAD AWAL)
// ==========================================
async function fetchAllReports() {
  try {
    document.getElementById("infoText").innerText = "Sedang memuat data...";
    const response = await fetch('/api/laporan'); 
    if (!response.ok) throw new Error("Gagal mengambil data");
    
    allReports = await response.json(); 
    
    // Jalankan filter default (biasanya 7 hari terakhir)
    applyFilters();
    
  } catch (err) {
    console.error(err);
    document.getElementById("infoText").innerText = "Error: " + err.message;
  }
}

// ==========================================
// 3. LOGIKA FILTER UTAMA (PERIODE + STATUS)
// ==========================================
function applyFilters() {
    // A. Ambil Periode Waktu (Hari) dari tombol
    const activeBtn = document.querySelector('.filter-btn.active');
    const days = activeBtn ? parseInt(activeBtn.dataset.period) : 7; 

    // B. Ambil Status dari Dropdown (Tab Daftar Laporan)
    const statusDropdown = document.getElementById("statusFilter");
    const selectedStatus = statusDropdown ? statusDropdown.value : "Semua";

    // C. Hitung Tanggal Batas (Cutoff)
    const now = new Date();
    const cutoffDate = new Date();
    cutoffDate.setDate(now.getDate() - days);

    // D. Lakukan Filtering
    // 1. Filter Tanggal (Untuk Statistik Global)
    currentFilteredData = allReports.filter(report => {
        const reportDate = getDateFromId(report._id);
        return reportDate >= cutoffDate;
    });

    // 2. Filter Tambahan Status (Khusus List Laporan Tab 1)
    const listData = currentFilteredData.filter(r => 
        selectedStatus === "Semua" || r.status === selectedStatus
    );

    // E. Render Semua Komponen
    // Kirim 'days' agar grafik tahu harus tampil Harian atau Bulanan
    renderAll(currentFilteredData, listData, days);
}

// ==========================================
// 4. RENDER SEMUA KOMPONEN
// ==========================================
function renderAll(statData, listData, days) {
  renderReportList(listData);       // Tab 1: List Kartu (Kena filter status)
  updateStatistics(statData);       // Tab 2: Kartu Angka
  renderCharts(allReports, days);   // Tab 2: Grafik Tren (Pakai allReports agar tren terlihat utuh)
  renderHeatList(statData);         // Tab 2: Peta Area
  
  // Tab 2: Tabel (Punya filter dropdown sendiri, jadi panggil ini)
  fillDataTable(statData); 
  
  const infoText = document.getElementById("infoText");
  if(infoText) infoText.innerText = `Menampilkan ${listData.length} laporan`;
}

function getStatusBadgeClass(status) {
  if(status === "Aktif") return "status-badge red";
  if(status === "Sedang Ditangani") return "status-badge yellow";
  if(status === "Selesai") return "status-badge green";
  return "status-badge";
}

// --- A. RENDER LIST LAPORAN (TAB 1) ---
function renderReportList(data) {
  const container = document.getElementById("reportList");
  if(!container) return;
  
  container.innerHTML = "";
  if(data.length === 0) {
    container.innerHTML = "<p style='text-align:center; padding:20px; color:#888;'>Tidak ada laporan.</p>";
    return;
  }

  data.forEach(d => {
    const item = document.createElement("div");
    item.className = "report-item";
    item.style.animation = "fadeIn 0.5s ease";
    item.innerHTML = `
      <div class="report-header">
        <h2>${d.lokasi}</h2>
        <span class="${getStatusBadgeClass(d.status)}">${d.status}</span>
      </div>
      <p>${d.catatan || "Tidak ada keterangan."}</p>
      <div class="report-footer">
        <span>🕓 ${d.waktu}</span>
        <button class="detail-btn" onclick="window.location.href='detail-laporan.html?id=${d._id}'">Detail</button>
      </div>
    `;
    container.appendChild(item);
  });
}

// --- B. UPDATE KARTU STATISTIK ---
function updateStatistics(data) {
  const elTotal = document.getElementById("statTotal");
  if(elTotal) {
    elTotal.innerText = data.length;
    document.getElementById("statActive").innerText = data.filter(r => r.status === "Aktif").length;
    document.getElementById("statHandling").innerText = data.filter(r => r.status === "Sedang Ditangani").length;
  }
}

// --- C. RENDER TABEL (DENGAN FILTER DROPDOWN SENDIRI) ---
function fillDataTable(data) {
  const tbody = document.querySelector("#dataTable tbody");
  if (!tbody) return;
  
  tbody.innerHTML = "";

  // 1. Cek Filter Dropdown di Header Tabel
  const tableFilter = document.getElementById("statTableFilter");
  const filterValue = tableFilter ? tableFilter.value : "Semua";

  // 2. Saring data berdasarkan dropdown tersebut
  const tableData = data.filter(d => 
      filterValue === "Semua" || d.status === filterValue
  );

  if(tableData.length === 0) {
      tbody.innerHTML = "<tr><td colspan='4' style='text-align:center; padding:15px; color:#777;'>Data Kosong</td></tr>";
      return;
  }

  // 3. Render Baris Tabel (Max 50 baris)
  tableData.slice(0, 50).forEach((d, i) => {
    const tr = document.createElement("tr");
    tr.style.cursor = "pointer"; 
    tr.onclick = () => window.location.href = `detail-laporan.html?id=${d._id}`;
    
    const dateObj = getDateFromId(d._id);
    const dateStr = dateObj.toLocaleDateString('id-ID', {day: 'numeric', month: 'short'});

    tr.innerHTML = `
        <td>${i+1}</td>
        <td>${d.lokasi}</td>
        <td><span class="${getStatusBadgeClass(d.status)}">${d.status}</span></td>
        <td>${dateStr} ${d.waktu}</td>
    `;
    tbody.appendChild(tr);
  });
}

// --- D. GRAFIK BATANG DINAMIS ---
function renderCharts(rawData, days) {
  const container = document.getElementById("monthlyBars");
  if (!container) return;
  container.innerHTML = ""; 

  let labels = [];
  let counts = [];
  const now = new Date();

  // MODE 1: HARIAN (<= 30 Hari)
  if (days <= 30) {
      for (let i = 0; i < days; i++) {
          const d = new Date();
          d.setDate(now.getDate() - i);
          
          const label = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
          labels.unshift(label); 

          // Hitung data pada tanggal tersebut
          const count = rawData.filter(r => {
              const rDate = getDateFromId(r._id);
              return rDate.getDate() === d.getDate() && 
                     rDate.getMonth() === d.getMonth() && 
                     rDate.getFullYear() === d.getFullYear();
          }).length;
          counts.unshift(count);
      }
  } 
  // MODE 2: BULANAN (> 30 Hari)
  else {
      const monthsToShow = (days === 90) ? 3 : 12; 
      for (let i = 0; i < monthsToShow; i++) {
          const d = new Date();
          d.setMonth(now.getMonth() - i);
          
          const label = d.toLocaleDateString('id-ID', { month: 'short' });
          labels.unshift(label);

          const count = rawData.filter(r => {
              const rDate = getDateFromId(r._id);
              return rDate.getMonth() === d.getMonth() && 
                     rDate.getFullYear() === d.getFullYear();
          }).length;
          counts.unshift(count);
      }
  }

  // Render Bar HTML
  const maxVal = Math.max(...counts, 1);
  
  labels.forEach((label, index) => {
      const value = counts[index];
      const percentage = (value / maxVal) * 100;
      
      const row = document.createElement("div");
      row.className = "month-row";
      row.innerHTML = `
        <span class="month-label" style="width:60px;">${label}</span>
        <div class="bar-wrap">
            <div class="bar-fill" style="width: 0%; transition: width 1s ease;"></div>
        </div>
        <span class="bar-value">${value}</span>
      `;
      container.appendChild(row);

      // Animasi
      setTimeout(() => {
          row.querySelector('.bar-fill').style.width = `${percentage}%`;
      }, 100);
  });
}

// --- E. PETA PANAS KECAMATAN (SEMARANG) ---
function renderHeatList(data) {
  const container = document.getElementById("heatList");
  if(!container) return;
  container.innerHTML = "";

  const kecamatanSemarang = [
      "Banyumanik", "Candisari", "Gajahmungkur", "Gayamsari",
      "Genuk", "Gunungpati", "Mijen", "Ngaliyan",
      "Pedurungan", "Semarang Barat", "Semarang Selatan", "Semarang Tengah",
      "Semarang Timur", "Semarang Utara", "Tembalang", "Tugu"
  ];

  let districtCounts = {};
  kecamatanSemarang.forEach(kec => districtCounts[kec] = 0);

  data.forEach(report => {
      let textLokasi = report.lokasi ? report.lokasi.toLowerCase() : "";
      for (let kec of kecamatanSemarang) {
          if (textLokasi.includes(kec.toLowerCase())) {
              districtCounts[kec]++;
              break; 
          }
      }
  });

  const sortedDistricts = Object.keys(districtCounts)
      .map(key => ({ name: key, count: districtCounts[key] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

  let hasData = false;
  sortedDistricts.forEach(area => {
      if (area.count > 0) {
          hasData = true;
          let colorClass = area.count >= 5 ? 'red' : (area.count >= 3 ? 'orange' : 'green');
          const div = document.createElement("div");
          div.className = "area-item";
          div.innerHTML = `
            <span style="font-weight:600;"><i class="fa-solid fa-map-pin ${colorClass}" style="font-size:0.8rem; margin-right:8px;"></i> Kec. ${area.name}</span>
            <span style="font-size:0.85rem; font-weight:600;">${area.count} Kasus</span>
          `;
          container.appendChild(div);
      }
  });

  if (!hasData) {
      container.innerHTML = `<div style="text-align:center; padding:15px; color:#777; font-size:0.85rem;"><i class="fa-solid fa-circle-info"></i><br>Belum ada data per kecamatan.<br><small>(Pastikan alamat mengandung nama kecamatan)</small></div>`;
  }
}

// ==========================================
// 5. FITUR EXPORT (PDF & EXCEL)
// ==========================================

// --- EXPORT PDF ---
async function exportToPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("Laporan Kebakaran SIPADAM", 14, 22);
    doc.setFontSize(11);
    doc.text(`Periode Cetak: ${new Date().toLocaleString('id-ID')}`, 14, 30);

    const tableRows = currentFilteredData.map((item, index) => {
        const dateObj = getDateFromId(item._id);
        const dateStr = dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
        return [
            index + 1,
            item.lokasi,
            item.status,
            `${dateStr} - ${item.waktu}`,
            item.tipeLaporan || 'Warga'
        ];
    });

    doc.autoTable({
        head: [['No', 'Lokasi Kejadian', 'Status', 'Waktu Laporan', 'Sumber']],
        body: tableRows,
        startY: 40,
        theme: 'grid',
        headStyles: { fillColor: [229, 57, 53] },
        styles: { fontSize: 9 }
    });

    doc.save('Laporan_SIPADAM.pdf');
}

// --- EXPORT EXCEL (REVISI RAPI INDONESIA) ---
function exportToExcel() {
    // 1. Tambahkan \uFEFF (BOM) agar Excel mengenali encoding teks dengan benar
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    
    // 2. Gunakan TITIK KOMA (;) sebagai pemisah Header
    csvContent += "No;Lokasi Kejadian;Status;Waktu;Sumber\n";

    currentFilteredData.forEach((item, index) => {
        const dateObj = getDateFromId(item._id);
        const dateStr = dateObj.toLocaleDateString('id-ID');
        
        // Bersihkan jika ada titik koma di dalam teks lokasi agar format tidak rusak
        // Kita juga ganti koma dengan spasi biar aman
        const cleanLokasi = item.lokasi.replace(/;/g, " ").replace(/,/g, " "); 
        
        const row = [
            index + 1,
            cleanLokasi,
            item.status,
            `${dateStr} ${item.waktu}`,
            item.tipeLaporan || 'Warga'
        ];
        
        // 3. Gabungkan data dengan TITIK KOMA (;)
        csvContent += row.join(";") + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "Laporan_SIPADAM_Rapih.csv");
    document.body.appendChild(link);
    link.click();
    link.remove();
}
// ==========================================
// 6. UPDATE REALTIME
// ==========================================
function addLocalReport(laporanBaru) {
    allReports.unshift(laporanBaru);
    applyFilters(); 
}

function updateLocalReport(laporanUpdate) {
    const index = allReports.findIndex(r => r._id === laporanUpdate._id);
    if (index !== -1) {
        allReports[index] = laporanUpdate;
        applyFilters(); 
    }
}

// ==========================================
// 7. EVENT LISTENERS
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  
  // A. Filter Periode
  const filterBtns = document.querySelectorAll('.filter-btn');
  filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
          filterBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          applyFilters(); 
      });
  });

  // B. Dropdown Status (Tab 1)
  const mainStatusDropdown = document.getElementById("statusFilter");
  if (mainStatusDropdown) {
      mainStatusDropdown.addEventListener('change', () => {
          applyFilters();
      });
  }

  // C. Dropdown Status (Tab 2 - Tabel Statistik)
  const tableStatusDropdown = document.getElementById("statTableFilter");
  if (tableStatusDropdown) {
      tableStatusDropdown.addEventListener('change', () => {
          fillDataTable(currentFilteredData);
      });
  }

  // D. Tombol Export
  const btnPdf = document.getElementById("btnExportPdf");
  if (btnPdf) btnPdf.addEventListener("click", exportToPDF);

  const btnExcel = document.getElementById("btnExportExcel");
  if (btnExcel) btnExcel.addEventListener("click", exportToExcel);

  // E. Tab Menu
  const tabLaporan = document.getElementById("tab-laporan");
  const tabStatistik = document.getElementById("tab-statistik");
  const pageLaporan = document.getElementById("page-laporan");
  const pageStatistik = document.getElementById("page-statistik");

  if(tabLaporan && tabStatistik) {
      tabLaporan.addEventListener("click", () => {
        tabLaporan.classList.add("active");
        tabStatistik.classList.remove("active");
        pageLaporan.style.display = "block";
        pageStatistik.style.display = "none";
      });

      tabStatistik.addEventListener("click", () => {
        tabStatistik.classList.add("active");
        tabLaporan.classList.remove("active");
        pageLaporan.style.display = "none";
        pageStatistik.style.display = "block";
        applyFilters();
      });
  }

  // Load awal
  fetchAllReports();
});