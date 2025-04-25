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
        
        // 본 포인트 관련 변수
        this.bonePoints = new Map();
        this.bonePointsGroup = null;
        this.bonePointsVisible = false;
        this.pointClickListener = null;
        this.mouseMoveHandler = null;
        
        // 디버깅 정보
        this.debugMode = true;
    }
    
    setupCamera() {
        const container = document.getElementById('scene-container');
        const aspect = container.clientWidth / container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 2000);
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
    
    getHighlightedBone() {
        return this.highlightedBone;
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
    
    resetBoneHighlight() {
        if (!this.highlightedBone) {
            console.log("강조된 본이 없어 초기화 필요 없음");
            return;
        }
        
        console.log(`본 강조 해제: ${this.highlightedBone.name}, UUID: ${this.highlightedBone.uuid}`);
        
        // BoxHelper 제거
        if (this.boneHelper) {
            this.scene.remove(this.boneHelper);
            this.boneHelper = null;
            console.log("BoxHelper 제거됨");
        }
        
        // 본에 추가된 AxesHelper 제거
        if (this.boneAxisHelper && this.highlightedBone) {
            this.highlightedBone.remove(this.boneAxisHelper);
            this.boneAxisHelper = null;
            console.log("AxesHelper 제거됨");
        }
        
        // 본에 추가된 반투명 구체 제거
        if (this.boneSphere && this.highlightedBone) {
            this.highlightedBone.remove(this.boneSphere);
            this.boneSphere = null;
            console.log("반투명 구체 제거됨");
        }
        
        // 사용했던 변수 초기화
        const prevBoneUuid = this.highlightedBone.uuid;
        this.highlightedBone = null;
        this.originalMaterials.clear();
        
        console.log(`본 강조 초기화 완료: ${prevBoneUuid}`);
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
    
    // 본 위치에 선택 가능한 포인트 추가
    addBonePoints(bones, clickCallback) {
        // 기존 본 포인트 제거
        this.removeBonePoints();
        
        // 본 포인트를 담을 그룹 생성
        this.bonePointsGroup = new THREE.Group();
        this.bonePointsGroup.name = 'bonePoints';
        this.scene.add(this.bonePointsGroup);
        
        // 본 포인트 맵 초기화 (UUID -> 포인트 객체)
        this.bonePoints = new Map();
        
        // 각 본마다 선택 가능한 포인트 생성
        bones.forEach(bone => {
            // 작은 구체 생성
            const sphereGeometry = new THREE.SphereGeometry(0.03, 8, 8);
            const sphereMaterial = new THREE.MeshBasicMaterial({
                color: 0xffa500,  // 주황색
                transparent: true,
                opacity: 0.8,
                depthTest: true
            });
            const point = new THREE.Mesh(sphereGeometry, sphereMaterial);
            
            // 본 위치에 포인트 배치
            point.position.copy(bone.position);
            
            // 포인트 데이터 설정
            point.userData.type = 'bonePoint';
            point.userData.boneUuid = bone.uuid;
            point.userData.boneName = bone.name;
            point.userData.originalColor = new THREE.Color(0xffa500);
            
            // 본 이름 툴팁 추가
            point.userData.tooltip = bone.name;
            
            // 본 계층구조 따라 추가
            bone.add(point);
            
            // 맵에 저장
            this.bonePoints.set(bone.uuid, point);
            
            // 처음엔 숨김 상태로
            point.visible = false;
        });
        
        // 레이캐스터 설정
        this.setupBonePointRaycaster(clickCallback);
        
        console.log(`${bones.length}개의 본 포인트 추가됨`);
    }
    
    // 본 포인트 레이캐스터 설정
    setupBonePointRaycaster(clickCallback) {
        const raycaster = new THREE.Raycaster();
        raycaster.params.Points.threshold = 0.1;  // 포인트 감지 임계값
        
        // 이전 클릭 리스너 제거
        if (this.pointClickListener) {
            this.renderer.domElement.removeEventListener('click', this.pointClickListener);
        }
        
        // 현재 호버된 포인트
        let hoveredPoint = null;
        
        // 마우스 이동 이벤트 핸들러 (호버 효과용)
        const mouseMoveHandler = (event) => {
            // 본 선택 모드가 비활성화되어 있으면 무시
            if (!this.bonePointsVisible) return;
            
            // 마우스 위치를 정규화된 장치 좌표로 변환
            const rect = this.renderer.domElement.getBoundingClientRect();
            const mouse = new THREE.Vector2();
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            
            // 레이캐스트 업데이트
            raycaster.setFromCamera(mouse, this.camera);
            
            // 본 포인트와의 교차점 확인
            const intersects = raycaster.intersectObjects(this.scene.children, true);
            
            // 이전 호버 효과 제거
            if (hoveredPoint) {
                hoveredPoint.material.color.copy(hoveredPoint.userData.originalColor);
                hoveredPoint.material.opacity = 0.8;
                hoveredPoint.scale.set(1, 1, 1);
                
                // 커서 스타일 복원
                this.renderer.domElement.style.cursor = 'auto';
                
                hoveredPoint = null;
            }
            
            // 새 호버 효과 적용
            for (let i = 0; i < intersects.length; i++) {
                const object = intersects[i].object;
                
                // 본 포인트인지 확인
                if (object.userData && object.userData.type === 'bonePoint' && object.visible) {
                    // 호버 효과 적용
                    object.material.color.set(0xff0000);  // 빨간색으로 변경
                    object.material.opacity = 1.0;  // 불투명도 증가
                    object.scale.set(1.2, 1.2, 1.2);  // 크기 증가
                    
                    // 커서 스타일 변경
                    this.renderer.domElement.style.cursor = 'pointer';
                    
                    // 호버된 포인트 저장
                    hoveredPoint = object;
                    
                    break;
                }
            }
        };
        
        // 클릭 이벤트 핸들러
        this.pointClickListener = (event) => {
            // 본 선택 모드가 비활성화되어 있으면 무시
            if (!this.bonePointsVisible) return;
            
            // 마우스 위치를 정규화된 장치 좌표로 변환
            const rect = this.renderer.domElement.getBoundingClientRect();
            const mouse = new THREE.Vector2();
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            
            // 레이캐스트 업데이트
            raycaster.setFromCamera(mouse, this.camera);
            
            // 본 포인트와의 교차점 확인
            const intersects = raycaster.intersectObjects(this.scene.children, true);
            
            // 첫 번째 교차 객체 찾기
            for (let i = 0; i < intersects.length; i++) {
                const object = intersects[i].object;
                
                // 본 포인트인지 확인
                if (object.userData && object.userData.type === 'bonePoint' && object.visible) {
                    const boneUuid = object.userData.boneUuid;
                    const boneName = object.userData.boneName;
                    
                    console.log(`본 포인트 클릭됨: ${boneName}, UUID: ${boneUuid}`);
                    
                    // 클릭 효과 적용
                    object.material.color.set(0xffff00);  // 노란색 깜박임
                    setTimeout(() => {
                        if (object) {
                            object.material.color.copy(object.userData.originalColor);
                        }
                    }, 200);
                    
                    // 콜백 호출
                    if (clickCallback) {
                        clickCallback(boneUuid);
                    }
                    
                    break;
                }
            }
        };
        
        // 이벤트 리스너 추가
        this.renderer.domElement.addEventListener('click', this.pointClickListener);
        this.renderer.domElement.addEventListener('mousemove', mouseMoveHandler);
        
        // 저장 (나중에 제거하기 위함)
        this.mouseMoveHandler = mouseMoveHandler;
    }
    
    // 본 점 표시/숨김 토글
    toggleBonePoints(visible) {
        this.bonePointsVisible = visible;
        
        if (this.bonePoints) {
            this.bonePoints.forEach(point => {
                point.visible = visible;
            });
        }
        
        // 본 선택 모드가 비활성화되면 모델 클릭 모드로 돌아감
        if (!visible) {
            // 커서 스타일 복원
            if (this.renderer && this.renderer.domElement) {
                this.renderer.domElement.style.cursor = 'auto';
            }
        }
        
        console.log(`본 포인트 ${visible ? '표시' : '숨김'}`);
    }
    
    // 본 포인트 제거
    removeBonePoints() {
        if (this.bonePointsGroup) {
            this.scene.remove(this.bonePointsGroup);
            this.bonePointsGroup = null;
        }
        
        // 각 본에 추가된 포인트 제거
        if (this.bonePoints) {
            this.bonePoints.forEach((point, boneUuid) => {
                if (point.parent) {
                    point.parent.remove(point);
                }
            });
            this.bonePoints.clear();
        }
        
        // 이벤트 리스너 제거
        if (this.renderer) {
            if (this.pointClickListener) {
                this.renderer.domElement.removeEventListener('click', this.pointClickListener);
                this.pointClickListener = null;
            }
            
            if (this.mouseMoveHandler) {
                this.renderer.domElement.removeEventListener('mousemove', this.mouseMoveHandler);
                this.mouseMoveHandler = null;
            }
        }
        
        // 본 포인트 가시성 상태 초기화
        this.bonePointsVisible = false;
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