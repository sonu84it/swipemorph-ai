from app.schemas import Category, VariationScale


CATEGORY_PROMPTS = {
    Category.enhance_self: (
        "Analyze the uploaded image and identify the main person or subject. Generate a refined version with "
        "improved lighting, realistic skin tone, natural facial refinement, premium portrait quality, and subtle "
        "background improvement. Preserve identity, face structure, pose, and realism. Avoid over-editing."
    ),
    Category.style_fashion: (
        "Analyze the person, outfit, accessories, and styling. Generate a new fashion-forward version with upgraded "
        "outfit, premium accessories, improved posture, editorial lighting, and modern styling. Preserve identity and "
        "body structure. Avoid unrealistic body changes."
    ),
    Category.travel_scene: (
        "Analyze the subject and place them into a beautiful travel environment such as a beach, mountain, luxury "
        "resort, city skyline, or scenic landmark. Match lighting and perspective realistically. Preserve the subject "
        "and create cinematic travel photography."
    ),
    Category.food_aesthetic: (
        "Analyze the food, table, or lifestyle scene. Create a premium food photography version with better plating, "
        "richer colors, appetizing detail, restaurant-quality lighting, and luxury presentation. Preserve the original "
        "food concept."
    ),
    Category.fitness_look: (
        "Analyze the person and create a fitness-inspired image with athletic styling, motivational lighting, gym or "
        "outdoor fitness setting, confident pose, and healthy realistic appearance. Preserve identity and avoid "
        "extreme or unrealistic body modification."
    ),
}


SCALE_RULES = {
    VariationScale.low: (
        "Low variation: small changes only. Preserve original identity, composition, and background. Improve quality, "
        "lighting, sharpness, color, and polish."
    ),
    VariationScale.medium: (
        "Medium variation: noticeable creative variation. Preserve the main subject. Change style, lighting, "
        "background, outfit, or mood moderately."
    ),
    VariationScale.high: (
        "High variation: bold creative transformation. Use a new environment, styling, cinematic mood, and stronger "
        "visual concept. Keep subject recognizable where applicable."
    ),
}


ANALYSIS_PROMPT = """
Analyze this image for an image-editing workflow. Return a concise structured description covering:
- subject
- whether the image is person, object, food, location, or lifestyle
- background
- lighting
- colors
- outfit and accessories if any
- composition
- mood
- key objects
"""


def build_generation_prompt(category: Category, scale: VariationScale, analysis: str, variation_index: int) -> str:
    return f"""
You are editing an uploaded image with Gemini image generation on Vertex AI.

Image analysis:
{analysis}

Transformation intent:
{CATEGORY_PROMPTS[category]}

Variation scale:
{SCALE_RULES[scale]}

Generate variation #{variation_index}. Produce one polished, photorealistic image. Preserve identity and core subject
details where applicable. Avoid text, watermarks, distorted hands, extra limbs, plastic skin, or unrealistic anatomy.
"""
