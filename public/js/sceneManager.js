// sceneManager.js - Three.js 장면 관리
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
export class SceneManager {
    constructor() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x202020);
        
        this.setupCamera();
        this.setupRenderer();
        this.setupLights();
        this.setupControls();
        
        // 좌표축 헬퍼 추가
        const axesHelper = new THREE.AxesHelper(3);
        this.scene.add(axesHelper);
        
        this.mixer = null;
        this.currentModel = null;
        this.highlightedBone = null;
        this.highlightedMaterial = new THREE.MeshStandardMaterial({
            color: 0x4285f4,
            emissive: 0x4285f4,
            emissiveIntensity: 0.5,
            transparent: true,
            opacity: 0.8
        });
        this.originalMaterials = new Map();
        
        // 디버깅 정보
        this.debugMode = true;
    }
    
    setupCamera() {
        const container = document.getElementById('scene-container');
        const aspect = container.clientWidth / container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
        this.camera.position.z = 5;
    }
    
    setupRenderer() {
        const container = document.getElementById('scene-container');
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        container.appendChild(this.renderer.domElement);
    }
    
    setupLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(0, 10, 10);
        this.scene.add(directionalLight);
    }
    
    setupControls() {
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
    }
    
    handleResize() {
        const container = document.getElementById('scene-container');
        if (!container || !this.camera || !this.renderer) return;
        
        this.camera.aspect = container.clientWidth / container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(container.clientWidth, container.clientHeight);
    }
    
    addModelToScene(model) {
        // 이전 모델 제거
        if (this.currentModel) {
            this.scene.remove(this.currentModel);
            this.currentModel = null;
        }
        
        this.currentModel = model;
        
        // 모델 크기 조정 및 위치 조정
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3()).length();
        const center = box.getCenter(new THREE.Vector3());
        
        model.position.x -= center.x;
        model.position.y -= center.y;
        model.position.z -= center.z;
        
        // 카메라 위치 조정
        this.camera.position.copy(center);
        this.camera.position.x += size;
        this.camera.position.y += size / 3;
        this.camera.position.z += size;
        this.camera.lookAt(center);
        this.controls.target.copy(center);
        
        this.scene.add(model);
    }
    
    highlightBone(bones, boneUuid) {
        // 이전 강조 표시 해제
        if (this.highlightedBone) {
            this.resetBoneHighlight();
        }
        
        // 활성화된 본 찾기
        const activeBone = bones.find(bone => bone.uuid === boneUuid);
        if (!activeBone) return;
        
        this.highlightedBone = activeBone;
        
        // 본 자체에 대한 시각적 표현 추가
        const boneVisualizer = new THREE.BoxHelper(activeBone, 0x4285f4);
        activeBone.add(boneVisualizer);
        activeBone.userData.visualizer = boneVisualizer;
        
        // 본과 관련된 메시 찾기
        const relatedMeshes = [];
        this.findRelatedMeshes(activeBone, relatedMeshes);
        
        // 관련 메시가 없는 경우, 자식 본까지 재귀적으로 검색
        if (relatedMeshes.length === 0) {
            this.findChildBonesAndMeshes(activeBone, relatedMeshes);
        }
        
        // 찾아낸 메시의 재질 변경
        relatedMeshes.forEach(mesh => {
            if (mesh.isMesh && mesh.material) {
                // 원본 재질 저장
                this.originalMaterials.set(mesh.uuid, mesh.material.clone());
                
                // 새 강조 재질 생성
                const highlightMat = new THREE.MeshStandardMaterial({
                    color: 0x4285f4,
                    emissive: 0x4285f4,
                    emissiveIntensity: 0.5,
                    transparent: true,
                    opacity: 0.8
                });
                
                // 재질 적용
                mesh.material = highlightMat;
                mesh.material.needsUpdate = true;
            }
        });
        
        // 디버깅 메시지
        console.log(`본 강조: ${activeBone.name}, 관련 메시: ${relatedMeshes.length}개`);
    }
    
    findRelatedMeshes(bone, meshes) {
        // 본의 직계 자식 중 메시 찾기
        if (bone.children) {
            bone.children.forEach(child => {
                if (child.isMesh && child.material) {
                    meshes.push(child);
                }
            });
        }
        
        // 본의 형제 메시 찾기 (같은 부모를 가진 메시)
        if (bone.parent && bone.parent.children) {
            bone.parent.children.forEach(sibling => {
                if (sibling.isMesh && sibling.material) {
                    // 이 메시가 본과 관련 있는지 확인 (이름으로 유추)
                    if (sibling.name.includes(bone.name) || bone.name.includes(sibling.name)) {
                        meshes.push(sibling);
                    }
                }
            });
        }
    }
    
    findChildBonesAndMeshes(bone, meshes) {
        // 이 본의 모든 자식 본을 탐색하며 메시 찾기
        if (bone.children) {
            bone.children.forEach(child => {
                if (child.isMesh && child.material) {
                    meshes.push(child);
                } else if (child.isBone) {
                    // 재귀적으로 자식 본의 메시 찾기
                    this.findRelatedMeshes(child, meshes);
                    this.findChildBonesAndMeshes(child, meshes);
                } else {
                    // 본이나 메시가 아닌 객체의 자식도 검사
                    this.findChildBonesAndMeshes(child, meshes);
                }
            });
        }
    }
    
    resetBoneHighlight() {
        if (!this.highlightedBone) return;
        
        // BoxHelper 제거
        if (this.highlightedBone.userData.visualizer) {
            this.highlightedBone.remove(this.highlightedBone.userData.visualizer);
            this.highlightedBone.userData.visualizer = null;
        }
        
        // 관련 메시 재질 복원
        this.originalMaterials.forEach((material, uuid) => {
            // 씬에서 해당 UUID를 가진 객체 찾기
            const object = this.findObjectByUuid(this.scene, uuid);
            if (object && object.isMesh) {
                object.material = material;
                object.material.needsUpdate = true;
            }
        });
        
        // 원본 재질 맵 초기화
        this.originalMaterials.clear();
        this.highlightedBone = null;
    }
    
    findObjectByUuid(object, uuid) {
        if (object.uuid === uuid) {
            return object;
        }
        
        if (object.children) {
            for (const child of object.children) {
                const found = this.findObjectByUuid(child, uuid);
                if (found) return found;
            }
        }
        
        return null;
    }
    
    update() {
        if (this.controls) {
            this.controls.update();
        }
        
        if (this.mixer) {
            this.mixer.update(0.01);
        }
        
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }
    
    getRenderer() {
        return this.renderer;
    }
    
    getCamera() {
        return this.camera;
    }
    
    getScene() {
        return this.scene;
    }
}