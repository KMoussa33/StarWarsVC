import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

class Game {
    constructor() {
        this.container = document.getElementById('game-container');
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.loader = new GLTFLoader();
        this.clock = new THREE.Clock();
        
        this.init();
        this.createScene();
        this.animate();
    }

    init() {
        // Setup renderer
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.container.appendChild(this.renderer.domElement);

        // Setup camera
        this.camera.position.z = 5;

        // Setup controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;

        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize(), false);
    }

    createScene() {
        // Add space background (enhanced star field)
        const starGeometry = new THREE.BufferGeometry();
        const starMaterial = new THREE.PointsMaterial({ 
            color: 0xFFFFFF,
            size: 0.1,
            transparent: true,
            opacity: 0.8,
            sizeAttenuation: true
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

        // Add lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(5, 5, 5);
        this.scene.add(directionalLight);

        // Load X-Wing model
        this.loadXWingModel();
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    loadXWingModel() {
        // Show loading message
        const loadingDiv = document.createElement('div');
        loadingDiv.style.position = 'absolute';
        loadingDiv.style.top = '50%';
        loadingDiv.style.left = '50%';
        loadingDiv.style.transform = 'translate(-50%, -50%)';
        loadingDiv.style.color = 'white';
        loadingDiv.style.fontSize = '24px';
        loadingDiv.textContent = 'Loading X-Wing model...';
        this.container.appendChild(loadingDiv);

        this.loader.load(
            '/static/models/X-wing.glb',
            (gltf) => {
                this.xwing = gltf.scene;
                this.xwing.scale.set(0.5, 0.5, 0.5); // Adjust scale as needed
                this.scene.add(this.xwing);
                
                // Position the camera to view the model
                this.camera.position.set(0, 2, 5);
                this.camera.lookAt(this.xwing.position);
                
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

        // Animate stars slightly
        if (this.stars) {
            this.stars.rotation.y += delta * 0.05;
        }

        // Gentle floating motion for X-Wing
        if (this.xwing) {
            this.xwing.position.y = Math.sin(this.clock.getElapsedTime() * 0.5) * 0.1;
            this.xwing.rotation.y += delta * 0.2;
        }

        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}

// Start the game when the page loads
window.addEventListener('load', () => {
    new Game();
});
