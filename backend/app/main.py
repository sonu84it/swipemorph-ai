from pathlib import Path
from io import BytesIO
from uuid import uuid4
from urllib.parse import unquote, urlparse
from zipfile import ZIP_DEFLATED, ZipFile

import requests
from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles

from app.config import Settings, get_settings
from app.schemas import (
    FirstVariationRequest,
    DownloadZipRequest,
    DownloadZipResponse,
    HealthResponse,
    NextVariationRequest,
    UploadResponse,
    VariationResponse,
)
from app.storage import StorageService
from app.vertex import VertexImageService


settings = get_settings()
Path(settings.local_storage_dir).mkdir(parents=True, exist_ok=True)
(Path(settings.local_storage_dir) / "downloads").mkdir(parents=True, exist_ok=True)
app = FastAPI(title="SwipeMorph AI API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/local", StaticFiles(directory=settings.local_storage_dir), name="local")


def read_image_bytes(url: str, settings: Settings) -> bytes:
    parsed = urlparse(url)
    if parsed.path.startswith("/local/"):
        relative_path = unquote(parsed.path.removeprefix("/local/"))
        local_root = Path(settings.local_storage_dir).resolve()
        local_path = (local_root / relative_path).resolve()
        if local_root not in local_path.parents and local_path != local_root:
            raise HTTPException(status_code=400, detail="Invalid local image path.")
        return local_path.read_bytes()

    response = requests.get(url, timeout=45)
    response.raise_for_status()
    return response.content


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
            str(request.originalImageUrl),
            request.category,
            request.variationScale,
            variation_index=request.variationIndex,
        )
        generated_url = storage.upload_generated_image(image_data, content_type)
        return VariationResponse(generatedImageUrl=generated_url, variationIndex=request.variationIndex)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Image generation failed: {exc}") from exc


@app.post("/api/download-variations")
async def download_variations(
    request: DownloadZipRequest,
    settings: Settings = Depends(get_settings),
) -> StreamingResponse:
    if not request.images:
        raise HTTPException(status_code=400, detail="No images provided for download.")

    archive = BytesIO()
    try:
        with ZipFile(archive, "w", ZIP_DEFLATED) as zip_file:
            for image in request.images:
                data = read_image_bytes(str(image.url), settings)
                zip_file.writestr(f"swipemorph-variation-{image.variationIndex}.png", data)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not prepare download: {exc}") from exc

    archive.seek(0)
    headers = {"Content-Disposition": 'attachment; filename="swipemorph-variations.zip"'}
    return StreamingResponse(archive, media_type="application/zip", headers=headers)


@app.post("/api/prepare-download", response_model=DownloadZipResponse)
async def prepare_download(
    request: DownloadZipRequest,
    settings: Settings = Depends(get_settings),
) -> DownloadZipResponse:
    if not request.images:
        raise HTTPException(status_code=400, detail="Select at least one image to download.")

    file_name = f"swipemorph-variations-{uuid4().hex}.zip"
    relative_path = f"downloads/{file_name}"
    archive_path = Path(settings.local_storage_dir) / relative_path

    try:
        with ZipFile(archive_path, "w", ZIP_DEFLATED) as zip_file:
            for image in request.images:
                data = read_image_bytes(str(image.url), settings)
                zip_file.writestr(f"swipemorph-variation-{image.variationIndex}.png", data)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not prepare download: {exc}") from exc

    return DownloadZipResponse(
        downloadUrl=f"{settings.backend_public_url.rstrip('/')}/local/{relative_path}",
        fileName=file_name,
    )
