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
        this.boneHelper = null;
        this.boneAxisHelper = null;
        this.boneSphere = null;
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
        
        // 디버깅
        console.log('모델 추가됨:', model);
        this.printModelStructure(model);
    }
    
    printModelStructure(object, indent = 0) {
        if (!this.debugMode) return;
        
        const indentStr = ' '.repeat(indent * 2);
        let type = 'Object3D';
        
        if (object.isMesh) type = 'Mesh';
        if (object.isBone) type = 'Bone';
        if (object.isLight) type = 'Light';
        if (object.isCamera) type = 'Camera';
        
        console.log(`${indentStr}${object.name || 'unnamed'} [${type}] uuid: ${object.uuid}`);
        
        if (object.children) {
            object.children.forEach(child => {
                this.printModelStructure(child, indent + 1);
            });
        }
    }
    
    getCurrentModel() {
        return this.currentModel;
    }
    
    highlightBone(bones, boneUuid) {
        // 이전 강조 표시 해제
        if (this.highlightedBone) {
            this.resetBoneHighlight();
        }
        
        console.log(`본 강조 시도: ${boneUuid}`);
        
        // 활성화된 본 찾기
        const activeBone = bones.find(bone => bone.uuid === boneUuid);
        if (!activeBone) {
            console.warn(`지정된 UUID에 해당하는 본을 찾을 수 없음: ${boneUuid}`);
            console.log('사용 가능한 본 UUID:');
            bones.forEach(b => console.log(`${b.name}: ${b.uuid}`));
            return;
        }
        
        console.log(`본 찾음: ${activeBone.name}, UUID: ${activeBone.uuid}`);
        this.highlightedBone = activeBone;
        
        // 본에 BoxHelper 추가 (시각적으로 본 위치 표시)
        const boneHelper = new THREE.BoxHelper(activeBone, 0xff0000);
        this.scene.add(boneHelper);
        this.boneHelper = boneHelper;
        
        // !!중요!! - 이제 메시 색상은 변경하지 않고 대신 본 자체만 강조
        
        // 본 자체를 시각적으로 강조
        const boneViz = new THREE.AxesHelper(0.1);  // 크기 증가
        activeBone.add(boneViz);
        this.boneAxisHelper = boneViz;
        
        // 본을 둘러싸는 반투명한 구체 추가
        const sphereGeometry = new THREE.SphereGeometry(0.05, 16, 16);
        const sphereMaterial = new THREE.MeshBasicMaterial({
            color: 0x4285f4,
            transparent: true,
            opacity: 0.5
        });
        const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        activeBone.add(sphere);
        this.boneSphere = sphere;
        
        console.log(`본 강조 표시 완료: ${activeBone.name}`);
    }
    
    // 본과 연결된 메시 찾기
    findBoneLinkedMeshes(bone) {
        const linkedMeshes = [];
        
        // 1. 본의 직계 자식 중 메시만 찾기 (첫 번째 레벨만)
        if (bone.children) {
            bone.children.forEach(child => {
                if ((child.isMesh || child.isSkinnedMesh)) {
                    linkedMeshes.push(child);
                    console.log(`본 ${bone.name}의 직접 자식 메시 발견: ${child.name}`);
                }
            });
        }
        
        // 2. 스키닝 메시에서 이 본을 직접 사용하는 경우만 (영향도 체크)
        if (this.currentModel) {
            this.currentModel.traverse(obj => {
                if (obj.isSkinnedMesh && obj.skeleton) {
                    // 이 스키닝 메시가 이 본을 사용하는지 확인
                    const boneIndex = obj.skeleton.bones.findIndex(b => b.uuid === bone.uuid);
                    if (boneIndex >= 0) {
                        // 영향도 체크 (가능하다면)
                        if (obj.skeleton.boneInverses && obj.skeleton.boneInverses[boneIndex]) {
                            linkedMeshes.push(obj);
                            console.log(`본 ${bone.name}을 사용하는 스키닝 메시 발견: ${obj.name}`);
                        }
                    }
                }
            });
        }
        
        // 결과 중복 제거
        return [...new Set(linkedMeshes)];
    }
    
    // 메시에 하이라이트 적용 (본과 관련된 부분만)
    applyHighlightToMesh(mesh, bone) {
        if (!mesh || !mesh.material) return;
        
        try {
            // 원본 재질 백업
            if (!this.originalMaterials.has(mesh.uuid)) {
                if (Array.isArray(mesh.material)) {
                    // 다중 재질인 경우 모든 재질 복제
                    const originalMaterials = mesh.material.map(mat => mat.clone());
                    this.originalMaterials.set(mesh.uuid, originalMaterials);
                } else {
                    this.originalMaterials.set(mesh.uuid, mesh.material.clone());
                }
                console.log(`원본 재질 저장: ${mesh.name}`);
            }
            
            // 스키닝 메시인 경우 본의 인덱스 찾기
            let boneIndex = -1;
            if (mesh.isSkinnedMesh && mesh.skeleton) {
                boneIndex = mesh.skeleton.bones.findIndex(b => b.uuid === bone.uuid);
            }
            
            // 강조 색상 적용 
            const highlightColor = new THREE.Color(0x4285f4);
            
            if (Array.isArray(mesh.material)) {
                // 다중 재질 처리
                mesh.material = mesh.material.map(mat => {
                    if (!mat) return null;
                    
                    const newMat = mat.clone();
                    newMat.emissive = highlightColor;
                    newMat.emissiveIntensity = 0.5;
                    
                    // 스키닝 메시인 경우 더 뚜렷하게
                    if (boneIndex >= 0) {
                        newMat.emissiveIntensity = 0.7;
                    }
                    
                    newMat.needsUpdate = true;
                    return newMat;
                });
            } else {
                // 단일 재질 처리
                const newMaterial = mesh.material.clone();
                newMaterial.emissive = highlightColor;
                newMaterial.emissiveIntensity = 0.5;
                
                // 스키닝 메시인 경우 더 뚜렷하게
                if (boneIndex >= 0) {
                    newMaterial.emissiveIntensity = 0.7;
                }
                
                newMaterial.needsUpdate = true;
                mesh.material = newMaterial;
            }
            
            console.log(`강조 색상 적용됨: ${mesh.name}`);
        } catch (e) {
            console.error(`재질 적용 중 오류 (${mesh.name}): ${e.message}`);
        }
    }
    
    resetBoneHighlight() {
        if (!this.highlightedBone) return;
        
        console.log(`본 강조 해제: ${this.highlightedBone.name}`);
        
        // BoxHelper 제거
        if (this.boneHelper) {
            this.scene.remove(this.boneHelper);
            this.boneHelper = null;
        }
        
        // 본에 추가된 AxesHelper 제거
        if (this.boneAxisHelper && this.highlightedBone) {
            this.highlightedBone.remove(this.boneAxisHelper);
            this.boneAxisHelper = null;
        }
        
        // 본에 추가된 반투명 구체 제거
        if (this.boneSphere && this.highlightedBone) {
            this.highlightedBone.remove(this.boneSphere);
            this.boneSphere = null;
        }
        
        // 원래는 메시 재질을 복원했지만, 이제 메시 색상을 변경하지 않으므로 필요 없음
        // 혹시 있을 수 있는 메시 재질 데이터 초기화
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