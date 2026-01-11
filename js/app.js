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
    selectedDate: null,
    selectedReading: null,
    selectedColor: COLORS[0],
    currentTool: 'fill', // 'fill' or 'eraser'
    history: [],
    maxHistory: 20
};

// Referencias DOM
let canvas, ctx;
let originalImageData = null;

// Inicialización
document.addEventListener('DOMContentLoaded', init);

async function init() {
    // Cargar datos de lecturas
    await loadLecturas();

    // Inicializar elementos
    initColorPalette();
    initEventListeners();
}

async function loadLecturas() {
    try {
        const response = await fetch('data/lecturas.json');
        state.lecturas = await response.json();
        populateDateSelect();
    } catch (error) {
        console.error('Error cargando lecturas:', error);
        alert('Error cargando los datos. Por favor, recarga la página.');
    }
}

function populateDateSelect() {
    const select = document.getElementById('date-select');

    // Ordenar por fecha descendente (más recientes primero)
    const sorted = [...state.lecturas].sort((a, b) => b.date.localeCompare(a.date));

    sorted.forEach(lectura => {
        const option = document.createElement('option');
        option.value = lectura.date;
        option.textContent = `${lectura.dateDisplay} - ${lectura.description}`;
        select.appendChild(option);
    });
}

function initColorPalette() {
    const palette = document.getElementById('color-palette');

    COLORS.forEach((color, index) => {
        const swatch = document.createElement('div');
        swatch.className = 'color-swatch' + (index === 0 ? ' selected' : '');
        swatch.style.backgroundColor = color;
        swatch.dataset.color = color;

        // Borde visible para colores claros
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

    // Actualizar UI
    document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
    swatch.classList.add('selected');

    document.getElementById('fill-tool').classList.add('active');
    document.getElementById('eraser-tool').classList.remove('active');
}

function initEventListeners() {
    // Selector de fecha
    document.getElementById('date-select').addEventListener('change', onDateChange);

    // Botones de lectura
    document.querySelectorAll('.reading-btn').forEach(btn => {
        btn.addEventListener('click', () => onReadingSelect(btn.dataset.reading));
    });

    // Herramientas
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

    // Botones de acción
    document.getElementById('download-btn').addEventListener('click', downloadImage);
    document.getElementById('reset-btn').addEventListener('click', resetCanvas);
}

function onDateChange(e) {
    state.selectedDate = e.target.value;
    state.selectedReading = null;

    if (!state.selectedDate) {
        document.getElementById('reading-buttons').style.display = 'none';
        document.getElementById('coloring-area').style.display = 'none';
        return;
    }

    // Mostrar botones de lectura
    const lecturaData = state.lecturas.find(l => l.date === state.selectedDate);

    if (lecturaData) {
        document.getElementById('reading-buttons').style.display = 'grid';

        // Habilitar/deshabilitar botones según las imágenes disponibles
        document.querySelectorAll('.reading-btn').forEach(btn => {
            const reading = btn.dataset.reading;
            const available = lecturaData.images.includes(reading);
            btn.disabled = !available;
            btn.classList.remove('active');
        });
    }

    document.getElementById('coloring-area').style.display = 'none';
}

function onReadingSelect(reading) {
    state.selectedReading = reading;

    // Actualizar UI de botones
    document.querySelectorAll('.reading-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.reading === reading);
    });

    // Mostrar área de coloreado y cargar imagen
    document.getElementById('coloring-area').style.display = 'block';
    loadImage();
}

function loadImage() {
    const loading = document.getElementById('loading');
    loading.classList.add('show');

    const imagePath = `public/images/${state.selectedDate}/${state.selectedReading}.png`;

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

    // Ajustar tamaño del canvas
    const container = canvas.parentElement;
    const maxWidth = container.clientWidth;
    const scale = maxWidth / img.width;

    canvas.width = img.width;
    canvas.height = img.height;

    // Dibujar imagen
    ctx.drawImage(img, 0, 0);

    // Guardar imagen original
    originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Limpiar historial
    state.history = [];

    // Event listeners para canvas
    canvas.removeEventListener('click', onCanvasClick);
    canvas.removeEventListener('touchstart', onCanvasTouch);

    canvas.addEventListener('click', onCanvasClick);
    canvas.addEventListener('touchstart', onCanvasTouch, { passive: false });
}

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
    // Guardar estado para deshacer
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

    // Limitar historial
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

    // Obtener color del pixel inicial
    const startPos = (startY * width + startX) * 4;
    const startR = data[startPos];
    const startG = data[startPos + 1];
    const startB = data[startPos + 2];
    const startA = data[startPos + 3];

    // Convertir color de relleno
    const fillRGB = hexToRgb(fillColor);

    // Si el color inicial es similar al de relleno, no hacer nada
    if (colorMatch(startR, startG, startB, fillRGB.r, fillRGB.g, fillRGB.b, 10)) {
        return;
    }

    // Tolerancia para líneas de dibujo (negras/oscuras)
    const isLineColor = (r, g, b) => {
        return (r + g + b) / 3 < 80; // Considerar oscuro si promedio < 80
    };

    // No rellenar líneas
    if (isLineColor(startR, startG, startB)) {
        return;
    }

    // Tolerancia para matching de colores (para anti-aliasing)
    const tolerance = 50;

    const matchStartColor = (pos) => {
        const r = data[pos];
        const g = data[pos + 1];
        const b = data[pos + 2];

        // No atravesar líneas oscuras
        if (isLineColor(r, g, b)) return false;

        // Coincide con color inicial dentro de tolerancia
        return colorMatch(r, g, b, startR, startG, startB, tolerance);
    };

    // Cola para BFS (más eficiente que recursión)
    const queue = [[startX, startY]];
    const visited = new Set();
    visited.add(`${startX},${startY}`);

    while (queue.length > 0) {
        const [x, y] = queue.shift();

        if (x < 0 || x >= width || y < 0 || y >= height) continue;

        const pos = (y * width + x) * 4;

        if (!matchStartColor(pos)) continue;

        // Rellenar pixel
        data[pos] = fillRGB.r;
        data[pos + 1] = fillRGB.g;
        data[pos + 2] = fillRGB.b;
        data[pos + 3] = 255;

        // Añadir vecinos
        const neighbors = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];

        for (const [nx, ny] of neighbors) {
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
    return Math.abs(r1 - r2) <= tolerance &&
           Math.abs(g1 - g2) <= tolerance &&
           Math.abs(b1 - b2) <= tolerance;
}

function downloadImage() {
    const link = document.createElement('a');

    // Nombre del archivo
    const lecturaData = state.lecturas.find(l => l.date === state.selectedDate);
    const readingNames = {
        lectura1: 'Primera_Lectura',
        salmo: 'Salmo',
        lectura2: 'Segunda_Lectura',
        evangelio: 'Evangelio'
    };

    const filename = `${state.selectedDate}_${readingNames[state.selectedReading]}_coloreado.png`;

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
