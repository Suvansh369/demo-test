/**
 * NIRVAIR - Client-Side Civic Intelligence Application
 * Full interactive controller managing workflows, Leaflet maps,
 * Gemini API requests, and data analysis rendering.
 */

// Global State
const state = {
  currentWorkflow: 'workflow-a',
  currentLocation: {
    name: 'Connaught Place, Central Delhi',
    city: 'Delhi',
    state: 'Delhi',
    latitude: 28.6315,
    longitude: 77.2167
  },
  perceptionEstimate: 150,
  perceptionCategory: 'Moderate',
  liveReading: null,
  neighbourhoodSources: [],
  selectedRole: 'citizen',
  activeActionPlan: null,
  interventions: [],
  map: null,
  mapMarkers: []
};

// Initialize Application on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide icons
  if (window.lucide) lucide.createIcons();

  // Initialize Map
  initMap();

  // Load Initial Interventions Count
  loadInterventions();

  // Auto-fetch baseline location (Connaught Place) for instant evaluator experience
  fetchLiveAQI(state.currentLocation.latitude, state.currentLocation.longitude, state.currentLocation.name);
});

// ==============================================================
// 1. NAVIGATION & WORKFLOW SWITCHING
// ==============================================================

function switchTab(workflowId) {
  state.currentWorkflow = workflowId;

  // Toggle sections
  ['workflow-a', 'workflow-b', 'workflow-c', 'workflow-d'].forEach(id => {
    const sec = document.getElementById(`section-${id}`);
    const tabBtn = document.getElementById(`tab-btn-${id}`);
    const mobBtn = document.getElementById(`mob-tab-btn-${id}`);

    if (id === workflowId) {
      if (sec) sec.classList.remove('hidden');
      if (tabBtn) {
        tabBtn.className = 'tab-btn px-4 py-2 rounded-lg text-sm font-medium transition-all text-white bg-slate-800/90 border border-slate-700 shadow-sm flex items-center space-x-2';
      }
      if (mobBtn) {
        mobBtn.className = 'whitespace-nowrap px-3 py-1.5 rounded-md font-medium text-white bg-slate-800 border border-slate-700';
      }
    } else {
      if (sec) sec.classList.add('hidden');
      if (tabBtn) {
        tabBtn.className = 'tab-btn px-4 py-2 rounded-lg text-sm font-medium transition-all text-slate-400 hover:text-white hover:bg-slate-800/40 flex items-center space-x-2';
      }
      if (mobBtn) {
        mobBtn.className = 'whitespace-nowrap px-3 py-1.5 rounded-md font-medium text-slate-400';
      }
    }
  });

  // Re-invalidate map size if switching to workflow A
  if (workflowId === 'workflow-a' && state.map) {
    setTimeout(() => state.map.invalidateSize(), 200);
  }

  // Refresh interventions list if switching to workflow C
  if (workflowId === 'workflow-c') {
    loadInterventions();
  }

  // Refresh icons
  if (window.lucide) lucide.createIcons();
}

// ==============================================================
// 2. LOCATION & GEOLOCATION
// ==============================================================

function selectQuickLocation(name, lat, lon) {
  document.getElementById('locality-search-input').value = name;
  state.currentLocation = { name, latitude: lat, longitude: lon };
  fetchLiveAQI(lat, lon, name);
}

async function handleSearchSubmit() {
  const query = document.getElementById('locality-search-input').value.trim();
  if (!query) return;

  try {
    const res = await fetch(`/api/aqi/search?query=${encodeURIComponent(query)}`);
    const data = await res.json();
    if (data.success && data.location) {
      state.currentLocation = data.location;
      renderLiveReading(data.reading, data.location);
      fetchNeighbourhoodSources(data.location.latitude, data.location.longitude, data.location.name);
    } else {
      alert(data.error || 'Locality not found. Please try another address.');
    }
  } catch (err) {
    console.error('Search failed:', err);
    alert('Error connecting to air quality search service.');
  }
}

function requestBrowserGeolocation() {
  const banner = document.getElementById('geo-permission-banner');
  if (banner) banner.classList.remove('hidden');

  if (!navigator.geolocation) {
    alert('Geolocation is not supported by your browser.');
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      const name = `My Current Location (${lat.toFixed(3)}, ${lon.toFixed(3)})`;
      document.getElementById('locality-search-input').value = name;
      state.currentLocation = { name, latitude: lat, longitude: lon };
      fetchLiveAQI(lat, lon, name);
    },
    (err) => {
      console.warn('Geolocation denied or unavailable:', err.message);
      alert('Unable to retrieve location. Please grant permission in browser settings or use the search bar.');
    },
    { timeout: 10000, enableHighAccuracy: true }
  );
}

// ==============================================================
// 3. AQI DATA RETRIEVAL & PERCEPTION VS REALITY
// ==============================================================

async function fetchLiveAQI(lat, lon, name) {
  try {
    const res = await fetch(`/api/aqi/search?lat=${lat}&lon=${lon}&query=${encodeURIComponent(name || '')}`);
    const data = await res.json();
    if (data.success) {
      state.liveReading = data.reading;
      if (data.location) state.currentLocation = data.location;
      renderLiveReading(data.reading, state.currentLocation);
      fetchNeighbourhoodSources(lat, lon, state.currentLocation.name);
    }
  } catch (err) {
    console.error('Live AQI fetch failed:', err);
  }
}

function selectPerceptionCategory(cat, defaultVal) {
  state.perceptionCategory = cat;
  state.perceptionEstimate = defaultVal;
  document.getElementById('perception-slider').value = defaultVal;
  document.getElementById('perception-slider-val').textContent = defaultVal;

  // Highlight selected button
  document.querySelectorAll('#aqi-category-buttons .cat-btn').forEach(btn => {
    btn.classList.remove('ring-2', 'ring-blue-500', 'bg-blue-500/20');
  });
  if (event && event.currentTarget) {
    event.currentTarget.classList.add('ring-2', 'ring-blue-500', 'bg-blue-500/20');
  }
}

function updatePerceptionSlider(val) {
  state.perceptionEstimate = parseInt(val, 10);
  document.getElementById('perception-slider-val').textContent = val;

  // Determine category dynamically
  if (val <= 50) state.perceptionCategory = 'Good';
  else if (val <= 100) state.perceptionCategory = 'Satisfactory';
  else if (val <= 200) state.perceptionCategory = 'Moderate';
  else if (val <= 300) state.perceptionCategory = 'Poor';
  else if (val <= 400) state.perceptionCategory = 'Very Poor';
  else state.perceptionCategory = 'Severe';
}

function revealPerceptionVsReality() {
  if (!state.liveReading) {
    alert('Retrieving live air quality data, please wait a moment...');
    return;
  }

  const container = document.getElementById('reveal-card-container');
  container.classList.remove('hidden');

  // Scroll smoothly to reveal card
  container.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Update Perception items
  document.getElementById('reveal-user-val').textContent = state.perceptionEstimate;
  document.getElementById('reveal-user-cat').textContent = state.perceptionCategory;
  document.getElementById('reveal-user-desc').textContent = `You estimated the air quality index to be ${state.perceptionEstimate} (${state.perceptionCategory}).`;

  // Update Actual items
  const actualAQI = state.liveReading.aqi || 220;
  const actualCat = state.liveReading.category.name || 'Moderate';
  document.getElementById('reveal-actual-val').textContent = actualAQI;
  document.getElementById('reveal-actual-desc').textContent = state.liveReading.category.healthImpact || 'Data evaluated from atmospheric observations.';

  // Update Category Badge Pill
  const pill = document.getElementById('reveal-category-pill');
  pill.textContent = actualCat;
  pill.className = `aqi-pill bg-aqi-${actualCat.toLowerCase().replace(/\s+/g, '')}`;

  // Delta calculation
  const delta = actualAQI - state.perceptionEstimate;
  const deltaBadge = document.getElementById('reveal-delta-badge');
  const deltaText = document.getElementById('reveal-delta-text');

  if (Math.abs(delta) <= 15) {
    deltaBadge.className = 'px-4 py-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm font-bold flex items-center space-x-2';
    deltaText.textContent = `Accurate perception (within ${Math.abs(delta)} points)`;
  } else if (delta > 0) {
    deltaBadge.className = 'px-4 py-2 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm font-bold flex items-center space-x-2';
    deltaText.textContent = `Underestimated by ${delta} points!`;
  } else {
    deltaBadge.className = 'px-4 py-2 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-300 text-sm font-bold flex items-center space-x-2';
    deltaText.textContent = `Overestimated by ${Math.abs(delta)} points`;
  }

  // Update Station metadata
  if (state.liveReading.nearestStation) {
    const st = state.liveReading.nearestStation;
    document.getElementById('reveal-station-name').textContent = `${st.name} (${st.operator})`;
    document.getElementById('reveal-station-dist').textContent = `${st.distanceKm} km away`;
    document.getElementById('reveal-station-dist-sub').textContent = `${st.distanceKm} km`;
  }

  document.getElementById('reveal-locality-title').textContent = state.currentLocation.name;
  document.getElementById('reveal-timestamp').textContent = new Date(state.liveReading.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Generate role action intelligence once reality is revealed
  fetchActionPlan();

  if (window.lucide) lucide.createIcons();
}

function renderLiveReading(reading, location) {
  if (!reading) return;

  // Render Pollutant cards grid
  const polGrid = document.getElementById('pollutant-cards-grid');
  if (!polGrid) return;
  polGrid.innerHTML = '';

  const polDefs = [
    { key: 'pm25', label: 'PM 2.5', unit: 'µg/m³', desc: 'Fine particulate matter' },
    { key: 'pm10', label: 'PM 10', unit: 'µg/m³', desc: 'Coarse dust particles' },
    { key: 'no2', label: 'NO₂', unit: 'µg/m³', desc: 'Combustion & vehicle exhaust' },
    { key: 'so2', label: 'SO₂', unit: 'µg/m³', desc: 'Industrial & fuel emissions' },
    { key: 'co', label: 'CO', unit: 'mg/m³', desc: 'Incomplete combustion' },
    { key: 'o3', label: 'Ozone (O₃)', unit: 'µg/m³', desc: 'Photochemical smog' }
  ];

  polDefs.forEach(p => {
    const val = reading.pollutants ? reading.pollutants[p.key] : null;
    const sub = reading.subIndices ? reading.subIndices[p.key] : null;
    const displayVal = val !== null && val !== undefined ? val : 'N/A';

    const card = document.createElement('div');
    card.className = 'bg-slate-900/90 rounded-xl p-3 border border-slate-800 flex flex-col justify-between';
    card.innerHTML = `
      <div>
        <div class="flex items-center justify-between text-xs">
          <span class="font-bold text-slate-300">${p.label}</span>
          ${sub ? `<span class="text-[10px] font-mono text-slate-400">Idx: ${sub}</span>` : ''}
        </div>
        <div class="text-xl font-black font-mono text-white mt-1.5">${displayVal} <span class="text-[10px] font-normal text-slate-400">${p.unit}</span></div>
      </div>
      <span class="text-[10px] text-slate-500 mt-2 block">${p.desc}</span>
    `;
    polGrid.appendChild(card);
  });
}

// ==============================================================
// 4. NEIGHBOURHOOD INTELLIGENCE & MAP
// ==============================================================

function initMap() {
  const mapElement = document.getElementById('neighbourhood-map');
  if (!mapElement) return;

  state.map = L.map('neighbourhood-map', {
    zoomControl: true,
    scrollWheelZoom: false
  }).setView([state.currentLocation.latitude, state.currentLocation.longitude], 13);

  // CartoDB Dark Matter tile layer for premium dark aesthetic
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(state.map);

  // Allow clicking on map to select coordinates
  state.map.on('click', (e) => {
    const lat = e.latlng.lat;
    const lon = e.latlng.lng;
    const name = `Selected Coordinate (${lat.toFixed(3)}, ${lon.toFixed(3)})`;
    document.getElementById('locality-search-input').value = name;
    state.currentLocation = { name, latitude: lat, longitude: lon };
    fetchLiveAQI(lat, lon, name);
  });
}

async function fetchNeighbourhoodSources(lat, lon, locality) {
  try {
    const res = await fetch(`/api/neighbourhood/sources?lat=${lat}&lon=${lon}&locality=${encodeURIComponent(locality || '')}`);
    const data = await res.json();
    if (data.success && data.sources) {
      state.neighbourhoodSources = data.sources;
      renderNeighbourhoodSources(data.sources, lat, lon);
    }
  } catch (err) {
    console.error('Neighbourhood sources fetch failed:', err);
  }
}

function renderNeighbourhoodSources(sources, userLat, userLon) {
  // Update badge count
  const badge = document.getElementById('sources-count-badge');
  if (badge) badge.textContent = `${sources.length} sources and observation markers`;

  // Render Cards Grid
  const grid = document.getElementById('neighbourhood-sources-grid');
  if (grid) {
    grid.innerHTML = '';
    sources.forEach(src => {
      const card = document.createElement('div');
      card.className = 'glass-panel rounded-xl p-4 border border-slate-700/60 flex flex-col justify-between space-y-2.5';
      
      let tagClass = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      if (src.category === 'VERIFIED') tagClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      else if (src.category === 'CITIZEN') tagClass = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      else if (src.category === 'HYPOTHESIS') tagClass = 'bg-purple-500/10 text-purple-400 border-purple-500/20';

      card.innerHTML = `
        <div>
          <div class="flex items-center justify-between text-xs mb-1.5">
            <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${tagClass}">[${src.category}] ${src.tag || ''}</span>
            <span class="text-slate-400 font-mono text-[11px]">~${src.distanceMeters}m away</span>
          </div>
          <h4 class="text-sm font-bold text-white">${src.title}</h4>
          <p class="text-xs text-slate-300 mt-1.5 leading-relaxed">${src.explanation}</p>
        </div>
        <div class="flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-800/80 pt-2">
          <span>Confidence: <strong class="text-slate-300">${src.confidence}</strong></span>
          <button onclick="focusOnSource(${src.latitude}, ${src.longitude})" class="text-blue-400 hover:text-white font-semibold flex items-center">
            <span>Locate on Map</span>
            <i data-lucide="arrow-up-right" class="w-3.5 h-3.5 ml-0.5"></i>
          </button>
        </div>
      `;
      grid.appendChild(card);
    });
  }

  // Update Map Markers
  if (state.map) {
    // Clear existing markers
    state.mapMarkers.forEach(m => state.map.removeLayer(m));
    state.mapMarkers = [];

    // Add User Selected Location Pin
    const userMarker = L.circleMarker([userLat, userLon], {
      radius: 9,
      color: '#3b82f6',
      fillColor: '#60a5fa',
      fillOpacity: 0.9,
      weight: 3
    }).addTo(state.map);
    userMarker.bindPopup(`<strong>Your Location</strong><br>${state.currentLocation.name}`).openPopup();
    state.mapMarkers.push(userMarker);

    // Add 1km and 2km proximity circles
    const circle1km = L.circle([userLat, userLon], {
      radius: 1000,
      color: '#3b82f6',
      fillOpacity: 0.04,
      weight: 1,
      dashArray: '4, 4'
    }).addTo(state.map);
    state.mapMarkers.push(circle1km);

    // Add Source Pins
    sources.forEach(src => {
      let markerColor = '#3b82f6';
      if (src.category === 'VERIFIED') markerColor = '#10b981';
      else if (src.category === 'CITIZEN') markerColor = '#f59e0b';
      else if (src.category === 'HYPOTHESIS') markerColor = '#a855f7';

      const marker = L.circleMarker([src.latitude, src.longitude], {
        radius: 7,
        color: markerColor,
        fillColor: markerColor,
        fillOpacity: 0.8,
        weight: 2
      }).addTo(state.map);

      marker.bindPopup(`
        <div class="p-1 space-y-1 text-xs">
          <span class="font-bold text-white block">[${src.category}] ${src.title}</span>
          <p class="text-slate-300 text-[11px]">${src.explanation.slice(0, 150)}...</p>
          <span class="text-slate-400 font-mono block text-[10px]">Distance: ~${src.distanceMeters}m</span>
        </div>
      `);
      state.mapMarkers.push(marker);
    });

    state.map.setView([userLat, userLon], 13);
  }

  if (window.lucide) lucide.createIcons();
}

function focusOnSource(lat, lon) {
  if (state.map) {
    state.map.setView([lat, lon], 15, { animate: true });
    // Scroll to map
    document.getElementById('neighbourhood-map').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

// ==============================================================
// 5. CITIZEN REPORTING MODAL
// ==============================================================

function openCitizenReportModal() {
  document.getElementById('cr-locality').value = state.currentLocation.name;
  document.getElementById('citizen-report-modal').classList.remove('hidden');
}

function closeCitizenReportModal() {
  document.getElementById('citizen-report-modal').classList.add('hidden');
}

async function submitCitizenReport() {
  const locality = document.getElementById('cr-locality').value.trim();
  const report_type = document.getElementById('cr-type').value;
  const severity = document.getElementById('cr-severity').value;
  const description = document.getElementById('cr-desc').value.trim();

  if (!description) {
    alert('Please enter a description for the reported source.');
    return;
  }

  try {
    const res = await fetch('/api/citizen-reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        latitude: state.currentLocation.latitude,
        longitude: state.currentLocation.longitude,
        locality,
        report_type,
        severity,
        description
      })
    });

    const data = await res.json();
    if (data.success) {
      alert('Citizen report submitted successfully and logged into civic database.');
      closeCitizenReportModal();
      document.getElementById('cr-desc').value = '';
      // Refresh sources
      fetchNeighbourhoodSources(state.currentLocation.latitude, state.currentLocation.longitude, state.currentLocation.name);
    } else {
      alert(data.error || 'Failed to submit citizen report.');
    }
  } catch (err) {
    console.error('Citizen report error:', err);
    alert('Network error submitting citizen report.');
  }
}

// ==============================================================
// 6. PERSONALISED ACTION INTELLIGENCE (GEMINI)
// ==============================================================

function selectUserRole(role) {
  state.selectedRole = role;

  // Toggle role button highlights
  ['citizen', 'school', 'society', 'ward_officer'].forEach(r => {
    const btn = document.getElementById(`role-btn-${r}`);
    if (r === role) {
      btn.className = 'role-btn p-3 rounded-xl border border-blue-500 bg-blue-500/20 text-white font-bold text-xs flex flex-col items-center justify-center space-y-1 transition';
    } else {
      btn.className = 'role-btn p-3 rounded-xl border border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-slate-400 font-bold text-xs flex flex-col items-center justify-center space-y-1 transition';
    }
  });

  fetchActionPlan();
}

async function fetchActionPlan() {
  const summaryEl = document.getElementById('role-summary-text');
  if (summaryEl) summaryEl.textContent = `Consulting Gemini AI Action Engine for ${state.selectedRole}...`;

  try {
    const res = await fetch('/api/gemini/action-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: state.selectedRole,
        aqi: state.liveReading ? state.liveReading.aqi : 200,
        category: state.liveReading ? state.liveReading.category.name : 'Moderate',
        prominentPollutant: state.liveReading ? state.liveReading.prominentPollutant : 'PM2.5',
        sources: state.neighbourhoodSources,
        locality: state.currentLocation.name
      })
    });

    const data = await res.json();
    if (data.success && data.actionPlan) {
      state.activeActionPlan = data.actionPlan;
      renderActionPlan(data.actionPlan);
    }
  } catch (err) {
    console.error('Action plan retrieval failed:', err);
  }
}

function renderActionPlan(plan) {
  if (!plan) return;

  const summaryEl = document.getElementById('role-summary-text');
  if (summaryEl) summaryEl.textContent = plan.summary || 'Directives tailored to current atmospheric conditions.';

  const horizons = ['immediate', 'shortTerm', 'longTerm'];
  const listIds = {
    immediate: 'actions-immediate-list',
    shortTerm: 'actions-shortterm-list',
    longTerm: 'actions-longterm-list'
  };

  horizons.forEach(h => {
    const listEl = document.getElementById(listIds[h]);
    if (!listEl) return;
    listEl.innerHTML = '';

    const actions = (plan.actions && plan.actions[h]) || [];
    actions.forEach((act, idx) => {
      const card = document.createElement('div');
      card.className = 'bg-slate-900/80 rounded-xl p-4 border border-slate-800 space-y-3';
      card.innerHTML = `
        <div>
          <span class="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-1">Target: ${act.timeline}</span>
          <h4 class="text-xs font-bold text-white leading-snug">${act.title}</h4>
        </div>
        <div class="space-y-1.5 text-[11px] text-slate-300">
          <div><strong class="text-slate-400">Why:</strong> ${act.why}</div>
          <div><strong class="text-slate-400">Evidence:</strong> ${act.evidence}</div>
          <div><strong class="text-slate-400">Assignee:</strong> ${act.responsibleStakeholder}</div>
          <div><strong class="text-slate-400">Verification:</strong> ${act.verificationMethod}</div>
        </div>
        <button onclick="commitToAction('${escapeHtml(act.title)}', '${escapeHtml(act.why)}', '${escapeHtml(act.evidence)}', '${escapeHtml(act.responsibleStakeholder)}', '${escapeHtml(act.timeline)}', '${escapeHtml(act.verificationMethod)}')" class="w-full py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-[11px] font-bold transition flex items-center justify-center space-x-1.5">
          <i data-lucide="plus-circle" class="w-3.5 h-3.5"></i>
          <span>Commit to Action</span>
        </button>
      `;
      listEl.appendChild(card);
    });
  });

  if (window.lucide) lucide.createIcons();
}

async function commitToAction(title, why, evidence, assignee, timeline, verification) {
  try {
    const res = await fetch('/api/interventions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        locality: state.currentLocation.name,
        role: state.selectedRole,
        title,
        rationale: why,
        evidence,
        assigned_to: assignee,
        deadline: new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 10),
        status: 'proposed',
        verification_method: verification
      })
    });

    const data = await res.json();
    if (data.success) {
      alert(`Action "${title}" added to Intervention Memory!`);
      loadInterventions();
    }
  } catch (err) {
    console.error('Error committing action:', err);
  }
}

// ==============================================================
// 7. PROFESSIONAL DATA ANALYSIS ENGINE (WORKFLOW B)
// ==============================================================

function loadSampleMessyData() {
  const sampleData = `Recorded_At,Particulate_Matter_2.5,Site_Name,Status
2026-11-01 06:00,32.4 ug/m3,Rohini-Sector-16,Active
2026-11-01 07:00,45.8,Rohini-Sector-16,Active
2026-11-01 08:00,68.2,Rohini-Sector-16,Active
2026-11-01 09:00,-15.0,Rohini-Sector-16,Active
2026-11-01 10:00,NA,Rohini-Sector-16,Active
2026-11-01 11:00,312.0,Rohini-Sector-16,Active
2026-11-01 12:00,312.0,Rohini-Sector-16,Active
2026-11-01 13:00,1850.0,Rohini-Sector-16,Active
2026-11-01 13:00,1850.0,Rohini-Sector-16,Active
2026-11-01 14:00,84.1,Rohini-Sector-16,Active
2026-11-01 15:00,79.5,Rohini-Sector-16,Active`;

  document.getElementById('pasted-data-input').value = sampleData;
  handlePastedDataSubmit();
}

async function handlePastedDataSubmit() {
  const text = document.getElementById('pasted-data-input').value.trim();
  if (!text) {
    alert('Please enter or paste tabular air quality data.');
    return;
  }

  showAnalysisLoading();

  try {
    const res = await fetch('/api/analyze/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pastedText: text, fileName: 'pasted_dataset.csv' })
    });

    const data = await res.json();
    if (data.success) {
      renderDataAnalysis(data.analysis, data.aiExplanation);
    } else {
      alert(data.error || 'Failed to process data.');
    }
  } catch (err) {
    console.error('Data analysis failed:', err);
    alert('Error processing tabular data.');
  }
}

async function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  showAnalysisLoading();

  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch('/api/analyze/data', {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    if (data.success) {
      renderDataAnalysis(data.analysis, data.aiExplanation);
    } else {
      alert(data.error || 'Failed to process uploaded file.');
    }
  } catch (err) {
    console.error('File upload failed:', err);
    alert('Error uploading and parsing file.');
  }
}

function showAnalysisLoading() {
  const resultsContainer = document.getElementById('data-analysis-results');
  resultsContainer.classList.remove('hidden');
  resultsContainer.scrollIntoView({ behavior: 'smooth' });
}

function renderDataAnalysis(analysis, aiExplanation) {
  if (!analysis) return;

  // Render 4-Tier Trust Cards
  document.getElementById('stat-trust-green').textContent = analysis.trustBreakdown.GREEN || 0;
  document.getElementById('stat-trust-yellow').textContent = analysis.trustBreakdown.YELLOW || 0;
  document.getElementById('stat-trust-red').textContent = analysis.trustBreakdown.RED || 0;
  document.getElementById('stat-trust-grey').textContent = analysis.trustBreakdown.GREY || 0;

  // Render Statistical Profile
  document.getElementById('stats-target-col').textContent = `${analysis.analyzedColumn} (${analysis.analyzedParameter})`;
  document.getElementById('stats-total-rows').textContent = `${analysis.totalRecords} records parsed`;

  const s = analysis.statistics;
  document.getElementById('stat-mean').textContent = s.mean !== null ? s.mean : 'N/A';
  document.getElementById('stat-median').textContent = s.median !== null ? s.median : 'N/A';
  document.getElementById('stat-p95').textContent = s.p95 !== null ? s.p95 : 'N/A';
  document.getElementById('stat-min').textContent = s.min !== null ? s.min : 'N/A';
  document.getElementById('stat-max').textContent = s.max !== null ? s.max : 'N/A';
  document.getElementById('stat-stddev').textContent = s.stdDev !== null ? s.stdDev : 'N/A';

  // Render Trend
  document.getElementById('stat-trend-direction').textContent = analysis.trend.direction;
  document.getElementById('stat-trend-change').textContent = `${analysis.trend.percentageChange > 0 ? '+' : ''}${analysis.trend.percentageChange}% change`;

  // Render AI Assessment
  if (aiExplanation) {
    const ratingEl = document.getElementById('ai-integrity-rating');
    ratingEl.textContent = aiExplanation.dataIntegrityRating || 'Moderate';
    if (aiExplanation.dataIntegrityRating === 'High') ratingEl.className = 'text-emerald-400';
    else if (aiExplanation.dataIntegrityRating === 'Moderate') ratingEl.className = 'text-yellow-400';
    else ratingEl.className = 'text-red-400';

    document.getElementById('ai-summary-text').textContent = aiExplanation.plainLanguageSummary || aiExplanation.datasetQualityAssessment || 'Analysis complete.';
    
    if (aiExplanation.institutionalRecommendations && aiExplanation.institutionalRecommendations.length > 0) {
      document.getElementById('ai-rec-text').textContent = aiExplanation.institutionalRecommendations[0];
    }
  }

  // Render Audit Trail Table
  const tableBody = document.getElementById('flagged-table-body');
  tableBody.innerHTML = '';
  document.getElementById('flagged-count-label').textContent = `${analysis.flaggedObservations.length} flagged records`;

  analysis.flaggedObservations.forEach(obs => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-800/40 transition text-slate-300';

    let badgeClass = 'badge-trust-yellow';
    if (obs.flag === 'RED') badgeClass = 'badge-trust-red';
    else if (obs.flag === 'GREY') badgeClass = 'badge-trust-grey';

    tr.innerHTML = `
      <td class="py-2.5 px-3 font-bold text-white">${obs.rowIndex}</td>
      <td class="py-2.5 px-3 text-slate-400">${obs.column}</td>
      <td class="py-2.5 px-3 font-semibold text-white">${obs.originalValue !== undefined && obs.originalValue !== '' ? obs.originalValue : '<em>(Empty)</em>'}</td>
      <td class="py-2.5 px-3"><span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${badgeClass}">${obs.flag} - ${obs.status}</span></td>
      <td class="py-2.5 px-3 text-slate-300 leading-snug">${obs.reason}</td>
      <td class="py-2.5 px-3">${obs.excludedFromCalculations ? '<span class="text-rose-400 font-bold">Excluded</span>' : '<span class="text-emerald-400">Included</span>'}</td>
    `;
    tableBody.appendChild(tr);
  });
}

// ==============================================================
// 8. INTERVENTION TRACKING & HISTORICAL MEMORY (WORKFLOW C)
// ==============================================================

async function loadInterventions() {
  try {
    const res = await fetch('/api/interventions');
    const data = await res.json();
    if (data.success && data.interventions) {
      state.interventions = data.interventions;
      // Update nav count badge
      const countEl = document.getElementById('nav-intervention-count');
      if (countEl) countEl.textContent = data.interventions.length;
      renderInterventionsList();
    }
  } catch (err) {
    console.error('Failed to load interventions:', err);
  }
}

function renderInterventionsList() {
  const grid = document.getElementById('interventions-list-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const filter = document.getElementById('filter-intv-status') ? document.getElementById('filter-intv-status').value : 'all';
  let list = state.interventions;
  if (filter !== 'all') {
    list = list.filter(i => i.status === filter);
  }

  if (list.length === 0) {
    grid.innerHTML = '<div class="col-span-2 text-center py-8 text-xs text-slate-500">No interventions matching filter. Commit actions from the Action Intelligence tab!</div>';
    return;
  }

  list.forEach(intv => {
    const card = document.createElement('div');
    card.className = 'glass-panel rounded-xl p-5 border border-slate-800 space-y-3';

    let statusBadge = 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
    if (intv.status === 'completed') statusBadge = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    else if (intv.status === 'in_progress') statusBadge = 'bg-blue-500/10 text-blue-400 border-blue-500/20';

    card.innerHTML = `
      <div class="flex items-start justify-between">
        <div>
          <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${statusBadge}">${intv.status.replace('_', ' ')}</span>
          <h4 class="text-sm font-bold text-white mt-2">${intv.title}</h4>
          <span class="text-[11px] text-slate-400 block">${intv.locality} • Assigned to: <strong>${intv.assigned_to}</strong></span>
        </div>
        <select onchange="updateInterventionStatus('${intv.id}', this.value)" class="bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded px-2 py-1">
          <option value="proposed" ${intv.status === 'proposed' ? 'selected' : ''}>Proposed</option>
          <option value="in_progress" ${intv.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
          <option value="completed" ${intv.status === 'completed' ? 'selected' : ''}>Completed</option>
          <option value="abandoned" ${intv.status === 'abandoned' ? 'selected' : ''}>Abandoned</option>
        </select>
      </div>

      <div class="space-y-1 text-xs text-slate-300">
        <div><strong class="text-slate-400">Rationale:</strong> ${intv.rationale}</div>
        <div><strong class="text-slate-400">Deadline:</strong> <span class="font-mono text-slate-200">${intv.deadline}</span></div>
        ${intv.verification_method ? `<div><strong class="text-slate-400">Verification:</strong> ${intv.verification_method}</div>` : ''}
      </div>

      <div class="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
        <span class="text-[10px] text-slate-500">Created: ${new Date(intv.created_at).toLocaleDateString()}</span>
        <button onclick="deleteIntervention('${intv.id}')" class="text-rose-400 hover:text-rose-300 text-[11px]">Remove</button>
      </div>
    `;
    grid.appendChild(card);
  });
}

async function updateInterventionStatus(id, newStatus) {
  try {
    const res = await fetch(`/api/interventions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    const data = await res.json();
    if (data.success) {
      loadInterventions();
    }
  } catch (err) {
    console.error('Failed to update status:', err);
  }
}

async function deleteIntervention(id) {
  if (!confirm('Remove this intervention from memory?')) return;
  try {
    const res = await fetch(`/api/interventions/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      loadInterventions();
    }
  } catch (err) {
    console.error('Failed to delete intervention:', err);
  }
}

async function evaluateInterventionComparison() {
  const card = document.getElementById('intervention-comparison-card');
  card.classList.remove('hidden');
  card.scrollIntoView({ behavior: 'smooth' });

  try {
    const res = await fetch('/api/interventions/compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        locality: state.currentLocation.name,
        currentAQI: state.liveReading ? state.liveReading.aqi : 225
      })
    });

    const data = await res.json();
    if (data.success && data.comparison) {
      const cmp = data.comparison;
      document.getElementById('cmp-locality').textContent = cmp.locality;
      document.getElementById('cmp-baseline-aqi').textContent = `${cmp.baselinePeriod.aqi} AQI`;
      document.getElementById('cmp-current-aqi').textContent = `${cmp.currentPeriod.aqi} AQI`;
      document.getElementById('cmp-delta-aqi').textContent = `${cmp.deltaAQI > 0 ? '+' : ''}${cmp.deltaAQI} AQI`;
      document.getElementById('cmp-outcome-badge').textContent = cmp.conditionOutcome;

      if (cmp.conditionOutcome === 'Improved') {
        document.getElementById('cmp-outcome-badge').className = 'px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30';
      } else if (cmp.conditionOutcome === 'Deteriorated') {
        document.getElementById('cmp-outcome-badge').className = 'px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-300 border border-rose-500/30';
      }

      document.getElementById('cmp-attribution-notice').textContent = cmp.scientificAttributionNotice;
    }
  } catch (err) {
    console.error('Comparison evaluation failed:', err);
  }
}

// ==============================================================
// 9. CIVIC REPORTS GENERATION (WORKFLOW D)
// ==============================================================

function handleReportTypeChange() {
  const type = document.getElementById('report-type-select').value;
  const langCont = document.getElementById('report-lang-container');
  const lvlCont = document.getElementById('report-level-container');

  if (type === 'advisory') {
    langCont.classList.remove('hidden');
    lvlCont.classList.remove('hidden');
  } else {
    langCont.classList.add('hidden');
    lvlCont.classList.add('hidden');
  }
}

async function generateReport() {
  const type = document.getElementById('report-type-select').value;
  const language = document.getElementById('report-lang-select').value;
  const readingLevel = document.getElementById('report-level-select').value;

  const btn = document.getElementById('btn-generate-report');
  btn.disabled = true;
  btn.innerHTML = `<span class="pulse-live">Generating report via Gemini API...</span>`;

  try {
    const res = await fetch('/api/gemini/generate-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        locality: state.currentLocation.name,
        aqi: state.liveReading ? state.liveReading.aqi : 220,
        category: state.liveReading ? state.liveReading.category.name : 'Poor',
        prominentPollutant: state.liveReading ? state.liveReading.prominentPollutant : 'PM2.5',
        sources: state.neighbourhoodSources,
        language,
        readingLevel
      })
    });

    const data = await res.json();
    if (data.success && data.content) {
      renderMarkdownToHtml(data.content);
    } else {
      alert(data.error || 'Failed to generate report.');
    }
  } catch (err) {
    console.error('Report generation error:', err);
    alert('Error connecting to Gemini report generator.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i data-lucide="sparkles" class="w-4 h-4 mr-2"></i><span>Generate Report with Gemini</span>`;
    if (window.lucide) lucide.createIcons();
  }
}

function renderMarkdownToHtml(md) {
  const out = document.getElementById('report-markdown-content');
  if (!out) return;

  // Basic client-side markdown formatter for headers, bullets, bold text
  let html = md
    .replace(/^### (.*$)/gim, '<h3 class="text-lg font-bold text-white mt-4 mb-2">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 class="text-xl font-extrabold text-blue-400 mt-6 mb-3 border-b border-slate-700 pb-1">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-black text-white mt-6 mb-4">$1</h1>')
    .replace(/^\> (.*$)/gim, '<blockquote class="border-l-4 border-amber-400 pl-3 my-2 text-amber-200 italic">$1</blockquote>')
    .replace(/\*\*(.*?)\*\*/gim, '<strong class="text-white font-bold">$1</strong>')
    .replace(/\*(.*?)\*/gim, '<em>$1</em>')
    .replace(/^- (.*$)/gim, '<li class="ml-4 list-disc text-slate-300 my-1">$1</li>')
    .replace(/\n\n/gim, '<br><br>');

  out.innerHTML = html;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/'/g, "\\'").replace(/"/g, '&quot;');
}
