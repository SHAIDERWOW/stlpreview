import * as THREE from 'three';
import { STLLoader }      from 'three/examples/jsm/loaders/STLLoader.js';
import { ThreeMFLoader }  from 'three/examples/jsm/loaders/3MFLoader.js';
import { GLTFLoader }     from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader }      from 'three/examples/jsm/loaders/OBJLoader.js';
import { OrbitControls }  from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

// ── DOM ────────────────────────────────────────────────────────────────────────
const canvas             = document.querySelector('#c');
const viewerContainer    = document.querySelector('#viewer-container');
const loaderOverlay      = document.getElementById('loader-overlay');
const loaderProgressBar  = document.getElementById('loader-progress');
const loaderStatusText   = document.getElementById('loader-status');
const themeToggle        = document.getElementById('theme-toggle');
const gridToggle         = document.getElementById('grid-toggle');
const measureBtn         = document.getElementById('measure-btn');
const clearMeasureBtn    = document.getElementById('clear-measure-btn');
const resetViewBtn       = document.getElementById('reset-view-btn');
const selector           = document.getElementById('stl-selector');
const resolutionSlider   = document.getElementById('resolution-slider');
const resolutionInput    = document.getElementById('resolution-input');
const infillSlider       = document.getElementById('infill-slider');
const infillInput        = document.getElementById('infill-input');
const wallsSlider        = document.getElementById('walls-slider');
const wallsInput         = document.getElementById('walls-input');
const printSpeedSlider   = document.getElementById('print-speed-slider');
const printSpeedInput    = document.getElementById('print-speed-input');
const timeEstimateSpan   = document.getElementById('time-estimate');
const modelDimsSpan      = document.getElementById('model-dims');
const modelVolumeSpan    = document.getElementById('model-volume');
const modelAreaSpan      = document.getElementById('model-area');
const screenshotBtn      = document.getElementById('screenshot-btn');
const screenshotModal    = document.getElementById('screenshot-modal-overlay');
const cancelScreenshotBtn= document.getElementById('cancel-screenshot-btn');
const partsSection       = document.querySelector('.parts-section');
const partsList          = document.getElementById('parts-list');
const partsSectionTitle  = partsSection.querySelector('h2');
const clippingToggle     = document.getElementById('clipping-toggle');
const clippingControls   = document.getElementById('clipping-controls');
const clippingSlider     = document.getElementById('clipping-slider');
const clippingValueLabel = document.getElementById('clipping-value-label');
const axisButtons        = document.querySelectorAll('.axis-btn');
const viewModeButtons    = document.querySelectorAll('.view-mode-btn');
const modelColorInput    = document.getElementById('model-color-input');
const resetColorBtn      = document.getElementById('reset-color-btn');
const explodeSection     = document.getElementById('explode-section');
const explodeSlider      = document.getElementById('explode-slider');
const explodeValueLabel  = document.getElementById('explode-value');
const toastContainer     = document.getElementById('toast-container');

// ── SCENE ──────────────────────────────────────────────────────────────────────
const scene    = new THREE.Scene();
const camera   = new THREE.PerspectiveCamera(75, viewerContainer.clientWidth / viewerContainer.clientHeight, 0.1, 10000);
const renderer = new THREE.WebGLRenderer({ antialias: true, canvas, preserveDrawingBuffer: true });
const controls = new OrbitControls(camera, renderer.domElement);
let   gridHelper = buildGrid(500, 50);
scene.add(gridHelper);

// ── CLIPPING ───────────────────────────────────────────────────────────────────
const clippingPlanes = [new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0)];
let activeClipAxis    = 'x';
let isClippingEnabled = false;

// ── SCENE COLORS ───────────────────────────────────────────────────────────────
let isDarkMode     = false;
let userModelColor = null;   // null = use theme default
const sceneColors  = {
    light: { bg: 0xeeeeee, model: 0xcccccc, lines: 0x111111, grid: 0xbbbbbb },
    dark:  { bg: 0x222222, model: 0x555555, lines: 0xcccccc, grid: 0x555555 }
};

// ── INIT ───────────────────────────────────────────────────────────────────────
function init() {
    renderer.setSize(viewerContainer.clientWidth, viewerContainer.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    camera.position.set(20, 30, 50);
    controls.enableDamping = true;
    controls.minPolarAngle = 0;
    controls.maxPolarAngle = Math.PI;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.5));
    const mainLight = new THREE.DirectionalLight(0xffffff, 1.5);
    mainLight.position.set(20, 50, 30);
    scene.add(mainLight);
    renderer.localClippingEnabled = false;
}

// ── THEME ──────────────────────────────────────────────────────────────────────
function updateTheme(isDark) {
    isDarkMode = isDark;
    const theme  = isDark ? 'dark' : 'light';
    document.body.className = isDark ? 'dark-mode' : '';
    localStorage.setItem('theme', theme);
    const colors = sceneColors[theme];
    scene.background = new THREE.Color(colors.bg);
    gridHelper.material.color.set(colors.grid);
    if (modelGroup.children.length > 0) updateModelColors();
}

// ── MODEL GROUP & LOADERS ──────────────────────────────────────────────────────
const modelGroup  = new THREE.Group();
scene.add(modelGroup);

const stlLoader   = new STLLoader();
const tmfLoader   = new ThreeMFLoader();
const gltfLoader  = new GLTFLoader();
const objLoader   = new OBJLoader();

let currentViewMode = 'solid';

// ── PROCESS LOADED OBJECT ──────────────────────────────────────────────────────
function processLoadedObject(object) {
    clearMeasurements();
    while (modelGroup.children.length > 0) modelGroup.remove(modelGroup.children[0]);
    partsList.innerHTML = '';
    explodeSlider.value = 0;

    // Centre the object
    const b0     = new THREE.Box3().setFromObject(object);
    const c0     = b0.getCenter(new THREE.Vector3());
    object.position.sub(c0);
    modelGroup.add(object);

    // Traverse: set up materials, parts list, explode data
    let partsCount = 0;
    object.traverse((child) => {
        if (!child.isMesh) return;
        partsCount++;

        // Material setup
        const hasOwnMaterial = child.material && child.material.color && child.material.name !== '';
        if (!hasOwnMaterial) {
            child.material = new THREE.MeshStandardMaterial();
            child.userData.isDefaultColor = true;
        } else {
            if (!child.material.userData) child.material.userData = {};
        }
        child.userData.originalMaterial = child.material;
        child.userData.normalMaterial   = new THREE.MeshNormalMaterial();
        applyClippingToMaterial(child.material);
        applyClippingToMaterial(child.userData.normalMaterial);

        // Explode data: world-space centre direction after centering
        const wb = new THREE.Box3().setFromObject(child);
        const wc = wb.getCenter(new THREE.Vector3());
        child.userData.explodeOrigin = child.position.clone();
        child.userData.explodeDir    = wc.clone().normalize();

        // Parts list item
        const li   = document.createElement('li');
        const span = document.createElement('span');
        span.className   = 'part-name';
        span.textContent = child.name || `Peça ${partsCount}`;
        span.title       = span.textContent;

        const eye = document.createElement('button');
        eye.className      = 'visibility-toggle';
        eye.innerHTML      = '👁️';
        eye.dataset.uuid   = child.uuid;
        eye.addEventListener('click', (e) => {
            e.stopPropagation();
            const part = scene.getObjectByProperty('uuid', e.currentTarget.dataset.uuid);
            if (part) {
                part.visible = !part.visible;
                e.currentTarget.classList.toggle('is-hidden', !part.visible);
            }
        });
        li.appendChild(span);
        li.appendChild(eye);
        partsList.appendChild(li);
    });

    // Parts section visibility
    partsSectionTitle.textContent = partsCount > 1 ? 'Peças da Montagem' : 'Peça Selecionada';
    partsSection.classList.toggle('hidden', partsCount === 0);

    // Explode slider: only useful for multi-part assemblies
    explodeValueLabel.textContent = '0.00';
    explodeSection.classList.toggle('hidden', partsCount <= 1);

    updateModelColors();

    const modelBox = new THREE.Box3().setFromObject(modelGroup);
    updateGrid(modelBox);
    updateClippingControls(modelBox);
    updateInfoDisplay(modelGroup);
    updateEstimate();
    fitCameraToObject(modelGroup);
    setViewMode(currentViewMode);

    // Finish loader
    loaderProgressBar.style.width = '100%';
    setTimeout(() => loaderOverlay.classList.add('hidden'), 250);
}

// ── CLIPPING HELPER ────────────────────────────────────────────────────────────
function applyClippingToMaterial(mat) {
    if (!mat) return;
    mat.clippingPlanes = isClippingEnabled ? clippingPlanes : [];
    mat.clipShadows    = true;
    mat.needsUpdate    = true;
}

// ── GRID ───────────────────────────────────────────────────────────────────────
function buildGrid(size, divisions) {
    return new THREE.GridHelper(size, divisions);
}

function updateGrid(modelBox) {
    scene.remove(gridHelper);
    if (gridHelper.geometry) gridHelper.geometry.dispose();
    if (gridHelper.material) gridHelper.material.dispose();

    const sz      = modelBox.getSize(new THREE.Vector3());
    const maxXZ   = Math.max(sz.x, sz.z, 50);
    const gridSz  = Math.ceil(maxXZ * 6 / 10) * 10;      // round up to neat number
    const divs    = Math.min(Math.max(Math.floor(gridSz / 15), 20), 120);
    gridHelper    = buildGrid(gridSz, divs);
    gridHelper.position.y = modelBox.min.y;
    gridHelper.visible    = gridToggle.checked;

    const col = sceneColors[isDarkMode ? 'dark' : 'light'].grid;
    gridHelper.material.color.set(col);
    scene.add(gridHelper);
}

// ── LOAD FROM URL ──────────────────────────────────────────────────────────────
function loadFromURL(url) {
    showLoader();
    const ext = url.split('.').pop().toLowerCase().split('?')[0];

    const onProgress = (xhr) => {
        if (xhr.total > 0) {
            const pct = Math.round(xhr.loaded / xhr.total * 100);
            loaderProgressBar.style.width = `${pct}%`;
            loaderStatusText.textContent  = `Carregando… ${pct}%`;
        }
    };

    if (ext === 'stl') {
        stlLoader.load(url,
            geo => {
                const mat = new THREE.MeshStandardMaterial();
                const mesh = new THREE.Mesh(geo, mat);
                mesh.userData.isDefaultColor = true;
                processLoadedObject(mesh);
            },
            onProgress, handleError);
    } else if (ext === '3mf') {
        tmfLoader.load(url, processLoadedObject, onProgress, handleError);
    } else if (ext === 'gltf' || ext === 'glb') {
        gltfLoader.load(url, gltf => processLoadedObject(gltf.scene), onProgress, handleError);
    } else if (ext === 'obj') {
        objLoader.load(url, obj => {
            obj.traverse(c => { if (c.isMesh) { c.material = new THREE.MeshStandardMaterial(); c.userData.isDefaultColor = true; } });
            processLoadedObject(obj);
        }, onProgress, handleError);
    } else {
        hideLoader();
        showToast('Formato não suportado: ' + ext, 'error');
    }
}

// ── LOAD FROM FILE ─────────────────────────────────────────────────────────────
function loadFromFile(file) {
    showLoader();
    const ext    = file.name.split('.').pop().toLowerCase();
    const reader = new FileReader();

    reader.addEventListener('load', (event) => {
        try {
            const result = event.target.result;
            if (ext === 'stl') {
                const geo  = stlLoader.parse(result);
                const mat  = new THREE.MeshStandardMaterial();
                const mesh = new THREE.Mesh(geo, mat);
                mesh.userData.isDefaultColor = true;
                processLoadedObject(mesh);
            } else if (ext === '3mf') {
                processLoadedObject(tmfLoader.parse(result));
            } else if (ext === 'gltf' || ext === 'glb') {
                gltfLoader.parse(result, '', gltf => processLoadedObject(gltf.scene), handleError);
            } else if (ext === 'obj') {
                const obj = objLoader.parse(result);   // result is text
                obj.traverse(c => { if (c.isMesh) { c.material = new THREE.MeshStandardMaterial(); c.userData.isDefaultColor = true; } });
                processLoadedObject(obj);
            }
        } catch (err) { handleError(err); }
    });

    if (ext === 'obj' || ext === 'gltf') reader.readAsText(file);
    else reader.readAsArrayBuffer(file);
}

function showLoader() {
    loaderProgressBar.style.width = '0%';
    loaderStatusText.textContent  = 'Carregando…';
    loaderOverlay.classList.remove('hidden');
}
function hideLoader() { loaderOverlay.classList.add('hidden'); }

function handleError(err) {
    console.error(err);
    hideLoader();
    showToast('Erro ao carregar o modelo. Veja o console para detalhes.', 'error');
}

// ── TOAST ──────────────────────────────────────────────────────────────────────
function showToast(msg, type = 'info') {
    const t = document.createElement('div');
    t.className   = `toast toast-${type}`;
    t.textContent = msg;
    toastContainer.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3500);
}

// ── MODEL COLORS ───────────────────────────────────────────────────────────────
function updateModelColors() {
    const colors      = sceneColors[isDarkMode ? 'dark' : 'light'];
    const hexDefault  = '#' + colors.model.toString(16).padStart(6, '0');
    const modelColor  = userModelColor || hexDefault;

    modelGroup.traverse((child) => {
        if (!child.isMesh) return;
        if (child.userData.isDefaultColor) {
            child.material.color.set(modelColor);
            if (child.userData.originalMaterial)
                child.userData.originalMaterial.color.set(modelColor);
        }
        // Re-draw edge lines
        const old = child.children.find(c => c.isLineSegments);
        if (old) child.remove(old);
        const edges = new THREE.LineSegments(
            new THREE.EdgesGeometry(child.geometry, 40),
            new THREE.LineBasicMaterial({ color: colors.lines, linewidth: 2 })
        );
        child.add(edges);
    });
}

modelColorInput.addEventListener('input', (e) => {
    userModelColor = e.target.value;
    updateModelColors();
});

resetColorBtn.addEventListener('click', () => {
    userModelColor = null;
    const hex = '#' + sceneColors[isDarkMode ? 'dark' : 'light'].model.toString(16).padStart(6, '0');
    modelColorInput.value = hex;
    updateModelColors();
});

// ── FIT CAMERA ─────────────────────────────────────────────────────────────────
function fitCameraToObject(object, offset = 1.5) {
    const box = new THREE.Box3().setFromObject(object);
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const size   = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim === 0) return;
    const fov     = camera.fov * (Math.PI / 180);
    const camDist = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * offset;
    camera.position.set(center.x, center.y + size.y * 0.2, center.z + camDist);
    controls.target.copy(center);
    camera.lookAt(center);
    controls.update();
}

// ── INFO DISPLAY ───────────────────────────────────────────────────────────────
function updateInfoDisplay(group) {
    if (!group || group.children.length === 0) {
        modelDimsSpan.textContent   = 'X: -, Y: -, Z: -';
        modelVolumeSpan.textContent = '-';
        modelAreaSpan.textContent   = '-';
        return;
    }
    const box  = new THREE.Box3().setFromObject(group);
    const size = box.getSize(new THREE.Vector3());
    modelDimsSpan.textContent = `X: ${size.x.toFixed(1)}, Y: ${size.y.toFixed(1)}, Z: ${size.z.toFixed(1)}`;
    let vol = 0, area = 0;
    group.traverse(c => { if (c.isMesh) { vol += getMeshVolume(c.geometry); area += getMeshSurfaceArea(c.geometry); } });
    modelVolumeSpan.textContent = (vol / 1000).toFixed(2);
    modelAreaSpan.textContent   = (area / 100).toFixed(2);
}

// ── LABEL RENDERER ─────────────────────────────────────────────────────────────
const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(viewerContainer.clientWidth, viewerContainer.clientHeight);
labelRenderer.domElement.id = 'labels';
viewerContainer.appendChild(labelRenderer.domElement);

// ── MEASUREMENT ────────────────────────────────────────────────────────────────
const raycaster        = new THREE.Raycaster();
const mouse            = new THREE.Vector2();
let   isMeasuring      = false;
let   measurementPoints= [];
const measurementGroup = new THREE.Group();
scene.add(measurementGroup);
const previewMarker    = new THREE.Mesh(
    new THREE.SphereGeometry(0.3),
    new THREE.MeshBasicMaterial({ color: 0xffa500, transparent: true, opacity: 0.7 })
);
previewMarker.visible = false;
scene.add(previewMarker);
const isTouchDevice = 'ontouchstart' in window;

function startMeasuring()  { isMeasuring = true;  controls.enabled = false; measureBtn.classList.add('active');    viewerContainer.style.cursor = 'crosshair'; }
function stopMeasuring()   { isMeasuring = false; controls.enabled = true;  measureBtn.classList.remove('active'); viewerContainer.style.cursor = 'default'; measurementPoints = []; previewMarker.visible = false; }
function clearMeasurements() { while (measurementGroup.children.length) measurementGroup.remove(measurementGroup.children[0]); }

viewerContainer.addEventListener('pointerdown', (event) => {
    if (!isMeasuring || !previewMarker.visible) return;
    const point = previewMarker.position.clone();
    measurementPoints.push(point);
    const sz = isTouchDevice ? 0.8 : 0.5;
    const m  = new THREE.Mesh(new THREE.SphereGeometry(sz), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
    m.position.copy(point);
    measurementGroup.add(m);

    if (measurementPoints.length === 2) {
        const [p1, p2] = measurementPoints;
        const dist = p1.distanceTo(p2);
        const dx = Math.abs(p1.x - p2.x), dy = Math.abs(p1.y - p2.y), dz = Math.abs(p1.z - p2.z);
        measurementGroup.add(new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([p1, p2]),
            new THREE.LineBasicMaterial({ color: 0xff0000 })
        ));
        const div = document.createElement('div');
        div.className   = 'measurement-label';
        div.innerHTML   = `Distância: ${dist.toFixed(2)} mm<br>ΔX: ${dx.toFixed(2)}, ΔY: ${dy.toFixed(2)}, ΔZ: ${dz.toFixed(2)}`;
        const lbl = new CSS2DObject(div);
        lbl.position.copy(p1).lerp(p2, 0.5);
        measurementGroup.add(lbl);
        stopMeasuring();
    }
});

viewerContainer.addEventListener('pointermove', (event) => {
    if (!isMeasuring) return;
    const rect = viewerContainer.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width)  *  2 - 1;
    mouse.y = -((event.clientY - rect.top)  / rect.height) *  2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(modelGroup.children, true);
    if (hits.length > 0) { previewMarker.position.copy(hits[0].point); previewMarker.visible = true; }
    else { previewMarker.visible = false; }
});

// ── GEOMETRY MATH ──────────────────────────────────────────────────────────────
function getMeshVolume(geo) {
    if (!geo.isBufferGeometry) return 0;
    const pos  = geo.attributes.position;
    const tris = geo.index ? geo.index.count / 3 : pos.count / 3;
    let vol = 0;
    const p1 = new THREE.Vector3(), p2 = new THREE.Vector3(), p3 = new THREE.Vector3();
    for (let i = 0; i < tris; i++) {
        let a, b, c;
        if (geo.index) { a = geo.index.getX(i*3); b = geo.index.getX(i*3+1); c = geo.index.getX(i*3+2); }
        else           { a = i*3; b = i*3+1; c = i*3+2; }
        p1.fromBufferAttribute(pos, a); p2.fromBufferAttribute(pos, b); p3.fromBufferAttribute(pos, c);
        vol += p1.dot(p2.clone().cross(p3)) / 6.0;
    }
    return Math.abs(vol);
}

function getMeshSurfaceArea(geo) {
    if (!geo.isBufferGeometry) return 0;
    const pos  = geo.attributes.position;
    const tris = geo.index ? geo.index.count / 3 : pos.count / 3;
    let area = 0;
    const p1 = new THREE.Vector3(), p2 = new THREE.Vector3(), p3 = new THREE.Vector3();
    const v1 = new THREE.Vector3(), v2 = new THREE.Vector3();
    for (let i = 0; i < tris; i++) {
        let a, b, c;
        if (geo.index) { a = geo.index.getX(i*3); b = geo.index.getX(i*3+1); c = geo.index.getX(i*3+2); }
        else           { a = i*3; b = i*3+1; c = i*3+2; }
        p1.fromBufferAttribute(pos, a); p2.fromBufferAttribute(pos, b); p3.fromBufferAttribute(pos, c);
        v1.subVectors(p2, p1); v2.subVectors(p3, p1);
        area += v1.cross(v2).length() * 0.5;
    }
    return area;
}

// ── ESTIMATOR ──────────────────────────────────────────────────────────────────
function updateEstimate() {
    if (modelGroup.children.length === 0) { timeEstimateSpan.textContent = 'N/A'; return; }
    const layerH    = parseFloat(resolutionInput.value);
    const infill    = parseFloat(infillInput.value) / 100;
    const wallT     = parseFloat(wallsInput.value);
    const speed     = parseFloat(printSpeedInput.value);
    const wallSpeed = speed * 0.67;
    const extW      = 0.4, travelFactor = 0.15;

    let vol = 0, area = 0;
    modelGroup.traverse(c => { if (c.isMesh) { vol += getMeshVolume(c.geometry); area += getMeshSurfaceArea(c.geometry); } });
    if (vol === 0) { timeEstimateSpan.textContent = 'Peça sem volume'; return; }

    const shellVol    = area * wallT;
    const infillVol   = Math.max(0, vol - shellVol) * infill;
    const shellRate   = wallSpeed * extW * layerH;
    const infillRate  = speed     * extW * layerH;
    const totalSecs   = ((shellRate > 0 ? shellVol / shellRate : 0) + (infillRate > 0 ? infillVol / infillRate : 0)) * (1 + travelFactor);

    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    timeEstimateSpan.textContent = `${h}h ${m}m`;
    saveEstimatorParams();
}

function saveEstimatorParams() {
    localStorage.setItem('estimator', JSON.stringify({
        resolution: resolutionInput.value,
        infill:     infillInput.value,
        walls:      wallsInput.value,
        printSpeed: printSpeedInput.value
    }));
}

function restoreEstimatorParams() {
    try {
        const s = JSON.parse(localStorage.getItem('estimator'));
        if (!s) return;
        if (s.resolution) { resolutionInput.value  = resolutionSlider.value  = s.resolution; }
        if (s.infill)     { infillInput.value       = infillSlider.value      = s.infill; }
        if (s.walls)      { wallsInput.value        = wallsSlider.value       = s.walls; }
        if (s.printSpeed) { printSpeedInput.value   = printSpeedSlider.value  = s.printSpeed; }
    } catch (_) {}
}

// ── CLIPPING ───────────────────────────────────────────────────────────────────
function updateClippingControls(modelBox) {
    if (!modelBox || modelBox.isEmpty()) return;
    const size     = modelBox.getSize(new THREE.Vector3());
    const center   = modelBox.getCenter(new THREE.Vector3());
    const halfSize = size[activeClipAxis] / 2;
    clippingSlider.min   = -halfSize;
    clippingSlider.max   =  halfSize;
    clippingSlider.value =  halfSize;   // start with nothing cut
    clippingPlanes[0].constant = halfSize + center[activeClipAxis];
    updateClipLabel();
}

function updateClipLabel() {
    const min = parseFloat(clippingSlider.min);
    const max = parseFloat(clippingSlider.max);
    const val = parseFloat(clippingSlider.value);
    const pct = max > min ? Math.round(((val - min) / (max - min)) * 100) : 100;
    clippingValueLabel.textContent = `${pct}%`;
}

clippingToggle.addEventListener('change', (e) => {
    isClippingEnabled = e.target.checked;
    renderer.localClippingEnabled = isClippingEnabled;
    clippingControls.classList.toggle('hidden', !isClippingEnabled);
    // Re-apply to all active materials
    modelGroup.traverse(c => {
        if (!c.isMesh) return;
        applyClippingToMaterial(c.material);
        if (c.userData.normalMaterial)   applyClippingToMaterial(c.userData.normalMaterial);
        if (c.userData.originalMaterial) applyClippingToMaterial(c.userData.originalMaterial);
    });
});

axisButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        axisButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeClipAxis = btn.dataset.axis;
        const normal = new THREE.Vector3(0, 0, 0);
        normal[activeClipAxis] = -1;
        clippingPlanes[0].normal.copy(normal);
        if (modelGroup.children.length > 0)
            updateClippingControls(new THREE.Box3().setFromObject(modelGroup));
    });
});

clippingSlider.addEventListener('input', (e) => {
    if (modelGroup.children.length === 0) return;
    const center = new THREE.Box3().setFromObject(modelGroup).getCenter(new THREE.Vector3());
    clippingPlanes[0].constant = parseFloat(e.target.value) + center[activeClipAxis];
    updateClipLabel();
});

// ── VIEW MODE ──────────────────────────────────────────────────────────────────
function setViewMode(mode) {
    currentViewMode = mode;
    localStorage.setItem('viewMode', mode);
    viewModeButtons.forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
    modelGroup.traverse(c => {
        if (!c.isMesh) return;
        if (mode === 'surface') {
            c.material = c.userData.normalMaterial || c.material;
        } else {
            c.material = c.userData.originalMaterial || c.material;
            c.material.wireframe = (mode === 'wireframe');
        }
        applyClippingToMaterial(c.material);   // always re-sync clipping after material swap
    });
}
viewModeButtons.forEach(btn => btn.addEventListener('click', () => setViewMode(btn.dataset.mode)));

// ── EXPLODE VIEW ───────────────────────────────────────────────────────────────
explodeSlider.addEventListener('input', (e) => {
    const factor = parseFloat(e.target.value);
    explodeValueLabel.textContent = factor.toFixed(2);
    const box    = new THREE.Box3().setFromObject(modelGroup);
    const sz     = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(sz.x, sz.y, sz.z);
    modelGroup.traverse(c => {
        if (!c.isMesh || !c.userData.explodeOrigin) return;
        const dir = c.userData.explodeDir.clone();
        if (dir.length() > 0.001)
            c.position.copy(c.userData.explodeOrigin).addScaledVector(dir, factor * maxDim * 0.35);
    });
});

// ── SCREENSHOT ─────────────────────────────────────────────────────────────────
function generateScreenshot(background) {
    hideScreenshotModal();
    const orig = new THREE.Vector2();
    renderer.getSize(orig);
    const origBg = scene.background;
    renderer.setSize(1920, 1080);
    camera.aspect = 1920 / 1080;
    camera.updateProjectionMatrix();
    if (background === 'transparent') { renderer.setClearAlpha(0); scene.background = null; }
    else { renderer.setClearAlpha(1); scene.background = new THREE.Color(background); }
    renderer.render(scene, camera);
    const url  = renderer.domElement.toDataURL('image/png');
    const link = document.createElement('a');
    link.href  = url; link.download = 'captura_modelo_3d.png';
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    renderer.setSize(orig.x, orig.y);
    camera.aspect = orig.x / orig.y;
    camera.updateProjectionMatrix();
    scene.background = origBg;
    renderer.setClearAlpha(1);
}
function showScreenshotModal() { screenshotModal.classList.remove('hidden'); }
function hideScreenshotModal() { screenshotModal.classList.add('hidden'); }

// ── KEYBOARD SHORTCUTS ─────────────────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
    if (['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)) return;
    switch (e.key.toLowerCase()) {
        case 'r': fitCameraToObject(modelGroup); break;
        case 'g':
            gridToggle.checked = !gridToggle.checked;
            gridHelper.visible = gridToggle.checked;
            localStorage.setItem('gridVisible', gridToggle.checked);
            break;
        case 's':
            if (!screenshotModal.classList.contains('hidden')) return;
            showScreenshotModal();
            break;
    }
});

// ── EVENT WIRING ───────────────────────────────────────────────────────────────
selector.addEventListener('change', () => selector.value && loadFromURL(selector.value));
themeToggle.addEventListener('change', () => updateTheme(themeToggle.checked));
gridToggle.addEventListener('change', () => { gridHelper.visible = gridToggle.checked; localStorage.setItem('gridVisible', gridToggle.checked); });
measureBtn.addEventListener('click', () => isMeasuring ? stopMeasuring() : startMeasuring());
clearMeasureBtn.addEventListener('click', clearMeasurements);
resetViewBtn.addEventListener('click', () => fitCameraToObject(modelGroup));

// Sync all estimator sliders ↔ number inputs
const estimatorPairs = [
    [resolutionSlider, resolutionInput],
    [infillSlider,     infillInput],
    [wallsSlider,      wallsInput],
    [printSpeedSlider, printSpeedInput]
];
estimatorPairs.forEach(([sl, inp]) => {
    sl.addEventListener('input',  () => { inp.value = sl.value; updateEstimate(); });
    inp.addEventListener('input', () => { sl.value  = inp.value; updateEstimate(); });
});

// Drag & drop
const validExts = ['.stl', '.3mf', '.gltf', '.glb', '.obj'];
viewerContainer.addEventListener('dragover',  e => { e.preventDefault(); viewerContainer.classList.add('drag-over'); });
viewerContainer.addEventListener('dragleave', ()  => viewerContainer.classList.remove('drag-over'));
viewerContainer.addEventListener('drop', e => {
    e.preventDefault();
    viewerContainer.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && validExts.some(x => file.name.toLowerCase().endsWith(x))) {
        selector.value = '';
        loadFromFile(file);
    } else {
        showToast('Por favor, solte um arquivo .STL, .3MF, .OBJ, .glTF ou .glb válido.', 'error');
    }
});

// Screenshot modal
screenshotBtn.addEventListener('click', showScreenshotModal);
cancelScreenshotBtn.addEventListener('click', hideScreenshotModal);
screenshotModal.addEventListener('click', e => { if (e.target === screenshotModal) hideScreenshotModal(); });
document.querySelectorAll('.modal-btn').forEach(btn => {
    btn.addEventListener('click', () => generateScreenshot(btn.getAttribute('data-bg')));
});

// ── DOMContentLoaded ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // Theme
    const savedTheme  = localStorage.getItem('theme');
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    const startDark   = savedTheme === 'dark' || (!savedTheme && prefersDark);
    themeToggle.checked = startDark;
    updateTheme(startDark);

    // Grid
    const gridVis    = localStorage.getItem('gridVisible') === 'true';
    gridToggle.checked = gridVis;
    gridHelper.visible = gridVis;

    // View mode
    const savedMode  = localStorage.getItem('viewMode') || 'solid';
    currentViewMode  = savedMode;
    viewModeButtons.forEach(b => b.classList.toggle('active', b.dataset.mode === savedMode));

    // Estimator
    restoreEstimatorParams();
    updateEstimate();
    updateInfoDisplay(null);

    // Color picker initial value matches light-mode default
    modelColorInput.value = '#cccccc';
});

// ── RESIZE ─────────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
    const { clientWidth: w, clientHeight: h } = viewerContainer;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    labelRenderer.setSize(w, h);
});

// ── RENDER LOOP ────────────────────────────────────────────────────────────────
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
}

init();
animate();
