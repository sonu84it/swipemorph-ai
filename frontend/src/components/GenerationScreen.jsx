import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import { ChevronLeft, ChevronRight, Download, Heart, Pause, Play, RotateCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { generateNextVariation } from "../lib/api";

const categoryLabels = {
  enhance_self: "Enhance Self",
  style_fashion: "Style & Fashion",
  travel_scene: "Travel Scene",
  food_aesthetic: "Food Aesthetic",
  fitness_look: "Fitness Look"
};

const MAX_VARIATIONS = 10;
const AUTO_SWIPE_OPTIONS = [
  { label: "3s", value: 3000 },
  { label: "5s", value: 5000 },
  { label: "8s", value: 8000 },
  { label: "Off", value: 0 }
];

export default function GenerationScreen({
  originalImageUrl,
  initialImageUrl,
  selectedCategory,
  variationScale,
  onReset
}) {
  const [variations, setVariations] = useState([{ index: 1, url: initialImageUrl }]);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [nextVariation, setNextVariation] = useState(null);
  const [isGeneratingNext, setIsGeneratingNext] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [autoSwipeDelayMs, setAutoSwipeDelayMs] = useState(5000);
  const [favorites, setFavorites] = useState([]);
  const [overlayMessage, setOverlayMessage] = useState("");
  const [cardKey, setCardKey] = useState(1);
  const [error, setError] = useState("");
  const isRequestingRef = useRef(false);
  const controls = useAnimationControls();

  const currentVariation = variations[currentPosition] || variations[0];
  const currentImageUrl = currentVariation.url;
  const variationIndex = currentVariation.index;
  const isAtLatest = currentPosition === variations.length - 1;
  const hasPrevious = currentPosition > 0;
  const hasReadyNext = currentPosition < variations.length - 1 || Boolean(nextVariation);
  const generatedCount = variations.length + (nextVariation ? 1 : 0);
  const reachedLimit = generatedCount >= MAX_VARIATIONS;
  const autoSwipeEnabled = autoSwipeDelayMs > 0;

  const transitionToPosition = useCallback(
    async (nextPosition, direction = 1) => {
      await controls.start({
        x: direction > 0 ? -420 : 420,
        rotate: direction > 0 ? -8 : 8,
        opacity: 0,
        transition: { duration: 0.28, ease: "easeInOut" }
      });
      setCurrentPosition(nextPosition);
      setCardKey((value) => value + 1);
      controls.set({ x: direction > 0 ? 420 : -420, rotate: direction > 0 ? 7 : -7, opacity: 0 });
      await controls.start({
        x: 0,
        rotate: 0,
        opacity: 1,
        transition: { type: "spring", stiffness: 190, damping: 23 }
      });
    },
    [controls]
  );

  const revealNext = useCallback(
    async (direction = 1) => {
      if (currentPosition < variations.length - 1) {
        await transitionToPosition(currentPosition + 1, direction);
        return;
      }

      if (!nextVariation) return;

      const appendedPosition = variations.length;
      setOverlayMessage("Next variation ready");
      setVariations((items) => [...items, nextVariation]);
      setNextVariation(null);
      await transitionToPosition(appendedPosition, direction);
      setOverlayMessage("");
    },
    [currentPosition, nextVariation, transitionToPosition, variations.length]
  );

  const revealPrevious = useCallback(async () => {
    if (!hasPrevious) return;
    setOverlayMessage("");
    await transitionToPosition(currentPosition - 1, -1);
  }, [currentPosition, hasPrevious, transitionToPosition]);

  const requestNext = useCallback(async () => {
    if (isRequestingRef.current || nextVariation || reachedLimit) return;
    isRequestingRef.current = true;
    setIsGeneratingNext(true);
    setGenerationProgress(5);
    setError("");

    try {
      const latestVariation = variations[variations.length - 1];
      const nextIndex = latestVariation.index + 1;
      const result = await generateNextVariation({
        originalImageUrl,
        currentImageUrl: latestVariation.url,
        category: selectedCategory,
        variationScale,
        variationIndex: nextIndex
      });
      setGenerationProgress(100);
      setNextVariation({
        index: result.variationIndex,
        url: result.generatedImageUrl
      });
    } catch (err) {
      setError(err.message || "Could not generate the next variation.");
    } finally {
      isRequestingRef.current = false;
      setIsGeneratingNext(false);
    }
  }, [nextVariation, originalImageUrl, reachedLimit, selectedCategory, variationScale, variations]);

  useEffect(() => {
    requestNext();
  }, [requestNext]);

  useEffect(() => {
    if (!isGeneratingNext) return undefined;
    const timer = window.setInterval(() => {
      setGenerationProgress((value) => (value < 90 ? Math.min(90, value + Math.ceil(Math.random() * 6)) : value));
    }, 700);
    return () => window.clearInterval(timer);
  }, [isGeneratingNext]);

  useEffect(() => {
    if (!nextVariation || !autoSwipeEnabled || !isAtLatest) return undefined;
    const timer = window.setTimeout(() => {
      revealNext(1);
    }, autoSwipeDelayMs);
    return () => window.clearTimeout(timer);
  }, [autoSwipeDelayMs, autoSwipeEnabled, isAtLatest, nextVariation, revealNext]);

  useEffect(() => {
    if (!nextVariation && !isGeneratingNext && !isRequestingRef.current && !reachedLimit) {
      requestNext();
    }
  }, [isGeneratingNext, nextVariation, reachedLimit, requestNext, variations.length]);

  async function handleManualSwipe(direction) {
    if (direction < 0) {
      await revealPrevious();
      return;
    }

    if (hasReadyNext) {
      await revealNext(1);
      return;
    }

    if (reachedLimit) {
      setOverlayMessage(`Session limit reached: ${MAX_VARIATIONS} variations`);
      window.setTimeout(() => setOverlayMessage(""), 1800);
      return;
    }

    setOverlayMessage(`Creating your next variation... ${generationProgress}%`);
    window.setTimeout(() => setOverlayMessage(""), 1800);
  }

  function saveFavorite() {
    setFavorites((items) => (items.includes(currentImageUrl) ? items : [...items, currentImageUrl]));
  }

  return (
    <main className="min-h-screen px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-neon">SwipeMorph AI</p>
            <h1 className="mt-2 text-2xl font-semibold sm:text-4xl">Variation studio</h1>
          </div>
          <button className="secondary-button" type="button" onClick={onReset}>
            <RotateCw size={17} />
            New image
          </button>
        </header>

        <section className="grid gap-5 lg:grid-cols-[0.82fr_1.18fr]">
          <aside className="glass-panel p-4">
            <p className="mb-3 text-sm font-medium text-white/70">Original</p>
            <div className="aspect-[4/5] overflow-hidden rounded-[26px] border border-white/10 bg-white/[0.03]">
              <img src={originalImageUrl} alt="Original" className="h-full w-full object-cover" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="metric">
                <span>Intent</span>
                <strong>{categoryLabels[selectedCategory]}</strong>
              </div>
              <div className="metric">
                <span>Scale</span>
                <strong className="capitalize">{variationScale}</strong>
              </div>
            </div>
          </aside>

          <section className="glass-panel relative overflow-hidden p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-white/55">Current variation</p>
                <h2 className="text-xl font-semibold">
                  #{variationIndex} <span className="text-sm font-normal text-white/42">of {MAX_VARIATIONS}</span>
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="icon-text-button"
                  type="button"
                  aria-label={autoSwipeEnabled ? "Pause auto swipe" : "Resume auto swipe"}
                  onClick={() => setAutoSwipeDelayMs((value) => (value > 0 ? 0 : 5000))}
                >
                  {autoSwipeEnabled ? <Pause size={17} /> : <Play size={17} />}
                  {autoSwipeEnabled ? "Pause" : "Resume"}
                </button>
                <button className="icon-button" type="button" aria-label="Save favorite" onClick={saveFavorite}>
                  <Heart size={18} fill={favorites.includes(currentImageUrl) ? "currentColor" : "none"} />
                </button>
                <a className="icon-button" href={currentImageUrl} download aria-label="Download variation">
                  <Download size={18} />
                </a>
              </div>
            </div>

            <div className="relative mx-auto aspect-[4/5] max-h-[68vh] max-w-xl overflow-hidden rounded-[32px] border border-white/10 bg-ink shadow-card">
              <AnimatePresence mode="wait">
                <motion.img
                  key={cardKey}
                  src={currentImageUrl}
                  alt="Generated variation"
                  className="h-full w-full cursor-grab object-cover active:cursor-grabbing"
                  animate={controls}
                  initial={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  onDragEnd={(_, info) => {
                    if (Math.abs(info.offset.x) > 80 || Math.abs(info.velocity.x) > 420) {
                      handleManualSwipe(info.offset.x > 0 ? -1 : 1);
                    }
                  }}
                  onError={() => setError("This generated image URL could not be loaded.")}
                />
              </AnimatePresence>

              <div className="absolute inset-x-4 top-4 flex justify-between">
                <button
                  className="icon-button bg-ink/68 backdrop-blur"
                  type="button"
                  aria-label="Previous variation"
                  disabled={!hasPrevious}
                  onClick={revealPrevious}
                >
                  <ChevronLeft size={19} />
                </button>
                <button
                  className="icon-button bg-ink/68 backdrop-blur"
                  type="button"
                  aria-label="Next variation"
                  disabled={!hasReadyNext && reachedLimit}
                  onClick={() => handleManualSwipe(1)}
                >
                  <ChevronRight size={19} />
                </button>
              </div>

              {overlayMessage ? (
                <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-neon/25 bg-ink/82 p-4 text-sm text-white shadow-glow backdrop-blur">
                  {overlayMessage}
                </div>
              ) : null}
            </div>

            <div className="mt-4 rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">
                    {reachedLimit && !nextVariation
                      ? "Session complete"
                      : nextVariation
                        ? "Next variation ready"
                        : isGeneratingNext
                          ? "Generating next variation..."
                          : "Preparing queue"}
                  </p>
                  <p className="mt-1 text-xs text-white/48">
                    {autoSwipeEnabled
                      ? nextVariation && isAtLatest
                        ? `Auto-swipe in ${autoSwipeDelayMs / 1000} seconds`
                        : "Auto-swipe is active"
                      : "Auto-swipe is paused"}
                  </p>
                </div>
                <span className="text-sm font-semibold text-neon">
                  {generatedCount}/{MAX_VARIATIONS}
                </span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-neon via-violet to-rose transition-all duration-500"
                  style={{ width: `${generationProgress}%` }}
                />
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="mr-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/42">
                  Auto
                </span>
                {AUTO_SWIPE_OPTIONS.map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    className={`rounded-2xl border px-3 py-2 text-xs font-semibold transition ${
                      autoSwipeDelayMs === option.value
                        ? "border-neon/70 bg-neon/12 text-neon shadow-glow"
                        : "border-white/10 bg-white/[0.04] text-white/60 hover:border-neon/40 hover:text-white"
                    }`}
                    onClick={() => setAutoSwipeDelayMs(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {error ? <p className="mt-3 text-sm text-rose">{error}</p> : null}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
