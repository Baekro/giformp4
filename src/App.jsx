import React, { useState, useRef, useEffect } from 'react';
import { Upload, Download, Moon, Sun, Film, Loader } from 'lucide-react';

export default function ImageConverter() {
  const [isDark, setIsDark] = useState(true);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [format, setFormat] = useState('mp4');
  const [duration, setDuration] = useState(3);
  const [isConverting, setIsConverting] = useState(false);
  const [outputUrl, setOutputUrl] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [conversionStatus, setConversionStatus] = useState('');
  const fileInputRef = useRef(null);
  const ffmpegRef = useRef(null);
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);
  
  // 모바일 감지
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  useEffect(() => {
    // gif.js 라이브러리 로드
    const gifScript = document.createElement('script');
    gifScript.src = 'https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.js';
    gifScript.async = true;
    document.body.appendChild(gifScript);
    
    // 모바일에서만 FFmpeg 로드
    if (isMobile) {
      const loadFFmpeg = async () => {
        try {
          const ffmpegScript = document.createElement('script');
          ffmpegScript.src = 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.6/dist/umd/ffmpeg.js';
          ffmpegScript.async = true;
          document.body.appendChild(ffmpegScript);
          
          ffmpegScript.onload = async () => {
            const { FFmpeg } = window.FFmpegWASM;
            const ffmpeg = new FFmpeg();
            
            ffmpeg.on('log', ({ message }) => {
            });
            
            await ffmpeg.load({
              coreURL: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.4/dist/umd/ffmpeg-core.js',
              wasmURL: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.4/dist/umd/ffmpeg-core.wasm',
            });
            
            ffmpegRef.current = ffmpeg;
            setFfmpegLoaded(true);
          };
        } catch (error) {
        }
      };
      
      loadFFmpeg();
    }
    
    return () => {
      if (document.body.contains(gifScript)) {
        document.body.removeChild(gifScript);
      }
    };
  }, [isMobile]);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type.startsWith('image/')) {
      setFile(selectedFile);
      setOutputUrl(null);
      
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target.result);
      reader.readAsDataURL(selectedFile);
    }
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type.startsWith('image/')) {
      setFile(droppedFile);
      setOutputUrl(null);
      
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target.result);
      reader.readAsDataURL(droppedFile);
    }
  };

  const convertToGif = async (imageElement) => {
    return new Promise(async (resolve, reject) => {
      try {
        if (!window.GIF) {
          reject(new Error('GIF 라이브러리 로딩 대기 중...'));
          return;
        }

        const workerResponse = await fetch('https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.worker.js');
        const workerBlob = await workerResponse.blob();
        const workerUrl = URL.createObjectURL(workerBlob);

        // 이미지 크기 최적화 함수
        const createGifWithSettings = async (maxSize, quality) => {
          const scale = Math.min(1, maxSize / Math.max(imageElement.width, imageElement.height));
          const width = Math.floor(imageElement.width * scale);
          const height = Math.floor(imageElement.height * scale);

          const gif = new window.GIF({
            workers: 2,
            quality: quality,
            width: width,
            height: height,
            workerScript: workerUrl,
            repeat: 0
          });

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');

          const fps = 15;
          const duration = 3;
          const frames = fps * duration;
          const delay = Math.floor(1000 / fps);

          for (let i = 0; i < frames; i++) {
            ctx.clearRect(0, 0, width, height);
            ctx.drawImage(imageElement, 0, 0, width, height);
            
            const imageData = ctx.getImageData(0, 0, width, height);
            const data = imageData.data;
            
            for (let j = 0; j < 3; j++) {
              const randomIndex = Math.floor(Math.random() * (data.length / 4)) * 4;
              data[randomIndex + 3] = Math.max(0, data[randomIndex + 3] - 1);
            }
            
            ctx.putImageData(imageData, 0, 0);
            gif.addFrame(ctx, { copy: true, delay: delay });
          }

          return new Promise((res, rej) => {
            gif.on('finished', (blob) => res(blob));
            gif.on('error', (error) => rej(error));
            gif.render();
          });
        };

        // 15MB 제한에 맞추기 위한 반복 시도
        const maxFileSize = 15 * 1024 * 1024; // 15MB
        let currentMaxSize = 800;
        let currentQuality = 15;
        let gifBlob = null;

        // 첫 시도
        gifBlob = await createGifWithSettings(currentMaxSize, currentQuality);

        // 15MB 초과 시 크기와 품질 조정
        while (gifBlob.size > maxFileSize && (currentMaxSize > 400 || currentQuality < 30)) {
          if (currentMaxSize > 400) {
            currentMaxSize -= 100; // 해상도 감소
          } else {
            currentQuality += 5; // 품질 낮춤 (숫자가 클수록 품질 낮음)
          }
          
          setConversionStatus(`GIF 최적화 중... (${(gifBlob.size / 1024 / 1024).toFixed(1)}MB → 15MB 이하)`);
          gifBlob = await createGifWithSettings(currentMaxSize, currentQuality);
        }

        URL.revokeObjectURL(workerUrl);
        const sizeMB = (gifBlob.size / 1024 / 1024).toFixed(2);
        resolve(gifBlob);

      } catch (error) {
        reject(error);
      }
    });
  };

  const convertToVideoWithFFmpeg = async (img) => {
    if (!ffmpegRef.current) {
      throw new Error('FFmpeg가 로드되지 않았습니다');
    }

    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    
    const ffmpeg = ffmpegRef.current;
    const fps = 30;
    const totalFrames = duration * fps;
    
    // 프레임 생성
    for (let i = 0; i < totalFrames; i++) {
      ctx.drawImage(img, 0, 0);
      
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const arrayBuffer = await blob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      await ffmpeg.writeFile(`frame${i.toString().padStart(4, '0')}.png`, uint8Array);
      
      if (i % 10 === 0) {
        setConversionStatus(`MP4 생성 중... ${Math.round((i / totalFrames) * 100)}%`);
      }
    }
    
    setConversionStatus('MP4 인코딩 중...');
    
    // FFmpeg로 MP4 생성
    await ffmpeg.exec([
      '-framerate', String(fps),
      '-i', 'frame%04d.png',
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-t', String(duration),
      'output.mp4'
    ]);
    
    const data = await ffmpeg.readFile('output.mp4');
    const blob = new Blob([data.buffer], { type: 'video/mp4' });
    
    return blob;
  };

  const convertToVideo = async () => {
    if (!file) return;
    
    setIsConverting(true);
    setOutputUrl(null);
    
    try {
      const img = new Image();
      img.src = preview;
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      if (format === 'gif') {
        setConversionStatus('GIF 생성 중...');
        const gifBlob = await convertToGif(img);
        const url = URL.createObjectURL(gifBlob);
        setOutputUrl(url);
        setConversionStatus('');
        setIsConverting(false);
        return;
      }

      // 모바일에서는 FFmpeg 사용
      if (isMobile) {
        if (!ffmpegLoaded) {
          alert('비디오 변환 라이브러리를 로딩 중입니다. 잠시 후 다시 시도해주세요.');
          setIsConverting(false);
          return;
        }
        
        setConversionStatus('MP4 생성 중...');
        const mp4Blob = await convertToVideoWithFFmpeg(img);
        const url = URL.createObjectURL(mp4Blob);
        setOutputUrl(url);
        setConversionStatus('');
        setIsConverting(false);
        return;
      }

      // 데스크톱에서는 기존 MediaRecorder 사용
      setConversionStatus('MP4 생성 중...');
      
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');

      const stream = canvas.captureStream(30);
      
      const mimeTypes = [
        'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
        'video/webm;codecs=h264,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm'
      ];
      
      let selectedMimeType = null;
      for (const type of mimeTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          selectedMimeType = type;
          break;
        }
      }
      
      if (!selectedMimeType) {
        throw new Error('브라우저가 동영상 녹화를 지원하지 않습니다');
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: selectedMimeType,
        videoBitsPerSecond: 2500000
      });

      const chunks = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);
        setOutputUrl(url);
        setConversionStatus('');
        setIsConverting(false);
      };

      mediaRecorder.onerror = (error) => {
        throw new Error('생성 실패');
      };

      mediaRecorder.start();
      
      const frames = duration * 30;
      
      for (let i = 0; i < frames; i++) {
        ctx.drawImage(img, 0, 0);
        await new Promise(resolve => setTimeout(resolve, 33));
      }

      mediaRecorder.stop();
      
    } catch (error) {
      alert('변환 중 오류가 발생했습니다: ' + error.message);
      setIsConverting(false);
      setConversionStatus('');
    }
  };

  const downloadFile = () => {
    if (!outputUrl) return;
    
    const a = document.createElement('a');
    a.href = outputUrl;
    a.download = `converted_${Date.now()}.${format}`;
    a.click();
  };

  const bgColor = isDark ? 'bg-zinc-900' : 'bg-gray-50';
  const cardBg = isDark ? 'bg-zinc-800' : 'bg-white';
  const textColor = isDark ? 'text-white' : 'text-gray-900';
  const textSecondary = isDark ? 'text-gray-400' : 'text-gray-600';
  const buttonBg = isDark ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600';

  return (
    <div className={`min-h-screen ${bgColor} ${textColor} transition-colors duration-200`}>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex justify-between items-center mb-12">
          <div className="flex items-center gap-3">
            <Film className="w-8 h-8" />
            <h1 className="text-2xl md:text-3xl font-bold">이미지 변환기</h1>
          </div>
          <button
            onClick={() => setIsDark(!isDark)}
            className={`p-3 rounded-full ${cardBg} transition-colors`}
            aria-label="테마 변경"
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>

        <div className={`${cardBg} rounded-2xl p-6 md:p-8 mb-6`}>
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed ${
              isDragging 
                ? (isDark ? 'border-blue-500 bg-blue-500/10' : 'border-blue-400 bg-blue-400/10')
                : (isDark ? 'border-zinc-700' : 'border-gray-300')
            } rounded-xl p-12 text-center cursor-pointer transition-all ${
              isDark ? 'hover:border-blue-500' : 'hover:border-blue-400'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            {preview ? (
              <img src={preview} alt="미리보기" className="max-h-64 mx-auto rounded-lg" />
            ) : (
              <div className="flex flex-col items-center gap-4">
                <Upload className={`w-16 h-16 ${textSecondary} ${isDragging ? 'scale-110' : ''} transition-transform`} />
                <p className={`text-lg ${textSecondary}`}>
                  {isDragging ? '여기에 놓으세요' : '이미지를 클릭하거나 드래그하여 업로드'}
                </p>
                <p className={`text-sm ${textSecondary}`}>PNG, JPG, WEBP 지원</p>
              </div>
            )}
          </div>

          {file && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${textSecondary}`}>
                    출력 타입
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => {
                        setFormat('mp4');
                        setOutputUrl(null);
                      }}
                      className={`p-4 rounded-xl transition-colors ${format === 'mp4' ? buttonBg : isDark ? 'bg-zinc-700' : 'bg-gray-200'}`}
                    >
                      <Film className="w-6 h-6 mx-auto mb-2" />
                      <span className="text-sm font-medium">MP4</span>
                      <span className="text-xs block mt-1 opacity-70">3~10초</span>
                    </button>
                    <button
                      onClick={() => {
                        setFormat('gif');
                        setOutputUrl(null);
                      }}
                      className={`p-4 rounded-xl transition-colors ${format === 'gif' ? buttonBg : isDark ? 'bg-zinc-700' : 'bg-gray-200'}`}
                    >
                      <svg className="w-6 h-6 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-sm font-medium">GIF</span>
                      <span className="text-xs block mt-1 opacity-70">무한루프</span>
                    </button>
                  </div>
                </div>

                {format === 'mp4' && (
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${textSecondary}`}>
                      재생 시간: {duration}초
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={duration}
                      onChange={(e) => setDuration(Number(e.target.value))}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                      style={{
                        background: isDark
                          ? `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(duration - 1) * 11.11}%, #52525b ${(duration - 1) * 11.11}%, #52525b 100%)`
                          : `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(duration - 1) * 11.11}%, #d1d5db ${(duration - 1) * 11.11}%, #d1d5db 100%)`
                      }}
                    />
                  </div>
                )}
              </div>

              <button
                onClick={convertToVideo}
                disabled={isConverting}
                className={`w-full mt-6 ${buttonBg} text-white py-4 rounded-xl font-medium transition-colors flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isConverting ? (
                  <>
                    <Loader className="w-5 h-5 animate-spin" />
                    {conversionStatus || '변환 중...'}
                  </>
                ) : (
                  <>
                    <Film className="w-5 h-5" />
                    {format.toUpperCase()}로 변환
                  </>
                )}
              </button>
            </>
          )}

          {outputUrl && (
            <div className="mt-8 pt-8 border-t border-zinc-700">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div>
                  <p className="font-medium">변환 완료!</p>
                  <p className={`text-sm ${textSecondary}`}>
                    {format.toUpperCase()} 파일이 생성되었습니다
                  </p>
                </div>
                <button
                  onClick={downloadFile}
                  className={`${buttonBg} text-white px-6 py-3 rounded-xl font-medium transition-colors flex items-center gap-2`}
                >
                  <Download className="w-5 h-5" />
                  다운로드
                </button>
              </div>
            </div>
          )}
        </div>

        <div className={`${cardBg} rounded-2xl p-6`}>
          <h2 className="font-semibold mb-4">사용 안내</h2>
          <ul className={`space-y-2 ${textSecondary} text-sm`}>
            <li>• 트위터, 인스타그램에서 정상 작동합니다</li>
            <li>• 이미지의 원본 비율이 유지됩니다</li>
            <li>• GIF: 15MB 미만으로 화질이 고정됩니다</li>
            <li>• 로컬로 구동되어 이미지 정보가 저장되지 않습니다</li>
            {isMobile && format === 'mp4' && <li>• 모바일: 첫 변환 시 라이브러리 로딩에 시간이 걸릴 수 있습니다</li>}
          </ul>
        </div>

        <div className={`${cardBg} rounded-2xl p-4 mt-4 text-center`}>
          <p className={`text-xs ${textSecondary}`}>
            오류 제보는{' '}
            <span className="text-blue-500">bistrobaek@gmail.com</span>
          </p>
        </div>
      </div>
    </div>
  );
}