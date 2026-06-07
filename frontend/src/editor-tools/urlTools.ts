type MediaToolData = {
  url?: string;
  caption?: string;
  uploading?: boolean;
  width?: number;
};

type ImageUploadResult = {
  url: string;
  caption?: string;
};

type FileUploadResult = {
  url: string;
  name: string;
  sizeBytes?: number;
};

type VideoUploadResult = {
  url: string;
  name: string;
};

type VideoUploadState = {
  phase: "uploading" | "processing";
  progress: number;
  label: string;
};

type VideoToolData = {
  url?: string;
  name?: string;
  uploading?: boolean;
  processing?: boolean;
  progress?: number;
  statusLabel?: string;
};

type UrlToolData = {
  url?: string;
  caption?: string;
};

type PdfToolData = {
  url?: string;
  name?: string;
  sizeBytes?: number;
  uploading?: boolean;
};

type QuizToolData = {
  id?: string;
  question?: string;
  options?: string[];
};

type UrlToolParams<TData> = {
  data?: TData;
  config?: {
    uploadImage?: (file: File) => Promise<ImageUploadResult>;
    uploadPdf?: (file: File) => Promise<FileUploadResult>;
    uploadVideo?: (file: File, onState: (state: VideoUploadState) => void) => Promise<VideoUploadResult>;
    onDebug?: (message: string) => void;
  };
};

class UrlTool {
  protected data: UrlToolData;
  private title: string;
  private placeholder: string;
  private className: string;

  constructor(data: UrlToolData, title: string, placeholder: string, className: string) {
    this.data = data;
    this.title = title;
    this.placeholder = placeholder;
    this.className = className;
  }

  render() {
    const wrapper = document.createElement("div");
    wrapper.className = `url-tool ${this.className}`;

    const title = document.createElement("strong");
    title.className = "url-tool-title";
    title.textContent = this.title;

    const urlInput = document.createElement("input");
    urlInput.className = "url-tool-input";
    urlInput.placeholder = this.placeholder;
    urlInput.value = this.data.url ?? "";
    urlInput.type = "url";

    const captionInput = document.createElement("input");
    captionInput.className = "url-tool-caption";
    captionInput.placeholder = this.title;
    captionInput.value = this.data.caption ?? "";
    captionInput.type = "text";

    wrapper.append(title, urlInput, captionInput);

    return wrapper;
  }

  save(block: HTMLElement): UrlToolData {
    const urlInput = block.querySelector<HTMLInputElement>(".url-tool-input");
    const captionInput = block.querySelector<HTMLInputElement>(".url-tool-caption");

    return {
      url: urlInput?.value.trim() ?? "",
      caption: captionInput?.value.trim() ?? ""
    };
  }
}

export class VideoUrlTool {
  private data: VideoToolData;
  private uploadVideo?: (file: File, onState: (state: VideoUploadState) => void) => Promise<VideoUploadResult>;
  private onDebug?: (message: string) => void;
  private wrapper?: HTMLDivElement;

  static get toolbox() {
    return {
      title: "Video",
      icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="2"/><path d="M10 9.5L15 12L10 14.5V9.5Z" fill="currentColor"/></svg>`
    };
  }

  constructor({ data = {}, config = {} }: UrlToolParams<VideoToolData> = {}) {
    this.data = data;
    this.uploadVideo = config.uploadVideo;
    this.onDebug = config.onDebug;
  }

  render() {
    this.wrapper = document.createElement("div");
    this.wrapper.className = "video-tool";
    this.renderContent();

    return this.wrapper;
  }

  save(): VideoToolData {
    return {
      url: this.data.url ?? "",
      name: this.data.name ?? "",
      uploading: false,
      processing: false,
      progress: 100
    };
  }

  private renderContent() {
    if (!this.wrapper) return;

    this.wrapper.innerHTML = "";

    if (this.data.uploading || this.data.processing) {
      const card = document.createElement("div");
      card.className = "video-tool-upload-card";

      const icon = document.createElement("div");
      icon.className = "video-tool-icon";
      icon.textContent = "▶";

      const meta = document.createElement("div");
      meta.className = "video-tool-meta";

      const name = document.createElement("strong");
      name.textContent = this.data.name || "Uploading video";

      const progressText = document.createElement("span");
      const label = this.data.statusLabel ?? (this.data.processing ? "Encoding video" : "Uploading video");
      const progressValue = Math.round(this.data.progress ?? 0);
      progressText.textContent = this.data.processing && progressValue <= 1
        ? `${label}. This can take a few minutes.`
        : `${label}: ${progressValue}%`;

      const progress = document.createElement("div");
      progress.className = "video-tool-progress";
      progress.style.setProperty("--video-progress", `${Math.round(this.data.progress ?? 0)}%`);

      meta.append(name, progressText, progress);
      card.append(icon, meta);
      this.wrapper.append(card);
      return;
    }

    if (!this.data.url) {
      const emptyState = document.createElement("div");
      emptyState.className = "video-tool-empty";

      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Choose video";
      button.onclick = () => {
        void this.selectAndUploadVideo();
      };

      const hint = document.createElement("span");
      hint.textContent = "Upload MP4 or MOV";

      emptyState.append(button, hint);
      this.wrapper.append(emptyState);
      return;
    }

    const frame = document.createElement("div");
    frame.className = "video-tool-frame";

    const iframe = document.createElement("iframe");
    iframe.src = disableVideoAutoplay(this.data.url ?? "");
    iframe.title = this.data.name ?? "Lesson video";
    iframe.allow = "accelerometer; gyroscope; encrypted-media; picture-in-picture";
    iframe.allowFullscreen = true;

    frame.append(iframe);

    if (this.data.name) {
      const title = document.createElement("strong");
      title.className = "video-tool-title";
      title.textContent = this.data.name;
      this.wrapper.append(title);
    }

    this.wrapper.append(frame);
  }

  private async selectAndUploadVideo() {
    if (!this.uploadVideo) {
      this.onDebug?.("video tool upload skipped: uploadVideo config is missing");
      return;
    }

    const file = await pickFile("video/*");
    if (!file) return;

    this.data = {
      name: file.name,
      uploading: true,
      processing: false,
      progress: 0
    };
    this.renderContent();

    try {
      this.onDebug?.(`video tool upload start: ${file.name}`);
      const result = await this.uploadVideo(file, (state) => {
        this.data = {
          ...this.data,
          uploading: state.phase === "uploading",
          processing: state.phase === "processing",
          progress: state.progress,
          statusLabel: state.label
        };
        this.renderContent();
      });

      this.data = {
        url: result.url,
        name: result.name,
        uploading: false,
        processing: false,
        progress: 100
      };
      this.onDebug?.(`video tool upload done: ${file.name}`);
    } catch (err) {
      this.data = {
        name: `${file.name} - upload failed`,
        uploading: false,
        processing: false,
        progress: 0
      };
      this.onDebug?.(`video tool upload failed: ${formatToolError(err)}`);
    }

    this.renderContent();
  }
}

export class ImageUrlTool {
  private data: MediaToolData;
  private uploadImage?: (file: File) => Promise<ImageUploadResult>;
  private onDebug?: (message: string) => void;
  private wrapper?: HTMLDivElement;
  private resizeStart?: {
    pointerId: number;
    startX: number;
    startWidth: number;
  };

  static get toolbox() {
    return {
      title: "Image",
      icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="2"/><circle cx="8.5" cy="10" r="1.5" fill="currentColor"/><path d="M5 17L10 12L13 15L15 13L19 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
    };
  }

  constructor({ data = {}, config = {} }: UrlToolParams<MediaToolData> = {}) {
    this.data = {
      width: 80,
      ...data
    };
    this.uploadImage = config.uploadImage;
    this.onDebug = config.onDebug;
  }

  render() {
    this.wrapper = document.createElement("div");
    this.wrapper.className = "image-tool";
    this.renderContent();

    return this.wrapper;
  }

  save(block: HTMLElement): MediaToolData {
    const image = block.querySelector<HTMLImageElement>(".image-tool-preview");

    return {
      url: image?.src ?? this.data.url ?? "",
      caption: this.data.caption ?? "",
      uploading: false,
      width: this.data.width ?? 100
    };
  }

  private renderContent() {
    if (!this.wrapper) return;

    const width = clampWidth(this.data.width ?? 100);
    this.wrapper.innerHTML = "";
    this.wrapper.style.setProperty("--image-tool-width", `${width}%`);

    const frame = document.createElement("div");
    frame.className = "image-tool-frame";

    if (this.data.url) {
      const image = document.createElement("img");
      image.className = "image-tool-preview";
      image.src = this.data.url;
      image.alt = this.data.caption ?? "";
      frame.append(image);
    } else {
      const emptyState = document.createElement("div");
      emptyState.className = "image-tool-empty";

      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Choose image";
      button.onclick = () => {
        void this.selectAndUploadImage();
      };

      const hint = document.createElement("span");
      hint.textContent = "Upload JPG, PNG or WebP";

      emptyState.append(button, hint);
      frame.append(emptyState);
    }

    if (this.data.uploading) {
      const overlay = document.createElement("div");
      overlay.className = "image-tool-uploading";
      overlay.innerHTML = `<span></span><strong>Uploading image...</strong>`;
      frame.append(overlay);
    }

    if (this.data.url) {
      const handle = document.createElement("button");
      handle.className = "image-tool-resize-handle";
      handle.type = "button";
      handle.title = "Resize image";
      handle.contentEditable = "false";
      handle.onpointerdown = (event) => this.startResize(event, width);
      frame.append(handle);
    }

    this.wrapper.append(frame);
  }

  private startResize(event: PointerEvent, width: number) {
    if (!this.wrapper) return;

    event.preventDefault();
    event.stopPropagation();
    const handle = event.currentTarget as HTMLButtonElement;

    this.resizeStart = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: width
    };

    document.body.classList.add("image-resizing");
    window.addEventListener("pointermove", this.updateResize);
    window.addEventListener("pointerup", this.finishResize);
    window.addEventListener("pointercancel", this.finishResize);
  }

  private updateResize = (event: PointerEvent) => {
    if (!this.wrapper || !this.resizeStart) return;

    event.preventDefault();
    const editorWidth = this.wrapper.parentElement?.clientWidth ?? this.wrapper.clientWidth;
    const deltaPercent = ((event.clientX - this.resizeStart.startX) / editorWidth) * 100;
    const nextWidth = clampWidth(this.resizeStart.startWidth + deltaPercent);

    this.data.width = nextWidth;
    this.wrapper.style.setProperty("--image-tool-width", `${nextWidth}%`);
  };

  private finishResize = () => {
    this.resizeStart = undefined;
    document.body.classList.remove("image-resizing");
    window.removeEventListener("pointermove", this.updateResize);
    window.removeEventListener("pointerup", this.finishResize);
    window.removeEventListener("pointercancel", this.finishResize);
  };

  private async selectAndUploadImage() {
    if (!this.uploadImage) {
      this.onDebug?.("image tool upload skipped: uploadImage config is missing");
      return;
    }

    const file = await pickImageFile();
    if (!file) return;

    const previewURL = URL.createObjectURL(file);
      this.data = {
        ...this.data,
        url: previewURL,
        caption: file.name,
        uploading: true,
        width: this.data.width ?? 80
      };
    this.renderContent();

    try {
      this.onDebug?.(`image tool upload start: ${file.name}`);
      const result = await this.uploadImage(file);
      URL.revokeObjectURL(previewURL);

      this.data = {
        ...this.data,
        url: result.url,
        caption: result.caption ?? file.name,
        uploading: false
      };
      this.onDebug?.(`image tool upload done: ${file.name}`);
    } catch (err) {
      this.data = {
        ...this.data,
        url: previewURL,
        caption: `${file.name} - upload failed`,
        uploading: false
      };
      this.onDebug?.(`image tool upload failed: ${formatToolError(err)}`);
    }

    this.renderContent();
  }
}

export class PdfUrlTool {
  private data: PdfToolData;
  private uploadPdf?: (file: File) => Promise<FileUploadResult>;
  private onDebug?: (message: string) => void;
  private wrapper?: HTMLDivElement;

  static get toolbox() {
    return {
      title: "PDF",
      icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M7 3H14L19 8V21H7V3Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M14 3V8H19" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M8.5 16H15.5M8.5 13H15.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`
    };
  }

  constructor({ data = {}, config = {} }: UrlToolParams<PdfToolData> = {}) {
    this.data = data;
    this.uploadPdf = config.uploadPdf;
    this.onDebug = config.onDebug;
  }

  render() {
    this.wrapper = document.createElement("div");
    this.wrapper.className = "pdf-tool";
    this.renderContent();

    return this.wrapper;
  }

  save(): PdfToolData {
    return {
      url: this.data.url ?? "",
      name: this.data.name ?? "",
      sizeBytes: this.data.sizeBytes,
      uploading: false
    };
  }

  private renderContent() {
    if (!this.wrapper) return;

    this.wrapper.innerHTML = "";

    if (!this.data.url && !this.data.uploading) {
      const emptyState = document.createElement("div");
      emptyState.className = "pdf-tool-empty";

      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Choose PDF";
      button.onclick = () => {
        void this.selectAndUploadPdf();
      };

      const hint = document.createElement("span");
      hint.textContent = "Upload a PDF file";

      emptyState.append(button, hint);
      this.wrapper.append(emptyState);
      return;
    }

    const card = document.createElement("div");
    card.className = "pdf-tool-card";

    const icon = document.createElement("div");
    icon.className = "pdf-tool-icon";
    icon.textContent = "PDF";

    const meta = document.createElement("div");
    meta.className = "pdf-tool-meta";

    const name = document.createElement("strong");
    name.textContent = this.data.name || "Document.pdf";

    const size = document.createElement("span");
    size.textContent = this.data.uploading ? "Uploading..." : formatFileSize(this.data.sizeBytes);

    meta.append(name, size);

    const action = document.createElement("a");
    action.className = "pdf-tool-download";
    action.textContent = this.data.uploading ? "..." : "Download";
    action.href = this.data.url || "#";
    action.target = "_blank";
    action.rel = "noreferrer";
    action.download = this.data.name || "document.pdf";
    if (this.data.uploading) {
      action.setAttribute("aria-disabled", "true");
      action.onclick = (event) => event.preventDefault();
    }

    card.append(icon, meta, action);

    if (this.data.uploading) {
      const progress = document.createElement("div");
      progress.className = "pdf-tool-progress";
      card.append(progress);
    }

    this.wrapper.append(card);
  }

  private async selectAndUploadPdf() {
    if (!this.uploadPdf) {
      this.onDebug?.("pdf tool upload skipped: uploadPdf config is missing");
      return;
    }

    const file = await pickFile("application/pdf");
    if (!file) return;

    this.data = {
      name: file.name,
      sizeBytes: file.size,
      uploading: true
    };
    this.renderContent();

    try {
      this.onDebug?.(`pdf tool upload start: ${file.name}`);
      const result = await this.uploadPdf(file);
      this.data = {
        url: result.url,
        name: result.name,
        sizeBytes: result.sizeBytes,
        uploading: false
      };
      this.onDebug?.(`pdf tool upload done: ${file.name}`);
    } catch (err) {
      this.data = {
        name: `${file.name} - upload failed`,
        sizeBytes: file.size,
        uploading: false
      };
      this.onDebug?.(`pdf tool upload failed: ${formatToolError(err)}`);
    }

    this.renderContent();
  }
}

export class QuizTool {
  private data: QuizToolData;
  private wrapper?: HTMLDivElement;

  static get toolbox() {
    return {
      title: "Quiz",
      icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M9 7H20M9 12H20M9 17H20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M4 7L5 8L7 6M4 12L5 13L7 11M4 17L5 18L7 16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
    };
  }

  constructor({ data = {} }: UrlToolParams<QuizToolData> = {}) {
    this.data = {
      id: data.id || createToolId("quiz"),
      question: "Question",
      options: ["Option 1", "Option 2"],
      ...data
    };
  }

  render() {
    this.wrapper = document.createElement("div");
    this.wrapper.className = "quiz-tool";

    const question = document.createElement("input");
    question.className = "quiz-tool-question";
    question.placeholder = "Question";
    question.value = this.data.question ?? "";
    question.oninput = () => {
      this.data.question = question.value;
    };

    const options = document.createElement("div");
    options.className = "quiz-tool-options";

    for (const optionText of this.data.options ?? []) {
      options.append(this.createOptionInput(optionText));
    }

    const addOption = document.createElement("button");
    addOption.type = "button";
    addOption.className = "quiz-tool-add";
    addOption.textContent = "Add option";
    addOption.onclick = () => {
      options.append(this.createOptionInput(""));
      this.syncOptions(options);
    };

    this.wrapper.append(question, options, addOption);

    return this.wrapper;
  }

  save(block: HTMLElement): QuizToolData {
    const question = block.querySelector<HTMLInputElement>(".quiz-tool-question");
    const optionInputs = Array.from(block.querySelectorAll<HTMLInputElement>(".quiz-tool-option input"));

    return {
      id: this.data.id || createToolId("quiz"),
      question: question?.value.trim() ?? "",
      options: optionInputs.map((input) => input.value.trim()).filter(Boolean)
    };
  }

  private createOptionInput(value: string): HTMLLabelElement {
    const label = document.createElement("label");
    label.className = "quiz-tool-option";

    const marker = document.createElement("span");
    marker.textContent = "";

    const input = document.createElement("input");
    input.placeholder = "Answer option";
    input.value = value;
    input.oninput = () => {
      const options = this.wrapper?.querySelector<HTMLDivElement>(".quiz-tool-options");
      if (options) this.syncOptions(options);
    };

    label.append(marker, input);

    return label;
  }

  private syncOptions(options: HTMLDivElement) {
    const optionInputs = Array.from(options.querySelectorAll<HTMLInputElement>("input"));
    this.data.options = optionInputs.map((input) => input.value.trim()).filter(Boolean);
  }
}

function clampWidth(width: number): number {
  return Math.min(100, Math.max(35, width));
}

function disableVideoAutoplay(url: string): string {
  try {
    const parsedURL = new URL(url);
    parsedURL.searchParams.set("autoplay", "false");
    return parsedURL.toString();
  } catch {
    return url;
  }
}

function pickImageFile(): Promise<File | null> {
  return pickFile("image/*");
}

function createToolId(prefix: string): string {
  if (crypto.randomUUID) {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.style.display = "none";
    input.onchange = () => {
      resolve(input.files?.[0] ?? null);
      input.remove();
    };
    document.body.appendChild(input);
    input.click();
  });
}

function formatToolError(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }

  return String(err);
}

function formatFileSize(sizeBytes?: number): string {
  if (!sizeBytes || sizeBytes <= 0) {
    return "PDF document";
  }

  if (sizeBytes < 1024 * 1024) {
    return `${Math.round(sizeBytes / 1024)} KB`;
  }

  return `${(sizeBytes / 1024 / 1024).toFixed(1)} MB`;
}
