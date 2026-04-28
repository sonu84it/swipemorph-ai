from io import BytesIO
from pathlib import Path
from urllib.parse import unquote, urlparse

import requests
from google import genai
from google.genai import types
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont, ImageOps

from app.config import Settings
from app.prompts import CATEGORY_PROMPTS, SCALE_RULES
from app.schemas import Category, VariationScale


class VertexImageService:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.mock_mode = settings.mock_vertex_images
        self.client = None
        if not self.mock_mode:
            if not settings.google_cloud_project:
                raise RuntimeError("GOOGLE_CLOUD_PROJECT is required to use Vertex AI. Set MOCK_VERTEX_IMAGES=true only for local preview mode.")
            if not settings.vertex_image_model:
                raise RuntimeError("VERTEX_IMAGE_MODEL is required to use Vertex AI.")
            self.client = genai.Client(
                vertexai=True,
                project=settings.google_cloud_project,
                location=settings.google_cloud_location,
                http_options=types.HttpOptions(api_version="v1"),
            )

    def _download_image(self, image_url: str) -> tuple[bytes, str]:
        parsed = urlparse(image_url)
        local_prefix = "/local/"
        if parsed.path.startswith(local_prefix):
            relative_path = unquote(parsed.path.removeprefix(local_prefix))
            local_path = (Path(self.settings.local_storage_dir) / relative_path).resolve()
            local_root = Path(self.settings.local_storage_dir).resolve()
            if local_root not in local_path.parents and local_path != local_root:
                raise ValueError("Invalid local image path")
            content_type = "image/jpeg" if local_path.suffix.lower() in {".jpg", ".jpeg"} else "image/png"
            return local_path.read_bytes(), content_type

        response = requests.get(image_url, timeout=45)
        response.raise_for_status()
        content_type = response.headers.get("content-type", "image/png").split(";")[0]
        return response.content, content_type

    def _image_part(self, data: bytes, mime_type: str):
        return types.Part.from_bytes(data=data, mime_type=mime_type)

    def _build_edit_prompt(self, category: Category, scale: VariationScale, variation_index: int) -> str:
        return f"""
Analyze the uploaded image first. Identify the subject, whether it is a person, object, food, location, or lifestyle
scene, plus the background, lighting, colors, outfit, composition, mood, and key objects.

Then generate exactly one edited image variation #{variation_index}.

Transformation intent:
{CATEGORY_PROMPTS[category]}

Variation scale:
{SCALE_RULES[scale]}

Important output requirements:
- Return an edited image, not only text.
- Preserve the recognizable main subject where applicable.
- Keep the result photorealistic and premium.
- Avoid text, labels, watermarks, distorted hands, extra limbs, plastic skin, or unrealistic anatomy.
- Use a 4:5 portrait composition when possible.
"""

    def _generate_image(self, image_data: bytes, mime_type: str, prompt: str) -> tuple[bytes, str]:
        response = self.client.models.generate_content(
            model=self.settings.vertex_image_model,
            contents=types.Content(
                role="user",
                parts=[
                    self._image_part(image_data, mime_type),
                    types.Part.from_text(text=prompt),
                ],
            ),
            config=types.GenerateContentConfig(
                response_modalities=[types.Modality.TEXT, types.Modality.IMAGE],
                candidate_count=1,
            ),
        )

        for candidate in response.candidates or []:
            for part in candidate.content.parts or []:
                if part.inline_data and part.inline_data.data:
                    return part.inline_data.data, part.inline_data.mime_type or "image/png"

        raise RuntimeError("Vertex AI did not return an image.")

    def _fit_card_image(self, image: Image.Image) -> Image.Image:
        image = ImageOps.exif_transpose(image.convert("RGB"))
        target_size = (1024, 1280)
        source_ratio = image.width / image.height
        target_ratio = target_size[0] / target_size[1]

        if source_ratio > target_ratio:
            new_height = target_size[1]
            new_width = round(new_height * source_ratio)
        else:
            new_width = target_size[0]
            new_height = round(new_width / source_ratio)

        image = image.resize((new_width, new_height), Image.Resampling.LANCZOS)
        left = max(0, (new_width - target_size[0]) // 2)
        top = max(0, (new_height - target_size[1]) // 2)
        return image.crop((left, top, left + target_size[0], top + target_size[1]))

    def _apply_mock_variation(self, image: Image.Image, category: Category, scale: VariationScale, variation_index: int) -> Image.Image:
        strength = {
            VariationScale.low: 0.18,
            VariationScale.medium: 0.34,
            VariationScale.high: 0.52,
        }[scale]
        category_tints = {
            Category.enhance_self: (255, 218, 196),
            Category.style_fashion: (178, 144, 255),
            Category.travel_scene: (76, 213, 255),
            Category.food_aesthetic: (255, 161, 88),
            Category.fitness_look: (92, 255, 190),
        }

        image = ImageEnhance.Contrast(image).enhance(1 + strength * 0.45)
        image = ImageEnhance.Color(image).enhance(1 + strength * 0.75)
        image = ImageEnhance.Sharpness(image).enhance(1 + strength * 0.65)
        if scale == VariationScale.high:
            image = image.filter(ImageFilter.UnsharpMask(radius=2, percent=145, threshold=3))

        tint = Image.new("RGB", image.size, category_tints[category])
        image = Image.blend(image, tint, strength * 0.16)

        glow = Image.new("RGBA", image.size, (0, 0, 0, 0))
        glow_draw = ImageDraw.Draw(glow)
        glow_draw.rectangle((0, 0, image.width, image.height), outline=(71, 246, 197, 110), width=8)
        glow_draw.rectangle((0, round(image.height * 0.66), image.width, image.height), fill=(8, 10, 22, 74))
        image = Image.alpha_composite(image.convert("RGBA"), glow).convert("RGB")
        return image

    def _mock_image(self, source_image_url: str, category: Category, scale: VariationScale, variation_index: int) -> tuple[bytes, str]:
        try:
            source_data, _ = self._download_image(source_image_url)
            image = Image.open(BytesIO(source_data))
            image = self._fit_card_image(image)
            image = self._apply_mock_variation(image, category, scale, variation_index)
        except Exception:
            image = Image.new("RGB", (1024, 1280), color=(14, 20, 36))

        draw = ImageDraw.Draw(image, "RGBA")
        try:
            font = ImageFont.truetype("Arial.ttf", 32)
            small = ImageFont.truetype("Arial.ttf", 24)
        except OSError:
            font = ImageFont.load_default()
            small = ImageFont.load_default()
        badge_y = image.height - 128
        draw.rounded_rectangle((42, badge_y, image.width - 42, image.height - 42), radius=28, fill=(8, 10, 22, 150), outline=(71, 246, 197, 110), width=2)
        draw.text((76, badge_y + 22), f"Local preview variation #{variation_index}", fill=(255, 255, 255, 235), font=font)
        draw.text((76, badge_y + 66), f"{category.value.replace('_', ' ')} / {scale.value}", fill=(220, 255, 246, 210), font=small)
        output = BytesIO()
        image.save(output, format="PNG")
        return output.getvalue(), "image/png"

    def generate_variation(
        self,
        source_image_url: str,
        category: Category,
        scale: VariationScale,
        variation_index: int,
    ) -> tuple[bytes, str]:
        if self.mock_mode:
            return self._mock_image(source_image_url, category, scale, variation_index)

        image_data, mime_type = self._download_image(source_image_url)
        prompt = self._build_edit_prompt(category, scale, variation_index)
        return self._generate_image(image_data, mime_type, prompt)
