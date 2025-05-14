// app.js
// Globals
let dataRows = [];
let mainChart;

// A mapping from each raw sensor‐ID (address) to a friendly name
// Built from your table.docx :contentReference[oaicite:2]{index=2}:contentReference[oaicite:3]{index=3}
const sensorIdToLabel = {
  "014Acclima TR315L2.2908543": "Downhill Pit 1 (10 cm)",
  "114Acclima TR315L2.2908577": "Downhill Pit 1 (30 cm)",
  "214Acclima TR315L2.2908584": "Downhill Pit 1 (100 cm)",
  "314Acclima TR315L2.2908549": "Pit 1 (10 cm)",
  "414Acclima TR315L2.2908573": "Pit 1 (30 cm)",
  "514Acclima TR315L2.2908571": "Pit 1 (100 cm)",
  "614Acclima TR315L2.2908553": "Uphill Pit 1 (10 cm)",
  "714Acclima TR315L2.2908557": "Uphill Pit 1 (30 cm)",
  "814Acclima TR315L2.2908586": "Uphill Pit 1 (100 cm)",

  "014Acclima TR315L2.2908566": "Downhill Pit 2 (10 cm)",
  "114Acclima TR315L2.2907936": "Downhill Pit 2 (30 cm)",
  "214Acclima TR315L2.2908574": "Downhill Pit 2 (100 cm)",
  "314Acclima TR315L2.2908569": "Pit 2 (10 cm)",
  "414Acclima TR315L2.2908546": "Pit 2 (30 cm)",
  "514Acclima TR315L2.2908544": "Pit 2 (100 cm)",
  "614Acclima TR315L2.2908583": "Uphill Pit 2 (10 cm)",
  "714Acclima TR315L2.2908564": "Uphill Pit 2 (30 cm)",
  "814Acclima TR315L2.2908532": "Uphill Pit 2 (100 cm)",
  "x14Acclima TR315L2.2908502": "Interspace 2 (100 cm)",
  "y14Acclima TR315L2.2907923": "Interspace 2 (30 cm)",
  "z14Acclima TR315L2.2907959": "Interspace 2 (10 cm)",

  "014Acclima TR315L2.2907970": "Interspace 1 (10 cm)",
  "114Acclima TR315L2.2907958": "Interspace 1 (30 cm)",
  "214Acclima TR315L2.2907957": "Interspace 1 (100 cm)",

  "014Acclima TR315L2.2907966": "Replicate 1 (10 cm)",
  "114Acclima TR315L2.2907927": "Replicate 1 (30 cm)",
  "314Acclima TR315L2.2907935": "Replicate 2 (10 cm)",
  "414Acclima TR315L2.2907964": "Replicate 2 (30 cm)",
  "514Acclima TR315L2.2908497": "Replicate 1 (100 cm)",
  "614Acclima TR315L2.2908579": "Replicate 3 (10 cm)",
  "714Acclima TR315L2.2908542": "Replicate 3 (30 cm)",
  "814Acclima TR315L2.2908552": "Replicate 2 (100 cm)"
};

window.addEventListener('DOMContentLoaded', () => {
  // wire up Load button
  document.getElementById('loadBtn').addEventListener('click', () => {
    const file = document.getElementById('fileInput').files[0];
    if (!file) return alert('Please select your master CSV or TXT file.');
    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: results => {
        dataRows = results.data;
        drawTablePreview();
        initFilters();
        document.getElementById('filters').style.display = '';
      }
    });
  });

  // Info toggle
  document.getElementById('sensorInfoBtn').addEventListener('click', () => {
    const info = document.getElementById('sensorInfo');
    info.style.display = info.style.display === 'none' ? 'block' : 'none';
  });

  // Plot button
  document.getElementById('plotBtn').addEventListener('click', () => {
    if (!mainChart) initChart();
    updatePlot();
    document.getElementById('chartContainer').style.display = '';
  });

  // Download handlers
  document.getElementById('downloadPlotBtn').addEventListener('click', () => {
    const link = document.createElement('a');
    link.href = mainChart.toBase64Image();
    link.download = 'soil_plot.png';
    link.click();
  });
  document.getElementById('downloadDataBtn').addEventListener('click', downloadFilteredData);
});

// 1) Draw first 100 rows
function drawTablePreview() {
  const container = document.getElementById('dataTable');
  container.innerHTML = '';
  if (!dataRows.length) return;
  const cols = Object.keys(dataRows[0]);
  const table = document.createElement('table');
  const thead = table.createTHead();
  const hr = thead.insertRow();
  cols.forEach(c => { const th = document.createElement('th'); th.innerText = c; hr.appendChild(th); });
  const tbody = table.createTBody();
  dataRows.slice(0,100).forEach(row => {
    const r = tbody.insertRow();
    cols.forEach(c => {
      const td = r.insertCell();
      td.innerText = row[c];
    });
  });
  container.appendChild(table);
}

// 2) Populate filters & defaults
function initFilters() {
  // date range
  const dates = dataRows.map(r => new Date(r.datetime));
  const min = new Date(Math.min(...dates));
  const max = new Date(Math.max(...dates));
  document.getElementById('startDate').value = toLocalInput(min);
  document.getElementById('endDate').value   = toLocalInput(max);

  // sensors select
  const sel = document.getElementById('sensorSelect');
  sel.innerHTML = '';
  Object.entries(sensorIdToLabel).forEach(([id,label]) => {
    const o = document.createElement('option');
    o.value = id; o.text = label;
    sel.appendChild(o);
  });

  // fill sensorInfo table
  const tbody = document.querySelector('#sensorInfo tbody');
  tbody.innerHTML = '';
  Object.entries(sensorIdToLabel).forEach(([id,label]) => {
    const tr = tbody.insertRow();
    tr.insertCell().innerText = label;
    tr.insertCell().innerText = id;
  });
}

// helper → “YYYY-MM-DDThh:mm”
function toLocalInput(d) {
  const pad = n => n.toString().padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
       + `T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// 3) Initialize empty Chart.js with zoom/pan
function initChart() {
  const ctx = document.getElementById('mainChart').getContext('2d');
  mainChart = new Chart(ctx, {
    type: 'line',
    data: { datasets: [] },
    options: {
      parsing: false,
      scales: {
        x: { type: 'time', time: { tooltipFormat: 'yyyy-MM-dd HH:mm' } },
        y: { title: { display: true, text: '' } }
      },
      plugins: {
        title: { display: true, text: '' },
        zoom: {
          pan:  { enabled: true, mode: 'x' },
          zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' }
        }
      }
    }
  });
}

// 4) Build & render datasets
function updatePlot() {
  const start = new Date(document.getElementById('startDate').value);
  const end   = new Date(document.getElementById('endDate').value);
  const param = document.getElementById('paramSelect').value;
  const paramLabel = document.querySelector('#paramSelect option:checked').text;
  const sensors = Array.from(document.getElementById('sensorSelect').selectedOptions)
                       .map(o => o.value);
  if (!sensors.length) return alert('Select at least one sensor.');

  const datasets = sensors.map(id => ({
    label: sensorIdToLabel[id],
    data: dataRows.map(r => {
      const dt = new Date(r.datetime);
      if (dt < start || dt > end) return null;
      const y = r[`${id}_${param}`];
      return { x: dt, y: (y==null||y==='') ? null : y };
    }),
    spanGaps: false,
    fill: false
  }));

  mainChart.data.datasets = datasets;
  mainChart.options.plugins.title.text = paramLabel;
  mainChart.options.scales.y.title.text  = paramLabel;
  mainChart.update();
}

// 5) Download CSV of the filtered series
function downloadFilteredData() {
  const start = new Date(document.getElementById('startDate').value);
  const end   = new Date(document.getElementById('endDate').value);
  const param = document.getElementById('paramSelect').value;
  const sensors = Array.from(document.getElementById('sensorSelect').selectedOptions)
                       .map(o => o.value);
  const header = ['datetime', ...sensors.map(id => sensorIdToLabel[id])];
  const rows = dataRows
    .map(r => ({ dt: r.datetime, vals: sensors.map(id => r[`${id}_${param}`]) }))
    .filter(o => {
      const d = new Date(o.dt);
      return d >= start && d <= end;
    })
    .map(o => [o.dt, ...o.vals]);

  let csv = header.join(',') + '\n'
          + rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'filtered_data.csv';
  a.click();
  URL.revokeObjectURL(url);
}
