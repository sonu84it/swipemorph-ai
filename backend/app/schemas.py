from enum import Enum

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


class HealthResponse(BaseModel):
    status: str = "ok"
