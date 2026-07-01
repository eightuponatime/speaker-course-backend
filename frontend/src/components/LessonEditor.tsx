import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import EditorJS, { OutputData } from "@editorjs/editorjs";
import Header from "@editorjs/header";
import List from "@editorjs/list";
import Checklist from "@editorjs/checklist";

import type { Lesson } from "../entities/course/course";
import { ImageUrlTool, PdfUrlTool, QuizTool, VideoUrlTool } from "../editor-tools/urlTools";

type LessonEditorProps = {
	lesson?: Lesson;
	onReady: (editor: EditorJS | null) => void;
	onDebug: (message: string) => void;
	onUploadImage: (file: File) => Promise<{ url: string; caption?: string }>;
	onUploadPdf: (file: File) => Promise<{ url: string; name: string; sizeBytes?: number }>;
	onUploadVideo: (
    file: File,
    onState: (state: { phase: "uploading" | "processing"; progress: number; label: string }) => void
  ) => Promise<{ url: string; name: string }>;
  onChange: () => void;
};

export function LessonEditor({
  lesson,
  onReady,
  onDebug,
  onUploadImage,
  onUploadPdf,
  onUploadVideo,
  onChange
}: LessonEditorProps) {
  const holderRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<EditorJS | null>(null);
  const instanceIdRef = useRef(0);
  const uploadImageRef = useRef(onUploadImage);

  useEffect(() => {
    uploadImageRef.current = onUploadImage;
  }, [onUploadImage]);

	useEffect(() => {
		const root = holderRef.current;
		if (!lesson || !root) return;

    const instanceId = instanceIdRef.current + 1;
    instanceIdRef.current = instanceId;
		let cancelled = false;
		onDebug(`editor create #${instanceId} ${lesson.id.slice(0, 8)}`);

    const holder = document.createElement("div");
    holder.className = "editor-instance";
    holder.dataset.editorInstance = String(instanceId);
    root.replaceChildren(holder);

		const editor = new EditorJS({
      holder,
      data: lesson.draft_content as unknown as OutputData,
      onChange,
      tools: {
        header: Header,
        list: List,
        checklist: Checklist,
        quiz: QuizTool,
        videoUrl: {
          class: VideoUrlTool,
          config: {
            uploadVideo: onUploadVideo,
            onChange,
            onDebug
          }
        },
        imageUrl: {
          class: ImageUrlTool,
          config: {
            uploadImage: onUploadImage,
            onChange,
            onDebug
          }
        },
        pdfUrl: {
          class: PdfUrlTool,
          config: {
            uploadPdf: onUploadPdf,
            onChange,
            onDebug
          }
        }
      },
      placeholder: "Start writing..."
    });

    editor.isReady
			.then(() => {
				if (cancelled || instanceIdRef.current !== instanceId) {
					onDebug(`editor stale ready #${instanceId}`);
					if (typeof editor.destroy === "function") {
						editor.destroy();
					}
          return;
        }

				editorRef.current = editor;
				onDebug(`editor ready #${instanceId} ${lesson.id.slice(0, 8)}`);
				onReady(editor);
			})
			.catch((err) => {
				console.error("Editor.js failed to initialize", err);
				onDebug(`editor init error: ${formatDebugError(err)}`);
				editorRef.current = null;
				onReady(null);
			});

		return () => {
			cancelled = true;
			onDebug(`editor cleanup #${instanceId} ${lesson.id.slice(0, 8)}`);

      if (editorRef.current === editor && instanceIdRef.current === instanceId) {
        editorRef.current = null;
        onReady(null);
      }

      editor.isReady
        .then(() => {
          if (typeof editor.destroy === "function") {
            editor.destroy();
          }
          if (holder.parentElement === root && holder.dataset.editorInstance === String(instanceId)) {
            holder.remove();
          }
        })
        .catch(() => undefined);
    };
	}, [lesson, onChange, onDebug, onReady, onUploadImage, onUploadPdf, onUploadVideo]);

  useEffect(() => {
    const root = holderRef.current;
    if (!root) return;

    const observer = new MutationObserver(() => {
      const popover = root.querySelector<HTMLElement>(".ce-popover");
      if (!popover) return;

      window.setTimeout(() => {
        scrollPopoverIntoView(popover);
      }, 30);
    });

    observer.observe(root, {
      childList: true,
      subtree: true
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const root = holderRef.current;
    if (!root) return;

    const handlePaste = (event: ClipboardEvent) => {
      const imageFile = findClipboardImage(event);
      if (!imageFile) return;

      event.preventDefault();
      void insertPastedImage(imageFile, editorRef, uploadImageRef, onDebug);
    };

    root.addEventListener("paste", handlePaste);

    return () => root.removeEventListener("paste", handlePaste);
  }, [onDebug]);

	return <div ref={holderRef} className="editor-holder" />;
}

async function insertPastedImage(
  file: File,
  editorRef: MutableRefObject<EditorJS | null>,
  uploadImageRef: MutableRefObject<(file: File) => Promise<{ url: string; caption?: string }>>,
  onDebug: (message: string) => void
) {
  const editor = editorRef.current;
  if (!editor) {
    onDebug("paste image skipped: editor is not ready");
    return;
  }

  await editor.isReady;

  const fileName = file.name || `pasted-image-${Date.now()}.png`;
  const previewURL = URL.createObjectURL(file);
  const block = editor.blocks.insert(
    "imageUrl",
    {
      url: previewURL,
      caption: fileName,
      uploading: true,
      width: 80
    },
    undefined,
    undefined,
    true
  );

  try {
    onDebug(`paste image upload start: ${fileName}`);
    const result = await uploadImageRef.current(file);

    await editor.blocks.update(block.id, {
      url: result.url,
      caption: result.caption ?? fileName,
      uploading: false,
      width: 80
    });
    URL.revokeObjectURL(previewURL);
    onDebug(`paste image upload done: ${fileName}`);
  } catch (err) {
    await editor.blocks.update(block.id, {
      url: previewURL,
      caption: `${fileName} - upload failed`,
      uploading: false,
      width: 80
    });
    onDebug(`paste image upload failed: ${formatDebugError(err)}`);
  }
}

function findClipboardImage(event: ClipboardEvent): File | null {
  const items = Array.from(event.clipboardData?.items ?? []);
  for (const item of items) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      return item.getAsFile();
    }
  }

  return null;
}

function scrollPopoverIntoView(popover: HTMLElement) {
  const rect = popover.getBoundingClientRect();
  const bottomGap = 24;
  const overflowBottom = rect.bottom + bottomGap - window.innerHeight;

  if (overflowBottom > 0) {
    window.scrollBy({
      top: overflowBottom,
      behavior: "smooth"
    });
  }
}

function formatDebugError(err: unknown): string {
	if (err instanceof Error) {
		return err.message;
	}

	return String(err);
}
