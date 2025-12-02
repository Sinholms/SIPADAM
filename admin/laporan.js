// =========================================================
// FILE: laporan.js (Updated with Modern Button)
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

// Helper untuk status badge di list utama
function getStatusBadgeHTML(status) {
    let sClass = 'green', sIcon = '✅';
    if(status === 'Aktif') { sClass = 'red'; sIcon = '🔥'; }
    if(status === 'Sedang Ditangani') { sClass = 'yellow'; sIcon = '👷'; }
    
    return `<span class="status-badge ${sClass}">${sIcon} ${status}</span>`;
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
// 4. RENDER UI COMPONENTS (DIPERBAIKI)
// ==========================================
function renderReportList(data) {
  const container = document.getElementById("reportList");
  if(!container) return;
  container.innerHTML = "";
  
  if(data.length === 0) {
    container.innerHTML = "<p style='text-align:center; padding:30px; color:#888; font-style:italic;'>Tidak ada laporan ditemukan.</p>";
    return;
  }

  data.forEach(d => {
    const item = document.createElement("div");
    item.className = "report-item"; // Menggunakan style .report-item dari CSS baru
    
    // Format tanggal cantik
    const dateObj = getDateFromId(d._id);
    const dateStr = dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    const timeStr = d.waktu || dateObj.toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'});

    // HTML Structure Baru (Sesuai CSS Modern)
    item.innerHTML = `
        <div class="report-main">
            <div class="report-icon-box">
                <i class="fa-solid fa-location-dot"></i>
            </div>
            <div class="report-info">
                <h3>${d.lokasi}</h3>
                <p>${d.catatan || "Tidak ada catatan tambahan."}</p>
                <span class="time-stamp"><i class="fa-regular fa-clock"></i> ${dateStr} • ${timeStr} WIB</span>
            </div>
        </div>

        <div class="report-status">
            ${getStatusBadgeHTML(d.status)}
            <br>
            <a href="detail-laporan.html?id=${d._id}" class="btn-detail-fancy" style="margin-top: 8px; display: inline-block; text-decoration: none; color: #8B0000; font-weight: 600; font-size: 0.85rem;">
                Lihat Detail <i class="fa-solid fa-arrow-right"></i>
            </a>
        </div>
    `;
    
    // Biar bisa diklik seluruh kartunya juga (opsional, UX bagus)
    item.onclick = (e) => {
        // Cek dulu apakah yang diklik bukan tombol detail (biar gak double action)
        if(!e.target.closest('.btn-detail-fancy')) {
             window.location.href = `detail-laporan.html?id=${d._id}`;
        }
    };

    container.appendChild(item);
  });
}

function updateStatistics(data) {
  const elTotal = document.getElementById("statTotal");
  if(elTotal) {
    elTotal.innerText = data.length;
    document.getElementById("statActive").innerText = data.filter(r => r.status === "Aktif").length;
    document.getElementById("statHandling").innerText = data.filter(r => r.status === "Selesai").length;
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
    
    let statusClass = 'green';
    if(d.status === 'Aktif') statusClass = 'red';
    if(d.status === 'Sedang Ditangani') statusClass = 'yellow';

    tr.innerHTML = `
        <td>${i+1}</td>
        <td>${d.lokasi}</td>
        <td>${dateStr} ${d.waktu}</td>
        <td><span class="status-badge ${statusClass}" style="font-size:0.75rem;">${d.status}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

// Chart 1: Grafik Batang Manual
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

// Chart 2: Grafik Lingkaran
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
                backgroundColor: ['#8B0000', '#1976d2'], // Merah & Biru
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } }
        }
    });
}

// ==========================================
// 5. EXPORT & REALTIME
// ==========================================
async function exportToPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const btnPdf = document.getElementById('btnExportPdf');
    
    const oldText = btnPdf.innerHTML;
    btnPdf.innerHTML = "⏳...";
    btnPdf.disabled = true;

    try {
        doc.setFontSize(18); doc.setTextColor(139, 0, 0);
        doc.text("Laporan Data Kebakaran", 14, 20);
        doc.setFontSize(10); doc.setTextColor(100);
        doc.text(`Dicetak: ${new Date().toLocaleString('id-ID')}`, 14, 28);
        
        const tableRows = currentFilteredData.map((item, index) => [
            index + 1, item.lokasi, item.status, `${getDateFromId(item._id).toLocaleDateString('id-ID')} ${item.waktu}`
        ]);

        doc.autoTable({
            head: [['No', 'Lokasi', 'Status', 'Waktu']],
            body: tableRows,
            startY: 35,
            theme: 'grid',
            headStyles: { fillColor: [139, 0, 0] }
        });

        // Grafik (Optional Capture)
        // ... (Logika capture grafik sama seperti sebelumnya) ...

        doc.save('Laporan_SIPADAM.pdf');
    } catch (err) { alert("Gagal export PDF"); } 
    finally { btnPdf.innerHTML = oldText; btnPdf.disabled = false; }
}

function exportToExcel() {
    let csv = "No;Lokasi;Status;Waktu\n";
    currentFilteredData.forEach((item, i) => {
        csv += `${i+1};${item.lokasi};${item.status};${item.waktu}\n`;
    });
    const link = document.createElement("a");
    link.href = 'data:text/csv;charset=utf-8,' + encodeURI(csv);
    link.download = "Laporan.csv";
    link.click();
}

function addLocalReport(laporanBaru) { allReports.unshift(laporanBaru); applyFilters(); }
function updateLocalReport(laporanUpdate) {
    const index = allReports.findIndex(r => r._id === laporanUpdate._id);
    if (index !== -1) { allReports[index] = laporanUpdate; applyFilters(); }
}

document.addEventListener("DOMContentLoaded", () => {
  // Setup Filter Tombol
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

  // Tab Menu Logic
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
        applyFilters(); // Refresh statistik saat tab dibuka
      });
  }
  
  fetchAllReports();
});