// =========================================================
// FILE: laporan.js (VERSI EXPORT FORMAL + CHART)
// =========================================================

let allReports = [];          
let currentFilteredData = []; 
let sourceChartInstance = null;

// Expose fungsi ke Global
window.renderReportList = renderReportList;
window.updateStatistics = updateStatistics;
window.fillDataTable = fillDataTable;
window.addLocalReport = addLocalReport;
window.updateLocalReport = updateLocalReport;
window.exportToPDF = exportToPDF;
window.exportToExcel = exportToExcel;

// ==========================================
// 1. HELPER
// ==========================================
function getDateFromId(hexId) {
    try {
        const timestamp = parseInt(hexId.substring(0, 8), 16) * 1000;
        return new Date(timestamp);
    } catch (e) { return new Date(); }
}

function getStatusBadgeClass(status) {
  if(status === "Aktif") return "status-badge red";
  if(status === "Sedang Ditangani") return "status-badge yellow";
  if(status === "Selesai") return "status-badge green";
  return "status-badge";
}

// ==========================================
// 2. DATA FETCHING
// ==========================================
async function fetchAllReports() {
  try {
    document.getElementById("infoText").innerText = "Sedang memuat data...";
    const response = await fetch('/api/laporan'); 
    if (!response.ok) throw new Error("Gagal mengambil data");
    
    allReports = await response.json(); 
    applyFilters(); 
    
  } catch (err) {
    console.error(err);
    document.getElementById("infoText").innerText = "Error: " + err.message;
  }
}

// ==========================================
// 3. FILTERING LOGIC
// ==========================================
function applyFilters() {
    const activeBtn = document.querySelector('.filter-btn.active');
    const days = activeBtn ? parseInt(activeBtn.dataset.period) : 7; 

    const statusDropdown = document.getElementById("statusFilter");
    const selectedStatus = statusDropdown ? statusDropdown.value : "Semua";

    const now = new Date();
    const cutoffDate = new Date();
    cutoffDate.setDate(now.getDate() - days);

    currentFilteredData = allReports.filter(report => {
        const reportDate = getDateFromId(report._id);
        return reportDate >= cutoffDate;
    });

    const listData = currentFilteredData.filter(r => 
        selectedStatus === "Semua" || r.status === selectedStatus
    );

    renderAll(currentFilteredData, listData, days);
}

function renderAll(statData, listData, days) {
  renderReportList(listData);       
  updateStatistics(statData);       
  renderCharts(allReports, days);   
  renderSourceChart(statData);      
  fillDataTable(statData); 
  
  const infoText = document.getElementById("infoText");
  if(infoText) infoText.innerText = `Menampilkan ${listData.length} laporan`;
}

// ==========================================
// 4. RENDER UI COMPONENTS
// ==========================================
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
    const dateObj = getDateFromId(d._id);
    const dateStr = dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    item.innerHTML = `
      <div class="report-header">
        <h2>${d.lokasi}</h2>
        <span class="${getStatusBadgeClass(d.status)}">${d.status}</span>
      </div>
      <p>${d.catatan || "Tidak ada keterangan."}</p>
      <div class="report-footer">
        <span>🕓 ${dateStr} • ${d.waktu} WIB</span>
        <button class="detail-btn" onclick="window.location.href='detail-laporan.html?id=${d._id}'">Detail</button>
      </div>`;
    container.appendChild(item);
  });
}

function updateStatistics(data) {
  const elTotal = document.getElementById("statTotal");
  if(elTotal) {
    elTotal.innerText = data.length;
    document.getElementById("statActive").innerText = data.filter(r => r.status === "Aktif").length;
    document.getElementById("statHandling").innerText = data.filter(r => r.status === "Sedang Ditangani").length;
  }
}

function fillDataTable(data) {
  const tbody = document.querySelector("#dataTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  const tableFilter = document.getElementById("statTableFilter");
  const filterValue = tableFilter ? tableFilter.value : "Semua";
  const tableData = data.filter(d => filterValue === "Semua" || d.status === filterValue);

  tableData.slice(0, 50).forEach((d, i) => {
    const tr = document.createElement("tr");
    const dateObj = getDateFromId(d._id);
    const dateStr = dateObj.toLocaleDateString('id-ID', {day: 'numeric', month: 'short'});
    tr.innerHTML = `<td>${i+1}</td><td>${d.lokasi}</td><td><span class="${getStatusBadgeClass(d.status)}">${d.status}</span></td><td>${dateStr} ${d.waktu}</td>`;
    tbody.appendChild(tr);
  });
}

// Chart 1: Grafik Batang Manual (HTML Divs)
function renderCharts(rawData, days) {
  const container = document.getElementById("monthlyBars");
  if (!container) return;
  container.innerHTML = ""; 
  let labels = []; let counts = []; const now = new Date();

  if (days <= 30) {
      for (let i = 0; i < days; i++) {
          const d = new Date(); d.setDate(now.getDate() - i);
          labels.unshift(d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })); 
          counts.unshift(rawData.filter(r => {
              const rDate = getDateFromId(r._id);
              return rDate.getDate() === d.getDate() && rDate.getMonth() === d.getMonth();
          }).length);
      }
  } else {
      const monthsToShow = (days === 90) ? 3 : 12; 
      for (let i = 0; i < monthsToShow; i++) {
          const d = new Date(); d.setMonth(now.getMonth() - i);
          labels.unshift(d.toLocaleDateString('id-ID', { month: 'short' }));
          counts.unshift(rawData.filter(r => {
              const rDate = getDateFromId(r._id);
              return rDate.getMonth() === d.getMonth() && rDate.getFullYear() === d.getFullYear();
          }).length);
      }
  }
  const maxVal = Math.max(...counts, 1);
  labels.forEach((label, index) => {
      const percentage = (counts[index] / maxVal) * 100;
      const row = document.createElement("div");
      row.className = "bar-row"; 
      row.innerHTML = `<div class="bar-label">${label}</div><div class="bar-track"><div class="bar-fill" style="width: ${percentage}%;"></div></div><div class="bar-value">${counts[index]}</div>`;
      container.appendChild(row);
  });
}

// Chart 2: Grafik Lingkaran (Chart.js)
function renderSourceChart(data) {
    const ctx = document.getElementById('sourceChart');
    if (!ctx) return;
    const sensorCount = data.filter(l => (l.tipeLaporan || '').toLowerCase().includes('sensor')).length;
    const wargaCount = data.length - sensorCount;
    if (sourceChartInstance) sourceChartInstance.destroy();

    sourceChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Sensor IoT', 'Warga'],
            datasets: [{
                data: [sensorCount, wargaCount],
                backgroundColor: ['#8e24aa', '#039be5'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 0 },
            plugins: { legend: { position: 'bottom' } }
        }
    });
}

// ==========================================
// 5. EXPORT PDF: FORMAL + CHART (PERBAIKAN UTAMA)
// ==========================================
async function exportToPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const btnPdf = document.getElementById('btnExportPdf');
    
    // Matikan tombol biar user gak spam klik
    const oldText = btnPdf.innerHTML;
    btnPdf.innerHTML = "⏳ Memproses...";
    btnPdf.disabled = true;

    try {
        // --- A. HEADER (JUDUL) ---
        doc.setFontSize(22);
        doc.text("Laporan Kebakaran SIPADAM", 14, 20);
        doc.setFontSize(10);
        doc.text(`Periode Cetak: ${new Date().toLocaleString('id-ID')}`, 14, 28);
        doc.setLineWidth(0.5);
        doc.line(14, 32, 196, 32); // Garis pemisah

        // --- B. DATA TABEL (DIBUAT PAKE KODE, BUKAN SCREENSHOT) ---
        // Menyiapkan data agar rapi di tabel
        const tableRows = currentFilteredData.map((item, index) => {
            const dateObj = getDateFromId(item._id);
            const dateStr = dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
            return [
                index + 1,
                item.lokasi,
                item.status,
                `${dateStr} - ${item.waktu}`
            ];
        });

        // Generate Tabel (Mirip gambar referensimu)
        doc.autoTable({
            head: [['No', 'Lokasi Kejadian', 'Status', 'Waktu Laporan']],
            body: tableRows,
            startY: 38,
            theme: 'grid', // Tema garis-garis kotak
            headStyles: { 
                fillColor: [229, 57, 53], // Warna Merah Header
                textColor: 255,
                fontStyle: 'bold'
            },
            styles: {
                fontSize: 10,
                cellPadding: 3
            },
            alternateRowStyles: {
                fillColor: [245, 245, 245] // Baris selang-seling abu muda
            }
        });

        // --- C. CHART (SCREENSHOT KHUSUS BAGIAN GRAFIK AJA) ---
        let finalY = doc.lastAutoTable.finalY + 15; // Mulai di bawah tabel

        // Cek jika halaman tidak cukup, tambah halaman baru
        if (finalY > 200) {
            doc.addPage();
            finalY = 20;
        }

        doc.setFontSize(14);
        doc.text("Analisis Grafik", 14, finalY);
        finalY += 10;

        // 1. Ambil Grafik Batang (HTML)
        const barElement = document.querySelector('.laporan-bulanan'); 
        if (barElement) {
            const canvas1 = await html2canvas(barElement, { scale: 2, backgroundColor: '#ffffff' });
            const imgData1 = canvas1.toDataURL('image/png');
            // Atur lebar agar pas A4
            const pdfWidth = doc.internal.pageSize.getWidth() - 28; 
            const imgHeight1 = (canvas1.height * pdfWidth) / canvas1.width;
            
            doc.addImage(imgData1, 'PNG', 14, finalY, pdfWidth, imgHeight1);
            finalY += imgHeight1 + 10;
        }

        // 2. Ambil Grafik Lingkaran (Canvas Chart.js)
        const pieElement = document.getElementById('sourceChart'); // Langsung ambil canvasnya
        if (pieElement) {
            // Cek lagi space halaman
            if (finalY > 220) { doc.addPage(); finalY = 20; }
            
            // Konversi canvas Chart.js langsung ke gambar (lebih tajam)
            const imgData2 = pieElement.toDataURL('image/png');
            doc.addImage(imgData2, 'PNG', 14, finalY, 80, 80); // Ukuran 8x8 cm
        }

        // --- D. SAVE ---
        doc.save('Laporan_Resmi_SIPADAM.pdf');

    } catch (err) {
        console.error("Gagal export PDF:", err);
        alert("Terjadi kesalahan saat export PDF.");
    } finally {
        // Balikin tombol
        btnPdf.innerHTML = oldText;
        btnPdf.disabled = false;
    }
}

function exportToExcel() {
    let csvContent = "data:text/csv;charset=utf-8,\uFEFFNo;Lokasi Kejadian;Status;Waktu;Sumber\n";
    currentFilteredData.forEach((item, index) => {
        const dateObj = getDateFromId(item._id);
        const dateStr = dateObj.toLocaleDateString('id-ID');
        const cleanLokasi = (item.lokasi || '').replace(/;/g, " ").replace(/,/g, " "); 
        csvContent += `${index + 1};${cleanLokasi};${item.status};${dateStr} ${item.waktu};${item.tipeLaporan || 'Warga'}\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "Laporan_SIPADAM.csv");
    document.body.appendChild(link);
    link.click();
    link.remove();
}

function addLocalReport(laporanBaru) { allReports.unshift(laporanBaru); applyFilters(); }
function updateLocalReport(laporanUpdate) {
    const index = allReports.findIndex(r => r._id === laporanUpdate._id);
    if (index !== -1) { allReports[index] = laporanUpdate; applyFilters(); }
}

document.addEventListener("DOMContentLoaded", () => {
  const filterBtns = document.querySelectorAll('.filter-btn');
  filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
          filterBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          applyFilters(); 
      });
  });
  const mainStatus = document.getElementById("statusFilter");
  if (mainStatus) mainStatus.addEventListener('change', () => applyFilters());
  const tableStatus = document.getElementById("statTableFilter");
  if (tableStatus) tableStatus.addEventListener('change', () => fillDataTable(currentFilteredData));
  
  const btnPdf = document.getElementById("btnExportPdf");
  if (btnPdf) btnPdf.addEventListener("click", exportToPDF);
  const btnExcel = document.getElementById("btnExportExcel");
  if (btnExcel) btnExcel.addEventListener("click", exportToExcel);

  const tabLaporan = document.getElementById("tab-laporan");
  const tabStatistik = document.getElementById("tab-statistik");
  const pageLaporan = document.getElementById("page-laporan");
  const pageStatistik = document.getElementById("page-statistik");

  if(tabLaporan && tabStatistik) {
      tabLaporan.addEventListener("click", () => {
        tabLaporan.classList.add("active"); tabStatistik.classList.remove("active");
        pageLaporan.style.display = "block"; pageStatistik.style.display = "none";
      });
      tabStatistik.addEventListener("click", () => {
        tabStatistik.classList.add("active"); tabLaporan.classList.remove("active");
        pageLaporan.style.display = "none"; pageStatistik.style.display = "block";
        applyFilters(); 
      });
  }
  fetchAllReports();
});