"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  ChevronDown,
  ChevronRight,
  Download,
  Folder,
  FolderOpen,
  LoaderCircle,
  Save,
} from "lucide-react";
import Editor from "@monaco-editor/react";
import { useAppStore } from "@/store/appStore";
import { useFileContent, useProjectFiles } from "@/hooks/useProjects";
import { projectsApi } from "@/lib/api";
import { getFileIcon } from "@/components/ui/getFileIcon";
import type { ProjectFile } from "@/types";

interface TreeNode {
  name: string;
  path: string;
  children: TreeNode[];
  file?: ProjectFile;
}

function buildTree(files: ProjectFile[]) {
  const roots: TreeNode[] = [];
  const nodes = new Map<string, TreeNode>();

  for (const file of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
    const parts = file.path
      .replace(/^\/+|\/+$/g, "")
      .split("/")
      .filter(Boolean);
    let children = roots;
    let path = "";

    parts.forEach((name, index) => {
      path = path ? `${path}/${name}` : name;
      let node = nodes.get(path);
      if (!node) {
        node = { name, path, children: [] };
        nodes.set(path, node);
        children.push(node);
      }
      if (index === parts.length - 1) node.file = file;
      children = node.children;
    });
  }

  return roots;
}

function getLanguage(fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase();
  const languages: Record<string, string> = {
    jsx: "javascript",
    tsx: "typescript",
    js: "javascript",
    ts: "typescript",
    css: "css",
    html: "html",
    json: "json",
    md: "markdown",
    py: "python",
    sh: "shell",
  };
  return languages[extension ?? ""] ?? "plaintext";
}

function TreeItem({
  node,
  depth,
  selectedPath,
  folderOverrides,
  onToggle,
  onSelect,
}: {
  node: TreeNode;
  depth: number;
  selectedPath: string | undefined;
  folderOverrides: Set<string>;
  onToggle: (path: string) => void;
  onSelect: (file: ProjectFile) => void;
}) {
  if (!node.file) {
    const initiallyOpen =
      depth < 2 ||
      Boolean(selectedPath && selectedPath.startsWith(`${node.path}/`));
    const isOpen = folderOverrides.has(node.path)
      ? !initiallyOpen
      : initiallyOpen;
    return (
      <div>
        <button
          type="button"
          aria-expanded={isOpen}
          onClick={() => onToggle(node.path)}
          className="group flex h-9 w-full items-center gap-2 px-2 text-left transition-colors hover:bg-white/[0.035]"
          style={{ paddingLeft: `${12 + depth * 16}px` }}
        >
          {isOpen ? (
            <ChevronDown size={13} className="shrink-0 text-white/35" />
          ) : (
            <ChevronRight size={13} className="shrink-0 text-white/35" />
          )}
          {isOpen ? (
            <FolderOpen size={15} className="shrink-0 text-white/45" />
          ) : (
            <Folder size={15} className="shrink-0 text-white/45" />
          )}
          <span className="truncate text-[13px] text-white/55 transition-colors group-hover:text-white/80">
            {node.name}
          </span>
        </button>
        {isOpen &&
          node.children.map((child) => (
            <TreeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              folderOverrides={folderOverrides}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
      </div>
    );
  }

  const selected = selectedPath === node.file.path;

  return (
    <button
      type="button"
      onClick={() => onSelect(node.file!)}
      aria-current={selected ? "page" : undefined}
      title={node.name}
      className={`mx-1 flex h-9 w-[calc(100%-8px)] items-center gap-2 rounded-md px-2 text-left transition-colors ${
        selected
          ? "bg-[#06263a] text-white"
          : "text-white/50 hover:bg-white/[0.035] hover:text-white/80"
      }`}
      style={{ paddingLeft: `${20 + depth * 16}px` }}
    >
      <span className="shrink-0 text-[15px] leading-none">
        {getFileIcon(node.name)}
      </span>
      <span className="truncate font-mono text-[12px]">{node.name}</span>
    </button>
  );
}

export function CodeViewer() {
  const { activeProject, selectedFile, setSelectedFile } = useAppStore();
  const queryClient = useQueryClient();
  const [folderOverrides, setFolderOverrides] = useState<Set<string>>(
    () => new Set(),
  );
  const [draft, setDraft] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const {
    data: files = [],
    isLoading: filesLoading,
    error: filesError,
  } = useProjectFiles(activeProject?.id ?? null);
  const tree = useMemo(() => buildTree(files), [files]);
  const {
    data: fileData,
    isLoading,
    error: fileError,
  } = useFileContent(activeProject?.id ?? null, selectedFile?.path ?? null);

  useEffect(() => {
    if (!selectedFile && files[0]) setSelectedFile(files[0]);
  }, [files, selectedFile, setSelectedFile]);

  function toggleFolder(path: string) {
    setFolderOverrides((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function downloadFile() {
    if (!fileData?.content || !selectedFile) return;

    const url = URL.createObjectURL(
      new Blob([fileData.content], { type: "text/plain" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = selectedFile.path.split("/").pop() ?? "file.txt";
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const fileName = selectedFile?.path.split("/").pop() ?? "";
  const fileContent = fileData?.content ?? "";
  const isDirty = Boolean(selectedFile && draft !== fileContent);

  useEffect(() => {
    setDraft(fileData?.content ?? "");
  }, [fileData?.content, selectedFile?.path]);

  async function saveFile() {
    if (!activeProject?.id || !selectedFile || !isDirty || isSaving) return;
    setIsSaving(true);
    try {
      const { file: saved, liveUpdated } = await projectsApi.updateFile(activeProject.id, selectedFile.path, draft);
      queryClient.setQueryData(["file-content", activeProject.id, selectedFile.path], saved);
      queryClient.invalidateQueries({ queryKey: ["project-files", activeProject.id] });
      toast.success(liveUpdated ? "Saved to live preview" : "Saved. Restart preview to see the change.");
    } catch (error) {
      const candidate = error as { response?: { data?: { error?: unknown } }; message?: unknown } | null;
      const message = candidate?.response?.data?.error
        ?? candidate?.message
        ?? String(error);
      toast.error(`Could not save: ${message}`);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex h-full min-w-0 overflow-hidden bg-[#0f1012] text-white">
      <aside className="flex w-[200px] shrink-0 flex-col overflow-y-auto border-r border-white/[0.08] bg-[#0b0c0d] max-sm:w-[168px]">
        <header className="shrink-0 border-b border-white/[0.08] px-2.5 py-3">
          <h2 className="text-[16px] font-semibold leading-5 text-white/90">
            Files
          </h2>
          <p className="mt-2 text-[13px] text-white/40">
            {filesLoading ? "Loading files…" : `${files.length} files`}
          </p>
        </header>
        {filesError ? (
          <p role="alert" className="p-3 text-xs text-red-300">
            Could not load project files.
          </p>
        ) : (
          <nav aria-label="Project files" className="flex-1 py-1">
            {tree.map((node) => (
              <TreeItem
                key={node.path}
                node={node}
                depth={0}
                selectedPath={selectedFile?.path}
                folderOverrides={folderOverrides}
                onToggle={toggleFolder}
                onSelect={setSelectedFile}
              />
            ))}
            {!filesLoading && files.length === 0 && (
              <p className="px-3 py-4 text-xs text-white/35">
                No files in this project yet.
              </p>
            )}
          </nav>
        )}
      </aside>

      <section
        aria-label="Code editor"
        className="flex min-w-0 flex-1 flex-col overflow-hidden"
      >
        <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-white/[0.08] bg-[#101113] px-4">
          <div className="flex min-w-0 items-center gap-2">
            {selectedFile && (
              <>
                <span className="shrink-0 text-[15px] leading-none">
                  {getFileIcon(fileName)}
                </span>
                <span className="truncate font-mono text-[13px] text-white/80">
                  {selectedFile.path.replace(/^\/+/, "")}
                </span>
              </>
            )}
          </div>
          {selectedFile && <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={saveFile}
              disabled={!isDirty || isSaving || isLoading || !!fileError}
              className="inline-flex h-8 items-center gap-2 rounded-md border border-sky-300/25 bg-sky-400/10 px-2.5 text-[12px] text-sky-100 transition-colors hover:bg-sky-400/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSaving ? <LoaderCircle size={13} className="animate-spin" /> : <Save size={13} />}
              {isSaving ? "Saving" : "Save"}
            </button>
            <button
              type="button"
              onClick={downloadFile}
              disabled={isLoading || !!fileError}
              className="inline-flex h-8 items-center gap-2 rounded-md border border-white/[0.08] px-2.5 text-[12px] text-white/45 transition-colors hover:bg-white/[0.04] hover:text-white/80 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Download size={13} />
              Download
            </button>
          </div>}
        </header>

        {!selectedFile && (
          <div className="flex flex-1 items-center justify-center text-sm text-white/35">
            {filesLoading
              ? "Loading files…"
              : "Choose a file to view its code."}
          </div>
        )}
        {selectedFile && isLoading && (
          <div
            role="status"
            className="flex flex-1 items-center justify-center text-sm text-white/40"
          >
            Loading file…
          </div>
        )}
        {selectedFile && fileError && (
          <div
            role="alert"
            className="flex flex-1 items-center justify-center text-sm text-red-300"
          >
            Could not load this file.
          </div>
        )}
        {selectedFile && !isLoading && !fileError && (
          <div className="min-h-0 flex-1 overflow-hidden">
            <Editor
              height="100%"
              language={getLanguage(fileName)}
              value={draft}
              onChange={(value) => setDraft(value ?? "")}
              theme="sizzer-code-review"
              beforeMount={(monaco) => {
                monaco.editor.defineTheme("sizzer-code-review", {
                  base: "vs-dark",
                  inherit: true,
                  rules: [
                    { token: "comment", foreground: "8B949E" },
                    { token: "keyword", foreground: "4DA3FF" },
                    { token: "keyword.control", foreground: "4DA3FF" },
                    { token: "storage", foreground: "4DA3FF" },
                    { token: "storage.type", foreground: "4DA3FF" },
                    { token: "string", foreground: "7CB8FF" },
                    { token: "string.escape", foreground: "79C0FF" },
                    { token: "constant.numeric", foreground: "B5CEA8" },
                    { token: "constant.language", foreground: "79C0FF" },
                    { token: "entity.name.function", foreground: "75BFFF" },
                    { token: "support.function", foreground: "75BFFF" },
                    { token: "entity.name.type", foreground: "81C7FF" },
                    { token: "type.identifier", foreground: "81C7FF" },
                    { token: "variable", foreground: "B7D9FF" },
                    { token: "variable.parameter", foreground: "B7D9FF" },
                    { token: "tag", foreground: "4DA3FF" },
                    { token: "tag.attribute.name", foreground: "81C7FF" },
                    { token: "attribute.name", foreground: "81C7FF" },
                    { token: "delimiter", foreground: "C0D5EE" },
                    { token: "operator", foreground: "AFC8E6" },
                  ],
                  colors: {
                    "editor.background": "#0A0A0A",
                    "editor.foreground": "#D4D4D4",
                    "editorLineNumber.foreground": "#6E7681",
                    "editorLineNumber.activeForeground": "#C9D1D9",
                    "editor.lineHighlightBackground": "#17191C",
                    "editor.selectionBackground": "#174A7E",
                    "editorIndentGuide.background1": "#24272B",
                    "editorIndentGuide.activeBackground1": "#42474E",
                  },
                });
              }}
              options={{
                readOnly: false,
                fontSize: 15,
                lineHeight: 23,
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                fontLigatures: true,
                lineNumbers: "on",
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                wordWrap: "off",
                renderLineHighlight: "line",
                renderLineHighlightOnlyWhenFocus: false,
                smoothScrolling: true,
                padding: { top: 8, bottom: 16 },
                scrollbar: {
                  verticalScrollbarSize: 8,
                  horizontalScrollbarSize: 8,
                  useShadows: false,
                },
                bracketPairColorization: { enabled: true },
                guides: { bracketPairs: true, indentation: true },
                lineNumbersMinChars: 3,
                folding: true,
              }}
            />
          </div>
        )}
      </section>
    </div>
  );
}
