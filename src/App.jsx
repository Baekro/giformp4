import React, { useState, useRef } from 'react';
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
  const fileInputRef = useRef(null);

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

  const convertToVideo = async () => {
    if (!file) return;
    
    setIsConverting(true);
    
    try {
      const img = new Image();
      img.src = preview;
      
      await new Promise((resolve) => {
        img.onload = resolve;
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');

      if (format === 'gif') {
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((blob) => {
          const url = URL.createObjectURL(blob);
          setOutputUrl(url);
          setIsConverting(false);
        }, 'image/gif');
      } else {
        const stream = canvas.captureStream(30);
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'video/webm;codecs=vp9',
          videoBitsPerSecond: 5000000
        });

        const chunks = [];
        mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          setOutputUrl(url);
          setIsConverting(false);
        };

        mediaRecorder.start();
        ctx.drawImage(img, 0, 0);

        setTimeout(() => {
          mediaRecorder.stop();
        }, duration * 1000);
      }
    } catch (error) {
      console.error('변환 오류:', error);
      setIsConverting(false);
    }
  };

  const downloadFile = () => {
    if (!outputUrl) return;
    
    const a = document.createElement('a');
    a.href = outputUrl;
    a.download = `converted.${format === 'mp4' ? 'webm' : 'gif'}`;
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
        {/* 헤더 */}
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

        {/* 메인 컨텐츠 */}
        <div className={`${cardBg} rounded-2xl p-6 md:p-8 mb-6`}>
          {/* 파일 업로드 영역 */}
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
              {/* 옵션 설정 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${textSecondary}`}>
                    출력 포맷
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setFormat('mp4')}
                      className={`p-4 rounded-xl transition-colors ${format === 'mp4' ? buttonBg : isDark ? 'bg-zinc-700' : 'bg-gray-200'}`}
                    >
                      <Film className="w-6 h-6 mx-auto mb-2" />
                      <span className="text-sm font-medium">MP4</span>
                    </button>
                    <button
                      onClick={() => setFormat('gif')}
                      className={`p-4 rounded-xl transition-colors ${format === 'gif' ? buttonBg : isDark ? 'bg-zinc-700' : 'bg-gray-200'}`}
                    >
                      <svg className="w-6 h-6 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-sm font-medium">GIF</span>
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

              {/* 변환 버튼 */}
              <button
                onClick={convertToVideo}
                disabled={isConverting}
                className={`w-full mt-8 ${buttonBg} text-white py-4 rounded-xl font-medium transition-colors flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isConverting ? (
                  <>
                    <Loader className="w-5 h-5 animate-spin" />
                    변환 중...
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

           {/* 다운로드 영역 */}
          {outputUrl && (
            <div className="mt-8 pt-8 border-t border-zinc-700">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div>
                  <p className="font-medium">변환 완료!</p>
                  <p className={`text-sm ${textSecondary}`}>파일을 다운로드할 수 있습니다</p>
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

        {/* 안내 사항 */}
        <div className={`${cardBg} rounded-2xl p-6`}>
          <h2 className="font-semibold mb-4">사용 안내</h2>
          <ul className={`space-y-2 ${textSecondary} text-sm`}>
            <li>• 이미지의 원본 해상도와 비율이 유지됩니다</li>
            <li>• MP4 포맷은 정지 이미지를 지정된 시간만큼 재생합니다</li>
            <li>• GIF 포맷은 단일 프레임 이미지로 변환됩니다</li>
            <li>• 모든 변환은 브라우저에서 로컬로 처리됩니다</li>
          </ul>
        </div>
      </div>
    </div>
  );
}