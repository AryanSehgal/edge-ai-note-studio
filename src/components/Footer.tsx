import React from 'react';
import { ExternalLink, Github, Sparkles } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer
      id="studio-app-footer"
      className="mt-6 pt-6 pb-8 border-t border-slate-200/80 shrink-0"
    >
      <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Left: Product & Edge AI Tagline */}
        <div className="flex items-center gap-3 text-center sm:text-left">
          <div className="w-8 h-8 rounded-xl bg-linear-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center shadow-xs shrink-0">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-800 tracking-tight">
              Edge AI Note Studio
            </p>
            <p className="text-[11px] text-slate-500">
              Private, 100% On-Device Transcription & Markdown Notes
            </p>
          </div>
        </div>

        {/* Right: Creator Attribution (Aryan Sehgal) */}
        <a
          id="creator-credit-footer-link"
          href="https://github.com/AryanSehgal"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-3.5 py-2 rounded-xl bg-white hover:bg-blue-50/50 border border-slate-200 hover:border-blue-300 transition-all group shadow-2xs cursor-pointer"
          title="Product built by Aryan Sehgal — View GitHub Profile"
        >
          <img
            src="/creator-aryan.png"
            alt="Aryan Sehgal"
            className="w-8 h-8 rounded-full object-cover border border-blue-500 group-hover:scale-105 transition-transform shrink-0"
          />
          <div className="text-left">
            <div className="text-[10px] uppercase font-semibold tracking-wider text-slate-400 leading-tight">
              Created & Built by
            </div>
            <div className="text-xs font-bold text-slate-800 group-hover:text-blue-600 transition-colors flex items-center gap-1 leading-tight">
              <span>Aryan Sehgal</span>
              <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-blue-600 transition-colors" />
            </div>
          </div>
          <div className="pl-1 border-l border-slate-100 flex items-center text-slate-400 group-hover:text-slate-700 transition-colors">
            <Github className="w-4 h-4" />
          </div>
        </a>
      </div>
    </footer>
  );
};
