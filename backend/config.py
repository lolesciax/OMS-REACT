import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    # MongoDB Atlas connection
    MONGO_URI = os.getenv('MONGO_URI', 'mongodb+srv://username:password@cluster0.xxx.mongodb.net/')
    DATABASE_NAME = "OMS_DB"
    
    # Flask settings
    SECRET_KEY = os.getenv('SECRET_KEY', 'your-secret-key-here')
    
    # CORS settings - allow your React dev server
    CORS_ORIGINS = ["http://localhost:5173"]  # Vite default port