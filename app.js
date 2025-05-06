// Globals
let nodes = {},
    map, markerLayer, selectedNode,
    waterChart;

// Wait for DOM
window.addEventListener('DOMContentLoaded', () => {
  initMap();
  initChart();

  document.getElementById('loadBtn').addEventListener('click', () => {
    const files = document.getElementById('fileInput').files;
    if (!files.length) {
      alert('Please select at least one TXT file.');
      return document.getElementById('status').innerText = 'Status: no files selected';
    }
    document.getElementById('status').innerText = 'Status: parsing…';
    parseFiles(files)
      .then(() => {
        const count = Object.keys(nodes).length;
        document.getElementById('status').innerText = `Status: loaded ${count} location(s)`;
        drawTable();      // ← show table immediately
        drawMarkers();
        document.getElementById('zoneSelector').style.display = 'none';
        selectedNode = null;
      })
      .catch(err => {
        console.error(err);
        alert('Parsing error: ' + err.message);
        document.getElementById('status').innerText = 'Status: error';
      });
  });

  document.getElementById('zoneSelect').addEventListener('change', updateChart);
});

// 1) Initialize Leaflet map
function initMap() {
  map = L.map('map').setView([0, 0], 2);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);
  markerLayer = L.layerGroup().addTo(map);
}

// 2) Initialize Chart.js
function initChart() {
  const ctx = document.getElementById('waterChart').getContext('2d');
  waterChart = new Chart(ctx, {
    type: 'line',
    data: { datasets: [] },
    options: {
      parsing: false,
      scales: {
        x: {
          type: 'time',
          time: { tooltipFormat: 'yyyy-MM-dd HH:mm' }
        },
        y: { title: { display: true, text: 'Water Content' } }
      },
      plugins: {
        title: { display: true, text: 'Water Content over Time' }
      }
    }
  });
}

// 3) Parse TXT files into `nodes`
function parseFiles(files) {
  nodes = {};
  const cols = [
    "stamp","project_id","coordinates","node_id",
    "node_battery_voltage","enclosure_temperature",
    "current_mA","solar_panel_voltage","date_time"
  ];
  ["DH","MU","UH"].forEach(zone =>
    [1,2,3].forEach(s =>
      ["address","depth","water_content","temperature",
       "apparent_permittivity","bulk_ec","pore_water_ec"]
      .forEach(field => cols.push(`${zone}_sensor${s}_${field}`))
    )
  );

  return Promise.all(Array.from(files).map(file => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => {
        const lines = reader.result.split(/\r?\n/);
        const dataLines = lines.filter(l => l.includes("V2021")); 
        dataLines.forEach(line => {
          const parts = line.split("~");
          if (parts.length < cols.length) return;
          const obj = {};
          cols.forEach((c,i) => obj[c] = parts[i]);
          const [lat, lng] = obj.coordinates.split(",").map(Number);
          const nid = obj.node_id;
          if (!nodes[nid]) nodes[nid] = { lat, lng, records: [] };
          obj.date_time = new Date(
            obj.date_time.replace(/_/g, " ").replace(" UTC","Z")
          );
          nodes[nid].records.push(obj);
        });
        resolve();
      };
      reader.readAsText(file);
    });
  }));
}

// 4) Draw HTML table of all records
function drawTable() {
  const container = document.getElementById('dataTable');
  container.innerHTML = '';
  const table = document.createElement('table');
  // gather all columns from first record
  const firstNode = Object.values(nodes)[0];
  if (!firstNode) return;
  const cols = Object.keys(firstNode.records[0]);
  // header
  const thead = table.createTHead();
  const hr = thead.insertRow();
  cols.forEach(c => {
    const th = document.createElement('th');
    th.textContent = c;
    hr.appendChild(th);
  });
  // body
  const tbody = table.createTBody();
  Object.values(nodes).forEach(node => {
    node.records.forEach(rec => {
      const row = tbody.insertRow();
      cols.forEach(c => {
        const cell = row.insertCell();
        let val = rec[c];
        if (c === 'date_time') val = rec.date_time.toISOString();
        cell.textContent = val;
      });
    });
  });
  container.appendChild(table);
}

// 5) Draw map markers
function drawMarkers() {
  markerLayer.clearLayers();
  Object.entries(nodes).forEach(([nid, info]) => {
    const m = L.marker([info.lat, info.lng]).addTo(markerLayer);
    m.bindPopup(`Node ${nid}`);
    m.on('click', () => {
      selectedNode = nid;
      document.getElementById('zoneSelector').style.display = '';
      updateChart();
    });
  });
  if (markerLayer.getLayers().length) {
    const fg = L.featureGroup(markerLayer.getLayers());
    map.fitBounds(fg.getBounds().pad(0.5));
  }
}

// 6) Update Chart.js to show full timeline
function updateChart() {
  if (!selectedNode) return;
  const zone = document.getElementById('zoneSelect').value;
  const recs = nodes[selectedNode].records;
  // depths → sensor indices
  const depths = [10,30,100];
  const dates = recs.map(r => r.date_time);
  const minDate = new Date(Math.min(...dates));
  const maxDate = new Date(Math.max(...dates));

  // build three series
  const datasets = depths.map((d,i) => ({
    label: `${d} cm`,
    data: recs.map(r => ({
      x: r.date_time,
      y: parseFloat(r[`${zone}_sensor${i+1}_water_content`])
    })),
    fill: false
  }));

  // apply full‐timeline limits
  waterChart.data.datasets = datasets;
  waterChart.options.scales.x.min = minDate;
  waterChart.options.scales.x.max = maxDate;
  waterChart.update();
}
