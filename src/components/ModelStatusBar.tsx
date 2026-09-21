import React from 'react';
import { ModelLoadProgress, HardwareDevice } from '../types';
import { Cpu, Zap, DownloadCloud, CheckCircle2 } from 'lucide-react';

interface ModelStatusBarProps {
  progress: ModelLoadProgress;
  llmProgress?: ModelLoadProgress;
  onSelectModel: (modelId: string, device: HardwareDevice) => void;
}

export const ModelStatusBar: React.FC<ModelStatusBarProps> = ({
  progress,
  llmProgress,
  onSelectModel,
}) => {
  const isWebGPU = progress.device === 'webgpu';
  const isReady = progress.status === 'ready' && llmProgress?.status === 'ready';

  return (
    <div
      id="model-status-bar"
      className="bg-white border-b border-slate-200 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs"
    >
      {/* Left: Device & Model Info */}
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Hardware Acceleration Badge */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium border ${
            isWebGPU
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-amber-50 text-amber-800 border-amber-200'
          }`}
          title={
            isWebGPU
              ? 'WebGPU Hardware Acceleration Active (Client GPU Direct Compute)'
              : 'WebAssembly (WASM CPU) Active (Client Browser Native Compute)'
          }
        >
          {isWebGPU ? (
            <Zap className="w-3.5 h-3.5 fill-current text-emerald-600" />
          ) : (
            <Cpu className="w-3.5 h-3.5 text-amber-600" />
          )}
          <span className="font-mono text-[11px] font-semibold">
            {isWebGPU ? 'WebGPU Hardware Accelerated' : 'WASM (CPU Native)'}
          </span>
        </div>

        {/* Speech Engine Selection */}
        <div className="flex items-center gap-1.5 text-slate-600">
          <span className="text-slate-400 text-[11px]">Speech Engine:</span>
          <select
            id="model-select-dropdown"
            value={progress.modelName}
            disabled={progress.status === 'loading'}
            onChange={(e) => onSelectModel(e.target.value, progress.device)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-md px-2 py-0.5 text-slate-800 focus:outline-hidden font-medium cursor-pointer disabled:opacity-60"
            title="Choose the on-device Whisper speech model"
          >
            <option value="onnx-community/whisper-tiny.en">Whisper Tiny (~75MB • Fast Edge)</option>
            <option value="onnx-community/whisper-base.en">Whisper Base (~140MB • High Accuracy)</option>
          </select>
        </div>

      </div>

      {/* Right: Load Status / Automated Progress */}
      <div className="flex items-center gap-2">
        {progress.status === 'loading' && (
          <div className="flex items-center gap-2" title="Downloading on-device Whisper model weights into browser cache">
            <DownloadCloud className="w-3.5 h-3.5 text-blue-600 animate-bounce" />
            <div className="w-24 sm:w-32 bg-slate-100 h-1.5 rounded-full overflow-hidden border border-slate-200">
              <div
                className="bg-blue-600 h-full transition-all duration-200"
                style={{ width: `${progress.progress}%` }}
              />
            </div>
            <span className="font-mono text-[11px] text-blue-700 font-semibold">
              Whisper {progress.progress}%
            </span>
          </div>
        )}

        {llmProgress?.status === 'loading' && (
          <div className="flex items-center gap-2" title="Downloading on-device LLM model weights into browser cache">
            <DownloadCloud className="w-3.5 h-3.5 text-indigo-600 animate-bounce" />
            <div className="w-20 bg-slate-100 h-1.5 rounded-full overflow-hidden border border-slate-200">
              <div
                className="bg-indigo-600 h-full transition-all duration-200"
                style={{ width: `${llmProgress.progress}%` }}
              />
            </div>
            <span className="font-mono text-[11px] text-indigo-700 font-semibold">
              LLM {llmProgress.progress}%
            </span>
          </div>
        )}

        {isReady && (
          <div className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full text-[11px] font-medium border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>Models Ready Locally</span>
          </div>
        )}

        {progress.status === 'idle' && (
          <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
            <span className="w-2 h-2 rounded-full bg-slate-300" />
            <span>Ready on Device</span>
          </div>
        )}
      </div>
    </div>
  );
};
