// main.js - 메인 스크립트
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SceneManager } from 'sceneManager';
import { BoneController } from 'boneController';
import { UIManager } from 'uiManager';

// 전역 변수
let sceneManager, boneController, uiManager;

// DOM이 로드되면 실행
window.addEventListener('DOMContentLoaded', function() {
    // 초기화 함수
    function init() {
        // 씬 매니저 초기화
        sceneManager = new SceneManager();
        
        // 본 컨트롤러 초기화
        boneController = new BoneController();
        
        // UI 매니저 초기화
        uiManager = new UIManager(onModelLoaded, highlightBone);
        
        // 이벤트 리스너 설정
        window.addEventListener('resize', onWindowResize);
        
        // 애니메이션 루프 시작
        animate();
    }
    
    // 윈도우 리사이징 처리
    function onWindowResize() {
        sceneManager.handleResize();
    }
    
    // 모델 로드 완료 시 호출되는 콜백
    function onModelLoaded(model, bones) {
        sceneManager.addModelToScene(model);
        boneController.setBones(bones);
        
        // 스킨 메시와 본의 관계 설정
        setupBoneSkinnedMeshRelationships(model, bones);
        
        // 본 조작 UI 생성
        const boneGroups = boneController.getBoneGroups();
        uiManager.createBoneControls(boneGroups, boneController.getOriginalRotations());
        
        // 모델의 본에 클릭 이벤트 추가
        setupBoneClickEvents(bones);
    }
    
    // 스킨 메시와 본 간의 관계 설정
    function setupBoneSkinnedMeshRelationships(model, bones) {
        // 모든 스키닝 메시 찾기
        const skinnedMeshes = [];
        model.traverse(object => {
            if (object.isSkinnedMesh) {
                skinnedMeshes.push(object);
            }
        });
        
        console.log(`스키닝 메시 ${skinnedMeshes.length}개 발견`);
        
        // 모든 메시와 그 부모 본 관계 추적
        const meshParentMap = new Map();  // 메시 UUID -> 부모 본 UUID
        
        // 모델 내의 모든 객체 탐색
        model.traverse(object => {
            if (object.isMesh || object.isSkinnedMesh) {
                // 이 메시의 부모 본 찾기
                let currentObj = object;
                while (currentObj && currentObj.parent) {
                    currentObj = currentObj.parent;
                    // 부모가 본인지 확인
                    if (bones.some(b => b.uuid === currentObj.uuid)) {
                        meshParentMap.set(object.uuid, currentObj.uuid);
                        console.log(`메시 "${object.name}"의 부모 본: "${currentObj.name}" (${currentObj.uuid})`);
                        break;
                    }
                }
            }
        });
        
        console.log(`메시-부모 본 관계 ${meshParentMap.size}개 설정됨`);
        
        // 본과 스키닝 메시 관계 설정
        bones.forEach(bone => {
            // 관련 메시 목록 초기화
            bone.userData.relatedMeshes = [];
            bone.userData.childMeshes = [];
            
            // 이 본을 사용하는 스키닝 메시 찾기
            skinnedMeshes.forEach(mesh => {
                if (mesh.skeleton) {
                    const boneIndex = mesh.skeleton.bones.findIndex(b => b.uuid === bone.uuid);
                    if (boneIndex >= 0) {
                        bone.userData.relatedMeshes.push(mesh);
                        console.log(`본 ${bone.name} - 스키닝 메시 ${mesh.name} 연결`);
                    }
                }
            });
            
            // 이 본이 부모인 메시 찾기
            model.traverse(obj => {
                if ((obj.isMesh || obj.isSkinnedMesh) && meshParentMap.get(obj.uuid) === bone.uuid) {
                    if (!bone.userData.childMeshes.includes(obj)) {
                        bone.userData.childMeshes.push(obj);
                        console.log(`본 ${bone.name} - 자식 메시 ${obj.name} 연결`);
                    }
                }
            });
        });
    }
    
    // 3D 모델에서 본 클릭 이벤트 설정
    function setupBoneClickEvents(bones) {
        const scene = sceneManager.getScene();
        const model = sceneManager.getCurrentModel();
        
        console.log(`설정할 본 개수: ${bones.length}`);
        
        // 디버깅용 - 모든 본 UUID 목록 출력
        console.log("모든 본 UUID 목록:");
        bones.forEach(bone => {
            console.log(`${bone.name}: ${bone.uuid}`);
        });
        
        // 직계 부모 본 체크
        function findParentBone(object) {
            if (!object) return null;
            let current = object;
            while (current && current !== model) {
                const parent = current.parent;
                if (parent && bones.includes(parent)) {
                    return parent;
                }
                current = parent;
            }
            return null;
        }
        
        // 클릭 이벤트 핸들러
        function handleModelClick(event) {
            const renderer = sceneManager.getRenderer();
            const camera = sceneManager.getCamera();
            
            // 마우스 위치를 정규화된 장치 좌표로 변환 (-1 ~ +1)
            const rect = renderer.domElement.getBoundingClientRect();
            const mouse = new THREE.Vector2();
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            
            // 레이캐스터 설정
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(mouse, camera);
            
            // 모델 내에서만 검사 (다른 씬 오브젝트 제외)
            const intersects = raycaster.intersectObject(model, true);
            
            console.log(`클릭: 교차점 ${intersects.length}개 감지됨`);
            
            // 첫 번째 교차 객체 찾기
            if (intersects.length > 0) {
                const clickedObject = intersects[0].object;
                const clickPoint = intersects[0].point;
                console.log(`클릭된 객체: ${clickedObject.name}, UUID: ${clickedObject.uuid}`);
                
                // 1. 클릭된 객체의 부모 체인을 탐색하여 본 찾기
                let selectedBone = null;
                let currentObj = clickedObject;
                
                console.log(`클릭 체인 분석 시작: ${clickedObject.name || "unnamed"}, UUID: ${clickedObject.uuid}`);
                
                // 클릭된 객체 자체가 본인지 먼저 확인
                if (bones.some(b => b.uuid === clickedObject.uuid)) {
                    selectedBone = clickedObject;
                    console.log(`클릭된 객체 자체가 본임: ${selectedBone.name}, UUID: ${selectedBone.uuid}`);
                }
                // 본이 아니면 부모 체인 탐색
                else {
                    // 부모 체인의 모든 객체 나열 (디버깅용)
                    let debugChain = [];
                    let tempObj = clickedObject;
                    while (tempObj) {
                        const isBone = bones.some(b => b.uuid === tempObj.uuid);
                        debugChain.push(`${tempObj.name || "unnamed"} (${tempObj.uuid.slice(0,8)}...) ${isBone ? "- 본" : ""}`);
                        tempObj = tempObj.parent;
                    }
                    console.log("부모 체인:", debugChain.join(" → "));
                    
                    // 부모 중에서 본 찾기
                    while (currentObj && currentObj.parent && !selectedBone) {
                        currentObj = currentObj.parent;
                        if (bones.some(b => b.uuid === currentObj.uuid)) {
                            selectedBone = currentObj;
                            console.log(`부모 객체가 본임: ${selectedBone.name}, UUID: ${selectedBone.uuid}`);
                            break;
                        }
                    }
                }
                
                // 2. 본을 찾았으면 강조 표시
                if (selectedBone) {
                    console.log(`선택된 본: ${selectedBone.name}, UUID: ${selectedBone.uuid}`);
                    console.log(`강조할 UUID: ${selectedBone.uuid}`);
                    highlightBone(selectedBone.uuid);
                    return;
                }
                
                // 3. 본을 찾지 못했으면 가장 가까운 본 찾기
                const closestBone = findClosestVisibleBone(clickPoint, bones, camera);
                if (closestBone) {
                    console.log(`가장 가까운 본 선택: ${closestBone.name}, UUID: ${closestBone.uuid}`);
                    highlightBone(closestBone.uuid);
                }
            }
        }
        
        // 스키닝 메시에서 특정 지점에 가장 영향을 많이 주는 본 찾기
        function findInfluentialBoneAtPoint(skinnedMesh, point, intersection) {
            if (!skinnedMesh.skeleton || !skinnedMesh.skeleton.bones || skinnedMesh.skeleton.bones.length === 0) {
                return null;
            }
            
            // 교차 정보에서 면 인덱스 가져오기
            const faceIndex = intersection.faceIndex;
            if (faceIndex === undefined) return null;
            
            // 해당 면의 정점 인덱스 가져오기
            const geometry = skinnedMesh.geometry;
            if (!geometry || !geometry.index) return null;
            
            const a = geometry.index.getX(faceIndex * 3);
            const b = geometry.index.getX(faceIndex * 3 + 1);
            const c = geometry.index.getX(faceIndex * 3 + 2);
            
            console.log(`면 정점 인덱스: ${a}, ${b}, ${c}`);
            
            // 스키닝 정보 가져오기
            const skinIndices = geometry.getAttribute('skinIndex');
            const skinWeights = geometry.getAttribute('skinWeight');
            
            if (!skinIndices || !skinWeights) {
                console.log('스키닝 정보 없음');
                return null;
            }
            
            // 가장 영향력 있는 본 찾기
            const boneInfluences = new Map(); // 본 인덱스 -> 영향력 합계
            
            // 각 정점의 스키닝 정보 처리
            [a, b, c].forEach(vertexIndex => {
                // 각 정점에 영향을 주는 본 인덱스와 가중치 가져오기
                const idx = skinIndices.getX(vertexIndex);
                const weight = skinWeights.getX(vertexIndex);
                
                // 가중치가 0보다 크면 영향력 합산
                if (weight > 0) {
                    const currentInfluence = boneInfluences.get(idx) || 0;
                    boneInfluences.set(idx, currentInfluence + weight);
                }
                
                // 두 번째, 세 번째, 네 번째 영향도 체크
                for (let i = 1; i < 4; i++) {
                    const getMethod = i === 1 ? 'getY' : i === 2 ? 'getZ' : 'getW';
                    if (skinIndices[getMethod] && skinWeights[getMethod]) {
                        const idxN = skinIndices[getMethod](vertexIndex);
                        const weightN = skinWeights[getMethod](vertexIndex);
                        
                        if (weightN > 0) {
                            const currentInfluence = boneInfluences.get(idxN) || 0;
                            boneInfluences.set(idxN, currentInfluence + weightN);
                        }
                    }
                }
            });
            
            // 영향력이 가장 큰 본 찾기
            let maxInfluence = 0;
            let mostInfluentialBoneIndex = -1;
            
            boneInfluences.forEach((influence, boneIndex) => {
                console.log(`본 인덱스 ${boneIndex}: 영향력 ${influence}`);
                if (influence > maxInfluence) {
                    maxInfluence = influence;
                    mostInfluentialBoneIndex = boneIndex;
                }
            });
            
            // 본 인덱스로 본 객체 찾기
            if (mostInfluentialBoneIndex >= 0 && mostInfluentialBoneIndex < skinnedMesh.skeleton.bones.length) {
                const bone = skinnedMesh.skeleton.bones[mostInfluentialBoneIndex];
                console.log(`가장 영향력 있는 본: ${bone.name}, 인덱스: ${mostInfluentialBoneIndex}, 영향력: ${maxInfluence}`);
                return bone.uuid;
            }
            
            // 본을 찾지 못한 경우 첫 번째 본 반환
            console.log('영향력 있는 본을 찾지 못함, 첫 번째 본 반환');
            return skinnedMesh.skeleton.bones[0].uuid;
        }
        
        // 가시성을 고려하여 가장 가까운 본 찾기
        function findClosestVisibleBone(point, bonesList, camera) {
            // 각 본까지의 거리와 카메라 방향 고려
            const bonesWithInfo = bonesList.map(bone => {
                // 본의 월드 위치 구하기
                const boneWorldPos = new THREE.Vector3();
                bone.getWorldPosition(boneWorldPos);
                
                // 본과 클릭 지점 사이의 거리 계산
                const distance = point.distanceTo(boneWorldPos);
                
                // 카메라에서 본으로의 방향과 카메라 시선 방향 사이의 각도 계산
                const cameraPos = camera.position;
                const boneDir = new THREE.Vector3().subVectors(boneWorldPos, cameraPos).normalize();
                const cameraDir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
                const angle = boneDir.angleTo(cameraDir);
                
                return {
                    bone,
                    distance,
                    angle,
                    // 가중치: 거리가 가까울수록, 카메라 방향과 일치할수록 높음
                    weight: 1 / (distance * (1 + angle))
                };
            });
            
            // 가중치에 따라 정렬하고 가장 높은 가중치의 본 반환
            bonesWithInfo.sort((a, b) => b.weight - a.weight);
            
            if (bonesWithInfo.length > 0) {
                const best = bonesWithInfo[0];
                console.log(`가장 적합한 본: ${best.bone.name}, 거리: ${best.distance.toFixed(2)}, 각도: ${best.angle.toFixed(2)}, 가중치: ${best.weight.toFixed(4)}`);
                return best.bone;
            }
            
            return null;
        }
        
        // 이전 리스너 제거 후 새로 추가
        const renderer = sceneManager.getRenderer();
        if (renderer.domElement) {
            renderer.domElement.removeEventListener('click', handleModelClick);
            renderer.domElement.addEventListener('click', handleModelClick);
            console.log("클릭 이벤트 리스너 설정됨");
        }
    }
    
    // 본 강조 표시
    function highlightBone(boneUuid) {
        console.log(`본 강조 함수 호출됨: UUID=${boneUuid}`);
        
        // 본 UUID가 유효한지 확인
        const bone = boneController.getBones().find(b => b.uuid === boneUuid);
        if (!bone) {
            console.error(`유효하지 않은 본 UUID: ${boneUuid}`);
            return;
        }
        
        // UI에서 슬라이더 강조
        uiManager.highlightBoneSlider(boneUuid);
        
        // 3D 모델에서 본 강조
        const bones = boneController.getBones();
        sceneManager.highlightBone(bones, boneUuid);
    }
    
    // 애니메이션 루프
    function animate() {
        requestAnimationFrame(animate);
        sceneManager.update();
    }
    
    // 초기화 실행
    init();
});

// THREE 모듈을 window에 할당하여 접근 가능하게
window.THREE = THREE;