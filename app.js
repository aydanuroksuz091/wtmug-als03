// ====== Sabitler ======
const GEO_API = "https://geocoding-api.open-meteo.com/v1/search";
const WEATHER_API = "https://api.open-meteo.com/v1/forecast";

// ====== DOM Elemanları ======
const $ = (id) => document.getElementById(id);
const cityInput = $("cityInput");
const searchBtn = $("searchBtn");
const locationBtn = $("locationBtn");
const errorMsg = $("errorMsg");
const loading = $("loading");
const currentWeather = $("currentWeather");
const forecast = $("forecast");
const forecastList = $("forecastList");
const offlineBanner = $("offlineBanner");
const themeToggle = $("themeToggle");

// ====== Hava Durumu Kodlarını Açıklamaya Çevir ======
function weatherInfo(code) {
  const map = {
    0:  { desc: "Açık",             icon: "☀️" },
    1:  { desc: "Az bulutlu",       icon: "🌤️" },
    2:  { desc: "Parçalı bulutlu",  icon: "⛅" },
    3:  { desc: "Kapalı",           icon: "☁️" },
    45: { desc: "Sisli",            icon: "🌫️" },
    48: { desc: "Kırağılı sis",     icon: "🌫️" },
    51: { desc: "Hafif çisenti",    icon: "🌦️" },
    53: { desc: "Çisenti",          icon: "🌦️" },
    55: { desc: "Yoğun çisenti",    icon: "🌧️" },
    61: { desc: "Hafif yağmur",     icon: "🌧️" },
    63: { desc: "Yağmurlu",         icon: "🌧️" },
    65: { desc: "Şiddetli yağmur",  icon: "🌧️" },
    71: { desc: "Hafif kar",        icon: "🌨️" },
    73: { desc: "Kar yağışlı",      icon: "❄️" },
    75: { desc: "Yoğun kar",        icon: "❄️" },
    80: { desc: "Sağanak yağış",    icon: "🌦️" },
    81: { desc: "Sağanak",          icon: "🌧️" },
    82: { desc: "Şiddetli sağanak", icon: "⛈️" },
    95: { desc: "Gök gürültülü",    icon: "⛈️" },
    96: { desc: "Dolulu fırtına",   icon: "⛈️" },
    99: { desc: "Şiddetli fırtına", icon: "⛈️" },
  };
  return map[code] || { desc: "Bilinmiyor", icon: "❓" };
}

// ====== Tarih Formatı ======
function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "short" });
}

function formatDateTime(date) {
  return date.toLocaleString("tr-TR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}

// ====== Arayüz Yardımcıları ======
function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.classList.remove("hidden");
  setTimeout(() => errorMsg.classList.add("hidden"), 5000);
}

function showLoading(show) {
  loading.classList.toggle("hidden", !show);
}

function hideContent() {
  currentWeather.classList.add("hidden");
  forecast.classList.add("hidden");
}

// ====== Şehir Arama (Geocoding) ======
async function searchCity(cityName) {
  if (!cityName.trim()) {
    showError("Lütfen bir şehir adı girin.");
    return;
  }

  if (!navigator.onLine) {
    showError("İnternet bağlantısı yok.");
    return;
  }

  showLoading(true);
  hideContent();
  errorMsg.classList.add("hidden");

  try {
    const url = `${GEO_API}?name=${encodeURIComponent(cityName)}&count=1&language=tr&format=json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Geocoding hatası");
    const data = await res.json();

    if (!data.results || data.results.length === 0) {
      showError(`"${cityName}" bulunamadı. Lütfen geçerli bir şehir adı girin.`);
      showLoading(false);
      return;
    }

    const { latitude, longitude, name, country } = data.results[0];
    await getWeather(latitude, longitude, `${name}, ${country || ""}`.trim());
  } catch (err) {
    console.error(err);
    showError("Şehir aranırken bir hata oluştu.");
  } finally {
    showLoading(false);
  }
}

// ====== Konum ile Hava Durumu ======
function getLocationWeather() {
  if (!navigator.geolocation) {
    showError("Tarayıcınız konum servisini desteklemiyor.");
    return;
  }

  showLoading(true);
  hideContent();
  errorMsg.classList.add("hidden");

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const { latitude, longitude } = pos.coords;

      let placeName = "Konumunuz";
      try {
        const reverseUrl = `https://geocoding-api.open-meteo.com/v1/search?latitude=${latitude}&longitude=${longitude}&language=tr&count=1`;
        const res = await fetch(reverseUrl);
        const data = await res.json();

        if (data.results && data.results.length > 0) {
          const r = data.results[0];
          placeName = r.admin1 ? `${r.name}, ${r.admin1}` : r.name;
        }
      } catch (e) {
        console.warn("Ters geocoding başarısız:", e);
      }

      await getWeather(latitude, longitude, placeName);
      showLoading(false);
    },
    (err) => {
      showLoading(false);
      if (err.code === err.PERMISSION_DENIED) {
        showError("Konum izni verilmedi.");
      } else {
        showError("Konum alınamadı.");
      }
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}
// ====== Hava Durumu Verisi Çek ======
async function getWeather(lat, lon, placeName) {
  try {
    const params = new URLSearchParams({
      latitude: lat,
      longitude: lon,
      current: "temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code",
      daily: "weather_code,temperature_2m_max,temperature_2m_min",
      timezone: "auto",
      forecast_days: "5",
      temperature_unit: "celsius",
      wind_speed_unit: "kmh",
    });

    const res = await fetch(`${WEATHER_API}?${params}`);
    if (!res.ok) throw new Error("Hava durumu API hatası");
    const data = await res.json();

    renderCurrent(data, placeName);
    renderForecast(data.daily);

    currentWeather.classList.remove("hidden");
    forecast.classList.remove("hidden");
  } catch (err) {
    console.error(err);
    showError("Hava durumu verisi alınamadı.");
  }
}

// ====== Güncel Hava Durumunu Render Et ======
function renderCurrent(data, placeName) {
  const cur = data.current;
  const info = weatherInfo(cur.weather_code);

  $("cityName").textContent = placeName;
  $("currentTemp").textContent = Math.round(cur.temperature_2m);
  $("currentDesc").textContent = info.desc;
  $("humidity").textContent = cur.relative_humidity_2m;
  $("wind").textContent = Math.round(cur.wind_speed_10m);

  // İkon olarak emoji kullanıyoruz (harici görsel bağımlılığı yok)
  const iconEl = $("currentIcon");
  iconEl.replaceWith(createEmojiIcon(info.icon, "currentIcon"));

  // Son güncelleme tarihi
  $("updateTime").textContent = formatDateTime(new Date());
}

function createEmojiIcon(emoji, id) {
  const span = document.createElement("span");
  span.id = id;
  span.textContent = emoji;
  span.style.fontSize = "64px";
  span.style.lineHeight = "1";
  return span;
}

// ====== 5 Günlük Tahmini Render Et ======
function renderForecast(daily) {
  forecastList.innerHTML = "";
  for (let i = 0; i < daily.time.length; i++) {
    const info = weatherInfo(daily.weather_code[i]);
    const max = Math.round(daily.temperature_2m_max[i]);
    const min = Math.round(daily.temperature_2m_min[i]);

    const item = document.createElement("div");
    item.className = "forecast-item";
    item.innerHTML = `
      <span class="day">${i === 0 ? "Bugün" : formatDate(daily.time[i])}</span>
      <span style="font-size:1.6rem;">${info.icon}</span>
      <span class="temps">
        <span class="max">${max}°</span> / 
        <span class="min">${min}°</span>
      </span>
    `;
    forecastList.appendChild(item);
  }
}

// ====== Çevrimiçi / Çevrimdışı İzleme ======
function updateOnlineStatus() {
  if (navigator.onLine) {
    offlineBanner.classList.add("hidden");
  } else {
    offlineBanner.classList.remove("hidden");
  }
}
window.addEventListener("online", updateOnlineStatus);
window.addEventListener("offline", updateOnlineStatus);

// ====== Tema (Açık / Koyu Mod) ======
function initTheme() {
  const saved = localStorage.getItem("theme");
  if (saved === "dark") {
    document.body.classList.add("dark");
    themeToggle.textContent = "☀️";
  } else {
    themeToggle.textContent = "🌙";
  }
}

themeToggle.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  const isDark = document.body.classList.contains("dark");
  localStorage.setItem("theme", isDark ? "dark" : "light");
  themeToggle.textContent = isDark ? "☀️" : "🌙";
});

// ====== Event Bağlamaları ======
searchBtn.addEventListener("click", () => searchCity(cityInput.value));
cityInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") searchCity(cityInput.value);
});
locationBtn.addEventListener("click", getLocationWeather);

// ====== Service Worker Kaydı ======
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("sw.js")
      .then((reg) => console.log("SW kayıtlı:", reg.scope))
      .catch((err) => console.error("SW kayıt hatası:", err));
  });
}

// ====== Başlangıç ======
initTheme();
updateOnlineStatus();