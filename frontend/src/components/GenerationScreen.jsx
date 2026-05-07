import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import { Check, ChevronLeft, ChevronRight, Coins, Download, Eye, Heart, Images, Pause, Play, RotateCw, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { generateNextVariation, prepareDownloadZip } from "../lib/api";

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

function preloadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = async () => {
      try {
        if (image.decode) {
          await image.decode();
        }
      } catch {
        // The image is still usable after onload even if decode is unavailable or rejected.
      }
      resolve();
    };
    image.onerror = reject;
    image.src = url;
  });
}

export default function GenerationScreen({
  originalImageUrl,
  initialImageUrl,
  selectedCategory,
  variationScale,
  coinCredits,
  generationCost,
  creditSymbol,
  onSpendCredits,
  onRewardCredits,
  onReset
}) {
  const [variations, setVariations] = useState([{ index: 1, url: initialImageUrl }]);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [isGeneratingNext, setIsGeneratingNext] = useState(false);
  const [isSwiping, setIsSwiping] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [autoSwipeDelayMs, setAutoSwipeDelayMs] = useState(5000);
  const [favorites, setFavorites] = useState([]);
  const [overlayMessage, setOverlayMessage] = useState("");
  const [showGallery, setShowGallery] = useState(false);
  const [selectedDownloadUrls, setSelectedDownloadUrls] = useState([initialImageUrl]);
  const [downloadStatus, setDownloadStatus] = useState("");
  const [tapRewardMessage, setTapRewardMessage] = useState("");
  const [tapBursts, setTapBursts] = useState([]);
  const [cardKey, setCardKey] = useState(1);
  const [error, setError] = useState("");
  const [autoSwipeSourcePosition, setAutoSwipeSourcePosition] = useState(null);
  const isRequestingRef = useRef(false);
  const limitGalleryOpenedRef = useRef(false);
  const controls = useAnimationControls();

  const currentVariation = variations[currentPosition] || variations[0];
  const currentImageUrl = currentVariation.url;
  const variationIndex = currentVariation.index;
  const hasPrevious = currentPosition > 0;
  const hasReadyNext = currentPosition < variations.length - 1;
  const generatedCount = variations.length;
  const reachedLimit = generatedCount >= MAX_VARIATIONS;
  const hasGenerationCredits = coinCredits >= generationCost;
  const autoSwipeEnabled = autoSwipeDelayMs > 0;
  const readyNext = hasReadyNext && !isGeneratingNext;
  const galleryItems = variations;
  const selectedGalleryItems = galleryItems.filter((item) => selectedDownloadUrls.includes(item.url));
  const statusLabel = reachedLimit
    ? "Session complete"
    : !hasGenerationCredits && !hasReadyNext
      ? `Need ${generationCost} ${creditSymbol} to generate`
    : isSwiping
      ? "Showing next variation"
    : readyNext
      ? "Next variation ready"
      : isGeneratingNext
        ? "Generating next variation..."
        : "Preparing queue";

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
        setAutoSwipeSourcePosition(null);
        setIsSwiping(true);
        await transitionToPosition(currentPosition + 1, direction);
        setIsSwiping(false);
        return;
      }

      if (isGeneratingNext) {
        setOverlayMessage(`Creating your next variation... ${generationProgress}%`);
        window.setTimeout(() => setOverlayMessage(""), 1800);
      }
    },
    [currentPosition, generationProgress, isGeneratingNext, transitionToPosition, variations.length]
  );

  const revealPrevious = useCallback(async () => {
    if (!hasPrevious) return;
    setOverlayMessage("");
    setIsSwiping(true);
    await transitionToPosition(currentPosition - 1, -1);
    setIsSwiping(false);
  }, [currentPosition, hasPrevious, transitionToPosition]);

  const requestNext = useCallback(async () => {
    if (isRequestingRef.current || reachedLimit) return;
    if (currentPosition < variations.length - 1) return;
    if (coinCredits < generationCost) return;
    isRequestingRef.current = true;
    setAutoSwipeSourcePosition(currentPosition);
    setIsGeneratingNext(true);
    setGenerationProgress(5);
    setError("");

    try {
      const latestVariation = variations[variations.length - 1];
      const nextIndex = latestVariation.index + 1;
      const result = await generateNextVariation({
        originalImageUrl,
        currentImageUrl: originalImageUrl,
        category: selectedCategory,
        variationScale,
        variationIndex: nextIndex
      });
      setGenerationProgress(100);
      await preloadImage(result.generatedImageUrl);
      onSpendCredits(generationCost);
      setVariations((items) => {
        if (items.some((item) => item.index === result.variationIndex) || items.length >= MAX_VARIATIONS) {
          return items;
        }
        return [
          ...items,
          {
            index: result.variationIndex,
            url: result.generatedImageUrl
          }
        ];
      });
    } catch (err) {
      setError(err.message || "Could not generate the next variation.");
    } finally {
      isRequestingRef.current = false;
      setIsGeneratingNext(false);
    }
  }, [coinCredits, currentPosition, generationCost, onSpendCredits, originalImageUrl, reachedLimit, selectedCategory, variationScale, variations]);

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
    if (!hasReadyNext || !autoSwipeEnabled || isSwiping || currentPosition !== autoSwipeSourcePosition) return undefined;
    const timer = window.setTimeout(() => {
      revealNext(1);
    }, autoSwipeDelayMs);
    return () => window.clearTimeout(timer);
  }, [autoSwipeDelayMs, autoSwipeEnabled, autoSwipeSourcePosition, currentPosition, hasReadyNext, isSwiping, revealNext]);

  useEffect(() => {
    if (!isGeneratingNext && !isRequestingRef.current && !reachedLimit) {
      requestNext();
    }
  }, [isGeneratingNext, reachedLimit, requestNext, variations.length]);

  useEffect(() => {
    if (reachedLimit && !limitGalleryOpenedRef.current) {
      limitGalleryOpenedRef.current = true;
      setShowGallery(true);
    }
  }, [reachedLimit]);

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

  function rewardPhotoTap(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const id = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    setTapBursts((items) => [
      ...items,
      {
        id,
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      }
    ]);
    onRewardCredits(1);
    setTapRewardMessage(`+1 ${creditSymbol}`);
    window.setTimeout(() => {
      setTapBursts((items) => items.filter((item) => item.id !== id));
    }, 950);
    window.setTimeout(() => setTapRewardMessage(""), 900);
  }

  function saveFavorite() {
    setFavorites((items) => (items.includes(currentImageUrl) ? items : [...items, currentImageUrl]));
  }

  function toggleAutoSwipe() {
    if (autoSwipeEnabled) {
      setAutoSwipeDelayMs(0);
      setShowGallery(true);
      return;
    }
    setAutoSwipeDelayMs(5000);
  }

  function downloadUrl(url, name) {
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  async function downloadAll() {
    await downloadItems(galleryItems);
  }

  async function downloadSelected() {
    await downloadItems(selectedGalleryItems);
  }

  async function downloadItems(items) {
    if (!items.length) {
      setDownloadStatus("Select at least one image.");
      return;
    }

    setError("");
    setDownloadStatus("Preparing ZIP...");
    try {
      const result = await prepareDownloadZip(
        items.map((item) => ({
          url: item.url,
          variationIndex: item.index
        }))
      );
      downloadUrl(result.downloadUrl, result.fileName || "swipemorph-variations.zip");
      setDownloadStatus(`Download ready: ${items.length} image${items.length === 1 ? "" : "s"}.`);
    } catch (err) {
      const message = err.message || "Could not download generated images.";
      setError(message);
      setDownloadStatus(message);
    }
  }

  function toggleDownloadSelection(url) {
    setSelectedDownloadUrls((items) =>
      items.includes(url) ? items.filter((item) => item !== url) : [...items, url]
    );
  }

  function selectGalleryItem(position) {
    setCurrentPosition(position);
    setCardKey((value) => value + 1);
    controls.set({ x: 0, rotate: 0, opacity: 1 });
    setOverlayMessage("");
    setShowGallery(false);
  }

  return (
    <main className="min-h-screen px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-neon">SwipeMorph AI</p>
            <h1 className="mt-2 text-2xl font-semibold sm:text-4xl">Variation studio</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[18px] border border-white/[0.12] bg-white/[0.06] px-4 text-sm font-bold text-white">
              <Coins size={17} className="text-neon" />
              {coinCredits} {creditSymbol}
            </div>
            <button className="secondary-button" type="button" onClick={onReset}>
              <RotateCw size={17} />
              New image
            </button>
          </div>
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
                  onClick={toggleAutoSwipe}
                >
                  {autoSwipeEnabled ? <Pause size={17} /> : <Play size={17} />}
                  {autoSwipeEnabled ? "Pause" : "Resume"}
                </button>
                <button className="icon-button" type="button" aria-label="View generated images" onClick={() => setShowGallery(true)}>
                  <Images size={18} />
                </button>
                <button className="icon-button" type="button" aria-label="Save favorite" onClick={saveFavorite}>
                  <Heart size={18} fill={favorites.includes(currentImageUrl) ? "currentColor" : "none"} />
                </button>
                <a className="icon-button" href={currentImageUrl} download={`swipemorph-variation-${variationIndex}.png`} aria-label="Download variation">
                  <Download size={18} />
                </a>
              </div>
            </div>

            <div className="relative mx-auto aspect-[4/5] max-h-[68vh] max-w-xl overflow-hidden rounded-[32px] border border-white/10 bg-ink shadow-card">
              <div className="pointer-events-none absolute inset-x-4 top-4 z-10 flex justify-center">
                <div className="inline-flex items-center gap-2 rounded-full border border-neon/30 bg-ink/72 px-3 py-2 text-xs font-bold text-white shadow-glow backdrop-blur">
                  <Coins size={14} className="text-neon" />
                  Tap photo to earn +1 {creditSymbol}
                </div>
              </div>
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
                  onClick={rewardPhotoTap}
                  onError={() => setError("This generated image URL could not be loaded.")}
                />
              </AnimatePresence>
              <AnimatePresence>
                {tapBursts.map((burst) => (
                  <motion.div
                    key={burst.id}
                    className="pointer-events-none absolute z-20"
                    style={{ left: burst.x, top: burst.y }}
                    initial={{ opacity: 0, scale: 0.45, x: "-50%", y: "-50%" }}
                    animate={{ opacity: 1, scale: 1, y: "-120%" }}
                    exit={{ opacity: 0, scale: 1.25, y: "-190%" }}
                    transition={{ duration: 0.62, ease: "easeOut" }}
                  >
                    <div className="relative">
                      <span className="absolute -inset-4 rounded-full bg-neon/25 blur-xl" />
                      <span className="relative inline-flex items-center gap-1 rounded-full border border-neon bg-neon px-3 py-2 text-sm font-black text-ink shadow-glow">
                        <Coins size={15} />
                        +1
                      </span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {tapRewardMessage ? (
                <motion.div
                  className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-2xl border border-neon/30 bg-neon px-4 py-3 text-sm font-black text-ink shadow-glow"
                  initial={{ opacity: 0, y: 18, scale: 0.94 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -12, scale: 0.98 }}
                >
                  {tapRewardMessage}
                </motion.div>
              ) : null}

              <div className="absolute inset-x-4 top-16 flex justify-between">
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
                    {statusLabel}
                  </p>
                  <p className="mt-1 text-xs text-white/48">
                    {autoSwipeEnabled
                      ? hasReadyNext && currentPosition === autoSwipeSourcePosition
                        ? `Auto-swipe in ${autoSwipeDelayMs / 1000} seconds`
                        : hasGenerationCredits
                          ? "Auto-swipe is active"
                          : `Tap photos to earn more ${creditSymbol}`
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

      {showGallery ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/80 p-3 backdrop-blur-md sm:items-center sm:p-6">
          <section className="glass-panel max-h-[88vh] w-full max-w-5xl overflow-hidden p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-neon">Generated set</p>
                <h2 className="mt-1 text-xl font-semibold">{galleryItems.length} variations</h2>
              </div>
              <div className="flex items-center gap-2">
                <button className="secondary-button" type="button" onClick={downloadSelected}>
                  <Download size={17} />
                  Selected ({selectedGalleryItems.length})
                </button>
                <button className="secondary-button" type="button" onClick={downloadAll}>
                  <Download size={17} />
                  All
                </button>
                <button className="icon-button" type="button" aria-label="Close gallery" onClick={() => setShowGallery(false)}>
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-[20px] border border-white/10 bg-white/[0.04] px-3 py-2">
              <p className="text-sm text-white/62">
                Select images with the check button, then download selected as one ZIP.
              </p>
              {downloadStatus ? <p className="text-sm text-neon">{downloadStatus}</p> : null}
            </div>

            <div className="grid max-h-[68vh] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3 lg:grid-cols-5">
              {galleryItems.map((item, position) => (
                <article
                  key={`${item.index}-${item.url}`}
                  className={`group overflow-hidden rounded-[22px] border bg-white/[0.04] text-left transition ${
                    item.url === currentImageUrl
                      ? "border-neon/80 shadow-glow"
                      : "border-white/10 hover:border-neon/40"
                  }`}
                >
                  <div className="relative aspect-[4/5] bg-ink">
                    <img src={item.url} alt={`Variation ${item.index}`} className="h-full w-full object-cover transition group-hover:scale-[1.02]" />
                    <button
                      type="button"
                      className={`absolute right-3 top-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl border backdrop-blur transition ${
                        selectedDownloadUrls.includes(item.url)
                          ? "border-neon bg-neon text-ink"
                          : "border-white/20 bg-ink/60 text-white hover:border-neon"
                      }`}
                      aria-label={`Select variation ${item.index} for download`}
                      onClick={() => toggleDownloadSelection(item.url)}
                    >
                      <Check size={18} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-2 p-3">
                    <span className="text-sm font-semibold text-white">#{item.index}</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] px-2 py-1 text-xs font-semibold text-white/70 transition hover:border-neon/40 hover:text-neon"
                        onClick={() => selectGalleryItem(position)}
                      >
                        <Eye size={13} />
                        View
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
