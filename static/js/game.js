import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

class Game {
    constructor() {
        this.container = document.getElementById('game-container');
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000000); // Set black background
        
        // Use a wider FOV for better visibility
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            alpha: false, // Disable alpha to prevent transparency
            physicallyCorrectLights: true
        });
        this.renderer.setClearColor(0x000000, 1); // Set clear color to black
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        
        this.loader = new GLTFLoader();
        this.clock = new THREE.Clock();
        
        this.init();
        this.createScene();
        this.animate();
    }

    calculateResponsiveScale() {
        // Base scale on viewport size
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const smallestDimension = Math.min(viewportWidth, viewportHeight);
        
        // Calculate a scale factor (smaller screens = smaller model)
        // These values can be adjusted based on your needs
        const baseScale = 0.05;
        const scaleFactor = (smallestDimension / 1920) * baseScale;
        
        return Math.max(scaleFactor, 0.02); // Ensure minimum scale
    }

    init() {
        // Setup renderer
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.container.appendChild(this.renderer.domElement);

        // Setup camera - position further back for better view
        this.camera.position.z = 15;

        // Setup controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.maxDistance = 30;
        this.controls.minDistance = 5;

        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize(), false);
    }

    createScene() {
        // Add space background (enhanced star field)
        const starGeometry = new THREE.BufferGeometry();
        const starMaterial = new THREE.PointsMaterial({ 
            color: 0xFFFFFF,
            size: 0.15,
            transparent: true,
            opacity: 1,
            sizeAttenuation: true,
            fog: false
        });
        
        const starVertices = [];
        for(let i = 0; i < 2000; i++) {
            const x = (Math.random() - 0.5) * 2000;
            const y = (Math.random() - 0.5) * 2000;
            const z = (Math.random() - 0.5) * 2000;
            starVertices.push(x, y, z);
        }
        
        starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
        this.stars = new THREE.Points(starGeometry, starMaterial);
        this.scene.add(this.stars);

        // Enhanced lighting setup
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
        this.scene.add(ambientLight);

        const mainLight = new THREE.DirectionalLight(0xffffff, 2);
        mainLight.position.set(5, 5, 5);
        mainLight.castShadow = true;
        mainLight.shadow.mapSize.width = 2048;
        mainLight.shadow.mapSize.height = 2048;
        mainLight.shadow.camera.near = 0.1;
        mainLight.shadow.camera.far = 100;
        mainLight.shadow.bias = -0.0001;
        this.scene.add(mainLight);

        // Add rim light for dramatic effect
        const rimLight = new THREE.DirectionalLight(0x0044ff, 1);
        rimLight.position.set(-5, 2, -5);
        this.scene.add(rimLight);

        // Add subtle blue fill light
        const fillLight = new THREE.DirectionalLight(0x0044ff, 0.3);
        fillLight.position.set(0, -5, 0);
        this.scene.add(fillLight);

        // Load X-Wing model
        this.loadXWingModel();
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);

        // Update model scale when window is resized
        if (this.xwing) {
            const newScale = this.calculateResponsiveScale();
            this.xwing.scale.set(newScale, newScale, newScale);
        }
    }

    loadXWingModel() {
        // Show loading message with style
        const loadingDiv = document.createElement('div');
        loadingDiv.style.position = 'absolute';
        loadingDiv.style.top = '50%';
        loadingDiv.style.left = '50%';
        loadingDiv.style.transform = 'translate(-50%, -50%)';
        loadingDiv.style.color = '#FFE81F'; // Star Wars yellow
        loadingDiv.style.fontSize = '24px';
        loadingDiv.style.fontFamily = 'Arial, sans-serif';
        loadingDiv.style.textShadow = '0 0 10px rgba(255, 232, 31, 0.5)';
        loadingDiv.textContent = 'Loading X-Wing model...';
        this.container.appendChild(loadingDiv);

        this.loader.load(
            '/static/models/X-wing.glb',
            (gltf) => {
                this.xwing = gltf.scene;
                
                // Apply responsive scaling
                const scale = this.calculateResponsiveScale();
                this.xwing.scale.set(scale, scale, scale);
                this.xwing.position.set(0, 0, 0); // Center position
                
                // Rotate model to face forward
                this.xwing.rotation.set(0, Math.PI, 0);
                
                // Add the model to the scene
                this.scene.add(this.xwing);
                
                // Setup better camera position - further back for better view
                this.camera.position.set(0, 3, 15);
                this.camera.lookAt(this.xwing.position);
                
                // Adjust orbit controls
                this.controls.target.copy(this.xwing.position);
                this.controls.minDistance = 2;
                this.controls.maxDistance = 10;
                
                // Add shadows
                this.xwing.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                        // Enhance material
                        if (child.material) {
                            child.material.metalness = 0.7;
                            child.material.roughness = 0.3;
                        }
                    }
                });
                
                // Remove loading message
                loadingDiv.remove();
            },
            (xhr) => {
                const progress = (xhr.loaded / xhr.total) * 100;
                loadingDiv.textContent = `Loading X-Wing model... ${Math.round(progress)}%`;
            },
            (error) => {
                console.error('Error loading X-Wing model:', error);
                loadingDiv.textContent = 'Error loading X-Wing model';
                // Fall back to placeholder model
                const geometry = new THREE.ConeGeometry(0.5, 1, 4);
                const material = new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true });
                this.xwing = new THREE.Mesh(geometry, material);
                this.scene.add(this.xwing);
            }
        );
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        const delta = this.clock.getDelta();
        const elapsedTime = this.clock.getElapsedTime();

        // Animate stars slightly
        if (this.stars) {
            this.stars.rotation.y += delta * 0.05;
        }

        // Enhanced X-Wing animation
        if (this.xwing) {
            // Gentle floating motion
            this.xwing.position.y = Math.sin(elapsedTime * 0.5) * 0.1;
            
            // Subtle tilting
            this.xwing.rotation.z = Math.sin(elapsedTime * 0.7) * 0.05;
            this.xwing.rotation.x = Math.sin(elapsedTime * 0.4) * 0.05;
            
            // Very slight continuous rotation
            this.xwing.rotation.y = Math.sin(elapsedTime * 0.2) * 0.1;
        }

        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}

// Start the game when the page loads
window.addEventListener('load', () => {
    new Game();
});
