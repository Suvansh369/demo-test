/**
 * Official CPCB & State Pollution Control Board Monitoring Station Registry.
 * High-precision coordinates for official Continuous Ambient Air Quality Monitoring Stations (CAAQMS).
 */

const STATIONS = [
  // Delhi NCR
  { id: 'del-01', name: 'Mandir Marg CAAQMS', dataGovInName: 'Mandir Marg, Delhi - DPCC', city: 'Delhi', state: 'Delhi', lat: 28.6360, lon: 77.2010, operator: 'DPCC / CPCB' },
  { id: 'del-02', name: 'Anand Vihar CAAQMS', dataGovInName: 'Anand Vihar, Delhi - DPCC', city: 'Delhi', state: 'Delhi', lat: 28.6508, lon: 77.3152, operator: 'DPCC / CPCB' },
  { id: 'del-03', name: 'R K Puram CAAQMS', dataGovInName: 'R K Puram, Delhi - DPCC', city: 'Delhi', state: 'Delhi', lat: 28.5632, lon: 77.1869, operator: 'DPCC / CPCB' },
  { id: 'del-04', name: 'Punjabi Bagh CAAQMS', dataGovInName: 'Punjabi Bagh, Delhi - DPCC', city: 'Delhi', state: 'Delhi', lat: 28.6740, lon: 77.1310, operator: 'DPCC / CPCB' },
  { id: 'del-05', name: 'ITO CAAQMS', dataGovInName: 'ITO, Delhi - CPCB', city: 'Delhi', state: 'Delhi', lat: 28.6318, lon: 77.2492, operator: 'CPCB' },
  { id: 'del-06', name: 'Jahangirpuri CAAQMS', dataGovInName: 'Jahangirpuri, Delhi - DPCC', city: 'Delhi', state: 'Delhi', lat: 28.7328, lon: 77.1706, operator: 'DPCC' },
  { id: 'del-07', name: 'Okhla Phase-2 CAAQMS', dataGovInName: 'Okhla Phase-2, Delhi - DPCC', city: 'Delhi', state: 'Delhi', lat: 28.5308, lon: 77.2713, operator: 'DPCC' },
  { id: 'del-08', name: 'Sector 62, Noida CAAQMS', dataGovInName: 'Sector-62, Noida - UPPCB', city: 'Noida', state: 'Uttar Pradesh', lat: 28.6258, lon: 77.3649, operator: 'UPPCB' },
  { id: 'del-09', name: 'Vikas Sadan, Gurugram CAAQMS', dataGovInName: 'Vikas Sadan, Gurugram - HSPCB', city: 'Gurugram', state: 'Haryana', lat: 28.4501, lon: 77.0264, operator: 'HSPCB' },
  { id: 'del-10', name: 'Sanjay Nagar, Ghaziabad CAAQMS', dataGovInName: 'Sanjay Nagar, Ghaziabad - UPPCB', city: 'Ghaziabad', state: 'Uttar Pradesh', lat: 28.6853, lon: 77.4538, operator: 'UPPCB' },

  // Mumbai & MMR
  { id: 'mum-01', name: 'Bandra Kurla Complex (BKC) CAAQMS', dataGovInName: 'Bandra Kurla Complex, Mumbai - MPCB', city: 'Mumbai', state: 'Maharashtra', lat: 19.0657, lon: 72.8688, operator: 'MPCB' },
  { id: 'mum-02', name: 'Colaba CAAQMS', dataGovInName: 'Colaba, Mumbai - MPCB', city: 'Mumbai', state: 'Maharashtra', lat: 18.9067, lon: 72.8147, operator: 'IITM / SAFAR' },
  { id: 'mum-03', name: 'Andheri East CAAQMS', dataGovInName: 'Andheri East, Mumbai - MPCB', city: 'Mumbai', state: 'Maharashtra', lat: 19.1136, lon: 72.8697, operator: 'MPCB' },
  { id: 'mum-04', name: 'Worli CAAQMS', dataGovInName: 'Worli, Mumbai - MPCB', city: 'Mumbai', state: 'Maharashtra', lat: 19.0178, lon: 72.8183, operator: 'MPCB' },
  { id: 'mum-05', name: 'Navi Mumbai (Nerul) CAAQMS', dataGovInName: 'Nerul, Navi Mumbai - MPCB', city: 'Navi Mumbai', state: 'Maharashtra', lat: 19.0330, lon: 73.0297, operator: 'MPCB' },
  { id: 'mum-06', name: 'Thane (Kopri) CAAQMS', dataGovInName: 'Kopri, Thane - MPCB', city: 'Thane', state: 'Maharashtra', lat: 19.1860, lon: 72.9754, operator: 'MPCB' },

  // Bengaluru
  { id: 'blr-01', name: 'City Railway Station CAAQMS', dataGovInName: 'City Railway Station, Bengaluru - KSPCB', city: 'Bengaluru', state: 'Karnataka', lat: 12.9781, lon: 77.5695, operator: 'KSPCB' },
  { id: 'blr-02', name: 'BTM Layout CAAQMS', dataGovInName: 'BTM Layout, Bengaluru - CPCB', city: 'Bengaluru', state: 'Karnataka', lat: 12.9166, lon: 77.6101, operator: 'CPCB' },
  { id: 'blr-03', name: 'Hebbal CAAQMS', dataGovInName: 'Hebbal, Bengaluru - KSPCB', city: 'Bengaluru', state: 'Karnataka', lat: 13.0358, lon: 77.5970, operator: 'KSPCB' },
  { id: 'blr-04', name: 'Peenya CAAQMS', dataGovInName: 'Peenya, Bengaluru - CPCB', city: 'Bengaluru', state: 'Karnataka', lat: 13.0285, lon: 77.5197, operator: 'CPCB' },
  { id: 'blr-05', name: 'Silk Board CAAQMS', dataGovInName: 'Silk Board, Bengaluru - KSPCB', city: 'Bengaluru', state: 'Karnataka', lat: 12.9175, lon: 77.6238, operator: 'KSPCB' },

  // Hyderabad
  { id: 'hyd-01', name: 'Sanathnagar CAAQMS', dataGovInName: 'Sanathnagar, Hyderabad - TSPCB', city: 'Hyderabad', state: 'Telangana', lat: 17.4565, lon: 78.4439, operator: 'TSPCB / CPCB' },
  { id: 'hyd-02', name: 'Zoo Park (Bahadurpura) CAAQMS', dataGovInName: 'Zoo Park, Hyderabad - TSPCB', city: 'Hyderabad', state: 'Telangana', lat: 17.3510, lon: 78.4526, operator: 'TSPCB' },
  { id: 'hyd-03', name: 'Bollaram Industrial Area CAAQMS', dataGovInName: 'Bollaram Industrial Area, Hyderabad - TSPCB', city: 'Hyderabad', state: 'Telangana', lat: 17.5583, lon: 78.3601, operator: 'TSPCB' },
  { id: 'hyd-04', name: 'Central University CAAQMS', dataGovInName: 'Central University, Hyderabad - CPCB', city: 'Hyderabad', state: 'Telangana', lat: 17.4600, lon: 78.3374, operator: 'CPCB' },

  // Kolkata
  { id: 'kol-01', name: 'Victoria Memorial CAAQMS', dataGovInName: 'Victoria Memorial, Kolkata - WBPCB', city: 'Kolkata', state: 'West Bengal', lat: 22.5448, lon: 88.3425, operator: 'WBPCB' },
  { id: 'kol-02', name: 'Rabindra Bharati University CAAQMS', dataGovInName: 'Rabindra Bharati University, Kolkata - WBPCB', city: 'Kolkata', state: 'West Bengal', lat: 22.6279, lon: 88.3784, operator: 'WBPCB' },
  { id: 'kol-03', name: 'Jadavpur CAAQMS', dataGovInName: 'Jadavpur, Kolkata - WBPCB', city: 'Kolkata', state: 'West Bengal', lat: 22.4988, lon: 88.3715, operator: 'WBPCB' },
  { id: 'kol-04', name: 'Fort William CAAQMS', dataGovInName: 'Fort William, Kolkata - CPCB', city: 'Kolkata', state: 'West Bengal', lat: 22.5539, lon: 88.3375, operator: 'CPCB' },

  // Chennai
  { id: 'che-01', name: 'Alandur Bus Depot CAAQMS', dataGovInName: 'Alandur Bus Depot, Chennai - CPCB', city: 'Chennai', state: 'Tamil Nadu', lat: 12.9975, lon: 80.2006, operator: 'CPCB' },
  { id: 'che-02', name: 'Manali Industrial Area CAAQMS', dataGovInName: 'Manali Industrial Area, Chennai - TNPCB', city: 'Chennai', state: 'Tamil Nadu', lat: 13.1643, lon: 80.2612, operator: 'TNPCB' },
  { id: 'che-03', name: 'Velachery Res. CAAQMS', dataGovInName: 'Velachery Res., Chennai - TNPCB', city: 'Chennai', state: 'Tamil Nadu', lat: 12.9759, lon: 80.2212, operator: 'TNPCB' },

  // Pune
  { id: 'pun-01', name: 'Shivajinagar CAAQMS', dataGovInName: 'Shivajinagar, Pune - MPCB', city: 'Pune', state: 'Maharashtra', lat: 18.5314, lon: 73.8446, operator: 'IITM / SAFAR' },
  { id: 'pun-02', name: 'Katraj CAAQMS', dataGovInName: 'Katraj, Pune - MPCB', city: 'Pune', state: 'Maharashtra', lat: 18.4575, lon: 73.8677, operator: 'MPCB' },
  { id: 'pun-03', name: 'Bhosari Industrial CAAQMS', dataGovInName: 'Bhosari Industrial, Pune - MPCB', city: 'Pune', state: 'Maharashtra', lat: 18.6271, lon: 73.8465, operator: 'MPCB' },

  // Ahmedabad
  { id: 'ahm-01', name: 'Maninagar CAAQMS', dataGovInName: 'Maninagar, Ahmedabad - GPCB', city: 'Ahmedabad', state: 'Gujarat', lat: 22.9978, lon: 72.6033, operator: 'GPCB' },
  { id: 'ahm-02', name: 'Vatva GIDC CAAQMS', dataGovInName: 'Vatva GIDC, Ahmedabad - GPCB', city: 'Ahmedabad', state: 'Gujarat', lat: 22.9572, lon: 72.6391, operator: 'GPCB' },

  // Lucknow & Kanpur
  { id: 'lko-01', name: 'Lalbagh CAAQMS', dataGovInName: 'Lalbagh, Lucknow - UPPCB', city: 'Lucknow', state: 'Uttar Pradesh', lat: 26.8467, lon: 80.9462, operator: 'UPPCB' },
  { id: 'lko-02', name: 'Talkatora CAAQMS', dataGovInName: 'Talkatora, Lucknow - UPPCB', city: 'Lucknow', state: 'Uttar Pradesh', lat: 26.8282, lon: 80.8978, operator: 'UPPCB' },
  { id: 'knp-01', name: 'Nehru Nagar CAAQMS', dataGovInName: 'Nehru Nagar, Kanpur - UPPCB', city: 'Kanpur', state: 'Uttar Pradesh', lat: 26.4710, lon: 80.3220, operator: 'UPPCB' },

  // Jaipur
  { id: 'jai-01', name: 'Adarsh Nagar CAAQMS', dataGovInName: 'Adarsh Nagar, Jaipur - RSPCB', city: 'Jaipur', state: 'Rajasthan', lat: 26.9011, lon: 75.8340, operator: 'RSPCB' },
  { id: 'jai-02', name: 'Shastri Nagar CAAQMS', dataGovInName: 'Shastri Nagar, Jaipur - RSPCB', city: 'Jaipur', state: 'Rajasthan', lat: 26.9389, lon: 75.7958, operator: 'RSPCB' },

  // Patna
  { id: 'pat-01', name: 'IGSC Planetarium CAAQMS', dataGovInName: 'IGSC Planetarium Complex, Patna - BSPCB', city: 'Patna', state: 'Bihar', lat: 25.6093, lon: 85.1376, operator: 'BSPCB' },
  { id: 'pat-02', name: 'Samanpura CAAQMS', dataGovInName: 'Samanpura, Patna - BSPCB', city: 'Patna', state: 'Bihar', lat: 25.6190, lon: 85.0872, operator: 'BSPCB' },

  // Chandigarh
  { id: 'chd-01', name: 'Sector 22 CAAQMS', dataGovInName: 'Sector-22, Chandigarh - CPCC', city: 'Chandigarh', state: 'Chandigarh', lat: 30.7298, lon: 76.7725, operator: 'CPCC' }
];

/**
 * Calculates Great-Circle distance using Haversine formula (km)
 */
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Finds the nearest monitoring station to given coordinates
 */
function findNearestStation(lat, lon) {
  if (!lat || !lon) return null;
  let nearest = null;
  let minDistance = Infinity;

  for (const station of STATIONS) {
    const dist = calculateDistanceKm(lat, lon, station.lat, station.lon);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = { ...station, distanceKm: dist };
    }
  }

  return nearest;
}

module.exports = {
  STATIONS,
  calculateDistanceKm,
  findNearestStation
};
