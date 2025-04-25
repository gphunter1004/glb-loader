// uiManager.js - UI 관련 기능 관리
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class UIManager {
    constructor(modelLoadCallback, highlightBoneCallback) {
        this.modelLoadCallback = modelLoadCallback;
        this.highlightBoneCallback = highlightBoneCallback;
        
        this.setupFileInput();
        this.setupPanelResize();
    }
    
    setupPanelResize() {
        const resizeHandle = document.getElementById('panel-resize-handle');
        const controlPanel = document.getElementById('control-panel');
        
        if (!resizeHandle || !controlPanel) {
            console.error('패널 리사이즈 핸들 또는 컨트롤 패널 요소를 찾을 수 없습니다.');
            return;
        }
        
        let isResizing = false;
        let lastX = 0;
        
        resizeHandle.addEventListener('mousedown', function(e) {
            isResizing = true;
            lastX = e.clientX;
            document.body.style.cursor = 'ew-resize';
            resizeHandle.classList.add('active');
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            
            const delta = e.clientX - lastX;
            lastX = e.clientX;
            
            // 컨트롤 패널 너비 조정
            const newWidth = controlPanel.offsetWidth - delta;
            
            // 최소 및 최대 너비 제한
            if (newWidth >= 250 && newWidth <= 600) {
                controlPanel.style.width = newWidth + 'px';
            }
            
            // 씬 크기 업데이트를 위해 리사이즈 이벤트 발생
            window.dispatchEvent(new Event('resize'));
            
            e.preventDefault();
        });
        
        document.addEventListener('mouseup', function() {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = 'default';
                resizeHandle.classList.remove('active');
            }
        });
    }
    
    setupFileInput() {
        const fileInput = document.getElementById('file-input');
        const dropzone = document.getElementById('dropzone');
        
        if (!fileInput || !dropzone) {
            console.error('파일 입력 또는 드롭존 요소를 찾을 수 없습니다.');
            return;
        }
        
        fileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                this.loadModelFromFile(file);
            }
        });
        
        dropzone.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.add('highlight');
        });
        
        dropzone.addEventListener('dragleave', function(e) {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.remove('highlight');
        });
        
        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.remove('highlight');
            
            if (e.dataTransfer.files.length > 0) {
                const file = e.dataTransfer.files[0];
                if (file.name.endsWith('.glb') || file.name.endsWith('.gltf')) {
                    this.loadModelFromFile(file);
                } else {
                    alert('GLB 또는 GLTF 파일만 지원합니다.');
                }
            }
        });
    }
    
    loadModelFromFile(file) {
        this.showLoadingMessage();
        
        // 이전 모델 제거
        this.clearBoneControls();
        
        const reader = new FileReader();
        reader.readAsArrayBuffer(file);
        
        reader.onload = (e) => {
            const arrayBuffer = e.target.result;
            this.loadGLTFModel(arrayBuffer);
        };
    }
    
    loadGLTFModel(buffer) {
        const loader = new GLTFLoader();
        
        loader.parse(buffer, '', (gltf) => {
            const model = gltf.scene;
            
            // 본 찾기
            const bones = [];
            this.findBones(model, bones);
            
            // 콜백 호출 (모델과 본 전달)
            if (this.modelLoadCallback) {
                this.modelLoadCallback(model, bones);
            }
            
            this.hideLoadingMessage();
        }, undefined, (error) => {
            console.error('GLB 파일을 로드하는 중 오류가 발생했습니다:', error);
            this.hideLoadingMessage();
            alert('모델을 로드하는 데 문제가 발생했습니다. 콘솔을 확인하세요.');
        });
    }
    
    findBones(object, bonesArray) {
        if (object.isBone) {
            bonesArray.push(object);
        }
        
        if (object.children) {
            for (const child of object.children) {
                this.findBones(child, bonesArray);
            }
        }
    }
    
    createBoneControls(boneGroups, originalBoneRotations) {
        const controlPanel = document.getElementById('bone-controls');
        if (!controlPanel) {
            console.error('bone-controls 요소를 찾을 수 없습니다.');
            return;
        }
        
        controlPanel.innerHTML = '';
        
        // 그룹 정렬 순서
        const groupNames = [
            '루트/엉덩이', '머리', '몸통', 
            '왼쪽 팔', '오른쪽 팔', 
            '왼쪽 손/손가락', '오른쪽 손/손가락',
            '왼쪽 다리', '오른쪽 다리',
            '왼쪽 발/발가락', '오른쪽 발/발가락',
            '왼쪽', '오른쪽', '기타'
        ];
        
        // 그룹별로 본 컨트롤 생성
        groupNames.forEach(groupName => {
            if (boneGroups[groupName] && boneGroups[groupName].length > 0) {
                this.createBoneGroupUI(groupName, boneGroups[groupName], controlPanel, originalBoneRotations);
            }
        });
    }
    
    createBoneGroupUI(groupName, groupBones, parentElement, originalBoneRotations) {
        const groupDiv = document.createElement('div');
        groupDiv.className = 'bone-group';
        
        const titleDiv = document.createElement('div');
        titleDiv.className = 'bone-group-title';
        titleDiv.innerHTML = `${groupName} (${groupBones.length}) <span class="toggle-icon">+</span>`;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'bone-content';
        
        // 제목 클릭 시 내용 토글
        titleDiv.addEventListener('click', () => {
            contentDiv.classList.toggle('open');
            const icon = titleDiv.querySelector('.toggle-icon');
            icon.textContent = contentDiv.classList.contains('open') ? '-' : '+';
        });
        
        groupDiv.appendChild(titleDiv);
        groupDiv.appendChild(contentDiv);
        
        // 그룹 내 본 각각에 대한 UI 생성
        groupBones.forEach(bone => {
            const boneControl = this.createBoneSliders(bone, originalBoneRotations);
            contentDiv.appendChild(boneControl);
        });
        
        parentElement.appendChild(groupDiv);
    }
    
    createBoneSliders(bone, originalBoneRotations) {
        const container = document.createElement('div');
        container.className = 'slider-container';
        container.dataset.boneUuid = bone.uuid;
        
        // UUID 디버깅 정보 추가
        const debugInfo = document.createElement('div');
        debugInfo.className = 'debug-info';
        debugInfo.style.fontSize = '9px';
        debugInfo.style.color = '#999';
        debugInfo.style.marginBottom = '2px';
        debugInfo.textContent = `UUID: ${bone.uuid}`;
        container.appendChild(debugInfo);
        
        const label = document.createElement('div');
        label.className = 'slider-label';
        label.textContent = bone.name;
        label.title = `UUID: ${bone.uuid}`;  // UUID를 툴팁으로 표시
        
        // 라벨 클릭 시 해당 본 강조
        label.addEventListener('click', () => {
            console.log(`슬라이더 라벨 클릭: ${bone.name}, UUID: ${bone.uuid}`);
            if (this.highlightBoneCallback) {
                this.highlightBoneCallback(bone.uuid);
            }
        });
        
        container.appendChild(label);

        // X, Y, Z 축 회전 슬라이더 생성
        const axisContainer = document.createElement('div');
        axisContainer.className = 'axis-sliders';
        
        const axes = ['x', 'y', 'z'];
        const axisColors = {x: '#ff4136', y: '#2ecc40', z: '#0074d9'};
        
        axes.forEach(axis => {
            const axisDiv = document.createElement('div');
            axisDiv.className = 'axis-slider';
            axisDiv.dataset.axis = axis;
            axisDiv.dataset.bone = bone.uuid;
            
            // 슬라이더 행 생성
            const sliderRow = document.createElement('div');
            sliderRow.className = 'slider-row';
            
            const axisLabel = document.createElement('div');
            axisLabel.className = 'axis-label';
            axisLabel.textContent = axis.toUpperCase();
            axisLabel.style.color = axisColors[axis];
            
            const slider = document.createElement('input');
            slider.type = 'range';
            slider.min = -Math.PI;
            slider.max = Math.PI;
            slider.step = 0.01;
            slider.value = bone.rotation[axis];
            slider.dataset.bone = bone.uuid;  // 중요: 여기에 본의 UUID 저장
            
            // 값, 최소값, 최대값 행 한 줄로 생성
            const valueLimitRow = document.createElement('div');
            valueLimitRow.className = 'value-limit-row';
            
            // 최소값 입력
            const minLabel = document.createElement('span');
            minLabel.className = 'limit-label';
            minLabel.textContent = '최소';
            
            const minInput = document.createElement('input');
            minInput.type = 'number';
            minInput.className = 'limit-input';
            minInput.step = 0.01;
            minInput.value = slider.min;
            
            // 현재값 입력
            const valueLabel = document.createElement('span');
            valueLabel.className = 'limit-label';
            valueLabel.textContent = '현재';
            
            const valueInput = document.createElement('input');
            valueInput.type = 'number';
            valueInput.className = 'value-input';
            valueInput.step = 0.01;
            valueInput.value = parseFloat(bone.rotation[axis]).toFixed(2);
            
            // 최대값 입력
            const maxLabel = document.createElement('span');
            maxLabel.className = 'limit-label';
            maxLabel.textContent = '최대';
            
            const maxInput = document.createElement('input');
            maxInput.type = 'number';
            maxInput.className = 'limit-input';
            maxInput.step = 0.01;
            maxInput.value = slider.max;
            
            // 슬라이더 값 변경 시 입력 폼 업데이트
            slider.addEventListener('input', () => {
                bone.rotation[axis] = parseFloat(slider.value);
                valueInput.value = parseFloat(slider.value).toFixed(2);
                
                // 현재 조작 중인 본 강조 표시
                if (this.highlightBoneCallback) {
                    this.highlightBoneCallback(bone.uuid);
                }
            });
            
            // 입력 폼 값 변경 시 슬라이더 업데이트
            valueInput.addEventListener('change', () => {
                const val = parseFloat(valueInput.value);
                if (!isNaN(val)) {
                    // 값의 범위 제한
                    const minVal = parseFloat(slider.min);
                    const maxVal = parseFloat(slider.max);
                    const clampedVal = Math.max(Math.min(val, maxVal), minVal);
                    bone.rotation[axis] = clampedVal;
                    slider.value = clampedVal;
                    valueInput.value = clampedVal.toFixed(2);
                    
                    // 현재 조작 중인 본 강조 표시
                    if (this.highlightBoneCallback) {
                        this.highlightBoneCallback(bone.uuid);
                    }
                }
            });
            
            // 최소값 변경 시 슬라이더 업데이트
            minInput.addEventListener('change', () => {
                const minVal = parseFloat(minInput.value);
                if (!isNaN(minVal)) {
                    if (minVal < parseFloat(maxInput.value)) {
                        slider.min = minVal;
                        
                        // 현재 값이 최소값보다 작으면 조정
                        if (parseFloat(slider.value) < minVal) {
                            slider.value = minVal;
                            bone.rotation[axis] = minVal;
                            valueInput.value = minVal.toFixed(2);
                        }
                    } else {
                        minInput.value = slider.min;
                        alert('최소값은 최대값보다 작아야 합니다');
                    }
                }
            });
            
            // 최대값 변경 시 슬라이더 업데이트
            maxInput.addEventListener('change', () => {
                const maxVal = parseFloat(maxInput.value);
                if (!isNaN(maxVal)) {
                    if (maxVal > parseFloat(minInput.value)) {
                        slider.max = maxVal;
                        
                        // 현재 값이 최대값보다 크면 조정
                        if (parseFloat(slider.value) > maxVal) {
                            slider.value = maxVal;
                            bone.rotation[axis] = maxVal;
                            valueInput.value = maxVal.toFixed(2);
                        }
                    } else {
                        maxInput.value = slider.max;
                        alert('최대값은 최소값보다 커야 합니다');
                    }
                }
            });
            
            // 요소 조립
            sliderRow.appendChild(axisLabel);
            sliderRow.appendChild(slider);
            
            // 값과 제한값을 한 줄로 표시
            valueLimitRow.appendChild(minLabel);
            valueLimitRow.appendChild(minInput);
            valueLimitRow.appendChild(valueLabel);
            valueLimitRow.appendChild(valueInput);
            valueLimitRow.appendChild(maxLabel);
            valueLimitRow.appendChild(maxInput);
            
            axisDiv.appendChild(sliderRow);
            axisDiv.appendChild(valueLimitRow);
            
            axisContainer.appendChild(axisDiv);
        });
        
        container.appendChild(axisContainer);
        
        // 리셋 버튼
        const resetButton = document.createElement('button');
        resetButton.className = 'reset-button';
        resetButton.textContent = '리셋';
        resetButton.addEventListener('click', () => {
            const originalRotation = originalBoneRotations.get(bone.uuid);
            if (originalRotation) {
                bone.rotation.x = originalRotation.x;
                bone.rotation.y = originalRotation.y;
                bone.rotation.z = originalRotation.z;
                
                // 슬라이더 값 업데이트
                const sliders = axisContainer.querySelectorAll('input[type="range"]');
                const valueInputs = axisContainer.querySelectorAll('.value-input');
                
                for (let i = 0; i < 3; i++) {
                    const axes = ['x', 'y', 'z'];
                    const axisValue = bone.rotation[axes[i]];
                    sliders[i].value = axisValue;
                    valueInputs[i].value = axisValue.toFixed(2);
                }
                
                // 현재 조작 중인 본 강조 표시
                if (this.highlightBoneCallback) {
                    this.highlightBoneCallback(bone.uuid);
                }
            }
        });
        
        container.appendChild(resetButton);
        
        return container;
    }
    
    highlightBoneSlider(boneUuid) {
        // 이전 강조 표시 제거
        const prevActive = document.querySelectorAll('.active-bone');
        prevActive.forEach(el => el.classList.remove('active-bone'));
        
        console.log(`슬라이더 강조: ${boneUuid}`);
        
        // 정확한 슬라이더 찾기를 위한 로그
        console.log(`슬라이더 검색 시작 - UUID: ${boneUuid}`);
        
        // 모든 슬라이더에 data-bone 어트리뷰트 출력 (문제 진단용)
        const allSliders = document.querySelectorAll('.axis-slider');
        console.log(`전체 축 슬라이더 수: ${allSliders.length}`);
        
        // 첫 10개만 출력 (너무 많지 않게)
        const sampleSize = Math.min(10, allSliders.length);
        console.log(`첫 ${sampleSize}개 슬라이더의 data-bone 값:`);
        for (let i = 0; i < sampleSize; i++) {
            console.log(`슬라이더 ${i}: data-bone="${allSliders[i].dataset.bone}"`);
        }
        
        // 정확한 대상 슬라이더 찾기
        const targetSliders = document.querySelectorAll(`.axis-slider[data-bone="${boneUuid}"]`);
        console.log(`매칭된 슬라이더 수: ${targetSliders.length}`);
        
        // 컨테이너에서도 찾기
        const containers = document.querySelectorAll('.slider-container');
        console.log(`전체 슬라이더 컨테이너 수: ${containers.length}`);
        
        let container = null;
        
        // 1. 슬라이더에서 직접 찾기
        if (targetSliders.length > 0) {
            container = targetSliders[0].closest('.slider-container');
            console.log(`슬라이더로부터 컨테이너 찾음: ${container ? 'success' : 'failed'}`);
        }
        
        // 2. 컨테이너의 data-bone-uuid에서 찾기
        if (!container) {
            for (const cont of containers) {
                const contBoneUuid = cont.dataset.boneUuid;
                console.log(`컨테이너 체크: "${contBoneUuid}" vs "${boneUuid}"`);
                
                if (contBoneUuid === boneUuid) {
                    container = cont;
                    console.log('컨테이너 UUID 일치함');
                    break;
                }
            }
        }
        
        // 컨테이너를 찾은 경우 강조 표시
        if (container) {
            container.classList.add('active-bone');
            const labelText = container.querySelector('.slider-label')?.textContent || '알 수 없음';
            console.log(`본 슬라이더 찾음: ${labelText}, 강조 적용`);
            
            // 강조된 본이 속한 그룹 컨텐츠가 닫혀있으면 열기
            const parentContent = container.closest('.bone-content');
            if (parentContent && !parentContent.classList.contains('open')) {
                parentContent.classList.add('open');
                const toggleIcon = parentContent.previousElementSibling.querySelector('.toggle-icon');
                if (toggleIcon) {
                    toggleIcon.textContent = '-';
                }
            }
            
            // 강조된 본이 보이도록 스크롤
            container.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            console.error(`UUID가 ${boneUuid}인 슬라이더를 찾을 수 없음`);
        }
    }
    
    clearBoneControls() {
        const controlPanel = document.getElementById('bone-controls');
        if (controlPanel) {
            controlPanel.innerHTML = '';
        }
    }
    
    showLoadingMessage() {
        const loadingMessage = document.getElementById('loading-message');
        if (loadingMessage) {
            loadingMessage.style.display = 'block';
        }
    }
    
    hideLoadingMessage() {
        const loadingMessage = document.getElementById('loading-message');
        if (loadingMessage) {
            loadingMessage.style.display = 'none';
        }
    }
}