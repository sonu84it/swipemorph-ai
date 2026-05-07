from enum import Enum
from typing import List

from pydantic import BaseModel, HttpUrl


class Category(str, Enum):
    enhance_self = "enhance_self"
    style_fashion = "style_fashion"
    travel_scene = "travel_scene"
    food_aesthetic = "food_aesthetic"
    fitness_look = "fitness_look"


class VariationScale(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"


class UploadResponse(BaseModel):
    imageUrl: str
    fileName: str
    status: str = "uploaded"


class FirstVariationRequest(BaseModel):
    originalImageUrl: HttpUrl
    category: Category
    variationScale: VariationScale


class NextVariationRequest(BaseModel):
    originalImageUrl: HttpUrl
    currentImageUrl: HttpUrl
    category: Category
    variationScale: VariationScale
    variationIndex: int


class VariationResponse(BaseModel):
    generatedImageUrl: str
    variationIndex: int
    status: str = "completed"


class DownloadVariationItem(BaseModel):
    url: HttpUrl
    variationIndex: int


class DownloadZipRequest(BaseModel):
    images: List[DownloadVariationItem]


class DownloadZipResponse(BaseModel):
    downloadUrl: str
    fileName: str
    status: str = "ready"


class HealthResponse(BaseModel):
    status: str = "ok"
