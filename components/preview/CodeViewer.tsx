"use client";
import React, { useState } from "react";
import { Copy, Check, Download, ChevronRight, ChevronDown, FolderOpen, Folder } from "lucide-react";
import Editor from "@monaco-editor/react";
import { useAppStore } from "@/store/appStore";
import { useFileContent, useProjectFiles } from "@/hooks/useProjects";
import { getFileIcon } from "@/components/ui/getFileIcon";
import { cn } from "@/lib/utils";

function getLanguage(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    jsx: "javascript", tsx: "typescript", js: "javascript",
    ts: "typescript", css: "css", html: "html",
    json: "json", md: "markdown", py: "python", sh: "shell",
  };
  return map[ext ?? ""] ?? "plaintext";
}

// Group files into folders
function groupFiles(files: { path: string }[]) {
  const tree: Record<string, string[]> = {};
  const rootFiles: string[] = [];

  files.forEach(({ path }) => {
    const parts = path.split("/");
    if (parts.length === 1) {
      rootFiles.push(path);
    } else {
      const folder = parts.slice(0, -1).join("/");
      if (!tree[folder]) tree[folder] = [];
      tree[folder].push(path);
    }
  });

  return { tree, rootFiles };
}

export function CodeViewer() {
  const { activeProject, selectedFile, setSelectedFile } = useAppStore();
  const [copied, setCopied] = useState(false);
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());

  const { data: fileData, isLoading } = useFileContent(
    activeProject?.id ?? null,
    selectedFile?.path ?? null
  );
  const { data: projectFiles } = useProjectFiles(activeProject?.id ?? null);

  const files = projectFiles ?? [];
  const { tree, rootFiles } = groupFiles(files);

  function toggleFolder(folder: string) {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      next.has(folder) ? next.delete(folder) : next.add(folder);
      return next;
    });
  }

  async function handleCopy() {
    if (!fileData?.content) return;
    await navigator.clipboard.writeText(fileData.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownload() {
    if (!fileData?.content || !selectedFile) return;
    const blob = new Blob([fileData.content], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = selectedFile.path.split("/").pop() ?? "file.txt";
    a.click();
  }

  const fileName = selectedFile?.path.split("/").pop() ?? selectedFile?.path ?? "";
  const language = getLanguage(fileName);
  const lineCount = (fileData?.content ?? "").split("\n").length;

  return (
    <div className="h-full flex overflow-hidden bg-[#0a0a0a]">

      {/* ── FILE TREE SIDEBAR ── */}
      <div className="w-60 shrink-0 flex flex-col border-r border-white/[0.08] bg-[#0b0c0d] overflow-y-auto">
        
        {/* Sidebar header */}
        <div className="px-4 py-4 border-b border-white/[0.08]">
          <p className="text-[18px] font-semibold text-white/90">Files</p>
          <span className="mt-1 block text-[13px] text-white/35">{files.length} files</span>
        </div>

        {/* File list */}
        <div className="flex-1 py-1">

          {/* Root files */}
          {rootFiles.map((path) => {
            const name = path.split("/").pop() ?? path;
            const isActive = selectedFile?.path === path;
            return (
              <button
                key={path}
                onClick={() => setSelectedFile({ path } as any)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-1.5 text-left transition-all duration-150",
                  isActive
                    ? "bg-white/[0.08] text-white"
                    : "text-white/40 hover:bg-white/[0.03] hover:text-white/70"
                )}
              >
                <span className="text-sm shrink-0 opacity-70">{getFileIcon(name)}</span>
                <span className="text-[11px] font-mono truncate tracking-wide">{name}</span>
              </button>
            );
          })}

          {/* Folders */}
          {Object.entries(tree).map(([folder, filePaths]) => {
            const isCollapsed = collapsedFolders.has(folder);
            const folderName = folder.split("/").pop() ?? folder;
            return (
              <div key={folder}>
                {/* Folder row */}
                <button
                  onClick={() => toggleFolder(folder)}
                  className="w-full flex items-center gap-1.5 px-3 py-1.5 text-white/30 hover:text-white/60 hover:bg-white/[0.02] transition-all duration-150"
                >
                  {isCollapsed
                    ? <ChevronRight size={11} className="shrink-0 opacity-50" />
                    : <ChevronDown size={11} className="shrink-0 opacity-50" />
                  }
                  {isCollapsed
                    ? <Folder size={12} className="shrink-0 opacity-60" />
                    : <FolderOpen size={12} className="shrink-0 opacity-60" />
                  }
                  <span className="text-[11px] font-mono truncate tracking-wide">{folderName}</span>
                </button>

                {/* Folder files */}
                {!isCollapsed && filePaths.map((path) => {
                  const name = path.split("/").pop() ?? path;
                  const isActive = selectedFile?.path === path;
                  return (
                    <button
                      key={path}
                      onClick={() => setSelectedFile({ path } as any)}
                      className={cn(
                        "w-full flex items-center gap-2 pl-8 pr-3 py-1.5 text-left transition-all duration-150",
                        isActive
                          ? "bg-white/[0.08] text-white"
                          : "text-white/35 hover:bg-white/[0.02] hover:text-white/65"
                      )}
                    >
                      <span className="text-sm shrink-0 opacity-70">{getFileIcon(name)}</span>
                      <span className="text-[11px] font-mono truncate tracking-wide">{name}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}

        </div>
      </div>

      {/* ── EDITOR AREA ── */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#0a0a0a]">

        {/* No file selected */}
        {!selectedFile && (
          <div className="h-full flex flex-col items-center justify-center gap-3">
            <div className="text-3xl opacity-20">📄</div>
            <p className="text-xs font-mono text-white/20">No file selected</p>
            <p className="text-[10px] font-mono text-white/10">Choose a file from the explorer</p>
          </div>
        )}

        {/* File header */}
        {selectedFile && (
          <div className="h-10 px-4 shrink-0 flex items-center justify-between bg-[#0c0c0c] border-b border-white/[0.05]">
            <div className="flex items-center gap-2">
              <span className="text-sm opacity-60">{getFileIcon(fileName)}</span>
              <span className="text-xs font-mono text-white/70 font-medium tracking-wide">{fileName}</span>
              <span className="text-[10px] font-mono text-white/25">— {lineCount} lines</span>
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={handleCopy}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-[10px] font-mono transition-all duration-150 border",
                  copied
                    ? "bg-white/[0.08] border-white/20 text-white/80"
                    : "bg-white/[0.03] border-white/10 text-white/40 hover:bg-white/[0.06] hover:text-white/70"
                )}
              >
                {copied ? <Check size={10} /> : <Copy size={10} />}
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                onClick={handleDownload}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-[10px] font-mono border border-white/10 bg-white/[0.03] text-white/40 hover:bg-white/[0.06] hover:text-white/70 transition-all"
              >
                <Download size={10} /> Download
              </button>
            </div>
          </div>
        )}

        {/* Loading */}
        {selectedFile && isLoading && (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-4 h-4 rounded-full border border-white/20 border-t-white/60 animate-spin" />
          </div>
        )}

        {/* Monaco Editor */}
        {selectedFile && !isLoading && (
          <div className="flex-1 overflow-hidden">
            <Editor
              height="100%"
              language={language}
              value={fileData?.content ?? ""}
              theme="vs-dark"
              options={{
                readOnly: true,
                fontSize: 14,
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                fontLigatures: true,
                lineNumbers: "on",
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                wordWrap: "off",
                renderLineHighlight: "none",
                smoothScrolling: true,
                padding: { top: 16, bottom: 16 },
                scrollbar: { 
                  verticalScrollbarSize: 8, 
                  horizontalScrollbarSize: 8,
                  useShadows: false
                },
                bracketPairColorization: { enabled: true },
                guides: { bracketPairs: true, indentation: true },
                lineNumbersMinChars: 3,
                folding: true,
              }}
            />
          </div>
        )}

      </div>
    </div>
  );
}
