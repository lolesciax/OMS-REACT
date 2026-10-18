"""Small, fully decodable images for upload regression tests."""
import io
from PIL import Image

buffer = io.BytesIO()
Image.new('RGB', (4, 4), 'green').save(buffer, format='PNG')
VALID_PNG = buffer.getvalue()
