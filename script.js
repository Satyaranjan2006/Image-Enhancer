class ImageDownloader {
    constructor() {
        this.originalImage = null;
        this.originalWidth = 0;
        this.originalHeight = 0;
        this.canvas = null;
        this.ctx = null;
        this.currentFilters = {
            scale: 1,
            brightness: 1,
            contrast: 1,
            saturation: 1,
            sharpness: 0,
            quality: 0.85,
            format: 'jpeg',
            customWidth: null,
            customHeight: null
        };
        this.debounceTimers = {};
        this.rafId = null;
        this.maintainAspectRatio = true;
        this.maxDimension = 2000; // Max dimension for preprocessing
        
        this.initializeElements();
        this.bindEvents();
    }

    initializeElements() {
        // Get DOM elements
        this.elements = {
            imageUrl: document.getElementById('imageUrl'),
            loadImage: document.getElementById('loadImage'),
            enhancementControls: document.getElementById('enhancementControls'),
            imagePreview: document.getElementById('imagePreview'),
            loading: document.getElementById('loading'),
            errorMessage: document.getElementById('errorMessage'),
            originalImage: document.getElementById('originalImage'),
            enhancedCanvas: document.getElementById('enhancedCanvas'),
            originalSize: document.getElementById('originalSize'),
            enhancedSize: document.getElementById('enhancedSize'),
            downloadImage: document.getElementById('downloadImage'),
            resetFilters: document.getElementById('resetFilters'),
            
            // Sliders
            scaleSlider: document.getElementById('scaleSlider'),
            brightnessSlider: document.getElementById('brightnessSlider'),
            contrastSlider: document.getElementById('contrastSlider'),
            saturationSlider: document.getElementById('saturationSlider'),
            sharpnessSlider: document.getElementById('sharpnessSlider'),
            qualitySlider: document.getElementById('qualitySlider'),
            
            // Resize controls
            widthInput: document.getElementById('widthInput'),
            heightInput: document.getElementById('heightInput'),
            applyResize: document.getElementById('applyResize'),
            originalDimensions: document.getElementById('originalDimensions'),
            
            // Value displays
            scaleValue: document.getElementById('scaleValue'),
            brightnessValue: document.getElementById('brightnessValue'),
            contrastValue: document.getElementById('contrastValue'),
            saturationValue: document.getElementById('saturationValue'),
            sharpnessValue: document.getElementById('sharpnessValue'),
            qualityValue: document.getElementById('qualityValue')
        };

        this.canvas = this.elements.enhancedCanvas;
        // Enable willReadFrequently for better performance with multiple getImageData calls
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        
        // Initialize sliders with proper styling
        this.initializeSliders();
    }

    initializeSliders() {
        const sliders = [
            'scaleSlider',
            'brightnessSlider',
            'contrastSlider',
            'saturationSlider',
            'sharpnessSlider'
        ];
        
        sliders.forEach(id => {
            const slider = this.elements[id];
            if (slider) {
                // Add initial fill style
                slider.style.setProperty('--fill-percent', '0%');
                
                // Add touch-action to prevent page scrolling
                slider.style.touchAction = 'none';
            }
        });
    }

    bindEvents() {
        // Load image button
        this.elements.loadImage.addEventListener('click', () => this.loadImage());
        
        // Enter key on URL input
        this.elements.imageUrl.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.loadImage();
        });

        // Format selection change
        this.elements.formatSelect = document.getElementById('formatSelect');
        this.elements.qualityControl = document.getElementById('qualityControl');
        
        this.elements.formatSelect.addEventListener('change', (e) => {
            this.currentFilters.format = e.target.value;
            // Hide quality control for PDF
            this.elements.qualityControl.style.display = 
                e.target.value === 'pdf' ? 'none' : 'flex';
        });
        
        // Initialize format
        this.currentFilters.format = this.elements.formatSelect.value;
        
        // Resize controls
        this.elements.widthInput.addEventListener('change', (e) => this.handleDimensionChange('width', e.target.value));
        this.elements.heightInput.addEventListener('change', (e) => this.handleDimensionChange('height', e.target.value));
        this.elements.applyResize.addEventListener('click', () => this.applyCustomDimensions());
        
        // Quality slider
        this.setupSlider('qualitySlider', (value) => {
            const quality = parseInt(value);
            this.elements.qualityValue.textContent = `${quality}%`;
            return quality / 100;
        }, 'quality');

        // File upload handling
        this.elements.uploadImage = document.getElementById('uploadImage');
        this.elements.fileInput = document.getElementById('fileInput');
        
        // Trigger file input when upload button is clicked
        this.elements.uploadImage.addEventListener('click', () => {
            this.elements.fileInput.click();
        });

        // Handle file selection
        this.elements.fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.handleFileUpload(file);
            }
        });

        // Setup slider with debouncing and visual feedback
        this.setupSlider('scaleSlider', (value) => {
            const roundedValue = parseFloat(value).toFixed(1);
            this.elements.scaleValue.textContent = `${roundedValue}x`;
            return parseFloat(roundedValue);
        }, 'scale');

        this.setupSlider('brightnessSlider', (value) => {
            const percent = Math.round(parseFloat(value) * 100);
            this.elements.brightnessValue.textContent = `${percent}%`;
            return parseFloat(value);
        }, 'brightness');

        this.setupSlider('contrastSlider', (value) => {
            const percent = Math.round(parseFloat(value) * 100);
            this.elements.contrastValue.textContent = `${percent}%`;
            return parseFloat(value);
        }, 'contrast');

        this.setupSlider('saturationSlider', (value) => {
            const percent = Math.round(parseFloat(value) * 100);
            this.elements.saturationValue.textContent = `${percent}%`;
            return parseFloat(value);
        }, 'saturation');

        this.setupSlider('sharpnessSlider', (value) => {
            const percent = Math.round(parseFloat(value) * 100);
            this.elements.sharpnessValue.textContent = `${percent}%`;
            return parseFloat(value);
        }, 'sharpness');

        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.applyPresetFilter(e.target.dataset.filter);
            });
        });

        // Action buttons
        this.elements.resetFilters.addEventListener('click', () => this.resetFilters());
        this.elements.downloadImage.addEventListener('click', () => this.downloadImage());
    }

    setupSlider(sliderId, formatValue, filterKey) {
        const slider = this.elements[sliderId];
        
        // Update slider fill color
        const updateFill = () => {
            const value = parseFloat(slider.value);
            const min = parseFloat(slider.min);
            const max = parseFloat(slider.max);
            const percent = ((value - min) / (max - min)) * 100;
            slider.style.setProperty('--fill-percent', `${percent}%`);
        };
        
        // Initial fill
        updateFill();
        
        const updateValue = (value) => {
            const formattedValue = formatValue(value);
            this.currentFilters[filterKey] = formattedValue;
            
            clearTimeout(this.debounceTimers[sliderId]);
            this.debounceTimers[sliderId] = setTimeout(() => {
                cancelAnimationFrame(this.rafId);
                this.rafId = requestAnimationFrame(() => {
                    this.applyEnhancements();
                });
            }, 100);
        };
        
        slider.addEventListener('input', (e) => {
            updateFill();
            updateValue(e.target.value);
        });
        
        slider.addEventListener('touchstart', (e) => {
            e.stopPropagation();
        }, { passive: true });
    }

    cleanup() {
        // Clean up previous resources
        if (this.originalImage && this.originalImage.src) {
            URL.revokeObjectURL(this.originalImage.src);
        }
        
        // Clear any pending operations
        Object.values(this.debounceTimers).forEach(timer => clearTimeout(timer));
        cancelAnimationFrame(this.rafId);
        
        // Reset canvas if it exists
        if (this.canvas && this.ctx) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    async loadImage() {
        const url = this.elements.imageUrl.value.trim();
        
        if (!url) {
            this.showError('Please enter an image URL');
            return;
        }

        if (!this.isValidImageUrl(url)) {
            this.showError('Please enter a valid image URL (must be .jpg, .jpeg, .png, .gif, .bmp, .webp, or .svg)');
            return;
        }
        
        // Clean up previous resources
        this.cleanup();

        // Reset UI
        this.elements.enhancementControls.style.display = 'none';
        this.elements.imagePreview.style.display = 'none';
        this.showLoading(true);
        this.hideError();
        
        try {
            await new Promise((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                
                img.onload = () => {
                    this.originalImage = img;
                    this.displayOriginalImage();
                    this.setupCanvas();
                    this.applyEnhancements();
                    this.showControls();
                    this.showNotification('Image loaded successfully!');
                    resolve();
                };

                img.onerror = () => this.tryWithCorsProxy(url).then(resolve).catch(reject);
                img.src = url;
            });
        } catch (error) {
            this.handleImageError(error);
        } finally {
            this.showLoading(false);
        }
    }

    async tryWithCorsProxy(originalUrl) {
        return new Promise((resolve, reject) => {
            const proxyUrl = `https://cors-anywhere.herokuapp.com/${originalUrl}`;
            const img = new Image();
            
            img.onload = () => {
                this.originalImage = img;
                this.displayOriginalImage();
                this.setupCanvas();
                this.applyEnhancements();
                this.showControls();
                resolve();
            };

            img.onerror = (e) => {
                const error = new Error('Failed to load image. Server may be blocking access.');
                this.handleImageError(error);
                reject(error);
            };

            img.crossOrigin = 'anonymous';
            img.src = proxyUrl;
        });
    }

    handleImageError(error) {
        console.error('Image loading error:', error);
        let errorMessage = 'Failed to load image. ';
        
        if (error.message.includes('403') || error.status === 403) {
            errorMessage += 'Access to this image is forbidden by the server. ';
        } else if (error.message.includes('CORS') || error.message.includes('cross-origin')) {
            errorMessage += 'The server is blocking cross-origin requests. ';
        }
        
        errorMessage += 'Please try a different image or website.';
        this.showError(errorMessage);
        this.showLoading(false);
    }

    isValidImageUrl(url) {
        try {
            new URL(url);
            return /\.(jpg|jpeg|png|gif|bmp|webp|svg)(\?.*)?$/i.test(url);
        } catch (e) {
            return false;
        }
    }

    calculateAspectRatio(srcWidth, srcHeight, maxWidth, maxHeight) {
        const ratio = Math.min(
            maxWidth / srcWidth,
            maxHeight / srcHeight,
            1 // Don't scale up
        );
        return {
            width: Math.round(srcWidth * ratio),
            height: Math.round(srcHeight * ratio)
        };
    }

    async preprocessImage(file) {
        return new Promise((resolve) => {
            const img = new Image();
            const url = URL.createObjectURL(file);
            
            img.onload = () => {
                const { width, height } = this.calculateAspectRatio(
                    img.width,
                    img.height,
                    this.maxDimension,
                    this.maxDimension
                );
                
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                
                const ctx = canvas.getContext('2d');
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, width, height);
                
                const format = file.type.split('/')[1] || 'jpeg';
                const mimeType = `image/${format}`;
                
                canvas.toBlob((blob) => {
                    URL.revokeObjectURL(url);
                    resolve({
                        blob,
                        width,
                        height,
                        mimeType
                    });
                }, mimeType, 0.85);
            };
            
            img.src = url;
        });
    }

    async handleFileUpload(file) {
        if (!file.type.match('image.*')) {
            this.showError('Please select a valid image file (JPEG, PNG, GIF, etc.)');
            return;
        }

        this.showLoading(true);
        this.hideError();

        try {
            // Clean up previous resources
            this.cleanup();
            
            // Preprocess image (resize and compress)
            const { blob, width, height } = await this.preprocessImage(file);
            
            const img = new Image();
            img.onload = () => {
                this.originalImage = img;
                this.displayOriginalImage();
                this.setupCanvas();
                this.applyEnhancements();
                this.showControls();
                this.showLoading(false);
                // Clear the file input
                this.elements.fileInput.value = '';
            };
            
            img.onerror = () => {
                this.showError('Error loading the selected image. Please try another file.');
                this.showLoading(false);
            };
            
            img.src = URL.createObjectURL(blob);
        } catch (error) {
            console.error('Error processing image:', error);
            this.showError('Error processing the selected file. Please try again.');
            this.showLoading(false);
        }
    }

    needsProxy(url) {
        // Check if URL is from a different domain and might need CORS proxy
        try {
            const urlObj = new URL(url);
            return urlObj.hostname !== window.location.hostname;
        } catch {
            return false;
        }
    }

    displayOriginalImage() {
        this.originalWidth = this.originalImage.naturalWidth;
        this.originalHeight = this.originalImage.naturalHeight;
        
        this.elements.originalImage.src = this.originalImage.src;
        this.elements.originalSize.textContent = `${this.originalWidth} × ${this.originalHeight}px`;
        this.elements.originalDimensions.textContent = `(Original: ${this.originalWidth}×${this.originalHeight})`;
        
        // Update dimension inputs
        this.elements.widthInput.placeholder = this.originalWidth;
        this.elements.heightInput.placeholder = this.originalHeight;
        this.elements.widthInput.value = '';
        this.elements.heightInput.value = '';
        
        // Reset custom dimensions
        this.currentFilters.customWidth = null;
        this.currentFilters.customHeight = null;
    }

    setupCanvas() {
        const scale = this.currentFilters.scale;
        let width = this.originalWidth;
        let height = this.originalHeight;
        
        // Apply custom dimensions if set
        if (this.currentFilters.customWidth || this.currentFilters.customHeight) {
            width = this.currentFilters.customWidth || (this.currentFilters.customHeight * (this.originalWidth / this.originalHeight));
            height = this.currentFilters.customHeight || (this.currentFilters.customWidth * (this.originalHeight / this.originalWidth));
        } else {
            // Apply scale factor
            width *= scale;
            height *= scale;
        }
        
        this.canvas.width = Math.round(width);
        this.canvas.height = Math.round(height);
        
        // Update enhanced size display
        this.elements.enhancedSize.textContent = `${this.canvas.width} × ${this.canvas.height}px`;
    }

    applyEnhancements() {
        if (!this.originalImage) return;

        // Use requestAnimationFrame for smoother animations
        cancelAnimationFrame(this.rafId);
        this.rafId = requestAnimationFrame(() => {
            this.setupCanvas();
            
            // Clear canvas
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            
            // Apply filters
            this.ctx.filter = this.buildFilterString();
            
            // Draw scaled image
            this.ctx.drawImage(
                this.originalImage,
                0, 0,
                this.originalImage.naturalWidth,
                this.originalImage.naturalHeight,
                0, 0,
                this.canvas.width,
                this.canvas.height
            );

            // Apply sharpening if needed (defer to next frame)
            if (this.currentFilters.sharpness > 0) {
                requestIdleCallback(() => {
                    this.applySharpeningFilter();
                }, { timeout: 100 });
            }

            // Reset filter for future operations
            this.ctx.filter = 'none';
        });
    }

    buildFilterString() {
        const { brightness, contrast, saturation } = this.currentFilters;
        
        return [
            `brightness(${brightness})`,
            `contrast(${contrast})`,
            `saturate(${saturation})`
        ].join(' ');
    }

    applySharpeningFilter() {
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        const data = imageData.data;
        const width = this.canvas.width;
        const height = this.canvas.height;
        const strength = this.currentFilters.sharpness;

        // Sharpening kernel
        const kernel = [
            0, -strength, 0,
            -strength, 1 + 4 * strength, -strength,
            0, -strength, 0
        ];

        const output = new Uint8ClampedArray(data.length);

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                for (let c = 0; c < 3; c++) { // RGB channels only
                    let sum = 0;
                    for (let ky = -1; ky <= 1; ky++) {
                        for (let kx = -1; kx <= 1; kx++) {
                            const idx = ((y + ky) * width + (x + kx)) * 4 + c;
                            const kernelIdx = (ky + 1) * 3 + (kx + 1);
                            sum += data[idx] * kernel[kernelIdx];
                        }
                    }
                    const outputIdx = (y * width + x) * 4 + c;
                    output[outputIdx] = Math.max(0, Math.min(255, sum));
                }
                // Copy alpha channel
                const alphaIdx = (y * width + x) * 4 + 3;
                output[alphaIdx] = data[alphaIdx];
            }
        }

        // Copy edges from original
        for (let i = 0; i < data.length; i += 4) {
            const x = (i / 4) % width;
            const y = Math.floor((i / 4) / width);
            
            if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
                output[i] = data[i];
                output[i + 1] = data[i + 1];
                output[i + 2] = data[i + 2];
                output[i + 3] = data[i + 3];
            }
        }

        const outputImageData = new ImageData(output, width, height);
        this.ctx.putImageData(outputImageData, 0, 0);
    }

    applyPresetFilter(filterType) {
        // Update slider UI to match the preset
        const updateSlider = (id, value) => {
            const slider = document.getElementById(id);
            if (slider) {
                slider.value = value;
                // Trigger the input event to update the display
                const event = new Event('input', { bubbles: true });
                slider.dispatchEvent(event);
            }
        };

        switch (filterType) {
            case 'none':
                this.resetFilters();
                break;
            case 'vintage':
                this.currentFilters.brightness = 1.1;
                this.currentFilters.contrast = 1.2;
                this.currentFilters.saturation = 0.8;
                updateSlider('brightnessSlider', 1.1);
                updateSlider('contrastSlider', 1.2);
                updateSlider('saturationSlider', 0.8);
                this.applyEnhancements();
                break;
            case 'blackwhite':
                this.currentFilters.saturation = 0;
                this.currentFilters.contrast = 1.2;
                updateSlider('saturationSlider', 0);
                updateSlider('contrastSlider', 1.2);
                this.applyEnhancements();
                break;
            case 'sepia':
                this.currentFilters.brightness = 1.1;
                this.currentFilters.contrast = 1.1;
                this.currentFilters.saturation = 0.6;
                updateSlider('brightnessSlider', 1.1);
                updateSlider('contrastSlider', 1.1);
                updateSlider('saturationSlider', 0.6);
                this.applyEnhancements();
                this.applySepia();
                break;
            case 'vibrant':
                this.currentFilters.brightness = 1.1;
                this.currentFilters.contrast = 1.3;
                this.currentFilters.saturation = 1.4;
                updateSlider('brightnessSlider', 1.1);
                updateSlider('contrastSlider', 1.3);
                updateSlider('saturationSlider', 1.4);
                this.applyEnhancements();
                break;
        }
    }

    applySepia() {
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            data[i] = Math.min(255, (r * 0.393) + (g * 0.769) + (b * 0.189));
            data[i + 1] = Math.min(255, (r * 0.349) + (g * 0.686) + (b * 0.168));
            data[i + 2] = Math.min(255, (r * 0.272) + (g * 0.534) + (b * 0.131));
        }

        this.ctx.putImageData(imageData, 0, 0);
    }

    resetFilters() {
        // Reset all filters to default values
        this.currentFilters = {
            scale: 1,
            brightness: 1,
            contrast: 1,
            saturation: 1,
            sharpness: 0
        };

        // Reset sliders and update their visual state
        const sliders = {
            scaleSlider: { value: 1, display: '1x' },
            brightnessSlider: { value: 1, display: '100%' },
            contrastSlider: { value: 1, display: '100%' },
            saturationSlider: { value: 1, display: '100%' },
            sharpnessSlider: { value: 0, display: '0%' }
        };

        Object.entries(sliders).forEach(([id, { value, display }]) => {
            const slider = this.elements[id];
            if (slider) {
                slider.value = value;
                // Trigger input event to update fill
                slider.dispatchEvent(new Event('input'));
            }
            
            // Update display values
            const displayElement = document.getElementById(id.replace('Slider', 'Value'));
            if (displayElement) {
                displayElement.textContent = display;
            }
        });

        // Apply the reset filters
        this.applyEnhancements();
    }

    handleDimensionChange(dimension, value) {
        if (!value) return;
        
        const numValue = parseInt(value);
        if (isNaN(numValue) || numValue < 1) return;
        
        if (this.maintainAspectRatio && this.originalWidth && this.originalHeight) {
            const ratio = this.originalWidth / this.originalHeight;
            
            if (dimension === 'width') {
                const newHeight = Math.round(numValue / ratio);
                this.elements.heightInput.value = newHeight;
            } else {
                const newWidth = Math.round(numValue * ratio);
                this.elements.widthInput.value = newWidth;
            }
        }
    }
    
    applyCustomDimensions() {
        const width = this.elements.widthInput.value ? parseInt(this.elements.widthInput.value) : null;
        const height = this.elements.heightInput.value ? parseInt(this.elements.heightInput.value) : null;
        
        if ((width && width < 10) || (height && height < 10)) {
            this.showError('Dimensions must be at least 10px');
            return;
        }
        
        this.currentFilters.customWidth = width;
        this.currentFilters.customHeight = height;
        
        // If only one dimension is provided, calculate the other to maintain aspect ratio
        if (width && !height && this.originalWidth && this.originalHeight) {
            this.currentFilters.customHeight = Math.round((width / this.originalWidth) * this.originalHeight);
            this.elements.heightInput.value = this.currentFilters.customHeight;
        } else if (height && !width && this.originalWidth && this.originalHeight) {
            this.currentFilters.customWidth = Math.round((height / this.originalHeight) * this.originalWidth);
            this.elements.widthInput.value = this.currentFilters.customWidth;
        }
        
        this.applyEnhancements();
    }
    
    async exportAsPDF(link, fileName) {
        try {
            // Use the jsPDF library (loaded from CDN)
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({
                orientation: this.canvas.width > this.canvas.height ? 'l' : 'p',
                unit: 'px',
                format: [this.canvas.width, this.canvas.height]
            });
            
            // Convert canvas to image data
            const imgData = this.canvas.toDataURL('image/jpeg', 0.9);
            
            // Add image to PDF
            pdf.addImage(imgData, 'JPEG', 0, 0, this.canvas.width, this.canvas.height);
            
            // Save the PDF
            pdf.save(fileName);
            
        } catch (error) {
            console.error('PDF export error:', error);
            this.showError('Error creating PDF: ' + error.message);
        }
    }
    
    downloadImage() {
        if (!this.canvas) {
            this.showError('No enhanced image to download');
            return;
        }
        
        const quality = this.currentFilters.quality || 0.85;
        const format = this.currentFilters.format || 'jpeg';
        const mimeType = format === 'pdf' ? 'application/pdf' : `image/${format}`;
        const fileName = `image-${new Date().getTime()}.${format === 'jpg' ? 'jpeg' : format}`;

        try {
            const link = document.createElement('a');
            link.download = fileName;
            
            if (format === 'pdf') {
                this.exportAsPDF(link, fileName);
                return;
            }
            
            // For image formats
            this.canvas.toBlob((blob) => {
                const url = URL.createObjectURL(blob);
                link.href = url;
                document.body.appendChild(link);
                link.click();
                
                // Clean up
                setTimeout(() => {
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                }, 0);
            }, mimeType, quality);
            
        } catch (error) {
            console.error('Download error:', error);
            this.showError('Error downloading image: ' + error.message);
        }
    }

    showControls() {
        this.elements.enhancementControls.style.display = 'block';
        this.elements.imagePreview.style.display = 'block';
    }

    showLoading(show) {
        this.elements.loading.style.display = show ? 'block' : 'none';
    }

    showError(message) {
        const errorEl = this.elements.errorMessage;
        errorEl.style.display = 'block';
        errorEl.querySelector('p').innerHTML = `
            <strong>Error:</strong> ${message}
            <div class="error-tip">
                <strong>Tips:</strong>
                <ul>
                    <li>Make sure the URL points directly to an image</li>
                    <li>Try images from websites that allow hotlinking</li>
                    <li>Some websites block external access to their images</li>
                    <li>Try one of our sample images using the button below</li>
                </ul>
            </div>
        `;
    }

    hideError() {
        this.elements.errorMessage.style.display = 'none';
    }

    showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'upload-notification';
        notification.textContent = message;
        document.body.appendChild(notification);
        
        // Trigger reflow
        notification.offsetHeight;
        
        // Add show class
        notification.classList.add('show');
        
        // Remove notification after 3 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ImageDownloader();
});

// Add some utility functions for better user experience
document.addEventListener('DOMContentLoaded', () => {
    // Add sample image URLs for testing
    const sampleUrls = [
        'https://image2url.com/images/1757062180458-8d521f5c-c59f-47e9-8a52-380892d534de.png',
        'https://image.aipassportphotos.com/upload/identification/blur/photo-enhance-compare-1.webp',
        'https://image2url.com/images/1757059082173-23735a08-08b8-4eed-a852-130db4521395.png'
    ];

    // Add a sample button with note
    const inputSection = document.querySelector('.input-section');
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'sample-button-container';
    
    const sampleButton = document.createElement('button');
    sampleButton.textContent = '📷 Try Sample Image';
    sampleButton.className = 'btn btn-secondary';
    
    const note = document.createElement('div');
    note.className = 'sample-note';
    note.innerHTML = `
        <div class="instruction">1. <strong>Paste a URL</strong> and click <strong>Load Image</strong></div>
        <div class="instruction">2. <strong>Upload</strong> an image directly</div>
        <div class="instruction">3. <strong>Try Sample Image</strong> and click <strong>Load Image</strong></div>
    `;
    
    buttonContainer.appendChild(sampleButton);
    buttonContainer.appendChild(note);
    inputSection.appendChild(buttonContainer);
    
    sampleButton.addEventListener('click', () => {
        const urlInput = document.getElementById('imageUrl');
        // Force blur and focus to ensure any pending changes are processed
        urlInput.blur();
        const randomUrl = sampleUrls[Math.floor(Math.random() * sampleUrls.length)];
        urlInput.value = randomUrl;
        // Trigger input event to ensure any listeners are notified
        const event = new Event('input', { bubbles: true });
        urlInput.dispatchEvent(event);
        // Focus back to the input for better UX
        urlInput.focus();
    });
    
    // Show notification when image is uploaded
    const fileInput = document.getElementById('fileInput');
    fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            const imageDownloader = new ImageDownloader();
            imageDownloader.showNotification('Image uploaded successfully! Scroll down to see it.');
        }
    });
});
