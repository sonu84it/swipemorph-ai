from pathlib import Path

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import Settings, get_settings
from app.schemas import (
    FirstVariationRequest,
    HealthResponse,
    NextVariationRequest,
    UploadResponse,
    VariationResponse,
)
from app.storage import StorageService
from app.vertex import VertexImageService


settings = get_settings()
Path(settings.local_storage_dir).mkdir(parents=True, exist_ok=True)
app = FastAPI(title="SwipeMorph AI API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/local", StaticFiles(directory=settings.local_storage_dir), name="local")


def get_storage(settings: Settings = Depends(get_settings)) -> StorageService:
    return StorageService(settings)


def get_vertex(settings: Settings = Depends(get_settings)) -> VertexImageService:
    try:
        return VertexImageService(settings)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.get("/api/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse()


@app.post("/api/upload", response_model=UploadResponse)
async def upload_image(file: UploadFile = File(...), storage: StorageService = Depends(get_storage)) -> UploadResponse:
    image_url, file_name = await storage.upload_user_image(file)
    return UploadResponse(imageUrl=image_url, fileName=file_name)


@app.post("/api/generate-first-variation", response_model=VariationResponse)
async def generate_first_variation(
    request: FirstVariationRequest,
    storage: StorageService = Depends(get_storage),
    vertex: VertexImageService = Depends(get_vertex),
) -> VariationResponse:
    try:
        image_data, content_type = vertex.generate_variation(
            str(request.originalImageUrl),
            request.category,
            request.variationScale,
            variation_index=1,
        )
        generated_url = storage.upload_generated_image(image_data, content_type)
        return VariationResponse(generatedImageUrl=generated_url, variationIndex=1)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Image generation failed: {exc}") from exc


@app.post("/api/generate-next-variation", response_model=VariationResponse)
async def generate_next_variation(
    request: NextVariationRequest,
    storage: StorageService = Depends(get_storage),
    vertex: VertexImageService = Depends(get_vertex),
) -> VariationResponse:
    try:
        image_data, content_type = vertex.generate_variation(
            str(request.currentImageUrl),
            request.category,
            request.variationScale,
            variation_index=request.variationIndex,
        )
        generated_url = storage.upload_generated_image(image_data, content_type)
        return VariationResponse(generatedImageUrl=generated_url, variationIndex=request.variationIndex)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Image generation failed: {exc}") from exc
