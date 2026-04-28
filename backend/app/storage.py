from datetime import timedelta
from pathlib import Path
from pathlib import PurePosixPath
from typing import Tuple
from uuid import uuid4

from fastapi import HTTPException, UploadFile
from google.cloud import storage

from app.config import Settings


ALLOWED_CONTENT_TYPES = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}
MAX_UPLOAD_SIZE = 10 * 1024 * 1024


class StorageService:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.local_mode = not settings.gcs_bucket_name
        self.local_root = Path(settings.local_storage_dir)
        self.client = None
        self.bucket = None

        if self.local_mode:
            (self.local_root / "uploads").mkdir(parents=True, exist_ok=True)
            (self.local_root / "results").mkdir(parents=True, exist_ok=True)
        else:
            self.client = storage.Client(project=settings.google_cloud_project or None)
            self.bucket = self.client.bucket(settings.gcs_bucket_name)

    def public_or_signed_url(self, blob_name: str) -> str:
        if self.local_mode:
            return f"{self.settings.backend_public_url.rstrip('/')}/local/{blob_name}"

        blob = self.bucket.blob(blob_name)
        if self.settings.use_public_urls:
            return f"https://storage.googleapis.com/{self.settings.gcs_bucket_name}/{blob_name}"
        return blob.generate_signed_url(
            version="v4",
            expiration=timedelta(minutes=self.settings.signed_url_expiration_minutes),
            method="GET",
        )

    async def upload_user_image(self, file: UploadFile) -> Tuple[str, str]:
        if file.content_type not in ALLOWED_CONTENT_TYPES:
            raise HTTPException(status_code=400, detail="Unsupported image type. Use JPG, PNG, or WebP.")

        data = await file.read()
        if not data:
            raise HTTPException(status_code=400, detail="Uploaded image is empty.")
        if len(data) > MAX_UPLOAD_SIZE:
            raise HTTPException(status_code=413, detail="Image must be 10MB or smaller.")

        ext = ALLOWED_CONTENT_TYPES[file.content_type]
        safe_stem = PurePosixPath(file.filename or "upload").stem[:48].replace(" ", "-")
        blob_name = f"uploads/{uuid4().hex}-{safe_stem}{ext}"

        if self.local_mode:
            path = self.local_root / blob_name
            path.write_bytes(data)
            return self.public_or_signed_url(blob_name), blob_name

        blob = self.bucket.blob(blob_name)
        blob.upload_from_string(data, content_type=file.content_type)
        return self.public_or_signed_url(blob_name), blob_name

    def upload_generated_image(self, data: bytes, content_type: str = "image/png") -> str:
        ext = ".jpg" if content_type == "image/jpeg" else ".png"
        blob_name = f"results/{uuid4().hex}{ext}"

        if self.local_mode:
            path = self.local_root / blob_name
            path.write_bytes(data)
            return self.public_or_signed_url(blob_name)

        blob = self.bucket.blob(blob_name)
        blob.upload_from_string(data, content_type=content_type)
        return self.public_or_signed_url(blob_name)
