// Curated V1 meteor shower data from AMS/IMO-style public fields.
// Dates are annual approximate activity windows; peak solar longitude is retained where useful.
export const METEOR_SHOWERS = [
  { name: "Quadrantids", radiant: "Bootes", raHours: 15.3, dec: 49, activeStart: "12-28", activeEnd: "01-12", peak: "01-03", solarLongitude: 283, zhr: 80, velocityKmS: 41, parent: "2003 EH1" },
  { name: "Lyrids", radiant: "Lyra", raHours: 18.1, dec: 34, activeStart: "04-16", activeEnd: "04-25", peak: "04-22", solarLongitude: 32, zhr: 18, velocityKmS: 49, parent: "C/1861 G1 Thatcher" },
  { name: "Eta Aquariids", radiant: "Aquarius", raHours: 22.5, dec: -1, activeStart: "04-19", activeEnd: "05-28", peak: "05-06", solarLongitude: 45, zhr: 50, velocityKmS: 66, parent: "1P/Halley" },
  { name: "Arietids", radiant: "Aries", raHours: 2.9, dec: 24, activeStart: "05-22", activeEnd: "07-02", peak: "06-07", solarLongitude: 76, zhr: 30, velocityKmS: 39, parent: "96P/Machholz complex" },
  { name: "Southern Delta Aquariids", radiant: "Aquarius", raHours: 22.7, dec: -16, activeStart: "07-12", activeEnd: "08-23", peak: "07-30", solarLongitude: 127, zhr: 25, velocityKmS: 41, parent: "96P/Machholz" },
  { name: "Perseids", radiant: "Perseus", raHours: 3.2, dec: 58, activeStart: "07-17", activeEnd: "08-24", peak: "08-12", solarLongitude: 140, zhr: 100, velocityKmS: 59, parent: "109P/Swift-Tuttle" },
  { name: "Draconids", radiant: "Draco", raHours: 17.5, dec: 54, activeStart: "10-06", activeEnd: "10-10", peak: "10-08", solarLongitude: 195, zhr: 10, velocityKmS: 20, parent: "21P/Giacobini-Zinner" },
  { name: "Orionids", radiant: "Orion", raHours: 6.3, dec: 16, activeStart: "10-02", activeEnd: "11-07", peak: "10-21", solarLongitude: 208, zhr: 20, velocityKmS: 66, parent: "1P/Halley" },
  { name: "Leonids", radiant: "Leo", raHours: 10.2, dec: 22, activeStart: "11-06", activeEnd: "11-30", peak: "11-17", solarLongitude: 235, zhr: 15, velocityKmS: 71, parent: "55P/Tempel-Tuttle" },
  { name: "Geminids", radiant: "Gemini", raHours: 7.5, dec: 32, activeStart: "12-04", activeEnd: "12-20", peak: "12-14", solarLongitude: 262, zhr: 120, velocityKmS: 35, parent: "3200 Phaethon" },
  { name: "Ursids", radiant: "Ursa Minor", raHours: 14.5, dec: 76, activeStart: "12-17", activeEnd: "12-26", peak: "12-22", solarLongitude: 270, zhr: 10, velocityKmS: 33, parent: "8P/Tuttle" }
];
