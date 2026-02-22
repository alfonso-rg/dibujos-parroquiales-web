/**
 * Aplicación de coloreado para los dibujos dominicales
 * Parroquia San Benito de Murcia
 */

// Paleta de colores (24 colores amigables para niños)
const COLORS = [
    '#FF0000', // Rojo
    '#FF6B00', // Naranja
    '#FFD700', // Amarillo
    '#90EE90', // Verde claro
    '#228B22', // Verde oscuro
    '#00CED1', // Turquesa
    '#87CEEB', // Azul cielo
    '#0066CC', // Azul
    '#000080', // Azul marino
    '#9370DB', // Morado claro
    '#800080', // Morado
    '#FF69B4', // Rosa
    '#FFB6C1', // Rosa claro
    '#8B4513', // Marrón
    '#D2691E', // Marrón claro
    '#000000', // Negro
    '#808080', // Gris
    '#C0C0C0', // Gris claro
    '#FFFFFF', // Blanco
    '#FFDAB9', // Piel claro
    '#DEB887', // Piel medio
    '#CD853F', // Piel oscuro
    '#F5DEB3', // Trigo
    '#FFF8DC', // Crema
];

// Estado de la aplicación
let state = {
    lecturas: [],
    oraciones: [],
    selectedYear: null,       // Año activo ('oraciones' o '2023', '2024', …)
    selectedDate: null,
    selectedReading: null,
    selectedOracion: null,    // id de la oración seleccionada
    oracionPage: 0,           // índice de imagen actual en la oración
    selectedColor: COLORS[0],
    currentTool: 'fill',
    history: [],
    maxHistory: 20
};

// Referencias DOM
let canvas, ctx;
let originalImageData = null;

// Inicialización
document.addEventListener('DOMContentLoaded', init);

async function init() {
    await Promise.all([loadLecturas(), loadOraciones()]);
    buildSectionTabs();
    initColorPalette();
    initEventListeners();

    // Por defecto: seleccionar el año más reciente y la fecha más reciente
    const years = getYears();
    if (years.length > 0) {
        selectYear(years[0]);
        // Auto-seleccionar la primera fecha (más reciente) del dropdown
        const select = document.getElementById('date-select');
        if (select.options.length > 1) {
            select.selectedIndex = 1;
            select.dispatchEvent(new Event('change'));
        }
    }
}

// ─── Carga de datos ───────────────────────────────────────────────────────────

async function loadLecturas() {
    try {
        const response = await fetch('data/lecturas.json');
        state.lecturas = await response.json();
    } catch (error) {
        console.error('Error cargando lecturas:', error);
    }
}

async function loadOraciones() {
    try {
        const response = await fetch('data/oraciones.json');
        state.oraciones = await response.json();
    } catch (error) {
        console.error('Error cargando oraciones:', error);
    }
}

// ─── Tabs de sección ──────────────────────────────────────────────────────────

function getYears() {
    const years = [...new Set(state.lecturas.map(l => l.date.substring(0, 4)))];
    return years.sort((a, b) => b.localeCompare(a)); // más reciente primero
}

function buildSectionTabs() {
    const container = document.getElementById('section-tabs');
    container.innerHTML = '';

    // Tab Oraciones
    const oracionesBtn = document.createElement('button');
    oracionesBtn.className = 'tab-btn';
    oracionesBtn.dataset.section = 'oraciones';
    oracionesBtn.textContent = 'Oraciones';
    oracionesBtn.addEventListener('click', () => selectYear('oraciones'));
    container.appendChild(oracionesBtn);

    // Tabs por año
    getYears().forEach(year => {
        const btn = document.createElement('button');
        btn.className = 'tab-btn';
        btn.dataset.section = year;
        btn.textContent = year;
        btn.addEventListener('click', () => selectYear(year));
        container.appendChild(btn);
    });
}

function selectYear(year) {
    state.selectedYear = year;
    state.selectedDate = null;
    state.selectedReading = null;
    state.selectedOracion = null;
    state.oracionPage = 0;

    // Actualizar tabs activos
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.section === year);
    });

    if (year === 'oraciones') {
        document.getElementById('lecturas-panel').style.display = 'none';
        document.getElementById('oraciones-panel').style.display = 'block';
        document.getElementById('reading-buttons').style.display = 'none';
        document.getElementById('coloring-area').style.display = 'none';
        buildOracionesList();
    } else {
        document.getElementById('lecturas-panel').style.display = 'block';
        document.getElementById('oraciones-panel').style.display = 'none';
        document.getElementById('reading-buttons').style.display = 'none';
        document.getElementById('coloring-area').style.display = 'none';
        populateDateSelect(year);
    }
}

// ─── Panel lecturas ───────────────────────────────────────────────────────────

function populateDateSelect(year) {
    const select = document.getElementById('date-select');
    select.innerHTML = '<option value="">-- Selecciona una fecha --</option>';

    const filtered = state.lecturas
        .filter(l => l.date.startsWith(year))
        .sort((a, b) => b.date.localeCompare(a.date)); // más reciente primero

    filtered.forEach(lectura => {
        const option = document.createElement('option');
        option.value = lectura.date;
        option.textContent = `${lectura.dateDisplay} - ${lectura.description}`;
        select.appendChild(option);
    });
}

function onDateChange(e) {
    state.selectedDate = e.target.value;
    state.selectedReading = null;

    if (!state.selectedDate) {
        document.getElementById('reading-buttons').style.display = 'none';
        document.getElementById('coloring-area').style.display = 'none';
        return;
    }

    const lecturaData = state.lecturas.find(l => l.date === state.selectedDate);
    if (lecturaData) {
        document.getElementById('reading-buttons').style.display = 'grid';
        document.querySelectorAll('.reading-btn').forEach(btn => {
            const reading = btn.dataset.reading;
            const available = lecturaData.images.includes(reading);
            btn.disabled = !available;
            btn.classList.remove('active');
        });
    }

    document.getElementById('coloring-area').style.display = 'none';
}

// ─── Panel oraciones ──────────────────────────────────────────────────────────

function buildOracionesList() {
    const container = document.getElementById('oraciones-list');
    container.innerHTML = '';

    state.oraciones.forEach(oracion => {
        const btn = document.createElement('button');
        btn.className = 'oracion-btn';
        btn.textContent = oracion.title;
        btn.addEventListener('click', () => selectOracion(oracion.id));
        container.appendChild(btn);
    });
}

function selectOracion(id) {
    state.selectedOracion = id;
    state.oracionPage = 0;

    document.querySelectorAll('.oracion-btn').forEach(btn => {
        btn.classList.toggle('active', btn.textContent === state.oraciones.find(o => o.id === id)?.title);
    });

    document.getElementById('coloring-area').style.display = 'block';
    document.getElementById('reading-buttons').style.display = 'none';
    updatePageNav();
    loadOracionImage();
}

function updatePageNav() {
    const oracion = state.oraciones.find(o => o.id === state.selectedOracion);
    if (!oracion) return;

    const total = oracion.images.length;
    const nav = document.getElementById('page-nav');

    if (total > 1) {
        nav.style.display = 'flex';
        document.getElementById('page-indicator').textContent = `${state.oracionPage + 1} / ${total}`;
        document.getElementById('prev-page').disabled = state.oracionPage === 0;
        document.getElementById('next-page').disabled = state.oracionPage === total - 1;
    } else {
        nav.style.display = 'none';
    }
}

function loadOracionImage() {
    const oracion = state.oraciones.find(o => o.id === state.selectedOracion);
    if (!oracion) return;

    const imageName = oracion.images[state.oracionPage];
    const imagePath = `public/images/oraciones/${oracion.id}/${imageName}.png`;
    loadImageFromPath(imagePath);
}

// ─── Lectura (reading) ────────────────────────────────────────────────────────

function onReadingSelect(reading) {
    state.selectedReading = reading;

    document.querySelectorAll('.reading-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.reading === reading);
    });

    document.getElementById('coloring-area').style.display = 'block';
    document.getElementById('page-nav').style.display = 'none';

    const imagePath = `public/images/${state.selectedDate}/${state.selectedReading}.png`;
    loadImageFromPath(imagePath);
}

// ─── Carga de imagen y canvas ─────────────────────────────────────────────────

function loadImageFromPath(imagePath) {
    const loading = document.getElementById('loading');
    loading.classList.add('show');

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
        initCanvas(img);
        loading.classList.remove('show');
    };

    img.onerror = () => {
        loading.classList.remove('show');
        alert('Error cargando la imagen. Por favor, intenta de nuevo.');
    };

    img.src = imagePath;
}

function initCanvas(img) {
    canvas = document.getElementById('coloring-canvas');
    ctx = canvas.getContext('2d', { willReadFrequently: true });

    const container = canvas.parentElement;
    const maxWidth = container.clientWidth;

    canvas.width = img.width;
    canvas.height = img.height;

    ctx.drawImage(img, 0, 0);
    originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    state.history = [];

    canvas.removeEventListener('click', onCanvasClick);
    canvas.removeEventListener('touchstart', onCanvasTouch);
    canvas.addEventListener('click', onCanvasClick);
    canvas.addEventListener('touchstart', onCanvasTouch, { passive: false });
}

// ─── Paleta y herramientas ────────────────────────────────────────────────────

function initColorPalette() {
    const palette = document.getElementById('color-palette');

    COLORS.forEach((color, index) => {
        const swatch = document.createElement('div');
        swatch.className = 'color-swatch' + (index === 0 ? ' selected' : '');
        swatch.style.backgroundColor = color;
        swatch.dataset.color = color;

        if (color === '#FFFFFF' || color === '#FFF8DC' || color === '#FFDAB9') {
            swatch.style.border = '2px solid #ddd';
        }

        swatch.addEventListener('click', () => selectColor(color, swatch));
        palette.appendChild(swatch);
    });
}

function selectColor(color, swatch) {
    state.selectedColor = color;
    state.currentTool = 'fill';

    document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
    swatch.classList.add('selected');

    document.getElementById('fill-tool').classList.add('active');
    document.getElementById('eraser-tool').classList.remove('active');
}

function initEventListeners() {
    document.getElementById('date-select').addEventListener('change', onDateChange);

    document.querySelectorAll('.reading-btn').forEach(btn => {
        btn.addEventListener('click', () => onReadingSelect(btn.dataset.reading));
    });

    document.getElementById('fill-tool').addEventListener('click', () => {
        state.currentTool = 'fill';
        document.getElementById('fill-tool').classList.add('active');
        document.getElementById('eraser-tool').classList.remove('active');
    });

    document.getElementById('eraser-tool').addEventListener('click', () => {
        state.currentTool = 'eraser';
        document.getElementById('eraser-tool').classList.add('active');
        document.getElementById('fill-tool').classList.remove('active');
    });

    document.getElementById('undo-btn').addEventListener('click', undo);
    document.getElementById('download-btn').addEventListener('click', downloadImage);
    document.getElementById('reset-btn').addEventListener('click', resetCanvas);

    document.getElementById('prev-page').addEventListener('click', () => {
        if (state.oracionPage > 0) {
            state.oracionPage--;
            updatePageNav();
            loadOracionImage();
        }
    });

    document.getElementById('next-page').addEventListener('click', () => {
        const oracion = state.oraciones.find(o => o.id === state.selectedOracion);
        if (oracion && state.oracionPage < oracion.images.length - 1) {
            state.oracionPage++;
            updatePageNav();
            loadOracionImage();
        }
    });
}

// ─── Canvas / flood fill ──────────────────────────────────────────────────────

function getCanvasCoordinates(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX, clientY;
    if (e.touches) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else {
        clientX = e.clientX;
        clientY = e.clientY;
    }

    return {
        x: Math.floor((clientX - rect.left) * scaleX),
        y: Math.floor((clientY - rect.top) * scaleY)
    };
}

function onCanvasClick(e) {
    const coords = getCanvasCoordinates(e);
    performAction(coords.x, coords.y);
}

function onCanvasTouch(e) {
    e.preventDefault();
    const coords = getCanvasCoordinates(e);
    performAction(coords.x, coords.y);
}

function performAction(x, y) {
    saveToHistory();
    if (state.currentTool === 'fill') {
        floodFill(x, y, state.selectedColor);
    } else {
        floodFill(x, y, '#FFFFFF');
    }
}

function saveToHistory() {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    state.history.push(imageData);
    if (state.history.length > state.maxHistory) {
        state.history.shift();
    }
}

function undo() {
    if (state.history.length > 0) {
        const previousState = state.history.pop();
        ctx.putImageData(previousState, 0, 0);
    }
}

/**
 * Algoritmo Flood Fill optimizado con tolerancia para anti-aliasing
 */
function floodFill(startX, startY, fillColor) {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const width = canvas.width;
    const height = canvas.height;

    const startPos = (startY * width + startX) * 4;
    const startR = data[startPos];
    const startG = data[startPos + 1];
    const startB = data[startPos + 2];

    const fillRGB = hexToRgb(fillColor);

    if (colorMatch(startR, startG, startB, fillRGB.r, fillRGB.g, fillRGB.b, 10)) return;

    const isLineColor = (r, g, b) => (r + g + b) / 3 < 80;
    if (isLineColor(startR, startG, startB)) return;

    const tolerance = 50;

    const matchStartColor = (pos) => {
        const r = data[pos];
        const g = data[pos + 1];
        const b = data[pos + 2];
        if (isLineColor(r, g, b)) return false;
        return colorMatch(r, g, b, startR, startG, startB, tolerance);
    };

    const queue = [[startX, startY]];
    const visited = new Set();
    visited.add(`${startX},${startY}`);

    while (queue.length > 0) {
        const [x, y] = queue.shift();
        if (x < 0 || x >= width || y < 0 || y >= height) continue;

        const pos = (y * width + x) * 4;
        if (!matchStartColor(pos)) continue;

        data[pos] = fillRGB.r;
        data[pos + 1] = fillRGB.g;
        data[pos + 2] = fillRGB.b;
        data[pos + 3] = 255;

        for (const [nx, ny] of [[x+1,y],[x-1,y],[x,y+1],[x,y-1]]) {
            const key = `${nx},${ny}`;
            if (!visited.has(key)) {
                visited.add(key);
                queue.push([nx, ny]);
            }
        }
    }

    ctx.putImageData(imageData, 0, 0);
}

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
}

function colorMatch(r1, g1, b1, r2, g2, b2, tolerance) {
    return Math.abs(r1-r2) <= tolerance &&
           Math.abs(g1-g2) <= tolerance &&
           Math.abs(b1-b2) <= tolerance;
}

// ─── Descarga y reset ─────────────────────────────────────────────────────────

function downloadImage() {
    const link = document.createElement('a');
    let filename;

    if (state.selectedOracion) {
        const oracion = state.oraciones.find(o => o.id === state.selectedOracion);
        const page = state.oracionPage + 1;
        filename = `${oracion.title.replace(/\s+/g,'_')}_p${page}_coloreado.png`;
    } else {
        const lecturaData = state.lecturas.find(l => l.date === state.selectedDate);
        const readingNames = {
            lectura1: 'Primera_Lectura',
            salmo: 'Salmo',
            lectura2: 'Segunda_Lectura',
            evangelio: 'Evangelio'
        };
        filename = `${state.selectedDate}_${readingNames[state.selectedReading]}_coloreado.png`;
    }

    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
}

function resetCanvas() {
    if (originalImageData && confirm('¿Seguro que quieres borrar todo y empezar de nuevo?')) {
        ctx.putImageData(originalImageData, 0, 0);
        state.history = [];
    }
}
