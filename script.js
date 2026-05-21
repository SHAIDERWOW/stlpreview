import * as THREE from 'three';
import { STLLoader }         from 'three/examples/jsm/loaders/STLLoader.js';
import { ThreeMFLoader }     from 'three/examples/jsm/loaders/3MFLoader.js';
import { GLTFLoader }        from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader }         from 'three/examples/jsm/loaders/OBJLoader.js';
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

// ── DOM ────────────────────────────────────────────────────────────────────────
const canvas             = document.querySelector('#c');
const viewerContainer    = document.querySelector('#viewer-container');
const loaderOverlay      = document.getElementById('loader-overlay');
const loaderProgressBar  = document.getElementById('loader-progress');
const loaderStatusText   = document.getElementById('loader-status');
const measureHint        = document.getElementById('measure-hint');
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
const camera   = new THREE.PerspectiveCamera(60, viewerContainer.clientWidth / viewerContainer.clientHeight, 0.1, 50000);
const renderer = new THREE.WebGLRenderer({ antialias: true, canvas, preserveDrawingBuffer: true, stencil: true });
let   controls;
let   gridHelper = buildGrid(500, 50);
scene.add(gridHelper);

let capPlaneMesh = null;

// ── CLIPPING STATE ─────────────────────────────────────────────────────────────
const clippingPlanes  = [ new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0) ];
let   activeClipAxis  = 'x';
let   isClippingEnabled = false;
let   useHatch        = false; // Inicia DESMARCADO (Visão Oca) por padrão

// ── SCENE COLORS ───────────────────────────────────────────────────────────────
let isDarkMode     = false;
let userModelColor = null;
const sceneColors  = {
    light: { bg: 0xeeeeee, model: 0xcccccc, lines: 0x111111, grid: 0xbbbbbb },
    dark:  { bg: 0x222222, model: 0x555555, lines: 0xcccccc, grid: 0x555555 },
};

// ── INIT ───────────────────────────────────────────────────────────────────────
function init() {
    renderer.setSize(viewerContainer.clientWidth, viewerContainer.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    camera.position.set(0, 50, 120);
    camera.up.set(0, 1, 0);

    controls = new TrackballControls(camera, renderer.domElement);
    controls.rotateSpeed          = 2.0;
    controls.zoomSpeed            = 1.2;
    controls.panSpeed             = 0.6;
    controls.staticMoving         = false;
    controls.dynamicDampingFactor = 0.15;

    scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.5));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(20, 50, 30);
    scene.add(dirLight);

    renderer.localClippingEnabled = false;
}

// ── THEME ──────────────────────────────────────────────────────────────────────
function updateTheme(isDark) {
    isDarkMode = isDark;
    document.body.className = isDark ? 'dark-mode' : '';
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    const col = sceneColors[isDark ? 'dark' : 'light'];
    scene.background = new THREE.Color(col.bg);
    gridHelper.material.color.set(col.grid);
    if (modelGroup.children.length) updateModelColors();
}

// ── MODEL GROUP ────────────────────────────────────────────────────────────────
const modelGroup  = new THREE.Group();
scene.add(modelGroup);
const stlLoader   = new STLLoader();
const tmfLoader   = new ThreeMFLoader();
const gltfLoader  = new GLTFLoader();
const objLoader   = new OBJLoader();
let   occtInstance = null;
let   currentViewMode = 'solid';

// ── PROCESS LOADED OBJECT ──────────────────────────────────────────────────────
function processLoadedObject(object) {
    clearMeasurements();
    while (modelGroup.children.length) modelGroup.remove(modelGroup.children[0]);
    partsList.innerHTML = '';
    explodeSlider.value = 0;
    disposeCapPlane();

    const b0 = new THREE.Box3().setFromObject(object);
    object.position.sub(b0.getCenter(new THREE.Vector3()));
    modelGroup.add(object);

    const originalMeshes = [];
    object.traverse((child) => {
        if (child.isMesh) originalMeshes.push(child);
    });

    let partsCount = 0;

    originalMeshes.forEach((child) => {
        partsCount++;
        const hasOwn = child.material && child.material.color && child.material.name !== '';
        
        if (!hasOwn) {
            child.material = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide });
            child.userData.isDefaultColor = true;
        } else {
            child.material.side = THREE.DoubleSide;
        }
        
        child.userData.originalMaterial = child.material;
        child.userData.normalMaterial   = new THREE.MeshNormalMaterial({ side: THREE.DoubleSide });
        
        applyClippingToMaterial(child.material);
        applyClippingToMaterial(child.userData.normalMaterial);

        // --- STENCIL PASSES FOR CLIPPING CAP ---
        // Alteração Vital: depthTest = false para garantir o cálculo perfeito de vazios
        const matBack = new THREE.MeshBasicMaterial({
            colorWrite: false, depthWrite: false, depthTest: false,
            side: THREE.BackSide, clippingPlanes: clippingPlanes,
            stencilWrite: true, stencilFunc: THREE.AlwaysStencilFunc,
            stencilFail: THREE.IncrementWrapStencilOp, 
            stencilZFail: THREE.IncrementWrapStencilOp,
            stencilZPass: THREE.IncrementWrapStencilOp
        });
        const matFront = new THREE.MeshBasicMaterial({
            colorWrite: false, depthWrite: false, depthTest: false,
            side: THREE.FrontSide, clippingPlanes: clippingPlanes,
            stencilWrite: true, stencilFunc: THREE.AlwaysStencilFunc,
            stencilFail: THREE.DecrementWrapStencilOp, 
            stencilZFail: THREE.DecrementWrapStencilOp,
            stencilZPass: THREE.DecrementWrapStencilOp
        });

        const meshBack = new THREE.Mesh(child.geometry, matBack);
        meshBack.name = "stencilBack";
        meshBack.userData.isStencil = true; 
        meshBack.renderOrder = 0.1;
        meshBack.visible = isClippingEnabled;

        const meshFront = new THREE.Mesh(child.geometry, matFront);
        meshFront.name = "stencilFront";
        meshFront.userData.isStencil = true;
        meshFront.renderOrder = 0.1;
        meshFront.visible = isClippingEnabled;

        child.add(meshBack);
        child.add(meshFront);
        // ----------------------------------------

        const wb = new THREE.Box3().setFromObject(child);
        child.userData.explodeOrigin = child.position.clone();
        child.userData.explodeDir    = wb.getCenter(new THREE.Vector3()).normalize();

        const li   = document.createElement('li');
        const span = document.createElement('span');
        span.className = 'part-name';
        span.textContent = span.title = child.name || `Peça ${partsCount}`;
        const eye = document.createElement('button');
        eye.className = 'visibility-toggle'; eye.innerHTML = '👁️'; eye.dataset.uuid = child.uuid;
        eye.addEventListener('click', (e) => {
            e.stopPropagation();
            const p = scene.getObjectByProperty('uuid', e.currentTarget.dataset.uuid);
            if (p) { p.visible = !p.visible; e.currentTarget.classList.toggle('is-hidden', !p.visible); }
        });
        li.appendChild(span); li.appendChild(eye);
        partsList.appendChild(li);
    });

    partsSectionTitle.textContent = partsCount > 1 ? 'Peças da Montagem' : 'Peça Selecionada';
    partsSection.classList.toggle('hidden', partsCount === 0);
    explodeValueLabel.textContent = '0.00';
    explodeSection.classList.toggle('hidden', partsCount <= 1);

    updateModelColors();
    const modelBox = new THREE.Box3().setFromObject(modelGroup);
    updateGrid(modelBox);
    updateClippingControls(modelBox);
    if (isClippingEnabled) buildCapPlane();

    updateInfoDisplay(modelGroup);
    updateEstimate();
    fitCameraToObject(modelGroup);
    setViewMode(currentViewMode);
    loaderProgressBar.style.width = '100%';
    setTimeout(() => loaderOverlay.classList.add('hidden'), 250);
}

function applyClippingToMaterial(mat) {
    if (!mat) return;
    mat.clippingPlanes = isClippingEnabled ? clippingPlanes : [];
    mat.clipShadows    = true;
    mat.needsUpdate    = true;
}

// ── GRID ───────────────────────────────────────────────────────────────────────
function buildGrid(size, divisions) { return new THREE.GridHelper(size, divisions); }

function updateGrid(modelBox) {
    scene.remove(gridHelper);
    if (gridHelper.geometry) gridHelper.geometry.dispose();
    if (gridHelper.material) gridHelper.material.dispose();
    const sz    = modelBox.getSize(new THREE.Vector3());
    const maxXZ = Math.max(sz.x, sz.z, 50);
    const gSize = Math.ceil(maxXZ * 6 / 10) * 10;
    const divs  = Math.min(Math.max(Math.floor(gSize / 15), 20), 120);
    gridHelper  = buildGrid(gSize, divs);
    gridHelper.position.y = modelBox.min.y;
    gridHelper.visible    = gridToggle.checked;
    gridHelper.material.color.set(sceneColors[isDarkMode ? 'dark' : 'light'].grid);
    scene.add(gridHelper);
}

// ── FIT CAMERA ─────────────────────────────────────────────────────────────────
function fitCameraToObject(object, offset = 1.6) {
    const box = new THREE.Box3().setFromObject(object);
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const size   = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    if (!maxDim) return;
    const fov  = camera.fov * (Math.PI / 180);
    const dist = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * offset;
    camera.up.set(0, 1, 0);
    camera.position.set(center.x + size.x * 0.25, center.y + size.y * 0.3, center.z + dist);
    controls.target.copy(center);
    camera.lookAt(center);
    controls.update();
}

// ── HATCH TEXTURE CREATION ──
// O Fundo Branco puro (255) multiplica com a cor da peça perfeitamente! Sem transparência.
function createHatchTexture() {
    const size = 64; 
    const data = new Uint8Array(4 * size * size);
    for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
            const isHatch = (i + j) % 16 < 2; 
            const val = isHatch ? 0 : 255; // 0 = Linha Preta, 255 = Fundo Branco (que pegará a cor da peça)
            
            const idx = 4 * (i * size + j);
            data[idx]     = val; // R
            data[idx + 1] = val; // G
            data[idx + 2] = val; // B
            data[idx + 3] = 255; // Alpha = 255 OPACO
        }
    }
    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
}

const hatchTexture = createHatchTexture();

// ── CAP PLANE — STENCIL APPROACH ───────────────────────────────────────────────
function buildCapPlane() {
    disposeCapPlane();
    if (!isClippingEnabled || !modelGroup.children.length) return;

    const col      = sceneColors[isDarkMode ? 'dark' : 'light'];
    const capColor = userModelColor || ('#' + col.model.toString(16).padStart(6, '0'));

    const box = new THREE.Box3().setFromObject(modelGroup);
    const radius = box.getBoundingSphere(new THREE.Sphere()).radius;
    const planeSize = radius * 2.5; 

    hatchTexture.repeat.set(planeSize / 8, planeSize / 8);

    const capMat = new THREE.MeshStandardMaterial({
        color:          capColor,
        roughness:      0.85,
        metalness:      0.0,
        side:           THREE.DoubleSide,
        stencilWrite:   true,
        stencilRef:     0,
        stencilFunc:    THREE.NotEqualStencilFunc,
        stencilFail:    THREE.ReplaceStencilOp,
        stencilZFail:   THREE.ReplaceStencilOp,
        stencilZPass:   THREE.ReplaceStencilOp,
        polygonOffset:       true,
        polygonOffsetFactor: -1, // Evita Z-fighting contra as arestas
        polygonOffsetUnits:  -1,
        map:            hatchTexture,
        transparent:    false, // Não é mais transparente! É uma parede sólida.
    });
    
    capPlaneMesh = new THREE.Mesh(new THREE.PlaneGeometry(planeSize, planeSize), capMat);
    capPlaneMesh.renderOrder = 1.1; 
    updateCapPlaneTransform();
    scene.add(capPlaneMesh);
}

function updateCapPlaneTransform() {
    if (!capPlaneMesh || !modelGroup.children.length) return;
    const p  = clippingPlanes[0];
    
    const box = new THREE.Box3().setFromObject(modelGroup);
    const center = box.getCenter(new THREE.Vector3());

    const distance = p.normal.dot(center) + p.constant;
    const projectedCenter = center.clone().sub(p.normal.clone().multiplyScalar(distance));

    capPlaneMesh.position.copy(projectedCenter);
    capPlaneMesh.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        p.normal.clone().negate()
    );
    
    const sliderVal = parseFloat(clippingSlider.value);
    const sliderMax = parseFloat(clippingSlider.max);
    const range     = sliderMax - parseFloat(clippingSlider.min);
    const atMax     = sliderVal >= sliderMax - range * 0.003;
    
    capPlaneMesh.visible = useHatch && !atMax;
}

function disposeCapPlane() {
    if (!capPlaneMesh) return;
    scene.remove(capPlaneMesh);
    capPlaneMesh.geometry.dispose();
    capPlaneMesh.material.dispose();
    capPlaneMesh = null;
}

// ── CLIPPING PLANE CONSTANT ────────────────────────────────────────────────────
function setClipConstant(sliderVal) {
    if (!modelGroup.children.length) return;
    const center  = new THREE.Box3().setFromObject(modelGroup).getCenter(new THREE.Vector3());
    const min     = parseFloat(clippingSlider.min);
    const max     = parseFloat(clippingSlider.max);
    const eps     = (max - min) * 0.003;
    const eff     = (sliderVal >= max - eps) ? max + eps * 4 : sliderVal;
    clippingPlanes[0].constant = eff + center[activeClipAxis];
}

// ── STEP SUPPORT ───────────────────────────────────────────────────────────────
async function getOcct() {
    if (occtInstance) return occtInstance;
    await new Promise((res, rej) => {
        if (typeof window.OcctImportJs === 'function') { res(); return; }
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/occt-import-js@0.0.22/dist/occt-import-js.js';
        s.onload  = () => setTimeout(res, 100);
        s.onerror = () => rej(new Error('Falha ao carregar occt-import-js'));
        document.head.appendChild(s);
    });
    const OcctFactory = window.OcctImportJs;
    if (typeof OcctFactory !== 'function')
        throw new Error(`occt-import-js não carregou. Converta o STEP para STL num software CAD antes de importar.`);
    occtInstance = await OcctFactory({
        locateFile: (path) =>
            path.endsWith('.wasm')
                ? 'https://cdn.jsdelivr.net/npm/occt-import-js@0.0.22/dist/occt-import-js.wasm'
                : path
    });
    return occtInstance;
}

async function loadStepFromBuffer(arrayBuffer) {
    const occt   = await getOcct();
    const result = occt.ReadStepFile(new Uint8Array(arrayBuffer), null);
    if (!result?.meshes?.length) throw new Error('Arquivo STEP sem geometria válida.');
    const group = new THREE.Group();
    result.meshes.forEach((md) => {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(md.attributes.position.array), 3));
        if (md.attributes.normal)
            geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(md.attributes.normal.array), 3));
        if (md.index) geo.setIndex(new THREE.BufferAttribute(new Uint32Array(md.index.array), 1));
        if (!md.attributes.normal) geo.computeVertexNormals();
        const mat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide });
        if (md.color) mat.color.setRGB(md.color.r / 255, md.color.g / 255, md.color.b / 255);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.userData.isDefaultColor = !md.color;
        if (md.name) mesh.name = md.name;
        group.add(mesh);
    });
    return group;
}

// ── LOADERS ────────────────────────────────────────────────────────────────────
async function loadFromURL(url) {
    showLoader();
    const ext = url.split('.').pop().toLowerCase().split('?')[0];
    if (ext === 'step' || ext === 'stp') {
        try {
            loaderStatusText.textContent = 'A descarregar STEP…';
            const resp = await fetch(url);
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            processLoadedObject(await loadStepFromBuffer(await resp.arrayBuffer()));
        } catch (err) { handleError(err); }
        return;
    }
    const onProg = (xhr) => {
        if (xhr.total > 0) {
            const pct = Math.round(xhr.loaded / xhr.total * 100);
            loaderProgressBar.style.width = `${pct}%`;
            loaderStatusText.textContent  = `Carregando… ${pct}%`;
        }
    };
    if      (ext === 'stl') { stlLoader.load(url, (g) => { const m=new THREE.Mesh(g, new THREE.MeshStandardMaterial({side: THREE.DoubleSide})); m.userData.isDefaultColor=true; processLoadedObject(m); }, onProg, handleError); }
    else if (ext === '3mf') { tmfLoader.load(url, processLoadedObject, onProg, handleError); }
    else if (ext === 'gltf' || ext === 'glb') { gltfLoader.load(url, (g) => processLoadedObject(g.scene), onProg, handleError); }
    else if (ext === 'obj') { objLoader.load(url, (obj) => { obj.traverse(c=>{if(c.isMesh){c.material=new THREE.MeshStandardMaterial({side: THREE.DoubleSide});c.userData.isDefaultColor=true;}}); processLoadedObject(obj); }, onProg, handleError); }
    else    { hideLoader(); showToast('Formato não suportado: .' + ext, 'error'); }
}

async function loadFromFile(file) {
    showLoader();
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'step' || ext === 'stp') {
        try { processLoadedObject(await loadStepFromBuffer(await file.arrayBuffer())); }
        catch (err) { handleError(err); }
        return;
    }
    const reader = new FileReader();
    reader.addEventListener('load', (e) => {
        try {
            const r = e.target.result;
            if      (ext === 'stl') { const m=new THREE.Mesh(stlLoader.parse(r), new THREE.MeshStandardMaterial({side: THREE.DoubleSide})); m.userData.isDefaultColor=true; processLoadedObject(m); }
            else if (ext === '3mf') { processLoadedObject(tmfLoader.parse(r)); }
            else if (ext === 'gltf' || ext === 'glb') { gltfLoader.parse(r, '', (g)=>processLoadedObject(g.scene), handleError); }
            else if (ext === 'obj') { const obj=objLoader.parse(r); obj.traverse(c=>{if(c.isMesh){c.material=new THREE.MeshStandardMaterial({side: THREE.DoubleSide});c.userData.isDefaultColor=true;}}); processLoadedObject(obj); }
        } catch (err) { handleError(err); }
    });
    if (ext === 'obj') reader.readAsText(file); else reader.readAsArrayBuffer(file);
}

function showLoader() { loaderProgressBar.style.width='0%'; loaderStatusText.textContent='Carregando…'; loaderOverlay.classList.remove('hidden'); }
function hideLoader()  { loaderOverlay.classList.add('hidden'); }
function handleError(err) { console.error(err); hideLoader(); showToast('Erro: ' + (err.message || 'falha ao carregar'), 'error'); }

// ── TOAST ──────────────────────────────────────────────────────────────────────
function showToast(msg, type='info') {
    const t = document.createElement('div');
    t.className=`toast toast-${type}`; t.textContent=msg;
    toastContainer.appendChild(t);
    requestAnimationFrame(()=>t.classList.add('show'));
    setTimeout(()=>{t.classList.remove('show');setTimeout(()=>t.remove(),300);},4000);
}

// ── MODEL COLORS ───────────────────────────────────────────────────────────────
function updateModelColors() {
    const col        = sceneColors[isDarkMode ? 'dark' : 'light'];
    const defHex     = '#' + col.model.toString(16).padStart(6, '0');
    const modelColor = userModelColor || defHex;
    modelGroup.traverse((child) => {
        if (!child.isMesh || child.userData.isStencil) return;
        if (child.userData.isDefaultColor) {
            child.material.color.set(modelColor);
            if (child.userData.originalMaterial) child.userData.originalMaterial.color.set(modelColor);
        }
        const oldLines = child.children.find(c => c.isLineSegments && c.userData.isEdge);
        if (oldLines) child.remove(oldLines);
        const edges = new THREE.LineSegments(
            new THREE.EdgesGeometry(child.geometry, 40),
            new THREE.LineBasicMaterial({ color: col.lines })
        );
        edges.userData.isEdge = true;
        child.add(edges);
    });
    if (capPlaneMesh) capPlaneMesh.material.color.set(modelColor);
}

modelColorInput.addEventListener('input', (e) => { userModelColor = e.target.value; updateModelColors(); });
resetColorBtn.addEventListener('click', () => {
    userModelColor = null;
    modelColorInput.value = '#' + sceneColors[isDarkMode ? 'dark' : 'light'].model.toString(16).padStart(6, '0');
    updateModelColors();
});

// ── INFO DISPLAY ───────────────────────────────────────────────────────────────
function updateInfoDisplay(group) {
    if (!group || !group.children.length) {
        modelDimsSpan.innerHTML='—'; modelVolumeSpan.textContent=modelAreaSpan.textContent='—';
        return;
    }
    const box  = new THREE.Box3().setFromObject(group);
    const size = box.getSize(new THREE.Vector3());
    modelDimsSpan.innerHTML = `X: ${size.x.toFixed(1)}<br>Y: ${size.y.toFixed(1)}<br>Z: ${size.z.toFixed(1)}`;
    let vol=0, area=0;
    group.traverse(c=>{
        if(c.isMesh && !c.userData.isStencil){
            vol+=getMeshVolume(c.geometry);
            area+=getMeshSurfaceArea(c.geometry);
        }
    });
    modelVolumeSpan.textContent=(vol/1000).toFixed(2);
    modelAreaSpan.textContent=(area/100).toFixed(2);
}

// ── LABEL RENDERER ─────────────────────────────────────────────────────────────
const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(viewerContainer.clientWidth, viewerContainer.clientHeight);
labelRenderer.domElement.id = 'labels';
viewerContainer.appendChild(labelRenderer.domElement);

// ── MEASUREMENT ────────────────────────────────────────────────────────────────
const DRAG_PX       = 8;
const raycaster     = new THREE.Raycaster();
const mouse         = new THREE.Vector2();
let   isMeasuring   = false;
let   measurePoints = [];
const measureGroup  = new THREE.Group();
scene.add(measureGroup);
let   _downPos      = null;

const previewMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.4),
    new THREE.MeshBasicMaterial({ color: 0xffa500, transparent: true, opacity: 0.75 })
);
previewMarker.visible = false;
scene.add(previewMarker);

function clearMeasurements() { while(measureGroup.children.length) measureGroup.remove(measureGroup.children[0]); }

function startMeasuring() {
    isMeasuring=true; measureBtn.classList.add('active');
    viewerContainer.classList.add('measuring'); measureHint.classList.remove('hidden');
    measurePoints=[];
}
function stopMeasuring() {
    isMeasuring=false; measureBtn.classList.remove('active');
    viewerContainer.classList.remove('measuring'); measureHint.classList.add('hidden');
    measurePoints=[]; previewMarker.visible=false; _downPos=null;
}

function getHit(cx, cy) {
    const rect=viewerContainer.getBoundingClientRect();
    mouse.x= ((cx-rect.left)/rect.width)*2-1;
    mouse.y=-((cy-rect.top)/rect.height)*2+1;
    raycaster.setFromCamera(mouse, camera);
    const validTargets = [];
    modelGroup.traverse(c => { if(c.isMesh && !c.userData.isStencil) validTargets.push(c); });
    const hits=raycaster.intersectObjects(validTargets, false);
    return hits.length>0 ? hits[0].point : null;
}

viewerContainer.addEventListener('pointermove', (e)=>{
    if (!isMeasuring || e.pointerType==='touch') return;
    const pt=getHit(e.clientX, e.clientY);
    if (pt){previewMarker.position.copy(pt);previewMarker.visible=true;}
    else    previewMarker.visible=false;
});
viewerContainer.addEventListener('pointerdown', (e)=>{
    if (!isMeasuring) return;
    _downPos={x:e.clientX, y:e.clientY};
});
viewerContainer.addEventListener('pointerup', (e)=>{
    if (!isMeasuring||!_downPos) return;
    const moved=Math.hypot(e.clientX-_downPos.x, e.clientY-_downPos.y);
    _downPos=null;
    if (moved>DRAG_PX) return;
    const pt=getHit(e.clientX, e.clientY);
    if (!pt){showToast('Clique na superfície do modelo','info');return;}
    measurePoints.push(pt.clone());
    const sz=e.pointerType==='touch'?1.0:0.5;
    const mk=new THREE.Mesh(new THREE.SphereGeometry(sz), new THREE.MeshBasicMaterial({color:0xff2222}));
    mk.position.copy(pt); measureGroup.add(mk);
    if (measurePoints.length===2) {
        const [p1,p2]=measurePoints;
        const dist=p1.distanceTo(p2);
        const dx=Math.abs(p1.x-p2.x),dy=Math.abs(p1.y-p2.y),dz=Math.abs(p1.z-p2.z);
        measureGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([p1,p2]),new THREE.LineBasicMaterial({color:0xff2222})));
        const div=document.createElement('div');
        div.className='measurement-label';
        div.innerHTML=`📏 ${dist.toFixed(2)} mm<br>ΔX ${dx.toFixed(1)} · ΔY ${dy.toFixed(1)} · ΔZ ${dz.toFixed(1)}`;
        const lbl=new CSS2DObject(div);
        lbl.position.copy(p1).lerp(p2,0.5);
        measureGroup.add(lbl);
        stopMeasuring();
    }
});

// ── GEOMETRY MATH ──────────────────────────────────────────────────────────────
function getMeshVolume(geo) {
    if (!geo.isBufferGeometry) return 0;
    const pos=geo.attributes.position, cnt=geo.index?geo.index.count/3:pos.count/3;
    let vol=0; const p1=new THREE.Vector3(),p2=new THREE.Vector3(),p3=new THREE.Vector3();
    for(let i=0;i<cnt;i++){const[a,b,c]=geo.index?[geo.index.getX(i*3),geo.index.getX(i*3+1),geo.index.getX(i*3+2)]:[i*3,i*3+1,i*3+2];p1.fromBufferAttribute(pos,a);p2.fromBufferAttribute(pos,b);p3.fromBufferAttribute(pos,c);vol+=p1.dot(p2.clone().cross(p3))/6;}
    return Math.abs(vol);
}
function getMeshSurfaceArea(geo) {
    if (!geo.isBufferGeometry) return 0;
    const pos=geo.attributes.position,cnt=geo.index?geo.index.count/3:pos.count/3;
    let area=0;const p1=new THREE.Vector3(),p2=new THREE.Vector3(),p3=new THREE.Vector3(),v1=new THREE.Vector3(),v2=new THREE.Vector3();
    for(let i=0;i<cnt;i++){const[a,b,c]=geo.index?[geo.index.getX(i*3),geo.index.getX(i*3+1),geo.index.getX(i*3+2)]:[i*3,i*3+1,i*3+2];p1.fromBufferAttribute(pos,a);p2.fromBufferAttribute(pos,b);p3.fromBufferAttribute(pos,c);v1.subVectors(p2,p1);v2.subVectors(p3,p1);area+=v1.cross(v2).length()*0.5;}
    return area;
}

// ── ESTIMATOR ──────────────────────────────────────────────────────────────────
function updateEstimate() {
    if (!modelGroup.children.length){timeEstimateSpan.textContent='N/A';return;}
    const lh=parseFloat(resolutionInput.value),inf=parseFloat(infillInput.value)/100,wt=parseFloat(wallsInput.value),spd=parseFloat(printSpeedInput.value);
    let vol=0,area=0;
    modelGroup.traverse(c=>{
        if(c.isMesh && !c.userData.isStencil){
            vol+=getMeshVolume(c.geometry);
            area+=getMeshSurfaceArea(c.geometry);
        }
    });
    if(!vol){timeEstimateSpan.textContent='Peça sem volume';return;}
    const sv=area*wt,iv=Math.max(0,vol-sv)*inf,secs=((sv/(spd*0.67*0.4*lh))+(iv/(spd*0.4*lh)))*1.15;
    timeEstimateSpan.textContent=`${Math.floor(secs/3600)}h ${Math.floor((secs%3600)/60)}m`;
    localStorage.setItem('estimator',JSON.stringify({resolution:resolutionInput.value,infill:infillInput.value,walls:wallsInput.value,printSpeed:printSpeedInput.value}));
}
function restoreEstimatorParams() {
    try{const s=JSON.parse(localStorage.getItem('estimator'));if(!s)return;if(s.resolution){resolutionInput.value=resolutionSlider.value=s.resolution;}if(s.infill){infillInput.value=infillSlider.value=s.infill;}if(s.walls){wallsInput.value=wallsSlider.value=s.walls;}if(s.printSpeed){printSpeedInput.value=printSpeedSlider.value=s.printSpeed;}}catch(_){}
}

// ── CLIPPING ───────────────────────────────────────────────────────────────────
function updateClippingControls(modelBox) {
    if (!modelBox||modelBox.isEmpty()) return;
    const size=modelBox.getSize(new THREE.Vector3());
    const half=size[activeClipAxis]/2;
    clippingSlider.min=-half; 
    clippingSlider.max=half; 
    clippingSlider.step = ((half * 2) / 1000).toString() || '0.1';
    clippingSlider.value=half;
    setClipConstant(half); updateClipLabel();
}
function updateClipLabel() {
    const min=parseFloat(clippingSlider.min),max=parseFloat(clippingSlider.max),val=parseFloat(clippingSlider.value);
    clippingValueLabel.textContent=`${max>min?Math.round(((val-min)/(max-min))*100):100}%`;
}

clippingToggle.addEventListener('change', (e)=>{
    isClippingEnabled=e.target.checked;
    renderer.localClippingEnabled=isClippingEnabled;
    clippingControls.classList.toggle('hidden',!isClippingEnabled);
    modelGroup.traverse(c=>{
        if(!c.isMesh) return;
        
        if (c.userData.isStencil) {
            c.visible = isClippingEnabled;
        } else {
            applyClippingToMaterial(c.material);
            if(c.userData.normalMaterial)   applyClippingToMaterial(c.userData.normalMaterial);
            if(c.userData.originalMaterial) applyClippingToMaterial(c.userData.originalMaterial);
        }
    });
    if(isClippingEnabled) buildCapPlane(); else disposeCapPlane();
});

axisButtons.forEach(btn=>btn.addEventListener('click',()=>{
    axisButtons.forEach(b=>b.classList.remove('active')); btn.classList.add('active');
    activeClipAxis=btn.dataset.axis;
    const n=new THREE.Vector3(); n[activeClipAxis]=-1;
    clippingPlanes[0].normal.copy(n);
    if(modelGroup.children.length) updateClippingControls(new THREE.Box3().setFromObject(modelGroup));
    if(isClippingEnabled) buildCapPlane();
}));

clippingSlider.addEventListener('input',(e)=>{
    setClipConstant(parseFloat(e.target.value));
    updateClipLabel();
    updateCapPlaneTransform();
});

// ── VIEW MODE ──────────────────────────────────────────────────────────────────
function setViewMode(mode) {
    currentViewMode=mode; localStorage.setItem('viewMode',mode);
    viewModeButtons.forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
    modelGroup.traverse(c=>{
        if(!c.isMesh || c.userData.isStencil) return;
        if(mode==='surface'){c.material=c.userData.normalMaterial||c.material;}
        else{c.material=c.userData.originalMaterial||c.material;c.material.wireframe=(mode==='wireframe');}
        applyClippingToMaterial(c.material);
    });
}
viewModeButtons.forEach(btn=>btn.addEventListener('click',()=>setViewMode(btn.dataset.mode)));

// ── EXPLODE VIEW ───────────────────────────────────────────────────────────────
explodeSlider.addEventListener('input',(e)=>{
    const f=parseFloat(e.target.value); explodeValueLabel.textContent=f.toFixed(2);
    const sz=new THREE.Box3().setFromObject(modelGroup).getSize(new THREE.Vector3());
    const max=Math.max(sz.x,sz.y,sz.z);
    modelGroup.traverse(c=>{if(!c.isMesh||!c.userData.explodeOrigin)return;const d=c.userData.explodeDir.clone();if(d.length()>0.001)c.position.copy(c.userData.explodeOrigin).addScaledVector(d,f*max*0.35);});
});

// ── SCREENSHOT ─────────────────────────────────────────────────────────────────
function generateScreenshot(bg) {
    hideScreenshotModal();
    const orig=new THREE.Vector2();renderer.getSize(orig);const origBg=scene.background;
    renderer.setSize(1920,1080);camera.aspect=1920/1080;camera.updateProjectionMatrix();
    if(bg==='transparent'){renderer.setClearAlpha(0);scene.background=null;}else{renderer.setClearAlpha(1);scene.background=new THREE.Color(bg);}
    renderer.render(scene,camera);
    const a=Object.assign(document.createElement('a'),{href:renderer.domElement.toDataURL('image/png'),download:'modelo_3d.png'});
    document.body.appendChild(a);a.click();document.body.removeChild(a);
    renderer.setSize(orig.x,orig.y);camera.aspect=orig.x/orig.y;camera.updateProjectionMatrix();
    scene.background=origBg;renderer.setClearAlpha(1);
}
function showScreenshotModal(){screenshotModal.classList.remove('hidden');}
function hideScreenshotModal(){screenshotModal.classList.add('hidden');}

// ── KEYBOARD SHORTCUTS ─────────────────────────────────────────────────────────
document.addEventListener('keydown',(e)=>{
    if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;
    if(e.key==='Escape'){if(isMeasuring)stopMeasuring();return;}
    switch(e.key.toLowerCase()){
        case 'r':fitCameraToObject(modelGroup);break;
        case 'g':gridToggle.checked=!gridToggle.checked;gridHelper.visible=gridToggle.checked;localStorage.setItem('gridVisible',gridToggle.checked);break;
        case 'm':isMeasuring?stopMeasuring():startMeasuring();break;
        case 's':if(screenshotModal.classList.contains('hidden'))showScreenshotModal();break;
    }
});

// ── CUSTOM DROPDOWN ────────────────────────────────────────────────────────────
(function(){
    const cSel=document.getElementById('custom-select'),trigger=document.getElementById('custom-select-trigger');
    const panel=document.getElementById('custom-select-panel'),label=document.getElementById('custom-select-label');
    trigger.addEventListener('click',(e)=>{e.stopPropagation();const open=!panel.classList.contains('hidden');panel.classList.toggle('hidden',open);cSel.classList.toggle('open',!open);});
    document.addEventListener('click',()=>{panel.classList.add('hidden');cSel.classList.remove('open');});
    document.querySelectorAll('.optgroup-header').forEach(h=>{
        const gid=h.dataset.group,items=document.getElementById('group-'+gid),arrow=h.querySelector('.group-arrow');
        const collapsed=localStorage.getItem('grp-'+gid)==='true';
        if(collapsed){items.classList.add('hidden');arrow.style.transform='rotate(-90deg)';}
        h.addEventListener('click',(e)=>{e.stopPropagation();const now=items.classList.toggle('hidden');arrow.style.transform=now?'rotate(-90deg)':'';localStorage.setItem('grp-'+gid,now);});
    });
    document.querySelectorAll('.custom-option').forEach(opt=>{
        opt.addEventListener('click',(e)=>{
            e.stopPropagation();
            document.querySelectorAll('.custom-option').forEach(o=>o.classList.remove('selected'));
            opt.classList.add('selected');label.textContent=opt.textContent.trim();
            selector.value=opt.dataset.value;panel.classList.add('hidden');cSel.classList.remove('open');
            selector.dispatchEvent(new Event('change'));
        });
    });
})();

// ── ACCORDION ──────────────────────────────────────────────────────────────────
(function(){
    const header=document.getElementById('estimator-header'),section=document.getElementById('estimator-section');
    if(localStorage.getItem('estimatorCollapsed')==='true')section.classList.add('collapsed');
    header.addEventListener('click',()=>{section.classList.toggle('collapsed');localStorage.setItem('estimatorCollapsed',section.classList.contains('collapsed'));});
})();

// ── EVENT WIRING & INJEÇÃO DA OPÇÃO HACHURA SÓLIDA VS OCO ─────────────────────
selector.addEventListener('change',()=>selector.value&&loadFromURL(selector.value));
themeToggle.addEventListener('change',()=>updateTheme(themeToggle.checked));
gridToggle.addEventListener('change',()=>{gridHelper.visible=gridToggle.checked;localStorage.setItem('gridVisible',gridToggle.checked);});
measureBtn.addEventListener('click',()=>isMeasuring?stopMeasuring():startMeasuring());
clearMeasureBtn.addEventListener('click',clearMeasurements);
resetViewBtn.addEventListener('click',()=>fitCameraToObject(modelGroup));

[[resolutionSlider,resolutionInput],[infillSlider,infillInput],[wallsSlider,wallsInput],[printSpeedSlider,printSpeedInput]].forEach(([sl,inp])=>{
    sl.addEventListener('input',()=>{inp.value=sl.value;updateEstimate();});
    inp.addEventListener('input',()=>{sl.value=inp.value;updateEstimate();});
});

const validExts=['.stl','.3mf','.gltf','.glb','.obj','.step','.stp'];
viewerContainer.addEventListener('dragover',e=>{e.preventDefault();viewerContainer.classList.add('drag-over');});
viewerContainer.addEventListener('dragleave',()=>viewerContainer.classList.remove('drag-over'));
viewerContainer.addEventListener('drop',e=>{
    e.preventDefault();viewerContainer.classList.remove('drag-over');
    const file=e.dataTransfer.files[0];
    if(file&&validExts.some(x=>file.name.toLowerCase().endsWith(x))){
        selector.value='';document.getElementById('custom-select-label').textContent='-- Selecione um modelo da lista --';
        document.querySelectorAll('.custom-option').forEach(o=>o.classList.remove('selected'));
        loadFromFile(file);
    }else showToast('Formato inválido. Use: STL, 3MF, OBJ, STEP, glTF, glb','error');
});

screenshotBtn.addEventListener('click',showScreenshotModal);
cancelScreenshotBtn.addEventListener('click',hideScreenshotModal);
screenshotModal.addEventListener('click',e=>{if(e.target===screenshotModal)hideScreenshotModal();});
document.querySelectorAll('.modal-btn').forEach(btn=>btn.addEventListener('click',()=>generateScreenshot(btn.dataset.bg)));

// ── DOMContentLoaded ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded',()=>{
    // Injeção do botão dinamicamente (removido o "checked" inicial a seu pedido)
    const clippingInner = document.querySelector('.clipping-inner');
    if (clippingInner && !document.getElementById('hatch-toggle')) {
        const hatchRow = document.createElement('div');
        hatchRow.className = 'clipping-axis-row';
        hatchRow.style.marginTop = '8px';
        hatchRow.innerHTML = `
            <input type="checkbox" id="hatch-toggle">
            <label for="hatch-toggle" class="label-for-check" title="Alternar entre Corte Hachurado (Maciço) e Corte Oco (Vazio)">Preencher Corte (Hachura Sólida)</label>
        `;
        clippingInner.appendChild(hatchRow);

        document.getElementById('hatch-toggle').addEventListener('change', (e) => {
            useHatch = e.target.checked;
            if (capPlaneMesh) {
                const sliderVal = parseFloat(clippingSlider.value);
                const sliderMax = parseFloat(clippingSlider.max);
                const range     = sliderMax - parseFloat(clippingSlider.min);
                const atMax     = sliderVal >= sliderMax - range * 0.003;
                capPlaneMesh.visible = useHatch && !atMax;
            }
        });
    }

    const saved=localStorage.getItem('theme'),dark=saved==='dark'||((!saved)&&window.matchMedia?.('(prefers-color-scheme: dark)').matches);
    themeToggle.checked=dark;updateTheme(dark);
    const gv=localStorage.getItem('gridVisible')==='true';gridToggle.checked=gv;gridHelper.visible=gv;
    const vm=localStorage.getItem('viewMode')||'solid';currentViewMode=vm;
    viewModeButtons.forEach(b=>b.classList.toggle('active',b.dataset.mode===vm));
    restoreEstimatorParams();updateEstimate();updateInfoDisplay(null);modelColorInput.value='#cccccc';
});

window.addEventListener('resize',()=>{
    const{clientWidth:w,clientHeight:h}=viewerContainer;
    camera.aspect=w/h;camera.updateProjectionMatrix();
    renderer.setSize(w,h);labelRenderer.setSize(w,h);controls.handleResize();
});

function animate(){requestAnimationFrame(animate);controls.update();renderer.render(scene,camera);labelRenderer.render(scene,camera);}
init();animate();
