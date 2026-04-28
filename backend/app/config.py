from functools import lru_cache
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    google_cloud_project: str = Field(default="", alias="GOOGLE_CLOUD_PROJECT")
    google_cloud_location: str = Field(default="us-central1", alias="GOOGLE_CLOUD_LOCATION")
    gcs_bucket_name: str = Field(default="", alias="GCS_BUCKET_NAME")
    vertex_image_model: str = Field(default="gemini-2.5-flash-image", alias="VERTEX_IMAGE_MODEL")
    cors_allowed_origins: str = Field(default="http://localhost:5173", alias="CORS_ALLOWED_ORIGINS")
    signed_url_expiration_minutes: int = Field(default=60, alias="SIGNED_URL_EXPIRATION_MINUTES")
    use_public_urls: bool = Field(default=False, alias="GCS_USE_PUBLIC_URLS")
    mock_vertex_images: bool = Field(default=False, alias="MOCK_VERTEX_IMAGES")
    backend_public_url: str = Field(default="http://127.0.0.1:8080", alias="BACKEND_PUBLIC_URL")
    local_storage_dir: str = Field(default="/tmp/swipemorph-ai", alias="LOCAL_STORAGE_DIR")

    model_config = SettingsConfigDict(env_file=".env", extra="ignore", populate_by_name=True)

    @property
    def cors_origins(self) -> List[str]:
        return [origin.strip() for origin in self.cors_allowed_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
