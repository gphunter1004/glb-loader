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
        
        // 본 포인트 추가 (처음에는 숨김 상태로)
        sceneManager.addBonePoints(bones, highlightBone);
        sceneManager.toggleBonePoints(false);
        
        // 본 포인트 토글 UI 추가
        addBonePointsToggle();
    }
    
    // 본 포인트 토글 버튼 추가
    function addBonePointsToggle() {
        // 이미 있는 경우 제거
        const existingToggle = document.getElementById('bonepoints-toggle');
        if (existingToggle) {
            existingToggle.parentElement.removeChild(existingToggle);
        }
        
        // 토글 컨테이너 생성
        const toggleContainer = document.createElement('div');
        toggleContainer.id = 'bonepoints-toggle';
        toggleContainer.className = 'bone-select-toggle';
        
        // 체크박스 생성
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = 'bonepoints-checkbox';
        
        // 레이블 생성
        const label = document.createElement('label');
        label.htmlFor = 'bonepoints-checkbox';
        label.textContent = '본 선택 모드';
        
        // 초기 상태 설정 (기본값: 비활성화)
        checkbox.checked = false;
        sceneManager.toggleBonePoints(false);
        
        // 체크박스 이벤트 리스너 추가
        checkbox.addEventListener('change', () => {
            const isEnabled = checkbox.checked;
            sceneManager.toggleBonePoints(isEnabled);
            console.log(`본 선택 모드: ${isEnabled ? '활성화' : '비활성화'}`);
            
            // 시각적 피드백
            if (isEnabled) {
                toggleContainer.classList.add('active');
            } else {
                toggleContainer.classList.remove('active');
            }
        });
        
        // 요소 조립
        toggleContainer.appendChild(checkbox);
        toggleContainer.appendChild(label);
        
        // 문서에 추가
        document.body.appendChild(toggleContainer);
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
        
        // 디버깅을 위해 모든 본 출력
        console.log("모든 본 UUID 목록:");
        bones.forEach(bone => {
            console.log(`${bone.name}: ${bone.uuid}`);
        });
        
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
                console.log(`클릭된 객체: ${clickedObject.name || "unnamed"}, UUID: ${clickedObject.uuid}`);
                
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
                    
                    // 이전 선택과 같은 본인지 확인
                    const currentBone = sceneManager.getHighlightedBone();
                    if (currentBone && currentBone.uuid === selectedBone.uuid) {
                        //console.log("이미 선택된 본과 동일함: 선택 유지");
                    } else {
                        console.log("새로운 본 선택됨: 강조 변경");
                        highlightBone(selectedBone.uuid);
                    }
                    return;
                }
                
                // 3. 본을 찾지 못했으면 가장 가까운 본 찾기
                const closestBone = findClosestVisibleBone(clickPoint, bones, camera);
                if (closestBone) {
                    console.log(`가장 가까운 본 선택: ${closestBone.name}`);
                    highlightBone(closestBone.uuid);
                }
            }
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
        //console.log(`본 강조 함수 호출됨: UUID=${boneUuid}`);
        
        // 현재 강조된 본 확인
        const currentBone = sceneManager.getHighlightedBone();
        if (currentBone && currentBone.uuid === boneUuid) {
            //console.log(`이미 강조된 본(${currentBone.name})과 동일함: 작업 중단`);
            return;
        }
        
        // 본 UUID가 유효한지 확인
        const bone = boneController.getBones().find(b => b.uuid === boneUuid);
        if (!bone) {
            console.error(`유효하지 않은 본 UUID: ${boneUuid}`);
            return;
        }
        
        console.log(`새로운 본 강조: ${bone.name}`);
        
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