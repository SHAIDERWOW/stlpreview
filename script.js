import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

// --- ELEMENTOS DO DOM ---
const canvas = document.querySelector('#c'), viewerContainer = document.querySelector('#viewer-container');
const loaderOverlay = document.getElementById('loader-overlay'), themeToggle = document.getElementById('theme-toggle');
const gridToggle = document.getElementById('grid-toggle'), measureBtn = document.getElementById('measure-btn');
const clearMeasureBtn = document.getElementById('clear-measure-btn'), resetViewBtn = document.getElementById('reset-view-btn');
const selector = document.getElementById('stl-selector');
// Inputs do Estimador
const resolutionSlider = document.getElementById('resolution-slider'), resolutionInput = document.getElementById('resolution-input');
const infillSlider = document.getElementById('infill-slider'), infillInput = document.getElementById('infill-input');
const wallsSlider = document.getElementById('walls-slider'), wallsInput = document.getElementById('walls-input');
const timeEstimateSpan = document.getElementById('time-estimate');
// Display de Informações do Modelo
const modelDimsSpan = document.getElementById('model-dims');
const modelVolumeSpan = document.getElementById('model-volume');
const modelAreaSpan = document.getElementById('model-area');

// --- CENA BÁSICA ---
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(75, viewerContainer.clientWidth / viewerContainer.clientHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true, canvas: canvas }), controls = new OrbitControls(camera, renderer.domElement);
const gridHelper = new THREE.GridHelper(100, 20), initialCameraPosition = new THREE.Vector3(20, 30, 50);
scene.add(gridHelper);

function init() {
    renderer.setSize(viewerContainer.clientWidth, viewerContainer.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    camera.position.copy(initialCameraPosition);
    controls.enableDamping = true;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.5));
    const mainLight = new THREE.DirectionalLight(0xffffff, 1.5);
    mainLight.position.set(20, 50, 30);
    scene.add(mainLight);
}

// --- LÓGICA DE TEMAS ---
let isDarkMode = false;
const sceneColors = {
    light: { bg: 0xeeeeee, model: 0xcccccc, lines: 0x111111, grid: 0xbbbbbb },
    dark: { bg: 0x222222, model: 0x555555, lines: 0xcccccc, grid: 0x555555 }
};

function updateTheme(isDark) {
    isDarkMode = isDark;
    const theme = isDark ? 'dark' : 'light';
    document.body.className = isDark ? 'dark-mode' : '';
    localStorage.setItem('theme', theme);
    const colors = sceneColors[theme];
    scene.background = new THREE.Color(colors.bg);
    gridHelper.material.color.set(colors.grid);
    if (modelGroup.children.length > 0) updateModelColors();
}

// --- LÓGICA DE RENDERIZAÇÃO E CARREGAMENTO ---
const modelGroup = new THREE.Group();
scene.add(modelGroup);
const stlLoader = new STLLoader();
const threeMfLoader = new ThreeMFLoader();

function processLoadedObject(object) {
    clearMeasurements();
    while (modelGroup.children.length > 0) modelGroup.remove(modelGroup.children[0]);
    const box = new THREE.Box3().setFromObject(object);
    const center = box.getCenter(new THREE.Vector3());
    object.position.sub(center);
    modelGroup.add(object);
    updateModelColors();
    const modelBox = new THREE.Box3().setFromObject(modelGroup);
    gridHelper.position.y = modelBox.min.y;
    updateInfoDisplay(modelGroup);
    updateEstimate();
    loaderOverlay.classList.add('hidden');
}

function loadFromURL(url) {
    loaderOverlay.classList.remove('hidden');
    const extension = url.split('.').pop().toLowerCase().split('?')[0];
    if (extension === 'stl') {
        stlLoader.load(url, geometry => {
            const mesh = new THREE.Mesh(geometry);
            processLoadedObject(mesh);
        }, undefined, handleError);
    } else if (extension === '3mf') {
        threeMfLoader.load(url, processLoadedObject, undefined, handleError);
    }
}

function loadFromFile(file) {
    loaderOverlay.classList.remove('hidden');
    const extension = file.name.split('.').pop().toLowerCase();
    const reader = new FileReader();
    reader.addEventListener('load', (event) => {
        try {
            if (extension === 'stl') {
                const geometry = stlLoader.parse(event.target.result);
                const mesh = new THREE.Mesh(geometry);
                processLoadedObject(mesh);
            } else if (extension === '3mf') {
                const object = threeMfLoader.parse(event.target.result);
                processLoadedObject(object);
            }
        } catch (error) { handleError(error); }
    });
    reader.readAsArrayBuffer(file);
}

function handleError(error) {
    console.error(error);
    loaderOverlay.classList.add('hidden');
    alert('Erro ao carregar o modelo. Verifique o console para mais detalhes.');
}

function updateModelColors() {
    const colors = isDarkMode ? sceneColors.dark : sceneColors.light;
    modelGroup.traverse((child) => {
        if (child.isMesh) {
            const oldEdges = child.children.find(c => c.isLineSegments);
            if (oldEdges) child.remove(oldEdges);
            child.material = new THREE.MeshStandardMaterial({
                color: colors.model,
                metalness: 0.2,
                roughness: 0.4,
            });
            const edges = new THREE.LineSegments(
                new THREE.EdgesGeometry(child.geometry, 40),
                new THREE.LineBasicMaterial({ color: colors.lines, linewidth: 2 })
            );
            child.add(edges);
        }
    });
}

// --- EXIBIR INFORMAÇÕES DO MODELO ---
function updateInfoDisplay(group) {
    if (!group || group.children.length === 0) {
        modelDimsSpan.textContent = `X: -, Y: -, Z: -`;
        modelVolumeSpan.textContent = '-';
        modelAreaSpan.textContent = '-';
        return;
    }

    const box = new THREE.Box3().setFromObject(group);
    const size = box.getSize(new THREE.Vector3());
    modelDimsSpan.textContent = `X: ${size.x.toFixed(1)}, Y: ${size.y.toFixed(1)}, Z: ${size.z.toFixed(1)}`;

    let totalVolume = 0;
    let totalSurfaceArea = 0;
    group.traverse(child => {
        if (child.isMesh) {
            totalVolume += getMeshVolume(child.geometry);
            totalSurfaceArea += getMeshSurfaceArea(child.geometry);
        }
    });

    modelVolumeSpan.textContent = (totalVolume / 1000).toFixed(2); // de mm³ para cm³
    modelAreaSpan.textContent = (totalSurfaceArea / 100).toFixed(2); // de mm² para cm²
}


// --- FERRAMENTA DE MEDIÇÃO ---
const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(viewerContainer.clientWidth, viewerContainer.clientHeight);
labelRenderer.domElement.id = 'labels';
viewerContainer.appendChild(labelRenderer.domElement);
const raycaster = new THREE.Raycaster(), mouse = new THREE.Vector2();
let isMeasuring = false, measurementPoints = [];
const measurementGroup = new THREE.Group();
scene.add(measurementGroup);
const previewMarker = new THREE.Mesh(new THREE.SphereGeometry(0.3), new THREE.MeshBasicMaterial({ color: 0xffa500, transparent: true, opacity: 0.7 }));
previewMarker.visible = false;
scene.add(previewMarker);
const isTouchDevice = 'ontouchstart' in window;

function startMeasuring() {
    isMeasuring = true;
    controls.enabled = false;
    measureBtn.classList.add('active');
    viewerContainer.style.cursor = 'crosshair';
}

function stopMeasuring() {
    isMeasuring = false;
    controls.enabled = true;
    measureBtn.classList.remove('active');
    viewerContainer.style.cursor = 'default';
    measurementPoints = [];
    previewMarker.visible = false;
}

function clearMeasurements() {
    while (measurementGroup.children.length > 0) measurementGroup.remove(measurementGroup.children[0]);
}

viewerContainer.addEventListener('pointerdown', (event) => {
    if (!isMeasuring || !previewMarker.visible) return;
    const point = previewMarker.position.clone();
    measurementPoints.push(point);
    const markerSize = isTouchDevice ? 0.8 : 0.5;
    const marker = new THREE.Mesh(new THREE.SphereGeometry(markerSize), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
    marker.position.copy(point);
    measurementGroup.add(marker);
    if (measurementPoints.length === 2) {
        const [p1, p2] = measurementPoints;
        const distance = p1.distanceTo(p2);
        const dx = Math.abs(p1.x - p2.x), dy = Math.abs(p1.y - p2.y), dz = Math.abs(p1.z - p2.z);
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([p1, p2]), new THREE.LineBasicMaterial({ color: 0xff0000 }));
        measurementGroup.add(line);
        const labelDiv = document.createElement('div');
        labelDiv.className = 'measurement-label';
        labelDiv.innerHTML = `Distância: ${distance.toFixed(2)} mm<br>` + `&Delta;X: ${dx.toFixed(2)}, &Delta;Y: ${dy.toFixed(2)}, &Delta;Z: ${dz.toFixed(2)}`;
        const label = new CSS2DObject(labelDiv);
        label.position.copy(p1).lerp(p2, 0.5);
        measurementGroup.add(label);
        stopMeasuring();
    }
});

viewerContainer.addEventListener('pointermove', (event) => {
    if (!isMeasuring) return;
    const rect = viewerContainer.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(modelGroup.children, true);
    if (intersects.length > 0) {
        previewMarker.position.copy(intersects[0].point);
        previewMarker.visible = true;
    } else {
        previewMarker.visible = false;
    }
});

// --- ESTIMATIVA DE TEMPO DE IMPRESSÃO ---
function getMeshVolume(geometry) {
    if (!geometry.isBufferGeometry) return 0;
    let position = geometry.attributes.position;
    let triangles = geometry.index ? geometry.index.count / 3 : position.count / 3;
    let volume = 0;
    const p1 = new THREE.Vector3(), p2 = new THREE.Vector3(), p3 = new THREE.Vector3();
    for (let i = 0; i < triangles; i++) {
        let a, b, c;
        if (geometry.index) { a = geometry.index.getX(i * 3 + 0); b = geometry.index.getX(i * 3 + 1); c = geometry.index.getX(i * 3 + 2);
        } else { a = i * 3 + 0; b = i * 3 + 1; c = i * 3 + 2; }
        p1.fromBufferAttribute(position, a); p2.fromBufferAttribute(position, b); p3.fromBufferAttribute(position, c);
        volume += p1.dot(p2.clone().cross(p3)) / 6.0;
    }
    return Math.abs(volume);
}

function getMeshSurfaceArea(geometry) {
    if (!geometry.isBufferGeometry) return 0;
    let position = geometry.attributes.position;
    let triangles = geometry.index ? geometry.index.count / 3 : position.count / 3;
    let area = 0;
    const p1 = new THREE.Vector3(), p2 = new THREE.Vector3(), p3 = new THREE.Vector3();
    const v1 = new THREE.Vector3(), v2 = new THREE.Vector3();
    for (let i = 0; i < triangles; i++) {
        let a, b, c;
        if (geometry.index) { a = geometry.index.getX(i * 3 + 0); b = geometry.index.getX(i * 3 + 1); c = geometry.index.getX(i * 3 + 2);
        } else { a = i * 3 + 0; b = i * 3 + 1; c = i * 3 + 2; }
        p1.fromBufferAttribute(position, a); p2.fromBufferAttribute(position, b); p3.fromBufferAttribute(position, c);
        v1.subVectors(p2, p1); v2.subVectors(p3, p1);
        area += v1.cross(v2).length() * 0.5;
    }
    return area;
}

function updateEstimate() {
    if (modelGroup.children.length === 0) {
        timeEstimateSpan.textContent = "N/A";
        return;
    }
    const layerHeight = parseFloat(resolutionInput.value);
    const infillPercent = parseFloat(infillInput.value) / 100;
    const wallThickness = parseFloat(wallsInput.value);
    const extrusionWidth = 0.4;
    const printSpeed = 60;
    const wallSpeed = 40;
    const travelSpeedFactor = 0.15;

    let totalVolume = 0;
    let totalSurfaceArea = 0;
    modelGroup.traverse(child => {
        if (child.isMesh) {
            totalVolume += getMeshVolume(child.geometry);
            totalSurfaceArea += getMeshSurfaceArea(child.geometry);
        }
    });

    if (totalVolume === 0) { timeEstimateSpan.textContent = "Peça sem volume"; return; }
    
    const shellVolume = totalSurfaceArea * wallThickness;
    const infillVolume = Math.max(0, totalVolume - shellVolume) * infillPercent;
    const shellPrintRate = wallSpeed * extrusionWidth * layerHeight;
    const infillPrintRate = printSpeed * extrusionWidth * layerHeight;
    const shellTime = shellPrintRate > 0 ? shellVolume / shellPrintRate : 0;
    const infillTime = infillPrintRate > 0 ? infillVolume / infillPrintRate : 0;
    let totalSeconds = shellTime + infillTime;
    totalSeconds *= (1 + travelSpeedFactor);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    timeEstimateSpan.textContent = `${h}h ${m}m`;
}

// --- EVENT LISTENERS ---
selector.addEventListener('change', () => selector.value && loadFromURL(selector.value));
themeToggle.addEventListener('change', () => updateTheme(themeToggle.checked));
gridToggle.addEventListener('change', () => {
    gridHelper.visible = gridToggle.checked;
    localStorage.setItem('gridVisible', gridToggle.checked);
});
measureBtn.addEventListener('click', () => isMeasuring ? stopMeasuring() : startMeasuring());
clearMeasureBtn.addEventListener('click', clearMeasurements);
resetViewBtn.addEventListener('click', () => {
    controls.target.set(0, 0, 0);
    camera.position.copy(initialCameraPosition);
    controls.update();
});

[resolutionSlider, infillSlider, wallsSlider, resolutionInput, infillInput, wallsInput].forEach(el => {
    el.addEventListener('input', updateEstimate);
});
resolutionSlider.addEventListener('input', () => resolutionInput.value = resolutionSlider.value);
resolutionInput.addEventListener('input', () => resolutionSlider.value = resolutionInput.value);
infillSlider.addEventListener('input', () => infillInput.value = infillSlider.value);
infillInput.addEventListener('input', () => infillSlider.value = infillInput.value);
wallsSlider.addEventListener('input', () => wallsInput.value = wallsSlider.value);
wallsInput.addEventListener('input', () => wallsSlider.value = wallsInput.value);

viewerContainer.addEventListener('dragover', (event) => {
    event.preventDefault();
    viewerContainer.classList.add('drag-over');
});
viewerContainer.addEventListener('dragleave', () => {
    viewerContainer.classList.remove('drag-over');
});
viewerContainer.addEventListener('drop', (event) => {
    event.preventDefault();
    viewerContainer.classList.remove('drag-over');
    const file = event.dataTransfer.files[0];
    if (file && (file.name.toLowerCase().endsWith('.stl') || file.name.toLowerCase().endsWith('.3mf'))) {
        selector.value = "";
        loadFromFile(file);
    } else {
        alert('Por favor, solte um arquivo .STL ou .3MF válido.');
    }
});

// --- INICIALIZAÇÃO NA CARGA DA PÁGINA ---
document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const startInDark = savedTheme === 'dark' || (!savedTheme && prefersDark);
    themeToggle.checked = startInDark;
    updateTheme(startInDark);
    const gridVisible = localStorage.getItem('gridVisible') === 'true';
    gridToggle.checked = gridVisible;
    gridHelper.visible = gridVisible;
    updateEstimate();
    updateInfoDisplay(null);
});

window.addEventListener('resize', () => {
    const { clientWidth, clientHeight } = viewerContainer;
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(clientWidth, clientHeight);
    labelRenderer.setSize(clientWidth, clientHeight);
});

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
}

// --- Iniciar ---
init();
animate();