import React, { useState, useRef, useEffect } from 'react';
import { Upload, Download, Moon, Sun, Film, Loader, Images, X } from 'lucide-react';

export default function ImageConverter() {
  const [isDark, setIsDark] = useState(true);
  const [files, setFiles] = useState([]);
  const [format, setFormat] = useState('mp4');
  const [duration, setDuration] = useState(3);
  const [isConverting, setIsConverting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [conversionStatus, setConversionStatus] = useState('');
  const [currentConvertingIndex, setCurrentConvertingIndex] = useState(-1);
  const [gallery, setGallery] = useState([]);
  const [showGallery, setShowGallery] = useState(false);
  const [showGalleryModal, setShowGalleryModal] = useState(false);
  const fileInputRef = useRef(null);
  const ffmpegRef = useRef(null);
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);
  const [ffmpegError, setFfmpegError] = useState(false);

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  useEffect(() => {
    const gifScript = document.createElement('script');
    gifScript.src = 'https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.js';
    gifScript.async = true;
    document.body.appendChild(gifScript);

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
    const selectedFiles = Array.from(e.target.files);
    const imageFiles = selectedFiles.filter(file => file.type.startsWith('image/'));

    const filesWithPreviews = imageFiles.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      id: Date.now() + Math.random()
    }));

    setFiles(prev => [...prev, ...filesWithPreviews]);
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

    const droppedFiles = Array.from(e.dataTransfer.files);
    const imageFiles = droppedFiles.filter(file => file.type.startsWith('image/'));

    const filesWithPreviews = imageFiles.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      id: Date.now() + Math.random()
    }));

    setFiles(prev => [...prev, ...filesWithPreviews]);
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

        const maxFileSize = 15 * 1024 * 1024;
        let currentMaxSize = 800;
        let currentQuality = 15;
        let gifBlob = null;

        gifBlob = await createGifWithSettings(currentMaxSize, currentQuality);

        while (gifBlob.size > maxFileSize && (currentMaxSize > 400 || currentQuality < 30)) {
          if (currentMaxSize > 400) {
            currentMaxSize -= 100;
          } else {
            currentQuality += 5;
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
    if (files.length === 0) return;

    setIsConverting(true);
    setShowGallery(false);
    const convertedItems = [];

    for (let i = 0; i < files.length; i++) {
      setCurrentConvertingIndex(i);
      const fileItem = files[i];

      try {
        const img = new Image();
        img.src = fileItem.preview;

        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });

        if (format === 'gif') {
          setConversionStatus(`GIF 생성 중... (${i + 1}/${files.length})`);
          const gifBlob = await convertToGif(img);
          const url = URL.createObjectURL(gifBlob);
          convertedItems.push({
            originalPreview: fileItem.preview,
            outputUrl: url,
            format: 'gif',
            id: fileItem.id
          });
        } else {
          if (isMobile) {
            if (!ffmpegLoaded && !ffmpegError) {
              alert('비디오 변환 라이브러리를 로딩 중입니다. 잠시 후 다시 시도해주세요.');
              setIsConverting(false);
              setCurrentConvertingIndex(-1);
              return;
            }

            if (!ffmpegError && ffmpegRef.current) {
              setConversionStatus(`MP4 생성 중... (${i + 1}/${files.length})`);
              const mp4Blob = await convertToVideoWithFFmpeg(img);
              const url = URL.createObjectURL(mp4Blob);
              convertedItems.push({
                originalPreview: fileItem.preview,
                outputUrl: url,
                format: 'mp4',
                id: fileItem.id
              });
              continue;
            }
          }

          setConversionStatus(`MP4 생성 중... (${i + 1}/${files.length})`);

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

          const url = await new Promise((resolve, reject) => {
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
              resolve(url);
            };

            mediaRecorder.onerror = (error) => {
              reject(new Error('생성 실패'));
            };

            mediaRecorder.start();

            const frames = duration * 30;

            (async () => {
              for (let j = 0; j < frames; j++) {
                ctx.drawImage(img, 0, 0);
                await new Promise(resolve => setTimeout(resolve, 33));
              }
              mediaRecorder.stop();
            })();
          });

          convertedItems.push({
            originalPreview: fileItem.preview,
            outputUrl: url,
            format: 'mp4',
            id: fileItem.id
          });
        }
      } catch (error) {
        console.error(`파일 ${i + 1} 변환 실패:`, error);
      }
    }

    setGallery(convertedItems);
    setIsConverting(false);
    setCurrentConvertingIndex(-1);
    setConversionStatus('');
    setShowGallery(true);
  };

  const downloadFile = (url, index) => {
    if (!url) return;

    const a = document.createElement('a');
    a.href = url;
    a.download = `converted_${index + 1}_${Date.now()}.${format}`;
    a.click();
  };

  const downloadAllFiles = () => {
    gallery.forEach((item, index) => {
      setTimeout(() => {
        downloadFile(item.outputUrl, index);
      }, index * 500);
    });
  };

  const removeFile = (id) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const clearAll = () => {
    setFiles([]);
    setGallery([]);
    setShowGallery(false);
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
          <div className="flex items-center gap-2">
            {gallery.length > 0 && (
              <button
                onClick={() => setShowGalleryModal(true)}
                className={`p-3 rounded-full ${cardBg} transition-colors relative`}
                aria-label="갤러리 보기"
              >
                <Images className="w-5 h-5" />
                <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-medium">
                  {gallery.length}
                </span>
              </button>
            )}
            <button
              onClick={() => setIsDark(!isDark)}
              className={`p-3 rounded-full ${cardBg} transition-colors`}
              aria-label="테마 변경"
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <div className={`${cardBg} rounded-2xl p-6 md:p-8 mb-6`}>
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed ${isDragging
              ? (isDark ? 'border-blue-500 bg-blue-500/10' : 'border-blue-400 bg-blue-400/10')
              : (isDark ? 'border-zinc-700' : 'border-gray-300')
              } rounded-xl p-12 text-center cursor-pointer transition-all ${isDark ? 'hover:border-blue-500' : 'hover:border-blue-400'
              }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />
            {files.length === 0 ? (
              <div className="flex flex-col items-center gap-4">
                <Upload className={`w-16 h-16 ${textSecondary} ${isDragging ? 'scale-110' : ''} transition-transform`} />
                <p className={`text-lg ${textSecondary}`}>
                  {isDragging ? '여기에 놓으세요' : '이미지를 클릭하거나 드래그하여 업로드'}
                </p>
                <p className={`text-sm ${textSecondary}`}>PNG, JPG, WEBP 지원 (다중 선택 가능)</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {files.map((fileItem, index) => (
                  <div key={fileItem.id} className="relative group">
                    <img
                      src={fileItem.preview}
                      alt={`미리보기 ${index + 1}`}
                      className="w-full h-32 object-cover rounded-lg"
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(fileItem.id);
                      }}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ×
                    </button>
                    {currentConvertingIndex === index && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                        <Loader className="w-6 h-6 animate-spin text-white" />
                      </div>
                    )}
                  </div>
                ))}
                <div
                  className={`border-2 border-dashed ${isDark ? 'border-zinc-600' : 'border-gray-400'} rounded-lg h-32 flex items-center justify-center cursor-pointer hover:border-blue-500 transition-colors`}
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                >
                  <Upload className="w-8 h-8" />
                </div>
              </div>
            )}
          </div>

          {files.length > 0 && (
            <>
              <div className="flex justify-between items-center mt-6 mb-4">
                <p className={`text-sm ${textSecondary}`}>
                  {files.length}개의 이미지 선택됨
                </p>
                <button
                  onClick={clearAll}
                  className={`text-sm ${isDark ? 'text-red-400 hover:text-red-300' : 'text-red-600 hover:text-red-700'}`}
                >
                  전체 삭제
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${textSecondary}`}>
                    출력 타입
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => {
                        setFormat('mp4');
                        setGallery([]);
                        setShowGallery(false);
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
                        setGallery([]);
                        setShowGallery(false);
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
                    {format.toUpperCase()}로 변환 ({files.length}개)
                  </>
                )}
              </button>
            </>
          )}
        </div>

        {showGallery && gallery.length > 0 && (
          <div className={`${cardBg} rounded-2xl p-6 md:p-8 mb-6`}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">변환된 파일 ({gallery.length}개)</h2>
              <button
                onClick={downloadAllFiles}
                className={`${buttonBg} text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 text-sm`}
              >
                <Download className="w-4 h-4" />
                전체 다운로드
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {gallery.map((item, index) => (
                <div key={item.id} className={`${isDark ? 'bg-zinc-700' : 'bg-gray-100'} rounded-xl p-4`}>
                  <div className="mb-3">
                    <p className={`text-xs ${textSecondary} mb-2`}>원본</p>
                    <img
                      src={item.originalPreview}
                      alt={`원본 ${index + 1}`}
                      className="w-full h-32 object-cover rounded-lg"
                    />
                  </div>

                  <div className="mb-3">
                    <p className={`text-xs ${textSecondary} mb-2`}>변환됨 ({item.format.toUpperCase()})</p>
                    {item.format === 'gif' ? (
                      <img
                        src={item.outputUrl}
                        alt={`변환됨 ${index + 1}`}
                        className="w-full h-32 object-cover rounded-lg"
                      />
                    ) : (
                      <video
                        src={item.outputUrl}
                        className="w-full h-32 object-cover rounded-lg"
                        autoPlay
                        loop
                        muted
                        playsInline
                      />
                    )}
                  </div>

                  <button
                    onClick={() => downloadFile(item.outputUrl, index)}
                    className={`w-full ${buttonBg} text-white py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 text-sm`}
                  >
                    <Download className="w-4 h-4" />
                    다운로드
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className={`${cardBg} rounded-2xl p-6`}>
          <h2 className="font-semibold mb-4">사용 안내</h2>
          <ul className={`space-y-2 ${textSecondary} text-sm`}>
            <li>• 트위터, 인스타그램에서 정상 작동합니다</li>
            <li>• 이미지의 원본 비율이 유지됩니다</li>
            <li>• GIF: 15MB 미만으로 화질이 고정됩니다</li>
            <li>• 여러 이미지를 한번에 변환할 수 있습니다</li>
            <li>• 로컬로 구동되어 이미지 정보가 저장되지 않습니다</li>
            {isMobile && format === 'mp4' && !ffmpegLoaded && !ffmpegError && (
              <li className="text-yellow-500">• 모바일: 비디오 라이브러리 로딩 중...</li>
            )}
          </ul>
        </div>

        <div className={`${cardBg} rounded-2xl p-4 mt-4 text-center`}>
          <p className={`text-xs ${textSecondary}`}>
            오류 제보는{' '}
            <span className="text-blue-500">bistrobaek@gmail.com</span>
          </p>
        </div>
      </div>

      {/* 갤러리 모달 */}
      {showGalleryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* 배경 오버레이 */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowGalleryModal(false)}
          />

          {/* 모달 콘텐츠 */}
          <div className={`relative ${cardBg} rounded-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden shadow-2xl`}>
            {/* 모달 헤더 */}
            <div className={`flex justify-between items-center p-4 md:p-6 border-b ${isDark ? 'border-zinc-700' : 'border-gray-200'}`}>
              <div className="flex items-center gap-3">
                <Images className="w-6 h-6 text-blue-500" />
                <h2 className="text-xl font-bold">변환된 파일 ({gallery.length}개)</h2>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={downloadAllFiles}
                  className={`${buttonBg} text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 text-sm`}
                >
                  <Download className="w-4 h-4" />
                  전체 다운로드
                </button>
                <button
                  onClick={() => setShowGalleryModal(false)}
                  className={`p-2 rounded-full ${isDark ? 'hover:bg-zinc-700' : 'hover:bg-gray-200'} transition-colors`}
                  aria-label="닫기"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* 모달 바디 - 갤러리 그리드 */}
            <div className="p-4 md:p-6 overflow-y-auto max-h-[calc(85vh-80px)]">
              {gallery.length === 0 ? (
                <div className={`text-center py-12 ${textSecondary}`}>
                  <Images className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>아직 변환된 파일이 없습니다</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {gallery.map((item, index) => (
                    <div
                      key={item.id}
                      className={`${isDark ? 'bg-zinc-700/50' : 'bg-gray-100'} rounded-xl p-3 group hover:scale-[1.02] transition-transform`}
                    >
                      {/* 변환된 파일 미리보기 */}
                      <div className="relative mb-3 rounded-lg overflow-hidden">
                        {item.format === 'gif' ? (
                          <img
                            src={item.outputUrl}
                            alt={`변환됨 ${index + 1}`}
                            className="w-full h-28 md:h-32 object-cover"
                          />
                        ) : (
                          <video
                            src={item.outputUrl}
                            className="w-full h-28 md:h-32 object-cover"
                            autoPlay
                            loop
                            muted
                            playsInline
                          />
                        )}
                        <span className={`absolute top-2 left-2 text-xs px-2 py-1 rounded-full font-medium ${item.format === 'gif'
                            ? 'bg-purple-500 text-white'
                            : 'bg-green-500 text-white'
                          }`}>
                          {item.format.toUpperCase()}
                        </span>
                      </div>

                      {/* 원본 썸네일 */}
                      <div className="flex items-center gap-2 mb-3">
                        <img
                          src={item.originalPreview}
                          alt={`원본 ${index + 1}`}
                          className="w-8 h-8 object-cover rounded"
                        />
                        <span className={`text-xs ${textSecondary}`}>원본</span>
                      </div>

                      {/* 다운로드 버튼 */}
                      <button
                        onClick={() => downloadFile(item.outputUrl, index)}
                        className={`w-full ${buttonBg} text-white py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 text-xs md:text-sm`}
                      >
                        <Download className="w-3 h-3 md:w-4 md:h-4" />
                        다운로드
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}