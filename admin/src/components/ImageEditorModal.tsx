import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { useI18n } from "../context/I18nContext";

type CropRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type DragMode = "move" | "resize";
type ResizeCorner = "nw" | "ne" | "sw" | "se";

type DragState = {
  mode: DragMode;
  corner?: ResizeCorner;
  startX: number;
  startY: number;
  startCrop: CropRect;
};

type Props = {
  file: File;
  onApply: (file: File) => void;
  onCancel: () => void;
};

const MIN_CROP_SIZE = 40;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const normalizeSignedDegrees = (value: number) => {
  const normalized = ((value + 180) % 360 + 360) % 360 - 180;
  return normalized === -180 ? 180 : normalized;
};

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read image"));
    reader.readAsDataURL(file);
  });

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load image"));
    image.src = src;
  });

const transformImage = async (src: string, rotation: number) => {
  const image = await loadImage(src);
  const normalized = ((rotation % 360) + 360) % 360;
  const radians = (normalized * Math.PI) / 180;
  const sin = Math.abs(Math.sin(radians));
  const cos = Math.abs(Math.cos(radians));
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(image.naturalWidth * cos + image.naturalHeight * sin);
  canvas.height = Math.ceil(image.naturalWidth * sin + image.naturalHeight * cos);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported");
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(radians);
  ctx.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
  return {
    url: canvas.toDataURL("image/png"),
    width: canvas.width,
    height: canvas.height,
  };
};

const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality = 0.92) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not process image"));
    }, type, quality);
  });

const getOutputType = (type: string) => (type === "image/png" || type === "image/webp" ? type : "image/jpeg");

const getOutputName = (name: string, type: string) => {
  const ext = type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
  const base = name.replace(/\.[^.]+$/, "");
  return `${base || "image"}-edited.${ext}`;
};

const ImageEditorModal = ({ file, onApply, onCancel }: Props) => {
  const { t } = useI18n();
  const stageRef = useRef<HTMLDivElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [crop, setCrop] = useState<CropRect>({ x: 0, y: 0, width: 0, height: 0 });
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [outputWidth, setOutputWidth] = useState(0);
  const [outputHeight, setOutputHeight] = useState(0);
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    let active = true;
    setError("");
    readFileAsDataUrl(file)
      .then((url) => {
        if (active) setSourceUrl(url);
      })
      .catch((err: Error) => {
        if (active) setError(err.message);
      });
    return () => {
      active = false;
    };
  }, [file]);

  useEffect(() => {
    if (!sourceUrl) return;
    let active = true;
    transformImage(sourceUrl, rotation)
      .then((result) => {
        if (!active) return;
        setPreviewUrl(result.url);
        setImageSize({ width: result.width, height: result.height });
        const width = result.width;
        const height = result.height;
        const nextCrop = {
          x: 0,
          y: 0,
          width,
          height,
        };
        setCrop(nextCrop);
        setOutputWidth(width);
        setOutputHeight(height);
      })
      .catch((err: Error) => {
        if (active) setError(err.message);
      });
    return () => {
      active = false;
    };
  }, [rotation, sourceUrl]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const updateSize = () => {
      const rect = stage.getBoundingClientRect();
      setStageSize({ width: rect.width, height: rect.height });
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  const frameSize = useMemo(() => {
    if (!imageSize.width || !imageSize.height || !stageSize.width || !stageSize.height) {
      return { width: 0, height: 0 };
    }
    const scale = Math.min(stageSize.width / imageSize.width, stageSize.height / imageSize.height, 1);
    return {
      width: Math.round(imageSize.width * scale),
      height: Math.round(imageSize.height * scale),
    };
  }, [imageSize, stageSize]);

  const cropStyle = useMemo(() => {
    if (!imageSize.width || !imageSize.height) return {};
    return {
      left: `${(crop.x / imageSize.width) * 100}%`,
      top: `${(crop.y / imageSize.height) * 100}%`,
      width: `${(crop.width / imageSize.width) * 100}%`,
      height: `${(crop.height / imageSize.height) * 100}%`,
    };
  }, [crop, imageSize]);

  const displayToImageDelta = (clientDx: number, clientDy: number) => {
    const rect = previewRef.current?.getBoundingClientRect();
    if (!rect || !imageSize.width || !imageSize.height) return { dx: 0, dy: 0 };
    return {
      dx: (clientDx / rect.width) * imageSize.width,
      dy: (clientDy / rect.height) * imageSize.height,
    };
  };

  const startDrag = (mode: DragMode, event: PointerEvent, corner?: ResizeCorner) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      mode,
      corner,
      startX: event.clientX,
      startY: event.clientY,
      startCrop: crop,
    };
  };

  const moveDrag = (event: PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const { dx, dy } = displayToImageDelta(event.clientX - drag.startX, event.clientY - drag.startY);
    if (drag.mode === "move") {
      setCrop({
        ...drag.startCrop,
        x: clamp(Math.round(drag.startCrop.x + dx), 0, imageSize.width - drag.startCrop.width),
        y: clamp(Math.round(drag.startCrop.y + dy), 0, imageSize.height - drag.startCrop.height),
      });
      return;
    }
    const corner = drag.corner || "se";
    let nextX = drag.startCrop.x;
    let nextY = drag.startCrop.y;
    let nextWidth = drag.startCrop.width;
    let nextHeight = drag.startCrop.height;

    if (corner.includes("w")) {
      nextX = clamp(Math.round(drag.startCrop.x + dx), 0, drag.startCrop.x + drag.startCrop.width - MIN_CROP_SIZE);
      nextWidth = drag.startCrop.width + (drag.startCrop.x - nextX);
    }
    if (corner.includes("e")) {
      nextWidth = clamp(Math.round(drag.startCrop.width + dx), MIN_CROP_SIZE, imageSize.width - drag.startCrop.x);
    }
    if (corner.includes("n")) {
      nextY = clamp(Math.round(drag.startCrop.y + dy), 0, drag.startCrop.y + drag.startCrop.height - MIN_CROP_SIZE);
      nextHeight = drag.startCrop.height + (drag.startCrop.y - nextY);
    }
    if (corner.includes("s")) {
      nextHeight = clamp(Math.round(drag.startCrop.height + dy), MIN_CROP_SIZE, imageSize.height - drag.startCrop.y);
    }

    setCrop({ x: nextX, y: nextY, width: nextWidth, height: nextHeight });
    setOutputWidth(nextWidth);
    setOutputHeight(nextHeight);
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  const resetCrop = () => {
    const width = imageSize.width;
    const height = imageSize.height;
    setCrop({
      x: 0,
      y: 0,
      width,
      height,
    });
    setOutputWidth(width);
    setOutputHeight(height);
  };

  const apply = async () => {
    if (!previewUrl || !crop.width || !crop.height) return;
    setProcessing(true);
    setError("");
    try {
      const image = await loadImage(previewUrl);
      const finalWidth = Math.max(1, Math.round(outputWidth || crop.width));
      const finalHeight = Math.max(1, Math.round(outputHeight || crop.height));
      const canvas = document.createElement("canvas");
      canvas.width = finalWidth;
      canvas.height = finalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas is not supported");
      ctx.imageSmoothingQuality = "high";
      const centerX = imageSize.width / 2;
      const centerY = imageSize.height / 2;
      const sourceX = clamp(centerX + (crop.x - centerX) / zoom, 0, Math.max(0, imageSize.width - 1));
      const sourceY = clamp(centerY + (crop.y - centerY) / zoom, 0, Math.max(0, imageSize.height - 1));
      const sourceWidth = clamp(crop.width / zoom, 1, imageSize.width - sourceX);
      const sourceHeight = clamp(crop.height / zoom, 1, imageSize.height - sourceY);
      ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, finalWidth, finalHeight);
      const outputType = getOutputType(file.type);
      const blob = await canvasToBlob(canvas, outputType);
      onApply(new File([blob], getOutputName(file.name, outputType), { type: outputType }));
    } catch (err: any) {
      setError(err?.message || "Could not process image");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="modal-backdrop image-editor-backdrop" onClick={onCancel}>
      <div className="modal image-editor-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{t("editImage") || "Edit image"}</div>
          <button className="ghost-btn" type="button" onClick={onCancel} disabled={processing}>
            {t("close")}
          </button>
        </div>

        <div className="image-editor-layout">
          <div className="image-editor-stage" ref={stageRef}>
            {previewUrl ? (
              <div className="image-editor-preview">
                <div
                  className="image-editor-image-frame"
                  ref={previewRef}
                  style={frameSize.width && frameSize.height ? { width: frameSize.width, height: frameSize.height } : undefined}
                >
                  <div className="image-editor-image-clip">
                    <img
                      src={previewUrl}
                      alt=""
                      draggable={false}
                      style={{ transform: `scale(${zoom})` }}
                    />
                  </div>
                  <div
                    className="image-editor-crop"
                    style={cropStyle}
                    onPointerDown={(e) => startDrag("move", e)}
                    onPointerMove={moveDrag}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                  >
                    {(["nw", "ne", "sw", "se"] as ResizeCorner[]).map((corner) => (
                      <span
                        key={corner}
                        className={`image-editor-handle ${corner}`}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          startDrag("resize", e, corner);
                        }}
                        onPointerMove={moveDrag}
                        onPointerUp={endDrag}
                        onPointerCancel={endDrag}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="image-editor-empty">{t("loading") || "Loading..."}</div>
            )}
          </div>

          <div className="image-editor-controls">
            <div className="image-editor-group">
              <div className="subLabel">{t("rotate") || "Rotate"}</div>
              <div className="image-editor-button-row">
                <button
                  className="ghost-btn image-editor-rotate-btn"
                  type="button"
                  onClick={() => setRotation((value) => normalizeSignedDegrees(value - 90))}
                  disabled={processing}
                  aria-label={t("rotateLeft") || "Rotate left"}
                  title={t("rotateLeft") || "Rotate left"}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M7 7h6a6 6 0 1 1-5.2 9 1 1 0 1 1 1.7-1A4 4 0 1 0 13 9H7v3a1 1 0 1 1-2 0V6a1 1 0 0 1 1-1h6a1 1 0 1 1 0 2H7z" />
                  </svg>
                </button>
                <button
                  className="ghost-btn image-editor-rotate-btn"
                  type="button"
                  onClick={() => setRotation((value) => normalizeSignedDegrees(value + 90))}
                  disabled={processing}
                  aria-label={t("rotateRight") || "Rotate right"}
                  title={t("rotateRight") || "Rotate right"}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M17 7h-6a6 6 0 1 0 5.2 9 1 1 0 1 0-1.7-1A4 4 0 1 1 11 9h6v3a1 1 0 1 0 2 0V6a1 1 0 0 0-1-1h-6a1 1 0 1 0 0 2h5z" />
                  </svg>
                </button>
              </div>
              <div className="image-editor-slider-row">
                <input
                  type="range"
                  min="-180"
                  max="180"
                  step="1"
                  value={rotation}
                  onChange={(e) => setRotation(Number(e.target.value))}
                  disabled={processing}
                />
                <span>{rotation} {t("degreesShort") || "deg"}</span>
              </div>
            </div>

            <div className="image-editor-group">
              <div className="subLabel">{t("zoom") || "Zoom"}</div>
              <div className="image-editor-slider-row">
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="0.05"
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  disabled={processing}
                />
                <span>{Math.round(zoom * 100)}%</span>
              </div>
              <button className="ghost-btn" type="button" onClick={() => setZoom(1)} disabled={processing || zoom === 1}>
                {t("reset") || "Reset"}
              </button>
            </div>

            <div className="image-editor-group">
              <div className="subLabel">{t("crop") || "Crop"}</div>
              <button className="ghost-btn" type="button" onClick={resetCrop} disabled={processing || !imageSize.width}>
                {t("reset") || "Reset"}
              </button>
            </div>

            <div className="image-editor-group">
              <div className="subLabel">{t("resize") || "Resize"}</div>
              <div className="image-editor-size-row">
                <label>
                  {t("width") || "Width"}
                  <input
                    type="number"
                    min="1"
                    value={outputWidth || ""}
                    onChange={(e) => setOutputWidth(Number(e.target.value))}
                    disabled={processing}
                  />
                </label>
                <label>
                  {t("height") || "Height"}
                  <input
                    type="number"
                    min="1"
                    value={outputHeight || ""}
                    onChange={(e) => setOutputHeight(Number(e.target.value))}
                    disabled={processing}
                  />
                </label>
              </div>
            </div>
          </div>
        </div>

        {error && <div className="error">{error}</div>}
        <div className="modal-actions">
          <button className="ghost-btn" type="button" onClick={onCancel} disabled={processing}>
            {t("cancel")}
          </button>
          <button className="primary" type="button" onClick={apply} disabled={processing || !previewUrl}>
            {processing ? t("saving") || "Saving..." : t("apply")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageEditorModal;
