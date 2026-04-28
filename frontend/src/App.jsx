import { Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import CategorySelector from "./components/CategorySelector.jsx";
import GenerationScreen from "./components/GenerationScreen.jsx";
import ScaleSelector from "./components/ScaleSelector.jsx";
import UploadCard from "./components/UploadCard.jsx";
import { generateFirstVariation, uploadImage } from "./lib/api.js";

export default function App() {
  const [file, setFile] = useState(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("enhance_self");
  const [variationScale, setVariationScale] = useState("medium");
  const [firstImageUrl, setFirstImageUrl] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : ""), [file]);

  async function handleGenerate() {
    if (!file) {
      setError("Choose an image first.");
      return;
    }

    setIsGenerating(true);
    setError("");
    setProgress(8);
    const timer = window.setInterval(() => {
      setProgress((value) => (value < 90 ? Math.min(90, value + 7) : value));
    }, 650);

    try {
      const upload = uploadedImageUrl
        ? { imageUrl: uploadedImageUrl }
        : await uploadImage(file);
      setUploadedImageUrl(upload.imageUrl);

      const result = await generateFirstVariation({
        originalImageUrl: upload.imageUrl,
        category: selectedCategory,
        variationScale
      });
      setProgress(100);
      setFirstImageUrl(result.generatedImageUrl);
    } catch (err) {
      setError(err.message || "Generation failed.");
    } finally {
      window.clearInterval(timer);
      setIsGenerating(false);
    }
  }

  if (firstImageUrl) {
    return (
      <GenerationScreen
        originalImageUrl={uploadedImageUrl}
        initialImageUrl={firstImageUrl}
        selectedCategory={selectedCategory}
        variationScale={variationScale}
        onReset={() => {
          setFirstImageUrl("");
          setUploadedImageUrl("");
          setFile(null);
          setProgress(0);
          setError("");
        }}
      />
    );
  }

  return (
    <main className="min-h-screen overflow-hidden px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
        <section className="pt-4 lg:sticky lg:top-6">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-neon/25 bg-neon/10 px-3 py-2 text-xs font-medium text-neon shadow-glow">
            <Sparkles size={15} />
            AI image variation studio
          </div>
          <h1 className="max-w-xl text-5xl font-semibold leading-[1.02] tracking-normal sm:text-6xl lg:text-7xl">
            SwipeMorph AI
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-8 text-white/64">
            Swipe to discover your best AI version
          </p>
          <div className="mt-8">
            <UploadCard
              file={file}
              previewUrl={previewUrl}
              onFileSelected={(nextFile) => {
                setFile(nextFile);
                setUploadedImageUrl("");
                setError("");
              }}
              onClear={() => {
                setFile(null);
                setUploadedImageUrl("");
              }}
            />
          </div>
        </section>

        <section className="space-y-6">
          <CategorySelector value={selectedCategory} onChange={setSelectedCategory} />
          <ScaleSelector value={variationScale} onChange={setVariationScale} />

          <section className="glass-panel p-4">
            <button
              className="primary-button"
              type="button"
              disabled={isGenerating}
              onClick={handleGenerate}
            >
              <Sparkles size={20} />
              {isGenerating ? "Generating..." : "Generate"}
            </button>

            {isGenerating ? (
              <div className="mt-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/66">Creating first variation</span>
                  <span className="font-semibold text-neon">{progress}%</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-neon via-violet to-rose transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            ) : null}

            {error ? <p className="mt-4 text-sm text-rose">{error}</p> : null}
          </section>
        </section>
      </div>
    </main>
  );
}
