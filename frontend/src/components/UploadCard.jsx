import { UploadCloud, X } from "lucide-react";
import { useRef, useState } from "react";

const ACCEPTED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_SIZE = 10 * 1024 * 1024;

export default function UploadCard({ file, previewUrl, onFileSelected, onClear }) {
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");

  function validate(nextFile) {
    if (!nextFile) return;
    if (!ACCEPTED_TYPES.includes(nextFile.type)) {
      setError("Upload a JPG, PNG, or WebP image.");
      return;
    }
    if (nextFile.size > MAX_SIZE) {
      setError("Image must be 10MB or smaller.");
      return;
    }
    setError("");
    onFileSelected(nextFile);
  }

  return (
    <section className="glass-panel p-4">
      <div
        className={`relative flex min-h-[280px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[28px] border border-dashed p-5 text-center transition ${
          isDragging ? "border-neon bg-neon/10" : "border-white/16 bg-white/[0.03]"
        }`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          validate(event.dataTransfer.files?.[0]);
        }}
      >
        <input
          ref={inputRef}
          className="hidden"
          type="file"
          accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
          onChange={(event) => validate(event.target.files?.[0])}
        />

        {previewUrl ? (
          <>
            <img src={previewUrl} alt="Upload preview" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/10 to-transparent" />
            <button
              type="button"
              className="icon-button absolute right-4 top-4 z-10"
              aria-label="Remove image"
              onClick={(event) => {
                event.stopPropagation();
                onClear();
              }}
            >
              <X size={18} />
            </button>
            <div className="relative z-10 mt-auto w-full text-left">
              <p className="text-sm font-semibold text-white">{file?.name}</p>
              <p className="text-xs text-white/68">Tap to choose another image</p>
            </div>
          </>
        ) : (
          <>
            <div className="mb-5 rounded-full border border-neon/30 bg-neon/10 p-4 text-neon shadow-glow">
              <UploadCloud size={34} />
            </div>
            <h2 className="text-xl font-semibold text-white">Upload image</h2>
            <p className="mt-2 max-w-xs text-sm leading-6 text-white/62">
              Drag and drop your image, or tap to browse. JPG, PNG, and WebP up to 10MB.
            </p>
          </>
        )}
      </div>
      {error ? <p className="mt-3 text-sm text-rose">{error}</p> : null}
    </section>
  );
}
